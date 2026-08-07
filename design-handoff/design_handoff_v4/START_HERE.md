# START HERE

## What this is

A complete port package for the V4 receipt page in
`Samizdat-Publications/oil-tracking-dashboard`. It supersedes the earlier
`design_handoff_trumps_economy/` folder — delete that one.

**The last attempt at this failed in a specific way**: it read the spec as a mood board,
made its own layout and styling decisions, and dropped the parts that carry the argument.
This package is built so that does not happen again. The design is not described here.
It is **supplied**, as running code and literal values.

## The one rule

> **This is a PORT, not an interpretation.**
>
> Where a value exists in this package — a hex code, a font size, an easing curve, a
> coastline array, a bar width — use that value. Do not substitute a nearby one from an
> existing config. Do not round it. Do not "simplify" it. If something looks odd, it is
> probably load-bearing; check `spec/SECTIONS.md`, which says why.

If a decision genuinely is not covered here, that is a bug in this package: ask, don't
improvise.

## Read in this order

1. **This file.**
2. **Open the two prototypes in a browser.** `reference/Trumps Economy - The Bill.dc.html`
   and `reference/HormuzStrait.dc.html` (keep `support.js` beside them). Scroll the whole
   page. **The motion is half the design** — a screenshot cannot show you what a bar
   growing or a line crossing does to the argument. Anything you build that is static
   where the reference moves is wrong, regardless of how it looks.
3. **`reference/screenshots/`** — eight PNGs, one per section, captured with all animations
   forced to their end state. This is your visual target. Diff against these.
4. **`spec/SECTIONS.md`** — section-by-section: layout, literal values, and *why* each
   thing is the way it is.
5. **`DATA-PROVENANCE.md`** — the tier split and the two blockers. Read before wiring any
   chart.
6. **`ACCEPTANCE.md`** — a checkable list. Do not open a PR until it passes.

## What to reuse verbatim

These are not references. They are the implementation. Copy them into the repo and import
them.

| File | Use it for |
|---|---|
| `port/tokens.css` | Every colour, type ramp, spacing value, easing curve. |
| `port/hormuz-engine.js` | The entire §07 simulation: both canvases, the rAF loop, the vessel model, the timeline, the geography. **Do not rewrite the drawing maths.** |
| `port/reveal.js` | The scroll-reveal engine, the counter helper, the stroke-draw helper. |
| `port/v4-data.js` | Every figure, with its provenance flag. |

`hormuz-engine.js` and `reveal.js` are framework-free ES modules with no dependencies.
They work as-is in the repo's React 19 + Vite setup. `hormuz-engine.js` deliberately owns
zero DOM text — it hands you a readout object and you render it.

**Open `port/_smoke-test.html` first.** It mounts the engine with plain DOM in about 60
lines and self-asserts at the top of the page: canvases render, vessels queue during the
closure, provenance flags resolve. It is both proof the module works before you touch it
and the shortest possible worked example of the wiring — including the scrub-tick
generation and the readout fan-out. It should say **PASS**.

## Build order

1. **Resolve the two blockers in `DATA-PROVENANCE.md`.** Three brief-vs-THESIS numeric
   conflicts and ~12 figures cited in-page but absent from `THESIS.md`. Each appears in
   more than one place. Do not silently pick a value.
2. **`port/tokens.css` into the app, and the fonts self-hosted.** Chivo, Chivo Mono,
   Archivo. The prototypes use a CDN; the brief forbids external asset hosts in production.
   Verify the page still looks right before building anything on top.
3. **§07, the strait.** It is the largest piece and the most likely to be got wrong, so do
   it while attention is fresh. Mount `HormuzEngine`, build the surrounding markup as JSX.
4. **The other seven sections**, in page order. Use `Reveal` from `port/reveal.js` for
   every scroll trigger rather than writing per-section observers.
5. **The OG card**, as a real 1200×630 PNG generated at build time.

## The five things the last attempt lost

Stated plainly, because these are what make the page work:

