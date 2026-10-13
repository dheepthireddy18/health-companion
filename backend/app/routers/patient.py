"""Everything a patient records. Every query is filtered by the signed-in user's id."""
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import care_team, calories as cal, models as m, schemas as s
from ..database import get_db
from ..security import require_patient
from ..stats import checkin_days, day_totals, latest
from ..streaks import streak_info

router = APIRouter(prefix="/api", tags=["patient"], dependencies=[Depends(require_patient)])
User = Depends(require_patient)


def _owned(db: Session, Model, item_id: int, user: m.User):
    obj = db.get(Model, item_id)
    if not obj or obj.user_id != user.id:
        raise HTTPException(404, "Not found")
    return obj


def _range(col, start: Optional[date], end: Optional[date], is_dt: bool):
    conds = []
    if start:
        conds.append(col >= (datetime.combine(start, time.min) if is_dt else start))
    if end:
        conds.append(col <= (datetime.combine(end, time.max) if is_dt else end))
    return conds


def _weight(db: Session, user: m.User) -> Optional[float]:
    rec = latest(db, m.BMIRecord, user.id)
    return rec.weight_kg if rec else None


# ---------- home ----------
def _status_card(db: Session, user: m.User, now: datetime) -> dict:
    g, b = latest(db, m.GlucoseReading, user.id), latest(db, m.BPReading, user.id)
    recent = [r for r in (g, b) if r and now - r.measured_at <= timedelta(hours=36)]
    if not recent:
        return {"level": "amber", "text": "No readings in the last day. Log your blood pressure or sugar when you can."}
    worst = max(recent, key=lambda r: r.severity)
    if worst.severity >= 2:
        return {"level": "red", "text": f"{worst.status}: {worst.message}"}
    if worst.severity == 1:
        return {"level": "amber", "text": f"{worst.status}: {worst.message}"}
    return {"level": "green", "text": "Your latest readings are in the usual range. Nice work today."}


