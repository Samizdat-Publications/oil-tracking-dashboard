# Sections — literal spec

One entry per section, in page order. Each gives the layout, the literal values, and — the
part that matters — **why** it is that way. Anything marked ⚠ is something a reasonable
developer would "clean up", and must not.

Reference screenshots are in `reference/screenshots/`, numbered to match.

Throughout: `border-radius: 0`, shadows are hard offsets with **zero blur**, section
padding is `clamp(24px,4cqi,70px) clamp(14px,3.4cqi,56px)`, and every repeating group is
`repeat(auto-fit, minmax(min(100%, Npx), 1fr))` — **there is not a single media query in
this design.**

⚠ The root element must carry `container-type: inline-size`. Every `clamp()` is in `cqi`
units. Without the container, they all collapse to their minimum.

---

## 01 — Masthead · "The bill for two choices"

**Ground** `#12100E` + `halftone-dark`.

**Masthead bar** — flex row, `border-bottom: 3px solid #D91E18`, `padding-bottom:
clamp(11px,1.9cqi,21px)`:
- `TRUMP'S ECONOMY` — crimson chip, cream text, `.t-label`, `padding: 6px 9px`
- `A LEDGER · THROUGH JULY 2026` — `#C9BFAF` mono
- spacer
- `EVERY FIGURE SOURCED` — amber mono, right

**Hero grid** — `auto-fit, minmax(min(100%,320px), 1fr)`, `gap: clamp(14px,2.6cqi,44px)`,
`align-items: end`.

Left: H1, three lines, `clamp(46px,9.6cqi,140px)/.85/-.035em`, uppercase.
```
The bill
for two
choices        ← crimson, with a CREAM hard text-shadow offset
               clamp(3px,.55cqi,8px) on both axes
```
⚠ The text-shadow is the poster device that carries the whole look. It is not a glow and
it has no blur.

Right: lead paragraph (`.t-lead`, `#E6DDCE`, `max-width: 44ch`) over two stat boxes in an
`auto-fit minmax(min(100%,150px),1fr)` grid. Each box: `3px solid #F4EDE0`,
`clamp(3px,.55cqi,6px)` crimson offset shadow.

| Box | Label | Value | Counts to |
|---|---|---|---|
| 1 | `CRUDE, 2 JAN → 6 APR` | `+99%` | 99, 1400ms |
| 2 | `GASOLINE / GALLON` | `$4.20` | 4.20, 1600ms, 2dp |

Both fire on load — they are above the fold.

**The WTI war chart.** Heading row: `WEST TEXAS INTERMEDIATE, 2026` (`.t-h2`-ish, 900,
`clamp(15px,1.8cqi,24px)`) + `Prices tracked the war in both directions.` in `#A99C89`.

Then the chart itself — see **Charts** at the bottom of this file for the dual-geometry
rule. Landscape viewBox `0 0 1200 470`:
- Two hatched war bands (`pattern` at 45°, crimson at .14/.32 opacity): x 380.6→941.2, and
  x 1043.2→1140.
- Baseline at y=400, dashed gridlines at $57 (y=320.4) and $114 (y=57.7).
- Price path: `M90 320.4 L569.1 57.7 L1007.5 262.4 L1140 195.3`, amber, `stroke-width: 7`,
  round caps. Area fill beneath at 50%→0 amber.
- Three event flags, **each in its own horizontal lane** ⚠ — they were overlapping when
  they shared one:
  - `28 FEB · STRIKE · HORMUZ CLOSES` — crimson box at x=96, y=36, rule at x=380.6
  - `18 JUN · CEASEFIRE` — blue box at x=690, y=300, with a tick joining it to its rule at
    x=941.2
  - `8 JUL · STRIKES RESUME` — crimson box at x=906, y=420, rule at x=1043.2
- Peak callout: amber box at x=590, y=30, `$114.01` at 29px.
- End dots: `$69.74` blue at (1007.5, 262.4), `$84.25` crimson at (1140, 195.3).

**Footer row** — `auto-fit minmax(min(100%,270px),1fr)`, `border-top: 3px solid #F5A300`:
- "WHAT THIS SHOWS" amber chip + the round-trip paragraph.
- A `.t-note` block stating the path between the four verified closes is drawn straight.

---

## 02 — The shelf

**Ground** cream + `halftone-light`.

