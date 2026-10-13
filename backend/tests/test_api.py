from datetime import date, datetime, timedelta

from app.routers import clinician as clinician_router
from app import llm

from conftest import login


# ---------- roles ----------
def test_login_rejects_bad_password(client):
    assert client.post("/api/auth/login", json={"email": "meena.iyer@care.test", "password": "nope"}).status_code == 401


def test_requires_sign_in(client):
    assert client.get("/api/home").status_code == 401
    assert client.get("/api/clinician/patients").status_code == 401


def test_patient_cannot_use_clinician_area(client, patient):
    assert client.get("/api/clinician/patients", headers=patient).status_code == 403
    assert client.post("/api/clinician/patients/1/summary?days=7", headers=patient).status_code == 403


def test_clinician_cannot_use_patient_endpoints(client, clinician):
    assert client.get("/api/home", headers=clinician).status_code == 403
    assert client.post("/api/food", json={"text": "apple", "meal_type": "snack"}, headers=clinician).status_code == 403


def test_tampered_token_rejected(client, patient):
    token = patient["Authorization"].split()[1]
    assert client.get("/api/home", headers={"Authorization": f"Bearer {token[:-2]}xx"}).status_code == 401


# ---------- row-level isolation ----------
def test_patient_data_is_private(client, patient, other_patient):
    r = client.post("/api/glucose", json={"measured_at": datetime.now().isoformat(), "value": 111}, headers=patient)
    assert r.status_code == 201
    mine = client.get("/api/glucose", headers=patient).json()
    theirs = client.get("/api/glucose", headers=other_patient).json()
    assert r.json()["id"] in {g["id"] for g in mine}
    assert r.json()["id"] not in {g["id"] for g in theirs}


def test_cannot_delete_another_patients_food(client, patient, other_patient):
    food = client.post("/api/food", json={"text": "an apple", "meal_type": "snack"}, headers=patient).json()["added"][0]
    assert client.delete(f"/api/food/{food['id']}", headers=other_patient).status_code == 404
    assert client.delete(f"/api/food/{food['id']}", headers=patient).status_code == 204


# ---------- food, calories, activity, BMI ----------
def test_food_text_creates_entries_and_energy_balance(client, patient):
    day = "2020-01-01"
    r = client.post("/api/food", json={"text": "2 idli and a cup of dal, zorblax", "meal_type": "breakfast", "day": day},
                    headers=patient).json()
    assert [a["name"] for a in r["added"]] == ["Idli", "Dal"] and r["unmatched"] == ["zorblax"]
    e = client.get(f"/api/energy?day={day}", headers=patient).json()
    assert e["intake"] == 130 + 180 and e["state"] == "under"


def test_matched_goal_only_when_both_goals_are_met(client, patient):
    day = "2020-01-02"
    client.post("/api/food", json={"text": "chips", "meal_type": "snack", "day": day}, headers=patient)
    e = client.get(f"/api/energy?day={day}", headers=patient).json()
    assert e["goal_met"] is False and len(e["goal_missing"]) == 2
    r = client.post(f"/api/food/matched-goal?day={day}", headers=patient)
    assert r.status_code == 409 and "active minutes" in r.json()["detail"]
    assert {x["source"] for x in client.get(f"/api/food?day={day}", headers=patient).json()} == {"text"}  # nothing invented

    goal = client.get("/api/auth/me", headers=patient).json()
    client.post("/api/activity", json={"kind": "yoga", "duration_min": goal["activity_goal_min"], "intensity": "light", "day": day}, headers=patient)
    # Eat up to the goal in steps smaller than the tolerance band, so we land inside it.
    while client.get(f"/api/energy?day={day}", headers=patient).json()["state"] == "under":
        client.post("/api/food", json={"text": "an apple", "meal_type": "snack", "day": day}, headers=patient)
    assert client.get(f"/api/energy?day={day}", headers=patient).json()["goal_met"] is True
    e = client.post(f"/api/food/matched-goal?day={day}", headers=patient).json()
    assert e["state"] == "matched" and e["net"] >= e["goal"] * 0.9


