"""Rule-based personal nudge shown in login reminders: picks the patient's weakest area this week."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import models as m
from .stats import checkin_days, med_doses, period_stats
from .streaks import current_streak


def personal_message(db: Session, user: m.User, today: date) -> str:
    first = user.name.split()[0]
    week = period_stats(db, user, 7, today)
    taken, expected = med_doses(db, user.id, today - timedelta(days=7), today - timedelta(days=1))
    streak = current_streak(checkin_days(db, user.id), today)
    candidates = []  # (priority, message)
    if expected and taken < expected:
        candidates.append((3, f"you missed {expected - taken} medicine dose(s) this week. Try tying each dose to a daily routine such as breakfast or brushing your teeth."))
    act = week["activity"]
    if act["total_minutes"] < user.activity_goal_min * 3:
        candidates.append((2, f"you were active on only {act['active_days']} day(s) this week. A 10-minute walk after a meal is an easy start."))
    if week["food"]["days_logged"] < 4:
        candidates.append((2, "you logged food on only a few days this week. Typing what you ate takes under a minute."))
    if week["food"]["avg_calories_on_logged_days"] and week["food"]["avg_calories_on_logged_days"] > user.calorie_goal * 1.1:
        candidates.append((1, "your average calories ran above your goal this week. Swapping one fried snack for fruit would help."))
    if streak >= 3:
        candidates.append((0, f"you are on a {streak}-day streak. Check in today to keep it going."))
    candidates.sort(key=lambda c: -c[0])
    tail = candidates[0][1] if candidates else "a quick check-in keeps your habits on track."
    return f"{first}, {tail}"
