"""
Fill the database with a demo crew and 30 days of realistic measurements.

    python seed.py          # add demo crew (keeps existing data)
    python seed.py --reset  # DELETE everything first, then add demo crew

Demo logins:  Maya 111111 · Diego 222222 · Aiko 333333 · Mission Control: see ADMIN_* in .env
"""
import random
import sys
from datetime import date, datetime, timedelta, timezone

from app import knowledge as K
from app.database import Base, SessionLocal, engine
from app.health_engine import evaluate
from app.models import Astronaut, TaskCompletion, VitalReading
from app.security import ensure_default_admin, hash_secret

random.seed(42)
DAYS = 30

CREW = [
    dict(name="Maya Okafor", call_sign="NOVA", role="Commander", agency="NASA", environment="station",
         mission_name="Expedition 78", baseline_mass_kg=68.0, pin="111111", prior_career_dose_msv=72, avatar_color="#7c5cff",
         profile=dict(hr=58, sys=114, dia=72, glu=88, temp=36.9, spo2=98, sleep=6.4, mood=4.2, mass_drift=-0.03,
                      dose=0.7)),
    dict(name="Diego Ramirez", call_sign="ORBIT", role="Flight Engineer", agency="NASA", environment="lunar_base",
         mission_name="Artemis Base Camp", baseline_mass_kg=81.0, pin="222222", prior_career_dose_msv=140, avatar_color="#22d3ee",
         # sleep and mood slowly drift down, BP slowly up -> shows caution alerts and trends
         profile=dict(hr=66, sys=122, dia=79, glu=96, temp=37.0, spo2=97, sleep=6.2, mood=3.9, mass_drift=-0.045,
                      dose=1.4, decline=True)),
    dict(name="Aiko Tanaka", call_sign="ZEN", role="Mission Specialist", agency="JAXA", environment="mars_base",
         mission_name="Ares Transit Habitat", baseline_mass_kg=59.0, pin="333333", prior_career_dose_msv=310, avatar_color="#f472b6",
         profile=dict(hr=61, sys=110, dia=70, glu=84, temp=37.2, spo2=98, sleep=6.8, mood=4.4, mass_drift=-0.05,
                      dose=0.7)),
]


def jitter(x, sd):
    return random.gauss(x, sd)


def build(db, spec):
    p = spec.pop("profile")
    pin = spec.pop("pin")
    start = date.today() - timedelta(days=DAYS - 1)
    astro = Astronaut(mission_start=start - timedelta(days=random.randint(20, 90)), pin_hash=hash_secret(pin), **spec)
    db.add(astro)
    db.flush()

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for d in range(DAYS):
        day = now - timedelta(days=DAYS - 1 - d)
        t = d / (DAYS - 1)  # 0 -> 1 over the period
        decline = p.get("decline", False)
        morning = day.replace(hour=7) if day.replace(hour=7) <= now else now - timedelta(hours=1)

        vals = {
            "heart_rate": (round(jitter(p["hr"] + (8 * t if decline else 0), 3)), None),
            "blood_pressure": (round(jitter(p["sys"] + (14 * t if decline else 0), 4)),
                               round(jitter(p["dia"] + (8 * t if decline else 0), 3))),
            "body_temperature": (round(jitter(p["temp"] + 0.3 * t, 0.15), 1), None),
            "spo2": (min(100, round(jitter(p["spo2"], 0.8))), None),
            "sleep_hours": (round(max(3, jitter(p["sleep"] - (1.4 * t if decline else 0), 0.5)) * 4) / 4, None),
            "mood": (max(1, min(5, round(jitter(p["mood"] - (1.6 * t if decline else 0), 0.5)))), None),
            "radiation_dose": (round(max(0.05, jitter(p["dose"], p["dose"] * 0.12)), 2), None),
        }
        if d % 3 == 0:
            vals["blood_glucose"] = (round(jitter(p["glu"], 8)), None)
        if d % 7 == 0 or d == DAYS - 1:
            vals["body_mass"] = (round(spec["baseline_mass_kg"] * (1 + p["mass_drift"] * t) + jitter(0, 0.3), 1), None)

        for ind, (v, v2) in vals.items():
            status = evaluate(ind, v, v2, spec["baseline_mass_kg"])
            db.add(VitalReading(astronaut_id=astro.id, indicator=ind, value=v, value2=v2, status=status,
                                recorded_at=morning + timedelta(minutes=random.randint(0, 50))))

        # Quests: most days, with some misses
        for task in K.TASKS:
            chance = 0.85 if task["category"] in ("fitness", "monitoring") else 0.65
            if decline and task["category"] == "mind":
                chance = 0.35
            if d == DAYS - 1:
                chance = 0.3  # today: leave quests for the user to tick
            if random.random() < chance:
                db.add(TaskCompletion(astronaut_id=astro.id, task_key=task["key"], xp=task["xp"],
                                      completed_on=(start + timedelta(days=d))))
    return astro


def main():
    reset = "--reset" in sys.argv
    if reset:
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        from app.photos import AVATAR_DIR
        for f in AVATAR_DIR.glob("*"):
            f.unlink(missing_ok=True)   # old profile photos belonged to the deleted crew
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for c in CREW:
            pin = c["pin"]
            a = build(db, dict(c))
            print(f"  + {a.name} ({a.call_sign}) - {a.environment} - PIN {pin}")
        db.commit()
        ensure_default_admin(db)
        n = db.query(VitalReading).count()
    print(f"Done. {n} readings in the database.")


if __name__ == "__main__":
    main()
