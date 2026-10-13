"""Starting daily calorie goal for a new patient, suggested by Claude inside a range the app computes itself.

1. The app works out a safe range from standard formulas (Mifflin-St Jeor energy needs x activity level),
   adjusted for BMI category.
2. Claude picks a goal inside that range and writes one plain sentence explaining it. It only sees
   de-identified numbers (age, sex, height, weight, BMI, activity level), never a name or contact details.
3. The answer is checked: a goal outside the range is clamped, and wording that diagnoses or prescribes is
   rejected. If the AI is unavailable or its answer fails the checks, the formula's own goal is used.
The patient (and their clinician) can change the goal at any time.
"""
import json
import os
from typing import Callable, Optional

from . import calories as cal
from .llm import MODEL, _BANNED

ACTIVITY_FACTOR = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725}
FLOOR, CEILING = 1200, 4000  # never suggest below or above these, whatever the formula says

SYSTEM_PROMPT = """You help a health-tracking app choose a starting daily calorie goal for a new user.

You get de-identified numbers and an allowed range the app has already computed from standard formulas.
Choose one whole-number goal inside the allowed range, rounded to the nearest 50. Lean towards a gentle
deficit when BMI is above the healthy range, a small surplus when below it, and maintenance otherwise.

Write `reason` as one or two short, friendly sentences for the user: mention their activity level and BMI
category in everyday words. Do not diagnose, name conditions, mention medicines, or promise outcomes, and
avoid the words "should", "must", "suggest", "recommend", "advise" and "risk" (the app rejects them).
This is a starting point that they and their clinician can adjust."""

SCHEMA = {
    "type": "object",
    "properties": {"calorie_goal": {"type": "integer"}, "reason": {"type": "string"}},
    "required": ["calorie_goal", "reason"],
    "additionalProperties": False,
}

# (system, user) -> raw JSON text. Set by tests to avoid network calls.
Completer = Callable[[str, str], str]
completer: Optional[Completer] = None


def _round50(x: float) -> int:
    return int(round(x / 50) * 50)


def baseline(age: int, sex: Optional[str], height_cm: float, weight_kg: float, activity: str) -> dict:
    """Formula estimate and the range Claude must stay inside."""
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age
    s = (sex or "").lower()
    bmr += 5 if s == "male" else -161 if s == "female" else -78  # midpoint when sex is not given
    maintenance = bmr * ACTIVITY_FACTOR.get(activity, ACTIVITY_FACTOR["light"])
    bmi = cal.bmi_value(height_cm, weight_kg)
    category = cal.bmi_category(bmi)
    adjust = {"Underweight": 1.10, "Healthy range": 1.0, "Overweight": 0.85, "Obese range": 0.80}[category]
    goal = _round50(min(CEILING, max(FLOOR, maintenance * adjust)))
    low = _round50(min(CEILING, max(FLOOR, maintenance * min(adjust, 1.0) * 0.95)))
    high = _round50(min(CEILING, max(FLOOR, maintenance * max(adjust, 1.0) * 1.05)))
    return {"bmi": bmi, "bmi_category": category, "maintenance": _round50(maintenance),
            "goal": goal, "range": [min(low, goal), max(high, goal)]}


def _anthropic_complete(system: str, user: str) -> str:
    import anthropic  # imported lazily so the app runs without the SDK or a key
    resp = anthropic.Anthropic().beta.messages.create(
        model=MODEL, max_tokens=4000, system=system, messages=[{"role": "user", "content": user}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("model declined")
    return next(b.text for b in resp.content if b.type == "text")


def suggest(age: int, sex: Optional[str], height_cm: float, weight_kg: float, activity: str) -> dict:
    """Returns {calorie_goal, reason, source: 'ai'|'formula', bmi, bmi_category, maintenance, range}."""
    base = baseline(age, sex, height_cm, weight_kg, activity)
    lo, hi = base["range"]
    plan = {**base, "calorie_goal": base["goal"], "source": "formula",
            "reason": (f"Based on your height, weight, age and {activity} activity level, about {base['goal']} kcal a day "
                       f"is a sensible starting point. You and your clinician can change it any time.")}
    plan.pop("goal")
    if completer is None and not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
        return plan
    facts = {"age": age, "sex": sex or "not given", "height_cm": height_cm, "weight_kg": weight_kg,
             "bmi": base["bmi"], "bmi_category": base["bmi_category"], "activity_level": activity,
             "formula_maintenance_kcal": base["maintenance"], "allowed_range_kcal": [lo, hi]}
    try:
        data = json.loads((completer or _anthropic_complete)(SYSTEM_PROMPT, json.dumps(facts)))
        goal, reason = int(data["calorie_goal"]), str(data["reason"]).strip()
    except Exception:  # network, auth, refusal, malformed output
        return plan
    if not reason or len(reason) > 400 or _BANNED.search(reason):
        return plan
    return {**plan, "calorie_goal": _round50(min(hi, max(lo, goal))), "reason": reason, "source": "ai"}
