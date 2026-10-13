"""Exact numbers computed from saved records. The LLM never does arithmetic - it only receives these."""
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m
from .streaks import streak_info


def _avg(values, digits=1) -> Optional[float]:
    values = list(values)
    return round(sum(values) / len(values), digits) if values else None


def latest(db: Session, Model, user_id: int, col=None):
    col = col if col is not None else Model.measured_at
    return db.scalars(select(Model).where(Model.user_id == user_id).order_by(col.desc())).first()


def day_totals(db: Session, user_id: int, day: date) -> dict:
    row = db.execute(select(
        func.coalesce(func.sum(m.FoodEntry.calories), 0), func.coalesce(func.sum(m.FoodEntry.carbs_g), 0),
        func.coalesce(func.sum(m.FoodEntry.sodium_mg), 0),
    ).where(m.FoodEntry.user_id == user_id, m.FoodEntry.day == day)).one()
    work = db.execute(select(
        func.coalesce(func.sum(m.Workout.calories_burned), 0), func.coalesce(func.sum(m.Workout.duration_min), 0),
    ).where(m.Workout.user_id == user_id, m.Workout.day == day)).one()
    return {"intake": row[0], "carbs_g": row[1], "sodium_mg": row[2], "burned": work[0], "active_min": work[1]}


def med_doses(db: Session, user_id: int, start: date, end: date) -> tuple:
    """(taken, expected) over completed days start..end, counting only days that have a log row."""
    meds = db.scalars(select(m.Medication).where(m.Medication.user_id == user_id, m.Medication.active)).all()
    per_day = sum(len([t for t in med.times.split(",") if t]) for med in meds)
    logs = db.scalars(select(m.MedicationLog).where(
        m.MedicationLog.user_id == user_id, m.MedicationLog.day >= start, m.MedicationLog.day <= end)).all()
    taken = sum(1 for l in logs if l.status == "taken")
    days = (end - start).days + 1
    return taken, per_day * days


def checkin_days(db: Session, user_id: int) -> set:
    return set(db.scalars(select(m.CheckIn.day).where(m.CheckIn.user_id == user_id)).all())


def _trend(first: Optional[float], second: Optional[float], flat: float) -> Optional[str]:
    if first is None or second is None:
        return None
    delta = second - first
    return "rising" if delta > flat else "falling" if delta < -flat else "steady"


