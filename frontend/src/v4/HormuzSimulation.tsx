/**
 * Strait of Hormuz — playable simulation.
 *
 * Press play and the timeline runs from 2 January 2026 to 4 August. Transit
 * volume, war-risk insurance and the crude price update as it advances, and the
 * vessel layer thins to nothing when the strait closes and refills when it
 * reopens.
 *
 * ── Why this is a class component ───────────────────────────────────────────
 * Everything here is imperative: one rAF loop, two canvases, and readouts
 * written through refs. A class gives a stable instance to hang that on, with
 * no stale-closure hazard in the loop. The rest of the app is function
 * components; this is the deliberate exception.
 *
 * ── The three traps Design hit, and how they are handled ────────────────────
 * 1. React restores imperative DOM writes on re-render. Any `textContent` we
 *    set is silently reverted to the seed markup whenever the component
 *    re-renders. `writes` keeps the last value per ref and `replayWrites()`
 *    reapplies them in componentDidUpdate.
 * 2. ResizeObserver and IntersectionObserver do not fire in some embedded
 *    frames. Both are replaced by a synchronous measurement on mount plus a
 *    cheap poll every 8 frames.
 * 3. Chart labels must be verified by measuring, not by counting nodes —
 *    zero-width text passes a node count while rendering nothing.
 *
 * `day` is never React state. Putting it there would re-render at 60fps.
 */

import { Component, createRef, type RefObject } from 'react';
import {
  EVENTS, IRAN, ISLES, LANE, OMAN, PORTS, QESHM, SPAN_DAYS, TRANSIT, WAR_RISK,
  formatDay, laneAt, priceAt, riskPerBarrel, stepAt, trafficShare,
  type TimelineEvent,
} from './hormuz/timeline';

const C = {
  sea0: '#04090F', sea1: '#08161F', sea2: '#040B12',
  land0: '#3A3225', land1: '#241F17',
  ink: '#F4EDE0', dim: '#8A99A8', amber: '#F5A300',
  red: '#D8483F', green: '#3FA96A', lane: 'rgba(245,163,0,.28)',
};

/** Days of timeline per real second at 1x. 214 days in ~36s. */
const BASE_DPS = 6;
const SPEEDS: [string, number][] = [['1×', 1], ['2×', 2], ['6×', 6]];

interface Vessel { t: number; dir: 1 | -1; speed: number; size: number; }

export interface HormuzProps {
  closes: { date: string; value: number }[];
}

export class HormuzSimulation extends Component<HormuzProps> {
  // --- refs -----------------------------------------------------------------
  private mapRef = createRef<HTMLCanvasElement>();
  private chartRef = createRef<HTMLCanvasElement>();
  private wrapRef = createRef<HTMLDivElement>();
  private scrubRef = createRef<HTMLInputElement>();
  private text: Record<string, RefObject<HTMLElement | null>> = {};

  // --- simulation state (deliberately not React state) ----------------------
  private day = 0;
  private playing = false;
  private speed = 1;
  private scrubbing = false;
  private vessels: Vessel[] = [];
  private raf: number | null = null;
  private last = 0;
  private frame = 0;
  private stopped = false;
  private onScreen = true;
  private reduced = false;
  private dirty = true;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private size = { w: 0, h: 0, dpr: 1 };
  private writes = new Map<string, string>();

  private t(name: string): RefObject<HTMLElement | null> {
    if (!this.text[name]) this.text[name] = createRef<HTMLElement>();
    return this.text[name];
  }

  /** Write text through a ref, remembering it so a re-render can't undo it. */
  private set(name: string, value: string) {
    if (this.writes.get(name) === value) return;
    this.writes.set(name, value);
    const el = this.text[name]?.current;
    if (el) el.textContent = value;
  }

  private replayWrites() {
    for (const [name, value] of this.writes) {
      const el = this.text[name]?.current;
      if (el && el.textContent !== value) el.textContent = value;
    }
    // The scrubber is a controlled-looking input driven imperatively; React
    // restores its value attribute on re-render too.
    const s = this.scrubRef.current;
    if (s && !this.scrubbing) s.value = String(Math.round(this.day));
  }

  // --- lifecycle ------------------------------------------------------------

  componentDidMount() {
    this.stopped = false;
    this.reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    this.seedVessels();
    this.fit();

    if (this.reduced) {
      // Reduced motion still gets the complete picture, just not animated:
      // jump to the end and settle the vessel layer without a loop.
      this.day = SPAN_DAYS;
      for (let i = 0; i < 240; i++) this.step(1 / 30, true);
      this.paint();
      return;
    }
    this.paint();
    this.startLoop();
  }

  componentDidUpdate() { this.replayWrites(); }

