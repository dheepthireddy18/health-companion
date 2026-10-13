from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m, schemas as s
from ..database import get_db
from ..security import current_user, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: s.LoginIn, db: Session = Depends(get_db)):
    user = db.scalars(select(m.User).where(m.User.email == body.email.strip().lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"token": make_token(user.id), "user": s.UserOut.model_validate(user)}


@router.get("/me", response_model=s.UserOut)
def me(user: m.User = Depends(current_user)):
    return user


@router.patch("/me", response_model=s.UserOut)
def update_me(body: s.SettingsIn, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != "patient":
        raise HTTPException(403, "Only patients have settings")
    for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    return user