def period_stats(db: Session, patient: m.User, days: int, today: date) -> dict:
    start = today - timedelta(days=days - 1)
    lo, hi = datetime.combine(start, time.min), datetime.combine(today, time.max)
    mid = datetime.combine(start + timedelta(days=days // 2), time.min)
    uid = patient.id

    bp = db.scalars(select(m.BPReading).where(
        m.BPReading.user_id == uid, m.BPReading.measured_at.between(lo, hi)).order_by(m.BPReading.measured_at)).all()
    first_half = [r.systolic for r in bp if r.measured_at < mid]
    second_half = [r.systolic for r in bp if r.measured_at >= mid]
    glucose = db.scalars(select(m.GlucoseReading).where(
        m.GlucoseReading.user_id == uid, m.GlucoseReading.measured_at.between(lo, hi)).order_by(m.GlucoseReading.measured_at)).all()
    fasting = [g.value for g in glucose if g.context == "fasting"]
    g_first = [g.value for g in glucose if g.measured_at < mid]
    g_second = [g.value for g in glucose if g.measured_at >= mid]

    bmi_latest = latest(db, m.BMIRecord, uid)
    bmi_first = db.scalars(select(m.BMIRecord).where(
        m.BMIRecord.user_id == uid, m.BMIRecord.measured_at.between(lo, hi)).order_by(m.BMIRecord.measured_at)).first()

    taken, expected = med_doses(db, uid, start, today - timedelta(days=1)) if days > 1 else (0, 0)

    food_days = db.execute(select(m.FoodEntry.day, func.sum(m.FoodEntry.calories), func.sum(m.FoodEntry.sodium_mg),
                                  func.sum(m.FoodEntry.carbs_g)).where(
        m.FoodEntry.user_id == uid, m.FoodEntry.day >= start, m.FoodEntry.day <= today).group_by(m.FoodEntry.day)).all()
    workouts = db.scalars(select(m.Workout).where(
        m.Workout.user_id == uid, m.Workout.day >= start, m.Workout.day <= today)).all()
    active_days = {w.day for w in workouts}
    goal_days = sum(1 for d in active_days if sum(w.duration_min for w in workouts if w.day == d) >= patient.activity_goal_min)

    habits = db.scalars(select(m.Habit).where(m.Habit.user_id == uid)).all()
    habit_logs = db.scalars(select(m.HabitLog).where(
        m.HabitLog.user_id == uid, m.HabitLog.day >= start, m.HabitLog.day <= today)).all()
    targets = {h.id: h.target for h in habits}
    habit_hits = sum(1 for l in habit_logs if l.count >= targets.get(l.habit_id, 1))
    checkins = checkin_days(db, uid)
    streak = streak_info(checkins, today)

    return {
        "period": {"days": days, "start": start.isoformat(), "end": today.isoformat()},
        "blood_pressure": {
            "readings": len(bp),
            "avg_systolic": _avg(r.systolic for r in bp), "avg_diastolic": _avg(r.diastolic for r in bp),
            "highest": f"{max(bp, key=lambda r: r.systolic).systolic}/{max(bp, key=lambda r: r.systolic).diastolic}" if bp else None,
            "readings_at_or_above_140_90": sum(1 for r in bp if r.systolic >= 140 or r.diastolic >= 90),
            "systolic_trend": _trend(_avg(first_half), _avg(second_half), 3),
            "latest": f"{bp[-1].systolic}/{bp[-1].diastolic}" if bp else None,
        },
        "blood_sugar_mg_dl": {
            "readings": len(glucose), "avg_fasting": _avg(fasting),
            "highest": max((g.value for g in glucose), default=None),
            "lowest": min((g.value for g in glucose), default=None),
            "readings_above_180": sum(1 for g in glucose if g.value > 180),
            "readings_below_70": sum(1 for g in glucose if g.value < 70),
            "trend": _trend(_avg(g_first), _avg(g_second), 8),
        },
        "bmi": {
            "latest": bmi_latest.bmi if bmi_latest else None,
            "latest_category": bmi_latest.category if bmi_latest else None,
            "latest_date": bmi_latest.measured_at.date().isoformat() if bmi_latest else None,
            "change_in_period": round(bmi_latest.bmi - bmi_first.bmi, 1) if bmi_latest and bmi_first else None,
        },
        "medicines": {
            "doses_taken": taken, "doses_expected": expected,
            "adherence_percent": round(100 * taken / expected) if expected else None,
            "doses_missed": expected - taken if expected else None,
        },
        "food": {
            "days_logged": len(food_days),
            "avg_calories_on_logged_days": _avg((r[1] for r in food_days), 0),
            "daily_calorie_goal": patient.calorie_goal,
            "avg_sodium_mg": _avg((r[2] for r in food_days), 0),
            "avg_carbs_g": _avg((r[3] for r in food_days), 0),
        },
        "activity": {
            "active_days": len(active_days), "total_minutes": sum(w.duration_min for w in workouts),
            "avg_minutes_per_active_day": _avg(sum(w.duration_min for w in workouts if w.day == d) for d in active_days),
            "daily_goal_minutes": patient.activity_goal_min, "days_goal_met": goal_days,
        },
        "habits": {"goals_met": habit_hits, "entries_logged": len(habit_logs)},
        "check_ins": {"days_checked_in": len([d for d in checkins if start <= d <= today]),
                      "current_streak": streak["current"], "longest_streak": streak["longest"]},
    }
