# Handoff: Trump's Economy — "The Bill For Two Choices"

## Overview

A single-page, eight-section data feature arguing that the 2026 price and labour-market
deterioration traces to two dated policy choices — the Iran war (28 Feb 2026) and the
tariff regime — rather than to inherited inflation. It replaces the V3 receipt page.

The spine changed from earlier briefs. It is **no longer** "US vs Europe". It is
**two choices, two signatures**: the war shows up in the tails (energy, headline), the
tariffs show up in the core (core-PCE creep). The international comparison survives as
one section (§03), not the frame.

## About the design files

The files in this bundle are **design references created in HTML** — running prototypes
showing intended look and behaviour, not production code to copy directly. The task is to
**recreate them in the repo's existing environment**: React 19, Vite, Tailwind v4,
TanStack Query, hand-rolled SVG charts (Plotly is dropped).

Open both HTML files in a browser before writing any code. **The motion is half the
design** and screenshots do not convey it — the whole page is reveal-on-scroll, and §07 is
a live simulation.

The one exception to "don't copy the code": **the canvas drawing routines in
`HormuzStrait.dc.html` should be ported nearly verbatim** into a ref-based component.
Rebuild the surrounding markup as JSX + Tailwind; do not rewrite the drawing maths.

## Fidelity

**High-fidelity.** Final colours, type, spacing, motion timings and copy. Recreate
pixel-for-pixel using the codebase's patterns. Every hex value, font size and easing curve
in this document is the intended production value.

Two things are explicitly **not** final and are labelled as such in the UI: the coastline
geometry and vessel positions in §07 (illustrative), and any chart path drawn between
verified anchor points (drawn straight, and said to be).

---

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#12100E` | Dark ground, body text on cream, hard offset shadows |
| `paper` | `#F4EDE0` | Cream ground, text on dark |
| `crimson` | `#D91E18` | The war. Negative deltas. Held vessels. Masthead tag |
| `amber` | `#F5A300` | Primary accent, prices, "what this shows" blocks, moving vessels |
| `poster-blue` | `#1E3FBF` | §03 ground, Biden-era marks, tariff events |
| `sea` | `#0A1A24` | §07 ground |
| `sea-deep` | `#061218` | §07 canvas panel |
| `green` | `#1E7F4A` / `#3FA96A` | Strait open / transit normal |
| `amber-dark` | `#B36A00` | Partial / degraded state |
| Muted on dark | `#C9D6DE`, `#9BA9B6`, `#7A8A95`, `#5B6873` | Body, caption, label, axis |
| Muted on cream | `#3D372F`, `#6B6053` | Body, caption |
| Land fill | `#3A3225` → `#26211A` | §07 landmass gradient |
| Land edge | `#8A7B60` | §07 coastline stroke |

Party colours follow the US convention and are **matched for luminance** so neither
dominates a squint test. Every neutral element — axes, gridlines, annotations — is
scrupulously grey or near-black. The US line in §03 is deliberately **amber, not red**;
colouring it red makes the argument look like a team jersey.

### Type

Three families, all Google-hosted in the prototype. **Self-host in production** — the
brief forbids external asset hosts.

| Family | Weights | Use |
|---|---|---|
| **Chivo** | 400 / 600 / 700 / 900 | All display. `900`, uppercase, `letter-spacing:-.03em`, `line-height:.88` |
| **Chivo Mono** | 400 / 500 / 600 / 700 | Labels, kickers, axis values, dates, data readouts |
| **Archivo** | 400 / 500 / 600 / 700 | Body copy only |

Scale is fluid throughout via `clamp()` against a **container query** unit (`cqi`), not
`vw` — the root sets `container-type: inline-size`. Representative ramps:

