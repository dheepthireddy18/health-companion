"""Reminders the browser turns into push notifications.

Medicine: a dose that is past due and not marked taken/skipped is announced, then again every 30 minutes,
until it is marked or the patient switches notifications off.
Login: once a day, a nudge about a missed check-in plus a personal suggestion.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import require_patient
from ..stats import checkin_days
from ..suggestions import personal_message

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
REPEAT_EVERY = timedelta(minutes=30)


def _should_send(db: Session, user_id: int, kind: str, key: str, now: datetime, every: Optional[timedelta]) -> bool:
    """Record and approve a send if it has never been sent, or `every` has elapsed."""
    row = db.scalars(select(m.NotificationLog).where(
        m.NotificationLog.user_id == user_id, m.NotificationLog.kind == kind, m.NotificationLog.key == key)).first()
    if row and (every is None or now - row.last_sent_at < every):
        return False
    if row:
        row.last_sent_at = now
    else:
        db.add(m.NotificationLog(user_id=user_id, kind=kind, key=key, last_sent_at=now))
    return True


@router.get("/due")
def due(now: Optional[datetime] = None, user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    now = now or datetime.now()
    if not user.notifications_enabled:
        return []
    today = now.date()
    done = {(l.medication_id, l.slot) for l in db.scalars(select(m.MedicationLog).where(
        m.MedicationLog.user_id == user.id, m.MedicationLog.day == today))}
    out = []
    for med in db.scalars(select(m.Medication).where(m.Medication.user_id == user.id, m.Medication.active)):
        for slot in med.times.split(","):
            hh, mm = map(int, slot.split(":"))
            if (med.id, slot) in done or now < datetime.combine(today, datetime.min.time()).replace(hour=hh, minute=mm):
                continue
            key = f"{med.id}|{today}|{slot}"
            first = not db.scalars(select(m.NotificationLog).where(
                m.NotificationLog.user_id == user.id, m.NotificationLog.kind == "medication",
                m.NotificationLog.key == key)).first()
            if _should_send(db, user.id, "medication", key, now, REPEAT_EVERY):
                out.append({"tag": key, "title": f"Time for {med.name}" if first else f"Reminder: {med.name} not taken yet",
                            "body": f"{med.dose or ''} due at {slot}. Open the app and tap Taken or Skip.".strip(),
                            "url": "/medicines"})
    db.commit()
    return out


@router.post("/welcome")
def welcome(now: Optional[datetime] = None, user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    """Called once after login. Returns a notification or null."""
    now = now or datetime.now()
    today = now.date()
    if not user.notifications_enabled:
        return None
    days = checkin_days(db, user.id)
    if today in days:
        return None
    if not _should_send(db, user.id, "welcome", str(today), now, None):
        return None
    db.commit()
    missed = (today - timedelta(days=1)) not in days
    title = "You missed yesterday's check-in" if missed else "Don't forget today's check-in"
    return {"tag": f"welcome|{today}", "title": title, "body": personal_message(db, user, today), "url": "/"}
