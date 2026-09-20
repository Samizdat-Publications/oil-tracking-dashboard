# Refresh the site's data and publish it. Run this after an event that moves the
# numbers -- a strike, a ceasefire, a jobs print, a tariff ruling.
#
#   .\oil-dashboard\backend\scripts\refresh.ps1            refresh V5 and V4, publish both
#   .\oil-dashboard\backend\scripts\refresh.ps1 -SkipV4    V5 only
#   .\oil-dashboard\backend\scripts\refresh.ps1 -Dry       build everything, publish nothing
#
# Run it from anywhere: it locates the repo from its own path, so you do not have
# to be in oil-dashboard first.
#
# This is the Windows entry point and the one to use here. refresh.sh is the same
# sequence for Linux and is what a POSIX shell would run; on this machine
# PowerShell resolves `bash` to WSL's bash.exe, which has no distribution
# installed, so the .sh will not run.
#
# There is no schedule. The GitHub workflow does the same steps and is
# dispatch-only; this is the local equivalent.
#
# Needs FRED_API_KEY and EIA_API_KEY in oil-dashboard/backend/.env, and wrangler
# already logged in.

[CmdletBinding()]
param(
    [switch]$Dry,
    # V4 is a second branch, a second build and a second deploy. Skip it
    # when you only care about the current site.
    [switch]$SkipV4
)

$ErrorActionPreference = 'Stop'

# The repo root is two levels up from backend/scripts.
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

function Write-Step {
    param([string]$Text)
    Write-Host ''
    Write-Host "== $Text" -ForegroundColor Cyan
}

# PowerShell 5.1 has no && / ||, and a failing native exe does not stop the
# script on its own. Every external command goes through this so a failed step
# halts rather than publishing whatever the previous run left in dist/.
function Invoke-Step {
    param(
        [string]$Directory,
        [string]$Command,
        [string[]]$Arguments
    )
    Push-Location $Directory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Step 'Rebuilding the snapshot from FRED, EIA, Treasury and IMF PortWatch'
Invoke-Step $Backend 'py' @('scripts/build_snapshot.py')

# The gate. A failed upstream should leave the previous deploy live rather than
# publish a page full of dashes.
Write-Step 'Validating'
Invoke-Step $Backend 'py' @('scripts/validate_snapshot.py', '../frontend/public/data-snapshot.json')

Write-Step 'Cutting the V5 data files'
Invoke-Step $Backend 'py' @('scripts/build_v5_data.py')

# The site only ever shows the latest numbers. This is the only place the
# history is kept, so it goes in before anything is published.
Write-Step 'Recording the figures'
Invoke-Step $Backend 'py' @('scripts/record_refresh.py')

Write-Step 'Tests'
Invoke-Step $Backend 'py' @('-m', 'pytest', 'tests', '-q')
Invoke-Step $Frontend 'npm' @('test', '--if-present')

Write-Step 'Building'
Invoke-Step $Frontend 'npm' @('run', 'build')

if ($Dry) {
    Write-Host ''
    Write-Host '-Dry: built but not published.' -ForegroundColor Yellow
    Write-Host '  Preview with:  cd oil-dashboard\frontend ; npx vite preview --port 4173'
    exit 0
}

# Two projects serve the same V5 build: the original URL, which readers may
# already have, and the dedicated one. V4 is a separate frozen project and is
# deliberately not touched here.
Write-Step 'Deploying to Cloudflare Pages'
foreach ($project in @('trumps-economy-the-bill', 'trumps-economy-ledger')) {
    Write-Host "  -> $project"
    Invoke-Step $Root 'npx' @('--prefix', 'frontend', 'wrangler', 'pages', 'deploy',
                              'frontend/dist', '--project-name', $project,
                              '--branch', 'main', '--commit-dirty=true')
}

Write-Step 'Committing the refreshed data'
Push-Location $Root
try {
    git add frontend/public/data-snapshot.json frontend/public/v5 `
            frontend/public/og.png frontend/public/og.html docs/refresh-history.csv
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'data unchanged, nothing to commit'
    }
    else {
        git commit -m "data: refresh $(Get-Date -Format 'yyyy-MM-dd')"
        if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
        git push
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    }
}
finally {
    Pop-Location
}

# V4 lives on its own branch and its own Pages project, so it needs a second
# pass. frontend/src/v4 and the backend services are identical on both branches,
# so V4 reads the same snapshot with no code change: the refresh is literally
# "carry the file across, rebuild, deploy".
if (-not $SkipV4) {
    Write-Step 'Refreshing V4 on the v4-frozen branch'
    Push-Location $Root
    $startBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
    try {
        # Switching branches with uncommitted work would carry it across, and
        # the commit below would then land it on v4-frozen. Set it aside and
        # put it back in the finally, rather than refusing to run.
        $stashed = $false
        & git diff --quiet HEAD
        if ($LASTEXITCODE -ne 0) {
            Write-Host '  uncommitted work set aside for the branch switch'
            & git stash push -u -m 'refresh.ps1: V4 pass' | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'could not stash; refusing to switch branches' }
            $stashed = $true
        }

        $carried = Join-Path ([System.IO.Path]::GetTempPath()) 'data-snapshot-fresh.json'
        Copy-Item (Join-Path $Frontend 'public/data-snapshot.json') $carried -Force

        & git checkout -q v4-frozen
        if ($LASTEXITCODE -ne 0) { throw 'could not check out v4-frozen' }

        Copy-Item $carried (Join-Path $Frontend 'public/data-snapshot.json') -Force
        Invoke-Step $Frontend 'npm' @('run', 'build')
        Write-Host '  -> trumps-economy-ledger-v4'
        Invoke-Step $Root 'npx' @('--prefix', 'frontend', 'wrangler', 'pages', 'deploy',
                                  'frontend/dist', '--project-name', 'trumps-economy-ledger-v4',
                                  '--branch', 'v4-frozen', '--commit-dirty=true')

        & git add frontend/public/data-snapshot.json frontend/public/og.png frontend/public/og.html
        & git diff --cached --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host '  V4 data unchanged, nothing to commit'
        }
        else {
            & git commit -m "data: refresh $(Get-Date -Format 'yyyy-MM-dd')"
            if ($LASTEXITCODE -ne 0) { throw 'git commit failed on v4-frozen' }
            & git push origin v4-frozen
            if ($LASTEXITCODE -ne 0) { throw 'git push failed on v4-frozen' }
        }
    }
    finally {
        # Always come back, even if the V4 pass failed part way: restore the
        # branch, the stash and a dist/ that matches where you are standing.
        & git checkout -q $startBranch
        if ($stashed) {
            & git stash pop
            if ($LASTEXITCODE -ne 0) {
                Write-Warning 'stash pop failed. Your work is safe: run "git stash list".'
            }
        }
        Push-Location $Frontend
        & npm run build | Out-Null
        Pop-Location
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Live:' -ForegroundColor Green -NoNewline
Write-Host ' https://trumps-economy-the-bill.pages.dev   (V5, dedicated)'
Write-Host '       https://trumps-economy-ledger.pages.dev    (V5, original link)'
if (-not $SkipV4) {
    Write-Host '       https://trumps-economy-ledger-v4.pages.dev (V4)'
}
Write-Host ''
Write-Host 'History: docs/refresh-history.csv'
