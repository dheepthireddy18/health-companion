from app.alerts import bp_status, glucose_status
from app.calories import bmi_category, bmi_value, calories_burned, energy_balance, parse_meal


def test_parse_quantities_and_words():
    items, unmatched = parse_meal("2 idli and a cup of dal, an apple")
    assert [i["name"] for i in items] == ["Idli", "Dal", "Apple"]
    assert items[0]["quantity"] == 2 and items[0]["calories"] == 130
    assert unmatched == []


def test_parse_prefers_longest_alias_and_fractions():
    items, _ = parse_meal("1 cup brown rice")
    assert items[0]["name"] == "Brown rice"
    items, _ = parse_meal("1/2 cup rice")
    assert items[0]["name"] == "White rice" and items[0]["calories"] == round(205 * 0.5)


def test_parse_reports_unknown_food():
    items, unmatched = parse_meal("moon cheese, 2 chapatis")
    assert [i["name"] for i in items] == ["Chapati"] and items[0]["quantity"] == 2
    assert unmatched == ["moon cheese"]


def test_parse_ignores_absurd_quantity():
    assert parse_meal("500 idli")[0] == []


def test_bmi():
    assert bmi_value(170, 70) == 24.2
    assert bmi_category(17) == "Underweight" and bmi_category(24.2) == "Healthy range"
    assert bmi_category(27) == "Overweight" and bmi_category(32) == "Obese range"


def test_calories_burned_scales_with_time_weight_and_intensity():
    base = calories_burned("walking", 30, "moderate", 70)
    assert base == round(3.5 * 70 * 0.5)
    assert calories_burned("walking", 60, "moderate", 70) > base
    assert calories_burned("walking", 30, "vigorous", 70) > base


def test_energy_balance_states():
    assert energy_balance(1800, 1800, 0, 30, 30)["state"] == "matched"
    over = energy_balance(1800, 2400, 100, 30, 10)
    assert over["state"] == "over" and over["difference"] == 500
    assert any("brisk walk" in t for t in over["suggestions"]) and any("short" in t for t in over["suggestions"])
    under = energy_balance(1800, 900, 0, 30, 30)
    assert under["state"] == "under" and "900" in under["suggestions"][0]


def test_exercise_lets_you_eat_more():
    assert energy_balance(1800, 2200, 400, 30, 30)["state"] == "matched"


def test_vitals_thresholds():
    assert glucose_status(100).severity == 0 and glucose_status(50).severity == 3
    assert glucose_status(170, "after_meal").severity == 0 and glucose_status(170).severity == 1
    assert bp_status(115, 75).label == "Normal" and bp_status(190, 100).label == "Crisis"
