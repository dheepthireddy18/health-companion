import json

from app import calorie_plan
from app.calorie_plan import baseline, suggest


def test_formula_range_tracks_bmi_and_activity(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(calorie_plan, "completer", None)
    lean = baseline(30, "Female", 165, 60, "moderate")
    heavy = baseline(30, "Female", 165, 95, "moderate")
    assert lean["bmi_category"] == "Healthy range" and heavy["bmi_category"] == "Obese range"
    assert heavy["goal"] < heavy["maintenance"]                 # gentle deficit above the healthy range
    assert baseline(30, "Female", 165, 60, "active")["goal"] > baseline(30, "Female", 165, 60, "sedentary")["goal"]
    plan = suggest(30, "Female", 165, 60, "moderate")
    assert plan["source"] == "formula" and plan["calorie_goal"] % 50 == 0
    assert plan["range"][0] <= plan["calorie_goal"] <= plan["range"][1]


def test_ai_answer_is_clamped_to_the_range_and_sees_no_identity(monkeypatch):
    seen = {}
    def fake(system, user):
        seen["user"] = user
        return json.dumps({"calorie_goal": 9999, "reason": "You are lightly active, so this keeps you fuelled."})
    monkeypatch.setattr(calorie_plan, "completer", fake)
    plan = suggest(40, "Male", 180, 80, "light")
    assert plan["source"] == "ai" and plan["calorie_goal"] == plan["range"][1]
    assert set(json.loads(seen["user"])) == {"age", "sex", "height_cm", "weight_kg", "bmi", "bmi_category",
                                             "activity_level", "formula_maintenance_kcal", "allowed_range_kcal"}


def test_diagnostic_wording_or_broken_output_falls_back(monkeypatch):
    for bad in ('{"calorie_goal": 1800, "reason": "You have diabetes, so you should eat less."}', "not json"):
        monkeypatch.setattr(calorie_plan, "completer", lambda s, u, bad=bad: bad)
        assert suggest(40, "Male", 180, 80, "light")["source"] == "formula"


def test_registration_sets_goal_and_first_bmi(client, monkeypatch):
    monkeypatch.setattr(calorie_plan, "completer", lambda s, u: json.dumps(
        {"calorie_goal": 1650, "reason": "A steady start for a lightly active day."}))
    r = client.post("/api/auth/register", json={"name": "Plan Person", "email": "plan.person@care.test",
                                                 "password": "longenough1", "age": 28, "gender": "Female",
                                                 "height_cm": 162, "weight_kg": 58, "activity_level": "light"}).json()
    assert r["plan"]["source"] == "ai" and r["user"]["calorie_goal"] == r["plan"]["calorie_goal"]
    assert r["user"]["height_cm"] == 162
    bmi = client.get("/api/bmi", headers={"Authorization": f"Bearer {r['token']}"}).json()
    assert len(bmi) == 1 and bmi[0]["weight_kg"] == 58
