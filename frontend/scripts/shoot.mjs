/**
 * Capture one PNG per section for the README.
 *
 * Runs under `reducedMotion: 'reduce'`, which the page treats as "static but
 * COMPLETE" -- every counter at its final value, every bar grown, the strait
 * simulation stepped to a settled end state. That is exactly the frame a
 * screenshot wants, and it means these shots need no scroll-and-wait
 * choreography to come out right.
 *
 *   node scripts/shoot.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:4193/';
const OUT = process.argv[3] ?? '../docs/screenshots';

const SECTIONS = [
  ['masthead',   '01-masthead'],
  ['shelf',      '02-shelf'],
  ['crossing',   '03-crossing'],
  ['choices',    '04-choices'],
  ['work',       '05-work'],
  ['squeeze',    '06-squeeze'],
  ['gold',       '07-gold'],
  ['trade',      '08-trade'],
  ['strait',     '09-strait'],
  ['other-side', '10-other-side'],
  ['sources',    '11-sources'],
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

// Desktop: one shot per section.
const page = await browser.newPage({
  viewport: { width: 1400, height: 1000 },
  // Native 1400px, not 2x. GitHub renders the README column at roughly 900px, so
  // 1400 is already oversampled -- and the halftone dot texture on every section
  // ground is dithered noise that does not compress, so doubling the pixel count
  // quadrupled the repo weight for detail nobody can see.
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#sources', { timeout: 30000 }); // sections mount after the snapshot loads
await page.waitForTimeout(1200); // canvases settle

for (const [id, name] of SECTIONS) {
  const el = page.locator(`#${id}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await el.screenshot({ path: `${OUT}/${name}.png` });
  const box = await el.boundingBox();
  console.log(`${name}.png  ${Math.round(box.width)}x${Math.round(box.height)}`);
}

// Mobile: proof the container-query layout holds, not a second full gallery.
const m = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForSelector('#sources', { timeout: 30000 });
await m.waitForTimeout(1200);
for (const [id, name] of [['masthead', 'm-01-masthead'], ['work', 'm-05-work'], ['gold', 'm-07-gold'], ['strait', 'm-09-strait']]) {
  const el = m.locator(`#${id}`);
  await el.scrollIntoViewIfNeeded();
  await m.waitForTimeout(400);
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name}.png`);
}

// A horizontal-scroll assertion while we have a 390px page open: cheap, and it
// is the one thing a screenshot cannot show you.
const overflow = await m.evaluate(() =>
  document.documentElement.scrollWidth - window.innerWidth);
console.log(`mobile horizontal overflow: ${overflow}px`);

await browser.close();
