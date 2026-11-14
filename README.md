# AstroPulse: Astronaut Health Monitor

NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts on Space Missions*.

AstroPulse is a visual tool that helps astronauts assess their own health during a mission and tells them what to do next.

- **Frontend:** React 18 + Vite, Framer Motion (animations), Recharts (charts), Lucide (icons)
- **Backend:** Python FastAPI + SQLAlchemy 2
- **Database:** PostgreSQL

The full step-by-step guide is in the "AstroPulse: Build Guide" doc. The quick version is below.

## Quick start (Linux terminal)

```bash
# 1. Database (one time)
sudo -u postgres psql -c "CREATE USER astropulse WITH PASSWORD 'astropulse_pw';"
sudo -u postgres psql -c "CREATE DATABASE astropulse OWNER astropulse;"

# 2. Backend (terminal 1)
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py --reset          # demo crew + 30 days of data
uvicorn app.main:app --reload   # http://localhost:8000/docs

# 3. Frontend (terminal 2)
cd frontend
npm install
cp .env.example .env
npm run dev                     # http://localhost:5173
```

Or use the helper scripts after step 1: `./start-backend.sh` and `./start-frontend.sh`.

## Logins and privacy

| Who | How to sign in | What they can see |
| --- | --- | --- |
| Astronaut | pick your name, type your 6-digit PIN | only your own record |
| Mission Control (admin) | username + password from `backend/.env` (default `admin` / `mission2026`, change it!) | every astronaut, Crew Overview, emergency access log |

- PINs and passwords are stored only as bcrypt hashes, never as text.
- Astronauts stay signed in for 30 days, renewed on every visit, until they press **Log out**. Mission Control sessions last 12 hours.
- 5 wrong PINs lock the account for 5 minutes. Mission Control can reset a PIN (key icon on the Crew page); this logs out every device that used the old PIN.
- **Emergency access:** an astronaut can open a crewmate's record read-only for 60 minutes. A reason is required, and every use is logged for Mission Control and shown to the crewmate.
- **Profile photos:** astronauts add their own on **My Profile**; Mission Control can set anyone's (camera icon on Crew cards) and its own (**My photo** in the top-right menu). Photos are cropped in the browser (zoom + drag) and saved as 256×256 images in `backend/uploads/avatars/`.
- Demo PINs after `python seed.py --reset`: Maya `111111`, Diego `222222`, Aiko `333333`.

## Project layout

```
astropulse/
├── backend/
│   ├── app/
│   │   ├── main.py           FastAPI app, CORS, routers, /uploads
│   │   ├── config.py         reads .env
│   │   ├── database.py       SQLAlchemy engine + session
│   │   ├── models.py         tables: astronauts, vital_readings, task_completions, health_images
│   │   ├── schemas.py        request/response validation (Pydantic)
│   │   ├── knowledge.py      space-medicine knowledge: indicators, thresholds, RIDGE hazards, body systems
│   │   ├── health_engine.py  status evaluation, health score, alerts, routine, XP/badges
│   │   └── routers/          astronauts, vitals, health (assessment/quests/knowledge), images
│   ├── seed.py               demo data
│   ├── schema.sql            same schema in plain SQL
│   └── requirements.txt
└── frontend/
    └── src/
        ├── main.jsx, App.jsx  routing + page transitions
        ├── styles.css         design system
        ├── lib/               api client, health helpers, crew context
        ├── components/        layout, starfield, UI kit (score ring, sparkline, toasts, confetti)
        └── pages/             Dashboard, CheckIn, BodyMap, Trends, Quests, Guide, Crew
```

*This is a prototype for education. The thresholds follow common clinical reference ranges. They are not medical advice and not NASA flight rules.*
