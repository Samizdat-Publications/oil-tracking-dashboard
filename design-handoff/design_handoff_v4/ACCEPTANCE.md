# Acceptance

Do not open the PR until this passes. Check against `reference/screenshots/` and the two
running prototypes, not against memory of them.

## Look — the poster system

- [ ] `border-radius` is `0` on every element. Grep the diff for `rounded`, `border-radius`
      and any radius token; there should be no hits.
- [ ] Every shadow is a hard offset with **zero blur**. Grep for `blur`, `shadow-md`,
      `shadow-lg` — no hits.
- [ ] Every full-width section ground carries the halftone dot texture (5px grid).
- [ ] Root element has `container-type: inline-size` and type scales with `cqi`, not `vw`.
      Resize a desktop window: type should scale smoothly, not step at breakpoints.
- [ ] Masthead H1 reaches ~140px at desktop width. If it caps around 48px, the container
      query is missing.
- [ ] Fonts are Chivo (display), Chivo Mono (labels), Archivo (body) — **self-hosted**, no
      CDN link in the built output.
- [ ] The "choices" text-shadow in the masthead is a hard cream offset, not a glow.
- [ ] §03 is the only blue-ground section. §07 is the only sea-ground section.
- [ ] The US line in §03 is **amber**, not red.

## Motion

- [ ] Every section animates on scroll. Nothing is static that moves in the reference.
- [ ] Reveals fire when the element's top passes **58% of viewport height** — not when it
      first enters the viewport. Scroll slowly and check you can watch each one happen.
- [ ] Each reveal fires **once** and never re-triggers on scroll back.
- [ ] Bars use `cubic-bezier(.2,.85,.25,1)`; stroke draws use `cubic-bezier(.3,.85,.3,1)`.
- [ ] §03's sequence is: both lines draw → left flag (+900ms) → crossing ring (+1500ms) →
      right flag (+1750ms).
- [ ] Counters land on exactly: `+99%`, `$4.20`, `+0.81 PTS`, `320,938`, `42,118`.
- [ ] The masthead ticker scrolls continuously with no visible seam.

## §07 simulation

- [ ] Autoplay arms **once**, when the map reaches 60% of viewport height. Never on load.
- [ ] `1×` = 12 days/second, and `1×` is highlighted **on mount**.
- [ ] Vessels queue behind the gate when the strait closes, and drain as a **surge**, not
      instantly, when it reopens.
- [ ] Held vessels render crimson, moving vessels amber with a wake.
- [ ] The `×3.5` inset appears at ≥470px and is dropped below it.
- [ ] The event card flashes only when the event actually changes.
- [ ] Scrubber works with mouse, touch and pen. Its position survives a re-render.
- [ ] Scrub tick marks are generated from the event ledger, not hard-coded percentages.
- [ ] Price caption switches correctly between verified / approx / derived / between-closes,
      and dims for anything but a verified close.
- [ ] Exact closes print 2 decimals; interpolated values print rounded integers.

## Performance

- [ ] Profile with §07 **scrolled off screen**: the simulation must do no work at all.
- [ ] Profile with §07 **visible**: 60fps on a mid-range phone.
- [ ] No React re-render inside the animation loop. Put a `console.count` in the component
      body and confirm it does not climb while the simulation plays.
- [ ] The static map layer is drawn once per size, not per frame.

## Responsive

- [ ] No SVG or canvas label renders below **11px** at 375px wide. Measure, don't eyeball.
- [ ] Charts remain legible at 375px — via the dual geometries or an equivalent.
- [ ] The map is legible at 375px with the inset and port labels dropped.
- [ ] Every interactive control is at least 44px on its smallest axis.
- [ ] No horizontal scroll at any width from 320px to 2560px.

## Reduced motion

- [ ] `prefers-reduced-motion: reduce` gives a **complete** page: all counters final, all
      bars grown, all flags visible, the simulation at a settled end state.
- [ ] The scrubber still works, and a note says so.

## Content and honesty

- [ ] All eight sections present, in order, with `data-screen-label` preserved.
- [ ] Every chart has a plain-English "What this shows" callout stating the **finding**.
      Read only the callouts top to bottom — the argument should hold.
- [ ] No number on screen that the repo cannot cite. No `Math.random()`. No placeholders.
- [ ] Segments between verified closes are visibly dashed and labelled as drawn straight.
- [ ] Missing figures render as an em-dash plus "no published figure" — never as zero,
      never interpolated, never omitted.
- [ ] The map keeps its "ILLUSTRATIVE GEOMETRY / NOT AIS DATA" label.
- [ ] The queue readout is labelled as the drawn fleet, not as data.
- [ ] §04's "honest part" block is present and the two effects are never summed.
- [ ] §05 leads with long-term unemployment.
- [ ] §06 is "The other side of the coin", at full type size, with no first-person framing.
- [ ] There is no "what we refuse to claim" section.
- [ ] The October 2025 CPI gap renders as a gap.

## Social

- [ ] `og:image` is a real 1200×630 PNG generated at build time, at an **absolute** URL.
- [ ] It is legible at ~158px wide — the size Facebook actually renders it in-feed.
- [ ] `og:title`, `og:description`, `twitter:card=summary_large_image` all set.
- [ ] Re-scrape after any deploy that changes the headline figure.