| Role | Value |
|---|---|
| H1 (masthead) | `clamp(46px, 9.6cqi, 140px)` / `.85` / `-.035em` |
| H2 (section) | `clamp(34px, 6.2cqi, 92px)` / `.88` / `-.03em` |
| Big stat | `clamp(30px, 3.6cqi, 52px)` / `1` / `-.03em` |
| Lead paragraph | `clamp(14.5px, 1.6cqi, 21px)` / `1.42` |
| Body | `clamp(13.5px, 1.44cqi, 18px)` / `1.45` |
| Kicker / label | `clamp(9px, 1.05cqi, 12px)`, `letter-spacing:.11em–.14em`, uppercase |

`text-wrap: pretty` on every paragraph and heading.

### Other

- **Border radius: `0` everywhere.** No rounded corners anywhere in this design.
- **Borders: `3px solid`** for panels, `5px` for the event-card left rule, `1.5px`–`2px`
  for small chips and buttons.
- **Shadows are hard offsets, never blurred**: `clamp(4px,.7cqi,8px) clamp(4px,.7cqi,8px) 0 <colour>`.
- **Halftone ground**: `radial-gradient(rgba(...,.13) .7px, transparent .7px)` at
  `background-size: 5px 5px`. Cream sections use `rgba(18,16,14,.1)`; dark use `rgba(244,237,224,.13)`.
- **Section padding**: `clamp(24px,4cqi,70px) clamp(14px,3.4cqi,56px)`.
- **Grid pattern**: `repeat(auto-fit, minmax(min(100%, <N>px), 1fr))` with
  `gap: clamp(...)`. This is what makes the page responsive without media queries.
- **Touch targets: 44px minimum** on every control.

---

## Screens / Sections

The page is one continuous scroll. `data-screen-label` attributes mark each section in the
prototype.

### 01 Masthead — "The bill for two choices"
- **Ground**: `#12100E`, halftone.
- **Layout**: masthead bar (tag + two mono labels, `border-bottom: 3px solid crimson`) →
  two-column `auto-fit` grid (H1 | lead paragraph + two stat boxes) → the WTI war chart →
  a "what this shows" row.
- **H1**: "The bill for two / choices" — "choices" in crimson with a cream hard text-shadow
  (`clamp(3px,.55cqi,8px)` both axes).
- **Stat boxes**: `3px solid paper`, `clamp(3px,.55cqi,6px)` crimson offset shadow. Values
  count up: `+99%` (crude 2 Jan → 6 Apr) and `$4.20` (gasoline/gal).
- **Chart**: WTI 2026, four verified closes with war bands, event flags, peak callout.
  Two hand-built SVG geometries (see Responsive).

### 02 The shelf
- **Ground**: cream, halftone.
- Three cards (`auto-fit`, min 290px), each `#12100E` with a `clamp(4px,.7cqi,8px)` crimson
  offset shadow. Per card: item name, crimson `+N%` chip, then two bars — Jan 2025 (grey
  `#8A7F6E`, shorter) and Now (amber, taller).
- **Bars share a common $0–$10 scale**, so lengths are comparable across items. Widths are
  therefore literal percentages: beef `55.5% → 68.3%`, coffee `70.2% → 94.6%`,
  gas `32.1% → 42.0%`.
- Grow via `transform: scaleX(0→1)`, `transform-origin: left`,
  `transition: transform .9s/1.05s cubic-bezier(.2,.85,.25,1)`, staggered `130ms` per card
  and `+90ms` for the "now" bar.

### 03 The crossing — "The lines crossed in between"
- **Ground**: `#1E3FBF`, halftone. The only blue section.
- A crossing-slope chart: Oct 2022 (US 7.76 / euro area 10.62) → Jun 2026 (US 3.73 / 2.73).
  **Four real values; the lines literally cross.** A crimson ring marks the crossing point.
- Two flags reveal in sequence: "US 2.86 PTS BELOW EUROPE" (cream on blue) then
  "US 1.00 PT ABOVE EUROPE" (crimson).
- Lines draw via `stroke-dashoffset` over `1.5s cubic-bezier(.3,.85,.3,1)`.

