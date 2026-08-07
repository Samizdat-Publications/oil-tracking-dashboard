/**
 * Strait of Hormuz — geometry, timeline and readout keyframes.
 *
 * The coastline, lane path and island placements are ported verbatim from
 * Claude Design's prototype (`design-handoff/.../HormuzStrait.dc.html`). They
 * are hand-tuned to put the chokepoint in the right place at the right visual
 * weight; re-deriving them from real coastline data would be an improvement,
 * but nudging them by hand would not.
 *
 * All coordinates are normalised 0..1 against the canvas box, so the map scales
 * without re-tuning. Values slightly outside that range on `LANE` are
 * deliberate — the shipping lane runs off both edges.
 *
 * ── The honesty rules that live in this file ────────────────────────────────
 * Transit volumes and war-risk premiums are STEPPED, not interpolated. The
 * strait did not reopen gradually, and drawing a smooth curve between 0.0 and
 * 4.8 mb/d would assert a sequence of intermediate values nobody measured.
 * `stepAt` is used for those; `lerpAt` only ever touches the price line, where
 * daily closes genuinely exist.
 *
 * There is no queue count anywhere in here. No verified figure exists at any
 * tier — the circulating "~325 stranded tankers" and "2,000 ships" numbers are
 * unsourceable, and the IMO's ~1,600 counts vessels of all types inside the
 * Gulf, which is a different quantity. See docs/THESIS.md.
 */

export type Confidence = 'verified' | 'approx' | 'derived' | 'illustrative';

/** Day 0 of the simulation. Everything is an integer day offset from here. */
export const DAY0 = Date.UTC(2026, 0, 2); // 2 Jan 2026, the 12-month low
export const SPAN_DAYS = 214; // through 4 Aug 2026

export const dayToDate = (day: number) => new Date(DAY0 + Math.round(day) * 86_400_000);

export const dayToISO = (day: number) => dayToDate(day).toISOString().slice(0, 10);

export const isoToDay = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - DAY0) / 86_400_000);

export const formatDay = (day: number) =>
  dayToDate(day)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();

// ---------------------------------------------------------------------------
// Geometry — ported verbatim. Do not hand-adjust.
// ---------------------------------------------------------------------------

export const IRAN: [number, number][] = [
  [0, 0], [0, .19], [.045, .215], [.088, .238], [.13, .232], [.163, .25], [.181, .283],
  [.203, .298], [.228, .286], [.25, .252], [.283, .262], [.318, .252], [.35, .272],
  [.392, .288], [.43, .279], [.463, .302], [.50, .324], [.53, .317], [.556, .33],
  [.578, .314], [.60, .325], [.622, .336], [.645, .349], [.666, .373], [.69, .398],
  [.716, .386], [.746, .393], [.777, .376], [.812, .351], [.855, .326], [.90, .306],
  [.95, .291], [1, .286], [1, 0],
];

export const OMAN: [number, number][] = [
  [0, 1], [0, .81], [.06, .80], [.13, .79], [.20, .778], [.27, .766], [.33, .756],
  [.39, .745], [.44, .735], [.485, .726], [.515, .69], [.535, .65], [.55, .60],
  [.565, .56], [.578, .52], [.588, .487], [.598, .466], [.606, .481], [.614, .462],
  [.624, .477], [.634, .458], [.645, .472], [.655, .456], [.662, .469], [.672, .49],
  [.685, .52], [.70, .552], [.712, .585], [.728, .64], [.745, .70], [.775, .75],
  [.82, .79], [.87, .822], [.92, .845], [.96, .858], [1, .865], [1, 1],
];

export const QESHM: [number, number][] = [
  [.215, .352], [.245, .338], [.285, .336], [.325, .344], [.365, .358], [.397, .376],
  [.375, .393], [.335, .387], [.29, .375], [.248, .369],
];

