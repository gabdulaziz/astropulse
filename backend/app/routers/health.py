"""Assessment, routine, quests (gamification) and reference knowledge."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import knowledge as K
from ..database import get_db
from ..health_engine import assessment, progress, routine
from ..models import TaskCompletion
from ..schemas import TaskToggle
from ..security import Principal, current_user, ensure_can_read
from .astronauts import get_astronaut_or_404

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/assessment/{astronaut_id}")
def get_assessment(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Full health picture: score, colour-coded indicators, alerts with actions, body map status."""
    ensure_can_read(db, user, astronaut_id)
    return assessment(db, get_astronaut_or_404(db, astronaut_id))


@router.get("/routine/{astronaut_id}")
def get_routine(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Which measurements are due now (the mission routine prompts)."""
    ensure_can_read(db, user, astronaut_id)
    return routine(db, get_astronaut_or_404(db, astronaut_id))


@router.get("/progress/{astronaut_id}")
def get_progress(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """XP, level, rank, streak, badges and today's quests."""
    ensure_can_read(db, user, astronaut_id)
    return progress(db, get_astronaut_or_404(db, astronaut_id))


@router.post("/tasks/toggle")
def toggle_task(body: TaskToggle, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Mark a quest done for today, or undo it. Only the astronaut themself can tick their quests."""
    if user.is_admin or user.id != body.astronaut_id:
        raise HTTPException(403, "Only the astronaut can tick their own quests")
    astro = get_astronaut_or_404(db, body.astronaut_id)
    task = K.TASKS_BY_KEY.get(body.task_key)
    if not task:
        raise HTTPException(404, "Unknown task")
    existing = db.scalar(select(TaskCompletion).where(
        TaskCompletion.astronaut_id == astro.id, TaskCompletion.task_key == task["key"],
        TaskCompletion.completed_on == date.today()))
    if existing:
        db.execute(delete(TaskCompletion).where(TaskCompletion.id == existing.id))
        done = False
    else:
        db.add(TaskCompletion(astronaut_id=astro.id, task_key=task["key"], xp=task["xp"], completed_on=date.today()))
        done = True
    db.commit()
    return {"task_key": task["key"], "done": done, "progress": progress(db, astro)}


# ------------------------------------------------------------- reference data
@router.get("/knowledge/indicators")
def get_indicators():
    return [
        {"key": k, **{f: v for f, v in spec.items()}}
        for k, spec in K.INDICATORS.items()
    ]


@router.get("/knowledge/hazards")
def get_hazards():
    return K.HAZARDS


@router.get("/knowledge/body-systems")
def get_body_systems():
    return K.BODY_SYSTEMS


@router.get("/knowledge/environments")
def get_environments():
    return [{"key": k, **v} for k, v in K.ENVIRONMENTS.items()]


@router.get("/knowledge/risks")
def get_risks():
    """NASA's named spaceflight health risks and how AstroPulse covers each one."""
    return K.RISKS


@router.get("/knowledge/sources")
def get_sources():
    """Every source the app's health information relies on (official challenge resources first)."""
    return K.SOURCES