  componentWillUnmount() {
    this.stopped = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // --- sizing ---------------------------------------------------------------

  private fit(): boolean {
    const wrap = this.wrapRef.current;
    const map = this.mapRef.current;
    const chart = this.chartRef.current;
    if (!wrap || !map || !chart) return false;

    const w = wrap.clientWidth;
    if (w <= 0) return false;
    const mapH = Math.round(Math.max(220, Math.min(430, w * 0.52)));
    const chartH = 108;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    if (this.size.w === w && this.size.h === mapH && this.size.dpr === dpr) return false;
    this.size = { w, h: mapH, dpr };

    for (const [cv, h] of [[map, mapH], [chart, chartH]] as [HTMLCanvasElement, number][]) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cv.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.bg = null; // static layer must be rebuilt at the new size
    return true;
  }

  private checkOnScreen(): boolean {
    const el = this.wrapRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > -120 && r.top < window.innerHeight + 120;
  }

  // --- loop -----------------------------------------------------------------

  private startLoop() {
    if (this.raf !== null || this.stopped) return;
    this.last = performance.now();

    const loop = (now: number) => {
      this.raf = null;
      if (this.stopped) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame++;

      // Polling stands in for the two observers, which do not fire reliably in
      // embedded frames. Every 8 frames is cheap and imperceptible.
      if ((this.frame & 7) === 0) {
        this.onScreen = this.checkOnScreen();
        if (this.fit()) this.dirty = true;
      }

      if (this.onScreen) {
        if (this.playing && !this.scrubbing) {
          this.day += dt * BASE_DPS * this.speed;
          if (this.day >= SPAN_DAYS) { this.day = SPAN_DAYS; this.setPlaying(false); }
          this.dirty = true;
        }
        this.step(dt, false);
        if (this.dirty || this.playing) this.paint();
        this.dirty = false;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // --- vessels --------------------------------------------------------------

  private seedVessels() {
    this.vessels = Array.from({ length: 26 }, (_, i) => ({
      t: i / 26,
      dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      speed: 0.021 + (i % 5) * 0.0035,
      size: 0.7 + (i % 4) * 0.16,
    }));
  }

  /**
   * Advance vessel positions. `share` gates how many are underway — at 0.0
   * transit the lane empties, which is the point of the whole animation.
   */
  private step(dt: number, force: boolean) {
    if (!this.onScreen && !force) return;
    const share = trafficShare(this.day);
    const active = Math.round(this.vessels.length * share);
    this.vessels.forEach((v, i) => {
      if (i >= active) return;
      v.t += dt * v.speed * v.dir * (this.playing || force ? 1 : 0.15);
      if (v.t > 1.05) v.t = -0.05;
      if (v.t < -0.05) v.t = 1.05;
    });
  }

  // --- painting -------------------------------------------------------------

  private paint() {
    this.paintMap();
    this.paintChart();
    this.paintReadouts();
  }

  private poly(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, h: number) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.closePath();
  }

  /** Static layer: sea, grid, coastlines, islands, ports, lane. Cached by size. */
  private buildBg(w: number, h: number, dpr: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C.sea0); g.addColorStop(0.5, C.sea1); g.addColorStop(1, C.sea2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(244,237,224,.03)'; ctx.lineWidth = 1;
    for (let y = 0.1; y < 1; y += 0.1) {
      ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke();
    }
    for (let x = 0.12; x < 1; x += 0.12) {
      ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke();
    }

    // Coast glow, then landmass fill.
    for (const [lw, col] of [[9, 'rgba(245,163,0,.045)'], [4, 'rgba(245,163,0,.07)']] as [number, string][]) {
      ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round';
      for (const s of [IRAN, OMAN, QESHM]) { this.poly(ctx, s, w, h); ctx.stroke(); }
    }
    const lg = ctx.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, C.land0); lg.addColorStop(1, C.land1);
    for (const s of [IRAN, OMAN, QESHM]) {
      this.poly(ctx, s, w, h);
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = 'rgba(245,163,0,.35)'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    for (const [x, y, r] of ISLES) {
      ctx.beginPath(); ctx.arc(x * w, y * h, r * w, 0, 6.2832);
      ctx.fillStyle = C.land0; ctx.fill();
      ctx.strokeStyle = 'rgba(245,163,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // Lane.
    ctx.beginPath();
    LANE.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    ctx.strokeStyle = C.lane; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(245,163,0,.5)'; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    ctx.stroke(); ctx.setLineDash([]);

    // Labels. 11px floor holds at 375px wide; below 420px the port labels and
    // the island names are dropped rather than shrunk.
    const small = w < 420;
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    if (!small) {
      ctx.fillStyle = C.dim;
      for (const [x, y, , label] of ISLES) {
        if (!label) continue;
        ctx.textAlign = 'left';
        ctx.fillText(label, x * w + 12, y * h);
      }
      for (const [x, y, label, side] of PORTS) {
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.arc(x * w, y * h, 3, 0, 6.2832); ctx.fill();
        ctx.fillStyle = C.dim;
        ctx.textAlign = x > 0.6 ? 'right' : 'left';
        ctx.fillText(label, x * w + (x > 0.6 ? -8 : 8), y * h + side * 12);
      }
    }
    ctx.fillStyle = 'rgba(138,153,168,.75)';
    ctx.font = '600 10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ILLUSTRATIVE GEOMETRY · VESSEL POSITIONS ARE NOT AIS DATA', 10, h - 12);
    return c;
  }

  private paintMap() {
    const cv = this.mapRef.current;
    if (!cv) return;
    const { w, h, dpr } = this.size;
    if (w <= 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const key = `${w}x${h}x${dpr}`;
    if (!this.bg || this.bgKey !== key) { this.bg = this.buildBg(w, h, dpr); this.bgKey = key; }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.bg, 0, 0, w, h);

    const share = trafficShare(this.day);
    const active = Math.round(this.vessels.length * share);

    this.vessels.forEach((v, i) => {
      if (i >= active) return;
      const p = laneAt(v.t);
      const x = p.x * w, y = p.y * h;
      if (x < -20 || x > w + 20) return;
      const len = 11 * v.size, wid = 4.2 * v.size;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.angle + (v.dir < 0 ? Math.PI : 0));
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(len * 0.35, -wid);
      ctx.lineTo(-len, -wid);
      ctx.lineTo(-len, wid);
      ctx.lineTo(len * 0.35, wid);
      ctx.closePath();
      ctx.fillStyle = v.dir > 0 ? C.amber : C.ink;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.restore();
    });

    // Closure banner — the whole point of the animation is that this appears.
    if (share <= 0.001) {
      ctx.fillStyle = 'rgba(216,72,63,.14)';
      ctx.fillRect(0, h * 0.5 - 22, w, 44);
      ctx.fillStyle = C.red;
      ctx.font = '700 13px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('STRAIT CLOSED · 0.0 MB/D', w / 2, h * 0.5);
    }
  }

  private paintChart() {
    const cv = this.chartRef.current;
    if (!cv) return;
    const { w, dpr } = this.size;
    const h = 108;
    if (w <= 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const closes = this.props.closes;
    if (!closes.length) return;
    const lo = 40, hi = 120;
    const pad = { l: 6, r: 6, t: 10, b: 16 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const sx = (d: number) => pad.l + (d / SPAN_DAYS) * iw;
    const sy = (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;

    ctx.strokeStyle = 'rgba(244,237,224,.10)'; ctx.lineWidth = 1;
    for (const v of [60, 80, 100]) {
      ctx.beginPath(); ctx.moveTo(pad.l, sy(v)); ctx.lineTo(w - pad.r, sy(v)); ctx.stroke();
    }

    ctx.beginPath();
    let started = false;
    for (let d = 0; d <= SPAN_DAYS; d++) {
      const p = priceAt(closes, d);
      if (!p) continue;
      const X = sx(d), Y = sy(p.value);
      started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      started = true;
    }
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();

    // Played portion, brighter.
    ctx.beginPath();
    started = false;
    for (let d = 0; d <= Math.min(this.day, SPAN_DAYS); d++) {
      const p = priceAt(closes, d);
      if (!p) continue;
      const X = sx(d), Y = sy(p.value);
      started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      started = true;
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.stroke();

    for (const e of EVENTS) {
      const X = sx(e.day);
      ctx.strokeStyle = e.sign > 0 ? 'rgba(216,72,63,.45)' : 'rgba(63,169,106,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X, pad.t); ctx.lineTo(X, pad.t + ih); ctx.stroke();
    }

    const cur = priceAt(closes, this.day);
    if (cur) {
      const X = sx(this.day), Y = sy(cur.value);
      ctx.beginPath(); ctx.arc(X, Y, 3.5, 0, 6.2832);
      ctx.fillStyle = C.ink; ctx.fill();
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  /** Nearest event at or before the current day, for the caption line. */
  private currentEvent(): TimelineEvent | null {
    let cur: TimelineEvent | null = null;
    for (const e of EVENTS) if (this.day >= e.day - 0.5) cur = e;
    return cur;
  }

  private paintReadouts() {
    const closes = this.props.closes;
    const p = priceAt(closes, this.day);
    const transit = stepAt(TRANSIT, this.day);
    const risk = stepAt(WAR_RISK, this.day);
    const [rlo, rhi] = risk.value;

    this.set('date', formatDay(this.day));
    this.set('price', p ? `$${p.value.toFixed(2)}` : '—');
    this.set('priceNote', p ? (p.exact ? `close ${p.date}` : `last close ${p.date}`) : 'no close');
    this.set('transit', transit.value === null ? '—' : `${transit.value.toFixed(1)}`);
    this.set('transitNote', `as of ${transit.asOf} · ${transit.source}`);
    this.set('risk', rlo === rhi ? `${rlo}%` : `${rlo}–${rhi}%`);
    this.set('riskNote',
      `≈ $${riskPerBarrel(rhi).toFixed(2)}/bbl · as of ${risk.asOf}`);

    const e = this.currentEvent();
    this.set('evTitle', e ? e.label : 'Before the war');
    this.set('evDetail', e ? e.detail : 'Crude at its twelve-month low. The strait is open.');
  }

  // --- controls -------------------------------------------------------------

  private setPlaying(v: boolean) {
    this.playing = v;
    this.set('play', v ? 'PAUSE' : this.day >= SPAN_DAYS ? 'REPLAY' : 'PLAY');
    this.dirty = true;
  }

  private togglePlay = () => {
    if (!this.playing && this.day >= SPAN_DAYS) this.day = 0;
    this.setPlaying(!this.playing);
    if (this.raf === null) this.startLoop();
  };

  private setSpeed = (s: number) => {
    this.speed = s;
    for (const [, v] of SPEEDS) {
      const el = this.text[`sp${v}`]?.current;
      if (el) el.setAttribute('aria-pressed', String(v === s));
    }
    this.forceUpdate();
  };

  private onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.day = Number(e.target.value);
    this.dirty = true;
    this.step(0, true);
    this.paint();
  };

  render() {
    const label = (name: string, cls: string, seed: string) => (
      <span ref={this.t(name) as RefObject<HTMLSpanElement>} className={cls}>{seed}</span>
    );

    return (
      <div className="hz" ref={this.wrapRef}>
        <div className="hz-readouts">
          <div className="hz-ro">
            <span className="hz-ro-k">Date</span>
            {label('date', 'hz-ro-v', '02 JAN 2026')}
          </div>
          <div className="hz-ro">
            <span className="hz-ro-k">Crude, Cushing spot</span>
            {label('price', 'hz-ro-v', '$57.21')}
            {label('priceNote', 'hz-ro-n', 'close 2026-01-02')}
          </div>
          <div className="hz-ro">
            <span className="hz-ro-k">Transit, mb/d</span>
            {label('transit', 'hz-ro-v', '13.8')}
            {label('transitNote', 'hz-ro-n', 'as of 2026-01-02 · IEA')}
          </div>
          <div className="hz-ro">
            <span className="hz-ro-k">War-risk, % of hull</span>
            {label('risk', 'hz-ro-v', '0.25%')}
            {label('riskNote', 'hz-ro-n', '≈ $0.13/bbl')}
          </div>
        </div>

        <div className="hz-canvases">
          <canvas ref={this.mapRef} className="hz-map" role="img"
            aria-label="Map of the Strait of Hormuz with vessel traffic. Positions are illustrative, not AIS data." />
          <canvas ref={this.chartRef} className="hz-chart" role="img"
            aria-label="WTI crude price across the simulated period, with war events marked." />
        </div>

        <div className="hz-event">
          {label('evTitle', 'hz-event-t', 'Before the war')}
          {label('evDetail', 'hz-event-d',
            'Crude at its twelve-month low. The strait is open.')}
        </div>

        <div className="hz-controls">
          <button type="button" className="hz-play" onClick={this.togglePlay}
            ref={this.t('play') as RefObject<HTMLButtonElement>}>PLAY</button>

          <input
            ref={this.scrubRef}
            className="hz-scrub"
            type="range" min={0} max={SPAN_DAYS} step={1} defaultValue={0}
            aria-label="Scrub the timeline"
            onPointerDown={() => { this.scrubbing = true; }}
            onPointerUp={() => { this.scrubbing = false; }}
            onPointerCancel={() => { this.scrubbing = false; }}
            onChange={this.onScrub}
          />

          <div className="hz-speeds" role="group" aria-label="Playback speed">
            {SPEEDS.map(([lbl, v]) => (
              <button
                key={v} type="button"
                ref={this.t(`sp${v}`) as RefObject<HTMLButtonElement>}
                className={`hz-speed${this.speed === v ? ' is-on' : ''}`}
                aria-pressed={this.speed === v}
                onClick={() => this.setSpeed(v)}
              >{lbl}</button>
            ))}
          </div>
        </div>

        {this.reduced && (
          <p className="hz-reduced">
            Reduced motion is on, so the timeline is shown at its end rather than animated.
            Drag the scrubber to move through it.
          </p>
        )}
      </div>
    );
  }
}

export default HormuzSimulation;
