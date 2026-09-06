# V5 brief — THE definitive one. Everything earlier is superseded.

**2026-09-06.** This replaces `docs/design-briefs/2026-09-05-v5-the-bill.md` and every prior
handoff. The "tally / receipt" concept, the "objects not charts" rule, the "three low-fi
storyboards first" process and the cream-paper look are all **cancelled**. They produced
exactly the opposite of what the user wants. Do not propose a storyboard. Do not ask which
world. Do not ask the user to pick from a form. **Decide, build, show.**

Repo `Samizdat-Publications/oil-tracking-dashboard` (main). Data: `frontend/public/data-snapshot.json`
(schema v2, 20 blocks; pull fresh). Claims: `docs/THESIS.md`. Live V4 for reference:
https://trumps-economy-ledger.pages.dev

---

## What the user actually wants, in one paragraph

**A scroll-driven animated documentary made of data.** Every block is a spectacular,
animated data visualisation that plays out as the reader scrolls — the quality of the
Strait of Hormuz simulation (ships moving, the strait closing, readouts ticking) and of the
earlier spinning globe with oil flows, **in every block**. Not bar charts, not lines with
flags, not boxes and words, not a receipt. Shiny, moving, cinematic, and every pixel of it
true to a published number. This is what Fable 5.1 was asked to show it can do with the
bleeding edge of web animation. If a block would look at home in a spreadsheet, it is wrong.
If it would look at home in a Bloomberg or NYT scrollytelling feature or a game HUD, it is right.

**The audience is everyone**, including Trump supporters who can be moved by hard data. He
says golden age, perfect economy, wars won, prices at all-time lows. The page answers with
the government's own numbers, beautifully, and lets them draw the conclusion. That is why
the honest rows stay, why every figure is sourced, and why the tone names him without
insulting the reader.

## Palette — red, white and blue, plus gold

| Token | Hex | Meaning |
|---|---|---|
| Navy ground | `#0B1E3F` (deep flag blue) | The cinematic ground for every animated block |
| Paper | `#F7F5F0` | Reading passages between blocks; text on navy |
| **Red** | `#B22234` (flag red) | **His dated acts, and nothing else.** The strike, the tariffs, the firing, "30 ships a night". |
| **Gold** | `#D4A017` | **Money and oil — everything measured.** Prices, barrels, dollars, the running total. |
| Blue (light) | `#6C8CD5` | The counterfactual, Europe, ceasefires, the court, and *Against us*. |
| White | `#FFFFFF` | Labels, axes, the number type on navy |
| Grey hatch | `rgba(247,245,240,.25)` | A claim that is not data |

Stars-and-stripes as a *motif* is welcome (a stripe as a progress rail, stars as a tally of
the dead) if it is done with restraint and never as clip-art.

## The blocks — each one an animation, each one from the data

Every block: full viewport, pinned while the animation scrubs with scroll (GSAP ScrollTrigger
`pin` + `scrub`), a single huge gold number that counts as it enters, one sentence a
fourteen-year-old understands, and a **Show the work** disclosure below with the sources,
tiers and method. Nothing analytical on the surface; everything analytical one tap down.
Reduced motion shows the completed end state.

