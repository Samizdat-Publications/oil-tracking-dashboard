# Handoff — "The bill Trump handed you" (V5), for a fresh session

**Read first:** `github.md` (repo pointers), then the brief in the repo at
`docs/design-briefs/2026-09-05-v5-the-bill.md`, then `docs/THESIS.md`. Both are the source of truth for
every number and every claim. Do not invent a figure. Every value on the page comes from
`frontend/public/data-snapshot.json` (a copy is in this project) — the derived series used by the charts are in
`data/series.json` and `data/crude-2026.json`.

## What the user wants (in their words, condensed)
- A one-time-read, scroll-driven story that leaves the reader **furious at the personal cost** — war + tariffs → their receipt — built on real numbers a hostile reader cannot dismiss.
- "Bleeding edge" motion and presentation: **stunning animation blocks of the quality of the Hormuz strait simulation**, not charts with flags on polylines.
- **Every chart gets its own visual idea**, smooth geometry, layered fills, and must be *looked at* before shipping. They explicitly said: stop reskinning; take full creative license; you are the artist, creative director, analyst and PR person.
- Light (cream) ground as the default; ink only as punctuation. V4 palette: ink `#12100E`, cream `#F4EDE0`, crimson `#D91E18`, amber `#F5A300`, poster blue `#1E3FBF`, sea `#0A1A24`. No halftone, no offset shadows, zero radius.
- Red only for **his dated acts**; blue for ceasefires/the court/"against us"; amber = measured.
- Consumer-facing copy only: no snapshot keys, no "mounts here", no internal notes.
- Small type must be legible: mono floor 12px, tight tracking; body 19–22px.
- The receipt/tally concept is welcome **if** it earns its place; the black rail was called "background noise" — it is now a cream receipt. Consider whether a fixed rail is right at all.
- Chapter 04 (tariffs / core inflation) chart "needs to go and be completely rethought".

## What exists
- `V5 The Bill - prototype.dc.html` — the working prototype, 13 chapters (00–12), scroll-scrubbed charts, count-ups, a cream stat-box rail (desktop) / 44px top strip (mobile), reduced-motion safe. Logic class holds a small chart engine (`mk()` → curve/between/bars/flag/head helpers) and a `progressAll()` scroll driver.
- `V5 The Bill.dc.html`, `V5 Tokens.dc.html` — superseded early artboards (ink/amber direction the user rejected). Safe to delete.
- `docs/screenshots/*.png` — the current live site (V4) for reference; `uploads/*.png` — the user's screenshots of defects.

## What works (keep)
- Chapter 02 strait simulation: illustrative map, ships flow at that day's PortWatch count, crimson barrier when shut, readouts track the scrubbed day. **This is the quality bar.**
- Chapter 03 till receipt printing line by line; chapter 08 hanging gold bars; chapter 11 shareable bill; the honest rows (Against us) at full size.
- Copy voice: names him, names you, active verbs, claims stay inside the data.

## What does not work (the user's own list)
- 04 core-inflation chart: rethink from scratch (idea seeds below).
- 05 jobs chart: good idea, but labels and readouts collide at the right end.
- Spacing: inconsistent margins, overlaps between legends/captions/flags; "ordered" stamps covered text (removed).
- Generic chart vocabulary repeated across chapters (line + flags + pen readout). Each chapter needs its own device.
- The page has never been reviewed end to end at 1400 and 390 before publishing. Do that every round.

## Direction memo — one idea per chapter
00 Masthead: title + counting total; keep. Consider a single full-bleed number screen before anything else.
01 Crude: the 167 daily closes with hatched "strait closed" bands is right; make the event flags a rail above the plot, not in it.
02 Strait: promote the simulation to full-bleed hero; the timeline is secondary.
03 Receipt: paper prints line by line; total stamps at the end. Keep.
04 Tariffs: **new idea needed.** Candidates: (a) a "two thermometers" screen — headline vs core as two vertical gauges filling as you scroll, the core one climbing off the 2% line; (b) a single core-PCE staircase (monthly steps 2.61 → 3.34) with each of his three tariff dates as a riser; (c) a "what's in the basket" grid where goods tiles tint as pass-through arrives. Whatever it is, it must read in three seconds: *his tariffs live in the core*.
05 Jobs: 68 monthly columns is right; make the handover a physical break (ground colour changes at Jan 2025), put the mean lines and readout in a right gutter.
06 Money: replace the yield line with a household ledger: car loan / card / mortgage payment at handover vs now, counting up.
07 Trade: a literal pipeline; flow thins as you scroll from strait → supply → diesel → containers → airfares → receipt.
08 Gold: hanging bars stay; add a vault-count block grid (5,919 → 5,760) that empties as you scroll.
09 Europe: two smooth lines with the US-excess band; keep, tidy the right gutter.
10 Against us: keep.
11 Bill: keep; it is also the OG image.
12 Check our work: keep.

## Technical notes learned the hard way
- Large tool writes get interrupted; build in **one chapter per write** and keep markers (`<!--CHxx-->`) for the next append. `run_script` with `replaceText` is the safe way to make many edits at once.
- `body{overflow-x:hidden}` turns body into the scroll container and breaks `window.scroll`/`view()` timelines; `overflow-x:clip` on `html` also kills scrolling. Clip per `<section>` instead.
- CSS `animation-timeline:view()` ranges must complete early: use `entry 0% entry 100%`; anything keyed to `cover` finishes too late.
- Scroll-scrubbed charts are driven in JS (`progressAll()` sets per-chart progress 0–1 from `getBoundingClientRect`); chart geometry is computed in `renderVals()` and exposed as path strings / positioned labels. Hide pen readouts until progress > 0.02; clamp them inside the container; keep readouts in a right gutter, not on the line ends.
- `sc-for` over label arrays with `{{ }}` in `style` is fine for runtime data; the first render logs harmless "never resolved" warnings until `data/series.json` loads.
- Fonts: Archivo variable (wdth 62–125, wght 100–900) + IBM Plex Mono via Google Fonts for the prototype; production must self-host.
- Verify at 1400 and 390 with screenshots of **every** chapter before calling `ready_for_verification`. The verifier catches overlaps; it does not catch bad ideas.

## Open questions for the user
- Fixed rail (cream receipt) vs no rail with a recap at each chapter?
- Title: "The bill Trump handed you" (recommended) vs "He did this." vs "Trump's war. Trump's tariffs. Your bill."
- How much of the Hormuz engine from the repo (`frontend/src/v4/hormuz/engine.js`) should be embedded vs the illustrative SVG now in the prototype?