def test_activity_burn_uses_latest_weight_and_offsets_intake(client, patient):
    day = "2020-01-03"
    client.post("/api/bmi", json={"height_cm": 160, "weight_kg": 100}, headers=patient)
    w = client.post("/api/activity", json={"kind": "walking", "duration_min": 60, "day": day}, headers=patient).json()
    assert w["calories_burned"] == round(3.5 * 100)
    assert client.get(f"/api/energy?day={day}", headers=patient).json()["burned"] == 350


def test_bmi_calculation(client, patient):
    r = client.post("/api/bmi", json={"height_cm": 170, "weight_kg": 70}, headers=patient).json()
    assert r["bmi"] == 24.2 and r["category"] == "Healthy range"
    assert client.post("/api/bmi", json={"height_cm": 10, "weight_kg": 70}, headers=patient).status_code == 422


def test_goals_update(client, patient):
    r = client.patch("/api/auth/me", json={"calorie_goal": 2000, "activity_goal_min": 40}, headers=patient).json()
    assert r["calorie_goal"] == 2000 and r["activity_goal_min"] == 40
    assert client.patch("/api/auth/me", json={"calorie_goal": 50}, headers=patient).status_code == 422
    client.patch("/api/auth/me", json={"calorie_goal": 1800, "activity_goal_min": 30}, headers=patient)


def test_profile_update_any_role(client, patient, clinician):
    r = client.patch("/api/auth/me", json={"blood_type": "O+", "height_cm": 162, "allergies": "Peanuts"}, headers=patient).json()
    assert r["blood_type"] == "O+" and r["height_cm"] == 162 and r["allergies"] == "Peanuts"
    assert client.patch("/api/auth/me", json={"allergies": "  "}, headers=patient).json()["allergies"] is None
    assert client.patch("/api/auth/me", json={"bio": "Endocrinology"}, headers=clinician).json()["bio"] == "Endocrinology"
    assert client.patch("/api/auth/me", json={"calorie_goal": 2000}, headers=clinician).status_code == 403
    assert client.patch("/api/auth/me", json={"name": ""}, headers=patient).status_code == 422


# ---------- check-in ----------
def test_check_in_builds_streak_and_is_idempotent(client, other_patient):
    day = date(2031, 1, 1)
    streak = 0
    for i in range(5):
        client.post(f"/api/checkin?day={day + timedelta(days=i)}", headers=other_patient)
        streak = client.post(f"/api/checkin?day={day + timedelta(days=i)}", headers=other_patient).json()["current"]
    assert streak == 5
    info = client.get(f"/api/home?day={day + timedelta(days=4)}", headers=other_patient).json()["streak"]
    assert info["milestone"] is True and info["current"] == 5


def test_home_card_color_follows_readings(client, other_patient):
    now = datetime.now().isoformat()
    client.post("/api/bp", json={"measured_at": now, "systolic": 190, "diastolic": 125}, headers=other_patient)
    assert client.get("/api/home", headers=other_patient).json()["status"]["level"] == "red"


# ---------- habits and medicines ----------
def test_habit_progress(client, patient):
    habit = client.get("/api/habits", headers=patient).json()[0]
    client.put(f"/api/habits/{habit['habit_id']}/log", json={"day": str(date.today()), "count": habit["target"]}, headers=patient)
    assert client.get("/api/habits", headers=patient).json()[0]["done"] is True


def test_cannot_log_other_patients_habit(client, patient, other_patient):
    hid = client.get("/api/habits", headers=other_patient).json()[0]["habit_id"]
    assert client.put(f"/api/habits/{hid}/log", json={"day": "2026-01-01", "count": 1}, headers=patient).status_code == 404


