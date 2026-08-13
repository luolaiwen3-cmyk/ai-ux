import base64
import hashlib
import hmac
import json
import time

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Cookie, HTTPException, status

from app.core.config import get_settings

COOKIE_NAME = "insightux_admin"
password_hasher = PasswordHasher()


def verify_password(password: str) -> bool:
    try:
        return password_hasher.verify(get_settings().admin_password_hash, password)
    except (VerifyMismatchError, ValueError):
        return False


def create_session_token(username: str) -> str:
    payload = {"sub": username, "exp": int(time.time()) + get_settings().session_ttl_seconds}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(get_settings().session_secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def require_admin(insightux_admin: str | None = Cookie(default=None)) -> str:
    if not insightux_admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        encoded, signature = insightux_admin.rsplit(".", 1)
        expected = hmac.new(get_settings().session_secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload.get("exp", 0) < time.time() or payload.get("sub") != get_settings().admin_username:
            raise ValueError
        return payload["sub"]
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from None