Heading row: `THE SHELF` (`.t-h2`) + `JANUARY 2025 → NOW · ACTUAL DOLLARS` mono in
`#6B6053`.

Three cards, `auto-fit minmax(min(100%,290px),1fr)`. Each `.panel-dark` (ink ground, crimson
offset shadow), containing:
- Row: item name (`.t-card`) + crimson `+N%` chip.
- Two bars stacked, `gap: clamp(8px,1.1cqi,13px)`:
  - `JAN 2025` — track `rgba(244,237,224,.12)`, height `clamp(16px,1.9cqi,24px)`, fill
    `#8A7F6E`
  - `NOW` — height `clamp(22px,2.7cqi,34px)` (taller ⚠), fill `#F5A300`

| Item | From | To | Chip | Bar widths |
|---|---|---|---|---|
| Ground beef, 1 lb | $5.55 | $6.83 | +23% | 55.5% → 68.3% |
| Coffee, 1 lb | $7.02 | $9.46 | +35% | 70.2% → 94.6% |
| Gasoline, 1 gal | $3.21 | $4.20 | +31% | 32.1% → 42.0% |

⚠ **The widths are literal percentages on a shared $0–$10 scale**, not per-card normalised.
That is what makes bar lengths comparable across items — coffee's bar is visibly longer
than beef's because coffee costs more. Normalising per card destroys the comparison and is
the obvious "fix" to make.

Motion: `scaleX(0→1)`, origin left, `.9s`/`1.05s` `cubic-bezier(.2,.85,.25,1)`, staggered
130ms per card, the "now" bar a further 90ms behind its "was".

Footer: "WHAT THIS SHOWS" (ink chip, amber text) + the beef/coffee sentence.

⚠ There is **no seasonal-adjustment note** on this section. It was deliberately removed.
Do not reinstate it.

---

## 03 — The crossing · "The lines crossed in between"

**Ground** `#1E3FBF` + `halftone-dark`. The only blue section in the design; it marks the
one place the argument steps outside the US.

Heading grid: H1-style heading (`The lines / crossed in / between`, "between" in amber) +
lead paragraph in `#DCE4FF`.

Chart, landscape viewBox `0 0 1200 470`. Four real values, two lines, and **they cross**:

| | Oct 2022 | Jun 2026 |
|---|---|---|
| Euro area | 10.62% (y=85.3) | 2.73% (y=311.7) |
| **US** | 7.76% (y=167.3) | 3.73% (y=283) |

- Euro line `#BFD0FF`, `stroke-width: 6`. US line **`#F5A300`, `stroke-width: 8`** ⚠ — the
  US line is amber, not red. Colouring it red makes the argument look like a team jersey
  and costs the page its credibility with anyone not already convinced.
- Crossing marker at (782.9, 253): crimson ring `r=22 stroke-width 4` + solid `r=6` dot.
- Two flags, revealed in sequence: `US 2.86 PTS BELOW EUROPE` (cream on blue, x=252 y=40)
  then `US 1.00 PT ABOVE EUROPE` (crimson, x=626 y=330).

Motion: both lines draw together via `stroke-dashoffset` over `1.5s
cubic-bezier(.3,.85,.3,1)`; left flag at +900ms, the crossing ring at +1500ms, right flag
at +1750ms. ⚠ The sequencing is the point — the reader sees "US was doing better", then the
crossing, then "US is now worse".

Footer note states that only two months are verified and the path between is drawn straight.

---

## 04 — Two choices, two signatures

**Ground** cream.

H2 + a lead paragraph: the war is in the tails, the tariffs are in the core.

Two cards, `auto-fit minmax(min(100%,320px),1fr)`, `gap: clamp(14px,2.2cqi,30px)`:

**The war** — crimson ground, `clamp(5px,.8cqi,9px)` ink offset shadow.
Kicker `CHOICE ONE · 28 FEBRUARY 2026`. Three bars over `rgba(18,16,14,.28)` tracks, amber
fills, scaled against gasoline as the longest:

| Label | Value | Width |
|---|---|---|
| GASOLINE Y/Y | +26.7% | 100% |
| CPI ENERGY Y/Y | +15.7% | 58.8% |
| HEADLINE CPI Y/Y | +3.7% | 13.9% |

