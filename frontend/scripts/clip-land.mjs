/**
 * Clip public/v5/land-50m.json to the region block 00 actually draws from it.
 *
 * The page reads the 1:50m land only for the Gulf detail layer, and clips it to
 * [22, -12, 92, 48] (lon/lat) itself on load (clipLand() in TheBill.jsx). The
 * other ~90% of the world shipped as 180 KB gzipped on every visit and was
 * thrown away in the browser. The globe uses land-110m, which is untouched.
 *
 * What is kept is the same Sutherland-Hodgman clip, run here against a box
 * MARGIN degrees wider on every side. Every vertex inside the margin box is
 * kept with its original quantized value, so it decodes to the same double it
 * always did, and the page's own clip to the inner box sees identical input
 * wherever it matters. The only new points sit on the margin lines, outside
 * what the page keeps. Rings wholly inside the margin box are copied verbatim.
 *
 * The output is still a TopoJSON Topology with the same transform, one arc
 * per ring, so topojson-client's feature() reads it unchanged.
 *
 *   node scripts/clip-land.mjs            rewrite the file in place
 *   node scripts/clip-land.mjs --check    report sizes, write nothing
 *
 * Idempotent: re-running it on its own output changes nothing material.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../public/v5/land-50m.json', import.meta.url));
// Must match the box clipLand() is called with in TheBill.jsx.
// Also REGION in src/v5/TheBill.jsx. Keep the two in step.
const BOX = [22, -12, 92, 48];
// Wide enough that rounding the new margin points to the quantization grid
// (about 0.002 degrees) can never move them inside BOX.
const MARGIN = 2;

const check = process.argv.includes('--check');
const src = readFileSync(FILE, 'utf-8');
const topo = JSON.parse(src);
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

// Work in quantized integer space throughout, so kept vertices round-trip exactly.
const qx = (x) => Math.round((x - tx) / sx), qy = (y) => Math.round((y - ty) / sy);
const [x0, y0, x1, y1] = [qx(BOX[0] - MARGIN), qy(BOX[1] - MARGIN), qx(BOX[2] + MARGIN), qy(BOX[3] + MARGIN)];

const arcs = topo.arcs.map((a) => {
  let x = 0, y = 0;
  return a.map(([dx, dy]) => [(x += dx), (y += dy)]);
});
const arcPoints = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
// TopoJSON rings: consecutive arcs share their joining point.
const ringPoints = (ring) => ring.flatMap((i, k) => (k ? arcPoints(i).slice(1) : arcPoints(i)));

const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Same algorithm and predicates as clipLand(); crossing points are rounded to
// the grid, which only ever moves them along a margin line.
function clipRing(closed) {
  const clipEdge = (pts, isIn, cross) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
      const ia = isIn(a), ib = isIn(b);
      if (ib) { if (!ia) out.push(cross(a, b)); out.push(b); } else if (ia) out.push(cross(a, b));
    }
    return out;
  };
  const X = (a, b, x) => [x, Math.round(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))];
  const Y = (a, b, y) => [Math.round(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])), y];
  let r = closed.slice(0, -1);
  r = clipEdge(r, (p) => p[0] >= x0, (a, b) => X(a, b, x0)); if (!r.length) return null;
  r = clipEdge(r, (p) => p[0] <= x1, (a, b) => X(a, b, x1)); if (!r.length) return null;
  r = clipEdge(r, (p) => p[1] >= y0, (a, b) => Y(a, b, y0)); if (!r.length) return null;
  r = clipEdge(r, (p) => p[1] <= y1, (a, b) => Y(a, b, y1)); if (r.length < 3) return null;
  return [...r, r[0]];
}

const newArcs = [];
const addArc = (pts) => {
  let px = 0, py = 0;
  newArcs.push(pts.map(([x, y]) => { const d = [x - px, y - py]; px = x; py = y; return d; }));
  return newArcs.length - 1;
};

const geometries = topo.objects.land.geometries.map((g) => {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  const kept = [];
  for (const poly of polys) {
    const rings = [];
    for (const [k, ring] of poly.entries()) {
      const pts = ringPoints(ring);
      const clipped = pts.every(inside) ? pts : clipRing(pts);
      if (!clipped) {
        if (k === 0) break;   // outer ring gone: so is the polygon, holes and all
        continue;
      }
      rings.push([addArc(clipped)]);
    }
    if (rings.length) kept.push(rings);
  }
  return { type: 'MultiPolygon', arcs: kept };
}).filter((g) => g.arcs.length);

const dx = (q) => q * sx + tx, dy = (q) => q * sy + ty;
const out = {
  type: 'Topology',
  bbox: [dx(x0), dy(y0), dx(x1), dy(y1)],
  transform: topo.transform,
  objects: { land: { type: 'GeometryCollection', geometries } },
  arcs: newArcs,
};
const json = JSON.stringify(out);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
const gz = (s) => (gzipSync(s, { level: 9 }).length / 1024).toFixed(0) + ' KB gz';
console.log(`land-50m: ${kb(src)} (${gz(src)}) -> ${kb(json)} (${gz(json)}), ` +
  `${topo.arcs.length} arcs -> ${newArcs.length}, box ${BOX.join(',')} + ${MARGIN} deg`);
if (!check) writeFileSync(FILE, json);