/** [x, y, radius, label] — label empty means unnamed islet. */
export const ISLES: [number, number, number, string][] = [
  [.417, .353, .015, 'HORMUZ'],
  [.452, .373, .010, 'LARAK'],
  [.301, .468, .008, ''],
  [.192, .531, .009, ''],
];

/** [x, y, label, labelSide] — side +1 draws above, -1 below. */
export const PORTS: [number, number, string, number][] = [
  [.205, .297, 'BANDAR ABBAS', 1],
  [.583, .535, 'KHASAB', -1],
  [.752, .688, 'FUJAIRAH', -1],
];

/** Shipping lane. Runs off both edges by design. */
export const LANE: [number, number][] = [
  [-.02, .578], [.10, .570], [.21, .558], [.32, .540], [.42, .514], [.505, .484],
  [.567, .446], [.617, .404], [.652, .414], [.686, .434], [.722, .470], [.768, .540],
  [.836, .605], [.912, .652], [1.02, .688],
];

// ---------------------------------------------------------------------------
// Readouts — stepped, with as-of dates
// ---------------------------------------------------------------------------

export interface Step<T> {
  day: number;
  value: T;
  asOf: string;
  confidence: Confidence;
  source: string;
}

/**
 * Gross transit through the strait, million barrels/day.
 * IEA. Stepped: the closure and the reopening were events, not ramps.
 */
export const TRANSIT: Step<number | null>[] = [
  { day: 0, value: 13.8, asOf: '2026-01-02', confidence: 'verified', source: 'IEA' },
  { day: isoToDay('2026-03-02'), value: 0.0, asOf: '2026-03-02', confidence: 'verified', source: 'IEA' },
  { day: isoToDay('2026-06-18'), value: 4.8, asOf: '2026-06-24', confidence: 'verified', source: 'IEA / CNBC' },
];

/**
 * War-risk insurance, percent of hull value per transit.
 * Marsh via S&P Global; Strauss Center for the hull-value calibration.
 * Ranges are stored as [low, high] and rendered as ranges — the market quotes
 * a band, and flattening it to a midpoint would invent precision.
 */
export const WAR_RISK: Step<[number, number]>[] = [
  { day: 0, value: [0.25, 0.25], asOf: '2026-01-02', confidence: 'verified', source: 'Strauss Center' },
  { day: isoToDay('2026-03-05'), value: [1, 1], asOf: '2026-03-05', confidence: 'approx', source: 'IWI' },
  { day: isoToDay('2026-03-15'), value: [2.5, 2.5], asOf: '2026-03-15', confidence: 'approx', source: 'gCaptain' },
  { day: isoToDay('2026-04-15'), value: [10, 10], asOf: '2026-04-15', confidence: 'verified', source: 'Marsh' },
  { day: isoToDay('2026-07-01'), value: [1, 3], asOf: '2026-07-01', confidence: 'verified', source: 'Marsh' },
  { day: isoToDay('2026-07-23'), value: [7.5, 10], asOf: '2026-07-23', confidence: 'verified', source: 'Marsh / S&P Global' },
];

/** War-risk cost per barrel, derived: %hull x $100M hull / 2M bbl per VLCC. */
export const riskPerBarrel = (pctHull: number) => (pctHull / 100) * 100_000_000 / 2_000_000;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  day: number;
  date: string;
  label: string;
  detail: string;
  /** +1 escalation, -1 de-escalation, 0 context. */
  sign: number;
  kind: 'war' | 'tariff' | 'policy' | 'context';
}

const ev = (
  date: string, label: string, detail: string, sign: number, kind: TimelineEvent['kind'],
): TimelineEvent => ({ day: isoToDay(date), date, label, detail, sign, kind });