@router.get("/home")
def home(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    today = day or date.today()
    clinician = db.get(m.User, user.clinician_id) if user.clinician_id else None
    return {
        "status": _status_card(db, user, datetime.combine(today, datetime.now().time())),
        "streak": streak_info(checkin_days(db, user.id), today),
        "energy": energy(today, user, db),
        "clinician": _clinician_info(clinician) if clinician else None,
        # Doctors covering for colleagues; the app offers them when the patient's own doctor is away.
        "on_call": [_clinician_info(c) for c in care_team.on_call_cover(db, user.clinician_id)],
    }


def _clinician_info(c: m.User) -> s.ClinicianInfo:
    return s.ClinicianInfo(id=c.id, name=c.name, phone=c.phone, bio=c.bio,
                           available=care_team.is_available(c), on_call=care_team.is_on_call(c))


@router.post("/checkin", status_code=201)
def check_in(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    today = day or date.today()
    if today not in checkin_days(db, user.id):
        db.add(m.CheckIn(user_id=user.id, day=today))
        db.commit()
    return streak_info(checkin_days(db, user.id), today)


# ---------- vitals ----------
@router.get("/glucose", response_model=list[s.GlucoseOut])
def list_glucose(start: Optional[date] = None, end: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    q = select(m.GlucoseReading).where(m.GlucoseReading.user_id == user.id,
                                       *_range(m.GlucoseReading.measured_at, start, end, True))
    return db.scalars(q.order_by(m.GlucoseReading.measured_at.desc())).all()


@router.post("/glucose", response_model=s.GlucoseOut, status_code=201)
def add_glucose(body: s.GlucoseIn, user: m.User = User, db: Session = Depends(get_db)):
    obj = m.GlucoseReading(user_id=user.id, **body.model_dump())
    db.add(obj)
    db.commit()
    return obj


@router.get("/bp", response_model=list[s.BPOut])
def list_bp(start: Optional[date] = None, end: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    q = select(m.BPReading).where(m.BPReading.user_id == user.id, *_range(m.BPReading.measured_at, start, end, True))
    return db.scalars(q.order_by(m.BPReading.measured_at.desc())).all()


@router.post("/bp", response_model=s.BPOut, status_code=201)
def add_bp(body: s.BPIn, user: m.User = User, db: Session = Depends(get_db)):
    obj = m.BPReading(user_id=user.id, **body.model_dump())
    db.add(obj)
    db.commit()
    return obj


# ---------- BMI ----------
@router.get("/bmi", response_model=list[s.BMIOut])
def list_bmi(user: m.User = User, db: Session = Depends(get_db)):
    return db.scalars(select(m.BMIRecord).where(m.BMIRecord.user_id == user.id)
                      .order_by(m.BMIRecord.measured_at.desc())).all()


@router.post("/bmi", response_model=s.BMIOut, status_code=201)
def add_bmi(body: s.BMIIn, user: m.User = User, db: Session = Depends(get_db)):
    value = cal.bmi_value(body.height_cm, body.weight_kg)
    obj = m.BMIRecord(user_id=user.id, measured_at=body.measured_at or datetime.now(), height_cm=body.height_cm,
                      weight_kg=body.weight_kg, bmi=value, category=cal.bmi_category(value))
    db.add(obj)
    db.commit()
    return obj


# ---------- medicines ----------
@router.get("/medications", response_model=list[s.MedicationOut])
def list_meds(user: m.User = User, db: Session = Depends(get_db)):
    return db.scalars(select(m.Medication).where(m.Medication.user_id == user.id, m.Medication.active)).all()


@router.post("/medications", response_model=s.MedicationOut, status_code=201)
def add_med(body: s.MedicationIn, user: m.User = User, db: Session = Depends(get_db)):
    obj = m.Medication(user_id=user.id, **body.model_dump())
    db.add(obj)
    db.commit()
    return obj


@router.delete("/medications/{med_id}", status_code=204)
def remove_med(med_id: int, user: m.User = User, db: Session = Depends(get_db)):
    _owned(db, m.Medication, med_id, user).active = False  # keep history for the clinician
    db.commit()


@router.get("/medications/schedule")
def schedule(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    today = day or date.today()
    logs = {(l.medication_id, l.slot): l.status for l in db.scalars(select(m.MedicationLog).where(
        m.MedicationLog.user_id == user.id, m.MedicationLog.day == today))}
    rows = [{"medication_id": med.id, "name": med.name, "dose": med.dose, "slot": slot,
             "status": logs.get((med.id, slot), "pending")}
            for med in list_meds(user, db) for slot in med.times.split(",")]
    return sorted(rows, key=lambda r: r["slot"])


@router.post("/medications/log")
def mark_dose(body: s.DoseMark, user: m.User = User, db: Session = Depends(get_db)):
    med = _owned(db, m.Medication, body.medication_id, user)
    if body.slot not in med.times.split(","):
        raise HTTPException(422, "That time is not in this medicine's schedule")
    log = db.scalars(select(m.MedicationLog).where(
        m.MedicationLog.medication_id == med.id, m.MedicationLog.day == body.day,
        m.MedicationLog.slot == body.slot)).first()
    if log:
        log.status = body.status
    else:
        db.add(m.MedicationLog(user_id=user.id, medication_id=med.id, day=body.day, slot=body.slot, status=body.status))
    db.commit()
    return {"ok": True}


# ---------- food and calories ----------
@router.get("/food", response_model=list[s.FoodOut])
def list_food(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    return db.scalars(select(m.FoodEntry).where(m.FoodEntry.user_id == user.id, m.FoodEntry.day == (day or date.today()))
                      .order_by(m.FoodEntry.id)).all()


@router.post("/food", status_code=201)
def add_food(body: s.FoodIn, user: m.User = User, db: Session = Depends(get_db)):
    items, unmatched = cal.parse_meal(body.text)
    day = body.day or date.today()
    rows = [m.FoodEntry(user_id=user.id, day=day, meal_type=body.meal_type, **{k: v for k, v in it.items() if k != "serving"})
            for it in items]
    db.add_all(rows)
    db.commit()
    return {"added": [s.FoodOut.model_validate(r) for r in rows], "unmatched": unmatched}


@router.post("/food/preview")
def preview_food(body: s.FoodPreviewIn):
    """Typo check: show what will be logged (and what was not understood) before saving."""
    items, unmatched = cal.parse_meal(body.text)
    return {"items": items, "unmatched": unmatched, "total_calories": sum(i["calories"] for i in items)}


@router.post("/food/matched-goal", status_code=201)
def matched_goal(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    """Confirm the day was on plan. Only allowed once the logged numbers already meet both goals; the small gap
    left inside the tolerance is recorded as a self-declared entry so the day closes exactly on target."""
    today = day or date.today()
    e = energy(today, user, db)
    if not e["goal_met"]:
        raise HTTPException(409, "Not yet: " + " and ".join(e["goal_missing"]) + ".")
    remaining = round(e["goal"] - e["net"])
    if remaining > 0:
        db.add(m.FoodEntry(user_id=user.id, day=today, meal_type="snack", name="Rest of the day, on plan (one tap)",
                           calories=remaining, source="one_tap"))
        db.commit()
        e = energy(today, user, db)
    return e


@router.delete("/food/{item_id}", status_code=204)
def delete_food(item_id: int, user: m.User = User, db: Session = Depends(get_db)):
    db.delete(_owned(db, m.FoodEntry, item_id, user))
    db.commit()


@router.get("/energy")
def energy(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    today = day or date.today()
    t = day_totals(db, user.id, today)
    e = cal.energy_balance(user.calorie_goal, t["intake"], t["burned"], user.activity_goal_min,
                           t["active_min"], _weight(db, user))
    missing = []
    if e["state"] != "matched":
        missing.append(f"net calories must be within {round(cal.TOLERANCE * 100)}% of your {user.calorie_goal} kcal goal")
    if t["active_min"] < user.activity_goal_min:
        missing.append(f"reach {user.activity_goal_min} active minutes ({t['active_min']} so far)")
    return {**e, "active_min": t["active_min"], "activity_goal_min": user.activity_goal_min,
            "goal_met": not missing, "goal_missing": missing}


# ---------- activity ----------
@router.get("/activity/kinds")
def kinds():
    return sorted(cal.MET)


@router.get("/activity", response_model=list[s.WorkoutOut])
def list_workouts(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    return db.scalars(select(m.Workout).where(m.Workout.user_id == user.id, m.Workout.day == (day or date.today()))
                      .order_by(m.Workout.id)).all()


@router.post("/activity", response_model=s.WorkoutOut, status_code=201)
def add_workout(body: s.WorkoutIn, user: m.User = User, db: Session = Depends(get_db)):
    obj = m.Workout(user_id=user.id, day=body.day or date.today(), kind=body.kind, duration_min=body.duration_min,
                    intensity=body.intensity,
                    calories_burned=cal.calories_burned(body.kind, body.duration_min, body.intensity, _weight(db, user)))
    db.add(obj)
    db.commit()
    return obj


@router.delete("/activity/{item_id}", status_code=204)
def delete_workout(item_id: int, user: m.User = User, db: Session = Depends(get_db)):
    db.delete(_owned(db, m.Workout, item_id, user))
    db.commit()


# ---------- habits ----------
@router.get("/habits")
def habit_progress(day: Optional[date] = None, user: m.User = User, db: Session = Depends(get_db)):
    today = day or date.today()
    counts = {l.habit_id: l.count for l in db.scalars(select(m.HabitLog).where(
        m.HabitLog.user_id == user.id, m.HabitLog.day == today))}
    habits = db.scalars(select(m.Habit).where(m.Habit.user_id == user.id).order_by(m.Habit.id)).all()
    return [{"habit_id": h.id, "name": h.name, "target": h.target, "unit": h.unit,
             "count": counts.get(h.id, 0), "done": counts.get(h.id, 0) >= h.target} for h in habits]


@router.put("/habits/{habit_id}/log")
def set_habit(habit_id: int, body: s.HabitCount, user: m.User = User, db: Session = Depends(get_db)):
    _owned(db, m.Habit, habit_id, user)
    log = db.scalars(select(m.HabitLog).where(m.HabitLog.habit_id == habit_id, m.HabitLog.day == body.day)).first()
    if log:
        log.count = body.count
    else:
        db.add(m.HabitLog(user_id=user.id, habit_id=habit_id, day=body.day, count=body.count))
    db.commit()
    return {"ok": True}
