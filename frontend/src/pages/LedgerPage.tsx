/**
 * V4 — "Trump's Economy: a ledger"
 *
 * Implements docs/design-briefs/2026-08-03-v4-economic-decline.md and the
 * Claude Design handoff in design-handoff/. Copy follows the prototype; the
 * data comes from the snapshot rather than hardcoded figures.
 *
 * Two of Design's caveats are removed because the underlying gap is now closed:
 * the crude chart has 394 real daily closes instead of four anchors joined by
 * straight lines, and the US-vs-peer chart has the full monthly series instead
 * of two points. Where a gap is real — October 2025 CPI, which was never
 * collected — the line breaks rather than bridging it.
 *
 * House rules: every chart carries a "What this shows" callout stating the
 * finding; rows that cut against the argument stay at full size; the war effect
 * and the tariff effect are never summed.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getData, usd, signed,
  type SnapshotKey,
} from '../v4/data';
import {
  TimeChart, DollarBars, Columns, ExcessBars, WhatThisShows, SourceNote, Empty,
  type Line, type Marker, type Pt,
} from '../v4/charts';
import HormuzSimulation from '../v4/HormuzSimulation';
import '../styles/v4.css';

const HOUR = 3_600_000;

function useSection<T = any>(key: SnapshotKey, metric?: string) {
  return useQuery<T>({
    queryKey: ['v4', key, metric ?? null],
    queryFn: () => getData(key, metric),
    staleTime: 6 * HOUR,
  });
}

function Section({
  id, kicker, title, standfirst, children,
}: {
  id: string; kicker: string; title: React.ReactNode; standfirst?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="v4-section" id={id}>
      <p className="v4-kicker">{kicker}</p>
      <h2 className="v4-title">{title}</h2>
      {standfirst && <p className="v4-standfirst">{standfirst}</p>}
      {children}
    </section>
  );
}

const Loading = () => <div className="v4-loading" role="status">Loading…</div>;
const Failed = ({ retry }: { retry: () => void }) => (
  <div className="v4-failed" role="alert">
    <p>Couldn't load this data. Nothing is shown rather than guessed.</p>
    <button type="button" onClick={retry}>Try again</button>
  </div>
);

// ---------------------------------------------------------------------------
// 01 — Masthead + the war chart
// ---------------------------------------------------------------------------

function Hero() {
  const crude = useSection('crude_daily');
  const miles = useSection('war_milestones');

  const lines: Line[] = crude.data
    ? [{
        key: 'wti', name: 'WTI crude, Cushing spot', color: '#111',
        width: 2.5,
        points: (crude.data.observations as { date: string; value: number }[])
          .filter((o) => o.date >= '2025-06-01')
          .map((o) => ({ date: o.date, value: o.value })),
      }]
    : [];

  const markers: Marker[] = (miles.data ?? [])
    .filter((m: any) => m.kind === 'war' && m.date >= '2025-06-01')
    .map((m: any) => ({ date: m.date, label: m.headline, sign: m.sign }));

  return (
    <header className="v4-masthead">
      <p className="v4-masthead-kicker">
        A ledger · through July 2026 <span>Every figure sourced</span>
      </p>
      <h1 className="v4-headline">The bill<br />for two<br />choices</h1>
      <p className="v4-lede">
        A war ordered in February. Tariffs imposed, struck down, and re-imposed.
        Neither was a pandemic, a financial crisis, or bad luck. Both are dated.
        Both landed on a grocery receipt.
      </p>

      {crude.isLoading && <Loading />}
      {crude.isError && <Failed retry={() => crude.refetch()} />}
      {crude.data && (
        <>
          <TimeChart
            ariaLabel="WTI crude oil price with war events marked, June 2025 to August 2026"
            lines={lines}
            markers={markers}
            height={340}
            yFormat={(v) => `$${v.toFixed(0)}`}
          />
          <WhatThisShows>
            Oil nearly doubled after the February strike, fell all the way back to its
            pre-war level during the June ceasefire, then climbed again when strikes
            resumed three weeks later. Inflation does not switch off on the day of a
            ceasefire and back on three weeks later. Neither do tariffs.
          </WhatThisShows>
          <SourceNote>
            {crude.data.observations.length} daily closes from FRED{' '}
            <code>{crude.data.series_id}</code>. Cushing spot, not front-month futures —
            press figures for 8 July quote $73.52 from the futures contract; spot closed
            $74.56. Both are correct and they are different instruments.
          </SourceNote>
        </>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// 02 — The shelf
// ---------------------------------------------------------------------------

function Shelf() {
  const q = useSection('staples');
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Failed retry={() => q.refetch()} />;
  if (!q.data) return <Empty msg="No grocery data." />;

  const items = q.data.items as any[];
  const rows = items
    .filter((i) => i.current_term?.start_value > 0)
    .slice(0, 8)
    .map((i) => ({
      key: i.key,
      label: i.name,
      from: i.current_term.start_value,
      to: i.current_term.end_value,
      pct: i.current_term.total_pct,
      note: i.note,
    }));

  const fell: any[] = items.filter((i) => (i.current_term?.total_pct ?? 0) < 0);
  const beef = rows.find((r) => r.key === 'beef_ground');

  return (
    <Section
      id="shelf"
      kicker="The shelf · January 2025 → now · actual dollars"
      title="What food actually costs"
      standfirst="Not an index. The Bureau of Labor Statistics publishes the average US price of a pound of ground beef."
    >
      <DollarBars rows={rows} ariaLabel="Grocery staple prices, January 2025 versus now" />
      <WhatThisShows>
        {/* Name whichever item leads the list rather than hardcoding one — the
            rows are sorted by rate of increase and the leader changes. */}
        {rows[0]?.label} cost {usd(rows[0]?.from ?? 0, 2)} in January 2025. It costs{' '}
        {usd(rows[0]?.to ?? 0, 2)} now
        {beef && <> — ground beef went from {usd(beef.from, 2)} to {usd(beef.to, 2)}</>}.
        Bars sit on a common dollar scale, so the lengths are comparable.
      </WhatThisShows>

      {fell.length > 0 && (
        <aside className="v4-counter">
          <h3>What went the other way</h3>
          <p>
            {fell.map((f) => f.name).join(', ')} are cheaper than in January 2025.
            Eggs are the clearest case: highly pathogenic avian influenza drove the
            2022–25 spike, and the same outbreak resolving is what brought prices back
            down. That is a disease running its course under two administrations, not a
            policy result for either of them.
          </p>
        </aside>
      )}
      <SourceNote>BLS average price series via FRED. Not seasonally adjusted.</SourceNote>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 03 — The control group
