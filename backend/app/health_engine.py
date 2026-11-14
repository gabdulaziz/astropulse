"""
The health engine: turns raw measurements into a colour-coded status, a health score,
alerts, guidance and a measurement routine.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import knowledge as K
from .models import Astronaut, HealthImage, TaskCompletion, VitalReading


# ---------------------------------------------------------------- evaluation
def _band(value: float, nominal: tuple, caution: tuple) -> str:
    if nominal[0] <= value <= nominal[1]:
        return "nominal"
    if caution[0] <= value <= caution[1]:
        return "caution"
    return "critical"


def worst(*statuses: str) -> str:
    return max(statuses, key=lambda s: K.STATUS_ORDER.get(s, -1))


def evaluate(indicator: str, value: float, value2: float | None = None, baseline: float | None = None) -> str:
    """Return 'nominal' | 'caution' | 'critical' for one measurement."""
    spec = K.INDICATORS[indicator]
    if spec.get("relative"):
        if not baseline:
            return "nominal"
        value = (value - baseline) / baseline * 100.0  # percent change from baseline
    status = _band(value, spec["nominal"], spec["caution"])
    if indicator == "blood_pressure" and value2 is not None:
        status = worst(status, _band(value2, spec["nominal2"], spec["caution2"]))
    return status


def mass_baseline(db: Session, astro: Astronaut) -> float | None:
    if astro.baseline_mass_kg:
        return astro.baseline_mass_kg
    first = db.scalar(
        select(VitalReading.value)
        .where(VitalReading.astronaut_id == astro.id, VitalReading.indicator == "body_mass")
        .order_by(VitalReading.recorded_at.asc())
        .limit(1)
    )
    return first


# ---------------------------------------------------------------- assessment
STATUS_PENALTY = {"nominal": 0, "caution": 9, "critical": 22}
# Not every indicator matters equally for an "at a glance" score
WEIGHT = {"heart_rate": 1.0, "blood_pressure": 1.1, "spo2": 1.2, "body_temperature": 1.0, "blood_glucose": 0.9,
          "sleep_hours": 0.9, "mood": 0.9, "body_mass": 0.7, "radiation_dose": 0.8}


def _trend(values: list[float]) -> str:
    """Compare the latest value with the average of the previous ones."""
    if len(values) < 3:
        return "steady"
    latest, prev = values[0], values[1:8]
    avg = sum(prev) / len(prev)
    if avg == 0:
        return "steady"
    change = (latest - avg) / abs(avg)
    if change > 0.05:
        return "up"
    if change < -0.05:
        return "down"
    return "steady"


def assessment(db: Session, astro: Astronaut) -> dict:
    env = K.ENVIRONMENTS.get(astro.environment, K.ENVIRONMENTS["station"])
    now = datetime.now(timezone.utc)
    baseline = mass_baseline(db, astro)

    indicators = []
    alerts = []
    score = 100.0
    for key, spec in K.INDICATORS.items():
        rows = db.scalars(
            select(VitalReading)
            .where(VitalReading.astronaut_id == astro.id, VitalReading.indicator == key)
            .order_by(VitalReading.recorded_at.desc())
            .limit(14)
        ).all()
        latest = rows[0] if rows else None
        status = latest.status if latest else "unknown"
        hours_since = (now - latest.recorded_at).total_seconds() / 3600 if latest else None
        overdue = latest is None or hours_since > spec["schedule_hours"]
        stale = latest is not None and hours_since > spec["schedule_hours"] * 3

        if latest and not stale:
            score -= STATUS_PENALTY[status] * WEIGHT.get(key, 1)

        item = {
            "key": key,
            "name": spec["name"],
            "short": spec["short"],
            "unit": spec["unit"],
            "icon": spec["icon"],
            "status": status,
            "value": latest.value if latest else None,
            "value2": latest.value2 if latest else None,
            "recorded_at": latest.recorded_at.isoformat() if latest else None,
            "trend": _trend([r.value for r in rows]),
            "spark": [r.value for r in reversed(rows)],
            "overdue": overdue,
            "actions": spec["actions"].get(status, []),
        }
        if key == "body_mass" and latest and baseline:
            item["change_pct"] = round((latest.value - baseline) / baseline * 100, 1)
        indicators.append(item)

        if latest and not stale and status in ("caution", "critical"):
            alerts.append(_make_alert(key, spec, status, latest, env))

    # Cumulative radiation for the mission and career
    mission_dose = db.scalar(
        select(func.coalesce(func.sum(VitalReading.value), 0.0)).where(
            VitalReading.astronaut_id == astro.id, VitalReading.indicator == "radiation_dose"
        )
    ) or 0.0
    career = (astro.prior_career_dose_msv or 0) + mission_dose
    career_pct = career / K.CAREER_DOSE_LIMIT_MSV * 100
    if career_pct >= 80:
        alerts.append({"indicator": "radiation_dose", "level": "critical",
                       "title": "Career radiation dose above 80% of the limit",
                       "message": f"{career:.0f} of {K.CAREER_DOSE_LIMIT_MSV:.0f} mSv used. Discuss mission planning with the flight surgeon.",
                       "escalate": True})
    elif career_pct >= 50:
        alerts.append({"indicator": "radiation_dose", "level": "caution",
                       "title": "Career radiation dose above 50% of the limit",
                       "message": f"{career:.0f} of {K.CAREER_DOSE_LIMIT_MSV:.0f} mSv used. Prefer shielded areas for sleep.",
                       "escalate": False})

    score = max(0, min(100, round(score)))
    if any(a["level"] == "critical" for a in alerts):
        overall = "critical"
    elif alerts:
        overall = "caution"
    else:
        overall = "nominal"

    alerts.sort(key=lambda a: -K.STATUS_ORDER[a["level"]])
    mission_day = (date.today() - astro.mission_start).days + 1 if astro.mission_start else 1

    return {
        "astronaut_id": astro.id,
        "score": score,
        "overall": overall,
        "summary": _summary(overall, alerts, env),
        "mission_day": max(1, mission_day),
        "environment": {"key": astro.environment, **env},
        "indicators": indicators,
        "alerts": alerts,
        "radiation": {
            "mission_msv": round(mission_dose, 2),
            "career_msv": round(career, 1),
            "limit_msv": K.CAREER_DOSE_LIMIT_MSV,
            "career_pct": round(career_pct, 1),
        },
        "body_status": body_status(indicators),
    }


def _make_alert(key, spec, status, reading, env) -> dict:
    val = f"{reading.value:g}" + (f"/{reading.value2:g}" if reading.value2 is not None else "")
    escalate = status == "critical"
    msg = f"Latest {spec['short'].lower()}: {val} {spec['unit']}. "
    if escalate:
        if env.get("comm_delay_s", 0) > 300:
            msg += (f"Communication delay is {env['comm_delay']}: follow the actions below now, "
                    "then send a report to the flight surgeon.")
        else:
            msg += "Follow the actions below and contact the flight surgeon."
    else:
        msg += "Follow the actions below and re-measure."
    return {
        "indicator": key,
        "level": status,
        "title": f"{spec['name']} {'critical' if escalate else 'needs attention'}",
        "message": msg,
        "actions": spec["actions"][status],
        "escalate": escalate,
    }


def _summary(overall: str, alerts: list, env: dict) -> str:
    if overall == "nominal":
        return "All systems nominal. Keep up your routine."
    if overall == "caution":
        return f"{len(alerts)} indicator(s) need attention. Review the guidance and re-measure."
    if env.get("comm_delay_s", 0) > 300:
        return "Critical reading detected. Act on the checklist now; ground support is minutes away."
    return "Critical reading detected. Follow the checklist and contact your flight surgeon."


def body_status(indicators: list[dict]) -> dict:
    """Worst status of the indicators linked to each body system (for colouring the body figure)."""
    by_key = {i["key"]: i["status"] for i in indicators}
    result = {}
    for system in K.BODY_SYSTEMS:
        statuses = [by_key.get(k, "unknown") for k in system["indicators"]]
        known = [s for s in statuses if s != "unknown"]
        result[system["key"]] = worst(*known) if known else "unknown"
    return result


# ---------------------------------------------------------------- routine
def routine(db: Session, astro: Astronaut) -> list[dict]:
    """Which measurements are due, with how many hours until due (negative = overdue)."""
    now = datetime.now(timezone.utc)
    out = []
    for key, spec in K.INDICATORS.items():
        last = db.scalar(
            select(func.max(VitalReading.recorded_at)).where(
                VitalReading.astronaut_id == astro.id, VitalReading.indicator == key
            )
        )
        if last is None:
            due_in = -1.0
        else:
            due_in = spec["schedule_hours"] - (now - last).total_seconds() / 3600
        out.append({
            "indicator": key, "name": spec["name"], "icon": spec["icon"],
            "every_hours": spec["schedule_hours"],
            "last": last.isoformat() if last else None,
            "due_in_hours": round(due_in, 1),
            "due": due_in <= 0,
        })
    out.sort(key=lambda r: r["due_in_hours"])
    return out


# ---------------------------------------------------------------- gamification
def checkin_streak(db: Session, astro_id: int) -> int:
    days = set(
        d.date() if isinstance(d, datetime) else d
        for d in db.scalars(
            select(func.date(VitalReading.recorded_at)).where(VitalReading.astronaut_id == astro_id).distinct()
        ).all()
    )
    streak, day = 0, date.today()
    if day not in days:  # today not done yet: streak still counts from yesterday
        day -= timedelta(days=1)
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def progress(db: Session, astro: Astronaut) -> dict:
    readings = db.scalar(select(func.count()).where(VitalReading.astronaut_id == astro.id)) or 0
    task_xp = db.scalar(
        select(func.coalesce(func.sum(TaskCompletion.xp), 0)).where(TaskCompletion.astronaut_id == astro.id)
    ) or 0
    xp = int(task_xp + readings * K.XP_PER_READING)
    level = xp // K.XP_PER_LEVEL + 1
    rank = K.RANKS[min(level - 1, len(K.RANKS) - 1)]
    streak = checkin_streak(db, astro.id)

    def task_count(key):
        return db.scalar(select(func.count()).where(
            TaskCompletion.astronaut_id == astro.id, TaskCompletion.task_key == key)) or 0

    logged = set(db.scalars(select(VitalReading.indicator).where(
        VitalReading.astronaut_id == astro.id).distinct()).all())
    good_sleep = db.scalar(select(func.count()).where(
        VitalReading.astronaut_id == astro.id, VitalReading.indicator == "sleep_hours",
        VitalReading.status == "nominal")) or 0

    earned = {
        "first_contact": readings >= 1,
        "streak_3": streak >= 3,
        "streak_7": streak >= 7,
        "streak_30": streak >= 30,
        "full_spectrum": set(K.INDICATORS).issubset(logged),
        "iron_astronaut": task_count("exercise_resistance") >= 10,
        "hydration_hero": task_count("hydrate") >= 14,
        "sleep_master": good_sleep >= 7,
        "data_scientist": readings >= 100,
        "commander": level >= 5,
    }
    today_done = set(db.scalars(select(TaskCompletion.task_key).where(
        TaskCompletion.astronaut_id == astro.id, TaskCompletion.completed_on == date.today())).all())

    return {
        "xp": xp,
        "level": level,
        "rank": rank,
        "xp_into_level": xp % K.XP_PER_LEVEL,
        "xp_per_level": K.XP_PER_LEVEL,
        "streak": streak,
        "readings": readings,
        "badges": [{**b, "earned": earned.get(b["key"], False)} for b in K.BADGES],
        "tasks": [{**t, "done": t["key"] in today_done} for t in K.TASKS],
        "images": db.scalar(select(func.count()).where(HealthImage.astronaut_id == astro.id)) or 0,
    }
