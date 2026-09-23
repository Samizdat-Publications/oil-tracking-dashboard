/**
 * Screenshots and animation frames of V5 "The Bill", for the README and the
 * GitHub Pages landing page (docs/index.html).
 *
 *   npx vite preview --port 4315          (in another terminal)
 *   node scripts/shoot-v5.mjs http://localhost:4315/ ../docs/screens
 *   py scripts/frames-to-media.py ../docs/screens
 *
 * Stills are taken under reduced motion, which the page maps to every block
 * at its end state. Animations are stepped with Playwright's fake clock, which
 * drives requestAnimationFrame and performance.now, so every clip gets evenly
 * spaced frames however slow the screenshots are.
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4315/';
const OUT = process.argv[3] ?? '../docs/screens';

// screen label prefix -> file stem
const BLOCKS = [
  ['00', '00-globe'], ['01', '01-two-dates'], ['02', '02-oil'], ['03', '03-strait'],
  ['04', '04-prices'], ['05', '05-jobs'], ['06', '06-war-cost'], ['07', '07-what-it-buys'],
  ['08', '08-gold'], ['09', '09-bill'], ['10', '10-check-our-work'],
];
// clips: block, seconds, frames per second, and how to drive it
const CLIPS = [
  { key: '00', stem: 'globe', secs: 6, fps: 15, scroll: true },
  { key: '02', stem: 'oil', secs: 8, fps: 12 },
  { key: '03', stem: 'strait', secs: 7, fps: 15 },
  { key: '04', stem: 'prices', secs: 6, fps: 12 },
  { key: '05', stem: 'jobs', secs: 8, fps: 12 },
  { key: '06', stem: 'war-cost', secs: 8, fps: 12 },
  { key: '08', stem: 'gold', secs: 7, fps: 12 },
  { key: '09', stem: 'bill', secs: 3.5, fps: 15 },
];

// ONLY=strait,globe limits a run to those clips and skips the stills
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const top = (page, key) => page.evaluate(k => {
  const s = [...document.querySelectorAll('section')].find(x => (x.dataset.screenLabel || '').startsWith(k));
  return s.getBoundingClientRect().top + scrollY;
}, key);

await mkdir(join(OUT, 'frames'), { recursive: true });
const browser = await chromium.launch();

// 1. Desktop stills, every block at its end state.
if (!ONLY) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  for (const [key, stem] of BLOCKS) {
    await page.evaluate(y => scrollTo(0, y), await top(page, key));
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, stem + '.jpg'), type: 'jpeg', quality: 86 });
    console.log('still', stem);
  }
  await page.close();
}

// 2. Phone stills.
if (!ONLY) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  for (const [key, stem] of [['00', 'phone-globe'], ['04', 'phone-prices'], ['09', 'phone-bill']]) {
    await page.evaluate(y => scrollTo(0, y), await top(page, key));
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, stem + '.jpg'), type: 'jpeg', quality: 84 });
    console.log('still', stem);
  }
  await page.close();
}

// 3. Animation frames, stepped on a fake clock.
for (const c of CLIPS.filter(c => !ONLY || ONLY.includes(c.stem))) {
  const dir = join(OUT, 'frames', c.stem);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.clock.install();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.clock.runFor(4000);
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(1500);
  const y0 = await top(page, c.key);
  const n = Math.round(c.secs * c.fps);
  if (c.scroll) {
    // block 00 is scroll-driven: walk the scroll range instead of the clock
    const span = await page.evaluate(k => {
      const s = [...document.querySelectorAll('section')].find(x => (x.dataset.screenLabel || '').startsWith(k));
      return s.offsetHeight - innerHeight;
    }, c.key);
    for (let i = 0; i < n; i++) {
      const e = i / (n - 1), eased = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
      await page.evaluate(y => scrollTo(0, y), y0 + span * eased);
      await page.clock.runFor(1000 / c.fps);
      await page.screenshot({ path: join(dir, String(i).padStart(3, '0') + '.png') });
    }
  } else {
    await page.evaluate(y => scrollTo(0, y), y0);
    for (let i = 0; i < n; i++) {
      await page.clock.runFor(1000 / c.fps);
      await page.screenshot({ path: join(dir, String(i).padStart(3, '0') + '.png') });
    }
  }
  console.log('clip', c.stem, n, 'frames');
  await page.close();
}

await browser.close();
