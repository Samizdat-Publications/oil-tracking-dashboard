/**
 * Live, where it is free.
 *
 * Two upstream sources publish with `Access-Control-Allow-Origin: *` and need
 * no key, so the browser can read them directly after the snapshot renders:
 *
 *   - Treasury Fiscal Data, debt to the penny (daily)
 *   - IMF PortWatch, Strait of Hormuz daily transits (AIS-counted)
 *
 * Everything else (FRED, EIA) needs a key and stays server-side in the
 * snapshot. The patch is deliberately narrow: it touches two readouts and
 * marks them "LIVE · as of". It never touches anything that feeds the ticker
 * or the OG card, so the shareable numbers cannot disagree with the deploy.
 *
 * Failure is silent: the snapshot value stands.
 */

export interface LivePatch {
  debt?: { date: string; value: number };
  hormuz?: { latest: { date: string; total: number; tanker: number | null }; mean7: number | null; tanker7: number | null };
}

const FISCAL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const PORTWATCH = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); ac.abort(); }, { once: true });
  return ac.signal;
}

async function fetchDebt(signal?: AbortSignal): Promise<LivePatch['debt']> {
  const r = await fetch(FISCAL, { signal: withTimeout(signal, 6000) });
  if (!r.ok) throw new Error(`fiscal ${r.status}`);
  const j = await r.json();
  const row = j?.data?.[0];
  const v = Number(row?.tot_pub_debt_out_amt);
  if (!row?.record_date || !Number.isFinite(v)) throw new Error('fiscal shape');
  return { date: row.record_date, value: v };
}

async function fetchHormuz(signal?: AbortSignal): Promise<LivePatch['hormuz']> {
  const since = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    where: `portname = 'Strait of Hormuz' AND date >= DATE '${since}'`,
    outFields: 'date,n_total,n_tanker', orderByFields: 'date ASC', f: 'json',
  });
  const r = await fetch(`${PORTWATCH}?${params}`, { signal: withTimeout(signal, 6000) });
  if (!r.ok) throw new Error(`portwatch ${r.status}`);
  const j = await r.json();
  const rows: { date: string; total: number; tanker: number | null }[] = (j?.features ?? [])
    .map((f: any) => f.attributes)
    .filter((a: any) => a && a.n_total !== null && a.n_total !== undefined)
    .map((a: any) => ({
      date: typeof a.date === 'number' ? new Date(a.date).toISOString().slice(0, 10) : String(a.date).slice(0, 10),
      total: Number(a.n_total), tanker: a.n_tanker === null || a.n_tanker === undefined ? null : Number(a.n_tanker),
    }))
    .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
  if (!rows.length) throw new Error('portwatch empty');
  const last7 = rows.slice(-7);
  const mean7 = last7.reduce((s, x) => s + x.total, 0) / last7.length;
  const tk = last7.filter((x) => x.tanker !== null);
  const tanker7 = tk.length ? tk.reduce((s, x) => s + (x.tanker as number), 0) / tk.length : null;
  return { latest: rows[rows.length - 1], mean7, tanker7 };
}

/** Both fetches, independently; whichever succeeds is returned. */
export async function fetchLive(signal?: AbortSignal): Promise<LivePatch> {
  const [debt, hormuz] = await Promise.allSettled([fetchDebt(signal), fetchHormuz(signal)]);
  const patch: LivePatch = {};
  if (debt.status === 'fulfilled' && debt.value) patch.debt = debt.value;
  if (hormuz.status === 'fulfilled' && hormuz.value) patch.hormuz = hormuz.value;
  return patch;
}

export interface LiveMark { asOf: string; source: string }

/**
 * Apply a patch to a figures object. Pure; returns a shallow copy with only the
 * two readouts replaced, and only when the live value is newer than what the
 * snapshot already had.
 */
export function applyLive<T extends { trade: { portwatch: any }; fiscal?: any }>(fig: T, patch: LivePatch): T {
  let out = fig;
  if (patch.hormuz && fig.trade?.portwatch) {
    const pw = fig.trade.portwatch;
    if (!pw.latestDate || patch.hormuz.latest.date > pw.latestDate) {
      out = {
        ...out,
        trade: {
          ...out.trade,
          portwatch: {
            ...pw,
            mean7: patch.hormuz.mean7, tanker7: patch.hormuz.tanker7,
            latestDate: patch.hormuz.latest.date,
            pct: pw.baseline && patch.hormuz.mean7 !== null ? (patch.hormuz.mean7 / pw.baseline) * 100 : pw.pct,
            live: { asOf: patch.hormuz.latest.date, source: 'IMF PortWatch, fetched in your browser' } as LiveMark,
          },
        },
      };
    }
  }
  if (patch.debt) {
    const prev = out.fiscal?.debt?.latest;
    if (!prev || patch.debt.date > prev.date) {
      out = {
        ...out,
        fiscal: {
          ...(out.fiscal ?? {}),
          debt: { ...(out.fiscal?.debt ?? {}), latest: patch.debt,
                  live: { asOf: patch.debt.date, source: 'Treasury Fiscal Data, fetched in your browser' } as LiveMark },
        },
      };
    }
  }
  return out;
}
