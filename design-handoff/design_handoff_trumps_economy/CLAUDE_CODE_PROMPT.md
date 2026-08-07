# Instructions for Claude Code

You are implementing the V4 redesign of the receipt page in
`Samizdat-Publications/oil-tracking-dashboard`. Read `README.md` in this folder first, then
`docs/THESIS.md` and `docs/design-briefs/2026-08-03-v4-economic-decline.md` in the repo.
Ignore the three older briefs in that folder.

## What you have

Two HTML prototypes that run in a browser. **Open both before writing code** — the motion is
half the design and screenshots do not convey it.

- `Trumps Economy - The Bill.dc.html` — the complete page, all eight sections, final copy,
  final motion.
- `HormuzStrait.dc.html` — §07 standalone: 214-day timeline, vessel simulation, transit /
  war-risk / price readouts, 13 annotated milestones, scrubber, honesty treatments.

`support.js` must sit beside them for either to open locally.

These are **design references**, not code to ship. Recreate them in the existing stack:
React 19, Vite, Tailwind v4, TanStack Query, hand-rolled SVG charts. **One exception:** port
the canvas drawing routines in `HormuzStrait.dc.html` nearly verbatim into a ref-based
component — the coastline data, lane path, hull geometry and queue logic are tuned. Rebuild
the markup around them as JSX + Tailwind.

## Do this, in order

1. **Read `DATA-PROVENANCE.md` and resolve the two blockers before building charts.** There
   are three brief-vs-THESIS numeric conflicts and about eight figures in the simulation that
   are cited in-page but absent from `THESIS.md`. Both need a decision from the team. Do not
   silently pick a value — every one of these appears in more than one place.

2. **Build the strait simulation first**, as `frontend/src/v4/HormuzSimulation.tsx` plus a
   `useHormuzTimeline` hook. Start from the anchors exactly as in the prototype so the
   component is reviewable before the data layer lands. One canvas for the map, one for the
   chart, one rAF loop, text written imperatively through refs. Cache the static map layer to
   an offscreen canvas keyed on size. **Do not put `day` in React state.**

3. **Wire the real data.** `/api/attribution/event-study` and the `DCOILWTICO` series for
   price; `backend/data/war_milestones.json` for events. Carry a
   `verified | approx | derived | interpolated` flag on every point — caption text, dash
   pattern and decimal precision all derive from it. Transit and war-risk readouts are
   stepped values with as-of dates, **never interpolated**. If a figure is not published,
   render the em-dash and the "no published figure" caption. **Do not invent a queue count.**

4. **Then the rest of the page**, in the order it appears: masthead + WTI war chart, the
   shelf, the crossing, two choices, work, the other side of the coin, sources. Every chart
   gets its own "What this shows" line. Ask before adding any section or copy not in the
   brief.

5. **Generate the OG card as a real 1200×630 PNG** at build time (Playwright screenshot of a
   dedicated `/og` route, or `satori`) and write it to `frontend/public/`. Facebook will not
   run your JS, and it renders the card ~158px wide in-feed, so a screenshot of the hero is
   illegible. `og:image` must be an absolute URL. Re-scrape after any deploy that changes the
   headline figure.

## Non-negotiable

- **Zero fabrication.** No `Math.random()` sparklines, no invented headlines, no
  plausible-looking placeholders. A previous version of this project shipped the first two;
  that is the failure mode being designed against.
- **Every chart carries a plain-English "What this shows" callout** stating the finding, not
  the axes. The page must work if you read only the callouts.
- **Rows that cut against the thesis stay visible**, at the same type size as everything else
  — eggs down 45% because avian influenza resolved, core CPI 2.6%, median 2.7%, the S&P up.
- **Never sum the war effect and the tariff effect.** §04's "honest part" block states the
  Dallas Fed finding that the SCOTUS tariff rollback and the Hormuz shipping-cost increase
  roughly cancel. The headline spike is the war; the tariffs are the core creep. Keep them
  in separate frames.
- **Lead §05 with long-term unemployment (21.1% → 27.3%), never the unemployment rate.**
  U-3 4.0 → 4.2 and U-6 7.5 → 7.9 are true, unimpressive, and hand over a correct rebuttal.
