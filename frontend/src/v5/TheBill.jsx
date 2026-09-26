/**
 * V5 - "The Bill". A port of design-handoff/2026-09-08-the-bill.
 *
 * This is a PORT, not an interpretation. The logic class below is Design's
 * prototype class carried over almost line for line, and render() is its
 * template converted mechanically to JSX by scripts/template-to-jsx.py. No
 * hex code, spacing value, easing curve or piece of copy was retyped by hand,
 * because the previous redesign drifted exactly there: the prototype was read
 * for its words and rebuilt from memory.
 *
 * Three things that will break silently if "tidied":
 *   1. Every canvas block is driven by playProgress() off a single rAF loop.
 *      Do not give blocks their own loops or their clocks will drift apart.
 *   2. The step* routines paint from scratch every frame and begin by filling
 *      their ground colour. They are not incremental.
 *   3. prefers-reduced-motion forces P = 1 everywhere, which is what makes the
 *      page a complete static document rather than a frozen half-built one.
 *
 * Deviations from the prototype, and only these:
 *   - d3-geo and topojson-client are npm imports, not CDN globals.
 *   - The JSON snapshots and the two world-atlas land files are bundled under
 *     /v5/ instead of being fetched from jsdelivr; the brief forbids external
 *     asset hosts in production.
 *   - Fonts are self-hosted via @fontsource rather than a Google Fonts link.
 */