### 04 Two choices, two signatures
- **Ground**: cream.
- Two cards side by side. **The war** (crimson ground, ink offset shadow): three bars scaled
  against gasoline's `+26.7%` as the longest — gasoline `100%`, CPI energy `58.8%`,
  headline `13.9%`. **The tariffs** (ink ground, amber offset shadow): core PCE
  `2.61% (Apr 2025) → 3.42% (May 2026)` and a counting `+0.81 PTS` creep box.
- Below both, an amber "THE HONEST PART" block stating the Dallas Fed finding that the
  SCOTUS tariff rollback and the Hormuz shipping-cost increase roughly cancel, so the two
  effects are **not additive**. This block is load-bearing — do not cut it.

### 05 A frozen labour market
- **Ground**: `#12100E`, halftone.
- Left: two columns — Biden `320,938/mo` (blue, `100%` height) vs Trump II `42,118/mo`
  (crimson, `13.1%` height), plus a `−87%` callout. Columns grow via `scaleY`,
  `transform-origin: bottom`, staggered `350ms`.
- Right: three horizontal bars — long-term unemployed `21.1% → 27.3%`, hiring rate `3.3%`,
  quits `1.9%`.
- **Lead with long-term unemployment, never the unemployment rate.** U-3 went 4.0 → 4.2 and
  U-6 7.5 → 7.9; both are true, unimpressive, and hand the reader a correct rebuttal.
- The footnote states Powell's Dec 2025 observation that payrolls may be **overstated** by
  ~60,000/mo via the birth-death model — a bias that flatters these numbers.

### 06 The other side of the coin
- **Ground**: cream. Four cards, `3px solid ink`, poster-blue offset shadow.
- Eggs `−45%` (avian influenza resolved, not policy), core CPI `2.6%`, median CPI `2.7%`,
  S&P `UP`. Same type size as everything else — this reads as confidence, not concession.
- Card tag is "THE OTHER SIDE". **Do not reintroduce first-person framing** ("against us")
  anywhere in this section; that was an explicit revision.

### 07 The strait — "Everything came through here"
- **Ground**: `#0A1A24`. This is the centrepiece. See its own section below.

### 08 Sources
- Slim strip: sources, the October-2025 CPI hole, and what is not yet wired in.
- **There is deliberately no "what we refuse to claim" section** — the team is writing that
  separately. Do not add one.

---

## §07 in detail — the strait simulation

Ported from a working prototype. `HormuzStrait.dc.html` is self-contained and mounts into
the page as a child component.

### Structure
- **Header**: H2 + tag + "214 DAYS · 31 DEC 2025 → 2 AUG 2026" + lead paragraph.
- **Map panel** (`flex: 3 1 520px`, `3px solid amber`): canvas at
  `height: clamp(230px, 26cqi, 360px)`, a state chip top-left (dot + label), an
  "ILLUSTRATIVE GEOMETRY / VESSEL POSITIONS ARE NOT AIS DATA" note top-right, and an
  **event card** below with date, kind chip, tier, headline and one-line description.
- **Stat rail** (`flex: 1 1 260px`): the amber WTI price block plus three bordered readouts —
  transit mb/d, war-risk premium, tankers drawn waiting.
- **Chart panel**: WTI daily close canvas, then controls (PLAY / REPLAY / date / 1× 2× 6×)
  and a custom 44px-tall pointer-driven scrubber with a tick per event.
- **Callout**, two honesty cards, sources line, reduced-motion note.

### The three data tiers — keep them visually distinct
1. **Verified** (TIER 1, `docs/THESIS.md`): event dates, the WTI closes flagged `exact`,
   the April cost stack, the Platts benchmark change. Solid line, filled anchor dot,
   "VERIFIED CLOSE · <date>".
2. **Cited but outside THESIS.md**: transit mb/d (IEA), war-risk readings (Marsh, Strauss
   Center), the IEA 400Mbbl release, the 28 Feb `$67` (`approx`) and 8 Jul `$73.52`.
   Caption text and opacity mark these down. **See DATA-PROVENANCE.md — these need adding
   to THESIS.md before publication.**
3. **Illustrative**: coastline, vessel positions, queue count. Labelled in-frame.

