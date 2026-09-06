/* eslint-disable @typescript-eslint/no-explicit-any -- the snapshot is untyped JSON straight from the endpoints; every field is guarded before use. */
/**
 * §08 — The strait. React wrapper around `hormuz/engine.js`.
 *
 * The engine is ported verbatim and owns both canvases, the rAF loop, the
 * vessel model, the timeline and all the drawing maths. This file owns markup
 * and nothing else. If you find yourself computing a position here, it belongs
 * in the engine.
 *
 * Since September 2026 the engine runs on MEASURED series rather than anchors:
 * every daily WTI close from FRED and every day of IMF PortWatch transit counts
 * through the strait. Both come from the snapshot via `getData`, are handed to
 * `configureTimeline()` before the engine mounts, and extend the scrubber to
 * the last trading day automatically. If either fetch fails the engine falls
 * back to the hand-verified anchors and the stepped IEA readouts, and the
 * legend says so.
 *
 * Two things that will silently break if changed:
 *   - Readout text goes through `ImperativeText`, not React state. The engine
 *     emits at 60fps; state would re-render the tree every frame. React also
 *     restores `textContent` to the JSX seed on any re-render, which is why
 *     `.replay()` runs in an effect with no dependency array.
 *   - Scrub ticks come from `scrubTicks()`. Never hard-code the percentages —
 *     they are derived from the event ledger and move when it does.
 */

import { useEffect, useRef, useState } from 'react';
// @ts-expect-error — ported JS module, no types by design
import { HormuzEngine, scrubTicks, configureTimeline, SPAN as SPAN_FALLBACK } from './hormuz/engine.js';
// @ts-expect-error — ported JS module, no types by design
import { ImperativeText } from './reveal.js';
import { getData } from './data';

interface Readout {
  price: string; priceCaption: string; priceDimmed: boolean;
  flow: string; flowCaption: string; flowColor: string;
  risk: string; riskCaption: string; riskColor: string;
  queue: string; queueColor: string;
  date: string; gateLabel: string; gateColor: string;
  playing: boolean; speed: number; progressPct: number;
  eventIndex: number;
  event: { date: string; kind: string; tier: string; headline: string; detail: string; color: string } | null;
}

interface Wiring {
  prices: boolean;
  transits: boolean;
  span: number;
  baseline: number | null;
  lastTransit: string | null;
}

