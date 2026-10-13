from app import google_auth

PATIENT = {"email": "meena.iyer@care.test", "password": "patient123"}
CLINICIAN = {"email": "kavitha.menon@riversidehealth.example", "password": "clinician123"}


def test_login_tab_must_match_role(client):
    assert client.post("/api/auth/login", json={**PATIENT, "role": "patient"}).status_code == 200
    assert client.post("/api/auth/login", json={**CLINICIAN, "role": "clinician"}).status_code == 200
    r = client.post("/api/auth/login", json={**PATIENT, "role": "clinician"})
    assert r.status_code == 403 and "Patient login" in r.json()["detail"]
    assert client.post("/api/auth/login", json={**CLINICIAN, "role": "patient"}).status_code == 403


def test_google_disabled_without_client_id(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert client.get("/api/auth/google-config").json() == {"client_id": None}
    assert client.post("/api/auth/google", json={"credential": "x" * 20, "role": "patient"}).status_code == 503


def _google(monkeypatch, **claims):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    base = {"aud": "test-client.apps.googleusercontent.com", "iss": "https://accounts.google.com", "email_verified": "true"}
    monkeypatch.setattr(google_auth, "fetch_claims", lambda cred: {**base, **claims})


def test_google_signs_in_existing_account_by_email(client, monkeypatch):
    _google(monkeypatch, email="Meena.Iyer@care.test", name="Meena")
    r = client.post("/api/auth/google", json={"credential": "x" * 20, "role": "patient"}).json()
    assert r["user"]["name"] == "Meena Iyer" and r["token"]
    assert client.post("/api/auth/google", json={"credential": "x" * 20, "role": "clinician"}).status_code == 403


def test_google_creates_new_patients_but_not_clinicians(client, monkeypatch):
    _google(monkeypatch, email="new.person@gmail.test", name="New Person")
    assert client.post("/api/auth/google", json={"credential": "x" * 20, "role": "clinician"}).status_code == 403
    r = client.post("/api/auth/google", json={"credential": "x" * 20, "role": "patient"}).json()
    assert r["user"]["role"] == "patient" and r["user"]["name"] == "New Person"
    me = client.get("/api/home", headers={"Authorization": f"Bearer {r['token']}"})
    assert me.status_code == 200 and me.json()["clinician"] is not None  # assigned to a clinician


def test_google_rejects_tokens_for_other_sites_or_unverified_emails(client, monkeypatch):
    _google(monkeypatch, email="meena.iyer@care.test", aud="someone-else")
    assert client.post("/api/auth/google", json={"credential": "x" * 20, "role": "patient"}).status_code == 401
    _google(monkeypatch, email="meena.iyer@care.test", email_verified="false")
    assert client.post("/api/auth/google", json={"credential": "x" * 20, "role": "patient"}).status_code == 401


def test_patient_can_register_and_is_saved(client):
    body = {"name": "Neha Verma", "email": "Neha.Verma@care.test", "password": "strongpass1", "age": 29, "phone": " ", "height_cm": 165, "weight_kg": 60}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201, r.text
    user = r.json()["user"]
    assert user["role"] == "patient" and user["email"] == "neha.verma@care.test" and user["age"] == 29 and user["phone"] is None
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/home", headers=h).json()["clinician"] is not None
    assert len(client.get("/api/habits", headers=h).json()) == 3  # starter habits
    login = client.post("/api/auth/login", json={"email": "neha.verma@care.test", "password": "strongpass1", "role": "patient"})
    assert login.status_code == 200
    assert client.post("/api/auth/register", json=body).status_code == 409  # same email again


def test_register_validates_input(client):
    ok = {"name": "Test Person", "email": "t.person@care.test", "password": "longenough", "height_cm": 170, "weight_kg": 70}
    assert client.post("/api/auth/register", json={**ok, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "email": "not-an-email"}).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "name": "   "}).status_code == 422
    no_body = {k: v for k, v in ok.items() if k not in ("height_cm", "weight_kg")}
    assert client.post("/api/auth/register", json=no_body).status_code == 422  # height and weight are required


def test_patients_choose_a_doctor_and_on_call_covers_when_away(client):
    docs = client.get("/api/auth/clinicians").json()
    assert {"email", "phone"}.isdisjoint(docs[0])  # public list has no contact details
    away = next(d for d in docs if not d["available"])
    on_call = next(d for d in docs if d["on_call"])

    r = client.post("/api/auth/register", json={"name": "Choosy Patient", "email": "choosy@care.test",
                                                 "password": "longenough1", "clinician_id": away["id"], "height_cm": 160, "weight_kg": 55}).json()
    assert r["user"]["clinician_id"] == away["id"]  # allowed to pick an away doctor
    h = {"Authorization": f"Bearer {r['token']}"}
    home = client.get("/api/home", headers=h).json()
    assert home["clinician"]["available"] is False and on_call["id"] in [c["id"] for c in home["on_call"]]

    # change doctor later; 0 means any available doctor, which never picks an away one
    assert client.patch("/api/auth/me", json={"clinician_id": on_call["id"]}, headers=h).json()["clinician_id"] == on_call["id"]
    assert client.patch("/api/auth/me", json={"clinician_id": 0}, headers=h).json()["clinician_id"] != away["id"]
    assert client.patch("/api/auth/me", json={"clinician_id": 99999}, headers=h).status_code == 422
    assert client.post("/api/auth/register", json={"name": "Auto Patient", "email": "auto@care.test",
                                                    "password": "longenough1", "height_cm": 180, "weight_kg": 80}).json()["user"]["clinician_id"] != away["id"]


def test_only_clinicians_set_availability(client, patient, clinician):
    assert client.patch("/api/auth/me", json={"on_call": True}, headers=patient).status_code == 403
    assert client.patch("/api/auth/me", json={"clinician_id": 1}, headers=clinician).status_code == 403
    r = client.patch("/api/auth/me", json={"available": False}, headers=clinician).json()
    assert r["available"] is False
    client.patch("/api/auth/me", json={"available": True}, headers=clinician)
