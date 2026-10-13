"""Private chats: each conversation is between one patient and one clinician, and only those two can read it."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import care_team, models as m, schemas as s
from ..database import get_db
from ..security import require_patient

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _out(msg: m.Message, sender: m.User) -> s.MessageOut:
    return s.MessageOut(id=msg.id, clinician_id=msg.clinician_id, from_role=sender.role, sender=sender.name,
                        body=msg.body, created_at=msg.created_at)


def thread(db: Session, patient_id: int, clinician_id: Optional[int] = None) -> list:
    """One patient's messages, oldest first; limited to one clinician's conversation when clinician_id is given."""
    q = (select(m.Message, m.User).join(m.User, m.User.id == m.Message.sender_id)
         .where(m.Message.patient_id == patient_id))
    if clinician_id is not None:
        q = q.where(m.Message.clinician_id == clinician_id)
    return [_out(msg, u) for msg, u in db.execute(q.order_by(m.Message.id)).all()]


def post(db: Session, patient_id: int, clinician_id: int, sender: m.User, body: str) -> s.MessageOut:
    msg = m.Message(patient_id=patient_id, clinician_id=clinician_id, sender_id=sender.id, body=body.strip())
    db.add(msg)
    db.commit()
    return _out(msg, sender)


def contacts(db: Session, patient: m.User) -> set:
    """Clinicians a patient may write to: their own doctor, on-call cover, and anyone who has written to them."""
    ids = {c.id for c in care_team.on_call_cover(db)}
    if patient.clinician_id:
        ids.add(patient.clinician_id)
    ids.update(db.scalars(select(m.Message.clinician_id).where(m.Message.patient_id == patient.id,
                                                              m.Message.clinician_id.is_not(None))))
    return ids


def backfill(db: Session) -> None:
    """Messages from before conversations were private have no clinician: a clinician's message belongs to its
    sender; a patient's message to the clinician who wrote most recently before it (else their own doctor)."""
    last_doc: dict = {}
    changed = False
    for msg, sender in db.execute(select(m.Message, m.User).join(m.User, m.User.id == m.Message.sender_id)
                                  .order_by(m.Message.id)).all():
        if sender.role == "clinician":
            last_doc[msg.patient_id] = sender.id
        if msg.clinician_id is None:
            changed = True
            if sender.role == "clinician":
                msg.clinician_id = sender.id
            else:
                patient = db.get(m.User, msg.patient_id)
                msg.clinician_id = last_doc.get(msg.patient_id) or (patient.clinician_id if patient else None)
    if changed:
        db.commit()


@router.get("", response_model=list[s.MessageOut])
def my_messages(user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    """All of this patient's conversations; each message says which clinician it is with."""
    return thread(db, user.id)


@router.post("", response_model=s.MessageOut, status_code=201)
def send(body: s.MessageIn, user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    to = body.clinician_id or user.clinician_id
    if not to:
        raise HTTPException(422, "Choose a doctor to message")
    if to not in contacts(db, user):
        raise HTTPException(403, "You can message your own doctor, the on-call doctor, or a doctor who has written to you")
    return post(db, user.id, to, user, body.body)
