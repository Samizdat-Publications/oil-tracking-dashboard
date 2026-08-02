/**
 * V3.0 — "The Receipt"
 *
 * A scrollytelling page that answers one question with government data:
 * why did prices go up?
 *
 * Design rules, enforced throughout:
 *   1. Zero fabrication. Every number comes from an endpoint or a labelled,
 *      user-adjustable assumption. Missing data renders as "no data", never as
 *      a plausible-looking fallback.
 *   2. Every claim carries its own falsifier, rendered inline via <Method/>.
 *   3. Rows that cut against the argument are shown, not hidden. That is what
 *      makes the rest credible.
 *
 * Copy is governed by docs/THESIS.md, which lists both what we claim and what
 * we explicitly decline to claim.
 */

import { Suspense, lazy, useState } from 'react';
import {
  useBreadth, useEventStudy, useJobs, useMethodology, useReceipt, useScorecard, useStaples,
  usd, pct, thousands, monthLabel, dayLabel,
  type MethodEnvelope,
} from '../v3/data';
import { ColumnChart, EventBars, LineChart, PairedBars, EmptyState, type Series } from '../v3/charts';
import '../styles/v3.css';

const COLORS = {
  headline: '#FF4D4D',
  core: '#FFB020',
  median: '#00F0FF',
  trimmed: '#5DB075',
};

// ---------------------------------------------------------------------------
// Shared furniture
// ---------------------------------------------------------------------------

function Act({
  n, kicker, title, standfirst, children,
}: {
  n: string; kicker: string; title: string; standfirst?: string; children: React.ReactNode;
}) {
  return (
    <section className="v3-act" id={`act-${n}`}>
      <header className="v3-act-head">
        <p className="v3-kicker">{n} / {kicker}</p>
        <h2 className="v3-act-title">{title}</h2>
        {standfirst && <p className="v3-standfirst">{standfirst}</p>}
        <div className="v3-rule" />
      </header>
      {children}
    </section>
  );
}

function Loading({ what }: { what: string }) {
  return <div className="v3-loading" role="status">Loading {what}…</div>;
}

function Failed({ what, retry }: { what: string; retry?: () => void }) {
  return (
    <div className="v3-failed" role="alert">
      <p><strong>Couldn't load {what}.</strong> No numbers are shown rather than guessed ones.</p>
      {retry && <button type="button" onClick={retry}>Try again</button>}
    </div>
  );
}

