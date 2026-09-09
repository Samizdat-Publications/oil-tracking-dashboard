/**
 * Render the Open Graph card to a real 1200x630 PNG.
 *
 * Facebook does not execute JavaScript, so og:image must be a static file that
 * already exists at the URL.
 *
 * The card is block 09 of the page itself ("Your bill"), which Design drew at
 * 1200x630 precisely so it could be the share image. Rendering the real block
 * rather than a separate purpose-built card means the two can never disagree:
 * there is only one card, and it is the one readers see when they scroll.
 *
 * It is captured from the built site under `prefers-reduced-motion`, which the
 * page maps to P = 1 -- every tile at its final value rather than mid-fade.
 *
 * Note the card's element box is 1265x686: `aspect-ratio: 1200/630` applies to
 * its CONTENT box, and the padding and 1px border sit outside that. Cropping to
 * the content box would cut off the red/cream stripe along the top, so the shot
 * is letterboxed onto a 1200x630 navy field instead. 1200x630 is the ratio
 * Facebook crops to, so nothing is lost.
 *
 * Runs as part of `npm run build`, after `vite build`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');
const OUT = resolve(here, '../public/og.png');
const DIST_OUT = resolve(DIST, 'og.png');

const GROUND = '#0B1E3F';           // must match the card, or the letterbox shows
const W = 1200, H = 630;

if (!existsSync(DIST)) {
  console.error('og: dist/ not found. Run `vite build` first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

// A static server over dist/, so the card is captured from exactly the bytes
// that ship rather than from a dev server.
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = join(DIST, url === '/' ? 'index.html' : url);
    if (!existsSync(file)) file = join(DIST, 'index.html');   // SPA fallback
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});

const fail = async (msg) => {
  console.error(`og: ${msg}`);
  await browser.close();
  server.close();
  process.exit(1);
};

try {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const found = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[data-screen-label]')]
      .find((x) => x.getAttribute('data-screen-label').startsWith('09'));
    if (!s) return false;
    s.scrollIntoView();
    return true;
  });
  if (!found) await fail('block 09 not found on the page.');
  await page.waitForTimeout(2500);

  const card = page.locator('[data-screen-label^="09"] div[style*="aspect-ratio"]').first();
  const box = await card.boundingBox();
  if (!box || box.width < 600) await fail(`card measured ${JSON.stringify(box)}; expected ~1265 wide.`);

  // Refuse to ship a card whose figures never rendered.
  const text = (await card.innerText()).trim();
  if (text.length < 40 || /NaN|undefined/.test(text)) {
    await fail(`card text looks wrong: ${JSON.stringify(text.slice(0, 120))}`);
  }

  const shot = await card.screenshot();

  // Letterbox onto exactly 1200x630 on the card's own ground.
  const pad = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await pad.setContent(
    `<style>html,body{margin:0;height:100%;background:${GROUND}}` +
    `img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;display:block}</style>` +
    `<img src="data:image/png;base64,${shot.toString('base64')}">`
  );
  await pad.waitForTimeout(150);
  const png = await pad.screenshot({ type: 'png' });

  await writeFile(OUT, png);
  await writeFile(DIST_OUT, png);   // dist is already built; keep the two in step
  console.log(`og: wrote ${W}x${H} from block 09 (card ${Math.round(box.width)}x${Math.round(box.height)})`);
} finally {
  await browser.close();
  server.close();
}
