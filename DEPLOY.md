# Deployment — Cloudflare Pages + Fly.io

End-to-end playbook for getting the Oil Dashboard onto the public internet.
Architecture:

```
┌──────────────────────────┐      ┌─────────────────────────────┐
│  Cloudflare Pages        │ ───▶ │  Fly.io (backend)           │
│  React / Vite static     │      │  FastAPI + SQLite + FRED    │
│  free tier, custom domain│      │  ~$2–5/mo, always-on        │
└──────────────────────────┘      └─────────────────────────────┘
```

You'll need accounts on:
- [Cloudflare](https://dash.cloudflare.com) (free)
- [Fly.io](https://fly.io) (adds a credit card; tiny apps stay under ~$5/mo)

And one CLI:
- `flyctl` — install via `iwr https://fly.io/install.ps1 -useb | iex` on Windows
  (or `brew install flyctl` on macOS). After install, run `fly auth signup` or
  `fly auth login`.

---

## Step 1 — deploy the backend to Fly.io

All commands from `backend/`:

```powershell
cd backend
fly launch --copy-config --no-deploy
```

When prompted:
- App name: pick something like `oil-dashboard-api` (must be globally unique on Fly).
- Region: `iad` (US East) is the default and a good choice.
- Postgres / Redis: **No** — this app uses SQLite only.
- Deploy now: **No** — we need to create the volume and secrets first.

`fly launch` will fill the `app = ""` line in `fly.toml`. Commit that change.

### Create the persistent volume

```powershell
fly volumes create oil_cache --region iad --size 1
```

1GB is plenty. The SQLite cache + Polymarket JSON together are under 50MB.

### Set secrets

```powershell
fly secrets set `
    FRED_API_KEY=your_fred_api_key_here `
    ADMIN_SECRET=$(powershell -c "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')") `
    ALLOWED_ORIGINS=https://oil-dashboard.pages.dev
```

Replace `oil-dashboard.pages.dev` with whatever Cloudflare assigns in Step 2.
If you add a custom domain later, update `ALLOWED_ORIGINS` to include both:
`https://oil-dashboard.pages.dev,https://yourdomain.com`.

`ADMIN_SECRET` is optional — unset means remote admin endpoints stay locked
to localhost only. Set it if you want to be able to rotate the FRED key or
force-refresh Polymarket from your laptop without SSH'ing into the VM.

### Deploy

```powershell
fly deploy
```

First build takes 3–5 minutes (numpy/scipy wheels are chunky). Subsequent
deploys cache the Python layer and take ~30 seconds.

When it finishes, verify:

```powershell
fly status
fly logs
curl https://oil-dashboard-api.fly.dev/api/health
# -> {"status":"ok","version":"1.0.0"}
```

---

## Step 2 — deploy the frontend to Cloudflare Pages

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages) →
   **Create a project** → **Connect to Git** → authorize the
   `oil-tracking-dashboard` repo.

2. Build config:
   - **Framework preset:** Vite
   - **Build command:** `cd frontend && npm ci && npm run build`
   - **Build output directory:** `frontend/dist`
   - **Root directory:** leave blank (repo root)
   - **Node version:** set in Pages env vars: `NODE_VERSION = 20`

3. Environment variables (Production):
   - `VITE_API_URL = https://oil-dashboard-api.fly.dev` (your Fly URL from Step 1)

4. **Save and deploy.** First build takes ~2 minutes.

Once the Pages URL exists (`oil-dashboard.pages.dev` or similar), go back to
Fly and update the CORS origin if you didn't get it right the first time:

```powershell
fly secrets set ALLOWED_ORIGINS=https://oil-dashboard.pages.dev
```

---

## Step 3 — verify end-to-end

Open your Pages URL. The hero should fetch the WTI price from your Fly
backend. In the browser Network tab, confirm the `/api/prices/summary`
request goes to `https://oil-dashboard-api.fly.dev` and returns 200.

If you see CORS errors, double-check `ALLOWED_ORIGINS` on Fly matches the
exact Pages origin (scheme included, no trailing slash).

---

## Step 4 — (optional) custom domain

On **Cloudflare Pages** → your project → **Custom domains** → **Set up a
custom domain**. If the domain is already on Cloudflare, it's one click.

Then update Fly CORS:

```powershell
fly secrets set ALLOWED_ORIGINS=https://oil-dashboard.pages.dev,https://yourdomain.com
```

The Fly backend doesn't need a custom domain — it's only called via JS from
the Pages origin, so `oil-dashboard-api.fly.dev` is fine.

---

## Ongoing cost & behavior

- **Cloudflare Pages:** free tier covers up to 500 builds/month and unlimited
  bandwidth. You will not come close.
- **Fly.io:** `shared-cpu-1x` with 256MB = free allowance covers ~$0–$2/mo for
  a single always-stopped machine. With `auto_stop_machines = "stop"` (the
  default in our `fly.toml`), the VM suspends after a few minutes of
  inactivity and cold-starts on the next request (~2–3s). If you want zero
  cold starts, change `min_machines_running = 1` in `fly.toml` — adds ~$2/mo.
- **Persistent volume:** 1GB volume is ~$0.15/mo.

Total realistic cost: **$2–5/mo** depending on always-on vs stop-when-idle.

---

## Redeploys

- **Frontend:** `git push` to `main` → Cloudflare Pages auto-deploys.
- **Backend:** `cd backend && fly deploy` from your machine, or wire up a
  GitHub Action if you want push-to-deploy there too.

---

## Troubleshooting

**"FRED_API_KEY is not set"** in Fly logs: you forgot to run
`fly secrets set FRED_API_KEY=...`. Check with `fly secrets list`.

**CORS errors in browser:** `ALLOWED_ORIGINS` doesn't match the Pages
origin. Run `fly secrets list | grep ALLOWED_ORIGINS` and fix it.

**Cold-start timeouts on first request:** expected with
`min_machines_running = 0`. The frontend's 10s fetch timeout may fire on the
very first hit. Either bump to 1 machine always-on, or accept that the first
request after long idle takes a beat.

**Volume isn't persisting:** confirm in `fly.toml` that `[[mounts]] source`
matches the volume name you created. `fly volumes list` shows what exists.

**Build fails on numpy/scipy:** Fly's builder should have the wheels; if not,
the `builder` stage in the Dockerfile installs `build-essential` to build
from source.