Carry a `verified | approx | derived | interpolated` flag on **every** point. The caption,
the dash pattern and the decimal precision all derive from it — exact closes print two
decimals, interpolated values print rounded integers.

Stepped readouts (transit, war-risk) are **never interpolated**: they hold their last
published value with an as-of date, and render an em-dash plus "no published figure" when
none exists. **Do not invent a queue count** — none is sourceable at any tier.

### Simulation mechanics
- Vessels are objects on a normalised lane path (`s ∈ 0..1`, `dir ±1`, size class, speed).
  Outbound rides `-0.026` off the lane centre, inbound `+0.026` — the real Traffic
  Separation Scheme.
- When flow drops below `0.97` of baseline, vessels that have not yet passed midpoint lose
  their `pass` flag, queue up against a spacing limit, and render crimson.
- Reopening grants passage probabilistically (`ff * dt * 2.4`) so the queue **drains as a
  surge**, not instantly.
- Moving vessels get a gradient wake; hulls are drawn with bow curve, deck line, aft
  superstructure and (above 13px) bridge windows.
- The static map layer is cached to an **offscreen canvas keyed on size** and blitted each
  frame. Only the gate glow, particles and vessels redraw.
- A `×3.5` inset magnifies the narrows, drawn only when the map is ≥470px wide.

### Performance — this is why the earlier attempt was rejected
One rAF loop, guarded three ways:
1. **Never starts twice.** `startLoop()` returns if a frame is already queued.
2. **No work off-screen.** Every 8th frame it re-checks the map's `getBoundingClientRect()`;
   the body of the loop is skipped entirely when the section is outside
   `[-220px, viewport + 220px]`.
3. **Repaints only when the clock moved** (`this.dirty`).

`day` is an **instance field, never React state**. All text is written imperatively through
refs with a cache that skips no-op `textContent` writes. In the target codebase: keep `day`
in a `useRef`, and do not put it in a hook that triggers render.

⚠️ **`ResizeObserver` and `IntersectionObserver` are unreliable in embedded preview frames**
and both were removed. Canvas size is re-measured on the same 8-frame interval and refit
only when it actually changed. In a normal browser page you may use the real observers, but
if the page is ever iframed, keep the polling fallback.

### Playback
- `1×` = **12 days/second** (the default). `2×` = 24, `6×` = 72. The active button must be
  highlighted on mount, not only after a click.
- Autoplay arms **once, when the map scrolls to 60% of viewport height** — never on load.
- `autoLoop` holds `1.1s` at the end, then restarts.
- The scrubber is pointer-event based with `setPointerCapture`, so mouse, touch and pen all
  work. `touch-action: none` on the track.

---

## Interactions & behaviour

### Scroll reveals
Every section animates once, on scroll, and never re-triggers. The trigger fires when the
element's top passes **58% of viewport height** — deliberately late; an earlier threshold
made animations finish before the reader arrived.

| Element | Motion |
|---|---|
| Bars | `scaleX`/`scaleY` `0→1`, `cubic-bezier(.2,.85,.25,1)`, `.9–1.1s`, staggered 130–350ms |
| Chart lines | `stroke-dashoffset` `L→0`, `1.5s cubic-bezier(.3,.85,.3,1)` |
| Annotation flags | opacity, `.5–.6s`, sequenced after their line |
| Counters | `1 - (1-t)³` ease over `1.4–1.6s` |
| Ticker | `transform: translateX(0 → -50%)`, `42s linear infinite`, content duplicated |

### `prefers-reduced-motion: reduce`
Jumps to a **complete** end state — not a shortened animation. All counters at final value,
all bars grown, all flags visible, the simulation stepped forward 260 frames to a settled
state with a visible note that the scrubber still works. If an effect cannot degrade this
way, do not ship it.

### Two React pitfalls this design already hit
Both cost a full debugging cycle; they will recur in JSX.

1. **React restores imperative DOM writes on re-render.** Counter values written via
   `textContent` and a range input's `value` were both reset to their seed markup whenever
   anything re-rendered. Every imperatively-written value must be re-applied after render
   (the prototype keeps a `Map` of ref → last value and replays it in `componentDidUpdate`).
