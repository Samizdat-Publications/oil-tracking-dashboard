"""Keep API keys out of anything the build writes.

A failed request's error text includes its URL, and FRED and EIA take the key
as a query parameter, so an error recorded in the snapshot published the FRED
key on the live site and in the public repo (found 2026-11-05). Every string
the snapshot carries passes through scrub() before it is written, and
validate_snapshot.py refuses a snapshot that still holds a key.
"""
from __future__ import annotations

import os
import re

# api_key=..., apikey=..., access_token=..., token=..., key=... in any URL or message
_PARAM = re.compile(r"(?i)\b(api_key|apikey|api-key|access_token|token|key)=([^&\s\"'\<>]+)")


_ENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def secrets() -> list[str]:
    """The keys this machine or CI actually holds (environment, or backend/.env),
    so a bare key with no "api_key=" in front of it is caught too."""
    vals = {n: os.getenv(n) for n in ("FRED_API_KEY", "EIA_API_KEY")}
    try:
        with open(_ENV, encoding="utf-8") as fh:
            for line in fh:
                n, _, v = line.strip().partition("=")
                if n in vals and not vals[n]:
                    vals[n] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return [v.strip() for v in vals.values() if v and len(v.strip()) >= 8]


def scrub(text: str) -> str:
    text = _PARAM.sub(lambda m: m.group(1) + "=REDACTED", text)
    for s in secrets():
        text = text.replace(s, "REDACTED")
    return text


def leaks(text: str) -> list[str]:
    """What in `text` still looks like a key; empty when clean."""
    found = ["%s=%s..." % (m.group(1), m.group(2)[:4]) for m in _PARAM.finditer(text)
             if m.group(2) != "REDACTED"]
    found += ["a configured API key (%s...)" % s[:4] for s in secrets() if s in text]
    return found