# ---------- chat ----------
def test_chat_between_patient_and_clinician(client, patient, clinician):
    pid = client.get("/api/auth/me", headers=patient).json()["id"]
    client.post("/api/messages", json={"body": "My feet feel numb"}, headers=patient)  # to their own doctor
    client.post(f"/api/clinician/patients/{pid}/messages", json={"body": "Please come in tomorrow"}, headers=clinician)
    thread = client.get("/api/messages", headers=patient).json()
    assert [t["from_role"] for t in thread[-2:]] == ["patient", "clinician"]
    assert client.get(f"/api/clinician/patients/{pid}/messages", headers=clinician).json() == thread
    first = client.get("/api/clinician/threads", headers=clinician).json()[0]
    assert first["patient_id"] == pid and first["last_body"] == "Please come in tomorrow"
    assert first["last_from_role"] == "clinician"
    assert client.get("/api/clinician/threads", headers=patient).status_code == 403


def test_conversations_are_private_to_each_clinician(client, patient, clinician):
    """Meena's doctor is Dr. Menon; Dr. Shetty writing to her starts a separate conversation neither can read."""
    shetty = login(client, "arjun.shetty@riversidehealth.example", "clinician123")
    neil = login(client, "neil.dsouza@riversidehealth.example", "clinician123")
    me = client.get("/api/auth/me", headers=patient).json()
    shetty_id = client.get("/api/auth/me", headers=shetty).json()["id"]
    neil_id = client.get("/api/auth/me", headers=neil).json()["id"]
    pid = me["id"]
    client.post(f"/api/clinician/patients/{pid}/messages", json={"body": "Shetty here, quick check-in"}, headers=shetty)
    client.post(f"/api/clinician/patients/{pid}/messages", json={"body": "Menon: see you Friday"}, headers=clinician)

    shetty_view = [x["body"] for x in client.get(f"/api/clinician/patients/{pid}/messages", headers=shetty).json()]
    menon_view = [x["body"] for x in client.get(f"/api/clinician/patients/{pid}/messages", headers=clinician).json()]
    assert "Shetty here, quick check-in" in shetty_view and "Menon: see you Friday" not in shetty_view
    assert "Menon: see you Friday" in menon_view and "Shetty here, quick check-in" not in menon_view
    assert all(t["patient_id"] != pid or t["last_body"] == "Shetty here, quick check-in"
               for t in client.get("/api/clinician/threads", headers=shetty).json())

    # the patient sees both, labelled by clinician, and can reply to Dr. Shetty privately
    mine = client.get("/api/messages", headers=patient).json()
    assert {x["clinician_id"] for x in mine if x["body"] in ("Shetty here, quick check-in", "Menon: see you Friday")} == {shetty_id, me["clinician_id"]}
    client.post("/api/messages", json={"body": "Thanks Dr. Shetty", "clinician_id": shetty_id}, headers=patient)
    assert "Thanks Dr. Shetty" in [x["body"] for x in client.get(f"/api/clinician/patients/{pid}/messages", headers=shetty).json()]
    assert "Thanks Dr. Shetty" not in [x["body"] for x in client.get(f"/api/clinician/patients/{pid}/messages", headers=clinician).json()]
    # but cannot write to a doctor with no connection to them (not theirs, not on call, never wrote)
    assert client.post("/api/messages", json={"body": "hi", "clinician_id": neil_id}, headers=patient).status_code == 403
    assert not [t for t in client.get("/api/clinician/threads", headers=neil).json() if t["patient_id"] == pid]


# ---------- clinician ----------
def test_clinician_sees_every_patient_with_bmi_and_attention_first(client, clinician):
    rows = client.get("/api/clinician/patients", headers=clinician).json()
    assert len(rows) == 6 and all("latest_bmi" in r and "streak" in r for r in rows)
    assert [r["attention"] for r in rows] == sorted((r["attention"] for r in rows), reverse=True)
    assert all(r["latest_bmi"]["value"] > 0 for r in rows)


