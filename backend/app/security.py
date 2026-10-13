"""Password hashing, signed bearer tokens and role-based access dependencies (stdlib only)."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
TOKEN_TTL_SECONDS = 12 * 3600
_ITERATIONS = 100_000
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()
    return hmac.compare_digest(check, digest)


def _sign(payload: bytes) -> str:
    return hmac.new(SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()


def make_token(user_id: int, now: Optional[float] = None) -> str:
    body = json.dumps({"uid": user_id, "exp": int((now or time.time()) + TOKEN_TTL_SECONDS)}).encode()
    return f"{base64.urlsafe_b64encode(body).decode()}.{_sign(body)}"


def read_token(token: str, now: Optional[float] = None) -> Optional[int]:
    try:
        b64, sig = token.split(".")
        body = base64.urlsafe_b64decode(b64.encode())
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        data = json.loads(body)
        return data["uid"] if data["exp"] > (now or time.time()) else None
    except Exception:
        return None


def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
                 db: Session = Depends(get_db)) -> models.User:
    uid = read_token(creds.credentials) if creds else None
    user = db.get(models.User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Please sign in")
    return user


def _require(role: str):
    def dep(user: models.User = Depends(current_user)) -> models.User:
        if user.role != role:
            raise HTTPException(403, f"This area is for {role}s only")
        return user
    return dep


require_patient = _require("patient")
require_clinician = _require("clinician")
