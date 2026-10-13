import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # lifespan creates tables and seeds mock data
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def patient(client):
    return login(client, "meena@example.com", "patient123")


@pytest.fixture(scope="session")
def other_patient(client):
    return login(client, "ravi@example.com", "patient123")


@pytest.fixture(scope="session")
def clinician(client):
    return login(client, "dr.nair@clinic.test", "clinician123")