def test_clinician_reads_patient_records(client, clinician):
    pid = client.get("/api/clinician/patients", headers=clinician).json()[0]["id"]
    rec = client.get(f"/api/clinician/patients/{pid}/records?days=30", headers=clinician).json()
    assert rec["blood_pressure"] and rec["food"] and "streak" in rec
    assert client.get("/api/clinician/patients/99999/records", headers=clinician).status_code == 404
    assert client.get(f"/api/clinician/patients/{rec['patient']['id']}/records?days=0", headers=clinician).status_code == 422


def test_summary_periods_and_audit(client, clinician):
    pid = client.get("/api/clinician/patients", headers=clinician).json()[0]["id"]
    for days in (7, 30, 90):
        r = client.post(f"/api/clinician/patients/{pid}/summary?days={days}", headers=clinician).json()
        assert r["days"] == days and r["stats"]["period"]["days"] == days
        assert r["source"] == "template" and r["disclaimer"]  # no key in tests
    assert client.post(f"/api/clinician/patients/{pid}/summary?days=14", headers=clinician).status_code == 422


def test_summary_endpoint_blocks_diagnosis_from_the_model(client, clinician, monkeypatch):
    pid = client.get("/api/clinician/patients", headers=clinician).json()[0]["id"]
    monkeypatch.setattr(clinician_router, "completer", lambda s, u: "- This patient has hypertension; increase the dose.")
    r = client.post(f"/api/clinician/patients/{pid}/summary?days=30", headers=clinician).json()
    assert r["source"] == "template" and "hypertension" not in r["text"].lower()
    monkeypatch.setattr(clinician_router, "completer", lambda s, u: llm.template_summary(r["stats"]))
    assert client.post(f"/api/clinician/patients/{pid}/summary?days=30", headers=clinician).json()["source"] == "llm"


def test_seeded_streak_stories(client, clinician):
    rows = {r["name"]: r for r in client.get("/api/clinician/patients", headers=clinician).json()}
    assert rows["Meena Iyer"]["streak"] == 15 and rows["John Mathew"]["streak"] == 0
    assert rows["Asha Rao"]["streak"] == 10


def test_food_preview_does_not_save(client, patient):
    day = "2020-02-02"
    r = client.post("/api/food/preview", json={"text": "2 idli and pizzza"}, headers=patient).json()
    assert r["total_calories"] == 130 and r["unmatched"] == ["pizzza"]
    assert client.get(f"/api/food?day={day}", headers=patient).json() == []


def test_any_clinician_message_reaches_the_patient(client, other_patient):
    """Ravi's own clinician is not this one, but the patient still sees the message, in its own conversation."""
    other_doc = login(client, "arjun.shetty@riversidehealth.example", "clinician123")
    me = client.get("/api/auth/me", headers=other_patient).json()
    sent = client.post(f"/api/clinician/patients/{me['id']}/messages", json={"body": "Checking in from the clinic"}, headers=other_doc).json()
    thread = client.get("/api/messages", headers=other_patient).json()
    assert thread[-1]["id"] == sent["id"] and thread[-1]["sender"] == "Dr. Arjun Shetty"
    assert thread[-1]["clinician_id"] == client.get("/api/auth/me", headers=other_doc).json()["id"]


def test_backfill_assigns_old_messages_to_a_conversation(client, other_patient):
    from app import models as mm
    from app.database import SessionLocal
    from app.routers.messages import backfill
    pid = client.get("/api/auth/me", headers=other_patient).json()["id"]
    with SessionLocal() as db:
        doc = db.get(mm.User, db.get(mm.User, pid).clinician_id)
        a = mm.Message(patient_id=pid, sender_id=doc.id, body="legacy from doctor")
        b = mm.Message(patient_id=pid, sender_id=pid, body="legacy reply")
        db.add_all([a, b]); db.commit()
        backfill(db)
        db.refresh(a); db.refresh(b)
        assert a.clinician_id == doc.id and b.clinician_id == doc.id
