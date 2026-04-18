"""Shared FastAPI dependencies."""

from __future__ import annotations

import os

from fastapi import HTTPException, Request


def _admin_secret() -> str:
    return os.getenv("ADMIN_SECRET", "").strip()


async def verify_localhost(request: Request) -> None:
    """Allow the request only from localhost, or when a valid admin bearer is set.

    Used to guard endpoints that can trigger expensive upstream fetches or
    mutate configuration. Remote access is denied unless ADMIN_SECRET is
    configured AND the caller presents it as a bearer token.
    """
    host = request.client.host if request.client else ""
    if host in ("127.0.0.1", "::1", "localhost"):
        return

    secret = _admin_secret()
    auth = request.headers.get("Authorization", "")
    if not secret or auth != f"Bearer {secret}":
        raise HTTPException(status_code=403, detail="Access restricted to localhost")