Closing line: energy was never tariffed — crude is exempt from every schedule — so the only
route from policy into a 2026 gasoline price runs through the strait.

**The tariffs** — ink ground, amber offset shadow.
Kicker `CHOICE TWO · ONGOING`. Core PCE `2.61% (Apr 2025)` → `3.42% (May 2026)` with a
dashed amber connector between them, then a box `3px solid #F5A300`:
`A PERSISTENT CREEP OF` / **`+0.81 PTS`** (counts to 0.81, 2dp, 1500ms).
Closing line: credible tariff estimates are **0.4–0.8 points of core PCE** — a range,
because no defensible point estimate exists.

**Then the amber "THE HONEST PART" block**, full width, ink offset shadow. ⚠ This is
load-bearing, not filler. It states that the Supreme Court struck down the IEEPA tariffs on
20 Feb 2026 (cutting average tariffs ~4.8 points), that the Dallas Fed found the Hormuz
shipping-cost increase **completely offsets it**, and that the two effects are therefore
**not additive**. Cutting this block is the single easiest way for a critic to kill the
whole page.

---

## 05 — A frozen labour market

**Ground** `#12100E` + `halftone-dark`.

Heading grid: H2 + a paragraph making the argument that unemployment is the wrong number.

Left column — `JOBS CREATED PER MONTH`, two columns in a flex row of height
`clamp(160px,20cqi,260px)`:

| | Value | Height | Fill | Top border |
|---|---|---|---|---|
| BIDEN | 320,938 | 100% | `#1E3FBF` | `5px solid #BFD0FF` |
| TRUMP II | 42,118 | **13.1%** | `#D91E18` | `5px solid #F4EDE0` |

⚠ 13.1% is `42,118 / 320,938`. The bar is *supposed* to look almost invisible.
Both count up. `scaleY(0→1)`, origin bottom, `1.1s`, second staggered 350ms.
Beside them, a crimson `−87%` callout box with a cream offset shadow.

Right column — `THE NUMBER THAT MATTERS`, three horizontal bars:

| Label | Value | Width | Colour |
|---|---|---|---|
| LONG-TERM UNEMPLOYED, SHARE OF ALL UNEMPLOYED | 21.1% → 27.3% | 91% | `#D91E18` |
| HIRING RATE (PRE-2020 ~3.9%) | 3.3% | 85% | `#F5A300` |
| QUITS RATE — NOBODY IS MOVING FOR A RAISE | 1.9% | 49% | `#F5A300` |

⚠ **Long-term unemployment leads. Never the unemployment rate.** U-3 went 4.0 → 4.2 and
U-6 7.5 → 7.9 — both true, both unimpressive, and putting either first hands the reader a
correct rebuttal in the first sentence.

Footer note: Powell's Dec 2025 observation that payroll growth may be **overstated** by
~60,000/mo via the birth-death model — a bias that flatters these numbers, not the reverse.

---

## 06 — The other side of the coin

**Ground** cream.

H2 `The other side / of the coin` + a paragraph: a page that only shows the bad rows is a
page you should not trust.

Four cards, `auto-fit minmax(min(100%,250px),1fr)`, each `.panel-outline` — `3px solid
#12100E` on cream with a **poster-blue** offset shadow. Per card: `THE OTHER SIDE` kicker in
blue, big value, label, explanation.

| Value | Label | Why |
|---|---|---|
| −45% | Eggs, per year | Avian influenza resolved. Not policy, and not claimed as such. |
| 2.6% | Core CPI | At or near target. The overshoot is in the tails, not the basket. |
| 2.7% | Median CPI | A relative-price shock moves the tail; broad demand inflation would move this. |
| UP | S&P 500 | Higher over the period. Initial claims also low. Both true. |

⚠ Same type size as every other section. Shrinking these reads as a concession being
hidden; keeping them full size reads as confidence. ⚠ The section is **"The other side of
the coin"** — no "us", no first person. That was an explicit revision.

---

## 07 — The strait · "Everything came through here"

**Ground** `#0A1A24` + halftone. Mounted as its own component.

Everything here comes from `port/hormuz-engine.js`. The engine owns both canvases, the
loop, the vessels and the timeline; you build the markup and render the readout object it
hands you. Full internals are documented at the top of that file.