export const EVENTS: TimelineEvent[] = [
  ev('2026-02-20', 'SCOTUS strikes the IEEPA tariffs',
     'Average import tariffs fall about 4.8 points. Eight days before the strikes.', -1, 'tariff'),
  ev('2026-02-24', 'Section 122 surcharge replaces them',
     'A 10% blanket surcharge. Energy is exempt, verbatim.', 1, 'tariff'),
  ev('2026-02-28', 'US and Israel strike Iran',
     'The strait closes within days. About 13.8 mb/d of transit stops — a fifth of world oil trade.', 1, 'war'),
  ev('2026-03-02', 'Platts pulls Hormuz grades from Dubai',
     'Deliverable grades drop from five to two. The benchmark after this date measures a different basket.', 1, 'context'),
  ev('2026-03-11', 'IEA releases 400 million barrels',
     'The largest coordinated release in the agency’s 52-year history. Estimated price effect about $2/bbl.', -1, 'policy'),
  ev('2026-04-06', 'Crude peaks at $114.01', 'Up 99% from the 2 January low of $57.21.', 1, 'war'),
  ev('2026-04-15', 'Physical trades $35 above paper',
     'A record premium. War-risk insurance hits 10% of hull value — about $5.00 a barrel.', 1, 'context'),
  ev('2026-06-18', 'Ceasefire and the MoU',
     'Transit recovers to about 4.8 mb/d, roughly 35% of baseline. Crude falls to $69.74 — below its pre-war level.', -1, 'war'),
  ev('2026-07-08', 'Strikes resume',
     'Cushing spot rises 4.24% to $74.56 on the day. The ceasefire is declared over.', 1, 'war'),
  ev('2026-07-23', 'Attacks on Saudi tankers',
     'War-risk premiums reach 7.5–10% of hull value. Crude closes at $93.08.', 1, 'war'),
  ev('2026-07-24', 'Section 122 surcharge expires',
     'Section 301 tariffs at 10 and 12.5% become the operative regime.', -1, 'tariff'),
  ev('2026-07-29', 'Escalation threats', 'Crude closes at $86.08.', 1, 'war'),
];

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/** Last step at or before `day`. Use for anything not measured continuously. */
export function stepAt<T>(steps: Step<T>[], day: number): Step<T> {
  let cur = steps[0];
  for (const s of steps) if (day >= s.day) cur = s;
  return cur;
}

/**
 * Price at `day` from the real daily closes.
 *
 * `exact` is true when a close exists for that day. The prototype had to
 * interpolate between four anchors and label the result; with 394 daily closes
 * from FRED almost every day is exact, and the few that are not are weekends
 * and holidays where no market print exists.
 */
export function priceAt(
  closes: { date: string; value: number }[], day: number,
): { value: number; exact: boolean; date: string } | null {
  if (!closes.length) return null;
  const iso = dayToISO(day);
  // Binary search for the last close at or before `iso`.
  let lo = 0, hi = closes.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (closes[mid].date <= iso) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (idx < 0) return { value: closes[0].value, exact: closes[0].date === iso, date: closes[0].date };
  const c = closes[idx];
  return { value: c.value, exact: c.date === iso, date: c.date };
}

/** Point on the lane path at fraction `t` (0..1), with heading. */
export function laneAt(t: number): { x: number; y: number; angle: number } {
  const n = LANE.length - 1;
  const f = Math.max(0, Math.min(0.9999, t)) * n;
  const i = Math.floor(f);
  const k = f - i;
  const [x0, y0] = LANE[i];
  const [x1, y1] = LANE[Math.min(i + 1, n)];
  return {
    x: x0 + (x1 - x0) * k,
    y: y0 + (y1 - y0) * k,
    angle: Math.atan2(y1 - y0, x1 - x0),
  };
}

/**
 * Share of normal traffic moving on a given day, 0..1.
 *
 * Drives how many vessels the animation shows. Derived from TRANSIT, and the
 * vessel layer is explicitly illustrative — it conveys the published transit
 * ratio, not tracked ship positions. The canvas keeps a "NOT AIS DATA" label
 * for exactly this reason.
 */
export function trafficShare(day: number): number {
  const base = TRANSIT[0].value ?? 13.8;
  const now = stepAt(TRANSIT, day).value ?? 0;
  return base > 0 ? Math.max(0, Math.min(1, now / base)) : 0;
}
