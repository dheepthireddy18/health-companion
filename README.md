# Health Companion

A daily health tracker with two roles. **Patients** log habits, food, activity, readings and medicines in about a minute a day; **clinicians** see every patient's records and can generate an AI summary of the last 7, 30 or 90 days.

| Layer    | Stack                                              |
|----------|----------------------------------------------------|
| Backend  | Python 3.9+, FastAPI, SQLAlchemy 2, SQLite, pytest |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind, vitest |
| AI       | Anthropic API (`claude-opus-5-5` by default, set `LLM_MODEL` to change) |

## Roles

**Patient**: **Today** (`/`) shows the status card (green/amber/red) and an animated check-in streak (every 5th day is a milestone). **Track** (`/track`) puts food by plain text ("2 idli and a cup of dal", with live typo check and calories), activity with calories burned, calorie and activity goals, a one-tap "I matched my goal" (enabled only once net calories are within 10% of the goal and the activity goal is met), blood pressure, sugar and BMI on one page. Medicines have reminders; habits have counters. A round **contact button** in the bottom-right corner opens *Text* (chat) or *Call* the clinician on hover or tap. The local emergency number is in the profile menu (top right), next to **Profile** (personal and health details, emergency contact) and **Settings** (sound effects, animations, reminders, goals).

**Clinician** (`/clinician`): all patients, most urgent first, with latest BP, sugar, BMI, streak and medicine adherence. Beside each name: a period picker (7/30/90 days) and a **Summary** button. Your own patients are listed first, then the rest of the clinic. Click a name for full records. Chat lives in a collapsible dock (chat button, bottom-right), searchable, with those awaiting a reply flagged. Conversations are private to one clinician and one patient: a clinician sees only their own chats (plus their own patients, to start one), never a colleague's. Patients see a tab per doctor and can write to their own doctor, the on-call doctor, or any doctor who has written to them. Clinicians also have Profile and Settings.

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
Static data lives in JSON under `backend/app/data/`, not in code: `foods.json` (food table and the words the meal parser understands), `activities.json` (exercise MET values), `starter_habits.json` (habits given to newly registered patients) and `demo_data.json` (demo logins, profiles, medicines and each patient's story). Edit those and restart; reseed for demo changes.
Set `SECRET_KEY` for any real deployment. Rebuild the demo data with `python -m app.seed --reset`; set `SEED_DEMO=0` to start empty.

### Demo accounts (mock data: a small clinic, 6 patients, 90 days each)

The login page has **Sign in** and **Create account** tabs. Sign in asks whether you are a patient or a clinician; an account used on the wrong one is refused. **Create account** registers a new patient (name, email, password, age, height, weight and activity level; optional phone and gender). Height and weight save a first BMI reading and set a starting calorie goal: the app computes a safe range from standard formulas (Mifflin-St Jeor x activity, adjusted for BMI), Claude picks a goal inside it and writes a short reason from de-identified numbers only, and answers outside the range are clamped while diagnostic wording falls back to the formula (`app/calorie_plan.py`). It lets you pick a doctor (or *any available doctor*, which picks the available clinician with the fewest patients), saves it to the database, adds three starter habits and signs you in. Patients can change doctor later in Profile. Clinicians mark themselves **Available** or away and **On call** in Settings; when a patient's doctor is away, the contact button offers the on-call doctor. The demo clinic has Dr. Arjun Shetty on call and Dr. Neil D'Souza (neil.dsouza@riversidehealth.example) away. Clinician accounts are only created by the clinic (seed data).

| Role | Email | Password |
|------|-------|----------|
| Clinician | kavitha.menon@riversidehealth.example (endocrinology), arjun.shetty@riversidehealth.example (internal medicine) | clinician123 |
| Patient | `@gmail.com`: asha.rao (BP rising), ravi.kumar (high sugar), meena.iyer (15-day streak, well controlled), john.mathew (lapsed streak, missed doses), priya.nair (stable), sam.thomas (stage 2 BP) | patient123 |

Each patient has their own conditions, medicines, goals and profile. No chat history is seeded; conversations start when someone sends a message. Phone numbers use the fictional 555-01xx range and emails use reserved domains (`.test`, `.example`) that can never belong to a real person.

### Sign in with Google (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an **OAuth client ID** of type *Web application*, with `http://localhost:3000` as an authorized JavaScript origin.
2. Start the backend with `export GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com`.

The button then works on both tabs. An existing account signs in when its email matches the Google address. On the Patient tab a new address creates a patient account, assigned to the clinician with the fewest patients; clinicians cannot sign themselves up. The ID token is verified with Google (`app/google_auth.py`), checking that it was issued for this client ID to a verified email. Without `GOOGLE_CLIENT_ID` the button shows as unavailable.

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