2. **A `{{ }}` hole inside an SVG `<text>` inside a loop renders zero-width text** in the
   prototype's template engine. All axis and category labels are therefore unrolled as
   literal elements. This constraint disappears in JSX — but **verify labels by measuring
   `getBoundingClientRect().width > 0`, not by counting DOM nodes.**

---

## Responsive behaviour

Mobile-first. The page has **no media queries** — `auto-fit` grids and `cqi` type handle
everything except the charts.

**The charts are the exception, and it matters.** A `1200×470` viewBox scaled into a 375px
phone puts 17px labels at ~5px. So the two SVG charts each ship **two hand-built
geometries** — landscape `1200×470` and portrait `620×560` / `620×580` — swapped at a
**760px container width**, measured synchronously on mount and then polled. Both have
independently positioned labels and annotation flags.

The strait canvas instead keeps one geometry and drops detail below 470px (inset, port
labels, TSS caption).

In the target codebase you may replace the dual-geometry approach with a proper responsive
scale, **provided no label ever renders below 11px**. That is the requirement; the two
geometries are just how the prototype met it.

---

## State

| State | Where | Notes |
|---|---|---|
| `narrow` (bool) | render-affecting | Chart geometry swap at 760px |
| `day` (0–214) | **ref, not state** | Simulation clock |
| `playing`, `speed`, `scrubbing`, `armed` | refs | Playback |
| `vessels[]`, `parts[]` | ref | Simulation entities, mutated per frame |
| Reveal-fired flags | refs | One-shot per section |

Data fetching: extend `frontend/src/v3/data.ts` — **do not fork the fetch layer.** Endpoints
in brief §7. See `v4-data.js` in this bundle for the figure set with provenance and the
recorded brief-vs-THESIS conflicts.

## Assets

None. No images, no icon files. Every mark is CSS, SVG or canvas. The three fonts are the
only external dependency and must be self-hosted.

## Files in this bundle

| File | What it is |
|---|---|
| `Trumps Economy - The Bill.dc.html` | The full eight-section page. Open in a browser. |
| `HormuzStrait.dc.html` | §07, standalone. Opens on its own too. |
| `support.js` | Runtime the two HTML files need in order to run locally. |
| `v4-data.js` | Every figure with provenance, plus `CONFLICTS` and `TODO_MISSING`. |
| `DATA-PROVENANCE.md` | Tier split, the figures needing THESIS.md entries, open conflicts. |
| `CLAUDE_CODE_PROMPT.md` | Build order and non-negotiables. Read after this file. |

---

## Acceptance checklist

- [ ] All eight sections present, in order, with `data-screen-label` preserved.
- [ ] Every chart carries a plain-English "What this shows" line stating the **finding**,
      not the axes. The page works if you read only the callouts.
- [ ] No number on screen that the repo cannot cite. No `Math.random()`. No placeholder data.
- [ ] Rows that cut against the thesis (§06) render at the same type size as everything else.
- [ ] §04's "honest part" block present; the war and tariff effects are never summed.
- [ ] Long-term unemployment leads §05; the unemployment rate does not.
- [ ] Simulation holds 60fps on a mid-range phone; no React re-render inside the rAF loop.
- [ ] Simulation does no work while off-screen; verify by profiling with §07 scrolled away.
- [ ] `1×` = 12 days/second, active speed highlighted on mount.
- [ ] Scrubber works with mouse, touch and pen; position survives a re-render.
- [ ] `prefers-reduced-motion` gives a complete static page.
- [ ] No SVG or canvas label renders below 11px at 375px wide.
- [ ] Map legible at 375px with inset and port labels dropped.
- [ ] Every 44px touch target met.
- [ ] Fonts self-hosted; no external asset hosts.
- [ ] Border radius is 0 and shadows are hard offsets throughout.
- [ ] Illustrative layers (coastline, vessels, queue) still carry their in-frame labels.
