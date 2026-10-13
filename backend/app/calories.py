"""Calorie tools: free-text meal parsing, exercise burn, energy balance suggestions and BMI.

Food values are approximate per typical serving - a starting point, not a lab result.
"""
import re
from typing import Optional

# name, aliases, serving, kcal, carbs_g, protein_g, fat_g, sodium_mg   (per ONE serving)
FOODS = [
    ("Oats porridge", ["oats", "oatmeal", "porridge"], "1 bowl", 150, 27, 5, 3, 5),
    ("Idli", ["idli", "idly"], "1 piece", 65, 14, 2, 0.3, 125),
    ("Dosa", ["dosa"], "1 piece", 133, 25, 3, 2.5, 200),
    ("Upma", ["upma"], "1 cup", 190, 30, 5, 6, 400),
    ("Poha", ["poha"], "1 cup", 180, 33, 4, 4, 300),
    ("Chapati", ["chapati", "roti", "phulka"], "1 piece", 100, 18, 3, 2, 120),
    ("Brown rice", ["brown rice"], "1 cup", 215, 45, 5, 1.8, 10),
    ("White rice", ["rice"], "1 cup", 205, 45, 4, 0.4, 2),
    ("Dal", ["dal", "lentils", "lentil curry", "sambar"], "1 cup", 180, 30, 12, 2, 350),
    ("Chickpea salad", ["chickpea salad", "chana salad"], "1 cup", 210, 30, 11, 5, 120),
    ("Vegetable curry", ["vegetable curry", "veg curry", "sabzi"], "1 cup", 120, 14, 3, 6, 300),
    ("Grilled chicken", ["chicken"], "100 g", 165, 0, 31, 3.6, 75),
    ("Fish", ["fish"], "100 g", 130, 0, 22, 4, 90),
    ("Boiled egg", ["egg", "boiled egg"], "1 piece", 78, 0.6, 6, 5, 62),
    ("Omelette", ["omelette", "omelet"], "1 piece", 154, 1, 11, 12, 180),
    ("Curd", ["curd", "yogurt", "yoghurt", "dahi"], "1 cup", 100, 8, 8, 4, 110),
    ("Buttermilk", ["buttermilk", "chaas"], "1 glass", 40, 5, 3, 1, 150),
    ("Apple", ["apple"], "1 medium", 95, 25, 0.5, 0.3, 2),
    ("Banana", ["banana"], "1 medium", 105, 27, 1.3, 0.4, 1),
    ("Guava", ["guava"], "1 piece", 68, 14, 2.6, 1, 2),
    ("Papaya", ["papaya"], "1 cup", 62, 16, 0.7, 0.4, 12),
    ("Orange", ["orange"], "1 piece", 62, 15, 1.2, 0.2, 0),
    ("Almonds", ["almond", "almonds"], "10 nuts", 70, 2.5, 2.6, 6, 0),
    ("Roasted chana", ["roasted chana", "chana"], "1/4 cup", 120, 19, 7, 2, 10),
    ("Salad", ["salad"], "1 bowl", 35, 7, 2, 0.3, 30),
    ("Vegetable soup", ["soup"], "1 bowl", 80, 12, 3, 2, 300),
    ("Khichdi", ["khichdi", "khichri"], "1 cup", 200, 33, 7, 4, 350),
    ("Paneer", ["paneer"], "50 g", 133, 1.5, 9, 10, 20),
    ("Milk", ["milk"], "1 glass", 120, 12, 8, 4, 100),
    ("Tea", ["tea", "chai"], "1 cup", 40, 4, 2, 1.5, 30),
    ("Coffee", ["coffee"], "1 cup", 45, 5, 2, 2, 30),
    ("Biscuit", ["biscuit", "biscuits", "cookie"], "1 piece", 70, 10, 1, 3, 90),
    ("Bread", ["bread", "toast"], "1 slice", 80, 15, 3, 1, 150),
    ("Pizza", ["pizza"], "1 slice", 285, 36, 12, 10, 640),
    ("Burger", ["burger"], "1 piece", 350, 33, 17, 17, 600),
    ("Samosa", ["samosa"], "1 piece", 260, 24, 4, 17, 420),
    ("Gulab jamun", ["gulab jamun", "sweet"], "1 piece", 150, 24, 2, 5, 40),
    ("Chips", ["chips", "crisps"], "1 small pack", 160, 15, 2, 10, 170),
    ("Rajma", ["rajma"], "1 cup", 210, 36, 13, 1, 380),
    ("Biryani", ["biryani"], "1 cup", 290, 40, 10, 10, 520),
    ("Ice cream", ["ice cream", "icecream"], "1 scoop", 140, 16, 2, 7, 50),
    ("Soft drink", ["soda", "cola", "soft drink"], "1 glass", 140, 35, 0, 0, 15),
]

NUMBER_WORDS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
                "half": 0.5, "couple": 2}
FILLER = {"of", "the", "some", "cup", "cups", "bowl", "bowls", "glass", "glasses", "piece", "pieces",
          "pcs", "pc", "slice", "slices", "plate", "plates", "serving", "servings", "small", "medium",
          "large", "my", "i", "ate", "had", "have", "for", "x"}
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


def _match_food(tokens: set) -> Optional[tuple]:
    best, best_len = None, 0
    for food in FOODS:
        for alias in food[1]:
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
        name, _, serving, kcal, carbs, protein, fat, sodium = food
        items.append({
            "name": name, "quantity": qty, "serving": serving,
            "calories": round(kcal * qty), "carbs_g": round(carbs * qty, 1),
            "protein_g": round(protein * qty, 1), "fat_g": round(fat * qty, 1),
            "sodium_mg": round(sodium * qty),
        })
    return items, unmatched


# ---------- exercise ----------
MET = {"walking": 3.5, "brisk walk": 4.3, "jogging": 7.0, "cycling": 6.0, "swimming": 6.0,
       "yoga": 2.5, "stretching": 2.3, "chair exercises": 2.5, "strength training": 3.5,
       "dancing": 4.5, "gardening": 3.8, "housework": 3.3}
INTENSITY_FACTOR = {"light": 0.8, "moderate": 1.0, "vigorous": 1.25}
DEFAULT_WEIGHT_KG = 70.0


def calories_burned(kind: str, minutes: int, intensity: str, weight_kg: Optional[float]) -> float:
    met = MET.get(kind, 3.5) * INTENSITY_FACTOR.get(intensity, 1.0)
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
