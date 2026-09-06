/* eslint-disable @typescript-eslint/no-explicit-any -- the snapshot is untyped JSON straight from the endpoints; every field is guarded before use. */
/**
 * Ledger figures — every number the page shows, derived from the snapshot.
 *
 * Until September 2026 `LedgerPage.tsx` carried its figures as literals in
 * JSX: $6.83 a pound, 42,118 jobs a month, 3.73%. A month after the design
 * handoff every one of them was stale and nothing on the page said so. This
 * module is the fix: the page renders `Figures`, and `Figures` is computed from
 * the same snapshot the simulation and the OG card read. Refreshing the page is
 * `py scripts/build_snapshot.py`; nothing is retyped.
 *
 * Two kinds of input:
 *   - FRED-backed blocks (`macro`, `staples`, `jobs`, `international`,
 *     `crude_daily`, `hormuz_transits`) — measured series with dates.
 *   - `context` — curated figures that do not live on FRED (gold custody, WTO,
 *     IEA, Drewry, war-risk quotes). Each carries a source, URL and tier and is
 *     mirrored in docs/THESIS.md. If one disagrees with FRED, FRED wins.
 *
 * Nothing here invents a value. Where a figure is missing the field is null and
 * the page renders an em-dash.
 */

export interface Pt { date: string; value: number }

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const pt = (p: any): Pt | null =>
  p && typeof p.date === 'string' && num(p.value) !== null ? { date: p.date, value: p.value } : null;

/** "Aug 2026" */
export const mon = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
/** "4 Sep 2026" */
export const day = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
/** "4 SEP" — three-letter months, so labels match the flags ("1 SEP", not "1 SEPT"). */
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const dayShort = (iso: string) => `${+iso.slice(8, 10)} ${MON3[+iso.slice(5, 7) - 1]}`;
/** "Q4 2025" */
export const quarter = (iso: string | null | undefined) =>
  iso ? `Q${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1} ${iso.slice(0, 4)}` : '—';
/** "AUGUST 2026" */
export const monthLong = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—';

export const fmt = (n: number | null, d = 0) =>
  n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = (n: number | null, d = 2) => (n === null ? '—' : `$${fmt(n, d)}`);
export const pctS = (n: number | null, d = 1, sign = true) =>
  n === null ? '—' : `${sign && n > 0 ? '+' : ''}${n.toFixed(d)}%`;

/** Statutory gold: $42.22 per fine troy ounce, unchanged since 1973. */
export const usdMToTonnes = (usdM: number) => (usdM * 1e6 / 42.22) * 31.1034768 / 1e6;

// ---------------------------------------------------------------------------

export interface ShelfItem {
  key: string; name: string; from: number; to: number; pct: number;
  fromLabel: string; toLabel: string; source: string;
}

