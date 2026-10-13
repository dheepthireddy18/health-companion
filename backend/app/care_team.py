"""Who looks after whom: choosing a doctor, availability, and on-call cover when a patient's doctor is away."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m


def is_available(c: m.User) -> bool:
    return c.available is not False  # unset counts as available (accounts created before the setting existed)


def is_on_call(c: m.User) -> bool:
    return bool(c.on_call) and is_available(c)


def clinicians(db: Session) -> list:
    return list(db.scalars(select(m.User).where(m.User.role == "clinician").order_by(m.User.name)))


def patient_counts(db: Session) -> dict:
    return dict(db.execute(select(m.User.clinician_id, func.count()).where(m.User.role == "patient")
                           .group_by(m.User.clinician_id)).all())


def auto_assign(db: Session) -> Optional[int]:
    """The available clinician with the fewest patients (any clinician if nobody is available)."""
    docs = clinicians(db)
    pool = [c for c in docs if is_available(c)] or docs
    if not pool:
        return None
    counts = patient_counts(db)
    return min(pool, key=lambda c: (counts.get(c.id, 0), c.id)).id


def resolve_choice(db: Session, clinician_id: Optional[int]) -> Optional[int]:
    """A patient's choice: 0 or None means 'any available doctor'. Choosing an away doctor is allowed."""
    if not clinician_id:
        return auto_assign(db)
    doc = db.get(m.User, clinician_id)
    if not doc or doc.role != "clinician":
        raise HTTPException(422, "That doctor could not be found")
    return doc.id


def on_call_cover(db: Session, exclude_id: Optional[int] = None) -> list:
    return [c for c in clinicians(db) if is_on_call(c) and c.id != exclude_id]
