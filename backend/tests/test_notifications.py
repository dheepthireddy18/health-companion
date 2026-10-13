from datetime import date, datetime, timedelta

from conftest import login

DAY = date(2032, 3, 1)


def at(h, m=0):
    return datetime(DAY.year, DAY.month, DAY.day, h, m).isoformat()


def due(client, who, h, m=0):
    return client.get(f"/api/notifications/due?now={at(h, m)}", headers=who).json()


def test_missed_dose_repeats_every_30_minutes_until_taken(client, patient):
    meds = client.get("/api/medications", headers=patient).json()
    assert meds
    ids = {m["id"] for m in meds}
    # only the 20:00 slots matter here: before then, morning doses are overdue too, so look at 20:xx only
    first = [n for n in due(client, patient, 20, 0) if "20:00" in n["body"]]
    assert first and first[0]["title"].startswith("Time for")
    assert [n for n in due(client, patient, 20, 10) if "20:00" in n["body"]] == []       # too soon
    again = [n for n in due(client, patient, 20, 30) if "20:00" in n["body"]]
    assert again and again[0]["title"].startswith("Reminder")
    assert [n for n in due(client, patient, 20, 59) if "20:00" in n["body"]] == []
    assert [n for n in due(client, patient, 21, 0) if "20:00" in n["body"]]            # next 30-min repeat

    for med in meds:
        if "20:00" in med["times"]:
            client.post("/api/medications/log", json={"medication_id": med["id"], "day": str(DAY), "slot": "20:00",
                                                      "status": "taken"}, headers=patient)
    assert [n for n in due(client, patient, 21, 30) if "20:00" in n["body"]] == []     # stops once taken


def test_turning_notifications_off_stops_everything(client, other_patient):
    assert due(client, other_patient, 23, 0)  # overdue doses exist
    client.patch("/api/auth/me", json={"notifications_enabled": False}, headers=other_patient)
    assert due(client, other_patient, 23, 30) == []
    assert client.post(f"/api/notifications/welcome?now={at(9)}", headers=other_patient).json() is None
    client.patch("/api/auth/me", json={"notifications_enabled": True}, headers=other_patient)


def test_nothing_due_before_the_scheduled_time(client):
    h = login(client, "priya@example.com", "patient123")
    assert due(client, h, 6, 0) == []


def test_login_reminder_for_missed_check_in_once_a_day(client):
    h = login(client, "john@example.com", "patient123")  # seeded with a lapsed streak
    first = client.post(f"/api/notifications/welcome?now={at(9)}", headers=h).json()
    assert first["title"] == "You missed yesterday's check-in"
    assert first["body"].startswith("John,")  # personal message
    assert client.post(f"/api/notifications/welcome?now={at(10)}", headers=h).json() is None


def test_no_login_reminder_if_already_checked_in(client):
    h = login(client, "asha@example.com", "patient123")
    client.post(f"/api/checkin?day={DAY}", headers=h)
    assert client.post(f"/api/notifications/welcome?now={at(9)}", headers=h).json() is None
