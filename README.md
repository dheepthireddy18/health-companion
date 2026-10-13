# Health Companion

A daily health tracker with two roles. **Patients** log habits, food, activity, readings and medicines in about a minute a day; **clinicians** see every patient's records and can generate an AI summary of the last 7, 30 or 90 days.

| Layer    | Stack                                              |
|----------|----------------------------------------------------|
| Backend  | Python 3.9+, FastAPI, SQLAlchemy 2, SQLite, pytest |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind, vitest |
| AI       | Anthropic API (`claude-opus-5-5` by default, set `LLM_MODEL` to change) |

## Roles

**Patient** (`/`): status card (green/amber/red), daily check-in with streak (every 5th day is a milestone), food by plain-text ("2 idli and a cup of dal") with live typo check and calories, activity with calories burned, calorie and activity goals, a one-tap "my calories matched my goal", BMI calculator, blood pressure and sugar, medicines with reminders, habits. Every page has a **Contact clinician** button: 1. call local emergency, 2. chat, 3. call the clinician.

**Clinician** (`/clinician`): all patients, most urgent first, with latest BP, sugar, BMI, streak and medicine adherence. Beside each name: a period picker (7/30/90 days) and a **Summary** button. Click a name for full records and chat.

Patients can only read and write their own rows (every query is filtered by `user_id`); clinicians cannot use patient endpoints and patients cannot use clinician ones.

## Run it

```bash
# 1. Backend: http://127.0.0.1:8000 (API docs at /docs). First start creates and seeds health.db.
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...   # optional, see "AI summaries"
uvicorn app.main:app --reload

# 2. Frontend: http://localhost:3000
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to the backend (`BACKEND_URL`, default `http://127.0.0.1:8000`).
Set `SECRET_KEY` for any real deployment. Rebuild the demo data with `python -m app.seed --reset`; set `SEED_DEMO=0` to start empty.

### Demo accounts (mock data: 6 patients, 90 days each)

| Role | Email | Password |
|------|-------|----------|
| Clinician | dr.nair@clinic.test, nurse.cho@clinic.test | clinician123 |
| Patient | asha@, ravi@, meena@ (15-day streak), john@ (lapsed streak), priya@, sam@ `example.com` | patient123 |

## AI summaries and guardrails

The model only ever receives numbers computed by the backend (`app/stats.py`), with no name, contact details or patient-typed text. Then:

1. The system prompt forbids diagnosis, causes, risk, advice, and new numbers.
2. The output is checked (`app/llm.py: validate`): diagnostic/prescriptive wording or any number not in the input rejects it. One retry, then a plain template built from the same numbers is shown instead, labelled "Automatic (AI not used)".
3. The disclaimer is added by the app, and each summary is logged in `summary_audit`.

Without `ANTHROPIC_API_KEY` the template is used. These checks reduce risk but are keyword-based; clinicians should still read the underlying records.

## Notifications

The server decides what is due (`app/routers/notifications.py`): a missed dose is announced at its time and again **every 30 minutes** until it is marked Taken/Skipped or the patient unticks *Remind me* (Medicines page). At login, patients who have not checked in get a nudge with a personal suggestion from their last week's habits.
The browser shows these through a service worker (`frontend/public/sw.js`) and polls every minute, so **the app must be open in a tab or installed window**. Reminders while the browser is closed would need Web Push (VAPID keys and a sender such as `pywebpush`), which is not built.

## Tests

```bash
cd backend && pytest          # roles, privacy, calories, streaks, reminders, LLM guardrails
cd frontend && npm test
```

## Layout

```
backend/app  main.py  models.py  schemas.py  security.py (auth, roles)  alerts.py (BP/sugar thresholds)
             calories.py (meal parser, burn, BMI, balance)  streaks.py  stats.py  llm.py  suggestions.py  seed.py
             routers/ auth, patient, messages, notifications, clinician
frontend     app/ (patient pages, login, clinician/)  components/  lib/
```

> An organiser, not a medical device. Thresholds follow common ADA/AHA guidance (`alerts.py`) and never replace a clinician's advice.
