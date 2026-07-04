from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return digest.hex()


def verify_password(password: str, salt: str, hashed_password: str) -> bool:
    computed = hash_password(password, salt)
    return hmac.compare_digest(computed, hashed_password)


def create_access_token() -> str:
    return secrets.token_urlsafe(32)
