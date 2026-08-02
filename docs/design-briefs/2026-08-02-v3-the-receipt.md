# Design Brief — Oil Dashboard V3.0, "The Receipt"

**Date:** 2026-08-02
**For:** Claude Design
**From:** Claude Code (implementing in `oil-dashboard/frontend`)
**Status:** Backend engine in progress. Design can proceed in parallel — I'm building
working versions of everything here; your job is to raise the ceiling, not unblock me.

---

## 1. What this is

A single-page scrollytelling site that answers one question with data:

> **Why did prices go up in 2026?**

It exists to rebut a specific political claim — *"this is Biden-era inflation that Trump
inherited and fixed"* — using nothing but government data and stated methodology. It will
be shared on Facebook by a non-economist to an audience of non-economists, many of whom
disagree with its conclusion.

**That audience is the whole design problem.** The page has to be immediately legible and
emotionally direct for someone scrolling on a phone, while being rigorous enough that a
hostile reader who digs in finds every number sourced and every assumption stated. Most
data journalism picks one. This has to do both.

## 2. The argument, in order

Eight acts. The design should make the *shape* of the argument feel inevitable.

| # | Act | What it does | Emotional beat |
|---|---|---|---|
| I | **Your Receipt** | User enters miles/week + household size → their own dollar figure since Feb 14 | "This is what it cost *me*" |
| II | **The Break** | Oil price 2025→now; pre-war trend extrapolated; the divergence shaded | "Something happened, on a specific day" |
| III | **The Fingerprint** | Six falsification tests that could fail and don't | "They tried to disprove it" |
| IV | **What A Barrel Actually Costs** | Paper vs. physical; the cost stack that doesn't close | "The headline number hides things" |
| V | **The Timeline** | Named, dated: Biden's term, the handover, each tariff proclamation, Feb 28 | "Here is who did what, when" |
| VI | **The Ledger** | Decomposition as a *bracket*, with the unexplained residual shown | "They're not overclaiming" |
| VII | **What's Next** | Monte Carlo forecast + prediction markets | "Where this goes" |
| VIII | **Show The Math** | Every series ID, coefficient, assumption, CSV download, "what would change our mind" | "I could check this myself" |

**The single most important visual on the page** is in Act III: prices go **up** when the
war escalates and **down** when there's a ceasefire, then up again when strikes resume.
Oil went $57 → $114 → $69.74 → $84.25, and each turn lands on a dated military event.
Inflation doesn't switch off on the day of a ceasefire. If one image gets screenshotted
and shared, it should be this one.

## 3. Existing visual language — inherit or replace, your call

The current site is **"War Room Broadsheet"**: dark editorial newspaper crossed with a
military situation display. Working tokens:

- Background `#04060C`, surface `#0A0E18`, card `#0C1220`
- **Editorial gold `#D4A012`** — all chrome: rules, section numbers, borders
- **Data cyan `#00F0FF`** — all data: chart strokes, numeric values, controls
- War red `#CC2936`, stabilizing green `#5DB075`
- Type: **Instrument Serif** (display) / **Plus Jakarta Sans** (body) / **JetBrains Mono** (data)
- Fixed SVG fractal-noise grain at 0.035 opacity; sharp corners everywhere; asymmetric
  left-aligned section rules; LIVE indicator is red (war urgency), not green

The two-temperature system (warm chrome / cool data) is the strongest idea in it and I'd
keep it. **But V3 is a different thing than V2** — V2 was a dashboard, V3 is an argument.
If the newspaper metaphor is fighting the scrollytelling, say so and propose the
replacement. You have latitude.

One caution: it must not read as *partisan* design. Rally-poster aesthetics would
undercut the content. The register to aim for is **forensic** — an investigation file,
a lab report, an audit. Cold, precise, and therefore credible.

## 4. What I need designed

### 4.1 The Receipt (Act I) — highest priority
The opener and the most-shared element.

- Three inputs: miles/week, household size, region. Must feel like 5 seconds of work, not
  a form. Consider sliders/steppers over text fields.
- Output: one big dollar number (cumulative since Feb 14) + a monthly figure, broken into
  fuel / groceries / everything else.