import React from 'react';
import { geoArea, geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

// The Gulf region the camera pushes into, [west, south, east, north]. Also BOX in
// scripts/clip-land.mjs, which trims land-50m.json to it: widen both, restore the
// full world-atlas land-50m.json, and re-run that script.
const REGION = [22, -12, 92, 48];

import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
// Source Serif 4 is declared in the-bill.css, not imported here: the prototype
// loads Google's `opsz,wght@8..60`, the variable face with the optical-size
// axis, and @fontsource-variable registers that under the family name
// 'Source Serif 4 Variable'. The ~100 inline styles ported from the prototype
// all say 'Source Serif 4', so the-bill.css re-declares the family under that
// name against the same woff2. The static cut sets the same string 15% wider.
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './the-bill.css';

const V5 = '/v5/';

/**
 * The mark red, lifted off Old Glory Red.
 *
 * Design specified #B22234 -- the actual US flag red -- for every red mark:
 * the strike ticks on the seismograph, the closed-gate bar in the strait, the
 * event dots on the globe, the kicker squares, and the two dates on the share
 * card. All of them sit on the navy ground, where #B22234 measures 2.49:1
 * against #0B1E3F. That is under the 3:1 floor for non-text contrast, which
 * made the red marks the least legible element on a page whose argument is
 * "every red mark on this page traces back to these two dates".
 *
 * #D93B4A measures 3.68:1 on the same ground and sits between Old Glory Red
 * and the #E04B5C the palette already uses for bright red text.
 *
 * This is a deliberate deviation from the handoff, and the only one that
 * changes a colour. To revert, set this back to MARK_RED.
 */
const MARK_RED = '#D93B4A';

/* The prototype called these as d3.<fn> and topojson.<fn> off CDN globals. */
const d3 = { geoArea, geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath };
const topojson = { feature };

export default class TheBill extends React.Component {
  // ?state=CA opens the receipt on that state, so a reader can share their own bill;
  // an unknown code falls back to the US once the state list is known (setupStateParam)
  state = { rows: [], asOf: '', prows: [], totalCells: [], state: (() => { try { const q = (new URLSearchParams(location.search).get('state') || '').toUpperCase(); return /^[A-Z]{2}$/.test(q) ? q : 'US'; } catch (e) { return 'US'; } })(), tick: 0 };
  canvasRef = React.createRef(); dateRef = React.createRef(); eventRef = React.createRef();
  numRef = React.createRef(); wasRef = React.createRef(); legendRef = React.createRef(); cueRef = React.createRef(); kickRef = React.createRef();
  boardRef = React.createRef(); pDateRef = React.createRef(); pWeekRef = React.createRef();
  stampStageRef = React.createRef(); stamp1Ref = React.createRef(); stamp2Ref = React.createRef(); stampNoteRef = React.createRef(); stampSentenceRef = React.createRef();
  seisRef = React.createRef(); seisDateRef = React.createRef(); seisNumRef = React.createRef(); seisSubRef = React.createRef();
  straitRef = React.createRef(); strDateRef = React.createRef(); strEventRef = React.createRef(); strNumRef = React.createRef(); strSubRef = React.createRef();
  crowdRef = React.createRef(); crowdDateRef = React.createRef(); crowdNumRef = React.createRef();
  warRef = React.createRef();
  vaultRef = React.createRef(); vaultDateRef = React.createRef(); vaultNumRef = React.createRef();
  buyRef = React.createRef(); buyDateRef = React.createRef(); buyNumRef = React.createRef(); buySubRef = React.createRef(); buyKickRef = React.createRef();
  cardRef = React.createRef(); cardItemRefs = [0, 1, 2, 3, 4, 5, 6, 7].map(() => React.createRef());
  odoRefs = [React.createRef(), React.createRef(), React.createRef()];
  STATES = 'AL Alabama,AK Alaska,AZ Arizona,AR Arkansas,CA California,CO Colorado,CT Connecticut,DE Delaware,DC District of Columbia,FL Florida,GA Georgia,HI Hawaii,ID Idaho,IL Illinois,IN Indiana,IA Iowa,KS Kansas,KY Kentucky,LA Louisiana,ME Maine,MD Maryland,MA Massachusetts,MI Michigan,MN Minnesota,MS Mississippi,MO Missouri,MT Montana,NE Nebraska,NV Nevada,NH New Hampshire,NJ New Jersey,NM New Mexico,NY New York,NC North Carolina,ND North Dakota,OH Ohio,OK Oklahoma,OR Oregon,PA Pennsylvania,RI Rhode Island,SC South Carolina,SD South Dakota,TN Tennessee,TX Texas,UT Utah,VT Vermont,VA Virginia,WA Washington,WV West Virginia,WI Wisconsin,WY Wyoming'.split(',').map(s => ({ code: s.slice(0, 2), name: s.slice(3) }));

  renderVals() {
    const P = this.prices;
    const cellsOf = (str, color, flapOn) => [...str].map(ch => ({ ch, w: ch === '.' ? '0.38em' : ch === '$' || ch === '¢' || ch === '+' || ch === '−' ? '0.6em' : '0.72em', color, flap: flapOn ? 0.7 : 0 }));
    const rows = (this.board || []).map(r => ({
      name: r.name, unit: r.unit, note: r.note || '', start: r.startText, change: r.changeText, color: r.up ? '#D4A017' : '#6C8CD5',
      changeOpacity: r.phase === 'done' ? 1 : 0.15,
      cells: cellsOf(r.shown, r.phase === 'start' ? 'rgba(247,245,240,.35)' : r.up ? '#D4A017' : '#6C8CD5', r.phase === 'flipping' && r.flapOn),
    }));
    const tot = this.total || { shown: '+$0.00', phase: 'start' };
    const totalCells = cellsOf(tot.shown, '#D4A017', tot.phase === 'flipping' && tot.flapOn).map(c => ({ ...c, w: c.w === '0.72em' ? '0.64em' : c.w }));
    const rc = P && P.receipt, sel = this.receiptFor(this.state.state);
    return {
      canvasRef: this.canvasRef, dateRef: this.dateRef, eventRef: this.eventRef, numRef: this.numRef, kickRef: this.kickRef, buyKickRef: this.buyKickRef,
      wasRef: this.wasRef, legendRef: this.legendRef, cueRef: this.cueRef,
      workRows: this.state.rows, asOf: this.state.asOf,
      boardRef: this.boardRef, pDateRef: this.pDateRef, pWeekRef: this.pWeekRef,
      stampStageRef: this.stampStageRef, stamp1Ref: this.stamp1Ref, stamp2Ref: this.stamp2Ref, stampNoteRef: this.stampNoteRef, stampSentenceRef: this.stampSentenceRef,
      seisRef: this.seisRef, seisDateRef: this.seisDateRef, seisNumRef: this.seisNumRef, seisSubRef: this.seisSubRef,
      straitRef: this.straitRef, strDateRef: this.strDateRef, strEventRef: this.strEventRef, strNumRef: this.strNumRef, strSubRef: this.strSubRef,
      strBase: this.data ? this.data.items.hormuz.baseline.total_per_day.toFixed(1) : '', strTanker: this.data ? this.data.items.hormuz.baseline.tanker_per_day.toFixed(1) : '',
      strAug18: this.data ? (this.data.hormuz_daily.find(o => o[0] === '2026-08-18') || [0, '—'])[1] : '',
      crowdRef: this.crowdRef, crowdDateRef: this.crowdDateRef, crowdNumRef: this.crowdNumRef, warRef: this.warRef,
      vaultRef: this.vaultRef, vaultDateRef: this.vaultDateRef, vaultNumRef: this.vaultNumRef,
      buyRef: this.buyRef, buyDateRef: this.buyDateRef, buyNumRef: this.buyNumRef, buySubRef: this.buySubRef, ...this.buyVals(),
      ...this.billVals(),
      ...this.storyVals(), ...this.jobsVals(), ...this.dateVals(), ...this.warVals(), ...this.labelVals(), ...this.headVals(), ...this.goldVals(), ...this.freshVals(), againstRows: this.againstRows(),
      cardRef: this.cardRef, cardItems: this.cardItems(),
      cardDate: 'IN THE GOVERNMENT\u2019S OWN NUMBERS' + (this.data ? ' · ' + this.fmtISO(this.data.as_of) : ''),
      hormuzNow: this.data ? this.hormuzNow(this.data.items.hormuz.recent.mean7_total) : '',
      strNowWord: this.data ? this.numWord(Math.round(this.data.items.hormuz.recent.mean7_total)) : '',
      ...this.dieselVals(),
      crudeCount: this.crude ? this.crude.observations.length : '', crudeLast: this.crude ? this.fmtISO(this.crude.observations.at(-1)[0]).replace(' 2026', '') : '',
      rows, totalCells, digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      odo: [{ digit: true, ref: this.odoRefs[0] }, { dot: true }, { digit: true, ref: this.odoRefs[1] }, { digit: true, ref: this.odoRefs[2] }],
      loadError: (this.state.loadError || []).join(', '),
      state: this.state.state, onState: e => this.setState({ state: e.target.value }, () => { this.buildBoard(true); this.stateToUrl(); }),
      stateOptions: [{ code: 'US', name: 'United States' }].concat(this.STATES),
      placeName: sel ? sel.name : 'the United States',
      // The effective months are the published total over the published month, so the
      // US figure is the receipt's own $ total to the dollar, as on the card; a state's
      // is its month times the same span. 18.3 x $89.23 printed $1,633 beside $1,636.
      cumulativeText: rc && sel ? '$' + Math.round(sel.total * rc.cumulative_usd / rc.monthly_usd).toLocaleString() : '',
      workPrices: (this.board || []).map(r => ({ name: r.name, unit: r.unit, start: r.startText, end: r.endText, change: r.changeText, series: r.series })),
      receiptMonths: rc ? rc.months_elapsed.toFixed(1) : '',
      receiptMethod: rc ? `Published receipt: $${rc.monthly_usd.toFixed(2)} a month, $${Math.round(rc.cumulative_usd).toLocaleString()} over the ${rc.months_elapsed.toFixed(1)} months since 20 January 2025.` : '',
      receiptFuel: rc ? rc.lines[0].arithmetic : '', receiptGroceries: rc ? rc.lines[1].arithmetic : '', receiptElectricity: rc ? rc.lines[2].arithmetic : '',
    };
  }

  /* ---------- block 1: two dates ---------- */
  fmtISO(iso) { const d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  stepStamps(P) {
    const slam = (el, at) => {
      if (!el) return;
      const u = Math.max(0, Math.min(1, (P - at) / 0.1));
      const e = 1 - Math.pow(1 - u, 3);                    // ease-out: lands hard
      const rot = el === this.stamp1Ref.current ? -4 : 3;
      el.style.opacity = String(Math.min(1, u * 3));
      el.style.transform = 'rotate(' + rot + 'deg) scale(' + (1.8 - 0.8 * e).toFixed(3) + ')';
      el.style.boxShadow = u >= 1 ? '0 0 0 1px rgba(247,245,240,.3), 0 0 60px rgba(247,245,240,.18)' : 'none';
    };
    slam(this.stamp1Ref.current, 0.12); slam(this.stamp2Ref.current, 0.3);
    if (this.stampNoteRef.current) this.stampNoteRef.current.style.opacity = P > 0.42 ? '1' : '0';
    if (this.stampSentenceRef.current) this.stampSentenceRef.current.style.opacity = P > 0.5 ? '1' : '0';
  }

  /* ---------- block 2: the seismograph ---------- */
  setupSeis() {
    const O = this.crude.observations;
    this.sD0 = Date.UTC(2026, 0, 1);
    const dayOf = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - this.sD0) / 86400000);
    this.sPts = O.map(([d, v]) => ({ d: dayOf(d), v, iso: d }));
    this.sLast = this.sPts.at(-1).d;
    this.sMarks = [
      { d: dayOf('2026-02-24'), red: true, t: '24 FEB · TARIFFS' }, { d: dayOf('2026-02-28'), red: true, t: '28 FEB · THE STRIKE' },
      { d: dayOf('2026-04-07'), red: false, t: '7 APR · CEASEFIRE' }, { d: dayOf('2026-06-18'), red: false, t: '18 JUN · CEASEFIRE' },
      { d: dayOf('2026-07-08'), red: true, t: '8 JUL · STRIKES RESUME' }, { d: dayOf('2026-09-01'), red: true, t: '1 SEP · STRIKES' },
    ];
    this.sStrike = dayOf('2026-02-28');
    this.sShake = 0; this.sPrevDay = 0;
  }
  seisPriceAt(day) {
    const P = this.sPts; if (day <= P[0].d) return P[0];
    let lo = 0, hi = P.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m].d <= day) lo = m; else hi = m - 1; }
    return P[lo];
  }
  stepSeis(dt, P, t) {
    const cv = this.seisRef.current; if (!cv || !this.sPts) return;
    const tl = Math.max(0, Math.min(1, (P - 0.02) / 0.78));
    const day = tl * this.sLast;
    if (this.sPrevDay < this.sStrike && day >= this.sStrike) this.sShake = 0.5;
    this.sPrevDay = day;
    this.sShake = Math.max(0, this.sShake - dt);
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640;
    const sh = this.sShake, jx = sh ? (Math.random() - 0.5) * 18 * sh : 0, jy = sh ? (Math.random() - 0.5) * 18 * sh : 0;
    ctx.save(); ctx.translate(jx, jy);
    // paper: the needle sits at 70% of the width; the paper slides left under it as the days pass.
    // Once the trace reaches the latest close the paper pulls back to the whole year, so the
    // finished chart shows January, the peak and now on one scale: ending zoomed on the
    // last few months left "doubled" sitting over a chart that no longer showed it.
    const zo = Math.max(0, Math.min(1, (P - 0.84) / 0.12)), ze = zo * zo * (3 - 2 * zo);
    const left = mobile ? 42 : 76, right = W - (mobile ? 18 : 48);
    const needleX = W * (mobile ? 0.8 : 0.7) + (right - W * (mobile ? 0.8 : 0.7)) * ze, pxPerDay = Math.max(4.5, W * 0.0055) + ((right - left) / this.sLast - Math.max(4.5, W * 0.0055)) * ze;
    const top = H * (mobile ? 0.17 : 0.2), bot = H * (mobile ? 0.44 : 0.5);
    const Y = v => bot - (v - 50) / 70 * (bot - top);
    const X = d => needleX - (day - d) * pxPerDay;
    ctx.fillStyle = '#10264D'; ctx.fillRect(0, top - 34, W, bot - top + 64);
    ctx.strokeStyle = 'rgba(247,245,240,.07)'; ctx.lineWidth = 1;
    for (let v = 50; v <= 120; v += 10) { ctx.beginPath(); ctx.moveTo(0, Y(v)); ctx.lineTo(W, Y(v)); ctx.stroke(); }
    // the price scale, so every figure in the sentence can be read off the line
    ctx.font = '500 ' + (mobile ? 11 : 12) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.55)'; ctx.textAlign = 'left';
    for (let v = 60; v <= 120; v += 20) ctx.fillText('$' + v, mobile ? 6 : 14, Y(v) - 4);
    for (let d = Math.floor((day - needleX / pxPerDay) / 7) * 7; d <= day + (W - needleX) / pxPerDay; d += 7) { const x = X(d); ctx.beginPath(); ctx.moveTo(x, top - 30); ctx.lineTo(x, bot + 30); ctx.stroke(); }
    // his acts and the ceasefires
    ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    this.sMarks.forEach((m, i) => {
      if (m.d > day) return;
      const x = X(m.d); if (x < -120) return;
      ctx.strokeStyle = m.red ? 'rgba(178,34,52,.8)' : 'rgba(108,140,213,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, top - 30); ctx.lineTo(x, bot + 30); ctx.stroke();
    });
    // a label whose tick has slid off the left edge is dropped, not cut; one that
    // would run off the right edge is set on the other side of its tick
    this.sMarks.forEach((m, i) => {
      const x = X(m.d);
      if (m.d > day || x < 4 || (mobile && !m.red) || (mobile && ze > 0.5)) return;
      ctx.font = '500 ' + (mobile ? 11 : 13) + 'px "IBM Plex Mono", monospace';
      const ly = top - 18 + (i % 2) * 17;          // alternate rows so 24 Feb and 28 Feb both read
      const tw = ctx.measureText(m.t).width, lx = x + 5 + tw > W - 6 ? x - 5 - tw : x + 5;
      ctx.fillStyle = '#10264D'; ctx.fillRect(lx - 3, ly - 12, tw + 6, 16);
      ctx.fillStyle = m.red ? '#E04B5C' : '#6C8CD5'; ctx.fillText(m.t, lx, ly);
    });
    // the trace
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); let started = false;
    for (const p of this.sPts) { if (p.d > day) break; const x = X(p.d); if (x < -20) { started = false; continue; } started ? ctx.lineTo(x, Y(p.v)) : ctx.moveTo(x, Y(p.v)); started = true; }
    const cur = this.seisPriceAt(day);
    if (started) ctx.lineTo(needleX, Y(cur.v));
    ctx.strokeStyle = 'rgba(212,160,23,.35)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#F2C94C'; ctx.lineWidth = 2.2; ctx.stroke();
    // the needle arm, pivoting from the right edge; it lifts away as the chart pulls back
    const px = W - (mobile ? 8 : 40), py = (top + bot) / 2, ny = Y(cur.v);
    ctx.globalAlpha = 1 - ze;
    ctx.strokeStyle = 'rgba(247,245,240,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(needleX, ny); ctx.stroke();
    ctx.fillStyle = '#F7F5F0'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    // the finished chart marks the three prices the sentence gives: January, the peak, now
    if (ze > 0) {
      ctx.globalAlpha = ze; ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.55)'; ctx.textAlign = 'center';
      const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      for (let m = 0; m < 12; m++) { const d = Math.round((Date.UTC(2026, m, 15) - this.sD0) / 86400000); if (d > this.sLast) break; if (!mobile || m % 2 === 0) ctx.fillText(M[m], X(d), bot + 18); }
      if (mobile) { ctx.textAlign = 'left'; ctx.fillStyle = '#E04B5C'; ctx.fillText('RED: TARIFFS, STRIKES', 6, top - 20); ctx.fillStyle = '#6C8CD5'; ctx.textAlign = 'right'; ctx.fillText('BLUE: CEASEFIRES', W - 6, top - 20); }
      ctx.textAlign = 'left';
      const pk = this.crude.peak, P0 = this.sPts[0], pkPt = this.sPts.find(p => p.iso === pk.date) || this.sPts.reduce((a, p) => (p.v > a.v ? p : a));
      ctx.globalAlpha = ze; ctx.font = '700 ' + (mobile ? 13 : 15) + 'px "IBM Plex Mono", monospace';
      [[P0, '$' + Math.round(P0.v) + ' · ' + this.fmtISO(P0.iso).replace(/ \d{4}$/, ''), 'left', 16],
       [pkPt, '$' + Math.round(pkPt.v) + ' · PEAK · ' + this.fmtISO(pkPt.iso).replace(/ \d{4}$/, ''), 'left', -10],
       [cur, '$' + Math.round(cur.v) + ' · NOW', 'right', 24]].forEach(([p, txt, al, dy]) => {
        const x = X(p.d), y = Y(p.v);
        ctx.fillStyle = '#F7F5F0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.2832); ctx.fill();
        // a plate of the paper colour, so a label never reads through the trace
        const tx = al === 'right' ? x + 4 : x + 8, tw = ctx.measureText(txt).width, fs = mobile ? 13 : 15;
        ctx.fillStyle = 'rgba(16,38,77,.88)'; ctx.fillRect((al === 'right' ? tx - tw : tx) - 4, y + dy - fs, tw + 8, fs + 6);
        ctx.textAlign = al; ctx.fillStyle = '#F2C94C'; ctx.fillText(txt, tx, y + dy);
      });
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    ctx.fillStyle = MARK_RED; ctx.beginPath(); ctx.arc(needleX, ny, 3.5, 0, 6.2832); ctx.fill();
    // the strike: a red flash across the paper for the first days
    const since = day - this.sStrike;
    if (since >= 0 && since < 6) { ctx.fillStyle = 'rgba(178,34,52,' + (0.25 * (1 - since / 6)).toFixed(3) + ')'; ctx.fillRect(0, top - 30, W, bot - top + 60); }
    ctx.restore();
    // scrim for the readouts
    const sg = ctx.createLinearGradient(0, H * 0.5, 0, H); sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.9)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // readouts
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    set(this.seisNumRef, '$' + Math.round(cur.v));
    set(this.seisDateRef, this.fmtISO(cur.iso) + (Math.abs(cur.d - day) >= 1 ? ' · LAST CLOSE' : ''));
    const done = tl >= 1;
    const sub = this.seisSubRef.current;
    if (sub) {
      const html = done ? 'a barrel<br><span style="color:rgba(247,245,240,.6)">now · $57 in January · $115 at the peak</span>'
        : cur.d < this.sStrike ? 'a barrel<br><span style="color:rgba(247,245,240,.6)">before the war</span>'
        : cur.v >= 114 ? 'a barrel<br><span style="color:#E04B5C">the peak · five weeks after the strike</span>'
        : 'a barrel<br><span style="color:rgba(247,245,240,.6)">' + (cur.d < this.sMarks[2].d ? 'after the strike' : cur.d < this.sMarks[4].d ? 'under the ceasefires' : 'since strikes resumed') + '</span>';
      if (sub.__html !== html) { sub.__html = html; sub.innerHTML = html; }
    }
  }

  /* ---------- block 3: the strait ---------- */
  strLane(s, off) {
    const L = this.coastBox.lane, n = L.length - 1, t = s * n, i = Math.max(0, Math.min(n - 1, Math.floor(t))), f = t - i;   // s outside 0..1 extrapolates the end segments out to sea
    const a = L[i], b = L[i + 1];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f + off, dx: b[0] - a[0], dy: b[1] - a[1] };
  }
  drawShip(ctx, x, y, ang, L, hull, ghost) {
    const B = L * 0.2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(L * 0.5, 0); ctx.quadraticCurveTo(L * 0.34, -B * 0.46, L * 0.14, -B * 0.5); ctx.lineTo(-L * 0.44, -B * 0.46);
    ctx.quadraticCurveTo(-L * 0.5, 0, -L * 0.44, B * 0.46); ctx.lineTo(L * 0.14, B * 0.5); ctx.quadraticCurveTo(L * 0.34, B * 0.46, L * 0.5, 0); ctx.closePath();
    if (ghost) { ctx.strokeStyle = 'rgba(247,245,240,.45)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle = hull; ctx.fill(); ctx.fillStyle = 'rgba(11,30,63,.7)'; ctx.fillRect(-L * 0.42, -B * 0.34, Math.max(1.2, L * 0.14), B * 0.68); }
    ctx.restore();
  }
  stepStrait(dt, P, t) {
    const cv = this.straitRef.current, CB = this.coastBox; if (!cv || !CB || !this.routes) return;
    const h = this.routes.hormuz;
    // Two states, not a day-by-day replay. Scrubbing every daily count made the
    // number bounce on its way down, and ships spawned at 83 a day kept crawling
    // through a gate marked CLOSED, so the closure read as no impact at all.
    // Before is the pre-war mean, now is the latest 7-day mean, and the ships on
    // screen are held in proportion to whichever is showing.
    const nowFlow = this.mean7(h, this.LAST) ?? h.base;
    const CUT = 0.33, SETTLE = 0.43, CLAIM = 0.58;
    const fall = P < CUT ? 0 : P >= SETTLE ? 1 : (P - CUT) / (SETTLE - CUT), ease = 1 - Math.pow(1 - fall, 3);
    const flow = h.base + (nowFlow - h.base) * ease, frac = Math.min(1, flow / h.base);
    const after = P >= CUT, closed = fall >= 1 && nowFlow / h.base < 0.12;
    // one ship on screen for each ship a day: 83 before, the count now
    const target = Math.max(flow >= 0.5 ? 1 : 0, Math.round(flow));
    const newShip = s => ({ s, dir: Math.random() < 0.5 ? 1 : -1, v: 0.05 + Math.random() * 0.02, w: [0.8, 1, 1.3][Math.floor(Math.random() * 3)], a: 1 });
    if (!this.strFilled) { this.strFilled = true; for (let i = 0; i < target; i++) this.strShips.push(newShip(-0.6 + 2.2 * (i + Math.random()) / target)); }
    // surplus ships fade out; the ones kept are spread along the visible lane, so
    // the few left are in view and do not stack on the gate
    const active = this.strShips.filter(sh => !sh.leaving);
    if (active.length > target) {
      const keep = new Set();
      for (let i = 0; i < target; i++) {
        const want = 0.1 + 0.8 * (i + 0.5) / target; let best = null;
        for (const sh of active) if (!keep.has(sh) && (!best || Math.abs(sh.s - want) < Math.abs(best.s - want))) best = sh;
        if (best) keep.add(best);
      }
      for (const sh of active) if (!keep.has(sh)) sh.leaving = true;
    }
    this.strAcc = Math.min(2, this.strAcc + dt * target * frac / 37);            // ~37 s to cross the frame at full speed
    if (active.length >= target) this.strAcc = Math.min(this.strAcc, 1);
    while (this.strAcc >= 1 && this.strShips.filter(sh => !sh.leaving).length < target) {
      this.strAcc -= 1; const sh = newShip(0); sh.s = sh.dir > 0 ? -0.6 : 1.6; this.strShips.push(sh);
    }
    // the few ships left crawl, so they stay in view long enough to count
    const slow = 0.25 + 0.75 * frac;
    for (const sh of this.strShips) { sh.s += sh.v * dt * sh.dir * slow; if (sh.leaving) sh.a -= dt * 1.4; }
    this.strShips = this.strShips.filter(sh => sh.a > 0 && sh.s > -0.65 && sh.s < 1.65);
    // paint
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640;
    const bb = CB.bbox, mw = (bb.east - bb.west) * Math.cos(26.15 * Math.PI / 180), mh = bb.north - bb.south;
    // scale so the strait fills the frame; anchor the gate at a fixed point on screen
    const gX = W * (mobile ? 0.5 : 0.56), gY = H * (mobile ? 0.3 : 0.34), gmid = (CB.gate.top + CB.gate.bot) / 2;
    // zoom at least far enough that the clipped edges of the coastline box sit off-canvas, so the cut never reads as a shoreline
    const kx = Math.max(gX / (CB.gate.x * mw), (W - gX) / ((1 - CB.gate.x) * mw)), ky = Math.max(gY / (gmid * mh), (H - gY) / ((1 - gmid) * mh));
    const k = Math.max(Math.min(W / mw, H / mh) * (mobile ? 2.2 : 1.3), kx * 1.04, ky * 1.04);
    const X = x => gX + (x - CB.gate.x) * mw * k, Y = y => gY + (y - gmid) * mh * k;
    const og = ctx.createRadialGradient(gX, gY, 20, gX, gY, Math.max(W, H) * 0.8);
    og.addColorStop(0, '#173261'); og.addColorStop(1, '#0B1E3F'); ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(247,245,240,.05)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(X(i / 10), 0); ctx.lineTo(X(i / 10), H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, Y(i / 10)); ctx.lineTo(W, Y(i / 10)); ctx.stroke(); }
    for (const ring of CB.rings) {
      ctx.beginPath(); ring.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath();
      ctx.fillStyle = '#2F4573'; ctx.fill(); ctx.strokeStyle = 'rgba(247,245,240,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.6)'; ctx.textAlign = 'center';
    // Place names stay out of the bands the readouts use (the date and event lines at the
    // top, the headline and source at the bottom) and are pulled in from the edges, so
    // none is printed over copy or cut off ("IAN GULF").
    for (const l of CB.labels) {
      if (mobile && (l.text === 'QESHM' || l.text.indexOf('G U L F') >= 0)) continue;
      const y = Y(l.y), hw = ctx.measureText(l.text).width / 2;
      if (y < (mobile ? 120 : 96) || y > H * (mobile ? 0.52 : 0.78)) continue;
      ctx.fillText(l.text, Math.max(10 + hw, Math.min(W - 10 - hw, X(l.x))), y);
    }
    ctx.textAlign = 'left';
    // the lane
    const laneStroke = (off, style, dash, lw) => { ctx.beginPath(); for (let s = -0.6; s <= 1.6001; s += 0.02) { const p = this.strLane(s, off); s > -0.6 ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); } ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); };
    laneStroke(0, 'rgba(212,160,23,' + (0.06 + 0.16 * frac).toFixed(3) + ')', null, 26);
    laneStroke(-0.026, 'rgba(247,245,240,.18)', [4, 6], 1); laneStroke(0.026, 'rgba(247,245,240,.18)', [4, 6], 1);
    // the gate
    const gx = X(CB.gate.x), gt = Y(CB.gate.top), gb = Y(CB.gate.bot);
    if (closed) {
      const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(t / 420);
      ctx.strokeStyle = 'rgba(178,34,52,' + (0.3 + 0.3 * pulse).toFixed(2) + ')'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(gx, gt); ctx.lineTo(gx, gb); ctx.stroke();
      ctx.strokeStyle = MARK_RED; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx, gt); ctx.lineTo(gx, gb); ctx.stroke();
      ctx.fillStyle = '#E04B5C'; ctx.font = '700 14px "IBM Plex Mono", monospace'; const gT = Math.round(100 * nowFlow / h.base) + '% OF PRE-WAR', gw2 = ctx.measureText(gT).width; ctx.fillStyle = 'rgba(11,30,63,.85)'; ctx.fillRect(gx + 8, (gt + gb) / 2 - 11, gw2 + 8, 20); ctx.fillStyle = '#E04B5C'; ctx.fillText(gT, gx + 12, (gt + gb) / 2 + 4);
    } else { ctx.strokeStyle = 'rgba(247,245,240,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gt); ctx.lineTo(gx, gb); ctx.stroke(); }
    ctx.fillStyle = 'rgba(247,245,240,.6)'; ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('33 KM', gx, gt - 8); ctx.textAlign = 'left';
    // ships
    const L = Math.max(10, W / 60);
    for (const sh of this.strShips) {
      const p = this.strLane(sh.s, sh.dir > 0 ? -0.026 : 0.026);
      const ang = Math.atan2(p.dy * mh, p.dx * mw) + (sh.dir > 0 ? 0 : Math.PI);
      ctx.globalAlpha = Math.max(0, Math.min(1, sh.a));
      this.drawShip(ctx, X(p.x), Y(p.y), ang, L * sh.w, '#F2C94C', false);
    }
    ctx.globalAlpha = 1;
    // his claim against the count: from 18 August, drawn to the same scale
    const tgs = ctx.createLinearGradient(0, 0, 0, H * 0.22); tgs.addColorStop(0, 'rgba(11,30,63,.92)'); tgs.addColorStop(0.6, 'rgba(11,30,63,.6)'); tgs.addColorStop(1, 'rgba(11,30,63,0)');
    ctx.fillStyle = tgs; ctx.fillRect(0, 0, W, H * 0.22);
    // The claim is the point of this block, so it is drawn large, on a plate, and on
    // phones too: without it the headline's "he says" had nothing to point at.
    if (P >= CLAIM) {
      const a = Math.min(1, (P - CLAIM) / 0.08), Lc = mobile ? Math.min(17, (W - 56) / 11.5) : L * 1.5, fs = mobile ? 12 : 16;
      const pw = 10 * Lc * 1.15, bx = mobile ? 16 + 12 : W - 36 - pw - 12, by = mobile ? H * 0.43 : H * 0.13, cy2 = by + 3 * Lc * 0.55 + fs + 20;
      ctx.globalAlpha = a * 0.82; ctx.fillStyle = '#0B1E3F'; ctx.fillRect(bx - 12, by - fs - 18, pw + 24, cy2 - by + fs + 18 + Lc * 0.6 + 16); ctx.globalAlpha = a;
      ctx.font = '700 ' + fs + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#E04B5C'; ctx.textAlign = 'left'; ctx.fillText('HE SAID · 30 A NIGHT · 18 AUG', bx, by - 10);
      for (let i = 0; i < 30; i++) this.drawShip(ctx, bx + (i % 10) * Lc * 1.15 + Lc / 2, by + Math.floor(i / 10) * Lc * 0.55 + Lc * 0.2, 0, Lc, null, true);
      // like for like: what satellites counted on the day he spoke, then the latest week
      const a18 = this.data && this.data.hormuz_daily.find(o => o[0] === '2026-08-18'), nC = a18 ? a18[1] : Math.round(nowFlow);
      ctx.fillStyle = '#F2C94C'; ctx.fillText(a18 ? 'COUNTED THAT DAY · ' + nC + ' · NOW ' + Math.round(nowFlow) + ' A DAY' : 'COUNTED · ' + nC + ' A DAY · LAST 7 DAYS', bx, cy2 - 10);
      for (let i = 0; i < Math.max(1, nC); i++) this.drawShip(ctx, bx + (i % 10) * Lc * 1.15 + Lc / 2, cy2 + Math.floor(i / 10) * Lc * 0.55 + Lc * 0.2, 0, Lc, '#F2C94C', false);
      ctx.globalAlpha = 1;
    }
    const sg = ctx.createLinearGradient(0, H * 0.5, 0, H); sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.9)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // readouts
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    set(this.strNumRef, String(Math.round(after ? flow : h.base)));
    set(this.strDateRef, after ? 'NOW · 7 DAYS TO ' + this.fmtDay(this.LAST) : 'BEFORE THE WAR · 1 JAN 2025 – 27 FEB 2026');
    const ev = !after ? null : P < CLAIM + 0.07 ? this.events[0] : this.events.find(e => /OPEN AND OPERATING/.test(e.t));
    const er = this.strEventRef.current; if (er) { const txt = ev ? ev.t : ''; if (er.textContent !== txt) { er.textContent = txt; er.style.color = ev && ev.red ? '#E04B5C' : '#6C8CD5'; } }
    const sub = this.strSubRef.current;
    if (sub) { const html = !after ? 'ships a day<br><span style="color:rgba(247,245,240,.6)">before the war</span>' : P >= CLAIM ? 'ships a day, counted<br><span style="color:#E04B5C">he said thirty a night</span>' : 'ships a day<br><span style="color:rgba(247,245,240,.6)">was ' + Math.round(h.base) + ' before the war</span>'; if (sub.__html !== html) { sub.__html = html; sub.innerHTML = html; } }
  }

  // The canvases' accessible descriptions carry the same figures the canvas
  // draws, so they are built from the data too (see CANVAS_LABELS in
  // scripts/template-to-jsx.py, which reads these names).
  // When the page was rebuilt, and how far each kind of figure runs. A reader
  // should not have to open "Show the work" to learn the page is current.
  freshVals() {
    const D = this.data, C = this.crude, P = this.prices, M = this.cMonths, keys = 'updated updatedCaps freshNote'.split(' ');
    if (!D || !C || !P || !M) return Object.fromEntries(keys.map(k => [k, '']));
    const day = iso => this.dayLong(iso), W = this.bill.war_cost;
    return {
      updated: day(D.as_of), updatedCaps: 'UPDATED ' + this.fmtISO(D.as_of),
      freshNote: 'Rebuilt from the sources on ' + day(D.as_of) + '. The latest figures run to: crude oil ' + day(C.observations.at(-1)[0]) + ', ship counts ' + day(D.hormuz_daily.at(-1)[0]) + ', pump prices ' + day(P.diesel.latest.date) + ', shop prices ' + this.monthLong(P.items.map(i => i.end_date).sort().at(-1)) + ', jobs ' + this.monthLong(M.at(-1)[0]) + ', the Pentagon’s cost ' + day(W.dod_cost.as_of) + '. Each series is published on its own schedule, so they do not all end on the same day.',
    };
  }
  // The jobs comparison. The whole previous term (Feb 2021 to Jan 2025) averaged
  // 321,000 a month, but it opens on the rebound from the 2020 lockdowns, which a
  // critic would rightly call a rigged baseline. The last two full calendar years
  // before he took office are the comparison instead; the term figure is printed
  // in Show the work beside it.
  jobsBase() {
    const B = this.bill; if (!B) return null;
    const v = B.jobs.monthly.filter(m => m[0] >= '2023-01-01' && m[0] <= '2024-12-01').map(m => m[1]);
    if (!v.length) return null;
    const s = v.slice().sort((a, b) => a - b), mid = s.length >> 1;
    return { label: '2023\u2013\u206024', n: v.length, mean: v.reduce((a, b) => a + b, 0) / v.length, median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2 };
  }
  // Sentences whose every figure moves with the data (block 01's tariff line, block
  // 02's oil, block 03's claim, block 05's baseline, block 06's CBO note, block 08).
  storyVals() {
    const C = this.crude, B = this.bill, D = this.data, keys = 'africaSentence africaNote tariffSentence tariffNote oilKicker oilSentence oilWeeks strSentence jobsWas jobsBaseLabel jobsTermMean jobsKicker cboNote vaultSentence'.split(' ');
    const out = Object.fromEntries(keys.map(k => [k, '']));
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const T = B && B.tariffs && B.tariffs.fy;
    if (T && T.length >= 2) {
      const [fa, a] = T.at(-2), [fb, b] = T.at(-1);
      const neg = (B.against && B.against.customs && B.against.customs.months_negative) || [], mon = d => this.monthLong(d).split(' ')[0];
      out.tariffSentence = 'Tariffs are a tax paid at the border. Under the tariffs the court later struck down, customs duties came to $' + Math.round(b / 1e9) + ' billion in the year to September ' + fb + ', against $' + Math.round(a / 1e9) + ' billion the year before.'
        + (neg.length ? ' Refunds of those duties outran new collections in ' + (neg.length > 1 ? neg.slice(0, -1).map(mon).join(', ') + ' and ' + mon(neg.at(-1)) : mon(neg[0])) + ' ' + neg.at(-1).slice(0, 4) + '.' : '');
      out.tariffNote = 'Customs duties are the Monthly Treasury Statement\u2019s receipts (table 9) for federal fiscal years, which run October to September: $' + (a / 1e9).toFixed(1) + ' billion in fiscal ' + fa + ', $' + (b / 1e9).toFixed(1) + ' billion in fiscal ' + fb + '. Fiscal ' + fb + ' includes four months before he took office, so the rise understates the tariffs. Importers pay the duty; how much of it reaches their customers\u2019 prices is argued over, so this is what was collected, not a measure of who bore it. The year running now is net of the refunds of the struck-down tariffs and is not compared until it closes.';
    }
    if (C && C.observations.length) {
      const O = C.observations, jan = O[0][1], pre = (O.filter(o => o[0] < '2026-02-28').at(-1) || O[0])[1], pk = C.peak, now = O.at(-1)[1];
      const weeks = Math.round((Date.parse(pk.date) - Date.parse('2026-02-28')) / (7 * 86400000));
      const low = O.filter(o => o[0] >= '2026-06-18' && o[0] < '2026-07-08').reduce((m, o) => Math.min(m, o[1]), Infinity);
      out.oilWeeks = this.words(weeks);
      const cape = D && D.items.good_hope && D.items.good_hope.recent.pct_of_baseline;
      out.africaSentence = cape >= 110 ? 'The oil goes the long way round Africa.' : '';
      out.africaNote = cape >= 110 ? '"The long way round Africa" rests on Cape of Good Hope traffic at ' + Math.round(cape) + '% of its pre-war mean.' : 'Cape of Good Hope traffic is at ' + Math.round(cape) + '% of its pre-war mean, so the page does not claim the oil is going round Africa.';
      out.oilKicker = 'OIL UP ' + Math.round((pk.value / pre - 1) * 100) + '% ' + this.words(weeks).toUpperCase() + ' WEEKS INTO THE WAR';
      out.oilSentence = 'Crude was $' + Math.round(jan) + ' a barrel in January and $' + Math.round(pre) + ' at the last close before the strike. ' + cap(this.words(weeks)) + ' weeks in it was $' + Math.round(pk.value) + '.'
        + (isFinite(low) ? ' It fell to $' + Math.round(low) + ' under the June ceasefire, and is $' + Math.round(now) + ' now, after strikes resumed in July.' : ' It is $' + Math.round(now) + ' now.');
    }
    if (D) {
      const a18 = D.hormuz_daily.find(o => o[0] === '2026-08-18'), now = Math.round(D.items.hormuz.recent.mean7_total);
      out.strSentence = 'On 18 August he said the strait was \u201Copen and operating,\u201D thirty ships a night. The satellites counted ' + (a18 ? this.numWord(a18[1]) + ' that day, and ' : '') + this.numWord(now) + ' a day over the last week.';
    }
    const base = this.jobsBase();
    if (base && B) {
      out.jobsBaseLabel = base.label; out.jobsTermMean = Math.round(B.jobs.prev.mean_monthly).toLocaleString();
      out.jobsWas = 'was ' + Math.round(base.mean / 1000) + ',000 in ' + base.label;
      // the share of the earlier pace in words, nearest of the plain fractions
      const r = B.jobs.curr.mean_monthly / base.mean, F = [[0.1, 'A TENTH'], [0.125, 'AN EIGHTH'], [0.2, 'A FIFTH'], [0.25, 'A QUARTER'], [1 / 3, 'A THIRD'], [0.5, 'HALF'], [2 / 3, 'TWO THIRDS'], [0.75, 'THREE QUARTERS']];
      const f = F.reduce((a, x) => (Math.abs(x[0] - r) < Math.abs(a[0] - r) ? x : a));
      out.jobsKicker = r >= 1 ? 'HIRING IS AT OR ABOVE ITS ' + base.label + ' PACE' : 'HIRING IS DOWN TO ' + (Math.abs(f[0] - r) < 0.03 ? '' : 'ABOUT ') + f[1] + ' OF ITS ' + base.label + ' PACE';
    }
    const cb = B && B.war_cost.cbo_estimate;
    if (cb) out.cboNote = 'The Congressional Budget Office, which is independent of the Pentagon, put the cost at $' + cb.usd_bn + ' billion through ' + this.dayLong(cb.through) + ' (published ' + this.dayLong(cb.release) + ')' + (cb.monthly_going_forward_usd_bn ? ', and $' + cb.monthly_going_forward_usd_bn + ' billion a month going forward' : '') + '. It is lower than the Pentagon\u2019s figure and covers a shorter period; the Pentagon\u2019s is drawn, and the CBO\u2019s is printed beside it on the screen.';
    if (B && this.vOut) {
      const E = B.gold.earmarked, out_t = Math.round(E[0][2] - E.at(-1)[2]), noneIn = this.vOut.every(o => o.t >= 0), q = (B.gold.moves || []).find(m => m.quote && m.tonnes);
      out.vaultSentence = 'Foreign central banks have taken ' + out_t + ' tonnes of gold out of the New York Fed since ' + this.monthLong(E[0][0]) + (noneIn ? ', and none has come back' : '') + '. '
        + (q ? q.bank + ' cited \u201C' + q.quote + '.\u201D ' : '')
        + 'The Fed\u2019s economists say it is not a flight from the dollar.';
    }
    return out;
  }
  // The headline sentences under each block's big number. Design typed their
  // figures; "Diesel has not cost this much since 2022" outlived diesel's record
  // and "it is $91 now" outlived the price.
  headVals() {
    const C = this.crude, P = this.prices, B = this.bill, D = this.data, keys = 'crudeNow dieselVerdict pricesDown warMonths warMonthsCaps vaultFrom vaultTo aircraftWord lossBn suppBn'.split(' ');
    if (!C || !P || !B || !D) return Object.fromEntries(keys.map(k => [k, '']));
    const cap = s => s[0].toUpperCase() + s.slice(1), R = P.diesel.record, W = B.war_cost;
    let dieselVerdict = '';
    if (R && R.is_record) dieselVerdict = 'Diesel has never cost this much, before adjusting for inflation.';
    else if (R && R.last_higher && R.last_higher.date < P.diesel.points[0][0]) dieselVerdict = 'Diesel has not cost this much since ' + R.last_higher.date.slice(0, 4) + '.';
    else if (R) dieselVerdict = 'Diesel is below its ' + this.monthLong(P.diesel.points.reduce((a, p) => (p[1] > a[1] ? p : a))[0]).split(' ')[0] + ' high.';
    const down = (this.board || []).filter(r => !r.up).length;
    const months = Math.round((Date.parse(D.as_of) - Date.parse('2026-02-28')) / (30.44 * 86400000));
    return {
      crudeNow: '$' + Math.round(C.observations.at(-1)[1]),
      dieselVerdict,
      pricesDown: down ? cap(this.words(down)) + ' went down; we show ' + (down === 1 ? 'that' : 'those') + ' too.' : 'None went down.',
      warMonths: cap(this.words(months)) + ' month' + (months === 1 ? '' : 's'),
      warMonthsCaps: (this.words(months) + ' month' + (months === 1 ? '' : 's')).toUpperCase(),
      vaultFrom: this.monthLong(B.gold.earmarked[0][0]), vaultTo: this.monthLong(B.gold.earmarked.at(-1)[0]),
      aircraftWord: cap(this.words(W.aircraft.total_lost_or_damaged)),
      lossBn: '$' + W.aircraft.dod_loss_estimate_usd_bn + ' billion',
      suppBn: '$' + W.supplemental_request.usd_bn + ' billion',
    };
  }
  // A London Good Delivery bar is about 400 troy ounces, 12.44 kg: the unit central
  // banks actually move. Block 8 counts in these, because in tonnes against the
  // whole vault 164 t read as a sliver of 5,900 and said nothing about the scale.
  get BAR_T() { return 400 * 31.1034768 / 1e6; }
  // The named moves out of New York, from context_figures.json. France's is shown
  // as what it was: bars sold in New York and bought in Paris, none shipped.
  goldMoves(moves) {
    return moves.map(m => {
      if (m.tonnes_at_new_york) return { name: m.country.toUpperCase(), t: m.tonnes_at_new_york.toLocaleString() + ' T STILL THERE', route: m.total_reserves_tonnes ? 'OF ' + m.total_reserves_tonnes.toLocaleString() + ' T IN ALL' : '', why: (m.status || '').toUpperCase(), still: true };
      if (!/New York/.test(m.from || '') || !m.tonnes) return null;
      const ny = m.total_reserves_tonnes && m.before_share_new_york_pct != null && m.after_share_new_york_pct != null
        ? m.total_reserves_tonnes * (m.before_share_new_york_pct - m.after_share_new_york_pct) / 100 : m.tonnes;
      const to = (m.to || '').replace(/^.*,\s*/, '').toUpperCase(), shipped = !/No bar was physically shipped/i.test(m.note || '');
      return {
        name: m.country.toUpperCase(), t: Math.round(ny) + ' T OUT OF NEW YORK' + (Math.round(ny) !== m.tonnes ? ' (' + m.tonnes + ' T IN ALL)' : ''),
        route: 'NEW YORK \u2192 ' + to + (m.period ? ' \u00b7 ' + m.period.toUpperCase() : ''),
        why: m.quote ? '\u201C' + m.quote.toUpperCase() + '\u201D' : shipped ? '' : 'SOLD IN NEW YORK, BOUGHT IN ' + to + ': NO BAR WAS SHIPPED',
      };
    }).filter(Boolean);
  }
  goldVals() {
    const B = this.bill, keys = 'vaultSub vaultScaleNote vaultBars'.split(' ');
    if (!B || !this.vOut) return Object.fromEntries(keys.map(k => [k, '']));
    const E = B.gold.earmarked, out = E[0][2] - E.at(-1)[2], bars = Math.round(out / this.BAR_T), N = this.vOut.length;
    const days = (Date.parse(E.at(-1)[0]) - Date.parse(E[0][0])) / 86400000, gp = B.gold.gold_price && B.gold.gold_price.latest;
    const noneIn = this.vOut.every(o => o.t >= 0);
    return {
      vaultSub: Math.round(out) + ' tonnes · ' + this.words(N) + ' months' + (noneIn ? ' \u00b7 none came in' : ''),
      vaultBars: bars.toLocaleString(),
      vaultScaleNote: 'At about 400 troy ounces to a London Good Delivery bar, the unit central banks hold and move, ' + Math.round(out) + ' tonnes is about ' + bars.toLocaleString() + ' bars, or about ' + Math.round(bars / days) + ' a day over those ' + this.words(N) + ' months.'
        + (gp ? ' At $' + Math.round(gp.usd_oz).toLocaleString() + ' an ounce (' + this.dayLong(gp.date) + '; Tier 2, because no FRED series carries the gold price) it is worth about $' + (out * 1e6 / 31.1034768 * gp.usd_oz / 1e9).toFixed(1) + ' billion.' : '')
        + ' The Fed\u2019s own row is kept at the statutory price precisely so that it counts ounces, not value: of the ' + Math.round(E[0][2]).toLocaleString() + ' tonnes held for foreign accounts in ' + this.monthLong(E[0][0]) + ', ' + (100 * out / E[0][2]).toFixed(1) + '% has gone.',
    };
  }
  labelVals() {
    const D = this.data, B = this.bill, C = this.crude, keys = 'hormuzMean straitRange crudeLastText casN aircraftN suppText patriotPct vaultMonths'.split(' ');
    if (!D || !B || !C) return Object.fromEntries(keys.map(k => [k, '']));
    const others = Object.entries(D.items).filter(([k]) => k !== 'hormuz').map(([, v]) => v.recent.pct_of_baseline), W = B.war_cost, last = C.observations.at(-1);
    return {
      hormuzMean: String(Math.round(D.items.hormuz.recent.mean7_total)),
      straitRange: Math.round(Math.min(...others)) + ' to ' + Math.round(Math.max(...others)) + ' percent',
      crudeLastText: '$' + Math.round(last[1]) + ' on ' + this.dayLong(last[0]),
      casN: String(W.casualties.us_killed), aircraftN: String(W.aircraft.total_lost_or_damaged),
      suppText: '$' + W.supplemental_request.usd_bn + ' billion', patriotPct: String(Math.round(W.munitions.patriot_remaining_share * 100)),
      vaultMonths: this.words(B.gold.earmarked.length - 1),
    };
  }
  // keep ?state= in step with the picker, without adding history entries
  stateToUrl() {
    try {
      const u = new URL(location.href), s = this.state.state;
      if (s === 'US') u.searchParams.delete('state'); else u.searchParams.set('state', s);
      history.replaceState(null, '', u);
    } catch (e) { /* a sandboxed preview may refuse; the picker still works */ }
  }
  /* ---------- computed copy ----------
   * Sentences that state a verdict about a moving number are built from the
   * data, never typed. "Not a record" stayed on the page for two refreshes after
   * EIA's weekly diesel passed its 2022 peak on 7 Sep 2026. The record test runs
   * on the whole series (from 1994) in build_snapshot.py; with no history the
   * copy states the price and claims nothing either way. */
  numWord(n) { return ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n); }
  hormuzNow(mean7) {
    const n = Math.round(mean7);
    return 'Now ' + this.numWord(n) + (n === 1 ? ' does.' : ' do.');
  }
  dieselVals() {
    const D = this.prices && this.prices.diesel, R = D && D.record;
    const none = { dieselLabel: 'diesel a gallon · EIA weekly', dieselHead: 'Diesel.', dieselHeadPolicy: 'Diesel, and eggs.', dieselNote: '' };
    if (!D) return none;
    const usd = v => '$' + v.toFixed(2);
    const day = iso => { const [d, m, y] = this.fmtISO(iso).split(' '); return d + ' ' + m[0] + m.slice(1).toLowerCase() + ' ' + y; };
    const now = usd(D.latest.value) + ' (EIA weekly, ' + day(D.latest.date) + ')';
    if (!R) return { ...none, dieselNote: 'Diesel is ' + now + '.' };
    const prior = usd(R.prior_peak.value) + ' on ' + day(R.prior_peak.date);
    if (R.is_record) return {
      dieselLabel: 'diesel a gallon · a record before inflation', dieselHead: 'A record.', dieselHeadPolicy: 'A record, and a fall that is not policy.',
      dieselNote: 'Diesel at ' + now + ' is the highest in a series that begins in ' + R.series_start.slice(0, 4) + '. It first passed the previous peak, ' + prior + ', in the week of ' + day(R.first_record.date) + '. These are dollars of the day, not adjusted for inflation.',
    };
    const high = D.points.reduce((a, p) => (p[1] > a[1] ? p : a));
    if (R.last_higher.date >= D.points[0][0]) return {
      dieselLabel: 'diesel a gallon · record ' + usd(R.first_record ? high[1] : R.prior_peak.value),
      dieselHead: 'Below the record.', dieselHeadPolicy: 'Below the record, and not policy.',
      dieselNote: 'Diesel at ' + now + ' is below its ' + day(high[0]) + ' high of ' + usd(high[1]) + (R.first_record ? ', the series record; the previous peak was ' + prior + '.' : '. The series record is ' + prior + '.'),
    };
    return {
      dieselLabel: 'diesel a gallon · highest since ' + R.last_higher.date.slice(0, 4), dieselHead: 'Not a record.', dieselHeadPolicy: 'Not a record, and not policy.',
      dieselNote: 'Diesel at ' + now + ' is the highest since ' + day(R.last_higher.date) + ', not a record: EIA’s national weekly average reached ' + prior + '.',
    };
  }

  /* ---------- blocks 5 and 10: computed copy ----------
   * Month names, counts and "best month" verdicts were typed into the jobs note
   * and went stale on the next jobs report. They are derived here, and a verdict
   * that stops being true drops out rather than staying on the page. */
  monthLong(iso) { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  dayLong(iso) { const [d, m, y] = this.fmtISO(iso).split(' '); return d + ' ' + m[0] + m.slice(1).toLowerCase() + ' ' + y; }
  // how many months the latest print has been the best of, counting itself; 1 if it is not
  bestRun(months) {
    const last = months.at(-1); let k = 1;
    for (let i = months.length - 2; i >= 0 && months[i][1] < last[1]; i--) k++;
    return k;
  }
  // "Jan 2025": the board's series labels. Built from fmtISO rather than the
  // locale, which writes "Sept" where the rest of the page writes "SEP".
  monShort(iso) { const [, m, y] = this.fmtISO(iso).split(' '); return m[0] + m.slice(1).toLowerCase() + ' ' + y; }
  // Dates in the method notes that move with the data. Typed, they said "30 August"
  // and "July 2026" after the series had moved on, and the strait percentages
  // were a week-one reading (Cape 103%, Bab el-Mandeb 78%).
  dateVals() {
    const D = this.data, P = this.prices, B = this.bill, keys = 'globeThrough capePct babPct pricesMonth dieselFrom dieselThrough gasThrough elecThrough treasSentence'.split(' ');
    if (!D || !P || !B) return Object.fromEntries(keys.map(k => [k, '']));
    const ends = P.items.map(i => i.end_date).sort(), anyState = Object.values(P.receipt_inputs.electricity_by_state)[0], us = P.receipt_inputs.regions.NUS || Object.values(P.receipt_inputs.regions)[0];
    const T = B.gold.treasuries, jan = T.find(p => p[0].slice(5, 7) === '01') || T[0], last = T.at(-1), tn = v => '$' + (v / 1e6).toFixed(2) + 'tn';
    return {
      globeThrough: this.dayLong(D.hormuz_daily.at(-1)[0]),
      capePct: Math.round(D.items.good_hope.recent.pct_of_baseline) + '%', babPct: Math.round(D.items.bab_el_mandeb.recent.pct_of_baseline) + '%',
      pricesMonth: this.monthLong(ends.at(-1)),
      dieselFrom: this.dayLong(P.diesel.handover.date), dieselThrough: this.dayLong(P.diesel.latest.date),
      gasThrough: us ? this.dayLong(us.latest.date) : '', elecThrough: anyState ? this.monthLong(anyState.latest.date) : '',
      treasSentence: 'Treasuries in Fed custody for foreign officials went from ' + tn(jan[1]) + ' in ' + this.monthLong(jan[0]).split(' ')[0] + ' to ' + tn(last[1]) + ' in ' + this.monthLong(last[0]).split(' ')[0] + (last[1] > T.at(-2)[1] ? ', up on the month before' : '') + ';',
    };
  }
  // 0-99 in words, for counts that open a sentence ("Eighteen stars")
  words(n) {
    const u = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const t = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    return n < 20 ? u[n] : n < 100 ? t[Math.floor(n / 10)] + (n % 10 ? '-' + u[n % 10] : '') : String(n);
  }
  // The war's cost and toll, from war_cost in the data. The page typed "$37.5
  // billion ... 21 July 2026" in five places; the Pentagon's own estimate moved
  // to $43.6bn and the copy would have disagreed with the bar beside it.
  warVals() {
    const W = this.bill && this.bill.war_cost, keys = 'warHead warNote warCite warSpent warAsOf warWho casHead casDate casAlt quoteNote'.split(' ');
    if (!W) return Object.fromEntries(keys.map(k => [k, '']));
    const d = W.dod_cost, p = d.prior, p2 = d.prior_2, c = W.casualties, wp = c.wapo_count, day = iso => this.dayLong(iso);
    const cap = s => s[0].toUpperCase() + s.slice(1);
    return {
      warHead: '$' + d.usd_bn + ' billion.',
      warNote: cap(d.who || 'the latest official estimate') + ', as of ' + day(d.as_of) + (d.reported ? ' and reported ' + day(d.reported) : '') + (p ? ', up from $' + p.usd_bn + 'bn in ' + (p.who || 'an earlier estimate') + ' on ' + day(p.as_of) : '') + (p2 ? ' and $' + p2.usd_bn + 'bn on ' + day(p2.as_of) : '') + '.' + (d.tier > 1 ? ' It is reported rather than published, so it counts as Tier 2.' : ''),
      warCite: (d.cite || d.source) + (p && p.cite ? ' · earlier: ' + p.cite : ''),
      warSpent: '$' + d.usd_bn + ' billion', warAsOf: day(d.as_of), warWho: d.who || 'the latest official estimate',
      casHead: cap(this.words(c.us_killed)) + ' stars.', casDate: day(c.as_of),
      // the one time the page quotes his forecast, with its date and source
      quoteNote: W.trump_quote ? 'The President said "' + W.trump_quote.text + '" on ' + day(W.trump_quote.date) + ' (' + W.trump_quote.source + ').' : '',
      casAlt: wp ? ' The Washington Post reported on ' + day(wp.reported) + ', citing ' + this.words(wp.officials_cited) + ' US officials, at least ' + wp.killed_at_least + ' deaths; the Defense Secretary called the report false. The official count is drawn, and both are printed here.' : '',
    };
  }
  jobsVals() {
    const B = this.bill, keys = 'jobsNeg jobsLatest ltuWhen unempDir layoffs payMonth claimsNote jobsSentence'.split(' ');
    if (!B || !this.cMonths) return Object.fromEntries(keys.map(k => [k, '']));
    const M = this.cMonths, last = M.at(-1), run = this.bestRun(M), n = v => Math.round(v).toLocaleString();
    const ltuTerm = B.ltu.points.filter(p => p[0] >= '2025-01-01').map(p => p[1]);
    const u0 = (B.unemployment.points.find(p => p[0] === '2025-01-01') || [0, B.unemployment.handover.value])[1], u1 = B.unemployment.latest.value;
    let claimsNote = '';
    if (B.claims && B.layoffs && B.ltu_count) {
      const lc = B.ltu_count, pa = B.participation;
      claimsNote = 'New claims for unemployment benefit were ' + n(B.claims.latest.value) + ' in the week to ' + this.dayLong(B.claims.latest.date) + '. Claims count people who are let go, and few are: ' + B.layoffs.latest.value.toFixed(1) + '% of workers were laid off in ' + this.monthLong(B.layoffs.latest.date) + '. They do not count people who cannot get hired, which is where the market froze, so the damage shows up as time out of work: ' + n(lc.latest.value * 1000) + ' people have been looking for 27 weeks or more, against ' + n(lc.handover.value * 1000) + ' in January 2025. Claims also miss people whose benefits have run out, who never qualified, or who took a worse job to get by; U-6, which adds part-timers who want full-time work and people who have stopped looking, is ' + B.u6.latest.value.toFixed(1) + '%.'
        + (pa ? ' Labour-force participation is ' + pa.latest.value.toFixed(1) + '%, against ' + pa.handover.value.toFixed(1) + '% in January 2025; an ageing population and lower immigration account for part of that, so not all of it is people giving up.' : '');
    }
    return {
      jobsNeg: this.numWord(M.filter(m => m[1] < 0).length),
      jobsLatest: this.monthLong(last[0]) + ' at ' + (last[1] < 0 ? '\u2212' : '+') + n(Math.abs(last[1])) + (run >= 3 ? ', the best month in ' + this.numWord(run) + ', drawn brighter because it deserves to be' : ''),
      ltuWhen: this.monthLong(B.ltu.latest.date) + (B.ltu.latest.value >= Math.max(...ltuTerm) ? ', the highest of his term' : ''),
      unempDir: u1 > u0 ? 'up from' : u1 < u0 ? 'down from' : 'unchanged from',
      layoffs: B.layoffs ? B.layoffs.latest.value.toFixed(1) : '',
      payMonth: B.pay.ahe_date ? this.monthLong(B.pay.ahe_date) : 'the latest month',
      claimsNote,
      // block 05's sentence: "longer than at any point since he took office" only while it is
      jobsSentence: 'Few people are being fired, but if you lose your job you stay out longer than ' + (B.ltu.latest.value >= Math.max(...ltuTerm) ? 'at any point since he took office' : 'when he took office')
        + (B.pay.real_yoy_pct < 0 ? ', and your paycheck buys less than it did a year ago.' : ', though your paycheck buys a little more than it did a year ago.'),
    };
  }
  againstRows() {
    const A = this.bill && this.bill.against, B = this.bill; if (!A) return [];
    const rows = [], pct = (a, b) => (a / b - 1) * 100, sgn = v => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(1) + '%';
    const day = iso => this.dayLong(iso), month = iso => this.monthLong(iso), n = v => Math.round(v).toLocaleString();
    const s = A.sp500;
    if (s && s.latest && s.handover && s.latest.value > s.handover.value) rows.push({ head: 'Stocks are up.', text: 'The S&P 500 closed at ' + n(s.latest.value) + ' on ' + day(s.latest.date) + ', ' + sgn(pct(s.latest.value, s.handover.value)) + ' since the handover' + (s.prewar ? ' and ' + sgn(pct(s.latest.value, s.prewar.value)) + ' since the war began' : '') + '.' });
    const m = A.mortgage;
    // A tenth of a point either way is "about the same": at 7.03% against 7.04% the
    // old "cost less" was true to the hundredth and misleading to a reader.
    const mGap = m && m.latest && m.handover ? m.handover.value - m.latest.value : null;
    if (mGap != null && mGap > -0.1) rows.push({ head: mGap >= 0.1 ? 'Mortgages cost less than at the handover.' : 'Mortgages cost about what they did at the handover.', text: 'The 30-year fixed rate is ' + m.latest.value.toFixed(2) + '% (' + day(m.latest.date) + '), against ' + m.handover.value.toFixed(2) + '% in January 2025' + (m.prewar && m.latest.value > m.prewar.value ? ', though it is above the ' + m.prewar.value.toFixed(2) + '% of the week before the war' : '') + '.' });
    if (B.claims && B.layoffs) rows.push({ head: 'Almost nobody is being laid off.', text: 'New jobless claims were ' + n(B.claims.latest.value) + ' in the week to ' + day(B.claims.latest.date) + ', and ' + B.layoffs.latest.value.toFixed(1) + '% of workers were laid off in ' + month(B.layoffs.latest.date) + '. What this page says about jobs is about hiring, not firing.' });
    const j = A.latest_jobs;
    if (j && j.value > A.jobs_mean) rows.push({ head: 'The latest month was better.', text: 'Payrolls rose ' + n(j.value) + ' in ' + month(j.date) + ', above the ' + n(A.jobs_mean) + ' a month since January 2025. One month moves that average little, and it does not move the hires rate.' });
    // Core CPI below the headline cuts against the page, but calling it modest would
    // hide the rest: the Fed's own target measure is well above 2%, and the Fed is
    // raising rates. The row prints all three.
    const c = A.core_cpi_yoy, h = A.headline_yoy, pce = A.core_pce_yoy, F = A.fomc;
    if (c && h && c.value < h.value) {
      let fed = '';
      if (F && F.change_bp > 0) {
        const r = F.target_range_pct, mid = (r[0] + r[1]) / 2, end = F.sep_medians && F.sep_medians.fed_funds_end_2026_pct;
        const more = end ? Math.round((end - mid) / 0.25) : 0;
        fed = ' On ' + day(F.announced) + ' the Fed raised its rate to ' + r[0].toFixed(2) + '-' + r[1].toFixed(2) + '%' + (F.first_hike_since ? ', its first increase since ' + F.first_hike_since : '')
          + (F.statement_inflation ? ', saying \u201C' + F.statement_inflation.replace(/\.$/, '').toLowerCase() + '\u201D' : '') + '.'
          + (more > 0 ? ' Its median projection has ' + (more === 1 ? 'one more increase' : this.words(more) + ' more increases') + ' this year.' : '');
      }
      rows.push({
        head: 'Core CPI is lower. The Fed is not reassured.',
        text: 'Core CPI, which leaves out food and energy, rose ' + c.value.toFixed(1) + '% in the year to ' + month(c.date) + ', against ' + h.value.toFixed(1) + '% for everything.'
          + (pce ? ' The measure the Fed targets, core PCE, rose ' + pce.value.toFixed(1) + '% in the year to ' + month(pce.date) + ', against a goal of 2%.' : '') + fed,
      });
    }
    const cu = A.customs;
    if (cu && cu.latest.value > 0 && cu.months_negative.length && cu.months_negative.at(-1) < cu.latest.date) {
      const names = cu.months_negative.map(d => month(d).split(' ')[0]);
      rows.push({ head: 'Tariff receipts are positive again.', text: 'Customs duties net of refunds were $' + (cu.latest.value / 1e9).toFixed(1) + 'bn in ' + month(cu.latest.date) + ', after refunds of struck-down tariffs exceeded collections in ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0]) + '.' });
    }
    const cr = A.crude;
    if (cr && cr.month_ago && cr.latest.value < cr.month_ago.value * 0.95) rows.push({ head: 'Oil is falling.', text: 'WTI closed at $' + cr.latest.value.toFixed(2) + ' on ' + day(cr.latest.date) + ', down ' + Math.abs(pct(cr.latest.value, cr.month_ago.value)).toFixed(0) + '% from $' + cr.month_ago.value.toFixed(2) + ' a month earlier.' });
    return rows;
  }

  /* ---------- block 9: the bill ---------- */
  cardItems() {
    const B = this.bill, P = this.prices, D = this.data, C = this.crude, R = this.cardItemRefs;
    if (!B || !P || !D || !C) return R.map(ref => ({ ref, num: '', label: '', color: '#D4A017' }));
    const h = D.items.hormuz;
    return [
      { num: '+$' + Math.round(P.receipt.monthly_usd), label: 'a month for a household · $' + Math.round(P.receipt.cumulative_usd).toLocaleString() + ' since 20 Jan 2025', color: '#D4A017' },
      { num: '$' + Math.round(C.observations[0][1]) + ' → $' + Math.round(C.observations.at(-1)[1]), label: 'crude oil · January to now · $' + Math.round(C.peak.value) + ' at the peak, ' + this.storyVals().oilWeeks + ' weeks into the war', color: '#D4A017' },
      { num: Math.round(h.recent.mean7_total) + ' / day', label: 'ships through Hormuz · was ' + Math.round(h.baseline.total_per_day), color: '#D4A017' },
      { num: '$' + P.diesel.latest.value.toFixed(2), label: this.dieselVals().dieselLabel, color: '#D4A017' },
      { num: Math.round(B.jobs.curr.mean_monthly / 1000) + ',000', label: 'new jobs a month · was ' + Math.round(this.jobsBase().mean / 1000) + ',000 in ' + this.jobsBase().label, color: '#D4A017' },
      { num: B.war_cost.casualties.us_killed + ' dead', label: B.war_cost.aircraft.total_lost_or_damaged + ' aircraft · $' + B.war_cost.dod_cost.usd_bn + 'bn spent', color: '#F7F5F0' },
      { num: B.gold.tonnes_out.toFixed(0) + ' t', label: 'gold out of the New York Fed · ' + this.words(B.gold.earmarked.length - 1) + ' months', color: '#D4A017' },
      { num: '24 & 28\u00a0Feb', label: 'he re-imposed the tariffs · he ordered the strike', color: MARK_RED },
    ].map((c, i) => ({ ...c, ref: R[i] }));
  }
  stepCard(P) {
    this.cardItemRefs.forEach((ref, i) => {
      const el = ref.current; if (!el) return;
      const u = Math.max(0, Math.min(1, (P - 0.05 - i * 0.07) / 0.16)), e = 1 - Math.pow(1 - u, 3);
      el.style.opacity = String(e); el.style.transform = 'translateY(' + (24 * (1 - e)).toFixed(1) + 'px)';
    });
  }

  /* ---------- blocks 5–7: data for the readouts and Show the work ---------- */
  billVals() {
    const B = this.bill;
    if (!B) return Object.fromEntries('jobsPrev jobsCurr jobsN jobsMed jobsPrevMed ltu0 ltu1 unemp0 unemp1 hires quits aheYoy cpiYoy realYoy aircraftList vaultStart vaultEnd vaultOut'.split(' ').map(k => [k, '']).concat([['vaultRows', []]]));
    const fmt = n => Math.round(n).toLocaleString();
    const ltu = B.ltu.points, un = B.unemployment.points;
    const at = (pts, d) => (pts.find(p => p[0] === d) || [0, null])[1];
    const f1 = v => (v == null ? '' : v.toFixed(1));
    const mon = iso => { const [, m, y] = this.fmtISO(iso).split(' '); return m + ' ' + y.slice(2); };
    return {
      jobsPrev: fmt(this.jobsBase().mean), jobsCurr: fmt(B.jobs.curr.mean_monthly), jobsN: B.jobs.curr.n_months, jobsMed: fmt(B.jobs.curr.median_monthly), jobsPrevMed: fmt(this.jobsBase().median),
      ltu0: f1(at(ltu, '2025-01-01')), ltu1: f1(B.ltu.latest.value), unemp0: f1(at(un, '2025-01-01')), unemp1: f1(B.unemployment.latest.value), hires: B.hires.latest.value, quits: B.quits.latest.value,
      aheYoy: B.pay.ahe_yoy_pct.toFixed(1), cpiYoy: B.pay.cpi_yoy_pct.toFixed(1), realYoy: B.pay.real_yoy_pct.toFixed(1),
      aircraftList: Object.entries(B.war_cost.aircraft.by_type).map(([k, v]) => v + ' ' + k).join(', '),
      vaultStart: fmt(B.gold.earmarked[0][2]), vaultEnd: fmt(B.gold.earmarked.at(-1)[2]), vaultOut: B.gold.tonnes_out,
      vaultRows: B.gold.earmarked.map(p => ({ m: mon(p[0]), t: fmt(p[2]) + ' t' })),
    };
  }
  setupBill() {
    const B = this.bill;
    // block 5: the months of his term, and the previous-term pace for the same months
    this.cMonths = B.jobs.monthly.filter(m => m[0] >= '2025-02-01');   // the 19 months of his term; January 2025 belongs to the previous one
    this.cPrevPace = this.jobsBase().mean;
    this.cLeft = []; this.cRight = []; this.cMonthDone = -1;
    // the latest month is drawn brighter only while it is the best of at least three
    this.cBright = this.bestRun(this.cMonths) >= 3 ? this.cMonths.at(-1)[0] : null;
    // block 8: only the gold that left, in 400-ounce bars, one icon for ten bars
    const E = B.gold.earmarked;
    this.vTotal = Math.round(E[0][2]);
    this.vOut = E.slice(1).map((p, i) => ({ date: p[0], n: Math.round(E[i][2] - p[2]), t: E[i][2] - p[2] }));
    this.vIcons = this.vOut.map(o => Math.max(0, Math.round(o.t / this.BAR_T / 10)));
    this.vIconTotal = this.vIcons.reduce((a, b) => a + b, 0);
    this.vMoves = this.goldMoves((B.gold.moves || []).filter(m => !/No bar was physically shipped/i.test(m.note || '')));
    this.vBars = []; this.vGone = []; this.vMonthDone = -1;
  }
  seeded(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  /* ---------- block 5: the crowd ---------- */
  stepCrowd(dt, P, t) {
    const cv = this.crowdRef.current, B = this.bill; if (!cv || !B) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640;
    const N = this.cMonths.length;
    const tl = Math.max(0, Math.min(1, (P - 0.02) / 0.7));
    const mIdx = Math.min(N - 1, Math.floor(tl * N));       // month being poured
    if (mIdx < this.cMonthDone) { this.cLeft = []; this.cRight = []; this.cMonthDone = -1; }
    while (this.cMonthDone < mIdx) {
      this.cMonthDone++;
      const m = this.cMonths[this.cMonthDone], k = this.cMonthDone;
      const nL = Math.round(this.cPrevPace / 10000), nR = Math.round(m[1] / 10000);
      for (let i = 0; i < nL; i++) this.cLeft.push({ born: t + i * 12, m: k });
      if (nR >= 0) for (let i = 0; i < nR; i++) this.cRight.push({ born: t + i * 40, m: k, bright: this.cBright === m[0] });
      else for (let i = 0; i < -nR; i++) { const idx = this.cRight.length - 1 - i; if (idx >= 0 && !this.cRight[idx].leaving) this.cRight[idx].leaving = t + i * 30; }
    }
    // two stadiums: dots stack in rows of `cols`
    const pad = mobile ? 16 : 36, gap = mobile ? 12 : 48, top = Math.max(H * (mobile ? 0.16 : 0.15), 128), bot = H * (mobile ? 0.42 : 0.44);
    const stadW = (W - pad * 2 - gap) / 2, stadH = bot - top, NL = N * Math.round(this.cPrevPace / 10000);
    const fw = Math.max(5, Math.sqrt(stadW * stadH * 0.88 / (1.9 * NL))), fh = fw * 1.9, cols = Math.floor(stadW / fw), step = stadW / cols;
    const person = (x, y, w, fill, a) => {
      ctx.globalAlpha = a; ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(x, y - w * 1.5, w * 0.2, 0, 6.2832); ctx.fill();
      const bw = w * 0.64, bh = w * 1.15; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - bw / 2, y - bh, bw, bh, [bw / 2, bw / 2, 1, 1]); else ctx.rect(x - bw / 2, y - bh, bw, bh);
      ctx.fill();
    };
    const drawStadium = (x0, dots, title, sub, color) => {
      ctx.strokeStyle = 'rgba(247,245,240,.18)'; ctx.lineWidth = 1; ctx.strokeRect(x0, top, stadW, bot - top);
      ctx.font = '500 ' + (mobile ? 11 : 13) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.75)'; ctx.textAlign = 'left'; ctx.fillText(title, x0, top - 36);
      ctx.fillStyle = color; ctx.font = '700 ' + (mobile ? 21 : 26) + 'px "Barlow Condensed", sans-serif'; ctx.fillText(sub, x0, top - 9);
      let n = 0;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i], age = (t - d.born) / 400; if (age < 0) continue;
        if (d.leaving && t - d.leaving > 520) continue;
        const col = n % cols, row = Math.floor(n / cols); n++;
        const tx = x0 + step / 2 + col * step, ty = bot - fh * 0.08 - row * fh; if (ty - fh < top) continue;
        const e = Math.min(1, age), y = ty - (1 - e) * (1 - e) * 120;
        let a = 1, fill = d.bright ? '#FFE08A' : color;
        if (d.leaving) { const la = Math.min(1, (t - d.leaving) / 500); a = 1 - la; fill = '#E04B5C'; }
        person(tx, y, fw, fill, a * Math.min(1, age * 2));
      }
      ctx.globalAlpha = 1;
    };
    const cur = this.cMonths[mIdx], base = this.jobsBase(), K = v => (v >= 0 ? '+' : '\u2212') + Math.abs(Math.round(v / 1000)) + ',000';
    // Both headers state an average a month, the same measure as the headline under them.
    // The right one used to print the month being poured, so it ended on "+162,000 IN
    // AUGUST" in gold beside "hiring has slowed": the latest month is now a small note.
    const soFar = this.cMonths.slice(0, mIdx + 1), meanR = soFar.reduce((s, m) => s + m[1], 0) / soFar.length;
    drawStadium(pad, this.cLeft, mobile ? 'AT THE ' + base.label + ' PACE' : 'AT THE ' + base.label + ' PACE · THE TWO YEARS BEFORE HE TOOK OFFICE', K(this.cPrevPace) + ' A MONTH', 'rgba(247,245,240,.75)');
    drawStadium(pad + stadW + gap, this.cRight, mobile ? 'SINCE 20 JAN 2025' : 'WHAT HAPPENED · SINCE 20 JAN 2025', K(meanR) + ' A MONTH', '#F2C94C');
    if (!mobile) {
      ctx.font = '500 14px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.78)'; ctx.textAlign = 'right';
      ctx.fillText('LATEST MONTH · ' + (cur[1] >= 0 ? '+' : '\u2212') + Math.abs(cur[1]).toLocaleString(), pad + stadW * 2 + gap, top - 9); ctx.textAlign = 'left';
    }
    // where the right-hand crowd would stand at the earlier pace
    const rowsL = Math.ceil(this.cLeft.length / cols);
    if (rowsL > 0) {
      const gy = Math.max(top + 1, bot - fh * 0.08 - rowsL * fh + fh * 0.15), gx0 = pad + stadW + gap;
      ctx.strokeStyle = 'rgba(247,245,240,.55)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(gx0, gy); ctx.lineTo(gx0 + stadW, gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '500 ' + (mobile ? 11 : 12) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.7)'; ctx.textAlign = 'right';
      ctx.fillText(mobile ? base.label + ' PACE' : 'AT THE ' + base.label + ' PACE THIS CROWD WOULD REACH HERE', gx0 + stadW - 6, gy - 7 < top + 14 ? gy + 16 : gy - 7); ctx.textAlign = 'left';
    }
    if (mobile) { ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.6)'; ctx.fillText('TOTALS SINCE JAN 2025 · 1 FIGURE = 10,000 JOBS', pad, bot + 18);
      const ltuL = B.ltu.latest.value, ltu0 = (B.ltu.points.find(p => p[0] === '2025-01-01') || [0, B.ltu.handover.value])[1];
      ctx.fillStyle = 'rgba(247,245,240,.85)'; ctx.fillText('OUT 6+ MONTHS: ' + Math.round(ltuL) + ' IN 100, WAS ' + Math.round(ltu0) + ' · REAL PAY ' + (B.pay.real_yoy_pct > 0 ? '+' : '−') + Math.abs(B.pay.real_yoy_pct).toFixed(1) + '%', pad, bot + 36);
    }
    // the frozen row: 100 figures for the unemployed; lit = out of work 27 weeks or more
    if (!mobile) {
      const ltuNow = (B.ltu.points.find(p => p[0] === cur[0]) || [0, B.ltu.latest.value])[1];
      const ry = bot + 34, fw = stadW / 100;
      ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.8)'; ctx.fillText('OUT OF WORK SIX MONTHS OR MORE · PER 100 UNEMPLOYED', pad, ry - 10);
      ctx.fillStyle = '#F7F5F0'; ctx.font = '700 26px "Barlow Condensed", sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(ltuNow) + ' IN 100 · WAS ' + Math.round(B.ltu.points.find(p => p[0] === '2025-01-01')[1]), pad + stadW, ry - 8); ctx.textAlign = 'left';
      for (let i = 0; i < 100; i++) { const lit = i < Math.round(ltuNow); ctx.fillStyle = lit ? '#F7F5F0' : 'rgba(247,245,240,.2)'; const x = pad + i * fw + fw / 2; ctx.beginPath(); ctx.arc(x, ry + 4, 2.6, 0, 6.2832); ctx.fill(); ctx.fillRect(x - 1.8, ry + 8, 3.6, 10); }
      // the paycheck, under the right-hand crowd
      const px = pad + stadW + gap, py = ry;
      ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.7)'; ctx.fillText('YOUR RAISE, AFTER PRICES · YEAR TO ' + (B.pay.ahe_date ? this.monthLong(B.pay.ahe_date).toUpperCase() : 'THE LATEST MONTH'), px, py - 10);
      ctx.font = '700 44px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#F7F5F0'; ctx.fillText((B.pay.real_yoy_pct > 0 ? '+' : '−') + Math.abs(B.pay.real_yoy_pct).toFixed(1) + '%', px, py + 32); const pw = ctx.measureText((B.pay.real_yoy_pct > 0 ? '+' : '−') + Math.abs(B.pay.real_yoy_pct).toFixed(1) + '%').width;
      ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.7)'; ctx.fillText('PAY +' + B.pay.ahe_yoy_pct.toFixed(1) + '% · PRICES +' + B.pay.cpi_yoy_pct.toFixed(1) + '%', px + pw + 14, py + 30);
    }
    const sg = ctx.createLinearGradient(0, H * 0.55, 0, H); sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.9)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    set(this.crowdDateRef, new Date(cur[0] + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase());
    const shown = this.cMonths.slice(0, mIdx + 1); const mean = shown.reduce((s, m) => s + m[1], 0) / shown.length;
    set(this.crowdNumRef, Math.round(mean / 1000).toLocaleString() + ',000');
  }

  /* ---------- block 6: what the war cost ---------- */
  drawPlane(ctx, x, y, s, alpha, outline) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.18, -s * 0.2); ctx.lineTo(s, s * 0.25); ctx.lineTo(s, s * 0.45); ctx.lineTo(s * 0.15, s * 0.25); ctx.lineTo(s * 0.12, s * 0.7); ctx.lineTo(s * 0.4, s * 0.9); ctx.lineTo(s * 0.4, s); ctx.lineTo(0, s * 0.9);
    ctx.lineTo(-s * 0.4, s); ctx.lineTo(-s * 0.4, s * 0.9); ctx.lineTo(-s * 0.12, s * 0.7); ctx.lineTo(-s * 0.15, s * 0.25); ctx.lineTo(-s, s * 0.45); ctx.lineTo(-s, s * 0.25); ctx.lineTo(-s * 0.18, -s * 0.2); ctx.closePath();
    if (outline) { ctx.strokeStyle = 'rgba(247,245,240,.85)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke(); } else { ctx.fillStyle = '#F7F5F0'; ctx.fill(); }
    ctx.restore();
  }
  drawStar(ctx, x, y, R, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = '#F7F5F0'; ctx.shadowColor = 'rgba(247,245,240,.6)'; ctx.shadowBlur = alpha * 14;
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.42 : R, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /* A ledger: one row per cost. Big number and its label on the left, the pictograph at full width on the right. */
  stepWar(dt, P, t) {
    const cv = this.warRef.current, B = this.bill; if (!cv || !B) return;
    const WC = B.war_cost;
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#6E1B27'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640, pad = mobile ? 16 : 36;
    const ph = (a, b) => Math.max(0, Math.min(1, (P - a) / (b - a)));
    const pStars = ph(0.02, 0.2), pPlanes = ph(0.2, 0.42), pMoney = ph(0.42, 0.66), pInt = ph(0.66, 0.86);
    const nRows = 4, top = H * (mobile ? 0.1 : 0.11), bot = H * (mobile ? 0.64 : 0.68), rowH = (bot - top) / nRows;
    const numW = mobile ? W - pad * 2 : Math.min(W * 0.28, 360);
    const gx = mobile ? pad : pad + numW + 32, gw = W - pad - gx;
    const nf = mobile ? Math.round(Math.min(rowH * 0.34, 48)) : Math.round(Math.min(rowH * 0.55, 96));
    ctx.textBaseline = 'alphabetic';
    const row = (i, num, unit, lab1, lab2, a) => {
      const y = top + i * rowH;
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(247,245,240,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      ctx.globalAlpha = Math.min(1, a * 3); ctx.textAlign = 'left';
      if (mobile) lab2 = null;
      const blockH = nf * 0.72 + 12 + (lab2 ? 34 : 17), y0 = mobile ? y + 8 : y + (rowH - blockH) / 2, by = y0 + nf * 0.72;
      ctx.font = '700 ' + nf + 'px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#D4A017'; ctx.fillText(num, pad, by);
      const nw = ctx.measureText(num).width;
      ctx.font = '600 ' + Math.round(nf * 0.3) + 'px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#F7F5F0'; ctx.fillText(unit, pad + nw + nf * 0.12, by);
      const maxW = mobile ? W - pad * 2 : numW;
      [lab1, lab2].forEach((s, k) => { if (!s) return; let fs = mobile ? 13 : 15; ctx.font = '500 ' + fs + 'px "IBM Plex Mono", monospace'; while (fs > 11 && ctx.measureText(s).width > maxW) { fs--; ctx.font = '500 ' + fs + 'px "IBM Plex Mono", monospace'; } ctx.fillStyle = 'rgba(247,245,240,.88)'; ctx.fillText(s, pad, by + 24 + k * 18); });
      return mobile ? { x: gx, y: y + rowH * 0.56, w: gw, h: rowH * 0.42 } : { x: gx, y, w: gw, h: rowH };
    };
    // 1 · the dead: eighteen stars
    const killed = WC.casualties.us_killed, lit = pStars * killed;
    let bx = row(0, String(Math.round(lit)), 'DEAD', 'US SERVICE MEMBERS KILLED', 'NBC NEWS · ' + this.fmtISO(B.war_cost.casualties.as_of) + ' · INJURED: ' + String(B.war_cost.casualties.us_injured).toUpperCase(), pStars);
    const perRow = 9, sR = Math.min(bx.h * 0.2, bx.w / (perRow * 2.5)), sStep = sR * 2.5;
    const sx0 = bx.x + sR * 1.2, sy0 = bx.y + bx.h / 2 - sStep / 2;
    for (let i = 0; i < killed; i++) { const a = Math.max(0, Math.min(1, lit - i)); if (a <= 0) continue; this.drawStar(ctx, sx0 + (i % perRow) * sStep, sy0 + Math.floor(i / perRow) * sStep, sR * (0.7 + 0.3 * a), a); }
    // 2 · the aircraft: manned filled, drones in outline
    const types = Object.entries(WC.aircraft.by_type), total = WC.aircraft.total_lost_or_damaged, shown = pPlanes * total;
    const manned = types.filter(([k]) => !/^MQ/.test(k)).reduce((s, [, v]) => s + v, 0), drones = total - manned;
    bx = row(1, String(Math.round(shown)), 'AIRCRAFT', 'LOST OR DAMAGED · ' + manned + ' MANNED · ' + drones + ' DRONES', 'CRS · ' + this.fmtISO(B.war_cost.aircraft.as_of), pPlanes);
    const pRow = mobile ? 14 : 21, pRows = Math.ceil(total / pRow), ps = Math.min(bx.h * 0.36 / pRows, bx.w / (pRow * 2.3)), pStep = ps * 2.3;
    const px0 = bx.x + ps, py0 = bx.y + bx.h / 2 - (pRows - 1) * pStep / 2;
    for (let i = 0; i < total; i++) { const a = Math.max(0, Math.min(1, shown - i)); if (a <= 0) continue; this.drawPlane(ctx, px0 + (i % pRow) * pStep, py0 + Math.floor(i / pRow) * pStep, ps, a, i >= manned); }
    // 3 · the money: spent in gold; what he has asked for on top, dashed; the munitions slice in red
    const spent = WC.dod_cost.usd_bn, ask = WC.supplemental_request.usd_bn, mun = WC.supplemental_request.munitions_usd_bn;
    const money = spent * Math.min(1, pMoney / 0.7), askA = Math.max(0, Math.min(1, (pMoney - 0.7) / 0.3));
    const cbo = WC.cbo_estimate;
    bx = row(2, '$' + money.toFixed(1) + 'bn', 'SPENT', mobile && cbo ? 'PENTAGON, TO ' + this.fmtISO(B.war_cost.dod_cost.as_of).replace(/ \d{4}$/, '') + ' · CBO: $' + cbo.usd_bn + 'BN TO ' + this.fmtISO(cbo.through).replace(/ \d{4}$/, '') : 'PENTAGON COST · TO ' + this.fmtISO(B.war_cost.dod_cost.as_of), cbo ? 'CBO\u2019S LOWER ESTIMATE · $' + cbo.usd_bn + 'BN TO ' + this.fmtISO(cbo.through) : '', pMoney);
    const bh = Math.min(bx.h * 0.34, 56), byy = bx.y + bx.h / 2 - bh / 2 - (mobile ? 4 : 6), ux = bx.w / (spent + ask);
    ctx.globalAlpha = Math.min(1, pMoney * 3);
    ctx.fillStyle = '#D4A017'; ctx.fillRect(bx.x, byy, ux * money, bh);
    ctx.font = '500 ' + (mobile ? 11 : 14) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#F7F5F0'; ctx.textAlign = 'left'; if (!mobile) ctx.fillText('SPENT · $' + money.toFixed(1) + 'BN', bx.x, byy - 8);
    if (askA > 0) {
      ctx.globalAlpha = askA;
      ctx.strokeStyle = 'rgba(247,245,240,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(bx.x + ux * spent + 0.5, byy + 0.5, ux * ask * askA - 1, bh - 1); ctx.setLineDash([]);
      if (askA >= 1) { ctx.fillStyle = '#0B1E3F'; ctx.fillRect(bx.x + ux * (spent + ask - mun), byy + 1, ux * mun - 1, bh - 2); }
      ctx.fillStyle = '#F7F5F0'; ctx.textAlign = 'right';
      if (mobile) ctx.fillText('DASHED: $' + ask.toFixed(1) + 'BN MORE ASKED FOR · $' + mun + 'BN MUNITIONS', bx.x + bx.w, byy + bh + 14);
      else { ctx.fillText('ASKED FOR · $' + ask.toFixed(1) + 'BN MORE', bx.x + bx.w, byy - 8); ctx.fillText('$' + mun + 'BN OF IT TO REPLACE MUNITIONS', bx.x + bx.w, byy + bh + 16); }
      ctx.textAlign = 'left';
    }
    // 4 · the interceptors: one hundred, two thirds fade, the denial printed beside them.
    // On phones too: the sentence under the ledger talks about them.
    {
      const M = WC.munitions, remain = M.patriot_remaining_share, keep = Math.round(remain * 100);
      bx = row(3, '1 in ' + Math.round(1 / remain), 'LEFT', 'PATRIOT INTERCEPTORS LEFT · CSIS, ' + this.fmtISO(M.as_of).replace(/ \d{4}$/, ''), 'REBUILDING TAKES ' + this.words(M.rebuild_years).toUpperCase() + ' YEARS OR MORE', pInt);
      const iw = bx.w / 100, ih = Math.min(bx.h * 0.4, 64), iy = bx.y + bx.h / 2 - ih / 2 - (mobile ? 8 : 14), base = Math.min(1, pInt * 3);
      for (let i = 0; i < 100; i++) { const gone = i >= keep; ctx.globalAlpha = base * (gone ? 1 - pInt * 0.85 : 1); ctx.fillStyle = gone ? 'rgba(247,245,240,.55)' : '#F7F5F0'; const x = bx.x + i * iw + iw / 2; ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x + iw * 0.32, iy + ih); ctx.lineTo(x - iw * 0.32, iy + ih); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = Math.max(0, Math.min(1, (pInt - 0.5) * 2));
      ctx.font = '500 ' + (mobile ? 11 : 15) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#F7F5F0'; ctx.fillText(mobile ? 'THE DEFENSE SECRETARY DISPUTES THIS' : 'THE SECRETARY OF DEFENSE DISPUTES THIS ESTIMATE · 5 AUG', bx.x, iy + ih + (mobile ? 15 : 24));
      if (!mobile) { ctx.fillStyle = 'rgba(247,245,240,.75)'; ctx.fillText('THE BUDGET REQUEST ASKS $' + mun + 'BN FOR MUNITIONS TO REPLACE THEM', bx.x, iy + ih + 44); }
    }
    ctx.globalAlpha = 1;
    const sg = ctx.createLinearGradient(0, H * 0.62, 0, H); sg.addColorStop(0, 'rgba(110,27,39,0)'); sg.addColorStop(1, 'rgba(110,27,39,.92)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.62, W, H * 0.38);
  }

  /* ---------- block 7: what it buys ---------- */
  setupBuy() {
    const WC = this.bill.war_cost, spent = WC.dod_cost.usd_bn * 1e9, loss = WC.aircraft.dod_loss_estimate_usd_bn * 1e9, diesel = this.prices.diesel.latest.value;
    const PS5 = 549.99, TUITION = 11610, HOTDOG = 1.5, JET = 82.5e6, HH = 132.2e6, DAY = 3.9e6 * 42, USPOP = 340e6, AC = WC.aircraft.total_lost_or_damaged;
    const days = Math.round(loss / diesel / DAY), dogs = Math.round(loss / HOTDOG / USPOP), hh = Math.round(HH / (loss / PS5)), S = '$' + WC.aircraft.dod_loss_estimate_usd_bn + 'BN';
    this.buyR = { PS5, TUITION, HOTDOG, JET, HH, DAY, USPOP, days, dogs, hh, spent, loss, diesel, AC, lossBn: WC.aircraft.dod_loss_estimate_usd_bn, ratio: Math.round(spent / loss) };
    const date = AC + ' AIRCRAFT LOST OR DAMAGED · PENTAGON ESTIMATE $' + WC.aircraft.dod_loss_estimate_usd_bn + ' BILLION';
    this.buyBeats = [
      { total: JET / PS5, per: 1000, label: 'PlayStation 5s', sub: 'for one F-35A · $82.5 million', each: 'EACH SQUARE IS 1,000 PLAYSTATION 5s AT $549.99', math: '$82.5M ÷ $549.99 A CONSOLE', jet: true, kick: 'WHAT ONE F-35A COSTS', date: 'ONE F-35A · $82.5 MILLION · ONE WAS LOST' },
      { total: loss / PS5, per: 1e4, label: 'PlayStation 5s', sub: 'one for every ' + hh + ' households in America', each: 'EACH SQUARE IS 10,000 PLAYSTATION 5s AT $549.99', math: S + ' ÷ $549.99 A CONSOLE', date },
      { total: loss / diesel, per: 1e6, label: 'gallons of diesel', sub: days + ' days of every gallon America burns', each: 'EACH SQUARE IS 1 MILLION GALLONS AT $' + diesel.toFixed(2), math: S + ' ÷ $' + diesel.toFixed(2) + ' A GALLON', date },
      { total: loss / TUITION, per: 500, label: 'years of college tuition', sub: 'in-state, public four-year, at $11,610', each: 'EACH SQUARE IS 500 STUDENT-YEARS AT $11,610', math: S + ' ÷ $11,610 A YEAR', date },
      { total: loss / HOTDOG, per: 5e6, label: 'Costco hot dogs', sub: dogs + ' for every American', each: 'EACH SQUARE IS 5 MILLION HOT DOGS AT $1.50', math: S + ' ÷ $1.50 A HOT DOG AND SODA', date },
    ];
    this.buyBeats.forEach(b => { b.N = Math.round(b.total / b.per); b.kick = b.kick || 'WHAT THE LOST AIRCRAFT COST'; });
    this.BEAT = 4.7; this.SPAWN = 2.2; this.FALL = 0.5; this.FINALE = 6.8; this.buyDur = this.buyBeats.length * this.BEAT + this.FINALE;
  }
  buyVals() {
    const R = this.buyR; if (!R) return { buyDays: '', buyDogs: '', buyPS5: '', buyDiesel: '', buyGallons: '', buyTuition: '', buyDogsTotal: '', buyJet: '', buyHH: '', buyRatio: '', buyLoss: '' };
    const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
    return { buyDays: W[R.days] || R.days, buyDogs: W[R.dogs] || R.dogs, buyPS5: (R.loss / R.PS5 / 1e6).toFixed(1), buyDiesel: R.diesel.toFixed(2), buyGallons: Math.round(R.loss / R.diesel / 1e6), buyTuition: Math.round(R.loss / R.TUITION / 1000), buyDogsTotal: (R.loss / R.HOTDOG / 1e9).toFixed(1), buyJet: Math.round(R.JET / R.PS5).toLocaleString(), buyHH: R.hh, buyRatio: W[R.ratio] || R.ratio, buyLoss: R.lossBn };
  }
  /* squares fill the pile bottom-up, one row at a time, in a shuffled order within each row so the rain looks like rain */
  buyLayout(bi, W, H, mobile, extra) {
    const key = bi + '|' + W + '|' + H + '|' + extra;
    if (this.buyL && this.buyL.key === key) return this.buyL;
    const b = this.buyBeats[bi], pad = mobile ? 16 : 36;
    const x = mobile ? pad : W * 0.46, w = W - pad - x, y0 = Math.max(H * 0.13, 112), bot = H * (mobile ? 0.4 : 0.55);
    // the finale uses the frame from just under the header to the pile's floor
    const y = extra ? (mobile ? 118 : 96) : y0, hgt = Math.max(60, bot - y), N = b.N + extra;
    let cell = Math.max(2, Math.floor(Math.sqrt(w * hgt * (extra ? 1 : 0.8) / N))), cols = Math.max(1, Math.floor(w / cell));
    if (extra) while (cell > 2 && Math.ceil(N / cols) * cell > hgt) { cell--; cols = Math.max(1, Math.floor(w / cell)); }
    const col = new Int16Array(N), row = new Int16Array(N);
    let s = bi * 991 + 17;
    for (let r0 = 0; r0 * cols < N; r0++) {
      const perm = Array.from({ length: cols }, (_, i) => i);
      if (!extra) for (let i = cols - 1; i > 0; i--) { const j = Math.floor(this.seeded(s++) * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
      for (let j = 0; j < cols && r0 * cols + j < N; j++) { col[r0 * cols + j] = perm[j]; row[r0 * cols + j] = r0; }
    }
    const fillH = extra ? Math.ceil(N / cols) * cell : hgt;
    return (this.buyL = { key, x, y: y + hgt - fillH, w, h: fillH, cell, cols, col, row, N, xoff: (w - cols * cell) / 2 });
  }
  stepBuy(dt, P, t) {
    const cv = this.buyRef.current, B = this.bill; if (!cv || !B || !this.buyBeats) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640, pad = mobile ? 16 : 36, R = this.buyR, nB = this.buyBeats.length;
    const DUR = this.buyDur, time = this.reduced ? DUR - 0.01 : Math.min(P * DUR, DUR - 0.01), bi = Math.min(nB - 1, Math.floor(time / this.BEAT)), bt = time - bi * this.BEAT, finale = time >= nB * this.BEAT;
    const b = this.buyBeats[bi], extra = finale ? Math.round(b.N * R.spent / R.loss) : 0;
    const L = this.buyLayout(bi, W, H, mobile, extra);
    // the pile
    ctx.strokeStyle = 'rgba(247,245,240,.14)'; ctx.lineWidth = 1; ctx.strokeRect(L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1);
    let landedX = 0;
    for (let i = 0; i < L.N; i++) {
      const at = i < b.N ? (i / b.N) * this.SPAWN : this.BEAT + ((i - b.N) / extra) * 1.8;
      const age = (bt - at) / this.FALL; if (age <= 0) break;
      const ty = L.y + L.h - (L.row[i] + 1) * L.cell; if (ty < -L.cell) continue;
      const e = Math.min(1, age), yy = -L.cell + (ty + L.cell) * e * e, xx = L.x + L.xoff + L.col[i] * L.cell;
      if (e >= 1 && i >= b.N) landedX++;
      if (i < b.N) { ctx.fillStyle = (L.row[i] + L.col[i]) % 2 ? '#D4A017' : '#C2921A'; ctx.fillRect(xx + 0.5, yy + 0.5, L.cell - 1, L.cell - 1); }
      // the red squares run off the top, but not over the header lines
      else { ctx.fillStyle = 'rgba(224,75,92,.45)'; ctx.fillRect(xx + 0.5, yy + 0.5, L.cell - 1, L.cell - 1); if (L.cell >= 6) { ctx.strokeStyle = 'rgba(224,75,92,.95)'; ctx.strokeRect(xx + 1, yy + 1, L.cell - 2, L.cell - 2); } }
    }
    // left of the equals sign, the same money in jets: one F-35A for the first beat, the whole war's worth after that
    if (!mobile) {
      const a = Math.min(1, bt * 2), jw = L.x - 44 - pad;
      ctx.textAlign = 'center'; ctx.font = '500 14px "IBM Plex Mono", monospace';
      if (b.jet) {
        const jx = pad + jw * 0.5, jy = L.y + L.h * 0.46, s = Math.min(L.h * 0.36, jw * 0.3);
        this.drawPlane(ctx, jx, jy, s, a, false);
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(247,245,240,.7)'; ctx.fillText('ONE F-35A · $82.5 MILLION', jx, L.y - 10);
      } else {
        const T = B.war_cost.aircraft.by_type, n = R.AC, manned = Object.entries(T).filter(([k]) => !/^MQ/.test(k)).reduce((s, [, v]) => s + v, 0);
        const cols = 7, rows = Math.ceil(n / cols), cell = Math.min(jw / cols, L.h / rows) * 0.92, s = cell * 0.4;
        const x0 = pad + (jw - cols * cell) / 2 + cell / 2, y0 = L.y + L.h / 2 - rows * cell / 2 + cell / 2;
        for (let i = 0; i < n; i++) this.drawPlane(ctx, x0 + (i % cols) * cell, y0 + Math.floor(i / cols) * cell, s, a, i >= manned);
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(247,245,240,.7)';
        [[manned + ' MANNED · ' + (n - manned) + ' DRONES', L.y - 10]].forEach(([s, yy]) => { let fs = 14; ctx.font = '500 14px "IBM Plex Mono", monospace'; while (fs > 10 && ctx.measureText(s).width > jw) { fs--; ctx.font = '500 ' + fs + 'px "IBM Plex Mono", monospace'; } ctx.fillText(s, pad + jw / 2, yy); });
      }
      ctx.font = '700 ' + Math.round(L.h * 0.28) + 'px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#D4A017'; ctx.fillText('=', L.x - 22, L.y + L.h / 2 + L.h * 0.1);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    // captions on the pile
    ctx.font = '500 14px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    const perSq = R.loss / b.N / 1e6, sq = perSq >= 1 ? '$' + perSq.toFixed(perSq < 10 ? 1 : 0) + 'M' : '$' + Math.round(perSq * 1000) + 'K';
    const capT = finale ? (mobile ? 'GOLD: AIRCRAFT · RED: THE WAR · 1 SQUARE ' + sq : 'GOLD: THE AIRCRAFT, $' + R.lossBn + 'BN · RED: THE WHOLE WAR, $' + (R.spent / 1e9).toFixed(1) + 'BN · EACH SQUARE ' + sq) : b.each;
    if (mobile) ctx.font = '500 12px "IBM Plex Mono", monospace';
    if (finale) { ctx.fillStyle = '#0B1E3F'; ctx.fillRect(L.x - 4, L.y - 28, ctx.measureText(capT).width + 12, 24); }
    ctx.fillStyle = finale ? '#E04B5C' : 'rgba(247,245,240,.7)'; ctx.fillText(capT, L.x, L.y - 10);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(247,245,240,.45)'; if (!finale) ctx.fillText(b.math, L.x + L.w, L.y + L.h + 20); ctx.textAlign = 'left';
    const sg = ctx.createLinearGradient(0, H * 0.55, 0, H); sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.92)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    // readout
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    // the figure is the beat's total from the start, never a count in progress: a
    // screenshot mid-count read "3.8 million PlayStations" beside a sentence saying 4.7
    const v = b.total;
    const f = v >= 1e9 ? [(v / 1e9).toFixed(1), 'billion '] : v >= 1e6 ? [(v / 1e6).toFixed(1), 'million '] : [Math.round(v).toLocaleString(), ''];
    const num = this.buyNumRef.current, sub = this.buySubRef.current;
    if (finale && landedX > 0) {
      set(this.buyNumRef, '$' + (R.spent / 1e9).toFixed(1) + 'bn'); if (num) num.style.color = '#E04B5C';
      const html = 'the war so far<br><span style="color:rgba(247,245,240,.6)">' + this.words(R.ratio) + ' times the aircraft</span>';
      if (sub && sub.__html !== html) { sub.__html = html; sub.innerHTML = html; }
    } else {
      set(this.buyNumRef, f[0]); if (num) num.style.color = '#D4A017';
      const html = f[1] + b.label + '<br><span style="color:rgba(247,245,240,.6)">' + b.sub + '</span>';
      if (sub && sub.__html !== html) { sub.__html = html; sub.innerHTML = html; }
    }
    set(this.buyDateRef, b.date);
    set(this.buyKickRef, finale && landedX > 0 ? 'THE WHOLE WAR, SAME SCALE' : b.kick);
  }

  /* ---------- block 7: the vault ---------- */
  stepVault(dt, P, t) {
    const cv = this.vaultRef.current, B = this.bill; if (!cv || !B) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);
    const mobile = W < 640, pad = mobile ? 16 : 36, E = B.gold.earmarked;
    const N = this.vOut.length, tl = Math.max(0, Math.min(1, (P - 0.04) / 0.66));
    const mIdx = Math.min(N, Math.floor(tl * (N + 1)));     // months completed
    if (mIdx < this.vMonthDone) { this.vGone = []; this.vMonthDone = -1; }
    while (this.vMonthDone < mIdx - 1) { this.vMonthDone++; const k = this.vMonthDone; for (let i = 0; i < this.vIcons[k]; i++) this.vGone.push({ born: t + i * 4, m: k }); }
    // The pile: only what left New York, one icon for ten real 400-ounce bars, a month
    // at a time in alternating shades so the steady pace shows. Sized to fill the frame.
    const top = Math.max(H * (mobile ? 0.14 : 0.17), mobile ? 112 : 136), bot = H * (mobile ? 0.3 : 0.46), pileW = mobile ? W - pad * 2 : (W - pad * 2) * 0.54;
    const cols = Math.max(12, Math.ceil(Math.sqrt(this.vIconTotal * pileW / (1.8 * (bot - top))))), bw = pileW / cols;
    const bh = Math.min(bw / 1.8, (bot - top) / Math.ceil(this.vIconTotal / cols));
    const ingot = (x, y, w, hh, a, alt) => { ctx.globalAlpha = a; const i = Math.min(2, w * 0.14); ctx.fillStyle = alt ? '#9C7014' : '#B8871A'; ctx.beginPath(); ctx.moveTo(x, y + hh); ctx.lineTo(x + i, y); ctx.lineTo(x + w - i, y); ctx.lineTo(x + w, y + hh); ctx.closePath(); ctx.fill(); ctx.fillStyle = alt ? '#DDB13E' : '#F2C94C'; ctx.fillRect(x + i, y, Math.max(1, w - 2 * i), Math.max(1, hh * 0.32)); ctx.globalAlpha = 1; };
    ctx.strokeStyle = 'rgba(247,245,240,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, bot + 0.5); ctx.lineTo(pad + pileW, bot + 0.5); ctx.stroke();
    this.vGone.forEach((g, i) => {
      const col = i % cols, row = Math.floor(i / cols), e = Math.max(0, Math.min(1, (t - g.born) / 380)), ee = 1 - Math.pow(1 - e, 3);
      ingot(pad + col * bw + 0.5, bot - (row + 1) * bh + 0.5 - (1 - ee) * 60, Math.max(1, bw - 1.5), Math.max(1, bh - 1.5), ee, g.m % 2);
    });
    const outNow = E[0][2] - E[mIdx][2], barsNow = Math.round(outNow / this.BAR_T), gp = B.gold.gold_price && B.gold.gold_price.latest;
    const lf = mobile ? '500 11px "IBM Plex Mono", monospace' : '500 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left'; ctx.font = lf; ctx.fillStyle = 'rgba(247,245,240,.75)';
    ctx.fillText(mobile ? barsNow.toLocaleString() + ' BARS OUT · ONE ICON IS TEN BARS' : 'GOLD TAKEN OUT OF THE NEW YORK FED \u00b7 ' + barsNow.toLocaleString() + ' BARS OF 400 OUNCES \u00b7 ONE ICON IS TEN BARS', pad, top - 30);
    ctx.fillStyle = 'rgba(247,245,240,.6)';
    ctx.fillText(mobile ? Math.round(outNow) + ' T · ' + (100 * outNow / E[0][2]).toFixed(1) + '% OF THE FOREIGN GOLD THERE' : Math.round(outNow) + ' T' + (gp ? ' \u00b7 ABOUT $' + (outNow * 1e6 / 31.1034768 * gp.usd_oz / 1e9).toFixed(1) + 'BN AT $' + Math.round(gp.usd_oz).toLocaleString() + ' AN OUNCE' : '') + ' \u00b7 ' + (100 * outNow / E[0][2]).toFixed(1) + '% OF THE FOREIGN GOLD HELD THERE', pad, top - 12);
    // on a phone there is no room beside the pile, so the same two points go under it
    if (mobile) {
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      const who = this.vMoves.filter(m => !m.still).map(m => m.name + ' ' + m.t.split(' ')[0] + ' T').join(' \u00b7 ');
      if (tl > 0.3 && who) { ctx.globalAlpha = Math.min(1, (tl - 0.3) / 0.2); ctx.fillStyle = 'rgba(247,245,240,.8)'; ctx.fillText('WHO MOVED IT \u00b7 ' + who, pad, bot + 22); }
      if (tl >= 1) { ctx.globalAlpha = 1; ctx.fillStyle = '#8FA8E0'; ctx.fillText('FED ECONOMISTS: NOT A FLIGHT FROM THE DOLLAR', pad, bot + 40); }
      ctx.globalAlpha = 1;
    }
    // beside it: who moved theirs, and why, then the pace, then the Fed's answer at full size
    if (!mobile) {
      const tx = pad + pileW + 56, tw = W - pad - tx;
      const wrap = (s, font, max) => { ctx.font = font; const out = []; let line = ''; for (const w of s.split(' ')) { const tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > max && line) { out.push(line); line = w; } else line = tst; } if (line) out.push(line); return out; };
      ctx.fillStyle = 'rgba(247,245,240,.75)'; ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillText('WHO MOVED IT, AND WHY', tx, top - 12);
      let y = top + 18;
      this.vMoves.forEach((m, i) => {
        const a = Math.max(0, Math.min(1, (tl - 0.15 - i * 0.14) / 0.12)); if (!a) return;
        ctx.globalAlpha = a;
        ctx.fillStyle = m.still ? '#F7F5F0' : '#D4A017'; ctx.font = '700 24px "Barlow Condensed", sans-serif'; ctx.fillText(m.name + ' \u00b7 ' + m.t, tx, y);
        ctx.fillStyle = 'rgba(247,245,240,.7)'; ctx.font = '500 12px "IBM Plex Mono", monospace'; ctx.fillText(m.route, tx, y + 19);
        let yy = y + 36;
        if (m.why) wrap(m.why, '500 12px "IBM Plex Mono", monospace', tw).forEach(l => { ctx.fillStyle = m.why[0] === '\u201C' ? '#E0B43C' : 'rgba(247,245,240,.55)'; ctx.fillText(l, tx, yy); yy += 16; });
        y = yy + 14; ctx.globalAlpha = 1;
      });
      if (tl >= 1) {
        const days = (Date.parse(E.at(-1)[0]) - Date.parse(E[0][0])) / 86400000, perDay = Math.round((E[0][2] - E.at(-1)[2]) / this.BAR_T / days);
        ctx.fillStyle = '#F7F5F0'; ctx.font = '700 22px "Barlow Condensed", sans-serif';
        wrap('ABOUT ' + perDay + ' BARS A DAY, EVERY DAY, FOR ' + this.words(N).toUpperCase() + ' MONTHS.', '700 22px "Barlow Condensed", sans-serif', tw).forEach(l => { ctx.fillText(l, tx, y + 6); y += 24; });
        y += 14; ctx.fillStyle = '#6C8CD5';
        wrap('THE FED\u2019S ANSWER: NOT A FLIGHT FROM THE DOLLAR. GOLD IS DOWN A FIFTH FROM ITS JANUARY RECORD, AND THE DOLLAR IS UP SINCE THE WAR BEGAN.', '700 20px "Barlow Condensed", sans-serif', tw).forEach(l => { ctx.fillText(l, tx, y); y += 22; });
        ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(108,140,213,.85)';
        ctx.fillText('FEDS NOTES \u00b7 COLIN WEISS \u00b7 3 SEP 2026', tx, y + 6);
      }
    }
    const sg = ctx.createLinearGradient(0, H * 0.58, 0, H); sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.92)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.58, W, H * 0.42);
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    set(this.vaultNumRef, barsNow.toLocaleString());
    const d = mIdx === 0 ? E[0][0] : this.vOut[mIdx - 1].date;
    set(this.vaultDateRef, new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase() + (mIdx > 0 ? ' \u00b7 ' + Math.round(this.vOut[mIdx - 1].t / this.BAR_T).toLocaleString() + ' BARS OUT THIS MONTH' : ''));
  }

  /* ---------- block 4: prices ---------- */
  fmtPrice(v, unit) { const r = (x, d) => (Math.round(x * Math.pow(10, d) + 1e-6) / Math.pow(10, d)).toFixed(d); return unit === 'kwh' ? r(v * 100, 1) + '¢' : '$' + r(v, 2); }
  receiptFor(code) {
    const P = this.prices; if (!P) return null;
    if (code === 'US') return { name: 'the United States', fuel: P.receipt.lines[0].monthly_usd, groceries: P.receipt.lines[1].monthly_usd, elec: P.receipt.lines[2].monthly_usd, total: P.receipt.monthly_usd, gas: null, elecSeries: null };
    const ri = P.receipt_inputs, st = this.STATES.find(s => s.code === code);
    const gas = ri.regions['S' + code] || ri.regions[ri.state_to_padd[code]] || ri.regions.NUS;
    const el = ri.electricity_by_state[code];
    const fuel = (gas.latest.value - gas.handover.value) * P.receipt.lines[0].quantity;
    const elec = el ? (el.latest.value - el.handover.value) * P.receipt.lines[2].quantity : P.receipt.lines[2].monthly_usd;
    const groceries = P.receipt.lines[1].monthly_usd;
    return { name: st ? st.name : code, fuel, groceries, elec, total: fuel + groceries + elec, gas, elecSeries: el };
  }
  buildBoard(keepPhase) {
    const P = this.prices, sel = this.receiptFor(this.state.state);
    const prev = this.board || [];
    const items = P.items.filter(i => i.key !== 'eggs').concat(P.items.filter(i => i.key === 'eggs'));
    const rowsRaw = [{ key: 'diesel', name: 'Diesel', unit: 'per gallon, EIA weekly', start: P.diesel.handover.value, end: P.diesel.latest.value, u: 'usd', series: P.diesel.fred_id + ' · ' + this.dayLong(P.diesel.handover.date) + ' → ' + this.dayLong(P.diesel.latest.date) }]
      .concat(items.map(i => {
        let start = i.start, end = i.end, unit = i.note.split('.')[0], series = i.fred_id + ' · ' + this.monShort(i.start_date) + ' → ' + this.monShort(i.end_date);
        if (sel && sel.gas && i.key === 'gasoline_ap') { start = sel.gas.handover.value; end = sel.gas.latest.value; unit = 'per gallon, ' + sel.gas.name + ', EIA weekly'; series = 'EIA ' + sel.gas.name + ' · ' + this.dayLong(sel.gas.handover.date) + ' → ' + this.dayLong(sel.gas.latest.date); }
        if (sel && sel.elecSeries && i.key === 'electricity') { start = sel.elecSeries.handover.value; end = sel.elecSeries.latest.value; unit = 'per kWh, ' + sel.name + ', EIA monthly'; series = 'EIA residential ' + sel.name + ' · ' + this.monShort(sel.elecSeries.handover.date) + ' → ' + this.monShort(sel.elecSeries.latest.date); }
        if (i.key === 'eggs') unit = 'per dozen';
        return { key: i.key, name: i.name, unit, note: i.key === 'eggs' ? '· avian flu ended, not policy' : '', start, end, u: i.key === 'electricity' ? 'kwh' : 'usd', series };
      }));
    const order = ['diesel'].concat(rowsRaw.slice(1).sort((a, b) => (b.end / b.start) - (a.end / a.start)).map(r => r.key));
    this.board = order.map(k => {
      const r = rowsRaw.find(x => x.key === k), old = prev.find(x => x.key === k);
      const pct = (r.end / r.start - 1) * 100;
      const row = { ...r, startText: this.fmtPrice(r.start, r.u), endText: this.fmtPrice(r.end, r.u), up: r.end >= r.start,
        changeText: (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(0) + '%', phase: 'start', shown: '', flapOn: false, t: 0 };
      row.shown = row.startText;
      if (keepPhase && old && old.phase === 'done') { row.phase = 'done'; row.shown = row.endText; }
      if (keepPhase && old && old.phase === 'done' && old.endText !== row.endText) { row.phase = 'flipping'; row.t = 0; row.shown = old.endText; }
      return row;
    });
    const tOld = this.total;
    this.total = { endText: '+$' + sel.total.toFixed(2), shown: '+$0.00', phase: 'start', t: 0, flapOn: false };
    if (keepPhase && tOld && tOld.phase !== 'start') { this.total.phase = 'flipping'; this.total.shown = tOld.shown; }
    this.forceUpdate();
  }
  /* split-flap: each cell cycles through the glyph set until it lands; cells settle left to right */
  flipStep(r, dt) {
    r.t += dt;
    const GL = '0123456789';
    const target = r.endText, from = r.shown;
    const n = Math.max(target.length, from.length);
    let out = '', done = true;
    for (let j = 0; j < n; j++) {
      const tc = target[j] || '', fc = from[j] || tc;
      const settle = 0.18 + j * 0.07;
      if (r.t >= settle || !GL.includes(tc)) { out += tc; continue; }
      done = false;
      const k = Math.floor(r.t / 0.045) + j;
      out += GL[(GL.indexOf(fc) + k) % 10];
    }
    r.shown = out; r.flapOn = Math.floor(r.t / 0.045) % 2 === 0;
    if (done) { r.phase = 'done'; r.shown = target; r.flapOn = false; this.flipLanded = true; }
  }
  stepPrices(dt, P4) {
    if (!this.board) return;
    let changed = false;
    const N = this.board.length;
    this.board.forEach((r, i) => {
      const at = 0.04 + i * (0.66 / N);
      if (P4 >= at && r.phase === 'start') { r.phase = 'flipping'; r.t = 0; r.shown = r.startText; changed = true; }
      if (P4 < at && r.phase !== 'start') { r.phase = 'start'; r.shown = r.startText; r.flapOn = false; changed = true; }
      if (r.phase === 'flipping') { this.flipStep(r, dt); changed = true; }
    });
    const T = this.total, tAt = 0.76;
    if (P4 >= tAt && T.phase === 'start') { T.phase = 'flipping'; T.t = 0; changed = true; }
    if (P4 < tAt && T.phase !== 'start') { T.phase = 'start'; T.shown = '+$0.00'; changed = true; }
    if (T.phase === 'flipping') { this.flipStep(T, dt); changed = true; }
    if (changed) { this.flipAcc = (this.flipAcc || 0) + dt; if (this.flipAcc >= 0.04 || this.flipLanded) { this.flipAcc = 0; this.flipLanded = false; this.forceUpdate(); } }
    // the pump: roll through every published week, 20 Jan 2025 → 31 Aug 2026, over the first 70% of the scroll
    const pts = this.prices.diesel.points.filter(p => p[0] >= '2025-01-20');
    const u = Math.max(0, Math.min(1, (P4 - 0.02) / 0.7)) * (pts.length - 1);
    const i = Math.floor(u), f = u - i, a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
    const v = a[1] + (b[1] - a[1]) * f;
    this.setOdometer(v);
    const dstr = 'WEEK OF ' + this.fmtISO(b[0]);
    if (this.pWeekRef.current && this.pWeekRef.current.textContent !== dstr) this.pWeekRef.current.textContent = dstr;
    const mon = P4 < 0.04 ? 'JANUARY 2025' : P4 > 0.7 ? 'NOW · ' + this.monShort(this.prices.items.map(i => i.end_date).sort().at(-1)).toUpperCase() + ' · DIESEL ' + this.fmtISO(this.prices.diesel.latest.date).replace(/ \d{4}$/, '') : new Date(b[0] + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
    if (this.pDateRef.current && this.pDateRef.current.textContent !== mon) this.pDateRef.current.textContent = mon;
  }
  /* mechanical odometer: the cents wheel turns continuously, each higher wheel only as the one below passes 9 */
  setOdometer(v) {
    let x = v * 100;  // cents
    if (Math.abs(x - Math.round(x)) < 0.25) x = Math.round(x);   // rest on a whole cent
    const wheels = [100, 10, 1];
    let carry = 0;
    const pos = wheels.map(() => 0);
    for (let k = wheels.length - 1; k >= 0; k--) {
      const raw = x / wheels[k];
      const d = Math.floor(raw) % 10;
      const frac = k === wheels.length - 1 ? raw - Math.floor(raw) : (carry >= 9 ? carry - 9 : 0);
      pos[k] = d + frac;
      carry = d + frac;
    }
    pos.forEach((p, k) => { const el = this.odoRefs[k].current; if (el) el.style.transform = 'translateY(' + (-p).toFixed(3) + 'em)'; });
  }
  /* Each pinned block plays on its own clock once it fills the viewport: P runs 0→1 over dur seconds,
     holds at 1 while the block is nearby, and rewinds only once the block has fully left the screen. */
  playProgress(sec, key, dur, t, loop) {
    const r = sec.getBoundingClientRect(), vh = innerHeight, S = this.plays || (this.plays = {});
    if (r.top < vh * 0.4 && r.bottom > vh * 0.6) { if (S[key] === undefined) S[key] = t; }
    else if (r.bottom < 0 || r.top > vh) S[key] = undefined;
    if (S[key] === undefined) return 0; const raw = (t - S[key]) / (dur * 1000); return loop ? raw : Math.min(1, raw);
  }

  async componentDidMount() {
    // Each file loads on its own. With Promise.all, one missing file left every
    // canvas blank and no message: the rejection escaped the error boundary
    // because this method is async, and the loop never started. Now each block
    // sets up from what arrived, and a notice names what did not.
    const get = async f => {
      const r = await fetch(V5 + f + '.json');
      if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw new Error(f + ' ' + r.status);
      return r.json();
    };
    const FILES = ['globe-data', 'land-110m', 'land-50m', 'strait-coast', 'prices-data', 'crude-data', 'hormuz-coast', 'bill-data'];
    const got = await Promise.allSettled(FILES.map(f => get(f).catch(() => get(f))));
    const [data, land110, land50, coast, prices, crude, coastBox, bill] = got.map(g => (g.status === 'fulfilled' ? g.value : null));
    const missing = FILES.filter((f, k) => got[k].status !== 'fulfilled');
    const safe = (what, fn) => { try { fn(); } catch (e) { console.error('The Bill: ' + what, e); missing.push(what); } };
    if (crude) safe('crude chart', () => { this.crude = crude; this.setupSeis(); });
    this.coastBox = coastBox; this.strShips = []; this.strAcc = 0;
    if (bill) safe('jobs, war and gold', () => { this.bill = bill; this.setupBill(); });
    this.forceUpdate();
    this.data = data;
    if (data && land110 && land50 && coast) safe('globe and strait', () => {
      // 110m for the whole globe (cheap to clip each frame); 50m only for the region the camera pushes into
      this.land = topojson.feature(land110, land110.objects.land);
      this.landRegion = this.clipLand(topojson.feature(land50, land50.objects.land), REGION);
      // the repo's coast.json (unprojected to lon/lat) supplies the real gate and Traffic Separation Scheme lane
      this.landRegion = this.orient(this.landRegion);
      this.gate = coast.gate; this.tss = coast.lane;
      this.setState({
        asOf: data.as_of,
        rows: Object.values(data.items).map(it => ({
          name: it.name, base: it.baseline.total_per_day.toFixed(1), now: it.recent.mean7_total.toFixed(1),
          pct: Math.round(it.recent.pct_of_baseline) + '%',
        })),
      });
      this.setupSim();
    });
    if (prices) safe('prices', () => {
      if (!this.STATES.some(x => x.code === this.state.state)) this.state.state = 'US';   // an unknown ?state= before the first board
      this.prices = prices; this.buildBoard(false);
    });
    if (prices && bill) safe('what it buys', () => this.setupBuy());
    if (missing.length) this.setState({ loadError: missing });
    // Reduced motion: every block at its end state (P = 1), and once the first
    // frames have placed the particles and ships, nothing drifts or pulses.
    // Read live, so turning the setting on mid-visit takes effect.
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.motionQuery.matches;
    this.onMotion = e => { this.reduced = e.matches; this.settleAt = performance.now() + 1500; };
    this.motionQuery.addEventListener('change', this.onMotion);
    this.settleAt = performance.now() + 2500;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }
  componentWillUnmount() {
    if (this.motionQuery) this.motionQuery.removeEventListener('change', this.onMotion);
    cancelAnimationFrame(this.raf); }

  /* ---------- data → time ---------- */
  setupSim() {
    const D = this.data;
    this.day0 = Date.UTC(2026, 0, 1);
    this.dayOf = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - this.day0) / 86400000);
    this.STRIKE = this.dayOf('2026-02-28');
    // The last counted day, not a typed date: a fixed 30 Aug left the globe
    // reading an older 7-day mean than the card beside it after every refresh.
    this.LAST = this.dayOf(D.hormuz_daily.at(-1)[0]);
    this.events = [
      { d: this.dayOf('2026-02-28'), red: true, t: 'HE ORDERED THE STRIKE. THE STRAIT CLOSES.' },
      { d: this.dayOf('2026-04-07'), red: false, t: 'TWO-WEEK CEASEFIRE. THE STRAIT OPENS A LITTLE.' },
      { d: this.dayOf('2026-06-18'), red: false, t: '60-DAY CEASEFIRE. TRANSITS TRIPLE.' },
      { d: this.dayOf('2026-07-08'), red: true, t: 'STRIKES RESUME. THE CEASEFIRE IS OVER.' },
      { d: this.dayOf('2026-08-18'), red: true, t: 'HE SAYS THE STRAIT IS "OPEN AND OPERATING".' },
    ];
    // Routes: [lon,lat] waypoints; choke index marks the strait itself.
    const R = {
      // Gulf leg follows the real Traffic Separation Scheme through the strait (repo coast.json lane)
      hormuz:        { pts: [[49.6,28.2],[50.8,27.3],[52.4,26.6],[53.8,26.3],[54.85,26.2],[55.2,26.25],[55.6,26.3],[55.95,26.38],[56.2,26.5],[56.38,26.58],[56.5,26.6],[56.62,26.55],[56.75,26.42],[56.88,26.25],[57.0,26.05],[57.15,25.8],[57.35,25.55],[57.9,25.0],[58.8,24.2],[60.5,22.8],[63,19.5],[67,14],[71,9.5],[75,7]], choke: 10 },
      bab_el_mandeb: { pts: [[66,9.5],[60,11.5],[54,13],[49,12.4],[45.2,12.4],[43.35,12.6],[42.3,14.5],[40.2,18.5],[38.2,22.5]], choke: 5 },
      suez:          { pts: [[36.6,25.5],[34.6,27.8],[32.6,29.9],[32.3,31.5],[29.5,32.7],[24,34.5],[16,36.5],[8,37.8],[2,37.2],[-4,36]], choke: 2 },
      good_hope:     { pts: [[74,6],[62,2],[54,-10],[44,-24],[32,-33.5],[19.5,-35.5],[13,-30],[9,-20],[4,-8],[-4,4],[-12,14],[-17,24],[-14,34]], choke: 5 },
      malacca:       { pts: [[75,7],[84,5.5],[94,5.5],[99,3.6],[101.5,2.4],[103.9,1.2],[106,3.5],[110,8],[114,14],[118,20],[121,26]], choke: 4 },
      panama:        { pts: [[-62,18],[-70,15.5],[-76,11],[-79.6,9],[-80.5,7.5],[-85,4],[-92,2],[-100,-2]], choke: 3 },
    };
    this.routes = {};
    for (const k in R) {
      const it = D.items[k];
      const pts = R[k].pts, N = 220, path = [];
      const segLen = pts.slice(1).map((p, i) => d3.geoDistance(pts[i], p));
      const total = segLen.reduce((a, b) => a + b, 0);
      let acc = 0, seg = 0;
      for (let i = 0; i < N; i++) {
        let s = (i / (N - 1)) * total;
        while (seg < segLen.length - 1 && s > acc + segLen[seg]) { acc += segLen[seg]; seg++; }
        const f = Math.max(0, Math.min(1, (s - acc) / segLen[seg]));
        path.push(d3.geoInterpolate(pts[seg], pts[seg + 1])(f));
      }
      const obs = it.observations.map(([d, v]) => [this.dayOf(d), v]);
      // where along the path the strait sits (0..1), for the slow-down on approach
      let cs = 0; for (let i = 0; i < R[k].choke; i++) cs += segLen[i]; cs /= total;
      this.routes[k] = { key: k, name: it.name.replace(' Strait', '').replace('Strait of ', '').replace(' Canal', '').toUpperCase(), path, choke: pts[R[k].choke], chokeS: cs, base: it.baseline.total_per_day, obs, parts: [], acc: 0, total };
    }
    // Hormuz daily series is complete; use it instead of the May-onward slice.
    this.routes.hormuz.obs = D.hormuz_daily.map(([d, v]) => [this.dayOf(d), v]);
    this.day = this.STRIKE - 1;
  }
  /* Sutherland–Hodgman clip of every ring to a lon/lat box. Planar is fine here: no antimeridian. */
  clipLand(fc, [x0, y0, x1, y1]) {
    const clipEdge = (pts, inside, cross) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
        const ia = inside(a), ib = inside(b);
        if (ib) { if (!ia) out.push(cross(a, b)); out.push(b); } else if (ia) out.push(cross(a, b));
      }
      return out;
    };
    const X = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
    const Y = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
    const clipRing = ring => {
      let r = ring;
      r = clipEdge(r, p => p[0] >= x0, (a, b) => X(a, b, x0)); if (!r.length) return null;
      r = clipEdge(r, p => p[0] <= x1, (a, b) => X(a, b, x1)); if (!r.length) return null;
      r = clipEdge(r, p => p[1] >= y0, (a, b) => Y(a, b, y0)); if (!r.length) return null;
      r = clipEdge(r, p => p[1] <= y1, (a, b) => Y(a, b, y1)); if (r.length < 3) return null;
      r.push(r[0]); return r;
    };
    const polys = [];
    const geoms = fc.type === 'FeatureCollection' ? fc.features.map(f => f.geometry) : [fc.geometry || fc];
    for (const g of geoms) {
      const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of list) {
        const rings = poly.map(clipRing).filter(Boolean);
        if (rings.length) polys.push(rings);
      }
    }
    return { type: 'MultiPolygon', coordinates: polys };
  }
  /* d3 fills the sphere to the RIGHT of a ring: outer rings must be counter-clockwise (area < 2π), holes clockwise. */
  orient(mp) {
    mp.coordinates = mp.coordinates.map(poly => poly.map((ring, i) => {
      const a = d3.geoArea({ type: 'Polygon', coordinates: [ring] });
      const wantSmall = i === 0;
      return (a > 2 * Math.PI) === wantSmall ? ring.slice().reverse() : ring;
    }));
    return mp;
  }
  mean7(r, day) {
    const last = Math.min(day, this.LAST);
    const win = r.obs.filter(o => o[0] <= last && o[0] > last - 7);
    return win.length ? win.reduce((s, o) => s + o[1], 0) / win.length : null;
  }
  flowAt(r, day) {
    if (day < this.STRIKE) return r.base;
    const m = this.mean7(r, day);
    if (m !== null) return m;
    // gap: pre-war mean → first observed week, drawn straight
    const first = r.obs[0][0] + 6, fm = this.mean7(r, first);
    return r.base + (fm - r.base) * Math.min(1, (day - this.STRIKE) / (first - this.STRIKE));
  }
  fmtDay(day) { return this.fmtISO(new Date(this.day0 + Math.round(day) * 86400000).toISOString().slice(0, 10)); }

  /* ---------- scroll → progress ---------- */
  progress() {
    const el = this.canvasRef.current && this.canvasRef.current.parentElement.parentElement;
    if (!el) return 0;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    return Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - vh)));
  }

  loop(t) {
    this.raf = requestAnimationFrame(this.loop);
    const cv = this.canvasRef.current;
    const dt = Math.max(0, Math.min(0.05, (t - (this.lastT || t)) / 1000)); this.lastT = t;
    // Under reduced motion only what drifts is frozen (globe particles, strait ships),
    // once the first frames have placed them. Everything else keeps the real clock:
    // the split-flap board settles on elapsed time and froze on January's prices.
    const drift = this.reduced && t > this.settleAt ? 0 : dt;
    const vh = innerHeight;
    // cueAt: the progress at which the SCROLL affordance appears. It is 1 for
    // every block that plays once. Block 07 loops, so its P never settles at 1
    // and the reader would be held for a full 30.3s cycle before the page
    // admitted they could move on -- see the call below.
    const run = (sec, key, dur, fn, loop, cueAt = 1) => {
      if (!sec) return; const r = sec.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
      const P = this.reduced ? 1 : this.playProgress(sec, key, dur, t, loop);
      fn(P);
      if (sec.__cue === undefined) sec.__cue = sec.querySelector('[data-cue]');
      if (sec.__cue) sec.__cue.style.opacity = P >= cueAt ? '1' : '0';
    };
    const secOf = ref => ref.current && ref.current.closest('section');
    run(this.stampStageRef.current && this.stampStageRef.current.parentElement, 'stamps', 3.5, P => this.stepStamps(P));
    run(secOf(this.seisRef), 'seis', 8, P => this.stepSeis(dt, P, t));
    run(secOf(this.straitRef), 'strait', 9, P => this.stepStrait(drift, P, t));
    run(secOf(this.boardRef), 'prices', 6, P => this.stepPrices(dt, P));
    run(secOf(this.crowdRef), 'crowd', 9, P => this.stepCrowd(dt, P, t));
    run(secOf(this.warRef), 'war', 9, P => this.stepWar(dt, P, t));
    // Five 4.7s beats then the finale, played once: it ends on the whole war, and a
    // looping pile left readers on whichever beat they happened to stop at. Two beats
    // -- the F-35A and the first comparison -- is where the argument has landed and
    // matches the 9s the neighbouring blocks take, so the SCROLL cue shows from there.
    run(secOf(this.buyRef), 'buy', this.buyDur || 30, P => this.stepBuy(dt, P, t), false,
        9.4 / (this.buyDur || 30));
    run(secOf(this.vaultRef), 'vault', 8, P => this.stepVault(dt, P, t));
    run(secOf(this.cardRef), 'card', 3, P => this.stepCard(P));
    // block 0
    if (!cv || !this.land || !this.routes) return;
    const p = this.reduced ? 1 : this.progress();
    const sec = cv.parentElement.parentElement.getBoundingClientRect();
    if (sec.bottom < -200 || sec.top > innerHeight + 200) return;
    this.smooth = this.smooth === undefined ? p : this.smooth + (p - this.smooth) * Math.min(1, dt * 8);
    const P = this.smooth;
    // timeline: 0–.08 hold before the war · .08–.5 28 Feb → 30 Aug (fast) · .5–1 the camera pushes in on the shut strait
    const tl = Math.max(0, Math.min(1, (P - 0.04) / 0.26));
    const day = this.STRIKE - 1 + tl * (this.LAST - this.STRIKE + 1);
    this.day = day;
    this.stepParts(drift, day);
    this.paint(cv, P, day, t);
    this.readout(P, day);
  }

  stepParts(dt, day) {
    for (const k in this.routes) {
      const r = this.routes[k];
      const flow = this.flowAt(r, day);
      r.flow = flow;
      const dur = 5.5 + r.total * 3;          // seconds to traverse; longer routes take longer
      const rate = flow * 0.22;                // particles per second ∝ ships per day
      r.acc += rate * dt;
      while (r.acc >= 1 && r.parts.length < 420) { r.acc -= 1; r.parts.push({ s: Math.random() * 0.004, v: (0.85 + Math.random() * 0.35) / dur, w: 0.5 + Math.random() * 0.9, o: (Math.random() * 2 - 1) * (Math.random() < 0.5 ? 1 : 0.4) }); }
      if (r.acc > 3) r.acc = 3;
      /* Ships slow as the count falls: at 5% of pre-war they crawl at a third
         of pre-war speed, and slowest on the approach to the strait itself. */
      const frac = Math.min(1, flow / r.base);
      const slow = 0.3 + 0.7 * Math.pow(frac, 0.6);
      for (const q of r.parts) {
        const near = Math.exp(-Math.pow((q.s - r.chokeS) / 0.09, 2)); // 1 at the strait, 0 far away
        const mult = slow * (1 - near * (1 - frac) * 0.6);
        q.s += q.v * dt * mult;
      }
      r.parts = r.parts.filter(q => q.s < 1);
    }
  }

  paint(cv, P, day, t) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B1E3F'; ctx.fillRect(0, 0, W, H);

    // camera: Indian Ocean wide → push in on Hormuz
    const zoom = Math.max(0, Math.min(1, (P - 0.3) / 0.4));   // fully on the strait by 70% — before the block scrolls off
    const ez = zoom * zoom * (3 - 2 * zoom);
    const drift = P * 14;
    const ezc = Math.sqrt(ez);  // the camera arrives over the strait before the zoom finishes
    const lon = (56 + drift) * (1 - ezc) + 56.25 * ezc, lat = (2 + 5 * P) * (1 - ezc) + 26.25 * ezc;
    const mobile = W < 640;
    const baseR = mobile ? Math.min(W, H) * 0.6 : Math.min(W * 0.36, H * 0.44);
    // the push-in ends with the 33 km gate roughly a fifth of the frame tall
    const endR = (mobile ? W * 0.9 : H * 0.62) / (2.3 * Math.PI / 180);
    const R = baseR + (endR - baseR) * ez;
    const cx = mobile ? W * 0.5 : W * 0.6, cy = mobile ? H * 0.38 : H * 0.42;
    const proj = d3.geoOrthographic().translate([cx, cy]).scale(R).rotate([-lon, -lat]).clipAngle(90).clipExtent([[-40, -40], [W + 40, H + 40]]);
    const center = [lon, lat];
    const visible = pt => d3.geoDistance(pt, center) < 1.52;

    // static layer (sphere, graticule, land) cached until the camera moves
    const key = [lon.toFixed(3), lat.toFixed(3), R.toFixed(1), W, H, ez.toFixed(3)].join('|');
    if (!this.bg || this.bgKey !== key) {
      if (!this.bg || this.bg.width !== cv.width || this.bg.height !== cv.height) { this.bg = document.createElement('canvas'); this.bg.width = cv.width; this.bg.height = cv.height; }
      const b = this.bg.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0); b.clearRect(0, 0, W, H);
      const bpath = d3.geoPath(proj, b);
      const og = b.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      og.addColorStop(0, '#173261'); og.addColorStop(0.75, '#0F2550'); og.addColorStop(1, '#0A1B3A');
      b.beginPath(); b.arc(cx, cy, R, 0, 6.2832); b.fillStyle = og; b.fill();
      const safe = fn => { try { fn(); } catch (e) { /* d3 clip edge case at extreme zoom: skip this layer for the frame */ } };
      if (ez < 0.5) safe(() => { b.beginPath(); bpath(d3.geoGraticule().step([15, 15])()); b.strokeStyle = 'rgba(247,245,240,.06)'; b.lineWidth = 0.6; b.stroke(); });
      const lgr = b.createLinearGradient(cx - R, cy - R, cx + R * 0.6, cy + R);
      lgr.addColorStop(0, '#4E5F86'); lgr.addColorStop(1, '#2F4573');  // opaque, so detail layers can overlap without seams
      b.fillStyle = lgr; b.strokeStyle = 'rgba(247,245,240,.45)'; b.lineWidth = 0.7 + ez * 0.8;
      if (ez < 0.6) safe(() => { b.beginPath(); bpath(this.land); b.fill(); b.stroke(); });
      // detail layers are clipped to a box; stroke coastlines only, never the box edge
      const onEdge = (p, q, [x0, y0, x1, y1], e) => (p[0] < x0 + e && q[0] < x0 + e) || (p[0] > x1 - e && q[0] > x1 - e) || (p[1] < y0 + e && q[1] < y0 + e) || (p[1] > y1 - e && q[1] > y1 - e);
      const strokeCoast = (mp, box) => {
        b.beginPath();
        for (const poly of mp.coordinates) for (const ring of poly) {
          let pen = false;
          for (let i = 1; i < ring.length; i++) {
            const p = ring[i - 1], q = ring[i];
            if (onEdge(p, q, box, 0.06) || !visible(p) || !visible(q)) { pen = false; continue; }
            const a = proj(p), c2 = proj(q); if (!a || !c2) { pen = false; continue; }
            if (!pen) b.moveTo(a[0], a[1]); b.lineTo(c2[0], c2[1]); pen = true;
          }
        }
        b.stroke();
      };
      if (ez > 0.05) {
        // 50m detail for the region the camera is entering, over the 110m globe
        b.globalAlpha = Math.min(1, (ez - 0.05) / 0.2);
        safe(() => { b.fillStyle = lgr; b.beginPath(); bpath(this.landRegion); b.fill(); });
        b.lineWidth = 0.7 + ez * 0.6; strokeCoast(this.landRegion, REGION);
        b.globalAlpha = 1;
      }

      b.beginPath(); b.arc(cx, cy, R, 0, 6.2832); b.strokeStyle = 'rgba(108,140,213,.5)'; b.lineWidth = 1.2; b.stroke();
      const lg = b.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.08);
      lg.addColorStop(0, 'rgba(108,140,213,.28)'); lg.addColorStop(1, 'rgba(108,140,213,0)');
      b.beginPath(); b.arc(cx, cy, R * 1.08, 0, 6.2832); b.fillStyle = lg; b.fill();
      this.bgKey = key;
    }
    ctx.drawImage(this.bg, 0, 0, W, H);

    // routes: faint guide + gold particles
    const labels = [];
    const sc = 1 + ez * 2.2, band = (mobile ? 2.2 : 3) * sc;
    for (const k in this.routes) {
      const r = this.routes[k];
      const frac = Math.min(1.15, r.flow / r.base);
      const fade = r.key === 'hormuz' ? 1 : 1 - ez;    // the push-in keeps only Hormuz
      if (fade <= 0.02) continue;
      ctx.globalAlpha = fade;
      // lane: faint band whose brightness follows the count
      ctx.beginPath(); let pen = false;
      for (const pt of r.path) { if (!visible(pt)) { pen = false; continue; } const [x, y] = proj(pt); pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
      ctx.strokeStyle = 'rgba(212,160,23,' + (0.04 + 0.12 * frac + 0.14 * ez).toFixed(3) + ')'; ctx.lineWidth = band * 2.4; ctx.lineCap = 'round'; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      const n = r.path.length - 1;
      for (const q of r.parts) {
        const i = Math.max(0, Math.min(n, Math.floor(q.s * n))), pt = r.path[i];
        if (!pt || !visible(pt)) continue;
        const nx = r.path[Math.min(n, i + 1)], pv = r.path[Math.max(0, i - 1)];
        const [x0, y0] = proj(pt), [x1, y1] = proj(visible(nx) ? nx : pt), [xp, yp] = proj(visible(pv) ? pv : pt);
        let dx = x1 - xp, dy = y1 - yp; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const ox = -dy * q.o * band, oy = dx * q.o * band;
        const x = x0 + ox, y = y0 + oy;
        ctx.globalAlpha = fade * Math.min(1, Math.min(q.s, 1 - q.s) / 0.07);
        const tl = (7 + q.w * 6) * sc;
        ctx.beginPath(); ctx.moveTo(x - dx * tl, y - dy * tl); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(212,160,23,.10)'; ctx.lineWidth = q.w * 1.5 * sc; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - dx * tl * 0.4, y - dy * tl * 0.4); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(212,160,23,.28)'; ctx.lineWidth = q.w * 1.1 * sc; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, (0.6 + q.w * 0.55) * sc, 0, 6.2832); ctx.fillStyle = 'rgba(242,201,76,.75)'; ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (visible(r.choke) && fade > 0.3) {
        const [x, y] = proj(r.choke);
        const closed = r.key === 'hormuz' && frac < 0.12 && day >= this.STRIKE;
        const pulse = this.reduced ? 1 : 0.5 + 0.5 * Math.sin(t / 420);
        if (closed) {
          // the gate: a red bar across the 33 km between Musandam and Larak
          const [gx1, gy1] = proj(this.gate.top), [gx2, gy2] = proj(this.gate.bot);
          const gl = Math.hypot(gx2 - gx1, gy2 - gy1);
          if (gl < 14) {
            ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.2832); ctx.fillStyle = MARK_RED; ctx.fill();
          } else {
            ctx.beginPath(); ctx.moveTo(gx1, gy1); ctx.lineTo(gx2, gy2);
            ctx.strokeStyle = 'rgba(178,34,52,' + (0.35 + 0.35 * pulse).toFixed(2) + ')'; ctx.lineWidth = 10 + ez * 10; ctx.lineCap = 'butt'; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx1, gy1); ctx.lineTo(gx2, gy2);
            ctx.strokeStyle = MARK_RED; ctx.lineWidth = 2.5 + ez * 2; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx1 - 6, gy1); ctx.lineTo(gx1 + 6, gy1); ctx.moveTo(gx2 - 6, gy2); ctx.lineTo(gx2 + 6, gy2); ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(x, y, 10 + pulse * 12 + ez * 20, 0, 6.2832); ctx.strokeStyle = 'rgba(178,34,52,' + (0.7 * (1 - pulse)).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(x, y, 4 + ez * 6, 0, 6.2832); ctx.strokeStyle = 'rgba(247,245,240,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
        labels.push({ x, y, r, closed });
      }
    }
    // strike flash on Hormuz
    const since = day - this.STRIKE;
    if (since >= 0 && since < 10 && visible(this.routes.hormuz.choke)) {
      const [x, y] = proj(this.routes.hormuz.choke); const a = 1 - since / 10;
      const fg = ctx.createRadialGradient(x, y, 0, x, y, 40 + since * 12);
      fg.addColorStop(0, 'rgba(178,34,52,' + (0.55 * a).toFixed(2) + ')'); fg.addColorStop(1, 'rgba(178,34,52,0)');
      ctx.beginPath(); ctx.arc(x, y, 40 + since * 12, 0, 6.2832); ctx.fillStyle = fg; ctx.fill();
    }
    // labels: name + current ships/day, gold digits
    if (!mobile || ez > 0.5) {
      ctx.textAlign = 'left';
      for (const { x, y, r, closed } of labels) {
        if (ez > 0.4 && r.key !== 'hormuz') continue;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        const off = r.key === 'suez' || r.key === 'bab_el_mandeb' ? -1 : 1;
        const gap = 12 + ez * 60;
        const nameT = closed ? r.name + ' · ' + Math.round(100 * r.flow / r.base) + '% OF PRE-WAR' : r.name, numT = Math.round(day < this.STRIKE ? r.base : r.flow) + ' / DAY', numF = 24 + ez * 10;
        const nameF = (closed ? '700 14px' : '500 13px') + ' "IBM Plex Mono", monospace', numFont = '700 ' + numF + 'px "Barlow Condensed", sans-serif';
        ctx.font = nameF; const w1 = ctx.measureText(nameT).width; ctx.font = numFont; const lw = Math.max(w1, ctx.measureText(numT).width);
        const lx = Math.max(8, Math.min(W - lw - 12, x + gap * off - (off < 0 ? 96 : 0))), ly = Math.max(90, Math.min(H * 0.58, y - 6 - ez * 40));
        const lyy = mobile && ez > 0.5 && r.key === 'hormuz' ? y + 40 : ly;
        if (ez > 0.3 && r.key === 'hormuz') { ctx.fillStyle = 'rgba(11,30,63,.8)'; ctx.fillRect(lx - 6, lyy - 16, lw + 12, numF * 0.78 + 30); }
        ctx.font = nameF; ctx.fillStyle = closed ? '#E04B5C' : 'rgba(247,245,240,.7)';
        ctx.fillText(nameT, lx, lyy);
        ctx.font = numFont; ctx.fillStyle = '#D4A017';
        ctx.fillText(numT, lx, lyy + 8 + numF * 0.78);
      }
      if (ez > 0.6 && visible(this.gate.top)) {
        ctx.globalAlpha = (ez - 0.6) / 0.4;
        ctx.font = '500 13px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(247,245,240,.6)';
        const [gx, gy] = proj(this.gate.top); ctx.textAlign = 'center'; ctx.fillText('33 KM', gx, gy - 8); ctx.textAlign = 'left';
        const [mx, my] = proj([56.2, 25.95]); ctx.fillText('MUSANDAM · OMAN', mx - 40, my);
        if (!mobile) {
          const [ix, iy] = proj([56.1, 27.05]); ctx.fillText('IRAN', ix, iy);
          const [qx, qy] = proj([55.9, 26.8]); ctx.fillText('QESHM', qx, qy);
        }
        ctx.globalAlpha = 1;
      }
    }
    // scrims so the readouts stay legible over the globe
    const sg = ctx.createLinearGradient(0, H * 0.45, 0, H);
    sg.addColorStop(0, 'rgba(11,30,63,0)'); sg.addColorStop(1, 'rgba(11,30,63,.88)');
    ctx.fillStyle = sg; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    tg.addColorStop(0, 'rgba(11,30,63,' + (0.7 + 0.25 * ez).toFixed(2) + ')'); tg.addColorStop(0.5, 'rgba(11,30,63,' + (0.35 + 0.4 * ez).toFixed(2) + ')'); tg.addColorStop(1, 'rgba(11,30,63,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.3);
  }

  readout(P, day) {
    const h = this.routes.hormuz, m = this.flowAt(h, day);
    const set = (ref, v) => { const el = ref.current; if (el && el.textContent !== v) el.textContent = v; };
    const pre = day < this.STRIKE;
    set(this.numRef, pre ? String(Math.round(h.base)) : String(Math.round(m)));
    if (this.numRef.current) this.numRef.current.style.color = pre ? 'rgba(247,245,240,.7)' : '#D4A017';
    set(this.kickRef, pre ? 'THE STRAIT OF HORMUZ BEFORE THE WAR' : 'THE WAR ALL BUT SHUT THE STRAIT OF HORMUZ');
    set(this.wasRef, pre ? 'before the war' : 'was ' + Math.round(h.base) + ' before the war');
    set(this.dateRef, day < this.STRIKE ? (innerWidth < 640 ? 'BEFORE THE WAR · 2025 TO FEB 2026' : 'BEFORE THE WAR · 1 JAN 2025 – 27 FEB 2026') : (day >= this.LAST - 0.5 ? 'SHIPS COUNTED TO ' : '') + this.fmtDay(Math.round(day)));
    let ev = null; for (const e of this.events) if (day >= e.d && day < e.d + 22) ev = e;
    const er = this.eventRef.current;
    if (er) { const txt = ev ? ev.t : ''; if (er.textContent !== txt) { er.textContent = txt; er.style.color = ev && ev.red ? MARK_RED : '#6C8CD5'; } }
    if (this.cueRef.current) this.cueRef.current.style.opacity = P > 0.03 ? '0' : '1';
    const lg = this.legendRef.current;
    if (lg && (this.lastLegend === undefined || Math.abs(this.lastLegend - day) > 2)) {
      this.lastLegend = day;
      lg.innerHTML = '<div style="color:rgba(247,245,240,.5);font-size:11px;letter-spacing:.14em">SHIPS A DAY · <span style="color:#D4A017">NOW</span> / BEFORE THE WAR</div>' + Object.values(this.routes).filter(r => r.key !== 'hormuz').map(r =>
        '<div><span style="color:rgba(247,245,240,.55)">' + r.name + '</span> &nbsp;<span style="color:#D4A017;font-weight:500">' + Math.round(r.flow) + '</span> <span style="color:rgba(247,245,240,.45)">/ ' + Math.round(r.base) + '</span></div>').join('');
    }
  }

  render() {
    const V = this.renderVals();
    const { africaNote, africaSentence, againstRows, aheYoy, aircraftList, aircraftN, asOf, babPct, boardRef, buyDateRef, buyDays, buyDiesel, buyDogs, buyDogsTotal, buyGallons, buyHH, buyJet, buyKickRef, buyNumRef, buyPS5, buyRatio, buyRef, buySubRef, buyTuition, canvasRef, cardDate, cardItems, cardRef, casAlt, casDate, casHead, casN, cboNote, claimsNote, cpiYoy, crowdDateRef, crowdNumRef, crowdRef, crudeCount, crudeLast, crudeLastText, cueRef, cumulativeText, dateRef, dieselFrom, dieselHead, dieselHeadPolicy, dieselNote, dieselThrough, dieselVerdict, digits, elecThrough, eventRef, freshNote, gasThrough, globeThrough, hires, hormuzMean, hormuzNow, jobsBaseLabel, jobsCurr, jobsKicker, jobsLatest, jobsMed, jobsN, jobsNeg, jobsPrev, jobsPrevMed, jobsSentence, jobsTermMean, jobsWas, kickRef, layoffs, legendRef, loadError, lossBn, ltu0, ltu1, ltuWhen, numRef, odo, oilKicker, oilSentence, onState, pDateRef, pWeekRef, patriotPct, payMonth, placeName, pricesDown, pricesMonth, quits, quoteNote, realYoy, receiptElectricity, receiptFuel, receiptGroceries, receiptMethod, receiptMonths, rows, seisDateRef, seisNumRef, seisRef, seisSubRef, stamp1Ref, stamp2Ref, stampNoteRef, stampSentenceRef, stampStageRef, state, stateOptions, strAug18, strBase, strDateRef, strEventRef, strNowWord, strNumRef, strSentence, strSubRef, strTanker, straitRange, straitRef, suppText, tariffNote, tariffSentence, totalCells, treasSentence, unemp0, unemp1, unempDir, updatedCaps, vaultBars, vaultDateRef, vaultEnd, vaultFrom, vaultMonths, vaultNumRef, vaultOut, vaultRef, vaultRows, vaultScaleNote, vaultSentence, vaultStart, vaultSub, vaultTo, warAsOf, warCite, warHead, warMonthsCaps, warNote, warRef, warSpent, warWho, wasRef, workPrices, workRows } = V;
    return (
      <div className="v5-bill-root" role="main" style={{fontFamily: "'Source Serif 4',Georgia,serif", background: "#0B1E3F", color: "#F7F5F0", overflow: "clip"}}>
  <h1 className="v5-sr">The Bill: what Trump’s war and tariffs cost you</h1>
  {(loadError) ? (<><div role="alert" style={{position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: "50", background: "#F7F5F0", color: "#0B1E3F", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".04em", lineHeight: "1.5", padding: "10px 16px", border: "1px solid #0B1E3F", maxWidth: "calc(100% - 32px)"}}>Part of this page's data did not load ({loadError}). The blocks that need it are blank. Reload to try again.</div></>) : null}

  <section data-screen-label="00 The globe" style={{position: "relative", height: "160vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">The globe</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <canvas ref={canvasRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`A globe showing shipping through six straits. Gold particles move along each route at a rate set by the ships counted per day. Traffic through the Strait of Hormuz falls from 83 a day before the war to ${hormuzMean}, while the other five straits run at ${straitRange} of their pre-war counts.`}></canvas>

      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
          <div className="g-mast" style={{display: "flex", flexDirection: "column", gap: "6px", marginBottom: "clamp(8px,2vh,18px)", maxWidth: "500px"}}>
            <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(30px,5vh,48px)", lineHeight: ".95", letterSpacing: ".02em", textTransform: "uppercase", color: "#F7F5F0"}}>The Bill</div>
            <div className="g-dek" style={{fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(16px,2.3vh,20px)", lineHeight: "1.35", color: "#F7F5F0", textWrap: "pretty", textShadow: "0 1px 6px rgba(11,30,63,.9)"}}>What Trump’s war with Iran and his tariffs have cost Americans, in the government’s own numbers.</div>
            <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "rgba(247,245,240,.6)", lineHeight: "1.6"}}>EVERY FIGURE SOURCED · WHAT CUTS AGAINST IT IS AT THE END</div>
          </div>
          <div ref={dateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}></div>
          <div ref={eventRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", fontWeight: "500", letterSpacing: ".06em", maxWidth: "460px", lineHeight: "1.5", textWrap: "pretty", textShadow: "0 1px 6px rgba(11,30,63,.9)"}}></div>
        </div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>SHIPS A DAY THROUGH SIX STRAITS<br />COUNTED FROM SATELLITE · IMF PORTWATCH<br />{updatedCaps}</div>
      </div>

      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "32px", pointerEvents: "none"}}>
        <div style={{display: "flex", flexDirection: "column", gap: "2px", minWidth: "0"}}>
          <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span><span ref={kickRef}>THE WAR SHUT THE STRAIT OF HORMUZ</span></div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
            <div className="g-num" ref={numRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,240px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>83</div>
            <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>ships a day<br />through Hormuz<br /><span ref={wasRef} style={{color: "rgba(247,245,240,.6)"}}>was 83 before the war</span></div>
          </div>
          <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "640px", textWrap: "pretty", color: "#F7F5F0"}}>Before the war, eighty-three ships a day came through the Strait of Hormuz. {hormuzNow} {africaSentence}</p>
        </div>
        <div className="g-side" ref={legendRef} style={{display: "flex", flexDirection: "column", gap: "7px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".08em", color: "rgba(247,245,240,.8)", textAlign: "right", flex: "none"}}></div>
      </div>

      <div ref={cueRef} style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", transition: "opacity .4s"}}>SCROLL · SHOW THE WORK BELOW</div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · THE GLOBE<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>Every moving dot on the globe is a share of a daily ship count. The IMF's PortWatch project estimates transit calls at each strait from satellite AIS positions. Ships transmitting no position are not counted, so each figure is a floor on traffic, not a census, and it is not a queue count. Recent days are revised as late AIS data arrives.</p>
        <div style={{display: "grid", gridTemplateColumns: "minmax(0,1.6fr) repeat(3,minmax(0,1fr))", gap: "8px 16px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".02em"}}>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)"}}>STRAIT</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>BEFORE THE WAR</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>LAST 7 DAYS</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>OF BEFORE</div>
          {(workRows || []).map((r, _i5) => (<React.Fragment key={_i5}>
            <div style={{display: "contents"}}>
              <div>{r.name}</div>
              <div style={{textAlign: "right"}}>{r.base}</div>
              <div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{r.now}</div>
              <div style={{textAlign: "right"}}>{r.pct}</div>
            </div>
          </React.Fragment>))}
        </div>
        <p style={{margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(11,30,63,.8)", textWrap: "pretty"}}>"Before the war" is the mean of daily counts from 1 January 2025 to 27 February 2026 (423 days). "Last 7 days" is the trailing mean ending {globeThrough}. Before the strike every strait is held at its pre-war mean. From 28 February, Hormuz follows its daily series day by day. For the other five straits the snapshot carries daily counts from 3 May 2026; between the strike and that date the globe draws a straight line from the pre-war mean to the first observed week, and says so here. The routes the dots follow are drawn schematically through each strait; ship positions are a model, the counts are not. {africaNote} Bab el-Mandeb, the Red Sea route, sits at {babPct}.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Source: IMF PortWatch (IMF / University of Oxford), AIS-based estimates, as of {asOf} · <a href="https://portwatch.imf.org/" target="_blank" rel="noopener" style={{color: "#0B1E3F"}}>portwatch.imf.org</a><br />Coastlines: Natural Earth via world-atlas, 1:110m for the globe and 1:50m for the Gulf region. The lane through the strait is the real Traffic Separation Scheme; the 33 km gate runs between Musandam and Larak.
        </p>
      </div>
    </details>
  </section>

  <section data-screen-label="01 Two dates" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Two dates</h2>
    <div ref={stampStageRef} style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#6E1B27", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(24px,6vh,56px)", padding: "24px"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL</div>
      <div ref={stamp1Ref} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "clamp(12px,2.6vh,24px) clamp(20px,5vw,56px)", border: "4px double #F7F5F0", borderRadius: "6px", color: "#F7F5F0", transform: "rotate(-4deg) scale(1.8)", opacity: "0", willChange: "transform,opacity", maxWidth: "94vw", textAlign: "center"}}>
        <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(11px,1.6vh,14px)", letterSpacing: ".3em"}}>IMPOSED</div>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(44px,min(13vh,17vw),150px)", lineHeight: ".9", letterSpacing: "-.01em", whiteSpace: "nowrap"}}>24 FEB 2026</div>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3vh,30px)", lineHeight: "1.1", textTransform: "uppercase", letterSpacing: ".04em", textWrap: "balance"}}>Trump re-imposed the tariffs</div>
      </div>
      <div ref={stamp2Ref} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "clamp(12px,2.6vh,24px) clamp(20px,5vw,56px)", border: "4px double #F7F5F0", borderRadius: "6px", color: "#F7F5F0", transform: "rotate(3deg) scale(1.8)", opacity: "0", willChange: "transform,opacity", maxWidth: "94vw", textAlign: "center"}}>
        <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(11px,1.6vh,14px)", letterSpacing: ".3em"}}>ORDERED</div>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(44px,min(13vh,17vw),150px)", lineHeight: ".9", letterSpacing: "-.01em", whiteSpace: "nowrap"}}>28 FEB 2026</div>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3vh,30px)", lineHeight: "1.1", textTransform: "uppercase", letterSpacing: ".04em", textWrap: "balance"}}>Trump ordered the strike on Iran</div>
      </div>
      <div ref={stampNoteRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(11px,1.5vh,13px)", letterSpacing: ".14em", lineHeight: "1.6", color: "rgba(247,245,240,.75)", opacity: "0", textAlign: "center", transition: "opacity .4s", maxWidth: "760px"}}>THE TARIFFS: STRUCK DOWN BY THE SUPREME COURT, 6–3, ON 20 FEB · IMPOSED AGAIN FOUR DAYS LATER</div>
      <p ref={stampSentenceRef} className="g-sentence" style={{margin: "0", fontSize: "24px", lineHeight: "1.35", maxWidth: "640px", textWrap: "pretty", color: "#F7F5F0", textAlign: "center", opacity: "0", transition: "opacity .4s"}}>Every red mark on this page traces back to the war and the tariffs. {tariffSentence}</p>
    </div>
  </section>

  <section data-screen-label="02 Oil doubled" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Oil doubled</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={seisRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`A seismograph-style chart of the daily closing price of WTI crude through 2026. The trace runs from $57 a barrel in January to a peak of $115 five weeks after the 28 February strike, falls back under the ceasefires, and climbs again when strikes resume, to its last close of ${crudeLastText}. Red marks are the tariffs and the strikes, blue are ceasefires. It ends on the whole year with a price scale.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div ref={seisDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>2 JAN 2026</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>CRUDE OIL · A BARREL · EVERY DAILY CLOSE<br />WTI CUSHING SPOT · FRED</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span>{oilKicker}</div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
          <div className="g-num" ref={seisNumRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,200px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>$57</div>
          <div ref={seisSubRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>a barrel<br /><span style={{color: "rgba(247,245,240,.6)"}}>in January</span></div>
        </div>
        <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "640px", textWrap: "pretty", color: "#F7F5F0"}}>{oilSentence}</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · TWO DATES AND OIL<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The dates.</strong> On 20 February 2026 the Supreme Court held in <em>Learning Resources v. Trump</em>, 6–3, that the International Emergency Economic Powers Act does not authorise tariffs; collection ended 24 February. The same day, Proclamation 11012 imposed a 10% surcharge under Section 122 on roughly $1 trillion of imports. On 28 February the United States and Israel struck Iran and the Strait of Hormuz closed. On 24 July the Section 122 surcharge expired by statute and Section 301 tariffs became the operative regime; the stamp marks the act, not the expiry.</p>
        {(tariffNote) ? (<><p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The customs duties.</strong> {tariffNote}</p></>) : null}
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The trace.</strong> {crudeCount} daily closes of WTI crude at Cushing, Oklahoma, 2 January to {crudeLast} 2026, from FRED series DCOILWTICO. This is the spot price, not the futures contract: press figures for 8 July quote $73.52 from the futures contract while spot closed $74.56. Both are correct and they are different instruments. The peak close is $114.58 on 7 April, the day the first ceasefire was announced. The last close before the strike was $66.96 on 27 February; the peak came 39 days later. Red ticks mark the tariffs and the strikes, blue ticks the two ceasefires. Weekends and holidays have no close and the needle holds. When the trace reaches the latest close the chart pulls back to show the whole year, with the price scale on the left.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: FRED DCOILWTICO (EIA) · Monthly Treasury Statement, table 9 · US Census Bureau households · Supreme Court, <em>Learning Resources v. Trump</em>, 20 Feb 2026 · Dallas Fed, June 2026, on the tariff ruling.</p>
      </div>
    </details>
  </section>

  <section data-screen-label="03 The strait" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">The strait</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={straitRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`A map of the Strait of Hormuz with the real Traffic Separation Scheme lane and the 33 kilometre gate between Musandam and Larak. The lane is full of ships at the pre-war 83 a day, then nearly empty at the latest seven-day count of ${strNowWord}, with one ship on screen for each ship a day. A side-by-side compares the President's claim of 30 ships a night against the count, drawn to the same scale.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", bottom: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
          <div ref={strDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>1 JAN 2026</div>
          <div ref={strEventRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", fontWeight: "500", letterSpacing: ".06em", maxWidth: "460px", lineHeight: "1.5", textWrap: "pretty", textShadow: "0 1px 6px rgba(11,30,63,.9)"}}></div>
        </div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7", position: "absolute", right: "36px", bottom: "40px"}}>SHIPS COUNTED FROM SATELLITE · IMF PORTWATCH<br />SHIP POSITIONS ARE DRAWN, THE COUNTS ARE MEASURED</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span>HE SAYS IT IS OPEN. THE SATELLITES SAY NO.</div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
          <div className="g-num" ref={strNumRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,240px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>83</div>
          <div ref={strSubRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>ships a day<br /><span style={{color: "rgba(247,245,240,.6)"}}>before the war</span></div>
        </div>
        <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "640px", textWrap: "pretty", color: "#F7F5F0"}}>{strSentence}</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · THE STRAIT<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>The coastline is Natural Earth at 1:10m, clipped to a box around the strait; the box is stretched to the screen, so shapes are real and the aspect is not. The lane is the real Traffic Separation Scheme, outbound one side and inbound the other; the gate is the 33 km between Musandam and Larak. The picture shows two states rather than a day-by-day replay: the pre-war mean (1 January 2025 to 27 February 2026) and the latest trailing seven-day mean, with one ship on the screen for each ship a day. The counts are the IMF PortWatch estimate of transit calls from satellite AIS positions. Ships transmitting no position are not counted, so the figure is a floor, not a census, and it is not a queue count. Ship positions are a model; the counts are not.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>"Thirty a night."</strong> On 18 August 2026 the President said the strait was "open and operating." That day the MV Minoan Dignity was struck and one crew member was killed; Lloyd's List counted about 14 transits, PortWatch {strAug18}. The dashed fleet on the screen is his figure drawn to the same scale as the counted one. The pre-war figure is the mean of 423 days, 1 January 2025 to 27 February 2026: {strBase} a day, of which {strTanker} were tankers. Thirteen merchant ships were struck in August; on 25 August the US Navy said it had cleared the mines and PortWatch counted four vessels that day.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: IMF PortWatch (IMF / University of Oxford) chokepoint6, as of {asOf} · Natural Earth 1:10m coastlines · Lloyd's List for the 18 August transit count.</p>
      </div>
    </details>
  </section>

  <section data-screen-label="04 Your prices" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Your prices</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F", display: "flex", flexDirection: "column"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <div className="g-top" style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px 0", pointerEvents: "none"}}>
        <div ref={pDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>JANUARY 2025</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>WHAT YOU PAY · JANUARY 2025 AGAINST NOW<br />BLS AVERAGE PRICES · EIA WEEKLY DIESEL</div>
      </div>

      <div className="p-grid" style={{flex: "1", minHeight: "0", display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: "0 48px", padding: "18px 36px 0", alignItems: "stretch"}}>
        <div style={{display: "flex", flexDirection: "column", minHeight: "0"}}>
          <div style={{display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", gap: "0 18px", alignItems: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", letterSpacing: ".14em", color: "rgba(247,245,240,.5)", padding: "0 0 6px 8px", borderBottom: "1px solid rgba(247,245,240,.15)", flex: "none"}}>
            <div></div><div style={{textAlign: "right"}}>JAN 2025</div><div style={{textAlign: "right", paddingRight: "6px"}}>NOW</div><div style={{textAlign: "right", minWidth: "64px"}}>CHANGE</div>
          </div>
          <div ref={boardRef} style={{flex: "1", minHeight: "0", display: "grid", gridAutoRows: "minmax(0,1fr)", paddingTop: "4px"}}>
            {(rows || []).map((r, _i6) => (<React.Fragment key={_i6}>
              <div style={{display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", gap: "0 18px", alignItems: "center", padding: "0 0 0 8px", borderBottom: "1px solid rgba(247,245,240,.07)", minHeight: "0"}}>
                <div style={{minWidth: "0", display: "flex", flexDirection: "column", gap: "1px"}}>
                  <div className="p-row" style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(13px,2.4vh,22px)", lineHeight: "1", letterSpacing: ".02em", textTransform: "uppercase", color: "#F7F5F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{r.name}</div>
                  <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(9px,1.35vh,12px)", letterSpacing: ".04em", color: "rgba(247,245,240,.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{r.unit} <span style={{color: "#6C8CD5"}}>{r.note}</span></div>
                </div>
                <div className="p-row" style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(14px,2.6vh,24px)", lineHeight: "1", color: "rgba(247,245,240,.55)", fontVariantNumeric: "tabular-nums", textAlign: "right"}}>{r.start}</div>
                <div className="p-cell" style={{display: "flex", gap: "2px", justifyContent: "flex-end", fontSize: "clamp(15px,3vh,28px)"}}>
                  {(r.cells || []).map((c, _i9) => (<React.Fragment key={_i9}>
                    <div style={{position: "relative", width: c.w, height: "1.22em", background: "#061530", borderRadius: "3px", boxShadow: "inset 0 0 0 1px rgba(247,245,240,.08),0 1px 0 rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"}}>
                      <span style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "1em", lineHeight: "1", color: c.color, fontVariantNumeric: "tabular-nums"}}>{c.ch}</span>
                      <div style={{position: "absolute", left: "0", right: "0", top: "50%", height: "1px", background: "rgba(0,0,0,.45)"}}></div>
                      <div style={{position: "absolute", left: "0", right: "0", top: "0", height: "50%", background: "rgba(247,245,240,.12)", opacity: c.flap}}></div>
                    </div>
                  </React.Fragment>))}
                </div>
                <div className="p-row" style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(14px,2.6vh,24px)", lineHeight: "1", color: r.color, fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "48px", opacity: r.changeOpacity}}>{r.change}</div>
              </div>
            </React.Fragment>))}
          </div>
        </div>

        <div className="p-pump" style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "20px", minHeight: "0"}}>
          <div style={{display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch", maxWidth: "100%"}}>
            <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)"}}>DIESEL · US AVERAGE · A GALLON</div>
            <div style={{display: "flex", alignItems: "center", gap: "8px", background: "#061530", borderRadius: "8px", padding: "14px 18px", boxShadow: "inset 0 0 0 1px rgba(247,245,240,.1),0 20px 60px rgba(0,0,0,.35)", fontSize: "clamp(64px,15vh,150px)"}}>
              <span style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "1em", lineHeight: "1", color: "#D4A017"}}>$</span>
              {(odo || []).map((d, _i7) => (<React.Fragment key={_i7}>
                {(d.dot) ? (<>
                  <span style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "1em", lineHeight: "1", color: "#D4A017"}}>.</span>
                </>) : null}
                {(d.digit) ? (<>
                  <div style={{position: "relative", height: "1em", width: "0.5em", overflow: "hidden", background: "#0B1E3F", borderRadius: "6px", boxShadow: "inset 0 0 0 1px rgba(247,245,240,.1)"}}>
                    <div ref={d.ref} style={{position: "absolute", left: "0", right: "0", top: "0", display: "flex", flexDirection: "column", willChange: "transform"}}>
                      {(digits || []).map((n, _i11) => (<React.Fragment key={_i11}>
                        <div style={{height: "1em", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "1em", lineHeight: "1", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>{n}</div>
                      </React.Fragment>))}
                    </div>
                    <div style={{position: "absolute", inset: "0", background: "linear-gradient(180deg,rgba(6,21,48,.75),rgba(6,21,48,0) 12%,rgba(6,21,48,0) 88%,rgba(6,21,48,.75))"}}></div>
                  </div>
                </>) : null}
              </React.Fragment>))}
            </div>
            <div style={{display: "flex", justifyContent: "space-between", gap: "24px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".1em", color: "rgba(247,245,240,.55)"}}><span>WAS $3.72 WHEN HE TOOK OFFICE</span><span ref={pWeekRef} style={{color: "#F7F5F0"}}>20 JAN 2025</span></div>
          </div>
          <p className="g-sentence p-sentence" style={{margin: "0", fontSize: "24px", lineHeight: "1.35", maxWidth: "520px", textWrap: "pretty", color: "#F7F5F0"}}>Fourteen things you buy, January 2025 against now. Diesel comes first because it hauls nearly everything else on the list. {dieselVerdict} {pricesDown} Eggs fell because the avian flu outbreak ended, not because of policy.</p>
        </div>
      </div>

      <div className="p-cum" style={{display: "none"}}>{cumulativeText} since 20 Jan 2025</div>
      <div className="p-bottom" style={{padding: "14px 36px 44px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "32px", flexWrap: "wrap", flex: "none"}}>
        <div style={{display: "flex", alignItems: "center", gap: "14px", minWidth: "0"}}>
          <div className="p-total" style={{display: "flex", gap: "3px", fontSize: "clamp(40px,9vh,86px)"}}>
            {(totalCells || []).map((c, _i6) => (<React.Fragment key={_i6}>
              <div style={{position: "relative", width: c.w, height: "1.12em", background: "#061530", borderRadius: "5px", boxShadow: "inset 0 0 0 1px rgba(247,245,240,.1),0 2px 0 rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"}}>
                <span style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "1em", lineHeight: "1", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 30px rgba(212,160,23,.35)"}}>{c.ch}</span>
                <div style={{position: "absolute", left: "0", right: "0", top: "50%", height: "1px", background: "rgba(0,0,0,.45)"}}></div>
                <div style={{position: "absolute", left: "0", right: "0", top: "0", height: "50%", background: "rgba(247,245,240,.12)", opacity: c.flap}}></div>
              </div>
            </React.Fragment>))}
          </div>
          <div className="p-total-label" style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.2vh,30px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>a month<br />for a household<br /><span style={{color: "rgba(247,245,240,.6)"}}>in {placeName}</span><br /><span style={{color: "#D4A017"}}>{cumulativeText}</span> <span style={{color: "rgba(247,245,240,.6)"}}>since 20 Jan 2025</span></div>
        </div>
        <label style={{display: "flex", flexDirection: "column", gap: "6px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", flex: "none"}}>
          <span className="p-state-label">YOUR STATE · RE-FLIPS FUEL, POWER AND THE TOTAL</span>
          <select className="p-state" value={state} onChange={onState} style={{appearance: "none", WebkitAppearance: "none", background: "#061530", color: "#F7F5F0", border: "1px solid rgba(247,245,240,.25)", borderRadius: "4px", padding: "10px 40px 10px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".06em", minWidth: "260px", cursor: "pointer", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23D4A017' stroke-width='1.5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center"}}>
            {(stateOptions || []).map((o, _i6) => (<React.Fragment key={_i6}>
              <option value={o.code}>{o.name}</option>
            </React.Fragment>))}
          </select>
        </label>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · YOUR PRICES<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>Thirteen of the fourteen prices are the Bureau of Labor Statistics' average prices for US cities, January 2025 against the latest month, {pricesMonth}. Diesel is the Energy Information Administration's weekly national average, {dieselFrom} (the week he took office) against {dieselThrough}. Each board row flips from the first price to the second; nothing in between is shown. The pump rolls through every published week.</p>
        <div style={{display: "grid", gridTemplateColumns: "minmax(0,1.4fr) repeat(3,minmax(0,.7fr)) minmax(0,2.1fr)", gap: "8px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".02em"}}>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)"}}>ITEM</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>JAN 2025</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>LATEST</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>CHANGE</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)"}}>SERIES</div>
          {(workPrices || []).map((r, _i5) => (<React.Fragment key={_i5}>
            <div style={{display: "contents"}}>
              <div>{r.name} <span style={{color: "rgba(11,30,63,.55)"}}>{r.unit}</span></div>
              <div style={{textAlign: "right"}}>{r.start}</div>
              <div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{r.end}</div>
              <div style={{textAlign: "right"}}>{r.change}</div>
              <div style={{color: "rgba(11,30,63,.7)"}}>{r.series}</div>
            </div>
          </React.Fragment>))}
        </div>
        <p style={{margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(11,30,63,.8)", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The total.</strong> {receiptMethod} Fuel: {receiptFuel}. Groceries: {receiptGroceries}. Electricity: {receiptElectricity}. The grocery line uses the median move across ten tracked staples, which ignores the largest increases on purpose. Household consumption varies enormously; these are national averages.</p>
        <p style={{margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(11,30,63,.8)", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>Your state.</strong> The running total under the monthly figure multiplies that month by the {receiptMonths} months elapsed, as the published receipt does; prices moved through that window, notably falling back during the June ceasefire, so it is an approximation. Picking a state swaps the fuel and electricity rows and re-totals: gasoline from EIA's weekly state or PADD-region series ({gasThrough} against 20 January 2025), electricity from EIA's monthly state residential price ({elecThrough} against January 2025). The grocery line stays national. The US row uses the published receipt, which is built on the BLS national series, so the two fuel figures differ by a few cents.</p>
        <p style={{margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(11,30,63,.8)", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>{dieselHead}</strong> {dieselNote} Diesel leads the board, rather than the gasoline most households buy, because it is the fuel of trucks, trains, farm machinery and ships, so its price reaches the cost of nearly everything else; gasoline is on the board too. <strong style={{fontWeight: "600"}}>Eggs.</strong> The fall is real and it is not policy: the 2022–25 spike was avian influenza, and prices came back down as the outbreak ended.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: BLS Average Price Data via FRED (series listed above) · EIA Weekly Retail Gasoline and Diesel Prices · EIA Electric Power Monthly · USDA Food Plans · EPA fleet fuel economy · EIA Residential Energy Consumption Survey.
        </p>
      </div>
    </details>
  </section>

  <section data-screen-label="05 Hiring" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Hiring</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={crowdRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`Two crowds of small human figures, one figure per 10,000 jobs. The left stand shows the ${jobsBaseLabel} average of ${jobsPrev} jobs a month; the right shows what has actually been added each month since January 2025, ${jobsCurr} a month on average, with a dashed line where it would stand at the earlier pace. Below, 100 figures show the share of the unemployed out of work six months or more, ${ltu1} percent.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div ref={crowdDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>JANUARY 2025</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>EACH CROWD IS THE TOTAL SINCE JAN 2025 · ONE FIGURE IS 10,000 JOBS<br />BLS PAYROLLS</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span>{jobsKicker}</div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
          <div className="g-num" ref={crowdNumRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,200px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>42,000</div>
          <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>new jobs a month<br />since he took office<br /><span style={{color: "rgba(247,245,240,.6)"}}>{jobsWas}</span></div>
        </div>
        <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "680px", textWrap: "pretty", color: "#F7F5F0"}}>{jobsSentence}</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · HIRING<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>Each figure is 10,000 jobs from the BLS monthly change in nonfarm payrolls. The left crowd adds the {jobsBaseLabel} average, {jobsPrev} a month, for each of the {jobsN} months since 20 January 2025. The right crowd adds what actually happened each month: {jobsCurr} a month on average, {jobsNeg} negative months (figures leave in red), and {jobsLatest}. Median rather than mean would read {jobsMed} against {jobsPrevMed}.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>Why {jobsBaseLabel}.</strong> The whole previous term averaged {jobsTermMean} a month over 48 months, but it began with the rebound from the 2020 lockdowns, when millions returned to jobs they had lost, so that figure would flatter the comparison. The last two full calendar years before he took office are used instead. The dashed line in the right-hand box marks where the figures would stand at that pace.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The frozen row.</strong> One hundred figures stand for the unemployed; the lit ones are the share out of work 27 weeks or more: {ltu0}% in January 2025, {ltu1}% in {ltuWhen}. Unemployment itself is {unemp1}%, {unempDir} {unemp0}%: few are being laid off (layoffs rate {layoffs}%), but hiring has all but stopped (hires rate {hires}%, quits {quits}%), so those who lose a job stay out longer.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>Why jobless claims are low.</strong> {claimsNote}</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The paycheck.</strong> Average hourly earnings rose {aheYoy}% in the year to {payMonth}; consumer prices rose {cpiYoy}%. The difference, {realYoy}%, is derived from average hourly earnings for all private employees (CES0500000003) and CPI-U, not seasonally adjusted.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: BLS Current Employment Statistics (PAYEMS monthly change) · BLS long-term unemployed share, U-6, JOLTS hires and quits · BLS CPI-U NSA · all via FRED.</p>
      </div>
    </details>
  </section>

  <section data-screen-label="06 What the war cost" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">What the war cost</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#6E1B27"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={warRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`A four-row ledger of what the war has cost: ${casN} cream stars for US service members killed, ${aircraftN} aircraft silhouettes for those lost or damaged, a bar for ${warSpent} spent against a dashed outline for the ${suppText} more requested, and 100 triangles showing about ${patriotPct} percent of Patriot interceptors left, an estimate the Secretary of Defense disputes.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>SINCE 28 FEB 2026</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>WHAT THE WAR HAS COST SO FAR<br />PENTAGON · CBO · CRS · NBC NEWS · CSIS</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: "#F7F5F0", flex: "none"}}></span>{warMonthsCaps} IN. HE SAID FOUR TO FIVE WEEKS.</div>
        <p className="g-sentence" style={{margin: "0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "760px", textWrap: "pretty", color: "#F7F5F0"}}>The Navy now resupplies from 2,200 miles away, and by one estimate a third of the Patriot interceptors are left. The Secretary of Defense disputes that estimate; the administration's own budget request asks for $21 billion to rebuild munitions stocks.</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · WHAT THE WAR COST<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>{casHead}</strong> US service members killed, NBC News data desk count as of {casDate}. A Wikipedia tally of contemporaneous reporting gives 20 killed and 762 injured; the lower, sourced figure is used.{casAlt} Injured: "hundreds."</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>Forty-two aircraft.</strong> Congressional Research Service IN12692, "U.S. Aircraft Combat Losses in Operation Epic Fury," as of 13 May 2026: {aircraftList}. Seventeen were manned aircraft and twenty-five were drones, drawn in outline. Three F-15Es were lost to friendly fire over Kuwait on 2 March; five KC-135s were damaged on the ground at Prince Sultan Air Base on 14 March; two MC-130Js were destroyed in Iran during the 5 April rescue. DoD's loss estimate is $2.6bn.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>{warHead}</strong> {warNote} The bar then extends by $67.1bn, the FY2026 supplemental request, of which $21bn is munitions to rebuild stockpiles. {quoteNote} Iran struck the Navy's Bahrain logistics hub on the first day; 228 structures were damaged and the fleet resupplies at sea from Diego Garcia, 2,200 miles away.</p>
        {(cboNote) ? (<><p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>A second, lower estimate.</strong> {cboNote}</p></>) : null}
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The interceptors, and the denial.</strong> CSIS estimated roughly a third of Patriot interceptors remained as of 27 July and that rebuilding would take at least three years; CNN reported about 80% of THAAD and half of Patriot stocks used. Secretary Hegseth disputed the reports on 5 August. The President demanded answers on the shortages on 3 September. The $21bn munitions line is consistent with the estimates the Secretary disputes. Both are printed on the screen.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: {warCite} · Congressional Budget Office · CRS IN12692 · NBC News data desk · Washington Post, Stars and Stripes on Bahrain · CSIS, CNN on munitions.</p>
      </div>
    </details>
  </section>

  <section data-screen-label="07 What it buys" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">What it buys</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={buyRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`The ${aircraftN} lost or damaged aircraft beside a large equals sign, and a pile of gold squares showing what the same money buys: PlayStation 5s, gallons of diesel, years of in-state tuition, Costco hot dogs. The sequence ends with the whole war's ${warSpent} as a pile roughly ${buyRatio} times larger, running off the top of the frame.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div ref={buyDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>42 AIRCRAFT LOST OR DAMAGED · PENTAGON ESTIMATE $2.6 BILLION</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>THE LOSSES, PRICED IN THINGS YOU BUY<br />CRS · SONY · EIA · COLLEGE BOARD · COSTCO</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span><span ref={buyKickRef}>WHAT THE LOST AIRCRAFT COST</span></div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
          <div className="g-num" ref={buyNumRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,200px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>0</div>
          <div ref={buySubRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>PlayStation 5s<br /><span style={{color: "rgba(247,245,240,.6)"}}>for one F-35A</span></div>
        </div>
        <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "760px", textWrap: "pretty", color: "#F7F5F0"}}>The Pentagon puts the {aircraftN} aircraft lost or damaged at {lossBn}: {buyPS5} million PlayStation 5s, {buyDays} days of all the diesel America burns, or {buyDogs} Costco hot dogs for every American. The whole war has cost {buyRatio} times that.</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · WHAT IT BUYS<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>Every comparison divides one figure, the Department of Defense's {lossBn} estimate for the 42 aircraft lost or damaged (Congressional Research Service, 13 May 2026), by one published price. The prices are list or national-average prices at the dates given, not what any particular buyer paid, and none is adjusted for what buying millions of anything would do to its price. Each square on the screen stands for a stated quantity; to the left of the equals sign are the aircraft themselves, manned aircraft filled and drones in outline. The squares drawn in red at the end are the war's {warSpent} cost to {warAsOf} at the same scale; they run off the top of the screen because at that scale they do.</p>
        <div style={{display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)", gap: "8px 16px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".02em"}}>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)"}}>THING</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>PRICE</div>
          <div style={{color: "rgba(11,30,63,.6)", paddingBottom: "6px", borderBottom: "1px solid rgba(11,30,63,.25)", textAlign: "right"}}>$2.6BN BUYS</div>
          <div>PlayStation 5, standard</div><div style={{textAlign: "right"}}>$549.99</div><div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{buyPS5} million</div>
          <div>Diesel, a gallon</div><div style={{textAlign: "right"}}>${buyDiesel}</div><div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{buyGallons} million gallons</div>
          <div>A year of in-state tuition and fees</div><div style={{textAlign: "right"}}>$11,610</div><div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{buyTuition},000 years</div>
          <div>Costco hot dog and soda</div><div style={{textAlign: "right"}}>$1.50</div><div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{buyDogsTotal} billion</div>
          <div>One F-35A</div><div style={{textAlign: "right"}}>$82.5 million</div><div style={{textAlign: "right", color: "#8a6a0c", fontWeight: "500"}}>{buyJet} PlayStation 5s each</div>
        </div>
        <p style={{margin: "0", fontSize: "15px", lineHeight: "1.55", color: "rgba(11,30,63,.8)", textWrap: "pretty"}}>"One for every {buyHH} households" is {buyPS5} million consoles against about 132 million US households. "{buyDays} days of diesel" divides {buyGallons} million gallons by the roughly 164 million gallons of distillate fuel the United States burns each day (3.9 million barrels). "{buyDogs} for every American" is {buyDogsTotal} billion hot dogs against a population of about 340 million. The $2.6 billion is the Pentagon's own loss estimate reported by CRS; the war's running cost, {warSpent}, is {warWho} as of {warAsOf}. Sony raised the US price of the PlayStation 5 from $499.99 to $549.99 on 21 August 2025, citing "a challenging economic environment"; the comparison uses the higher price.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: CRS IN12692 (aircraft and the DoD loss estimate) · {warCite} · Sony Interactive Entertainment, US list price, 21 Aug 2025 · EIA Weekly Retail Diesel, {dieselThrough}; EIA distillate consumption, 2024 · College Board, Trends in College Pricing 2024–25 · Costco, $1.50 hot dog and soda, unchanged since 1985 · US Census Bureau, households and population, 2024 · F-35A unit cost, Lots 15–17, F-35 Joint Program Office.</p>
      </div>
    </details>
  </section>

  <section data-screen-label="08 Gold leaves New York" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Gold leaves New York</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#0B1E3F"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(247,245,240,.5)", pointerEvents: "none", whiteSpace: "nowrap", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL · SHOW THE WORK BELOW</div>
      <canvas ref={vaultRef} style={{position: "absolute", inset: "0", width: "100%", height: "100%", display: "block"}} role="img" aria-label={`A pile of gold bars that grows month by month: only the gold taken out of the New York Fed, one icon for every ten 400-ounce bars, ${vaultBars} bars or ${vaultOut} tonnes over ${vaultMonths} months with none coming in. Beside it, who moved theirs and why, including Germany's gold still there, and the Fed's own answer: gold is down a fifth from its January record, and the dollar is up since the war began.`}></canvas>
      <div className="g-top" style={{position: "absolute", top: "0", left: "0", right: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 36px", pointerEvents: "none"}}>
        <div ref={vaultDateRef} style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "14px", letterSpacing: ".14em", color: "#F7F5F0", opacity: ".85"}}>AUGUST 2025</div>
        <div className="g-side" style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".14em", color: "rgba(247,245,240,.55)", textAlign: "right", lineHeight: "1.7"}}>GOLD HELD FOR FOREIGN CENTRAL BANKS AT THE NEW YORK FED<br />FEDERAL RESERVE TABLE 3.13</div>
      </div>
      <div className="g-bottom" style={{position: "absolute", left: "0", right: "0", bottom: "0", padding: "0 36px 36px", display: "flex", flexDirection: "column", gap: "2px", pointerEvents: "none"}}>
        <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(15px,2.2vh,21px)", letterSpacing: ".12em", textTransform: "uppercase", color: "#F7F5F0", marginBottom: "clamp(4px,1vh,10px)", display: "flex", alignItems: "center", gap: "10px"}}><span style={{display: "inline-block", width: "9px", height: "9px", background: MARK_RED, flex: "none"}}></span>CENTRAL BANKS ARE TAKING THEIR GOLD OUT OF NEW YORK</div>
        <div style={{display: "flex", alignItems: "baseline", gap: "18px", flexWrap: "wrap"}}>
          <div className="g-num" ref={vaultNumRef} style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(88px,22vh,200px)", lineHeight: ".86", letterSpacing: "-.02em", color: "#D4A017", fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(212,160,23,.35)"}}>0</div>
          <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "600", fontSize: "clamp(18px,3.6vh,34px)", lineHeight: "1.05", textTransform: "uppercase", letterSpacing: ".02em", color: "#F7F5F0", textWrap: "balance"}}>gold bars<br />taken out of New York<br /><span style={{color: "rgba(247,245,240,.6)"}}>{vaultSub}</span></div>
        </div>
        <p className="g-sentence" style={{margin: "clamp(8px,2vh,18px) 0 0", fontSize: "clamp(16px,2.7vh,24px)", lineHeight: "1.35", maxWidth: "720px", textWrap: "pretty", color: "#F7F5F0"}}>{vaultSentence}</p>
      </div>
    </div>
  </section>

  <section style={{background: "#F7F5F0", color: "#0B1E3F", padding: "56px 36px 72px"}}>
    <details style={{maxWidth: "820px", margin: "0 auto"}}>
      <summary style={{listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F"}}>
        <span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>SHOW THE WORK · THE VAULT<span className="sw-open" style={{marginLeft: "auto", color: "#8a6a0c", fontWeight: "500", letterSpacing: ".12em"}}></span>
      </summary>
      <div style={{paddingTop: "28px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "17px", lineHeight: "1.5"}}>
        <p style={{margin: "0", textWrap: "pretty"}}>The Federal Reserve publishes gold held under earmark for foreign and international accounts, valued at the statutory $42.22 an ounce, unchanged since 1973. Because the price is fixed, a change in that row is a change in ounces, not in value: tonnes = millions of dollars ÷ 42.22 × 31.1035. That gives {vaultStart} tonnes in {vaultFrom} and {vaultEnd} tonnes in {vaultTo}, the latest provisional release: {vaultOut} tonnes out, no month with an inflow.</p>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: "6px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".02em"}}>
          {(vaultRows || []).map((r, _i5) => (<React.Fragment key={_i5}>
            <div style={{display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(11,30,63,.15)", padding: "4px 0"}}><span style={{color: "rgba(11,30,63,.6)"}}>{r.m}</span><span style={{color: "#8a6a0c", fontWeight: "500"}}>{r.t}</span></div>
          </React.Fragment>))}
        </div>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The scale.</strong> {vaultScaleNote}</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>Who, and why.</strong> De Nederlandsche Bank moved 86 tonnes out of New York and Ottawa to London between March and August 2026, "in view of increasing geopolitical unrest," cutting New York's share of Dutch reserves from 31.3% to 18.5% (announced 2 September). The Banque de France moved 129 tonnes' worth from New York to Paris between July 2025 and January 2026 by selling older bars in New York and buying in Paris; no bar was shipped. The Reserve Bank of India brought its share held abroad from 55% to 22%, though from London and Basel rather than New York. Germany, with 1,236 tonnes in New York, is under pressure to repatriate and has no formal plan.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The Fed's counter-argument, at full size.</strong> Colin Weiss (Federal Reserve Board, FEDS Notes, 3 September 2026): gold's apparent overtaking of Treasuries as a reserve asset is a valuation effect from private ETF demand, not central-bank buying; five legacy holders own 52% of official gold and have not added since the 1970s; foreign officials bought about $200bn of Treasuries net from 2022 to April 2026. Gold itself is down about a fifth from its January record ($5,589 to $4,471 an ounce), and the dollar index is up since the war began. {treasSentence} total foreign Treasury holdings (TIC) were $9.3tn in June, the largest on record bar February.</p>
        <p style={{margin: "0", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.7)", lineHeight: "1.7"}}>Sources: Federal Reserve International Summary Statistics, Table 3.13 (latest release, provisional) · DNB press release 2 Sep 2026 · Bloomberg / Yahoo Finance 17 Jun 2026 · RBI half-yearly report · FEDS Notes 3 Sep 2026 · US Treasury TIC · Trading Economics for the gold price.
        </p>
      </div>
    </details>
  </section>

  <section data-screen-label="09 Your bill" style={{position: "relative", height: "100vh", scrollSnapAlign: "start"}}>
    <h2 className="v5-sr">Your bill</h2>
    <div style={{position: "sticky", top: "0", height: "100vh", overflow: "hidden", background: "#F7F5F0", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"}}>
      <div data-cue="1" style={{position: "absolute", left: "50%", bottom: "14px", transform: "translateX(-50%)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", letterSpacing: ".2em", color: "rgba(11,30,63,.5)", pointerEvents: "none", opacity: "0", transition: "opacity .5s", zIndex: "2"}}>SCROLL</div>
      <div ref={cardRef} style={{width: "min(1200px,100%)", aspectRatio: "1200/630", maxHeight: "100%", background: "#0B1E3F", border: "1px solid rgba(247,245,240,.25)", borderRadius: "8px", position: "relative", overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,.5)", display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", padding: "clamp(14px,3vmin,40px) clamp(16px,3.5vmin,48px)", gap: "clamp(6px,1.5vmin,18px)", containerType: "inline-size"}}>
        <div style={{position: "absolute", left: "0", right: "0", top: "0", height: "6px", background: `repeating-linear-gradient(90deg,${MARK_RED} 0 7.69%,#F7F5F0 7.69% 15.38%)`}}></div>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", paddingTop: "6px"}}>
          <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(20px,4.2cqw,54px)", lineHeight: "1", letterSpacing: ".02em", textTransform: "uppercase", color: "#F7F5F0"}}>The Bill</div>
          <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(8px,1.1cqw,13px)", letterSpacing: ".14em", color: "rgba(247,245,240,.6)", textAlign: "right"}}>{cardDate}</div>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridAutoRows: "minmax(0,1fr)", gap: "clamp(6px,1.4cqw,18px)", minHeight: "0"}}>
          {(cardItems || []).map((it, _i5) => (<React.Fragment key={_i5}>
            <div ref={it.ref} style={{display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", borderTop: "1px solid rgba(247,245,240,.2)", paddingTop: "clamp(4px,1cqw,10px)", minHeight: "0", opacity: "0", transform: "translateY(24px)", willChange: "transform,opacity"}}>
              <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(22px,4.6cqw,60px)", lineHeight: ".95", letterSpacing: "-.02em", color: it.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap"}}>{it.num}</div>
              <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(7px,1cqw,12px)", letterSpacing: ".1em", color: "rgba(247,245,240,.7)", lineHeight: "1.4", textTransform: "uppercase", minHeight: "2.8em"}}>{it.label}</div>
            </div>
          </React.Fragment>))}
        </div>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", borderTop: "1px solid rgba(247,245,240,.2)", paddingTop: "clamp(6px,1.2cqw,14px)"}}>
          <div style={{fontFamily: "'Barlow Condensed',sans-serif", fontWeight: "700", fontSize: "clamp(16px,3cqw,38px)", lineHeight: "1", letterSpacing: ".02em", textTransform: "uppercase"}}><span style={{color: MARK_RED}}>Ordered by Trump.</span> <span style={{color: "#F7F5F0"}}>Paid by you.</span></div>
          <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "clamp(7px,1cqw,12px)", letterSpacing: ".14em", color: "rgba(247,245,240,.6)", textAlign: "right"}}>GOVERNMENT DATA · EVERY SOURCE BELOW</div>
        </div>
      </div>
    </div>
  </section>

  <section data-screen-label="10 Check our work" style={{background: "#F7F5F0", color: "#0B1E3F", padding: "72px 36px 96px"}}>
    <h2 className="v5-sr">Check our work</h2>
    <div style={{maxWidth: "820px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px", fontSize: "17px", lineHeight: "1.5"}}>
      <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", padding: "14px 0", borderTop: "1px solid #0B1E3F", borderBottom: "1px solid #0B1E3F", display: "flex", alignItems: "center", gap: "14px"}}><span style={{display: "inline-block", width: "10px", height: "10px", background: "#D4A017"}}></span>CHECK OUR WORK</div>
      <p style={{margin: "0", textWrap: "pretty", fontSize: "20px"}}>Every number on this page comes from the government's own tables or a named source. Under every block is a "Show the work" panel, marked OPEN +, with the series, the dates and the method. What follows is what the numbers can and cannot say, starting with the ones that cut against this page.</p>
      <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", letterSpacing: ".16em", color: "rgba(11,30,63,.7)"}}>WHAT CUTS AGAINST THIS PAGE</div>
      <div style={{display: "flex", flexDirection: "column", gap: "18px"}}>
        {(againstRows || []).map((r, _i4) => (<React.Fragment key={_i4}><p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>{r.head}</strong> {r.text}</p></React.Fragment>))}
      </div>
      <div style={{display: "flex", flexDirection: "column", gap: "18px"}}>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>How fresh this is.</strong> {freshNote}</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>The missing month.</strong> The October 2025 Consumer Price Index was never collected. Every twelve-month comparison on this page runs month to month across that gap rather than by counting observations.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>{dieselHeadPolicy}</strong> {dieselNote} Eggs cost half what they did in January 2025 because the 2022–25 avian influenza outbreak ended; that fall is real and it is not policy. The oil peak is the daily spot close, $114.58 on 7 April, the day the first ceasefire was announced.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>What the counts are, and are not.</strong> PortWatch ship counts come from satellite AIS positions; ships transmitting no position are not counted, so every figure is a floor and none is a queue count. Ship and particle positions on the globe and the strait are a model; the counts driving them are not. Household costs are national averages built from stated quantities, and the running total assumes the current monthly gap applied evenly since 20 January 2025. The war-cost casualty figure is a news organisation's count, and a higher tally exists. The jobs comparison uses 2023 and 2024, not the whole previous term, because that term began with the pandemic rebound. Gold tonnage is derived from the Fed's statutory valuation, which fixes the price and so isolates the ounces. The "what the lost aircraft cost" comparisons divide one Pentagon figure by one list price each; they are scale, not a proposal for how the money should have been spent.</p>
        <p style={{margin: "0", textWrap: "pretty"}}><strong style={{fontWeight: "600"}}>What we will not do.</strong> War and tariff effects are never summed. Odds are odds. No queue count is published because none exists at any tier. The word "cover-up" does not appear; where an estimate is disputed, the denial is printed beside it.</p>
      </div>
      <div style={{fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", letterSpacing: ".04em", color: "rgba(11,30,63,.75)", lineHeight: "1.8", borderTop: "1px solid rgba(11,30,63,.25)", paddingTop: "18px"}}>
        <div style={{letterSpacing: ".16em", color: "rgba(11,30,63,.55)", marginBottom: "6px"}}>SOURCES</div>
        IMF PortWatch (IMF / University of Oxford), chokepoint transit estimates, as of {asOf} · FRED: DCOILWTICO, GASDESW, PAYEMS, CPIAUCNS, CES0500000003, LNS13025703, U6RATE, JTSHIR, JTSQUR, SP500, MORTGAGE30US, DTWEXBGS, and the BLS average-price series listed on the board · EIA weekly retail gasoline and diesel, Electric Power Monthly, Weekly Petroleum Status Report · Federal Reserve International Summary Statistics Table 3.13; FEDS Notes, 3 Sep 2026 · De Nederlandsche Bank press release, 2 Sep 2026 · Banque de France via Bloomberg, 17 Jun 2026 · Reserve Bank of India half-yearly report · Congressional Research Service IN12692 · {warCite}; DoD FY2026 supplemental request · NBC News data desk, {casDate} · CSIS; CNN on munitions · Washington Post; Stars and Stripes on Bahrain · Supreme Court, <em>Learning Resources v. Trump</em>, 20 Feb 2026; Dallas Fed, Jun 2026 · Natural Earth coastlines via world-atlas · USDA Food Plans; EPA fleet fuel economy; EIA RECS · Sony Interactive Entertainment US list price, 21 Aug 2025; College Board Trends in College Pricing 2024–25; Costco; US Census Bureau households and population; F-35 Joint Program Office unit cost.
      </div>
    </div>
  </section>

  
</div>
    );
  }
}
