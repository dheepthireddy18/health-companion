"""Daily check-in streaks. Every 5th consecutive day is a milestone."""
from datetime import date, timedelta

MILESTONE_EVERY = 5


def current_streak(days: set, today: date) -> int:
    """Consecutive check-in days ending today (or yesterday, so the streak is still alive until midnight)."""
    cursor = today if today in days else today - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def longest_streak(days: set) -> int:
    best = run = 0
    prev = None
    for d in sorted(days):
        run = run + 1 if prev and d - prev == timedelta(days=1) else 1
        best, prev = max(best, run), d
    return best


def streak_info(days: set, today: date) -> dict:
    s = current_streak(days, today)
    return {
        "current": s,
        "longest": longest_streak(days),
        "checked_in_today": today in days,
        "milestone": s > 0 and s % MILESTONE_EVERY == 0,
        "next_milestone": (s // MILESTONE_EVERY + 1) * MILESTONE_EVERY,
    }