- **No "what we refuse to claim" section.** It was removed on request; the team is writing it
  separately. Do not reinstate it.
- **No first-person framing in §06** — the section is "The other side of the coin", not
  "what cuts against us".
- **`prefers-reduced-motion` yields a static but complete version.** If an effect cannot
  degrade that way, do not ship it.
- **60fps on a mid-range phone.** No React re-render inside the animation loop, and the
  simulation must do no work while off-screen.
- **No label below 11px at 375px wide**, in SVG or canvas.
- **Self-host Chivo, Chivo Mono and Archivo.** The prototypes use a CDN; the brief forbids
  external asset hosts in production.
- **Border radius 0, shadows hard offsets.** No blur anywhere. Mobile-first, 44px targets.

## Three bugs the prototype hit — you will hit them too in JSX

1. **React restores imperative DOM writes on re-render.** Counter `textContent` and the
   scrubber's `value` both silently reset to their seed markup on any re-render. Keep a
   `Map` of ref → last written value and replay it after render.
2. **`ResizeObserver` and `IntersectionObserver` do not fire in some embedded frames.** Both
   were removed in favour of measuring synchronously on mount and polling on an 8-frame
   interval. Real observers are fine in a normal page — but if this is ever iframed, keep a
   polling fallback and seed the first measurement synchronously.
3. **Verify chart labels by measuring `getBoundingClientRect().width > 0`, not by counting
   DOM nodes.** Zero-width text passes a node count and a `textContent` check while
   rendering nothing.

## Where things go

| Concern | File |
|---|---|
| Page composition | `frontend/src/pages/ReceiptPage.tsx` (replace, per the brief) |
| Section components | `frontend/src/v4/sections/*.tsx` |
| Simulation component | `frontend/src/v4/HormuzSimulation.tsx` |
| Canvas drawing helpers | `frontend/src/v4/hormuz/{map,ships,chart}.ts` |
| Timeline / anchors / flags | `frontend/src/v4/hormuz/timeline.ts` |
| Figures + provenance | `frontend/src/v4/data.ts` (port `v4-data.js` from this bundle) |
| Data hooks | extend `frontend/src/v3/data.ts` — do not fork the fetch layer |
| OG card route | `frontend/src/og/` + build-time render to `frontend/public/og-card.png` |

Keep the data layer swappable exactly as the brief specifies:

```ts
// src/v4/data.ts
const SOURCE: 'snapshot' | 'api' = 'snapshot';
```

Each hook reads `frontend/public/data-snapshot.json` now and `/api/attribution/<endpoint>`
later, with **identical return types on both paths**. That file was not on `main` when this
design was made, so every figure came from the brief and `THESIS.md` — reconcile against the
snapshot as soon as it lands.

## Definition of done

Work through the acceptance checklist at the end of `README.md`. In addition: the scrubber
must be usable with mouse, touch and pen; the map must stay legible at 375px wide with the
inset and port labels dropped; profiling with §07 scrolled off screen must show no
simulation work; and nothing on screen may state a number the repo cannot cite.

## If something in the design conflicts with the data

The data wins, and say so in the PR. If a figure the design shows is not sourceable, render
the "no published figure" state rather than removing the readout — the absence is part of the
argument.

## What is deliberately unfinished

- **The monthly CPI series.** §03 plots four verified values (Oct 2022 and Jun 2026) because
  no monthly US-vs-peer series was available. It is designed to accept one without a redesign:
  same two lines, same crossing, more x points. Sources and the three landmines (the missing
  October 2025 CPI, the frozen Eurostat code, the absent post-2024 harmonised US series) are
  in `DATA-PROVENANCE.md`.
- **Transit volumes.** IMF PortWatch is free and unwired. Wiring it turns the illustrative
  vessel layer into a real series — at which point the in-frame "NOT AIS DATA" label should
  change, and not before.
- **The coastline** is schematic, drawn to place the chokepoint correctly. It carries a
  caveat. Ground it in real coastline data or keep the caveat; do not quietly drop the label.
- **Peer countries beyond the euro area and France**, and point estimates for the S&P and
  initial claims in §06.
