from datetime import date, timedelta

from app.streaks import current_streak, longest_streak, streak_info

TODAY = date(2026, 10, 12)


def days(*offsets):
    return {TODAY - timedelta(days=o) for o in offsets}


def test_counts_consecutive_days_through_today():
    assert current_streak(days(0, 1, 2), TODAY) == 3


def test_streak_alive_until_midnight_if_yesterday_checked():
    assert current_streak(days(1, 2), TODAY) == 2


def test_gap_resets_streak():
    assert current_streak(days(2, 3, 4), TODAY) == 0
    assert current_streak(set(), TODAY) == 0


def test_longest_streak():
    assert longest_streak(days(0, 1, 5, 6, 7, 8)) == 4


def test_every_fifth_day_is_a_milestone():
    for n in (5, 10, 15):
        assert streak_info(days(*range(n)), TODAY)["milestone"] is True
    for n in (1, 4, 6, 9):
        assert streak_info(days(*range(n)), TODAY)["milestone"] is False
    assert streak_info(days(*range(7)), TODAY)["next_milestone"] == 10
    assert streak_info(set(), TODAY)["milestone"] is False
