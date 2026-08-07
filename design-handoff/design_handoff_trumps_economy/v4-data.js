/* ============================================================================
   v4-data.js — SOURCED FIGURES ONLY
   Mirror of the intended frontend/src/v4/data.ts. Every value below is traceable
   to docs/design-briefs/2026-08-03-v4-economic-decline.md or docs/THESIS.md.
   Nothing here is interpolated, smoothed, modelled or invented.

   PORTING NOTE (for Claude Code)
   ------------------------------------------------------------------------
   const SOURCE: 'snapshot' | 'api' = 'snapshot';
   Each export below corresponds to one snapshot key / endpoint:
     administrations -> /api/attribution/administrations?metric=
     international   -> /api/attribution/international      (being added)
     breadth         -> /api/attribution/breadth
     jobs            -> /api/attribution/jobs
     staples         -> /api/attribution/staples
     event_study     -> /api/attribution/event-study
   Return types must stay identical across both paths. See HANDOFF-v4.md §3.
   ============================================================================ */

export const PROVENANCE = {
  brief: 'docs/design-briefs/2026-08-03-v4-economic-decline.md',
  thesis: 'docs/THESIS.md',
  asOf: 'June 2026',
};

/* --- CONFLICT: brief and thesis disagree. Both recorded; brief wins by date. --- */
export const CONFLICTS = [
  {
    field: 'US headline CPI y/y, June 2026',
    brief: 3.73, thesis: 3.53,
    note: 'Brief §1 "Today (June 2026): US 3.73%". THESIS.md international table: Jun 3.53%. Reconcile against snapshot.',
  },
  {
    field: 'Euro-area headline y/y, June 2026',
    brief: 2.73, thesis: 2.8,
    note: 'Brief §1 vs THESIS.md international table.',
  },
  {
    field: 'Headline CPI (breadth section)',
    brief: 3.7, thesis: 3.5,
    note: 'Brief §7 "Headline inflation 3.7% but median 2.7%" vs THESIS.md breadth table "3.5% (peaked 4.2% in May)".',
  },
];

/* ---------------------------------------------------------------- §1 the spine
   Administration averages, annualised %. Source: brief §1 result table. */
export const administrations = [
  { id: 'clinton',  name: 'Clinton',   party: 'D', from: 1993, to: 2001, us: 2.82, euro: 1.69, excess: 1.12 },
  { id: 'bush',     name: 'Bush',      party: 'R', from: 2001, to: 2009, us: 2.79, euro: 2.35, excess: 0.44 },
  { id: 'obama',    name: 'Obama',     party: 'D', from: 2009, to: 2017, us: 1.40, euro: 1.18, excess: 0.23 },
  { id: 'trump1',   name: 'Trump I',   party: 'R', from: 2017, to: 2021, us: 1.89, euro: 1.17, excess: 0.72 },
  { id: 'biden',    name: 'Biden',     party: 'D', from: 2021, to: 2025, us: 4.98, euro: 4.72, excess: 0.25 },
  { id: 'trump2',   name: 'Trump II',  party: 'R', from: 2025, to: 2026, us: 3.00, euro: 2.23, excess: 0.77, current: true },
];

/* The two anchor moments the hero argument turns on. Source: brief §1. */
export const anchors = {
  peak2022: {
    label: 'October 2022 — the global peak',
    us: 7.76, euro: 10.62, gap: -2.86,
    plain: 'At the peak of the global surge, US inflation was 2.86 points BELOW the euro area.',
  },
  now: {
    label: 'June 2026',
    us: 3.73, euro: 2.73, france: 2.02, gap: +1.00,
    plain: 'Today the euro area has come down and America has not.',
  },
};

/* --------------------------------------------------- 2026 monthly, REAL series
   Source: THESIS.md "VERIFIED: the 2026 spike is the oil shock, and it is global"
   Jan values from THESIS.md §2 (2.4 headline / 2.5 core).
   NOTE: no euro-area value for Jan 2026 in either doc -> null, rendered as a gap. */
export const monthly2026 = [
  { m: 'Jan', usHeadline: 2.41, usCore: 2.50, usEnergy: null,  euro: null },
  { m: 'Feb', usHeadline: 2.41, usCore: 2.47, usEnergy: 0.4,   euro: 1.9 },
  { m: 'Mar', usHeadline: 3.26, usCore: 2.60, usEnergy: 12.6,  euro: 2.6 },
  { m: 'Apr', usHeadline: 3.81, usCore: 2.74, usEnergy: 17.5,  euro: 3.0 },
  { m: 'May', usHeadline: 4.25, usCore: 2.82, usEnergy: 23.0,  euro: 3.2 },
  { m: 'Jun', usHeadline: 3.53, usCore: 2.57, usEnergy: 15.5,  euro: 2.8 },
];