export interface Figures {
  asOf: {
    generated: string; cpiMonth: string; jobsMonth: string; crudeDate: string;
    /** For the masthead bar: "through August 2026". */
    label: string;
  };
  masthead: {
    series: Pt[]; jan2: Pt | null; peak: Pt | null; latest: Pt | null; preWar: Pt | null;
    peakPct: number | null; latestPct: number | null;
    gas: Pt | null; gasHandover: Pt | null; diesel: Pt | null; dieselHandover: Pt | null;
    aaaLaborDay: any; dieselRecord: any;
    events: { date: string; label: string; kind: 'war' | 'ceasefire' | 'context' }[];
  };
  ticker: string[];
  shelf: ShelfItem[];
  crossing: {
    series: { date: string; us: number; benchmark: number; gap: number }[];
    start: { date: string; us: number; benchmark: number; gap: number } | null;
    latest: { date: string; us: number; benchmark: number; gap: number } | null;
    cross: { date: string; us: number; benchmark: number; gap: number } | null;
    euFlash: any; terms: any[];
  };
  choices: {
    warBars: { label: string; value: number | null; asOf: string }[];
    creep: { start: Pt | null; end: Pt | null; change: number | null };
    headline: Pt | null; core: Pt | null; median: Pt | null; trimmed: Pt | null;
    airfares: Pt | null;
  };
  work: {
    prevMean: number | null; currMean: number | null; currMonths: number | null; ratio: number | null;
    ltuStart: Pt | null; ltuLatest: Pt | null; hires: Pt | null; quits: Pt | null;
    unemployment: Pt | null; u6: Pt | null; latestMonth: Pt | null; august: any;
  };
  squeeze: {
    sentiment: any; sentimentHandover: Pt | null; inflExp: any; tenYear: Pt | null; tenYearHandover: Pt | null;
    fedFunds: Pt | null; hikeOdds: any; mortgage: Pt | null; mortgageHandover: Pt | null;
    breakeven: Pt | null; fwd5y5y: Pt | null;
  };
  gold: {
    earmarked: { points: { date: string; tonnes: number }[]; start: { date: string; tonnes: number } | null; latest: { date: string; tonnes: number } | null; change: number | null; source: any };
    treasuries: { points: { date: string; usdBn: number }[]; peak: { date: string; usdBn: number } | null; latest: { date: string; usdBn: number } | null; change: number | null; source: any };
    moves: any[]; ecb: any; fedCounter: any; price: any; tic: any; wgc: any; hist: any;
    dollar: Pt | null; dollarHandover: Pt | null;
  };
  trade: {
    wto: any; iea: any; drewry: any; iata: any; usTrade: any; claims: any; kpler: any; lloyds: any;
    portwatch: { baseline: number | null; tankerBaseline: number | null; mean7: number | null; tanker7: number | null; latestDate: string | null; pct: number | null; source: any; live?: { asOf: string; source: string } };
    tradeBalance: Pt | null; imports: Pt | null; customsDuties: Pt | null; customsDutiesPeak: Pt | null;
    attacks: any; warRisk: any;
  };
  /** Treasury Fiscal Data (snapshot), patched live in the browser when reachable. */
  fiscal: {
    debt: { latest: Pt | null; handover: Pt | null; live?: { asOf: string; source: string } } | null;
    customs: any; interest: any;
  };
  /** New September 2026 blocks, passed through for V5 and the strait readouts. */
  eia: any; chain: any; chokepoints: any; nowcast: any; odds: any; receiptInputs: any;
  other: { v: string; l: string; w: string }[];
  breadth: { headline: Pt | null; median: Pt | null; gap: number | null };
  eventStudy: any;
  sources: { crudePeakNote: string };
}

// ---------------------------------------------------------------------------

function latestOf(series: any, key: string): Pt | null {
  return pt(series?.[key]?.latest);
}
function handoverOf(series: any, key: string): Pt | null {
  return pt(series?.[key]?.handover);
}
function yoyLatest(macro: any, key: string): Pt | null {
  return pt(macro?.yoy?.[key]?.latest);
}