1. **The poster look.** Border radius 0 everywhere. Hard offset shadows with zero blur.
   Halftone dot texture on every section ground. Chivo 900 uppercase at genuinely large
   sizes — the masthead H1 goes to 140px. If it looks like a normal dashboard, it is wrong.
2. **The motion.** Every section reveals on scroll: bars grow, lines draw, counters count.
   Late trigger (58% of viewport). §07 is a live simulation with 26–58 modelled vessels.
3. **The argument structure.** Two choices — the war in the tails, the tariffs in the core
   — and they are **never summed**. §04's "honest part" block is not filler.
4. **The honesty treatments.** Dashed segments between verified closes. Em-dash where no
   figure was published. "Illustrative geometry" on the map. Rows that cut against the
   thesis at full size in §06. These are the reason to trust the page.
5. **The container query.** `container-type: inline-size` on the root. Without it every
   `clamp()` in the design collapses to its minimum and the whole page renders tiny.

## Non-negotiable

- **Zero fabrication.** No `Math.random()` data, no invented figures, no plausible
  placeholders. A previous version of this project shipped random sparklines; that is the
  failure mode being designed against.
- **Every chart carries a plain-English "What this shows" callout** stating the finding,
  not the axes. The page must work if you read only the callouts.
- **Never sum the war effect and the tariff effect.** The Dallas Fed found the SCOTUS
  tariff rollback and the Hormuz shipping-cost increase roughly cancel.
- **§05 leads with long-term unemployment (21.1% → 27.3%)**, never the unemployment rate.
- **§06 keeps its name, "The other side of the coin"**, and no first-person framing.
- **No "what we refuse to claim" section.** Removed on request; the team is writing it.
- **`prefers-reduced-motion` yields a static but COMPLETE page** — every counter at its
  final value, every bar grown, the simulation stepped to a settled end state.
- **60fps on a mid-range phone**, and no simulation work while §07 is off-screen.
- **No label below 11px at 375px wide**, in SVG or canvas.

## Three bugs already paid for

Every one of these cost a full debugging cycle in the prototype. They will recur in JSX.

1. **React restores imperative DOM writes on re-render.** Counter `textContent` and an
   `<input>`'s `value` both silently revert to the JSX seed on any re-render. Use
   `ImperativeText` from `port/reveal.js` and call `.replay()` in an effect with no dep
   array.
2. **`IntersectionObserver` and `ResizeObserver` do not fire in some embedded frames.**
   Both were removed in favour of a self-terminating rAF poll. Keep the fallback if the
   page can ever be iframed.
3. **Verify chart labels by measuring `getBoundingClientRect().width > 0`**, not by
   counting DOM nodes. Zero-width text passes a node count and a `textContent` check while
   rendering nothing at all.

## Where things go

| Concern | File |
|---|---|
| Page composition | `frontend/src/pages/ReceiptPage.tsx` (replace, per the brief) |
| Sections | `frontend/src/v4/sections/*.tsx` |
| Simulation wrapper | `frontend/src/v4/HormuzSimulation.tsx` |
| Simulation engine | `frontend/src/v4/hormuz/engine.js` ← `port/hormuz-engine.js` |
| Reveal helpers | `frontend/src/v4/reveal.js` ← `port/reveal.js` |
| Tokens | `frontend/src/v4/tokens.css` ← `port/tokens.css` |
| Figures | `frontend/src/v4/data.ts` ← `port/v4-data.js` |
| Data hooks | extend `frontend/src/v3/data.ts` — **do not fork the fetch layer** |
| OG card | `frontend/src/og/` → build-time PNG in `frontend/public/` |

Keep the data layer swappable exactly as the brief specifies:

```ts
// src/v4/data.ts
const SOURCE: 'snapshot' | 'api' = 'snapshot';
```

Each hook reads `frontend/public/data-snapshot.json` now and `/api/attribution/<endpoint>`
later, with **identical return types on both paths**.

## If the design conflicts with the data

The data wins, and say so in the PR. If a figure the design shows is not sourceable, render
the "no published figure" state rather than deleting the readout — the absence is part of
the argument.