**Layout** — flex row, wraps:
- **Map panel**, `flex: 3 1 520px`, `3px solid #F5A300`, ground `#061218`:
  - canvas wrapper, `height: clamp(230px,26cqi,360px)`
  - state chip top-left: 8px square dot + label, on `rgba(6,18,24,.82)`; the dot animates
    `hzPulse 1.1s` whenever flow is below baseline
  - top-right note: `ILLUSTRATIVE GEOMETRY / VESSEL POSITIONS ARE NOT AIS DATA` ⚠ keep
  - **event card** below the canvas: `border-left: 5px solid <kind colour>`, `border-top:
    3px solid rgba(244,237,224,.1)`, ground `#0A1015`. Date, kind chip, `TIER n`, headline,
    detail. Flashes `hzFlash .9s` when the event changes — and only then.
- **Stat rail**, `flex: 1 1 260px`:
  - amber price block (`flex: 2 1 auto`): `WTI CRUDE · $/BARREL`, the price at
    `clamp(38px,5.2cqi,64px)`, and a caption that switches between `VERIFIED CLOSE · <date>`
    / `APPROX. CLOSE · <date>` / `DERIVED · −15% FROM THE PEAK` / `BETWEEN CLOSES · DRAWN
    STRAIGHT`, dimmed to `.72` opacity for anything but a verified close ⚠
  - three `.panel-onsea` readouts: transit mb/d, war-risk premium, tankers drawn waiting
- **Chart panel**, full width below: a legend row (verified close / drawn straight /
  pre-war level), the chart canvas at `height: clamp(160px,21cqi,240px)`, then controls.

**Controls** — `PLAY`/`PAUSE` (amber, min-width 96px, 44px tall), `REPLAY` (outline), the
date in mono, then speed buttons `1× 2× 6×` joined into one strip. ⚠ `1×` is 12 days/second
and must be highlighted **on mount**, not only after a click.

**Scrubber** — a custom 44px-tall track, not an `<input type=range>`: 4px rail, amber fill,
a 16px square thumb with `box-shadow: 0 0 0 3px rgba(245,163,0,.4)`, and **one tick per
event** derived from the ledger (`scrubTicks()` in the engine — never hard-code the
percentages). War ticks are tall and 2px; tariff/policy are mid; context are short and low.
Pointer events with `setPointerCapture`, `touch-action: none`, so mouse, touch and pen all
work.

**Below**: the amber `WHAT THIS SHOWS` callout ($57 → $114 → $69.74 → $84, and why a round
trip means energy shock rather than inherited inflation), then two `.panel-onsea` cards —
`WHAT WOULD DISPROVE THIS` and `WHAT WE DO NOT CLAIM` — then the sources line.

⚠ **The queue readout says "tankers drawn waiting" and its caption says no verified count
exists.** THESIS.md forbids publishing a queue figure. Do not relabel this as real data.

---

## 08 — Sources

A slim strip on `#12100E`, `border-top: 3px solid #D91E18`, three columns:
`SOURCES —`, `MISSING —` (the October 2025 CPI hole), `NOT WIRED IN —`.

⚠ There is deliberately **no "what we refuse to claim" section**. It was removed on request
and the team is writing it separately. Do not add one back.

---

## Charts — the dual-geometry rule

A `1200×470` viewBox scaled into a 375px phone renders 17px labels at about 5px. Illegible.

So the two SVG charts (§01 and §03) each ship **two hand-built geometries**:

| | Landscape | Portrait |
|---|---|---|
| §01 WTI | `0 0 1200 470` | `0 0 620 560` |
| §03 crossing | `0 0 1200 470` | `0 0 620 580` |

Swapped at a **760px container width**, measured synchronously on mount and then polled on
the same interval as everything else. Each has independently positioned labels, flags and
annotation boxes — the portrait versions move flags to their own rows rather than beside
the lines.

**You may replace this with a proper responsive scale** if you prefer — provided **no label
ever renders below 11px**. That is the actual requirement; two geometries is just how the
prototype met it.

⚠ In the prototype, SVG `<text>` inside a loop rendered zero-width, so every axis and
category label is unrolled as a literal element. That constraint does not exist in JSX — but
verify with `getBoundingClientRect().width > 0`, because zero-width text passes both a node
count and a `textContent` check.

The §07 canvases are different: one geometry, detail dropped below 470px (inset, port
labels, TSS caption, Qeshm label).