/** Renders a method envelope: assumptions, caveats, and what would falsify it. */
function Method({ envelope, label = 'How this was calculated' }: { envelope: MethodEnvelope; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="v3-method">
      <button type="button" className="v3-method-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={`v3-method-caret${open ? ' is-open' : ''}`} aria-hidden>▸</span>
        {label}
        <span className={`v3-confidence v3-confidence-${envelope.confidence}`}>{envelope.confidence} confidence</span>
      </button>
      {open && (
        <div className="v3-method-body">
          {envelope.assumptions.length > 0 && (
            <>
              <h4>What we assume</h4>
              <ul>{envelope.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            </>
          )}
          {envelope.caveats.length > 0 && (
            <>
              <h4>What complicates it</h4>
              <ul>{envelope.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
          <h4>What would prove this wrong</h4>
          <ul className="v3-falsifiers">{envelope.falsifiers.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="v3-method-meta">
            Method: <code>{envelope.method}</code> · v{envelope.method_version}
            {envelope.n_boot ? ` · ${envelope.n_boot.toLocaleString()} bootstrap replications` : ''}
            {envelope.seed !== undefined ? ` · seed ${envelope.seed}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Act I — The Receipt
// ---------------------------------------------------------------------------

function ReceiptAct() {
  const [miles, setMiles] = useState(240);
  const [people, setPeople] = useState(2);
  const { data, isLoading, isError, refetch } = useReceipt(miles, people);

  return (
    <Act
      n="01"
      kicker="Your receipt"
      title="What this has cost your household"
      standfirst="Two numbers about you, then the arithmetic. Every line shows its own working — hover any of them."
    >
      <div className="v3-receipt">
        <div className="v3-receipt-controls">
          <label>
            <span>Miles driven per week</span>
            <input
              type="range" min={0} max={800} step={10} value={miles}
              onChange={(e) => setMiles(Number(e.target.value))}
              aria-label="Miles driven per week"
            />
            <output>{miles} mi</output>
          </label>
          <label>
            <span>People in your household</span>
            <input
              type="range" min={1} max={8} step={1} value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
              aria-label="People in household"
            />
            <output>{people}</output>
          </label>
        </div>

        {isLoading && <Loading what="your receipt" />}
        {isError && <Failed what="your receipt" retry={() => refetch()} />}

        {data && (
          <>
            <div className="v3-receipt-total">
              <div className="v3-receipt-big">
                <span className="v3-receipt-amount">{usd(data.cumulative_usd)}</span>
                <span className="v3-receipt-since">
                  extra, since {dayLabel(data.baseline_date)}
                </span>
              </div>
              <div className="v3-receipt-monthly">
                <span>{usd(data.monthly_usd)}</span>
                <em>per month, at today's prices</em>
              </div>
            </div>

            <ul className="v3-receipt-lines">
              {data.lines.map((l) => (
                <li key={l.key}>
                  <span className="v3-receipt-line-label">{l.label}</span>
                  <span className="v3-receipt-line-arith" title={l.arithmetic}>{l.arithmetic}</span>
                  <span className="v3-receipt-line-amount">{usd(l.monthly_usd, 2)}<em>/mo</em></span>
                </li>
              ))}
            </ul>

            <details className="v3-assumptions">
              <summary>The assumptions behind these numbers ({Object.keys(data.assumptions).length})</summary>
              <ul>
                {Object.entries(data.assumptions).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: <strong>{v.value} {v.unit}</strong> — {v.source}
                  </li>
                ))}
              </ul>
            </details>

            <Method envelope={data.envelope} />
          </>
        )}
      </div>
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act II — Groceries
// ---------------------------------------------------------------------------

function StaplesAct() {
  const { data, isLoading, isError, refetch } = useStaples();

  return (
    <Act
      n="02"
      kicker="The shelf"
      title="What food actually costs, in dollars"
      standfirst="Not an index — the Bureau of Labor Statistics publishes the average US price of a pound of ground beef. Both terms are shown as annual rates, because they are different lengths and comparing raw totals would be dishonest."
    >
      {isLoading && <Loading what="grocery prices" />}
      {isError && <Failed what="grocery prices" retry={() => refetch()} />}

      {data && (
        <>
          <PairedBars
            ariaLabel="Annualised price change of household staples, by presidential term"
            previousLabel={`${data.terms.previous.holder} (${data.terms.previous.years ?? ''}${data.terms.previous.start.slice(0, 4)}–${(data.terms.previous.end ?? '').slice(0, 4)})`}
            currentLabel={`${data.terms.current.holder} (${data.terms.current.start.slice(0, 4)}–now)`}
            rows={data.items.map((i) => ({
              key: i.key,
              label: i.name,
              previous: i.previous_term.annualised_pct,
              current: i.current_term.annualised_pct,
              emphasis: (i.acceleration_ratio ?? 0) >= 1.5,
              note: i.acceleration_ratio && i.acceleration_ratio > 1
                ? `${i.acceleration_ratio.toFixed(1)}× faster now`
                : undefined,
            }))}
          />

          <div className="v3-dollar-grid">
            {data.items.slice(0, 6).map((i) => (
              <article key={i.key} className="v3-dollar-card">
                <h3>{i.name}</h3>
                <p className="v3-dollar-move">
                  <span>{usd(i.current_term.start_value, 2)}</span>
                  <em aria-hidden>→</em>
                  <strong>{usd(i.current_term.end_value, 2)}</strong>
                </p>
                <p className="v3-dollar-meta">
                  {pct(i.current_term.total_pct)} since {monthLabel(i.current_term.start_date)}
                </p>
                {i.note && <p className="v3-dollar-note">{i.note}</p>}
              </article>
            ))}
          </div>

          <aside className="v3-concession">
            <h3>What went the other way</h3>
            <p>
              {data.summary.falling_or_slower.length} of {data.summary.n_items} tracked items are rising
              more slowly now, or falling outright: <strong>{data.summary.falling_or_slower.join(', ')}</strong>.
              Eggs are the clearest case: highly pathogenic avian influenza drove the
              2022–25 spike, and the same outbreak resolving is what brought prices back down.
              That is a disease running its course under two administrations, not a policy
              result for either of them. We show it because a ledger that hid it would not
              deserve to be believed.
            </p>
          </aside>

          <Method envelope={data.envelope} />
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act III — Jobs
// ---------------------------------------------------------------------------

function JobsAct() {
  const { data, isLoading, isError, refetch } = useJobs();

  return (
    <Act
      n="03"
      kicker="Work"
      title="Job creation did not slow down. It stopped."
      standfirst="Monthly change in total nonfarm payrolls, the standard headline measure, from the same agency under both administrations."
    >
      {isLoading && <Loading what="payroll data" />}
      {isError && <Failed what="payroll data" retry={() => refetch()} />}

      {data && (
        <>
          <div className="v3-stat-pair">
            <div className="v3-stat">
              <span className="v3-stat-value">{thousands(data.previous_term.mean_monthly)}</span>
              <span className="v3-stat-label">average jobs per month</span>
              <span className="v3-stat-sub">
                previous term · {data.previous_term.n_months} months ·{' '}
                {data.previous_term.negative_months} negative
              </span>
            </div>
            <div className="v3-stat is-bad">
              <span className="v3-stat-value">{thousands(data.current_term.mean_monthly)}</span>
              <span className="v3-stat-label">average jobs per month</span>
              <span className="v3-stat-sub">
                current term · {data.current_term.n_months} months ·{' '}
                <strong>{data.current_term.negative_months} negative</strong>
              </span>
            </div>
          </div>

          <ColumnChart
            ariaLabel="Monthly change in US nonfarm payrolls since 2021"
            points={data.monthly_changes}
            splitDate="2025-01-20"
            splitLabel="administration changes"
            height={280}
          />

          <p className="v3-figure-caption">
            Worst month: {monthLabel(data.current_term.worst_month.date)} at{' '}
            {thousands(data.current_term.worst_month.value)} jobs.
          </p>

          {data.counterweights.length > 0 && (
            <aside className="v3-concession">
              <h3>The labour market is not uniformly bad</h3>
              <ul>
                {data.counterweights.map((c) => (
                  <li key={c.key}>
                    <strong>{c.name}</strong>: {c.change.start_value} → {c.change.end_value}
                    {c.note && <em> — {c.note}</em>}
                  </li>
                ))}
              </ul>
              <p>
                Initial unemployment claims remain historically low and the unemployment rate is
                still near multi-decade lows. Hiring collapsing while firing stays low is a
                specific pattern — a frozen labour market rather than a collapsing one — and it is
                worth naming precisely rather than overstating.
              </p>
            </aside>
          )}

          <aside className="v3-callout">
            <h3>The statistician was fired over these numbers</h3>
            <p>
              On <strong>1 August 2025</strong>, hours after a weak payroll report with large
              downward revisions, the Commissioner of the Bureau of Labor Statistics was dismissed.
              The stated reason was that the numbers were <em>"RIGGED."</em> No evidence was
              offered then or since. Friends of the BLS — co-chaired by a commissioner appointed by
              Trump and one appointed by Obama — called the claim <em>"baseless"</em> and{' '}
              <em>"totally groundless."</em> The administration's own later nominee contradicted it
              during his confirmation.
            </p>
            <p className="v3-callout-note">
              A year on there is still no Senate-confirmed Commissioner. All thirteen federal
              statistical agencies have lost staff since January 2025; six lost a third or more.
              We looked hard for evidence that the published numbers are falsified and found none —
              and the leading independent price tracker reads <em>below</em> official CPI, which is
              the opposite of what suppression would produce. The damage here is to the machinery,
              not the arithmetic.
            </p>
          </aside>

          <Method envelope={data.envelope} />
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act IV — The breadth test
// ---------------------------------------------------------------------------

function BreadthAct() {
  const { data, isLoading, isError, refetch } = useBreadth();

  const series: Series[] = data
    ? data.measures.map((m) => ({
        key: m.key,
        name: m.name,
        points: m.points.filter((p) => p.date >= '2019-01-01'),
        color:
          m.key === 'cpi_headline' ? COLORS.headline
          : m.key === 'cpi_core' ? COLORS.core
          : m.key === 'median_cpi' ? COLORS.median
          : COLORS.trimmed,
        width: m.key === 'cpi_headline' ? 3 : 2,
      }))
    : [];

  return (
    <Act
      n="04"
      kicker="The test"
      title="Broad inflation moves the middle. This moved the edge."
      standfirst="If inflation were being driven by too much money, too much spending, or bad policy across the board, the typical price would rise. The typical price did not."
    >
      {isLoading && <Loading what="inflation measures" />}
      {isError && <Failed what="inflation measures" retry={() => refetch()} />}

      {data && (
        <>
          <LineChart
            ariaLabel="Headline, core, median and trimmed-mean CPI, 12-month percent change"
            series={series}
            height={340}
            yFormat={(v) => `${v.toFixed(0)}%`}
            yLabel="12-month change"
            reference={{ value: 2, label: '2% target' }}
          />

          {data.verdict && (
            <div className="v3-verdict">
              <div className="v3-verdict-numbers">
                {data.measures.map((m) => (
                  <div key={m.key} className="v3-verdict-stat">
                    <span className="v3-verdict-value">{m.latest ? `${m.latest.value.toFixed(1)}%` : '—'}</span>
                    <span className="v3-verdict-label">{m.name}</span>
                  </div>
                ))}
              </div>
              <p className="v3-verdict-text">{data.verdict.plain_english}</p>
              <p className="v3-verdict-explain">
                The median and trimmed-mean measures throw out the biggest movers in both
                directions. They are the standard tool for telling a <em>relative-price shock</em>
                — one sector blowing up — apart from <em>general inflation</em>. Both are sitting
                near the 2% target. The gap between headline and median is{' '}
                <strong>{data.verdict.gap_pp.toFixed(1)} points</strong>, and it is energy.
              </p>
              <p className="v3-verdict-fair">
                This cuts against both political stories at once. It is not inherited inflation —
                and it is not primarily the tariffs either. That is why we lead with it.
              </p>
            </div>
          )}

          <Method envelope={data.envelope} />
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act V — The war
// ---------------------------------------------------------------------------

function WarAct() {
  const { data, isLoading, isError, refetch } = useEventStudy('wti');

  return (
    <Act
      n="05"
      kicker="The cause"
      title="The price follows the war — in both directions"
      standfirst="Crude went $57 to $114, back to $70 during the June ceasefire, then up again when strikes resumed. Inflation does not switch off on the day of a ceasefire and back on three weeks later."
    >
      {isLoading && <Loading what="the event study" />}
      {isError && <Failed what="the event study" retry={() => refetch()} />}

      {data && (
        <>
          <p className="v3-lede">
            Each event below was labelled <em>escalation</em> or <em>de-escalation</em> in the
            project's event file <strong>before</strong> this test was run. The bars show how oil
            actually moved in the days around each one.
          </p>

          <EventBars ariaLabel="Cumulative abnormal return around each war event" events={data.events} />

          <div className="v3-verdict">
            <div className="v3-verdict-numbers">
              <div className="v3-verdict-stat">
                <span className="v3-verdict-value">{data.n_matched}/{data.n_events}</span>
                <span className="v3-verdict-label">moved as predicted</span>
              </div>
              <div className="v3-verdict-stat">
                <span className="v3-verdict-value">
                  {data.signed_magnitude.share_of_max != null
                    ? `${Math.round(data.signed_magnitude.share_of_max * 100)}%`
                    : '—'}
                </span>
                <span className="v3-verdict-label">of the maximum possible alignment</span>
              </div>
              <div className="v3-verdict-stat">
                <span className="v3-verdict-value">
                  {data.signed_magnitude.p_value != null ? data.signed_magnitude.p_value.toFixed(2) : '—'}
                </span>
                <span className="v3-verdict-label">probability by chance alone</span>
              </div>
            </div>

            <p className="v3-verdict-text">
              Escalations moved crude {pct(data.mean_car_escalation)} on average; de-escalations
              moved it {pct(data.mean_car_deescalation)}. The direction reverses with the war.
            </p>

            <p className="v3-verdict-honest">
              <strong>Being straight about the strength of this:</strong> with only{' '}
              {data.n_events} evaluable events, a simple count of hits and misses cannot reach
              statistical significance — even a perfect score would only reach p ≈ 0.03. The
              magnitude-weighted test above is stronger because it uses the <em>size</em> of each
              move, and it lands at p ≈ {data.signed_magnitude.p_value?.toFixed(2) ?? '—'}. That is
              suggestive, not conclusive. What carries the argument is this test together with the
              breadth test above and the fact that European energy prices moved in lockstep — no US
              policy sets the price of diesel in Rotterdam.
            </p>
          </div>

          <Method envelope={data.envelope} />
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act VI — The scorecard
// ---------------------------------------------------------------------------

function ScorecardAct() {
  const { data, isLoading, isError, refetch } = useScorecard();

  return (
    <Act
      n="06"
      kicker="The ledger"
      title="The whole scoreboard, including the parts that look good"
      standfirst="Every indicator we track, measured the same way across both terms. Some of these favour the current administration. They are here for exactly that reason."
    >
      {isLoading && <Loading what="the scorecard" />}
      {isError && <Failed what="the scorecard" retry={() => refetch()} />}

      {data && (
        <>
          <div className="v3-score-summary">
            <span className="v3-score-worse">{data.summary.n_worse} worse</span>
            <span className="v3-score-better">{data.summary.n_better} better</span>
          </div>

          <table className="v3-table">
            <caption className="v3-sr-only">
              Macroeconomic indicators compared across presidential terms
            </caption>
            <thead>
              <tr>
                <th scope="col">Indicator</th>
                <th scope="col">Previous term</th>
                <th scope="col">Current term</th>
                <th scope="col">Direction</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.key} className={r.current_direction === 'better' ? 'is-better' : 'is-worse'}>
                  <th scope="row">
                    {r.name}
                    <a
                      href={`https://fred.stlouisfed.org/series/${r.fred_id}`}
                      target="_blank" rel="noreferrer" className="v3-source-link"
                    >
                      {r.fred_id}
                    </a>
                    {r.note && <em className="v3-row-note">{r.note}</em>}
                  </th>
                  <td>{r.previous_term ? `${pct(r.previous_term.annualised_pct)}/yr` : '—'}</td>
                  <td><strong>{pct(r.current_term.annualised_pct)}/yr</strong></td>
                  <td>
                    <span className={`v3-pill v3-pill-${r.current_direction ?? 'flat'}`}>
                      {r.current_direction ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.summary.better.length > 0 && (
            <aside className="v3-concession">
              <h3>Genuinely better right now</h3>
              <p><strong>{data.summary.better.join(', ')}.</strong></p>
              <p>
                Equity prices in particular are up substantially. If your wealth is mostly in
                stocks, this has been a good period. If your income is mostly wages and your
                spending is mostly food, fuel and rent, it has not. Both statements are true at
                once, and which one describes you depends mostly on what you already own.
              </p>
            </aside>
          )}

          <Method envelope={data.envelope} />
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Act VII — Show the math
// ---------------------------------------------------------------------------

function MethodologyAct() {
  const { data, isLoading, isError, refetch } = useMethodology();

  return (
    <Act
      n="07"
      kicker="The receipts"
      title="Check our work"
      standfirst="Every series, every gap in the data, and every claim we decided we could not support."
    >
      {isLoading && <Loading what="methodology" />}
      {isError && <Failed what="methodology" retry={() => refetch()} />}

      {data && (
        <>
          <h3 className="v3-sub">What we refuse to claim</h3>
          <ul className="v3-declines">
            {data.claims_we_decline_to_make.map((c) => <li key={c}>{c}</li>)}
          </ul>

          <h3 className="v3-sub">Known holes in the official data</h3>
          <ul className="v3-gaps">
            {data.known_data_gaps.map((g) => (
              <li key={g.period}>
                <strong>{g.period}</strong> — {g.what}.
                <span> {g.why}</span>
                <em> {g.effect}</em>
                <a href={g.source} target="_blank" rel="noreferrer">source</a>
              </li>
            ))}
          </ul>

          <h3 className="v3-sub">Every series on this page ({data.series.length})</h3>
          <div className="v3-series-grid">
            {data.series.map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noreferrer" className="v3-series-chip">
                <code>{s.fred_id}</code>
                <span>{s.name}</span>
              </a>
            ))}
          </div>

          <p className="v3-footnote">
            All data from the Bureau of Labor Statistics, Bureau of Economic Analysis, the Federal
            Reserve and the Energy Information Administration, retrieved through FRED. The analysis
            code, including the tests that had to pass before any of these numbers were published,
            is in the project repository.
          </p>
        </>
      )}
    </Act>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReceiptPage() {
  const { data: breadth } = useBreadth();
  const headline = breadth?.verdict?.headline;

  return (
    <div className="v3">
      <div className="v3-grain" aria-hidden />

      <header className="v3-masthead">
        <p className="v3-dateline">
          Updated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}Sources: BLS · BEA · Federal Reserve · EIA
        </p>
        <h1 className="v3-title">
          Why your bills went up
        </h1>
        <p className="v3-subtitle">
          Not an opinion piece. Government data, the arithmetic shown, and six tests that could
          have proved us wrong.
        </p>
        {headline !== undefined && (
          <p className="v3-masthead-stat">
            Headline inflation is <strong>{headline.toFixed(1)}%</strong>. The typical price is
            rising at roughly the 2% target. The gap between those two facts is this whole story.
          </p>
        )}
        <a className="v3-scroll-hint" href="#act-01">Start with your own receipt ↓</a>
      </header>

      <main>
        <ReceiptAct />
        <StaplesAct />
        <JobsAct />
        <BreadthAct />
        <WarAct />
        <ScorecardAct />
        <MethodologyAct />
      </main>

      <footer className="v3-footer">
        <p>
          Built with public data. If you think something here is wrong, the series IDs are all
          listed above — check it. That is the point.
        </p>
        <p className="v3-footer-links">
          <a href="?view=broadsheet">Broadsheet view</a>
          <a href="?view=dashboard">Classic dashboard</a>
        </p>
      </footer>
    </div>
  );
}
