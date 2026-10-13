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
    body = {"name": "Neha Verma", "email": "Neha.Verma@care.test", "password": "strongpass1", "age": 29, "phone": " "}
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
    ok = {"name": "Test Person", "email": "t.person@care.test", "password": "longenough"}
    assert client.post("/api/auth/register", json={**ok, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "email": "not-an-email"}).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "name": "   "}).status_code == 422
