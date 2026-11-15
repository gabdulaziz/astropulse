"""
Fill the database with a demo crew and 30 days of realistic measurements.

    python seed.py          # add demo crew (keeps existing data)
    python seed.py --reset  # DELETE everything first, then add demo crew

Demo logins (team crew, simulated data): PINs 111111 to 666666 in the order below · Mission Control: see ADMIN_* in .env
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
    # Team crew for the demo. All health data below is SIMULATED (real astronaut medical data is private).
    # Each person's baseline_mass_kg is the value they gave; everything else is generated around it.
    dict(name="Abduvosit Khudoyberganov", call_sign="ORBIT", role="Flight Engineer", agency="ESA", environment="lunar_base",
         mission_name="Artemis Base Camp", baseline_mass_kg=65.0, pin="111111", prior_career_dose_msv=140, avatar_color="#22d3ee",
         # story: sleep and mood slowly decline (isolation) -> amber/red sleep and mood alerts
         profile=dict(hr=64, sys=118, dia=76, glu=94, temp=37.0, spo2=97, sleep=6.2, mood=3.9, mass_drift=-0.03,
                      dose=1.4, decline=True)),
    dict(name="Nizar Muhammad", call_sign="NOVA", role="Mission Specialist", agency="JAXA", environment="mars_base",
         mission_name="Ares Transit Habitat", baseline_mass_kg=64.0, pin="222222", prior_career_dose_msv=290, avatar_color="#f472b6",
         # story: long career in space -> radiation budget over 50% of NASA's limit; Mars comms delay
         profile=dict(hr=61, sys=112, dia=71, glu=86, temp=37.2, spo2=98, sleep=6.8, mood=4.3, mass_drift=-0.035,
                      dose=0.7)),
    dict(name="Muhammadyussuf Ibragimov", call_sign="FALCON", role="Commander", agency="NASA", environment="station",
         mission_name="Expedition 78", baseline_mass_kg=68.0, pin="333333", prior_career_dose_msv=60, avatar_color="#34d399",
         # story: healthy commander -> mostly green
         profile=dict(hr=58, sys=114, dia=72, glu=88, temp=36.9, spo2=98, sleep=7.4, mood=4.4, mass_drift=-0.01,
                      dose=0.7)),
    dict(name="Abdul-aziz Rashid", call_sign="ATLAS", role="Flight Surgeon", agency="CSA", environment="spacecraft",
         mission_name="Gateway Transit", baseline_mass_kg=70.0, pin="444444", prior_career_dose_msv=120, avatar_color="#fbbf24",
         # story: deep space, outside Earth's magnetic field -> high daily radiation
         profile=dict(hr=62, sys=116, dia=74, glu=90, temp=37.0, spo2=97, sleep=6.6, mood=4.1, mass_drift=-0.025,
                      dose=1.8, solar_event=4.6)),  # a solar particle event on the latest day -> amber radiation alert
    dict(name="Amir Osimov", call_sign="TITAN", role="Flight Engineer", agency="NASA", environment="rover",
         mission_name="Lunar Rover Traverse", baseline_mass_kg=72.0, pin="555555", prior_career_dose_msv=95, avatar_color="#fb923c",
         # story: blood pressure and heart rate slowly rising -> cardiovascular alerts
         profile=dict(hr=63, sys=124, dia=80, glu=98, temp=37.0, spo2=97, sleep=6.5, mood=4.0, mass_drift=-0.02,
                      dose=1.4, bp_rise=True)),
    dict(name="Umaiya Haruna", call_sign="AURORA", role="Mission Specialist", agency="ESA", environment="station",
         mission_name="Expedition 78", baseline_mass_kg=68.0, pin="666666", prior_career_dose_msv=45, avatar_color="#a78bfa",
         # story: eating less than needed -> body mass about 5% down (nutrition alert)
         profile=dict(hr=60, sys=110, dia=70, glu=82, temp=36.9, spo2=98, sleep=6.9, mood=4.2, mass_drift=-0.05,
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
        decline = p.get("decline", False)    # sleep + mood fall
        bp_rise = p.get("bp_rise", False)    # blood pressure + heart rate climb
        morning = day.replace(hour=7) if day.replace(hour=7) <= now else now - timedelta(hours=1)

        vals = {
            "heart_rate": (round(jitter(p["hr"] + (8 * t if (decline or bp_rise) else 0), 3)), None),
            "blood_pressure": (round(jitter(p["sys"] + (24 * t if bp_rise else 10 * t if decline else 0), 4)),
                               round(jitter(p["dia"] + (13 * t if bp_rise else 6 * t if decline else 0), 3))),
            "body_temperature": (round(jitter(p["temp"] + 0.3 * t, 0.15), 1), None),
            "spo2": (min(100, round(jitter(p["spo2"], 0.8))), None),
            "sleep_hours": (round(max(3, jitter(p["sleep"] - (1.4 * t if decline else 0), 0.5)) * 4) / 4, None),
            "mood": (max(1, min(5, round(jitter(p["mood"] - (1.6 * t if decline else 0), 0.5)))), None),
            "radiation_dose": (round(max(0.05, jitter(p["dose"], p["dose"] * 0.12)), 2), None),
        }
        if p.get("solar_event") and d == DAYS - 1:
            vals["radiation_dose"] = (p["solar_event"], None)
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
