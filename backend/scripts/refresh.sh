#!/usr/bin/env bash
# Refresh the site's data and publish it. Run this after an event that moves
# the numbers -- a strike, a ceasefire, a jobs print, a tariff ruling.
#
#   bash backend/scripts/refresh.sh          # refresh, build, deploy, commit
#   bash backend/scripts/refresh.sh --dry    # refresh and build, publish nothing
#
# On Windows use refresh.ps1 instead: PowerShell there resolves `bash` to WSL's
# bash.exe, which has no distribution installed, so this file never runs.
#
# There is no schedule. The GitHub workflow does the same steps and is
# dispatch-only; this is the local equivalent so a refresh does not require the
# Actions tab.
#
# Needs FRED_API_KEY and EIA_API_KEY in backend/.env, and wrangler logged in.
set -euo pipefail

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

cd "$(dirname "$0")/../.."
ROOT="$PWD"

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Rebuilding the snapshot from FRED, EIA, Treasury and IMF PortWatch"
(cd backend && py scripts/build_snapshot.py)

# The gate. A failed upstream should leave the previous deploy live rather than
# publish a page full of dashes.
step "Validating"
(cd backend && py scripts/validate_snapshot.py ../frontend/public/data-snapshot.json)

step "Cutting the V5 data files"
(cd backend && py scripts/build_v5_data.py)

step "Tests"
(cd backend && py -m pytest tests -q)
(cd frontend && npm test --if-present)

step "Building"
(cd frontend && npm run build)

if [[ $DRY == 1 ]]; then
  printf '\n\033[1m--dry: built but not published.\033[0m Preview with:\n'
  printf '  cd frontend && npx vite preview --port 4173\n'
  exit 0
fi

# Two projects serve the same V5 build: the original URL, which readers may
# already have, and the dedicated one. V4 is a separate frozen project and is
# deliberately not touched here.
step "Deploying to Cloudflare Pages"
for project in trumps-economy-the-bill trumps-economy-ledger; do
  echo "  -> $project"
  npx --prefix frontend wrangler pages deploy frontend/dist \
    --project-name "$project" --branch main --commit-dirty=true
done

step "Committing the refreshed data"
git add frontend/public/data-snapshot.json frontend/public/v5 \
        frontend/public/og.png frontend/public/og.html
if git diff --cached --quiet; then
  echo "data unchanged, nothing to commit"
else
  git commit -m "data: refresh $(date -u +%F)"
  git push
fi

printf '\n\033[1mLive:\033[0m https://trumps-economy-the-bill.pages.dev\n'
printf '       https://trumps-economy-ledger.pages.dev\n'
