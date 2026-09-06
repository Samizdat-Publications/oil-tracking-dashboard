/**
 * Build the Strait of Hormuz coastline for the simulation from Natural Earth.
 *
 * The V4 engine shipped with schematic coastline arrays drawn by hand and a
 * label saying so. This replaces them with the public-domain Natural Earth
 * 1:10m land polygons, clipped to a box around the strait and projected to the
 * engine's 0..1 canvas space. The label changes from "illustrative geometry" to
 * "Natural Earth 10m coastline · stretched to fit", which is the truth: the box
 * is stretched to the canvas, so shapes are right and the aspect is not.
 *
 * Vessel positions remain illustrative. Nothing here touches them.
 *
 *   node scripts/build-coast.mjs           -> src/v4/hormuz/coast.json
 *
 * Source: https://github.com/martynafford/natural-earth-geojson (Natural Earth,
 * public domain). Fetched at build time and cached in the scratch dir; the
 * committed coast.json is what the app uses, so the network is optional.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/v4/hormuz/coast.json');
const CACHE = resolve(here, '../node_modules/.cache/ne_10m_land.json');
const URL = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/10m/physical/ne_10m_land.json';

// Box around the strait, degrees. Chosen so the narrows land where the engine's
// gate and inset expect them (x≈0.63, y≈0.30) and Fujairah stays in frame.
const BBOX = { west: 54.9, east: 57.3, south: 25.0, north: 27.3 };

const X = (lon) => (lon - BBOX.west) / (BBOX.east - BBOX.west);
const Y = (lat) => (BBOX.north - lat) / (BBOX.north - BBOX.south);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Sutherland–Hodgman clip of a ring against the bbox (convex, so exact). */
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BBOX.west, (p) => p[0] <= BBOX.east,
    (p) => p[1] >= BBOX.south, (p) => p[1] <= BBOX.north,
  ];
  const intersect = (a, b, edge) => {
    // Solve for the bbox line the edge represents.
    const axis = edge === 0 || edge === 1 ? 0 : 1;
    const val = [BBOX.west, BBOX.east, BBOX.south, BBOX.north][edge];
    const t = (val - a[axis]) / (b[axis] - a[axis]);
    return axis === 0 ? [val, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), val];
  };
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const inside = edges[e];
    const input = out;
    out = [];
    if (!input.length) break;
    let prev = input[input.length - 1];
    for (const cur of input) {
      if (inside(cur)) {
        if (!inside(prev)) out.push(intersect(prev, cur, e));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(intersect(prev, cur, e));
      }
      prev = cur;
    }
  }
  return out;
}

function area(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

async function loadLand() {
  if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, 'utf-8'));
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Natural Earth fetch failed: ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, text);
  return JSON.parse(text);
}

const land = await loadLand();
const rings = [];
for (const f of land.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      // Quick reject: any vertex inside the box, or the ring spans it.
      if (!ring.some(([lon, lat]) => lon >= BBOX.west - 1 && lon <= BBOX.east + 1 && lat >= BBOX.south - 1 && lat <= BBOX.north + 1)) continue;
      const c = clipRing(ring);
      if (c.length >= 3 && area(c) > 1e-5) rings.push(c.map(([lon, lat]) => [r3(X(lon)), r3(Y(lat))]));
    }
  }
}

// Real-world anchors, in the same projection. The Traffic Separation Scheme
// runs through the narrows between Larak and the Musandam peninsula; the lane
// below follows the published inbound/outbound channels approximately.
const gateLon = 56.45;
const GATE = { x: r3(X(gateLon)), top: r3(Y(26.78)), bot: r3(Y(26.40)) };
const LANE = [
  [54.85, 26.20], [55.20, 26.25], [55.60, 26.30], [55.95, 26.38], [56.20, 26.50],
  [56.38, 26.58], [56.50, 26.60], [56.62, 26.55], [56.75, 26.42], [56.88, 26.25],
  [57.00, 26.05], [57.15, 25.80], [57.35, 25.55],
].map(([lon, lat]) => [r3(X(lon)), r3(Y(lat))]);
const PORTS = [
  { name: 'BANDAR ABBAS', lon: 56.27, lat: 27.18, dir: 1 },
  { name: 'KHASAB', lon: 56.24, lat: 26.18, dir: -1 },
  { name: 'FUJAIRAH', lon: 56.33, lat: 25.12, dir: -1 },
].map((p) => ({ name: p.name, x: r3(X(p.lon)), y: r3(Y(p.lat)), dir: p.dir }));
const LABELS = [
  { text: 'I R A N', lon: 55.6, lat: 27.15 },
  { text: 'U . A . E .', lon: 55.4, lat: 25.25 },
  { text: 'MUSANDAM · OMAN', lon: 56.45, lat: 25.95 },
  { text: 'QESHM', lon: 55.8, lat: 26.85 },
  { text: 'P E R S I A N   G U L F', lon: 55.45, lat: 26.55 },
  { text: 'G U L F   O F   O M A N', lon: 57.25, lat: 25.45 },
].map((l) => ({ text: l.text, x: r3(X(l.lon)), y: r3(Y(l.lat)) }));

const out = {
  source: 'Natural Earth 1:10m land polygons (public domain), clipped and projected',
  source_url: 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/',
  bbox: BBOX,
  note: 'Equirectangular box stretched to the canvas: shapes are real, aspect is not. Vessel positions are illustrative.',
  rings, gate: GATE, lane: LANE, ports: PORTS, labels: LABELS,
  gate_lonlat: { lon: gateLon, lat_top: 26.78, lat_bot: 26.40, width_km: 33 },
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`coast: ${rings.length} rings, ${rings.reduce((s, r) => s + r.length, 0)} vertices -> ${OUT}`);
console.log(`gate x=${GATE.x} y=${GATE.top}..${GATE.bot}; lane ${LANE.length} pts`);
