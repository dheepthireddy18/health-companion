import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import google_auth, models as m, schemas as s
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


def _session(user: m.User, role) -> dict:
    if role and user.role != role:
        other = "Clinician" if user.role == "clinician" else "Patient"
        raise HTTPException(403, f"This is a {user.role} account. Please use {other} login.")
    return {"token": make_token(user.id), "user": s.UserOut.model_validate(user)}




def _new_patient(db: Session, email: str, name: str, password: str, **profile) -> m.User:
    """Create a patient under the clinician with the fewest patients, with a few starter habits."""
    counts = {c.id: 0 for c in db.scalars(select(m.User).where(m.User.role == "clinician"))}
    for cid, n in db.execute(select(m.User.clinician_id, func.count()).where(m.User.role == "patient")
                             .group_by(m.User.clinician_id)):
        if cid in counts:
            counts[cid] = n
    user = m.User(email=email, name=name, role="patient", password_hash=hash_password(password),
                  clinician_id=min(counts, key=counts.get) if counts else None, **profile)
    db.add(user)
    db.flush()
    db.add_all(m.Habit(user_id=user.id, **h) for h in load("starter_habits"))
    db.commit()
    return user


@router.post("/register", status_code=201)
def register(body: s.RegisterIn, db: Session = Depends(get_db)):
    """Self sign-up is for patients only; clinician accounts are created by the clinic."""
    email = body.email.strip().lower()
    if db.scalars(select(m.User).where(m.User.email == email)).first():
        raise HTTPException(409, "An account with this email already exists. Try signing in.")
    profile = body.model_dump(exclude={"email", "password", "name"}, exclude_none=True)
    profile = {k: (v.strip() or None) if isinstance(v, str) else v for k, v in profile.items()}
    return _session(_new_patient(db, email, body.name.strip(), body.password, **profile), "patient")


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
    if user.role != "patient" and set(changes) - s.PROFILE_FIELDS:
        raise HTTPException(403, "Only patients have goals and reminders")
    for k, v in changes.items():
        # An emptied text box clears the field; the name is required.
        setattr(user, k, (v.strip() or None) if isinstance(v, str) and k != "name" else v)
    db.commit()
    return user
