"""Sign in with Google: the browser gets an ID token from Google Identity Services; we verify it with Google.

Set GOOGLE_CLIENT_ID (an OAuth "Web application" client whose authorized JavaScript origin is the site, e.g.
http://localhost:3000). Without it the Google button is shown as unavailable.
"""
import json
import os
import urllib.parse
import urllib.request
from typing import Callable, Optional

TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token="
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def client_id() -> Optional[str]:
    return os.getenv("GOOGLE_CLIENT_ID") or None


def _fetch_claims(credential: str) -> dict:
    with urllib.request.urlopen(TOKENINFO + urllib.parse.quote(credential), timeout=10) as r:
        return json.load(r)


# Replaced in tests to avoid network calls.
fetch_claims: Callable[[str], dict] = _fetch_claims


def verify(credential: str) -> Optional[dict]:
    """Google checks signature and expiry; we check it was issued for this site to a verified address."""
    cid = client_id()
    if not cid:
        return None
    try:
        claims = fetch_claims(credential)
    except Exception:
        return None
    verified = str(claims.get("email_verified", "")).lower() == "true"
    if claims.get("aud") != cid or claims.get("iss") not in ISSUERS or not verified or not claims.get("email"):
        return None
    return claims
