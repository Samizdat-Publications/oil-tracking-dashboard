# Handoff package — "The bill Trump handed you" V5 prototype

Contents
- HANDOFF.md — the brief for the next session: what the user wants, what works, what doesn't, direction memo per chapter, technical lessons, open questions. Read first.
- V5 The Bill - prototype.dc.html — the working prototype (single file; loads support.js from the same folder and fonts from Google Fonts). Open locally with any static server so the fetch() of data/*.json works.
- support.js — runtime the .dc.html needs (do not edit).
- data/series.json — chart series derived from the repo snapshot (hormuz daily transits, CPI/PCE/median y/y, jobs monthly changes, 10-year, mortgage, sentiment, diesel, gasoline, gold tonnes, treasuries $bn, US/EA crossing, S&P, dollar).
- data/crude-2026.json — 167 WTI daily closes, 2 Jan → 1 Sep 2026.
- frontend/public/data-snapshot.json, backend/data/war_milestones.json — verbatim copies from the repo at the time of build.
- github.md — repo pointers and screen map.
- docs/screenshots/*.png — the live V4 site for reference. uploads/*.png — the user's screenshots of defects across this session.
- Superseded (safe to delete): V5 The Bill.dc.html, V5 Tokens.dc.html (early ink/amber artboards the user rejected).

Audit checklist for Claude Code
1. Every number on the page traces to data-snapshot.json or docs/THESIS.md. Grep the HTML for digits and confirm each.
2. Red (#D91E18) appears only on his dated acts; blue (#1E3FBF) on ceasefires, the court, and "against us"; amber (#F5A300) on measured values.
3. No internal notes remain (snapshot keys, "mounts here", build notes). Grep: PLACEHOLDER, mounts, re-derive, \.monthly_usd, context\., macro\.
4. Layout at 1400 and 390: no horizontal overflow, no label collisions, mono text ≥ 12px.
5. Scroll behaviour: charts scrub with scroll (progressAll in the logic class), count-ups fire once, reduced-motion shows end states.
6. The Hormuz block is an illustrative SVG; the repo's real engine (frontend/src/v4/hormuz/engine.js) is not embedded.