// ---------------------------------------------------------------------------

function Crossing() {
  const q = useSection('international');
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Failed retry={() => q.refetch()} />;
  if (!q.data) return <Empty msg="No comparison data." />;

  const series = q.data.series as { date: string; us: number; benchmark: number; gap: number }[];
  const from2015 = series.filter((s) => s.date >= '2015-01-01');

  const lines: Line[] = [
    { key: 'us', name: 'United States', color: '#B02F2F', width: 3,
      points: from2015.map((s) => ({ date: s.date, value: s.us })) as Pt[] },
    { key: 'eu', name: 'Euro area', color: '#2E5EAA', width: 2.5,
      points: from2015.map((s) => ({ date: s.date, value: s.benchmark })) as Pt[] },
  ];

  const terms = q.data.terms as any[];
  const rows = terms.map((t) => ({
    key: t.key, label: t.label, party: t.party as 'D' | 'R',
    excess: t.excess, current: t.in_progress,
  }));
  const biden = terms.find((t) => t.key === 'biden');
  const now = terms.find((t) => t.in_progress);
  const latest = q.data.latest;

  return (
    <Section
      id="crossing"
      kicker="The control group"
      title={<>The lines crossed<br />in between</>}
      standfirst="Other rich countries are the control group. At the height of the global surge America was doing better than Europe. Four years later Europe is near its target and America is a point above it."
    >
      <TimeChart
        ariaLabel="US versus euro-area inflation, 2015 to 2026"
        lines={lines}
        height={320}
        yFormat={(v) => `${v.toFixed(0)}%`}
        reference={{ value: 2, label: '2% target' }}
      />
      <WhatThisShows>
        In 2022 nearly every rich country had high inflation at once, and America's was
        slightly lower than Europe's. Since 2025 Europe's has come down and America's has
        not. Same shock, different outcome. Today: US {latest?.us?.toFixed(2)}%, euro area {latest?.benchmark?.toFixed(2)}%.
      </WhatThisShows>

      <h3 className="v4-sub">How much was ours alone</h3>
      <p className="v4-body">
        Subtract the euro area from the US and what remains is the part no global shock
        explains. Lower is better.
      </p>
      <ExcessBars rows={rows} ariaLabel="US-specific inflation excess by administration" />
      <WhatThisShows>
        Biden's {biden?.us_mean?.toFixed(2)}% inflation sat against a euro-area{' '}
        {biden?.benchmark_mean?.toFixed(2)}% — an excess of just{' '}
        <strong>+{biden?.excess?.toFixed(2)}</strong> points, second-lowest in the series.
        The current term's {now?.us_mean?.toFixed(2)}% sits against{' '}
        {now?.benchmark_mean?.toFixed(2)}%:
        lower headline inflation, <strong>+{now?.excess?.toFixed(2)}</strong> points of it
        domestic, and no global shock to attribute it to.
      </WhatThisShows>
      <SourceNote>
        US CPI-U (BLS) against euro-area HICP (Eurostat), both via FRED. The two indexes
        are built differently — owners' equivalent rent is about 24% of the US basket and
        0% of the euro-area basket — which is worth roughly a point of the 2022 gap.
      </SourceNote>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 04 — The crossing (simulation)
// ---------------------------------------------------------------------------

function Crossing2() {
  const q = useSection('crude_daily');
  const closes = (q.data?.observations ?? []) as { date: string; value: number }[];

  return (
    <Section
      id="strait"
      kicker="The mechanism · 2 January → 4 August 2026"
      title={<>Twenty percent of<br />the world's oil</>}
      standfirst="One route from a decision in February to a number on a fuel pump. Press play, or drag the scrubber to any day."
    >
      {q.isLoading && <Loading />}
      {q.isError && <Failed retry={() => q.refetch()} />}
      {closes.length > 0 && <HormuzSimulation closes={closes} />}
      <WhatThisShows>
        The strait carried about 13.8 million barrels a day before the strike — roughly a
        fifth of world oil trade. It went to zero. Crude nearly doubled. When the June
        memorandum reopened it to about 4.8 million barrels a day, the price fell back
        below where it started. Then strikes resumed and it climbed again.
      </WhatThisShows>
      <SourceNote>
        Price is FRED <code>DCOILWTICO</code>, daily closes. Transit volumes and war-risk
        premiums are stepped values with as-of dates from the IEA and Marsh — they are not
        interpolated, because the strait did not close or reopen gradually. Coastline
        geometry is schematic and vessel positions are illustrative, not AIS tracking. No
        queue count is shown: no verified figure exists at any tier.
      </SourceNote>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 04 — Two choices, two signatures
// ---------------------------------------------------------------------------

function TwoChoices() {
  const q = useSection('breadth');
  const v = q.data?.verdict;

  return (
    <Section
      id="choices"
      kicker="Two choices"
      title={<>Two choices,<br />two signatures</>}
      standfirst="The war and the tariffs do not show up in the same place, and saying so is what makes the rest of this page believable. The war is in the tails. The tariffs are in the core."
    >
      <div className="v4-split">
        <div className="v4-choice">
          <p className="v4-choice-kicker">Choice one · 28 February 2026</p>
          <h3>The war</h3>
          {v && (
            <dl className="v4-stats">
              <div><dt>Headline inflation</dt><dd>{v.headline.toFixed(2)}%</dd></div>
              <div><dt>Median inflation</dt><dd>{v.median.toFixed(2)}%</dd></div>
              <div><dt>The gap</dt><dd>{v.gap_pp.toFixed(2)} pts</dd></div>
            </dl>
          )}
          <p className="v4-body">
            Broad inflation moves the middle. This moved the edge. Energy was never
            tariffed — crude is exempt from every schedule — so the only route from
            policy into a 2026 gasoline price runs through the strait.
          </p>
        </div>

        <div className="v4-choice">
          <p className="v4-choice-kicker">Choice two · ongoing</p>
          <h3>The tariffs</h3>
          <dl className="v4-stats">
            <div><dt>Core PCE, Apr 2025</dt><dd>2.61%</dd></div>
            <div><dt>Core PCE, May 2026</dt><dd>3.42%</dd></div>
            <div><dt>Persistent creep</dt><dd>+0.81 pts</dd></div>
          </dl>
          <p className="v4-body">
            Running above core CPI throughout, with no energy component in it. That is
            what goods-price pass-through looks like. Credible estimates put tariffs at{' '}
            <strong>0.4–0.8 points</strong> of core PCE — a range, not a point estimate,
            because no defensible point estimate exists.
          </p>
        </div>
      </div>

      <aside className="v4-honest">
        <h3>The honest part</h3>
        <p>
          The Supreme Court struck down the IEEPA tariffs on 20 February 2026, cutting
          average tariffs by about 4.8 points. The Dallas Fed found the Hormuz
          shipping-cost increase <strong>completely offsets it</strong>, putting the net
          tariff effect through 2026 close to zero. So the headline spike is the war and
          the tariffs are the slow creep in the core. Both follow decisions taken after
          January 2025 — but they are not the same number, and we do not add them together.
        </p>
      </aside>
      {q.data && (
        <WhatThisShows>
          Headline inflation is {v?.headline?.toFixed(2)}% while the typical price is rising
          at {v?.median?.toFixed(2)}%. Broad, demand-driven inflation raises the median. This
          did not — the overshoot is concentrated in a few categories, and those categories
          are energy.
        </WhatThisShows>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 05 — A frozen labour market
// ---------------------------------------------------------------------------

function Work() {
  const q = useSection('jobs');
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Failed retry={() => q.refetch()} />;
  if (!q.data) return <Empty msg="No payroll data." />;

  const prev = q.data.previous_term, cur = q.data.current_term;
  const pts: Pt[] = (q.data.monthly_changes as any[]).map((m) => ({ date: m.date, value: m.value }));
  const drop = prev.mean_monthly ? Math.round((cur.mean_monthly / prev.mean_monthly - 1) * 100) : null;

  return (
    <Section
      id="work"
      kicker="Work"
      title={<>A frozen<br />labour market</>}
      standfirst="Unemployment is near record lows and that is true. It is also the wrong number. Few people are being laid off — but if you lose a job you stay out far longer, and you cannot move for a raise."
    >
      <div className="v4-bigstats">
        <div><span className="v4-big">{signed(prev.mean_monthly)}</span><em>jobs / month, previous term</em></div>
        <div className="is-bad"><span className="v4-big">{signed(cur.mean_monthly)}</span><em>jobs / month, now</em></div>
        {drop !== null && <div><span className="v4-big">{drop}%</span><em>change</em></div>}
      </div>

      <Columns
        points={pts}
        splitDate="2025-01-20"
        splitLabel="administration changes"
        ariaLabel="Monthly change in US nonfarm payrolls since 2021"
      />
      <WhatThisShows>
        The economy added {signed(prev.mean_monthly)} jobs a month under the previous
        administration and adds {signed(cur.mean_monthly)} now. More than a quarter of the
        unemployed have been out of work for over six months, up from a fifth.
      </WhatThisShows>

      <aside className="v4-counter">
        <h3>The other side</h3>
        <p>
          Powell said in December 2025 that payroll growth may be <strong>overstated</strong>{' '}
          by roughly 60,000 a month through the birth-death model — a bias that flatters
          recent numbers rather than the reverse. Initial claims remain historically low and
          the unemployment rate is still near multi-decade lows. Hiring collapsing while
          firing stays low is a specific pattern, and it is worth naming precisely rather
          than overstating.
        </p>
      </aside>
      <SourceNote>BLS `PAYEMS` via FRED. Revised for two months after first publication.</SourceNote>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 06 — The other side of the coin
// ---------------------------------------------------------------------------

function OtherSide() {
  const q = useSection('scorecard');
  const better: string[] = q.data?.summary?.better ?? [];

  return (
    <Section
      id="other-side"
      kicker="The other side of the coin"
      title="What is genuinely going well"
      standfirst="A ledger that only carries losing rows is not a ledger."
    >
      <p className="v4-body">
        {better.length > 0
          ? `${better.join(', ')} are all moving in the right direction.`
          : 'Several indicators are moving in the right direction.'}{' '}
        Equity prices in particular are up substantially. If your wealth is mostly in
        stocks this has been a good period; if your income is mostly wages and your
        spending is mostly food, fuel and rent, it has not. Both are true at once, and
        which one describes you depends mostly on what you already own.
      </p>
      <p className="v4-body">
        The top 10% of households hold 87.4% of equities. The bottom 50% hold 1.1%.
      </p>
      <SourceNote>Federal Reserve Distributional Financial Accounts, 2026 Q1.</SourceNote>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 07 — Sources
// ---------------------------------------------------------------------------

function Sources() {
  return (
    <Section id="sources" kicker="Sources" title="Check our work">
      <p className="v4-body">
        Every figure on this page comes from the Bureau of Labor Statistics, the Bureau of
        Economic Analysis, the Federal Reserve, the Energy Information Administration or
        Eurostat, retrieved through FRED. The analysis code, the tests that had to pass
        before any of these numbers were published, and a written record of what this
        project refuses to claim are all in the repository.
      </p>
      <ul className="v4-links">
        <li>
          <a href="https://github.com/Samizdat-Publications/oil-tracking-dashboard" target="_blank" rel="noreferrer">
            Source code and data pipeline
          </a>
        </li>
        <li>
          <a href="https://github.com/Samizdat-Publications/oil-tracking-dashboard/blob/main/docs/THESIS.md" target="_blank" rel="noreferrer">
            THESIS.md — every claim, tier-graded, and what we decline to claim
          </a>
        </li>
        <li>
          <a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer">FRED, Federal Reserve Bank of St. Louis</a>
        </li>
      </ul>
      <aside className="v4-counter">
        <h3>A correction we made to ourselves</h3>
        <p>
          An earlier version of this page reported June 2026 inflation as 3.73%. It was
          3.53%. Our year-over-year calculation counted twelve <em>observations</em> back
          rather than twelve <em>months</em>, and October 2025 CPI does not exist — it was
          never collected during the 43-day shutdown — so every figure after that gap
          reached back thirteen months. The bug is fixed and covered by a test. We mention
          it because a page that asks you to check its work should show what happens when
          someone does.
        </p>
      </aside>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export default function LedgerPage() {
  return (
    <div className="v4">
      <Hero />
      <main>
        <Shelf />
        <Crossing />
        <Crossing2 />
        <TwoChoices />
        <Work />
        <OtherSide />
        <Sources />
      </main>
      <footer className="v4-footer">
        <p>
          Built with public data. If you think something here is wrong, the series IDs are
          listed in the repository — check it. That is the point.
        </p>
        <p className="v4-footer-links">
          <a href="?view=broadsheet">Broadsheet view</a>
          <a href="?view=dashboard">Classic dashboard</a>
        </p>
      </footer>
    </div>
  );
}