- Every line traceable — hover or tap reveals the arithmetic
  (`$1.30/gal × 240mi/wk ÷ 26mpg`).
- Assumptions visible and editable inline. **Non-negotiable: this page never shows a
  number whose derivation it won't show.**
- Needs to work beautifully at 375px.

### 4.2 The evidence card (Act III) — six instances
A repeating component that renders a falsification test as **visibly passed or failed**.
Each carries: the hypothesis, the test, the result, the number, and what would have
falsified it. Needs a pass/fail visual state that reads instantly but doesn't look like
a checklist or a marketing "✓ feature" grid. These are the load-bearing rhetoric.

### 4.3 The morphing hero chart (Act II)
One SVG line chart that transitions through four states as the user scrolls:
actual price → fitted pre-war trend + prediction band → divergence shaded → war events
overlaid. Needs to feel like a single continuous object being drawn on, not four charts
cross-fading. Motion spec would help: what eases, what stays anchored, what the scroll
mapping is.

### 4.4 The named timeline (Act V)
Dated events across two administrations, typed as `war` / `tariff` / `policy` / `context`,
with escalation vs. de-escalation direction. Must handle ~13 events across 2021→2026 with
very uneven density (four events in July 2026 alone). Needs to name people and dates
plainly without becoming a campaign graphic.

### 4.5 The ledger bracket (Act VI)
The hardest one. We deliberately do **not** show a tidy 100% stacked bar, because the
honest answer is a range plus a visible unexplained residual. Something like
*"the war explains between 54% and 80% of this"* — with the uncertainty as the point
rather than an apology. If you can make an uncertainty range feel more authoritative than
a false point estimate, that's the whole credibility thesis in one component.

### 4.6 Share cards + OG image
- **1200×630 static OG image** — Facebook doesn't run JS, so this is what the link looks
  like. It's the single highest-leverage asset for reach.
- In-app canvas share cards: any act's headline stat + source attribution, exportable as
  PNG. What circulates must be accurate and self-attributing.

## 5. Constraints

- **React 19 + Vite 8 + Tailwind v4** (`@theme` in CSS, no `tailwind.config.js`)
- **Charts are hand-rolled SVG.** Plotly is being dropped from this page (4.6MB, bad at
  scroll-linked morphing). Design for SVG/CSS primitives.
- **No animation library** — CSS keyframes + `requestAnimationFrame`. Keeps the bundle
  small. If something genuinely needs Framer Motion, make the case.
- **Dark theme is the design.** Not a mode.
- Mobile-first. Assume the median viewer is on a phone, in a Facebook in-app browser.
- Accessibility: this will be read by older relatives. Generous type, real contrast ratios,
  `prefers-reduced-motion` respected for every one of these animations.
- Charts must degrade to something meaningful when data is missing — **the page says
  "no data" rather than inventing a fallback.** (V2 shipped `Math.random()` sparklines and
  invented Reuters headlines; that's exactly what V3 exists to not be.)

## 6. Tone of copy

Forensic, declarative, short sentences. The data is dramatic enough that the writing
shouldn't be. Two calibration examples:

> Oil was falling for twelve months. Then, on February 28, it wasn't.

> We ran six tests that could have proved this wrong.

Avoid: exclamation, "shocking," "they don't want you to know," anything that sounds like
the reader is being recruited rather than shown.

## 7. What to deliver

Whatever's most useful to you — HTML/CSS mockups I can port, a component spec, motion
specs, or a token file. I'll implement against it. If you want to work on one act rather
than all eight, **do the Receipt (4.1) and the evidence card (4.2) first** — those two
carry the most weight and the rest can inherit their language.

## 8. Reference

- `docs/THESIS.md` — every claim the page makes, with tier-graded sourcing and an explicit
  list of what we will *not* claim. Read this before writing any copy.
- `frontend/src/styles/broadsheet.css` and `src/index.css` — existing token systems
  (note: they conflict; V3 collapses them into one)
- `frontend/src/pages/BroadsheetPage.tsx` — the V2 default view, for visual reference
  only. Do not inherit its data handling.
