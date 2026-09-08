repo: Samizdat-Publications/oil-tracking-dashboard
branch: main

## Last sync
date: 2026-09-06T08:40:00Z

### Updated in this project
- Read HANDOFF-DESIGN.md (V5 brief) and frontend/src/v4/hormuz/engine.js
- Copied frontend/public/data-snapshot.json; derived globe-data.json (chokepoints + hormuz_transits)
- Built all eleven blocks (0–10) of The Bill.dc.html: globe, two dates, seismograph, strait, departures board, crowd, war cost, vault, against us, the bill card, check our work
- Derived data files: globe-data.json, strait-coast.json, prices-data.json, crude-data.json, bill-data.json

## Screen map
| Screen | Repo files |
|---|---|
| The Bill.dc.html · block 0 The globe | HANDOFF-DESIGN.md, frontend/public/data-snapshot.json (chokepoints, hormuz_transits, war_milestones) |
| The Bill.dc.html · block 4 Your prices | frontend/public/data-snapshot.json (staples, receipt, receipt_inputs, eia, macro.series.diesel_weekly) |
| The Bill.dc.html · blocks 1–2 Two dates, Oil doubled | data-snapshot.json (crude_daily, war_milestones), docs/THESIS.md |
| The Bill.dc.html · block 3 The strait | frontend/src/v4/hormuz/coast.json, data-snapshot.json (hormuz_transits) |
| The Bill.dc.html · blocks 5–7 | data-snapshot.json (jobs, macro.series, context.war_cost, context.gold) |
| The Bill.dc.html · blocks 8–10 | data-snapshot.json (staples, jobs, macro, receipt), frontend/src/v4/data.ts (CONFLICTS) |