export default function HormuzSimulation() {
  const mapWrap = useRef<HTMLDivElement>(null);
  const mapCanvas = useRef<HTMLCanvasElement>(null);
  const chartWrap = useRef<HTMLDivElement>(null);
  const chartCanvas = useRef<HTMLCanvasElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const engineRef = useRef<any>(null);
  const textRef = useRef<any>(null);
  const [wiring, setWiring] = useState<Wiring>({ prices: false, transits: false, span: SPAN_FALLBACK, baseline: null, lastTransit: null });

  // Every element the engine writes into.
  const r = {
    price: useRef<HTMLDivElement>(null), priceCap: useRef<HTMLDivElement>(null),
    flow: useRef<HTMLDivElement>(null), flowCap: useRef<HTMLDivElement>(null),
    risk: useRef<HTMLDivElement>(null), riskCap: useRef<HTMLDivElement>(null),
    queue: useRef<HTMLDivElement>(null),
    date: useRef<HTMLSpanElement>(null),
    status: useRef<HTMLSpanElement>(null), statusDot: useRef<HTMLSpanElement>(null),
    play: useRef<HTMLButtonElement>(null),
    fill: useRef<HTMLSpanElement>(null), thumb: useRef<HTMLSpanElement>(null),
    evMeta: useRef<HTMLDivElement>(null), evHead: useRef<HTMLDivElement>(null),
    evDetail: useRef<HTMLDivElement>(null), ev: useRef<HTMLDivElement>(null),
    sp: [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)],
  };

  useEffect(() => {
    const T = new ImperativeText();
    textRef.current = T;
    let lastEvent = -2;
    let cancelled = false;
    let engine: any = null;

    const mount = (w: Wiring) => {
      if (cancelled) return;
      setWiring(w);

      // Ticks are derived from the ledger, one per event, positioned against
      // the (possibly extended) span.
      if (track.current) {
        track.current.querySelectorAll('.hz-tick').forEach((n) => n.remove());
        for (const t of scrubTicks() as any[]) {
          const s = document.createElement('span');
          s.className = 'hz-tick';
          s.style.cssText =
            `left:${t.leftPct}%;top:${t.top}px;width:${t.width}px;height:${t.height}px;background:${t.color}`;
          track.current.appendChild(s);
        }
      }

      engine = new HormuzEngine({
        mapCanvas: mapCanvas.current, mapWrap: mapWrap.current,
        chartCanvas: chartCanvas.current, chartWrap: chartWrap.current,
        onReadout(d: Readout) {
          T.put(r.price.current, d.price);
          T.put(r.priceCap.current, d.priceCaption);
          if (r.priceCap.current) r.priceCap.current.style.opacity = d.priceDimmed ? '.72' : '1';

          T.put(r.flow.current, d.flow);
          if (r.flow.current) r.flow.current.style.color = d.flowColor;
          T.put(r.flowCap.current, d.flowCaption);

          T.put(r.risk.current, d.risk);
          if (r.risk.current) r.risk.current.style.color = d.riskColor;
          T.put(r.riskCap.current, d.riskCaption);

          T.put(r.queue.current, d.queue);
          if (r.queue.current) r.queue.current.style.color = d.queueColor;

          T.put(r.date.current, d.date);
          T.put(r.status.current, d.gateLabel);
          if (r.status.current) r.status.current.style.color = d.gateColor;
          if (r.statusDot.current) {
            r.statusDot.current.style.background = d.gateColor;
            // Pulses only while flow is below baseline — the engine decides.
            r.statusDot.current.dataset.pulse = d.gateLabel === 'TRANSIT NORMAL' ? '0' : '1';
          }

          T.put(r.play.current, d.playing ? 'PAUSE' : 'PLAY');
          if (r.fill.current) r.fill.current.style.width = `${d.progressPct.toFixed(2)}%`;
          if (r.thumb.current) r.thumb.current.style.left = `${d.progressPct.toFixed(2)}%`;

          // The card flashes only when the event actually changes, not every frame.
          if (d.event && d.eventIndex !== lastEvent) {
            lastEvent = d.eventIndex;
            T.put(r.evMeta.current, `${d.event.date} · ${d.event.kind} · ${d.event.tier}`);
            T.put(r.evHead.current, d.event.headline);
            T.put(r.evDetail.current, d.event.detail);
            if (r.ev.current) {
              r.ev.current.style.borderLeftColor = d.event.color;
              r.ev.current.classList.remove('is-flash');
              void r.ev.current.offsetWidth; // restart the animation
              r.ev.current.classList.add('is-flash');
            }
          }

          r.sp.forEach((b, i) => {
            const v = [1, 2, 6][i];
            if (b.current) b.current.dataset.on = v === d.speed ? '1' : '0';
          });
        },
      });

      engineRef.current = engine;
      engine.mount();
    };

    // Wire the measured series first; fall back to anchors if they do not load.
    Promise.all([
      getData('crude_daily').catch(() => null),
      getData('hormuz_transits').catch(() => null),
    ]).then(([crude, transits]) => {
      const prices = crude?.observations ?? null;
      const span = configureTimeline({ prices, transits: transits ?? undefined });
      mount({
        prices: !!(prices && prices.length),
        transits: !!(transits && transits.observations && transits.observations.length),
        span,
        baseline: transits?.baseline?.total_per_day ?? null,
        lastTransit: transits?.latest?.date ?? null,
      });
    }).catch(() => mount({ prices: false, transits: false, span: SPAN_FALLBACK, baseline: null, lastTransit: null }));

    return () => { cancelled = true; engine?.destroy(); };
  }, []);

  // No dependency array on purpose: React restores imperative writes to the JSX
  // seed on every render, so this has to run after every one of them.
  useEffect(() => { textRef.current?.replay(); });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = track.current, en = engineRef.current;
    if (!el || !en) return;
    en.beginScrub();
    el.setPointerCapture(e.pointerId);
    en.seek(en.dayFromClientX(e.clientX, el));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const en = engineRef.current;
    if (en?.scrubbing) en.seek(en.dayFromClientX(e.clientX, track.current));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    engineRef.current?.endScrub();
    track.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="hz">
      <div className="hz-top">
        <div className="hz-mappanel">
          <div className="hz-mapwrap" ref={mapWrap}>
            <canvas ref={mapCanvas} className="hz-canvas" role="img"
              aria-label="Strait of Hormuz with modelled tanker traffic. Coastline from Natural Earth; vessel positions are a model, not AIS data." />
            <div className="hz-state">
              <span className="hz-dot" ref={r.statusDot} data-pulse="0" aria-hidden />
              <span className="t-label" ref={r.status}>TRANSIT NORMAL</span>
            </div>
            <div className="hz-illus t-label">
              Natural Earth 10m coastline, stretched to fit<br />Vessel positions are a model, not AIS data
            </div>
          </div>

          <div className="hz-ev" ref={r.ev}>
            <div className="t-label hz-ev-meta" ref={r.evMeta}>31 DEC 2025 · CONTEXT · TIER 1</div>
            <div className="t-card hz-ev-head" ref={r.evHead}>Before the war</div>
            <div className="t-small hz-ev-detail" ref={r.evDetail}>
              Crude at its twelve-month low. The strait is open.
            </div>
          </div>
        </div>

        <div className="hz-rail">
          <div className="hz-price">
            <div className="t-label">WTI crude · $/barrel</div>
            <div className="hz-price-v" ref={r.price}>$57.70</div>
            <div className="t-label hz-price-cap" ref={r.priceCap}>VERIFIED CLOSE · 31 DEC 2025</div>
          </div>
          <div className="panel-onsea hz-read">
            <div className="t-label">{wiring.transits ? 'Through the strait · vessels/day' : 'Through the strait · mb/d'}</div>
            <div className="hz-read-v" ref={r.flow}>{wiring.transits ? '—' : '13.8'}</div>
            <div className="t-small hz-read-cap" ref={r.flowCap}>
              {wiring.transits ? 'IMF PortWatch, AIS-counted transits' : 'Pre-war gross transit'}
            </div>
          </div>
          <div className="panel-onsea hz-read">
            <div className="t-label">War-risk premium</div>
            <div className="hz-read-v" ref={r.risk}>0.25%</div>
            <div className="t-small hz-read-cap" ref={r.riskCap}>Pre-war standard rate</div>
          </div>
          <div className="panel-onsea hz-read">
            <div className="t-label">Tankers drawn waiting</div>
            <div className="hz-read-v" ref={r.queue}>0</div>
            <div className="t-small hz-read-cap">
              Illustrative. No verified queue count exists.
            </div>
          </div>
        </div>
      </div>

      <div className="hz-chartpanel">
        <div className="hz-legend t-label">
          <span><i className="hz-k hz-k-solid" />{wiring.prices ? 'Daily close, FRED' : 'Verified close'}</span>
          {wiring.prices
            ? <span><i className="hz-k hz-k-dash" />Market shut: last close held</span>
            : <span><i className="hz-k hz-k-dash" />Drawn straight</span>}
          <span><i className="hz-k hz-k-pre" />Pre-war close</span>
          {wiring.transits && wiring.baseline !== null && (
            <span className="hz-legend-note">
              Transits: IMF PortWatch, 7-day mean vs pre-war {wiring.baseline.toFixed(0)}/day
              {wiring.lastTransit ? ` · to ${wiring.lastTransit}` : ''}
            </span>
          )}
        </div>
        <div className="hz-chartwrap" ref={chartWrap}>
          <canvas ref={chartCanvas} className="hz-canvas" role="img"
            aria-label="WTI crude price across the simulated period with event marks." />
        </div>

        <div className="hz-controls">
          <button type="button" className="control hz-play" ref={r.play}
            onClick={() => engineRef.current?.toggle()}>PLAY</button>
          <button type="button" className="control hz-replay"
            onClick={() => engineRef.current?.replay()}>REPLAY</button>
          <span className="t-note hz-date" ref={r.date}>31 DEC 2025</span>
          <div className="hz-speeds" role="group" aria-label="Playback speed">
            {[1, 2, 6].map((v, i) => (
              <button key={v} type="button" className="control hz-sp"
                ref={r.sp[i]} data-on={v === 1 ? '1' : '0'}
                onClick={() => engineRef.current?.setSpeed(v)}>{v}×</button>
            ))}
          </div>
        </div>

        <div className="hz-track" ref={track} onPointerDown={onPointerDown}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp} role="slider" tabIndex={0}
          aria-label="Scrub the timeline" aria-valuemin={0} aria-valuemax={wiring.span}>
          <span className="hz-rail-line" aria-hidden />
          <span className="hz-fill" ref={r.fill} aria-hidden />
          <span className="hz-thumb" ref={r.thumb} aria-hidden />
        </div>
      </div>
    </div>
  );
}
