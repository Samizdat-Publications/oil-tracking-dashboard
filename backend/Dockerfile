# syntax=docker/dockerfile:1.7

# ---- builder: install Python deps with build toolchain available --------------
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

# numpy/scipy wheels only need this if the index lacks a prebuilt wheel for
# this platform; harmless to include and keeps the build resilient.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /install
COPY requirements.txt .
RUN pip install --prefix=/install/prefix -r requirements.txt

# ---- runtime: lean image with only site-packages + app ------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Fly mounts the persistent volume at /data; point the cache there so it
    # survives deploys/restarts. Overridable at runtime.
    CACHE_DB_PATH=/data/cache.db \
    POLYMARKET_DATA_PATH=/data/polymarket_latest.json

# Copy the installed packages from the builder stage
COPY --from=builder /install/prefix /usr/local

WORKDIR /app
COPY . /app

# Fly volume will be mounted at /data at runtime. Create it so the path exists
# even on first boot before the volume initializes.
RUN mkdir -p /data

EXPOSE 8000

# --proxy-headers because Fly terminates TLS and forwards X-Forwarded-* headers.
# Single worker is plenty for this traffic profile; SQLite + in-memory caches
# assume single-process anyway.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
