"""Rule-based health reading classification.

Thresholds follow commonly published guidance (ADA for glucose, AHA/ACC for blood
pressure). They are informational only - NOT medical advice. A doctor's personal
targets always take priority.
"""
from dataclasses import dataclass


@dataclass
class Status:
    label: str      # short text, e.g. "High"
    severity: int   # 0 ok, 1 watch, 2 warning, 3 urgent
    message: str


def glucose_status(value: float, context: str = "fasting") -> Status:
    after_meal = context == "after_meal"
    if value < 54:
        return Status("Very low", 3, "Dangerously low sugar. Take 15g fast sugar (juice/glucose tablets) now and call your doctor or emergency services if you feel unwell.")
    if value < 70:
        return Status("Low", 2, "Low sugar. Take 15g fast-acting carbohydrate, recheck in 15 minutes.")
    normal_max, elevated_max = (180, 250) if after_meal else (130, 180)
    if value <= normal_max:
        return Status("In range", 0, "Within the usual target range.")
    if value <= elevated_max:
        return Status("Elevated", 1, "A little above target. Review your last meal and medicines.")
    if value <= 300:
        return Status("High", 2, "High sugar. Drink water, take medicines as prescribed and tell your doctor if this repeats.")
    return Status("Very high", 3, "Very high sugar. Contact your doctor today; seek urgent care if you feel sick, thirsty or confused.")


def bp_status(systolic: int, diastolic: int) -> Status:
    if systolic > 180 or diastolic > 120:
        return Status("Crisis", 3, "Dangerously high. Rest and recheck in 5 minutes. If still high, or you have chest pain, headache or weakness, call emergency services.")
    if systolic >= 140 or diastolic >= 90:
        return Status("High (Stage 2)", 2, "High blood pressure. Take medicines as prescribed and discuss with your doctor.")
    if systolic >= 130 or diastolic >= 80:
        return Status("Elevated (Stage 1)", 1, "Slightly high. Limit salt, stay active and keep monitoring.")
    if systolic < 90 or diastolic < 60:
        return Status("Low", 2, "Low blood pressure. Sit or lie down, drink water; get help if dizzy or faint.")
    if systolic >= 120:
        return Status("Slightly raised", 1, "Systolic a little above ideal. Keep up healthy habits.")
    return Status("Normal", 0, "Healthy range.")
