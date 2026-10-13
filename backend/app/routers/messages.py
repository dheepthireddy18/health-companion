"""Chat between a patient and their care team."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m, schemas as s
from ..database import get_db
from ..security import require_patient

router = APIRouter(prefix="/api/messages", tags=["messages"])


def thread(db: Session, patient_id: int) -> list:
    rows = db.execute(select(m.Message, m.User).join(m.User, m.User.id == m.Message.sender_id)
                      .where(m.Message.patient_id == patient_id).order_by(m.Message.id)).all()
    return [s.MessageOut(id=msg.id, from_role=u.role, sender=u.name, body=msg.body, created_at=msg.created_at)
            for msg, u in rows]


def post(db: Session, patient_id: int, sender: m.User, body: str) -> s.MessageOut:
    msg = m.Message(patient_id=patient_id, sender_id=sender.id, body=body.strip())
    db.add(msg)
    db.commit()
    return s.MessageOut(id=msg.id, from_role=sender.role, sender=sender.name, body=msg.body, created_at=msg.created_at)


@router.get("", response_model=list[s.MessageOut])
def my_thread(user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    return thread(db, user.id)


@router.post("", response_model=s.MessageOut, status_code=201)
def send(body: s.MessageIn, user: m.User = Depends(require_patient), db: Session = Depends(get_db)):
    return post(db, user.id, user, body.body)
