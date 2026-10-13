"""Calorie tools: free-text meal parsing, exercise burn, energy balance suggestions and BMI.

The food table and exercise MET values live in app/data/foods.json and app/data/activities.json.
"""
import re
from typing import Optional

from .data import load

_FOOD_DATA = load("foods")
FOODS: list = _FOOD_DATA["foods"]                 # one dict per food, values per ONE serving
NUMBER_WORDS: dict = _FOOD_DATA["number_words"]   # "two" -> 2, "half" -> 0.5
FILLER: set = set(_FOOD_DATA["filler_words"])     # words ignored when matching ("cup", "ate", ...)

_SPLIT = re.compile(r"[,;+\n&]|\band\b|\bwith\b|\bplus\b")
_QTY = re.compile(r"^\s*(\d+\s*/\s*\d+|\d+(?:\.\d+)?)")


def _singular(word: str) -> str:
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        return word[:-1]
    return word


def _quantity(chunk: str):
    """Return (quantity, remaining_text)."""
    m = _QTY.match(chunk)
    if m:
        raw = m.group(1).replace(" ", "")
        qty = int(raw.split("/")[0]) / int(raw.split("/")[1]) if "/" in raw else float(raw)
        return qty, chunk[m.end():]
    words = chunk.split()
    if words and words[0] in NUMBER_WORDS:
        return NUMBER_WORDS[words[0]], " ".join(words[1:])
    return 1.0, chunk


def _match_food(tokens: set) -> Optional[dict]:
    best, best_len = None, 0
    for food in FOODS:
        for alias in food["aliases"]:
            alias_tokens = {_singular(t) for t in alias.split()}
            if alias_tokens <= tokens and len(alias_tokens) > best_len:
                best, best_len = food, len(alias_tokens)
    return best


def parse_meal(text: str):
    """'2 idli and a cup of dal, an apple' -> (items, unmatched). Each item is a nutrition dict."""
    items, unmatched = [], []
    for chunk in _SPLIT.split(text.lower()):
        chunk = re.sub(r"[^a-z0-9/. ]", " ", chunk).strip()
        if not chunk:
            continue
        qty, rest = _quantity(chunk)
        tokens = {_singular(t) for t in rest.split() if t not in FILLER and not t.replace(".", "").isdigit()}
        food = _match_food(tokens)
        if not food or qty <= 0 or qty > 20:
            unmatched.append(chunk)
            continue
        items.append({
            "name": food["name"], "quantity": qty, "serving": food["serving"],
            "calories": round(food["kcal"] * qty), "carbs_g": round(food["carbs_g"] * qty, 1),
            "protein_g": round(food["protein_g"] * qty, 1), "fat_g": round(food["fat_g"] * qty, 1),
            "sodium_mg": round(food["sodium_mg"] * qty),
        })
    return items, unmatched


# ---------- exercise ----------
_ACTIVITY_DATA = load("activities")
MET: dict = _ACTIVITY_DATA["met"]
INTENSITY_FACTOR: dict = _ACTIVITY_DATA["intensity_factor"]
DEFAULT_MET: float = _ACTIVITY_DATA["default_met"]
DEFAULT_WEIGHT_KG = 70.0


def calories_burned(kind: str, minutes: int, intensity: str, weight_kg: Optional[float]) -> float:
    met = MET.get(kind, DEFAULT_MET) * INTENSITY_FACTOR.get(intensity, 1.0)
    return round(met * (weight_kg or DEFAULT_WEIGHT_KG) * minutes / 60)


# ---------- BMI ----------
def bmi_value(height_cm: float, weight_kg: float) -> float:
    return round(weight_kg / (height_cm / 100) ** 2, 1)


def bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Healthy range"
    if bmi < 30:
        return "Overweight"
    return "Obese range"


# ---------- energy balance ----------
TOLERANCE = 0.10  # within 10% of the goal counts as matched


def energy_balance(goal: int, intake: float, burned: float, activity_goal_min: int,
                   activity_min: int, weight_kg: Optional[float] = None) -> dict:
    """Net calories = eaten - burned by exercise, compared with the daily goal."""
    net = intake - burned
    diff = round(net - goal)
    walk_kcal_per_min = MET["brisk walk"] * (weight_kg or DEFAULT_WEIGHT_KG) / 60
    tips = []
    if abs(diff) <= goal * TOLERANCE:
        state = "matched"
        tips.append("Your food and activity are balanced against your goal today. Keep it up.")
    elif diff > 0:
        state = "over"
        minutes = max(5, round(diff / walk_kcal_per_min / 5) * 5)
        tips.append(f"You are about {diff} kcal over your goal. A {minutes}-minute brisk walk would burn roughly that much.")
        tips.append("For the next meal, pick vegetables, dal or salad and skip fried snacks or sweet drinks.")
    else:
        state = "under"
        tips.append(f"You still have about {-diff} kcal left to reach your goal. A balanced snack such as curd with fruit, or a handful of nuts, would fit.")
        if activity_min >= activity_goal_min and intake > 0:
            tips.append("You have been active today, so make sure you eat enough to fuel it.")
    if activity_min < activity_goal_min:
        tips.append(f"You are {activity_goal_min - activity_min} active minutes short of your {activity_goal_min}-minute goal.")
    return {"goal": goal, "intake": round(intake), "burned": round(burned), "net": round(net),
            "difference": diff, "state": state, "suggestions": tips}
