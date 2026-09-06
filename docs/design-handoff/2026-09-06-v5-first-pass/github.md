repo: Samizdat-Publications/oil-tracking-dashboard
branch: main
path: docs/design-briefs, frontend/public/data-snapshot.json, frontend/src/v4

## Last sync
date: 2026-09-06T03:40:00Z
### Updated in this project
- Built the V5 scroll-driven prototype (V5 The Bill - prototype.dc.html): 13 chapters, V4 palette, cream default ground
- Copied data-snapshot.json and derived data/crude-2026.json, data/series.json for the charts
- Rebuilt every chart from the snapshot series; strait chapter now an animated choke-point simulation driven by PortWatch daily counts
- Earlier artboard canvas (V5 The Bill.dc.html) and V5 Tokens.dc.html retained from the ink/amber pass; superseded

## Sync history
- 2026-09-05T06:12:31Z — read V5 brief, README, THESIS, V4 tokens; first artboard pass

## Screen map
| Screen | Built from |
|---|---|
| V5 The Bill - prototype.dc.html · 00 masthead | docs/design-briefs/2026-09-05-v5-the-bill.md §1, §4; receipt block of data-snapshot.json |
| 01 strike (crude chart) | crude_daily in data-snapshot.json; frontend/src/v4/ledger-data.ts masthead events |
| 02 strait (simulation + timeline) | hormuz_transits in data-snapshot.json; docs/THESIS.md Hormuz section |
| 03 receipt | staples.items, receipt in data-snapshot.json; brief §5 |
| 04 tariffs (inflation chart) | breadth.measures, macro.series.pce_core; docs/THESIS.md §4 |
| 05 jobs (columns) | jobs.monthly_changes; THESIS labour + data-integrity sections |
| 06 money (10-year chart) | macro.series.ten_year, mortgage_30y, sentiment; context.rates, context.sentiment |
| 07 trade (flow) | context.trade.*; brief §5 |
| 08 gold (hanging bars) | context.gold.fed_earmarked_gold, fed_custody_treasuries, moves; brief §5 |
| 09 vs Europe (crossing) | international.series; THESIS international section |
| 10 against us | ledger-data.ts `other`; THESIS "what we will not claim" |
| 11 the bill | brief §5 end card spec |
| 12 check our work | THESIS landmines and corrections |
| V4 palette | frontend/src/v4/tokens.css |
