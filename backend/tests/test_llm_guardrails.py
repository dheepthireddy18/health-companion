import json

from app import llm
from app.llm import SYSTEM_PROMPT, generate_summary, template_summary, validate
from app.models import User
from app.stats import period_stats
from app.database import SessionLocal
from datetime import date
from sqlalchemy import select


def stats_for(email="asha.rao@gmail.com", days=30):
    with SessionLocal() as db:
        p = db.scalars(select(User).where(User.email == email)).first()
        return period_stats(db, p, days, date.today()), p


def test_stats_contain_no_identity(client):
    stats, patient = stats_for()
    blob = json.dumps(llm.anonymise(stats)).lower()
    for secret in (patient.name.lower(), patient.email, patient.phone):
        assert secret not in blob


def test_clean_summary_passes(client):
    stats, _ = stats_for()
    assert validate(template_summary(stats), stats) == []


def test_diagnostic_and_advice_language_is_rejected(client):
    stats, _ = stats_for()
    for bad in ("The patient has hypertension.", "This suggests diabetes.", "They should increase the dose of metformin.",
                "Likely due to missed doses.", "I diagnose a problem.", "Recommend a follow-up visit."):
        assert validate(bad, stats), bad


def test_invented_numbers_are_rejected(client):
    stats, _ = stats_for()
    assert any("numbers" in p for p in validate("- Average systolic was 999 over the period.", stats))


def test_llm_output_that_breaks_rules_falls_back_to_template(client):
    stats, _ = stats_for()
    calls = []

    def bad(system, user):
        calls.append(1)
        return "- The patient has hypertension and should take more medicine."

    result = generate_summary(stats, bad)
    assert result["source"] == "template" and len(calls) == 2  # one retry, then fallback
    assert "hypertension" not in result["text"].lower()
    assert any("rejected" in n for n in result["notes"])


def test_good_llm_output_is_used_and_prompt_is_guarded(client):
    stats, _ = stats_for()
    seen = {}

    def good(system, user):
        seen.update(system=system, user=user)
        return template_summary(stats)

    result = generate_summary(stats, good)
    assert result["source"] == "llm" and result["disclaimer"]
    assert "NEVER diagnose" in seen["system"] and seen["system"] == SYSTEM_PROMPT
    assert "asha" not in seen["user"].lower()


def test_llm_errors_fall_back(client):
    stats, _ = stats_for()

    def boom(system, user):
        raise TimeoutError()

    assert generate_summary(stats, boom)["source"] == "template"


def test_no_api_key_uses_template(client):
    stats, _ = stats_for()
    result = generate_summary(stats)
    assert result["source"] == "template" and "no API key configured" in result["notes"]
