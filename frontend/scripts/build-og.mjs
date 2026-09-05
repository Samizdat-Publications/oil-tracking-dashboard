/**
 * Render the Open Graph card to a real 1200x630 PNG.
 *
 * Facebook does not execute JavaScript, so og:image must be a static file that
 * already exists at the URL. It is also rendered about 158px wide in-feed,
 * which is why this is a purpose-built card carrying one number rather than a
 * screenshot of the hero — a screenshot is illegible at that size.
 *
 * Reads the same snapshot the page reads, so the card cannot drift from the
 * page. If the snapshot is missing or malformed this exits non-zero rather than
 * shipping a card with placeholder figures.
 *
 * Run after `npm run build`:  node scripts/build-og.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../public/data-snapshot.json');
const OUT = resolve(here, '../public/og.png');
const HTML_OUT = resolve(here, '../public/og.html');

if (!existsSync(SNAPSHOT)) {
  console.error(`og: ${SNAPSHOT} not found. Run backend/scripts/build_snapshot.py first.`);
  process.exit(1);
}

const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf-8'));

// Pull every figure from the snapshot. Nothing on the card is typed by hand.
const intl = snap.international;
const staples = snap.staples?.items ?? [];
const jobs = snap.jobs;

const byKey = (k) => staples.find((s) => s.key === k);
const beef = byKey('beef_ground');
const coffee = byKey('coffee');

const now = intl?.terms?.find((t) => t.in_progress);
const biden = intl?.terms?.find((t) => t.key === 'biden');

const jobsEnd = jobs?.current_term?.end ?? null;
const asOf = jobsEnd
  ? `through ${new Date(`${jobsEnd}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  : 'through the latest data';

const required = { intl, beef, coffee, jobs, now, biden };
for (const [name, v] of Object.entries(required)) {
  if (!v) {
    console.error(`og: snapshot is missing "${name}" — refusing to render a card with gaps.`);
    process.exit(1);
  }
}

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n) => `$${n.toFixed(2)}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 1200px 630px; margin: 0 }
  * { margin:0; padding:0; box-sizing:border-box }
  body {
    width:1200px; height:630px; background:#f7f5f0; color:#14171c;
    font-family: Archivo, Helvetica, Arial, sans-serif;
    display:flex; flex-direction:column; padding:56px 64px;
  }
  .kicker {
    font-family: ui-monospace, Menlo, monospace; font-size:19px; letter-spacing:.18em;
    text-transform:uppercase; color:#4a5058;
    border-bottom:1px solid #d6d1c6; padding-bottom:18px; margin-bottom:34px;
    display:flex; justify-content:space-between;
  }
  .kicker b { color:#9a7b2f; font-weight:600 }
  h1 { font-size:82px; line-height:.95; letter-spacing:-.03em; font-weight:800; margin-bottom:26px }
  .sub { font-size:27px; color:#4a5058; max-width:960px; line-height:1.35 }
  .grid { display:flex; gap:52px; margin-top:auto; padding-top:30px; border-top:3px solid #14171c }
  .stat { flex:1 }
  .num {
    font-family: ui-monospace, Menlo, monospace; font-size:52px; font-weight:700;
    line-height:1; color:#b02f2f;
  }
  .num.blue { color:#2e5eaa }
  .lbl { font-size:18px; color:#4a5058; margin-top:10px; line-height:1.3 }
  .src {
    font-family: ui-monospace, Menlo, monospace; font-size:15px; color:#767d87;
    margin-top:26px;
  }
</style></head><body>
  <div class="kicker"><span>A ledger &middot; ${asOf}</span><b>Every figure sourced</b></div>
  <h1>The bill for two choices</h1>
  <p class="sub">A war ordered in February. Tariffs imposed, struck down, re-imposed.
     Seven months on the strait is still shut, and foreign gold is leaving the New York Fed.</p>
  <div class="grid">
    <div class="stat">
      <div class="num">${money(beef.current_term.end_value)}</div>
      <div class="lbl">a pound of ground beef,<br>from ${money(beef.current_term.start_value)} in Jan 2025</div>
    </div>
    <div class="stat">
      <div class="num">${money(coffee.current_term.end_value)}</div>
      <div class="lbl">a pound of coffee,<br>from ${money(coffee.current_term.start_value)}</div>
    </div>
    <div class="stat">
      <div class="num">${fmt(jobs.current_term.mean_monthly)}</div>
      <div class="lbl">jobs a month now,<br>down from ${fmt(jobs.previous_term.mean_monthly)}</div>
    </div>
    <div class="stat">
      <div class="num blue">+${now.excess.toFixed(2)}</div>
      <div class="lbl">points of inflation<br>no global shock explains</div>
    </div>
  </div>
  <div class="src">BLS &middot; BEA &middot; Federal Reserve &middot; EIA &middot; Eurostat, via FRED</div>
</body></html>`;

writeFileSync(HTML_OUT, html, 'utf-8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();

console.log(`og: wrote ${OUT}`);
console.log(`    beef ${money(beef.current_term.end_value)} · coffee ${money(coffee.current_term.end_value)} · ` +
            `jobs ${fmt(jobs.current_term.mean_monthly)} · excess +${now.excess.toFixed(2)}`);
