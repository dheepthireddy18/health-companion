"""Mock data: a small community clinic with 90 days of history per patient.

Who exists (logins, profiles, medicines, habits) and how each patient's numbers behave are defined in
app/data/demo_data.json; this module only turns that into rows. Run `python -m app.seed --reset` to rebuild.
"""
import random
import sys
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import calories as cal, models as m
from .data import load
from .security import hash_password

DEMO = load("demo_data")


def _user(db, role, password, **kw) -> m.User:
    u = m.User(role=role, password_hash=hash_password(password), **kw)
    db.add(u)
    db.flush()
    return u


def seed_demo_data(db: Session, today: Optional[date] = None) -> None:
    if db.scalars(select(m.User)).first():
        return
    today = today or date.today()
    rng = random.Random(42)
    docs = {c["email"]: _user(db, "clinician", **c) for c in DEMO["clinicians"]}
    now = datetime.now()

    for d in DEMO["patients"]:
        story = d["story"]
        weight, height = d["weight_kg"], d["height_cm"]
        p = _user(db, "patient", name=d["name"], email=d["email"], password=d["password"], age=d["age"], gender=d["gender"],
                  clinician_id=docs[d["clinician"]].id, phone=d["phone"], emergency_number="911", height_cm=height,
                  blood_type=d["blood_type"], allergies=d["allergies"], emergency_contact_name=d["emergency_contact"]["name"],
                  emergency_contact_phone=d["emergency_contact"]["phone"], calorie_goal=d["calorie_goal"],
                  activity_goal_min=d["activity_goal_min"])
        meds = [m.Medication(user_id=p.id, **md) for md in d["medicines"]]
        habits = [m.Habit(user_id=p.id, **h) for h in d["habits"]]
        db.add_all(meds + habits)
        db.flush()
        diabetic = any(md.name in ("Metformin", "Glimepiride") for md in meds)

        for back in range(89, -1, -1):
            day = today - timedelta(days=back)
            progress = (89 - back) / 89
            # Nothing seeded today is later than the current time.
            at = lambda h, mi=0: min(datetime(day.year, day.month, day.day, h, mi), now - timedelta(minutes=10))
            if rng.random() < 0.7:  # morning BP most days, at a slightly different time each day
                db.add(m.BPReading(user_id=p.id, measured_at=at(7, rng.randint(5, 55)),
                                   systolic=round(story["bp_start"][0] + story["bp_drift_90d"] * progress + rng.gauss(0, 4)),
                                   diastolic=round(story["bp_start"][1] + story["bp_drift_90d"] * progress * 0.5 + rng.gauss(0, 3)), pulse=rng.randint(62, 84)))
            if rng.random() < 0.6:
                db.add(m.GlucoseReading(user_id=p.id, measured_at=at(6, rng.randint(30, 59)), value=round(story["fasting_sugar"] + rng.gauss(0, 12)), context="fasting"))
            if diabetic and rng.random() < 0.3:  # occasional two-hour post-dinner check
                db.add(m.GlucoseReading(user_id=p.id, measured_at=at(21, rng.randint(0, 40)), value=round(story["fasting_sugar"] + 38 + rng.gauss(0, 18)), context="after_meal"))
            if back % 30 == 0:
                w = weight + rng.uniform(-1, 1) - progress * (1.5 if story["activity_rate"] > 0.6 else 0)
                db.add(m.BMIRecord(user_id=p.id, measured_at=at(9), height_cm=height, weight_kg=round(w, 1),
                                   bmi=cal.bmi_value(height, w), category=cal.bmi_category(cal.bmi_value(height, w))))
            if back > 0:  # today stays open so reminders can be demonstrated
                for med in meds:
                    for slot in med.times.split(","):
                        if rng.random() < 0.97:  # dose logged; adherence decides taken vs skipped
                            status = "taken" if rng.random() < story["med_adherence"] else "skipped"
                            db.add(m.MedicationLog(user_id=p.id, medication_id=med.id, day=day, slot=slot, status=status))
            if back < 60 or rng.random() < 0.5:
                for meal, options in DEMO["meals"].items():
                    if back == 0 and meal == "dinner" and now.hour < 19:
                        continue  # don't log a dinner that hasn't happened yet
                    indulgent = DEMO["indulgent_meals"]
                    pool = indulgent[meal] if rng.random() < story["indulgent_meal_rate"] and meal in indulgent else options
                    items, _ = cal.parse_meal(rng.choice(pool))
                    for it in items:
                        db.add(m.FoodEntry(user_id=p.id, day=day, meal_type=meal, **{k: v for k, v in it.items() if k != "serving"}))
            if rng.random() < story["activity_rate"]:
                kind = rng.choice(["brisk walk", "walking", "yoga", "cycling", "swimming"] if d["age"] < 60
                                  else ["brisk walk", "walking", "yoga", "chair exercises", "gardening"])
                mins = rng.choice([20, 30, 40, 45])
                intensity = rng.choice(["light", "moderate", "moderate", "vigorous"] if d["age"] < 60 else ["light", "moderate"])
                db.add(m.Workout(user_id=p.id, day=day, kind=kind, duration_min=mins, intensity=intensity,
                                 calories_burned=cal.calories_burned(kind, mins, intensity, weight)))
            for h in habits:
                if rng.random() < 0.6 + 0.3 * story["activity_rate"]:
                    db.add(m.HabitLog(user_id=p.id, habit_id=h.id, day=day, count=h.target if rng.random() < 0.7 else h.target // 2))
            # check-ins: an unbroken run ending today (or yesterday for streak 0), sparse before that
            in_run = back < story["checkin_streak"]
            if in_run or (back > story["checkin_streak"] + 1 and rng.random() < 0.6 * story["activity_rate"] + 0.2):
                db.add(m.CheckIn(user_id=p.id, day=day))

    db.commit()


if __name__ == "__main__":
    from .database import Base, SessionLocal, add_missing_columns, engine
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    add_missing_columns()
    with SessionLocal() as session:
        seed_demo_data(session)
    print("Seeded.")