| # | Block | Number (bound) | The animation, precisely |
|---|---|---|---|
| 0 | **The globe** | Hormuz **4 ships a day, was 83** | A 3D globe (three.js or d3-geo on canvas) with the world's seaborne oil as gold particle streams along real routes. Scroll: 28 Feb, the Hormuz stream chokes to a trickle; particles reroute around the Cape of Good Hope; Bab el-Mandeb dims. Counts come from `chokepoints` (Hormuz 5%, Cape 103%, Suez 111%, Bab el-Mandeb 78%). The camera pushes in to the strait and hands off to block 2. |
| 1 | **Two dates** | **28 Feb · 24 Jul** | The globe freezes; two red seals stamp onto the frame with the sound-free impact of a slam: *He ordered the strike. He re-imposed the tariffs a court had struck down.* Every red mark that follows on the page traces back to these two. |
| 2 | **Oil doubled** | **$57 → $115 in 5 weeks** | The 167 daily closes (`crude_daily`) as a **seismograph**: the needle writes the line in real time as you scroll, the paper scrolls under it, the trace jumps at the strike and the frame shakes once. Red tick at each of his acts, blue at the ceasefires. Nothing else on the plot. |
| 3 | **The strait** | **4 / day** | The existing engine (`frontend/src/v4/hormuz/engine.js`): Natural Earth coast, ships driven by PortWatch daily counts, the gate closing, readouts. Restyle to the palette, make it full-bleed, put the President's "thirty a night" as a hatched ghost fleet beside the four real ones. This is the quality bar; every other block must reach it. |
| 4 | **Your prices** | **Diesel $5.60, a record** | A **split-flap departures board** of fifteen staples (`staples`, `eia`): each row's price flips from Jan 2025 to now as you scroll, gold digits, the four that fell flip down in blue. Diesel pump alongside with rolling digits. Total row at the bottom: **+$83 a month** for the average household, with a state picker that re-flips the board for *your* state (`receipt_inputs`). |
| 5 | **Nobody is hiring** | **42,000 a month, was 321,000** | A **crowd of people**: 321 dots stream into a stadium each month under the previous term; under his, 42 trickle in and the rest stand frozen outside (long-term unemployed 21% → 27%). A paycheck overlay shows the raise: **−0.2% after prices**. August's 162,000 shown honestly as one bright month. |
| 6 | **What the war cost** | **18 · 42 · $37.5bn** | Eighteen stars light one by one. Forty-two aircraft silhouettes by type appear as a tally (CRS IN12692). A dollar counter runs to $37.5bn and keeps going to the $67.1bn he has asked for. A ghost fleet of interceptors: two-thirds fade out (CSIS), with the Secretary's denial printed beside it in white. |
| 7 | **The world backs away** | **159 tonnes out of New York** | A **vault**: 5,919 gold bars stacked in a New York Fed cage; month by month, bars slide out and away (Netherlands 86 t, France 129 t, India), until 159 t are gone and none have come in. Beside it, Treasuries as a shrinking stack ($2.78tn → $2.62tn). The Fed's counter-argument printed in blue at full size: gold is down 20%; the dollar is up. |
| 8 | **Against us** | six blue numbers | Six cards that turn over to show what went right: eggs −56%, August +162,000 jobs, S&P +29%, mortgages lower than the handover, the dollar up, core prices near target. Same size as everything else. |
| 9 | **Your bill** | **+$83 / month · $1,440 so far** | The eight numbers assemble into the shareable card that is also the OG image. |
| 10 | **Check our work** | — | Every source; the missing month; the two corrections. Plain. |

Optional if there is budget after all ten reach the bar: **the Fed dial** (odds of a hike
climbing to 50%, `polymarket`), **the chain** (a pipeline where a barrel travels crude →
diesel → truck → shelf over four months, `chain`), **the debt counter** live from Treasury
(`fiscal.debt`, fetched in the browser).

## Technology — use the bleeding edge, prove it

- **GSAP 3 + ScrollTrigger** (free) for pinned, scrubbed sequences; timelines per block.
- **Canvas / WebGL** for the globe, the particles, the seismograph, the crowd and the vault:
  three.js or OGL for 3D, plain 2D canvas where it suffices. d3-geo for the globe projection
  and Natural Earth coastlines (already in the repo for the strait).
- **CSS scroll-driven animations** (`animation-timeline: view()`) for reveals and the number
  counters; `ranges entry 0% entry 100%`.
- Self-hosted fonts in production; Google Fonts acceptable in the prototype. Condensed
  grotesk for numbers at 200–320px desktop / 88–120px mobile; a serif for sentences;
  mono ≥ 12px for sources.
- 60fps on a mid-range phone; canvas work off the main thread where possible; every block
  degrades to a finished still under reduced motion. 390px with zero horizontal overflow.
- Known runtime gotchas from the last session: `body{overflow-x:hidden}` breaks scroll
  timelines (clip per section); `view()` ranges must finish early; build one block per write
  with markers; hide readouts until progress > 0.02; clamp labels inside containers.

## Rules that never move

- Every number is bound to a snapshot key or marked `PLACEHOLDER`. No invented figures, ever.
- Red only for his dated acts. Gold only for measured money and oil.
- Honest rows at full size, never collapsed. War and tariff effects never summed. No queue
  count. Odds are odds. The word "cover-up" does not appear; the denial is printed beside the estimate.
- Surface copy: names him, names the reader, active verbs, no analyst vocabulary ("y/y",
  "pts", "CPI", "PCE", "TIER", series IDs). All of that lives under Show the work.

## Process — do this, in this order, without asking

1. Build **block 0, the globe**, to finished quality. Show it. If it is not something the
   user would screenshot and send to a friend, rebuild it before touching anything else.
2. Build **block 4, the departures board**, to finished quality. Show it.
3. Then the rest, one per write, each verified at 1400 and 390 with a screenshot of the
   block mid-animation and at its end state.
4. Review the whole page top to bottom on a phone before any review with the user.

Do not present options. Do not present storyboards. Present finished, moving blocks. If a
choice is genuinely the user's, make the recommended one and say so in one line.

## Acceptance

- Every block moves with the scroll and every moving thing is a number from the snapshot.
- A Trump supporter can read the page without being insulted and cannot dismiss a figure.
- A phone reader who scrolls for ninety seconds can say: oil doubled, the strait is shut,
  diesel is a record, hiring stopped, eighteen died, gold is leaving, it costs me $83 a month.
- No block would look at home in a spreadsheet.
