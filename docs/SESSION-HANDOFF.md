# Session handoff — 2026-08-02

State of play for whoever (or whatever) picks this up next.

## Where things stand

**Built, tested, pushed.** V3 attribution engine (`backend/services/`), 17 passing
synthetic-truth tests, administration comparison Clinton→today, and the four
cycle-adjustment filters. Frontend V3 is the default route and renders live data.

**Run it:**
```
cd backend  && py -m uvicorn main:app --reload --port 8020
cd frontend && BACKEND_PORT=8020 npx vite --port 5173
```
Port 8000 is occupied by an unrelated `python serve.py` on this machine — hence the
`BACKEND_PORT` override in `vite.config.ts`.

## The most important finding of the session

We built the cycle-adjustment filters specifically to test the hypothesis
"Republicans wreck the economy and Democrats clean it up." **It does not hold.**

**Jobs — ranking is NOT robust.** Trump I's −57,604 jobs/month is entirely the
pandemic; excluding COVID he is +180,135. The "Republican average is negative" line
must not be published. What survives: Biden leads on every filter, and Trump II's
42,118 is second-worst with no black swan to explain it.

**Inflation — robust, and it goes against the thesis.** Biden is highest under every
adjustment (5.0% raw, 4.7% ex-COVID, 4.1% with a policy lag). Removing COVID barely
moves it, because the 2021–22 surge was the global supply shock, not the recession.

⚠️ The `ex_recession` filter produces an artifact for Trump I (+418,667). NBER dated
COVID as only Feb–Apr 2020, so it removes the crash but keeps the +2.7M/+4.8M rebound
months. Use `ex_covid` (through 2021-06) as the honest filter and say so in the UI.

**The defensible argument** is narrower than where we started: Trump II is
underperforming on its own terms — 42,118 jobs/month and 3.2% inflation with no
pandemic and no financial crisis, just tariffs and a war.

## Immediate next steps

1. **Claude Design** — brief is ready and pushed:
   `docs/design-briefs/2026-08-02-v4-full-redesign.md`. Repo is
   `Samizdat-Publications/oil-tracking-dashboard`. Asks for multiple complete
   redesign variants, the Hormuz simulation as centerpiece, and a plain-English
   "what this shows" callout under every chart.
2. **Two API keys need activation clicks** (keys are already in `backend/.env`):
   - BEA: `https://apps.bea.gov/api/signup/activate.html#DC31A3A0-2D75-46B3-9E35-3C69582ABFAD`
   - BLS: `https://data.bls.gov/registrationEngine/validateKey/0864838f3eb6495dc1ffa32367a66fa2cc39c78cbb6c9b88588a396eee801590`
   Census registration never produced an email; lowest priority of the three.
3. **OG share image** (1200×630) — not built. Decides whether a Facebook link gets
   clicked at all. `frontend/index.html` has the meta tags but `og:image` points at a
   guessed production URL that does not exist yet.
4. **Frontend still shows the old framing.** The V3.1/V4 repositioning (neutral
   analytical title, above-the-fold hero, American-institutional palette) is briefed
   but not implemented — waiting on Claude Design.

## Standing decisions

- **Zero fabrication.** Every number from an endpoint or a labelled assumption.
  Missing data says "no data". V2 shipped `Math.random()` sparklines and invented
  Reuters headlines; that is the failure mode this project exists to avoid.
- **Show the rows that cut against us.** Eggs are down because avian influenza
  resolved, not because of policy — and the page says exactly that. The S&P is up.
  Initial claims are low.
- Claims tested and **cut**: the IRA lowered inflation (CBO: "negligible"); US
  disinflation was fastest in the G7 (6th of 8); inflation statistics are being
  manipulated (no evidence, and Truflation reads *below* official CPI).
- Headline/title deliberately parked — decide at the end.
- `docs/THESIS.md` governs every claim on the page. Read it before writing copy.

## Open threads

- COVID-adjustment filters exist in the API but are **not yet surfaced in the UI**.
- `docs/research/COWORK-BRIEF.md` has outstanding verification questions, chiefly the
  alleged coordinated suppression of paper oil prices (currently unsupported) versus
  the documented CFTC/DOJ insider-trading probe (well supported — a ~$950M position
  placed hours before the April 7 ceasefire).
