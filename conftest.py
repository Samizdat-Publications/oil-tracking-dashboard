"""Make the backend importable so `pytest` works from the repo root too.

The backend uses absolute imports (`from services import ...`) because uvicorn
runs with `backend/` as the working directory. Without this, `pytest backend/`
from the repo root fails at collection while `cd backend && pytest` succeeds --
a difference that would eventually bite CI.
"""

import sys
from pathlib import Path

BACKEND = Path(__file__).parent / "backend"
if BACKEND.is_dir() and str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