/* ------------------------------------------------------------------- §breadth
   June 2026. Source: THESIS.md breadth table. */
export const breadth = [
  { id: 'headline', label: 'Headline CPI',        value: 3.5, source: 'BLS', tier: 1, conflict: 'brief says 3.7' },
  { id: 'core',     label: 'Core CPI',            value: 2.6, source: 'BLS', tier: 1 },
  { id: 'median',   label: 'Median CPI',          value: 2.7, source: 'Cleveland Fed', tier: 1 },
  { id: 'trim16',   label: '16% trimmed-mean CPI',value: 2.6, source: 'Cleveland Fed', tier: 1 },
  { id: 'trimpce',  label: 'Trimmed-mean PCE',    value: 2.2, source: 'Dallas Fed', tier: 1 },
  { id: 'energy',   label: 'Energy',              value: 15.7, source: 'BLS', tier: 1, tail: true },
  { id: 'gasoline', label: 'Gasoline',            value: 26.7, source: 'BLS', tier: 1, tail: true },
];
export const breadthTarget = 2.0;

/* ----------------------------------------------------------------------- §work
   Source: brief §7 and §8. */
export const jobs = {
  creation: { biden: 320938, trump2: 42118, unit: '/mo' },
  longTermUnemployed: { from: 21.1, to: 27.3, note: 'share of all unemployed out 27+ weeks' },
  hiringRate: { now: 3.3, pre2020: 3.9 },
  quitsRate: { now: 1.9 },
  uRates: { u3: { from: 4.0, to: 4.2 }, u6: { from: 7.5, to: 7.9 } },
  cycleAdjust: {
    trump1: { none: -57604, ex_covid: 180135, ex_recession: 418667 },
    artifact: 'NBER dated COVID as Feb–Apr 2020 only, so ex_recession strips the crash but keeps the rebound. Flag, do not hide.',
  },
};

/* ---------------------------------------------------------------------- §shelf
   Actual dollars, Jan 2025 -> now. Source: brief §7. */
export const staples = [
  { id: 'beef',   label: 'Ground beef, 1 lb', from: 5.55, to: 6.83 },
  { id: 'coffee', label: 'Coffee, 1 lb',      from: 7.02, to: 9.46 },
  { id: 'gas',    label: 'Gasoline, 1 gal',   from: 3.21, to: 4.20 },
];
/* Runs against us. Show it. Source: brief §9. */
export const againstUs = [
  { id: 'eggs', label: 'Eggs', change: -45, unit: '%/yr',
    why: 'Avian influenza resolved. Not policy.' },
  { id: 'sp500', label: 'S&P 500', change: null, direction: 'up',
    why: 'Up over the period. No point estimate in the brief — pull from snapshot.' },
  { id: 'claims', label: 'Initial jobless claims', change: null, direction: 'low',
    why: 'Low. Few layoffs is the true half of the frozen-market story.' },
];

/* ------------------------------------------------------------- §what drove it
   WTI round trip, verified from FRED. Source: THESIS.md §5. */
export const oilRoundTrip = [
  { date: '2026-01-02', wti: 57.21, event: null, label: '12-month low' },
  { date: '2026-02-28', wti: null,  event: 'US/Israel strike Iran; Hormuz closes' },
  { date: '2026-04-06', wti: 114.01, event: null, label: 'peak' },
  { date: '2026-06-18', wti: null,  event: '60-day ceasefire / MoU' },
  { date: '2026-07-01', wti: 69.74, event: null, label: 'fully round-trips to pre-war' },
  { date: '2026-07-08', wti: null,  event: 'US strikes resume; ceasefire over' },
  { date: '2026-07-27', wti: 84.25, event: null, label: 're-escalation' },
];

/* ------------------------------------------------------- §check our work
   Things we refuse to claim. Source: THESIS.md "What we will NOT claim". */
export const refusals = [
  'That any single administration set the price of oil.',
  'A point estimate for the tariff share of inflation. We ship a bound.',
  'That the published inflation numbers are manipulated. No evidence found.',
  'That the futures market was wrong. The curve was largely right.',
];

/* --------------------------------------------------------------- MISSING DATA
   Charted nowhere. Do not fill these in. See HANDOFF-v4.md §4. */
export const TODO_MISSING = [
  'Continuous monthly US vs euro-area CPI, 2015-01 -> 2026-06. Needed by the hero.',
  'Peer countries beyond euro area + France for §2 (control group).',
  'October 2025 CPI does not exist and never will (43-day shutdown, never collected).',
  'Tanker day rates — unavailable at reasonable cost. Design around volumes/barrels.',
];
