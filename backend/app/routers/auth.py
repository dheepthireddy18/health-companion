import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import calorie_plan, calories as cal, care_team, google_auth, models as m, schemas as s
from ..data import load
from ..database import get_db
from ..security import current_user, hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: s.LoginIn, db: Session = Depends(get_db)):
    user = db.scalars(select(m.User).where(m.User.email == body.email.strip().lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return _session(user, body.role)


def _session(user: m.User, role: str) -> dict:
    """A token, but only for the role the person signed in as: patient and clinician logins are separate."""
    if user.role != role:
        other = "Clinician" if user.role == "clinician" else "Patient"
        raise HTTPException(403, f"This is a {user.role} account. Please use {other} login.")
    return {"token": make_token(user.id), "user": s.UserOut.model_validate(user)}




def _new_patient(db: Session, email: str, name: str, password: str, clinician_id: Optional[int] = None, **profile) -> m.User:
    """Create a patient under the doctor they chose (or any available one), with a few starter habits."""
    user = m.User(email=email, name=name, role="patient", password_hash=hash_password(password),
                  clinician_id=care_team.resolve_choice(db, clinician_id), **profile)
    db.add(user)
    db.flush()
    db.add_all(m.Habit(user_id=user.id, **h) for h in load("starter_habits"))
    db.commit()
    return user


@router.get("/clinicians", response_model=list[s.ClinicianPublic])
def list_clinicians(db: Session = Depends(get_db)):
    """The clinic's doctors, for choosing one at sign-up or later (no contact details)."""
    return [s.ClinicianPublic(id=c.id, name=c.name, gender=c.gender, bio=c.bio, available=care_team.is_available(c),
                              on_call=care_team.is_on_call(c)) for c in care_team.clinicians(db)]


@router.post("/register", status_code=201)
def register(body: s.RegisterIn, db: Session = Depends(get_db)):
    """Self sign-up is for patients only; clinician accounts are created by the clinic.
    Height and weight give the first BMI reading and a suggested calorie goal (see app/calorie_plan.py)."""
    email = body.email.strip().lower()
    if db.scalars(select(m.User).where(m.User.email == email)).first():
        raise HTTPException(409, "An account with this email already exists. Try signing in.")
    profile = body.model_dump(exclude={"email", "password", "name", "weight_kg", "activity_level"}, exclude_none=True)
    profile = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in profile.items()}
    plan = calorie_plan.suggest(body.age or 35, body.gender, body.height_cm, body.weight_kg, body.activity_level)
    user = _new_patient(db, email, body.name.strip(), body.password, calorie_goal=plan["calorie_goal"], **profile)
    bmi = cal.bmi_value(body.height_cm, body.weight_kg)
    db.add(m.BMIRecord(user_id=user.id, measured_at=datetime.now(), height_cm=body.height_cm, weight_kg=body.weight_kg,
                       bmi=bmi, category=cal.bmi_category(bmi)))
    db.commit()
    return {**_session(user, "patient"), "plan": plan}


@router.get("/google-config")
def google_config():
    return {"client_id": google_auth.client_id()}


@router.post("/google")
def google_login(body: s.GoogleLoginIn, db: Session = Depends(get_db)):
    """Existing accounts sign in by matching email. New patients can sign up this way; clinicians cannot."""
    if not google_auth.client_id():
        raise HTTPException(503, "Google sign-in is not set up on this server")
    claims = google_auth.verify(body.credential)
    if not claims:
        raise HTTPException(401, "Google could not confirm this sign-in")
    email = claims["email"].strip().lower()
    user = db.scalars(select(m.User).where(m.User.email == email)).first()
    if not user:
        if body.role == "clinician":
            raise HTTPException(403, "No clinician account uses this Google address. Ask your clinic to add you.")
        user = _new_patient(db, email, claims.get("name") or email.split("@")[0],
                            secrets.token_urlsafe(32))  # no usable password; Google only
    return _session(user, body.role)


@router.get("/me", response_model=s.UserOut)
def me(user: m.User = Depends(current_user)):
    return user


@router.patch("/me", response_model=s.UserOut)
def update_me(body: s.SettingsIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    allowed = s.PROFILE_FIELDS | (s.PATIENT_FIELDS if user.role == "patient" else s.CLINICIAN_FIELDS)
    if set(changes) - allowed:
        raise HTTPException(403, "Only patients have goals and reminders" if user.role != "patient"
                            else "Only clinicians set availability")
    if "clinician_id" in changes:
        changes["clinician_id"] = care_team.resolve_choice(db, changes["clinician_id"])
    for k, v in changes.items():
        # An emptied text box clears the field; the name is required.
        setattr(user, k, (v.strip() or None) if isinstance(v, str) and k != "name" else v)
    db.commit()
    return user
