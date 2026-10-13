"""Clinician area: every patient's records, chat, and the guard-railed AI summary."""
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import llm, models as m, schemas as s
from ..database import get_db
from ..security import require_clinician
from ..stats import checkin_days, latest, med_doses, period_stats
from ..streaks import streak_info
from . import messages

router = APIRouter(prefix="/api/clinician", tags=["clinician"], dependencies=[Depends(require_clinician)])
SUMMARY_DAYS = (7, 30, 90)

# Set by tests to avoid network calls.
completer: Optional[llm.Completer] = None


def _patient(db: Session, patient_id: int) -> m.User:
    p = db.get(m.User, patient_id)
    if not p or p.role != "patient":
        raise HTTPException(404, "Patient not found")
    return p


@router.get("/patients")
def patients(today: Optional[date] = None, db: Session = Depends(get_db)):
    today = today or date.today()
    out = []
    for p in db.scalars(select(m.User).where(m.User.role == "patient").order_by(m.User.name)):
        bp, g, bmi = latest(db, m.BPReading, p.id), latest(db, m.GlucoseReading, p.id), latest(db, m.BMIRecord, p.id)
        streak = streak_info(checkin_days(db, p.id), today)
        taken, expected = med_doses(db, p.id, today - timedelta(days=7), today - timedelta(days=1))
        out.append({
            "id": p.id, "name": p.name, "age": p.age, "clinician_id": p.clinician_id,
            "latest_bp": {"value": f"{bp.systolic}/{bp.diastolic}", "status": bp.status, "severity": bp.severity,
                          "at": bp.measured_at} if bp else None,
            "latest_glucose": {"value": g.value, "status": g.status, "severity": g.severity, "at": g.measured_at} if g else None,
            "latest_bmi": {"value": bmi.bmi, "category": bmi.category, "at": bmi.measured_at} if bmi else None,
            "streak": streak["current"],
            "last_check_in": max(checkin_days(db, p.id), default=None),
            "med_adherence_7d": round(100 * taken / expected) if expected else None,
            "attention": max([r.severity for r in (bp, g) if r], default=0),
        })
    return sorted(out, key=lambda r: (-r["attention"], r["name"]))  # who needs attention first


@router.get("/patients/{patient_id}/records")
def records(patient_id: int, days: int = Query(30, ge=1, le=365), today: Optional[date] = None,
            db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    today = today or date.today()
    start = today - timedelta(days=days - 1)
    lo, hi = datetime.combine(start, time.min), datetime.combine(today, time.max)

    def rows(Model, col, between_dt=False):
        cond = col.between(lo, hi) if between_dt else col >= start
        return db.scalars(select(Model).where(Model.user_id == p.id, cond).order_by(col.desc())).all()

    return {
        "patient": {"id": p.id, "name": p.name, "age": p.age, "phone": p.phone,
                    "calorie_goal": p.calorie_goal, "activity_goal_min": p.activity_goal_min},
        "blood_pressure": [s.BPOut.model_validate(r) for r in rows(m.BPReading, m.BPReading.measured_at, True)],
        "glucose": [s.GlucoseOut.model_validate(r) for r in rows(m.GlucoseReading, m.GlucoseReading.measured_at, True)],
        "bmi": [s.BMIOut.model_validate(r) for r in db.scalars(
            select(m.BMIRecord).where(m.BMIRecord.user_id == p.id).order_by(m.BMIRecord.measured_at.desc()).limit(10))],
        "food": [s.FoodOut.model_validate(r) for r in rows(m.FoodEntry, m.FoodEntry.day)],
        "activity": [s.WorkoutOut.model_validate(r) for r in rows(m.Workout, m.Workout.day)],
        "medicines": [s.MedicationOut.model_validate(r) for r in db.scalars(
            select(m.Medication).where(m.Medication.user_id == p.id, m.Medication.active))],
        "streak": streak_info(checkin_days(db, p.id), today),
    }


@router.post("/patients/{patient_id}/summary")
def summary(patient_id: int, days: int = Query(..., description="7, 30 or 90"), today: Optional[date] = None,
            clinician: m.User = Depends(require_clinician), db: Session = Depends(get_db)):
    if days not in SUMMARY_DAYS:
        raise HTTPException(422, "days must be 7, 30 or 90")
    p = _patient(db, patient_id)
    stats = period_stats(db, p, days, today or date.today())
    result = llm.generate_summary(stats, completer)
    db.add(m.SummaryAudit(clinician_id=clinician.id, patient_id=p.id, days=days, source=result["source"],
                          guardrail_notes="; ".join(result["notes"]) or None))
    db.commit()
    return {**result, "days": days, "patient": p.name, "stats": stats}


@router.get("/threads", response_model=list[s.ThreadOut])
def threads(clinician: m.User = Depends(require_clinician), db: Session = Depends(get_db)):
    """This clinician's conversations plus their own patients (so a chat can be started), newest first.
    Other clinicians' conversations are never included."""
    out = []
    for p in db.scalars(select(m.User).where(m.User.role == "patient").order_by(m.User.name)):
        last = db.execute(select(m.Message, m.User.role).join(m.User, m.User.id == m.Message.sender_id)
                          .where(m.Message.patient_id == p.id, m.Message.clinician_id == clinician.id)
                          .order_by(m.Message.id.desc()).limit(1)).first()
        if not last and p.clinician_id != clinician.id:
            continue
        out.append(s.ThreadOut(patient_id=p.id, name=p.name, clinician_id=p.clinician_id, last_body=last[0].body if last else None,
                               last_from_role=last[1] if last else None, last_at=last[0].created_at if last else None))
    return sorted(out, key=lambda t: t.last_at or datetime.min, reverse=True)


@router.get("/patients/{patient_id}/messages", response_model=list[s.MessageOut])
def get_thread(patient_id: int, clinician: m.User = Depends(require_clinician), db: Session = Depends(get_db)):
    """Only this clinician's conversation with the patient."""
    return messages.thread(db, _patient(db, patient_id).id, clinician.id)


@router.post("/patients/{patient_id}/messages", response_model=s.MessageOut, status_code=201)
def reply(patient_id: int, body: s.MessageIn, clinician: m.User = Depends(require_clinician),
          db: Session = Depends(get_db)):
    return messages.post(db, _patient(db, patient_id).id, clinician.id, clinician, body.body)
