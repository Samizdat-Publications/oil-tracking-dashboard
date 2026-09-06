/**
 * The household receipt, computed in the browser.
 *
 * A line-for-line port of `backend/services/attribution.py::receipt_lines()`.
 * Both read `backend/tests/fixtures/receipt_fixture.json`; `receipt.test.ts`
 * asserts this file reproduces the Python figures to the cent. If you change a
 * formula here, change it there, and regenerate the fixture deliberately.
 *
 * Three lines, each a price delta times a stated, sourced quantity:
 *   fuel        = Δ $/gal × (miles/week × 52 / 12) ÷ mpg
 *   groceries   = median staple move × $340 × people        (USDA moderate plan)
 *   electricity = Δ $/kWh × 855 kWh                           (EIA RECS average)
 *
 * The picker can switch fuel to an EIA regional/state weekly price and
 * electricity to a state residential price; groceries stay national because
 * BLS average prices are only published for the US city average.
 */

export interface PricePair {
  delta: number; as_of: string; baseline: number; current: number;
  baseline_date?: string; source?: string;
}
export interface Assumption { value: number; unit: string; source: string }
export interface ReceiptInputs {
  baseline_date: string;
  national: { gasoline?: PricePair; electricity?: PricePair };
  staple_moves: { median_pct: number | null; n_items: number; items: { key: string; name: string; pct: number; move?: number }[] };
  assumptions: {
    vehicle_mpg: Assumption;
    grocery_spend_per_person_month: Assumption;
    electricity_kwh_per_household_month: Assumption;
  };
  /** EIA weekly regular gasoline by area (from build_snapshot merge). */
  regions?: Record<string, { name: string; latest: { date: string; value: number } | null; handover: { date: string; value: number } | null; delta: number | null }>;
  electricity_by_state?: Record<string, { latest: { date: string; value: number } | null; handover: { date: string; value: number } | null; delta: number | null }>;
  state_to_padd?: Record<string, string>;
}

export interface ReceiptLine {
  key: 'fuel' | 'groceries' | 'electricity';
  label: string;
  monthly_usd: number;
  arithmetic: string;
  source: string;
  as_of?: string;
}

export interface ReceiptOptions {
  milesPerWeek: number;
  householdSize: number;
  mpg?: number;
  /** EIA area code (e.g. 'SCA', 'R20') or undefined for the national BLS series. */
  region?: string;
  /** Two-letter state for electricity, or undefined for the national series. */
  state?: string;
}

export interface Receipt {
  lines: ReceiptLine[];
  monthly_usd: number;
  cumulative_usd: number;
  months_elapsed: number;
  baseline_date: string;
  latest_as_of: string | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Python's `f"{x:.0f}"` rounds half to even; JS toFixed rounds half away. Match Python. */
const fmt0 = (v: number) => {
  const r = Math.round(v);
  return (Math.abs(v - Math.trunc(v)) === 0.5 && r % 2 !== 0 ? r - Math.sign(v) : r).toString();
};

export function computeReceipt(inputs: ReceiptInputs, o: ReceiptOptions): Receipt {
  const a = inputs.assumptions;
  const mpg = o.mpg ?? a.vehicle_mpg.value;
  const lines: ReceiptLine[] = [];

  // ── fuel ──────────────────────────────────────────────────────────────
  let fuel: PricePair | undefined = inputs.national.gasoline;
  let fuelSource = fuel?.source ?? 'BLS average price, US city average';
  if (o.region && inputs.regions?.[o.region]?.latest && inputs.regions[o.region].handover) {
    const r = inputs.regions[o.region];
    fuel = {
      delta: r.latest!.value - r.handover!.value, as_of: r.latest!.date,
      baseline: r.handover!.value, current: r.latest!.value, baseline_date: r.handover!.date,
    };
    fuelSource = `EIA weekly regular gasoline, ${r.name}`;
  }
  if (fuel) {
    const gallonsMonth = (o.milesPerWeek * 52 / 12) / mpg;
    lines.push({
      key: 'fuel', label: 'Fuel',
      monthly_usd: round2(fuel.delta * gallonsMonth),
      arithmetic: `$${fuel.delta.toFixed(2)}/gal x ${fmt0(gallonsMonth)} gal/month (${fmt0(o.milesPerWeek)} mi/week / ${mpg} mpg)`,
      source: fuelSource, as_of: fuel.as_of,
    });
  }

  // ── groceries ─────────────────────────────────────────────────────────
  const moves = inputs.staple_moves.items.map((i) => (typeof i.move === 'number' ? i.move : i.pct / 100));
  if (moves.length) {
    const basketPct = median(moves);
    const spend = a.grocery_spend_per_person_month.value * o.householdSize;
    lines.push({
      key: 'groceries', label: 'Groceries',
      monthly_usd: round2(spend * basketPct),
      arithmetic: `median move across ${moves.length} tracked staples (${basketPct >= 0 ? '+' : ''}${(basketPct * 100).toFixed(1)}%) x $${fmt0(spend)}/month grocery spend (${o.householdSize} people)`,
      source: 'BLS average prices, US city average; USDA moderate-cost food plan',
    });
  }

  // ── electricity ───────────────────────────────────────────────────────
  let elec: PricePair | undefined = inputs.national.electricity;
  let elecSource = elec?.source ?? 'BLS average price, US city average';
  if (o.state && inputs.electricity_by_state?.[o.state]?.latest && inputs.electricity_by_state[o.state].handover) {
    const e = inputs.electricity_by_state[o.state];
    elec = {
      delta: e.latest!.value - e.handover!.value, as_of: e.latest!.date,
      baseline: e.handover!.value, current: e.latest!.value, baseline_date: e.handover!.date,
    };
    elecSource = `EIA residential electricity price, ${o.state}`;
  }
  if (elec) {
    const kwh = a.electricity_kwh_per_household_month.value;
    lines.push({
      key: 'electricity', label: 'Electricity',
      monthly_usd: round2(elec.delta * kwh),
      arithmetic: `$${elec.delta.toFixed(4)}/kWh x ${fmt0(kwh)} kWh/month`,
      source: elecSource, as_of: elec.as_of,
    });
  }

  const monthly = round2(lines.reduce((s, l) => s + l.monthly_usd, 0));
  const asOfs = lines.map((l) => l.as_of).filter((x): x is string => !!x).sort();
  const latest = asOfs.length ? asOfs[asOfs.length - 1] : null;
  const days = latest
    ? (Date.UTC(+latest.slice(0, 4), +latest.slice(5, 7) - 1, +latest.slice(8, 10))
       - Date.UTC(+inputs.baseline_date.slice(0, 4), +inputs.baseline_date.slice(5, 7) - 1, +inputs.baseline_date.slice(8, 10))) / 86400000
    : 0;
  const monthsElapsed = Math.max(days / 30.44, 0);

  return {
    lines, monthly_usd: monthly,
    cumulative_usd: round2(monthly * monthsElapsed),
    months_elapsed: Math.round(monthsElapsed * 10) / 10,
    baseline_date: inputs.baseline_date, latest_as_of: latest,
  };
}
