"""Mock data: 2 clinicians and 6 patients with 90 days of history and distinct stories.

Run `python -m app.seed --reset` to rebuild the database. All demo passwords are listed in the README.
"""
import random
import sys
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import calories as cal, models as m
from .security import hash_password

CLINICIAN_PASSWORD = "clinician123"
PATIENT_PASSWORD = "patient123"

HABITS = [("Drink water", 8, "glasses"), ("Morning or evening walk", 1, "walk"), ("No added salt at the table", 1, "day"),
          ("Sleep 7+ hours", 1, "night")]
MEALS = {
    "breakfast": ["2 idli and a cup of sambar", "oats and an apple", "2 chapati and a boiled egg", "poha and tea"],
    "lunch": ["2 chapati, a cup of dal and salad", "1 cup brown rice and fish", "1 cup rice, dal and vegetable curry", "rajma and 1 cup rice"],
    "snack": ["an apple and 10 almonds", "buttermilk", "a guava", "2 biscuits and tea"],
    "dinner": ["soup and 2 chapati", "khichdi and curd", "chicken and salad", "1 cup rice and dal"],
}
INDULGENT = {"lunch": ["biryani and a soda", "2 slice pizza and a burger"], "snack": ["2 samosa and tea", "chips and cola"]}

# name, email, age, bp (systolic, diastolic), bp drift over 90 days, fasting sugar, med adherence, activity rate,
# indulgent-meal rate, check-in streak ending today, notes
PATIENTS = [
    ("Asha Rao", "asha@example.com", 62, (128, 82), 18, 118, 0.80, 0.55, 0.15, 10, 70, 160),
    ("Ravi Kumar", "ravi@example.com", 55, (132, 84), 2, 168, 0.65, 0.15, 0.55, 3, 88, 172),
    ("Meena Iyer", "meena@example.com", 48, (118, 76), 0, 98, 0.97, 0.85, 0.05, 15, 62, 158),
    ("John Mathew", "john@example.com", 71, (136, 86), 5, 122, 0.55, 0.20, 0.30, 0, 80, 170),
    ("Priya Nair", "priya@example.com", 44, (122, 78), 0, 105, 0.92, 0.65, 0.10, 6, 58, 163),
    ("Sam Thomas", "sam@example.com", 67, (150, 94), 12, 135, 0.70, 0.35, 0.25, 2, 92, 175),
]


def _user(db, name, email, role, **kw) -> m.User:
    u = m.User(name=name, email=email, role=role, password_hash=hash_password(
        CLINICIAN_PASSWORD if role == "clinician" else PATIENT_PASSWORD), **kw)
    db.add(u)
    db.flush()
    return u


def seed_demo_data(db: Session, today: Optional[date] = None) -> None:
    if db.scalars(select(m.User)).first():
        return
    today = today or date.today()
    rng = random.Random(42)
    docs = [_user(db, "Dr. Meera Nair", "dr.nair@clinic.test", "clinician", phone="+1-555-0100"),
            _user(db, "Nurse Daniel Cho", "nurse.cho@clinic.test", "clinician", phone="+1-555-0101")]

    for i, (name, email, age, bp0, drift, sugar, adherence, active, junk, streak, weight, height) in enumerate(PATIENTS):
        p = _user(db, name, email, "patient", age=age, clinician_id=docs[i % 2].id, phone=f"+1-555-02{i:02d}",
                  emergency_number="911", calorie_goal=1800, activity_goal_min=30)
        meds = [m.Medication(user_id=p.id, name="Amlodipine", dose="5 mg", times="08:00,20:00"),
                m.Medication(user_id=p.id, name="Metformin", dose="500 mg", times="09:00")]
        habits = [m.Habit(user_id=p.id, name=n, target=t, unit=u) for n, t, u in HABITS]
        db.add_all(meds + habits)
        db.flush()

        for back in range(89, -1, -1):
            day = today - timedelta(days=back)
            progress = (89 - back) / 89
            at = lambda h, mi=0: datetime(day.year, day.month, day.day, h, mi)
            if rng.random() < 0.7:  # BP most days
                db.add(m.BPReading(user_id=p.id, measured_at=at(8, 15), systolic=round(bp0[0] + drift * progress + rng.gauss(0, 4)),
                                   diastolic=round(bp0[1] + drift * progress * 0.5 + rng.gauss(0, 3)), pulse=rng.randint(62, 84)))
            if rng.random() < 0.6:
                db.add(m.GlucoseReading(user_id=p.id, measured_at=at(7, 30), value=round(sugar + rng.gauss(0, 12)), context="fasting"))
            if back % 30 == 0:
                w = weight + rng.uniform(-1, 1)
                db.add(m.BMIRecord(user_id=p.id, measured_at=at(9), height_cm=height, weight_kg=round(w, 1),
                                   bmi=cal.bmi_value(height, w), category=cal.bmi_category(cal.bmi_value(height, w))))
            if back > 0:  # today stays open so reminders can be demonstrated
                for med in meds:
                    for slot in med.times.split(","):
                        if rng.random() < 0.97:  # dose logged; adherence decides taken vs skipped
                            status = "taken" if rng.random() < adherence else "skipped"
                            db.add(m.MedicationLog(user_id=p.id, medication_id=med.id, day=day, slot=slot, status=status))
            if back < 60 or rng.random() < 0.5:
                for meal, options in MEALS.items():
                    pool = INDULGENT.get(meal) if rng.random() < junk and meal in INDULGENT else options
                    items, _ = cal.parse_meal(rng.choice(pool))
                    for it in items:
                        db.add(m.FoodEntry(user_id=p.id, day=day, meal_type=meal, **{k: v for k, v in it.items() if k != "serving"}))
            if rng.random() < active:
                kind = rng.choice(["brisk walk", "walking", "yoga", "cycling", "chair exercises"])
                mins = rng.choice([20, 30, 40, 45])
                db.add(m.Workout(user_id=p.id, day=day, kind=kind, duration_min=mins, intensity="moderate",
                                 calories_burned=cal.calories_burned(kind, mins, "moderate", weight)))
            for h in habits:
                if rng.random() < 0.6 + 0.3 * active:
                    db.add(m.HabitLog(user_id=p.id, habit_id=h.id, day=day, count=h.target if rng.random() < 0.7 else h.target // 2))
            # check-ins: an unbroken run ending today (or yesterday for streak 0), sparse before that
            in_run = back < streak
            if in_run or (back > streak + 1 and rng.random() < 0.6 * active + 0.2):
                db.add(m.CheckIn(user_id=p.id, day=day))

        db.add(m.Message(patient_id=p.id, sender_id=docs[i % 2].id, created_at=datetime.now() - timedelta(days=2),
                         body=f"Hello {name.split()[0]}, I'm your care contact. Message me any time with questions about your readings."))
    db.commit()


if __name__ == "__main__":
    from .database import Base, SessionLocal, engine
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_demo_data(session)
    print("Seeded.")