export function deriveFigures(snap: Record<string, any>): Figures {
  const macro = snap.macro ?? {};
  const S = macro.series ?? {};
  const ctx = snap.context ?? {};
  const intl = snap.international ?? {};
  const jobs = snap.jobs ?? {};
  const staples: any[] = snap.staples?.items ?? [];
  const breadthM: any[] = snap.breadth?.measures ?? [];
  const crude: Pt[] = (snap.crude_daily?.observations ?? [])
    .filter((o: any) => num(o.value) !== null)
    .map((o: any) => ({ date: o.date, value: o.value }));
  const hz = snap.hormuz_transits ?? null;

  // ── as-of ────────────────────────────────────────────────────────────────
  const cpiMonth = latestOf(S, 'cpi_headline_nsa')?.date ?? null;
  const jobsMonth = jobs.current_term?.end ?? null;
  const crudeLatest = crude.length ? crude[crude.length - 1] : null;
  const asOfLabel = `through ${monthLong(jobsMonth ?? cpiMonth)}`;

  // ── masthead ─────────────────────────────────────────────────────────────
  const y2026 = crude.filter((p) => p.date >= '2026-01-01');
  const jan2 = y2026[0] ?? null;
  const peak = y2026.reduce<Pt | null>((m, p) => (!m || p.value > m.value ? p : m), null);
  const preWar = crude.filter((p) => p.date <= '2026-02-27').slice(-1)[0] ?? null;
  const gas = latestOf(S, 'gasoline_weekly');
  const diesel = latestOf(S, 'diesel_weekly');

  const masthead: Figures['masthead'] = {
    series: y2026, jan2, peak, latest: crudeLatest, preWar,
    peakPct: jan2 && peak ? (peak.value / jan2.value - 1) * 100 : null,
    latestPct: jan2 && crudeLatest ? (crudeLatest.value / jan2.value - 1) * 100 : null,
    gas, gasHandover: handoverOf(S, 'gasoline_weekly'),
    diesel, dieselHandover: handoverOf(S, 'diesel_weekly'),
    aaaLaborDay: ctx.prices?.aaa_labor_day ?? null,
    dieselRecord: ctx.prices?.diesel_record ?? null,
    events: [
      { date: '2026-02-28', label: '28 FEB · STRIKE · HORMUZ CLOSES', kind: 'war' },
      { date: '2026-04-07', label: '7 APR · CEASEFIRE', kind: 'ceasefire' },
      { date: '2026-06-18', label: '18 JUN · CEASEFIRE · REOPENS', kind: 'ceasefire' },
      { date: '2026-07-08', label: '8 JUL · STRIKES RESUME', kind: 'war' },
      { date: '2026-09-01', label: '1 SEP · LULL ENDS', kind: 'war' },
    ],
  };

  // ── shelf ────────────────────────────────────────────────────────────────
  const staple = (k: string) => staples.find((s) => s.key === k);
  const shelfFrom = (s: any, name: string, source: string): ShelfItem | null => {
    if (!s) return null;
    const c = s.current_term;
    return {
      key: s.key, name, from: c.start_value, to: c.end_value, pct: c.total_pct,
      fromLabel: mon(c.start_date), toLabel: mon(c.end_date), source,
    };
  };
  const shelf: ShelfItem[] = [
    shelfFrom(staple('beef_ground'), 'Ground beef, 1 lb', 'BLS average price APU0000703112'),
    shelfFrom(staple('coffee'), 'Coffee, 1 lb', 'BLS average price APU0000717311'),
    shelfFrom(staple('gasoline_ap'), 'Gasoline, 1 gal', 'BLS average price APU000074714'),
  ].filter((x): x is ShelfItem => !!x);
  const dh = handoverOf(S, 'diesel_weekly');
  if (diesel && dh) {
    shelf.push({
      key: 'diesel', name: 'Diesel, 1 gal', from: dh.value, to: diesel.value,
      pct: (diesel.value / dh.value - 1) * 100,
      fromLabel: day(dh.date), toLabel: day(diesel.date), source: 'EIA weekly, FRED GASDESW',
    });
  }

  // ── crossing ─────────────────────────────────────────────────────────────
  const intlSeries: any[] = (intl.series ?? []).filter((p: any) => p.date >= '2022-10-01');
  let cross: any = null;
  for (let i = 1; i < intlSeries.length; i++) {
    if (intlSeries[i - 1].gap < 0 && intlSeries[i].gap >= 0) cross = intlSeries[i];
  }
  const crossing: Figures['crossing'] = {
    series: intlSeries,
    start: intlSeries[0] ?? null,
    latest: intl.latest ?? null,
    cross,
    euFlash: ctx.inflation?.euro_area_flash_august ?? null,
    terms: intl.terms ?? [],
  };

  // ── two choices ──────────────────────────────────────────────────────────
  const gasY = yoyLatest(macro, 'cpi_gasoline');
  const enY = yoyLatest(macro, 'cpi_energy');
  const headY = yoyLatest(macro, 'cpi_headline_nsa');
  const creepRaw = macro.core_pce_creep ?? null;
  const bm = (k: string) => pt(breadthM.find((m) => m.key === k)?.latest);
  const choices: Figures['choices'] = {
    warBars: [
      { label: 'Gasoline y/y', value: gasY?.value ?? null, asOf: mon(gasY?.date) },
      { label: 'CPI energy y/y', value: enY?.value ?? null, asOf: mon(enY?.date) },
      { label: 'Headline CPI y/y', value: headY?.value ?? null, asOf: mon(headY?.date) },
    ],
    creep: {
      start: pt(creepRaw?.start), end: pt(creepRaw?.end),
      change: num(creepRaw?.change_pp),
    },
    headline: bm('cpi_headline'), core: bm('cpi_core'), median: bm('median_cpi'), trimmed: bm('trimmed_cpi'),
    airfares: yoyLatest(macro, 'cpi_airfares'),
  };

  // ── work ─────────────────────────────────────────────────────────────────
  const prevMean = num(jobs.previous_term?.mean_monthly);
  const currMean = num(jobs.current_term?.mean_monthly);
  const monthly: any[] = jobs.monthly_changes ?? [];
  const work: Figures['work'] = {
    prevMean, currMean, currMonths: num(jobs.current_term?.n_months),
    ratio: prevMean && currMean !== null ? currMean / prevMean : null,
    ltuStart: handoverOf(S, 'ltu_share'), ltuLatest: latestOf(S, 'ltu_share'),
    hires: latestOf(S, 'hires_rate'), quits: latestOf(S, 'quits_rate'),
    unemployment: latestOf(S, 'unemployment'), u6: latestOf(S, 'u6'),
    latestMonth: monthly.length ? pt(monthly[monthly.length - 1]) : null,
    august: ctx.labour?.august_payrolls ?? null,
  };

  // ── squeeze ──────────────────────────────────────────────────────────────
  const squeeze: Figures['squeeze'] = {
    sentiment: ctx.sentiment?.umich_august ?? null,
    sentimentHandover: handoverOf(S, 'sentiment'),
    inflExp: ctx.sentiment?.umich_august ?? null,
    tenYear: latestOf(S, 'ten_year'), tenYearHandover: handoverOf(S, 'ten_year'),
    fedFunds: latestOf(S, 'fed_funds_upper'),
    hikeOdds: ctx.rates?.fedwatch_september_hike ?? null,
    mortgage: latestOf(S, 'mortgage_30y'), mortgageHandover: handoverOf(S, 'mortgage_30y'),
    breakeven: latestOf(S, 'breakeven_10y'), fwd5y5y: latestOf(S, 'fwd_5y5y'),
  };

  // ── gold ─────────────────────────────────────────────────────────────────
  const em = ctx.gold?.fed_earmarked_gold ?? null;
  const emPts = (em?.points ?? []).map((p: any) => ({ date: p.date, tonnes: usdMToTonnes(p.usd_m) }));
  const tr = ctx.gold?.fed_custody_treasuries ?? null;
  const trPts: { date: string; usdBn: number }[] = (tr?.points ?? []).map((p: any) => ({ date: p.date, usdBn: p.usd_m / 1000 }));
  let trPeak: { date: string; usdBn: number } | null = null;
  for (const p of trPts) if (!trPeak || p.usdBn > trPeak.usdBn) trPeak = p;
  const gold: Figures['gold'] = {
    earmarked: {
      points: emPts, start: emPts[0] ?? null, latest: emPts[emPts.length - 1] ?? null,
      change: emPts.length > 1 ? emPts[emPts.length - 1].tonnes - emPts[0].tonnes : null,
      source: em,
    },
    treasuries: {
      points: trPts, peak: trPeak, latest: trPts[trPts.length - 1] ?? null,
      change: trPeak && trPts.length ? trPts[trPts.length - 1].usdBn - trPeak.usdBn : null,
      source: tr,
    },
    moves: ctx.gold?.moves ?? [],
    ecb: ctx.gold?.ecb_reserve_shares ?? null,
    fedCounter: ctx.gold?.fed_counterpoint ?? null,
    price: ctx.gold?.gold_price ?? null,
    tic: ctx.gold?.tic_foreign_holdings ?? null,
    wgc: ctx.gold?.wgc_survey ?? null,
    hist: ctx.gold?.historical_custody ?? null,
    dollar: latestOf(S, 'dollar_index'), dollarHandover: handoverOf(S, 'dollar_index'),
  };

  // ── trade ────────────────────────────────────────────────────────────────
  const obs: any[] = hz?.observations ?? [];
  const last7 = obs.slice(-7);
  const mean7 = last7.length ? last7.reduce((s, o) => s + (o.total ?? 0), 0) / last7.length : null;
  const tank7 = last7.length ? last7.reduce((s, o) => s + (o.tanker ?? 0), 0) / last7.length : null;
  const base = num(hz?.baseline?.total_per_day);
  const cd: Pt[] = (S.customs_duties?.points ?? []).map((p: any) => pt(p)).filter((p: Pt | null): p is Pt => !!p);
  let cdPeak: Pt | null = null;
  for (const p of cd) if (!cdPeak || p.value > cdPeak.value) cdPeak = p;
  const trade: Figures['trade'] = {
    wto: ctx.trade?.wto ?? null, iea: ctx.trade?.iea_august_omr ?? null,
    drewry: ctx.trade?.drewry_wci ?? null, iata: ctx.trade?.iata ?? null,
    usTrade: ctx.trade?.us_trade_july ?? null,
    claims: ctx.war?.us_claims ?? null, kpler: ctx.war?.transits_kpler ?? null, lloyds: ctx.war?.transits_lloyds ?? null,
    portwatch: {
      baseline: base, tankerBaseline: num(hz?.baseline?.tanker_per_day),
      mean7, tanker7: tank7, latestDate: hz?.latest?.date ?? null,
      pct: base && mean7 !== null ? (mean7 / base) * 100 : null,
      source: hz ? { source: hz.source, url: hz.source_url, tier: hz.tier, note: hz.note } : null,
    },
    tradeBalance: latestOf(S, 'trade_balance'), imports: latestOf(S, 'imports'),
    customsDuties: latestOf(S, 'customs_duties'), customsDutiesPeak: cdPeak,
    attacks: ctx.war?.august_attacks ?? null, warRisk: ctx.war?.war_risk_premium ?? null,
  };

  // ── the other side ───────────────────────────────────────────────────────
  const eggs = staple('eggs');
  const sp = latestOf(S, 'sp500'), spH = handoverOf(S, 'sp500');
  const dollar = gold.dollar, dollarH = gold.dollarHandover;
  const other: Figures['other'] = [
    eggs ? { v: pctS(eggs.current_term.annualised_pct, 0), l: 'Eggs, per year', w: 'Avian influenza resolved. Not policy, and not claimed as such.' } : null,
    choices.core ? { v: `${choices.core.value.toFixed(1)}%`, l: `Core CPI, ${mon(choices.core.date)}`, w: 'At or near target. The overshoot is in the tails, not the basket.' } : null,
    choices.median ? { v: `${choices.median.value.toFixed(1)}%`, l: `Median CPI, ${mon(choices.median.date)}`, w: 'A relative-price shock moves the tail; broad demand inflation would move this.' } : null,
    work.august ? { v: `+${fmt(work.august.change)}`, l: `Jobs added, ${monthLong(jobsMonth).split(' ')[0]}`, w: `Best month in five, against a ${fmt(work.august.consensus)} consensus. One month; the term average is still ${fmt(currMean)}.` } : null,
    sp && spH ? { v: fmt(sp.value), l: 'S&P 500', w: `Up ${pctS((sp.value / spH.value - 1) * 100, 0)} since the handover. Genuinely higher. Initial claims are low too.` } : null,
    dollar && dollarH ? { v: fmt(dollar.value, 1), l: 'Broad dollar index', w: `Down ${pctS((dollar.value / dollarH.value - 1) * 100, 0, false).replace('-', '')} since January 2025 but UP since the war began. The gold section is about custody, not a dollar collapse.` } : null,
  ].filter((x): x is { v: string; l: string; w: string } => !!x);

  // ── ticker ───────────────────────────────────────────────────────────────
  const beef = shelf.find((s) => s.key === 'beef_ground');
  const coffee = shelf.find((s) => s.key === 'coffee');
  const gasShelf = shelf.find((s) => s.key === 'gasoline_ap');
  const dieselShelf = shelf.find((s) => s.key === 'diesel');
  const nowTerm = (intl.terms ?? []).find((t: any) => t.in_progress);
  const ticker = [
    jan2 && peak && crudeLatest ? `CRUDE $${jan2.value.toFixed(0)} → $${peak.value.toFixed(0)} → $70 → $${crudeLatest.value.toFixed(0)}` : null,
    beef ? `GROUND BEEF ${money(beef.from)} → ${money(beef.to)}` : null,
    coffee ? `COFFEE ${money(coffee.from)} → ${money(coffee.to)}` : null,
    gasShelf ? `GASOLINE ${money(gasShelf.from)} → ${money(gasShelf.to)}` : null,
    dieselShelf ? `DIESEL ${money(dieselShelf.from)} → ${money(dieselShelf.to)} · RECORD` : null,
    prevMean && currMean !== null ? `JOB CREATION ${fmt(prevMean)}/MO → ${fmt(currMean)}/MO` : null,
    work.ltuStart && work.ltuLatest ? `LONG-TERM UNEMPLOYED ${work.ltuStart.value}% → ${work.ltuLatest.value}%` : null,
    nowTerm ? `US-SPECIFIC INFLATION EXCESS +${nowTerm.excess.toFixed(2)}` : null,
    gold.earmarked.change !== null ? `FOREIGN GOLD LEAVING THE NEW YORK FED ${fmt(gold.earmarked.change)} T SINCE AUG 2025` : null,
    trade.portwatch.pct !== null ? `HORMUZ TRANSITS ${trade.portwatch.pct.toFixed(0)}% OF PRE-WAR` : null,
    trade.wto ? `WORLD TRADE GROWTH ${trade.wto.growth_2025_pct}% → ${trade.wto.growth_2026_baseline_pct}%` : null,
  ].filter((x): x is string => !!x);

  const bh = bm('cpi_headline'), bmed = bm('median_cpi');

  return {
    asOf: {
      generated: snap._meta?.generated ?? '—', cpiMonth: cpiMonth ?? '—',
      jobsMonth: jobsMonth ?? '—', crudeDate: crudeLatest?.date ?? '—', label: asOfLabel,
    },
    masthead, ticker, shelf, crossing, choices, work, squeeze, gold, trade, other,
    fiscal: {
      debt: snap.fiscal?.debt && !snap.fiscal.debt.error
        ? { latest: pt(snap.fiscal.debt.latest), handover: pt(snap.fiscal.debt.handover) }
        : null,
      customs: snap.fiscal?.customs ?? null, interest: snap.fiscal?.interest ?? null,
    },
    eia: snap.eia ?? null, chain: snap.chain ?? null, chokepoints: snap.chokepoints ?? null,
    nowcast: snap.nowcast ?? null, odds: snap.polymarket ?? null, receiptInputs: snap.receipt_inputs ?? null,
    breadth: { headline: bh, median: bmed, gap: bh && bmed ? bh.value - bmed.value : null },
    eventStudy: snap.event_study ?? null,
    sources: {
      crudePeakNote: peak
        ? `The spot peak is ${money(peak.value)} on ${day(peak.date)}. An earlier version of this page quoted $114.01 on 6 April, which is the previous day's close.`
        : '',
    },
  };
}
