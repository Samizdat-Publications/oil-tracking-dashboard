# Design Brief — V4 Full Redesign

**Date:** 2026-08-02 · **Supersedes all previous briefs in this folder.**
**For:** Claude Design · **From:** Claude Code
**Ask:** Propose **multiple complete redesign variants.** You have full control over look,
feel, structure, and interaction model. Do not inherit the current design — it is not
working and we want it replaced.

---

## 1. The problem with what exists

The current page (`frontend/src/pages/ReceiptPage.tsx`, live at `localhost:5173`) is
accurate, rigorous, and **boring**. It opens with a form. Its charts are competent SVG
line and bar charts. A reader who lands on it and doesn't already care about economics
leaves in three seconds.

Everything under the hood is sound — the data is real, tested, and defensible. What's
missing is any reason to look at it.

**Your job: make this arresting.** We would rather ship something visually ambitious that
takes a beat to load than something tasteful that nobody reads.

## 2. What this page is

A page that shows **how current US economic policy is hitting an ordinary household's
wallet**, measured against previous administrations.

The two named drivers are **tariffs** and the **Iran war** — both are policy choices, both
are datable, and both have measurable price consequences. The page connects those choices
to the reader's grocery bill, fuel bill, and job prospects.

**Register:** confident and specific, not partisan-sounding. The conclusion is pointed;
the presentation should feel like investigative data journalism — Bloomberg, FT, Reuters
Graphics, NYT Upshot — not like a campaign site. Name people and dates plainly. No
epithets, no scare quotes, no exclamation marks. **Let the numbers be the aggression.**

## 3. Above the fold is the whole ballgame

Most readers will never scroll. Whatever is visible at **375×667 on a phone** has to
deliver the argument on its own.

This is the single most important design problem in the brief. Options worth exploring —
propose your own:

- A **cold-open animation** that runs on load and tells the story in ~6 seconds
- The **Hormuz simulation** (§4) as the hero, playing on autoloop until touched
- A **single number** that counts up, with the chart assembling behind it
- A **split screen** — two administrations, same metric, animating in parallel

Constraints: no more than ~2s before something meaningful is on screen; the reader must
understand *what this page is about* without reading a paragraph; and it must not
pattern-match to "political content" in the first second or the audience we need is gone.

## 4. The Hormuz simulation — the centerpiece we most want built

A playable simulation of the Strait of Hormuz through the 2026 war.

**Interaction:** press play; a time scrubber runs from pre-war through today at
user-controlled speed. The reader can scrub, pause, and replay any moment.

**What it shows over time:**
- Tanker traffic through the strait — vessels moving, or not
- Barrels per day getting through vs. the pre-war baseline
- Ships queued and waiting that would normally have transited
- The crude price responding, live, as the timeline advances
- War events firing as annotated moments (first strike, ceasefire, strikes resume)

**Why this is the centerpiece:** the war's economic signature is a **round trip** — oil
went $57 → $114 → $70 during the June ceasefire → $84 after strikes resumed. Prices track
the war in both directions. That is the single most persuasive fact in the entire project
and it is *inherently* a time-based animation. A static chart cannot make the point.

The attached `hormuz-map.html` example is the right *kind* of thing. Go further.

## 5. Visual ambition

Use the full toolbox — WebGL, custom shaders, particle systems, canvas, SVG morphing.
Specific invitations:

- **A rotating globe** showing global oil flows and where the chokepoint sits
- **Particle fields** for barrel flow, freight movement, or price pressure
- **Shader-driven** heat/pressure metaphors for price shocks propagating downstream
- **Scroll-linked** chart morphing where one chart becomes another
- **Physical metaphors** — a receipt printing, a pump counter spinning, a shelf price
  re-ticking

Two hard limits: it must run at 60fps on a mid-range phone, and `prefers-reduced-motion`
must yield a static but still complete version. If an effect can't degrade, don't ship it.

## 6. NON-NEGOTIABLE: every chart gets a plain-English callout

Most readers do not read charts fluently. A chart without an explicit takeaway is
decoration.

**Every single chart carries a "What this shows" line directly beneath it**, in plain
language, stating the finding — not describing the axes.

Good:
> **What this shows:** The war started February 28. Oil went from $57 to $114 in five
> weeks — a 99% jump. It fell back to $70 when a ceasefire held in June, then rose again
> when strikes resumed in July.

> **What this shows:** Tariffs were announced in stages through 2025 and 2026. Coffee is
> up 35% since January 2025. Ground beef is up 23%.

Bad:
> *This chart shows WTI crude oil prices over time with event markers.*

Treat these callouts as primary content that happens to sit under a chart — design them
with as much care as the chart itself. **Ideally the page works if you read only the
callouts.**

## 7. Structure — reorder from what exists

Rough order, argue with it:

1. **Cold open / hero** — the argument in one view
2. **The Hormuz simulation** — what happened and what it did to the price
3. **The shelf** — actual dollar prices of groceries, then vs. now
4. **Work** — job creation collapse and the frozen labor market
5. **Compare administrations** — interactive, Clinton→today, party-banded
6. **Your receipt** — the personal calculator, *moved here*, after the case is made
7. **Check our work** — sources, methods, what we refuse to claim

The calculator was the opener; it should be the payoff.

## 8. The data you have

All live at `http://localhost:8020/api/attribution/` (Swagger at `/docs`):

| Endpoint | Gives you |
|---|---|
| `/administrations?metric=` | Any metric Clinton→today, party-banded, with rankings and per-term context. Metrics: `jobs`, `cpi_headline`, `cpi_core`, `gasoline_ap`, `beef_ground`, `electricity`, `unemployment`, `real_earnings`, `real_gdp`, `sp500`, `labor_share`, `saving_rate` |
| `/staples` | 13 grocery items, actual dollars, both terms, annualized |
| `/jobs` | Monthly payroll changes + labor-market counterweights |
| `/breadth` | Headline vs core vs median vs trimmed CPI |
| `/event-study` | War events with price response — **the data behind the Hormuz sim** |
| `/scorecard` | Full macro ledger both terms |
| `/receipt` | Personalized household cost |
| `/methodology` | Every series ID, data gaps, and claims we decline to make |

Numbers you can build around today:

- Oil **$57 → $114 → $70 → $84** across the war's phases
- Ground beef **$5.55 → $6.83** · Coffee **$7.02 → $9.46** · Gas **$3.21 → $4.20**
- Job creation **+320,938/mo → +42,118/mo**
- **Long-term unemployed 21.1% → 27.3%** of all unemployed
- Headline inflation 3.7% but **median inflation 2.7%** — the spike is concentrated, not broad

## 9. On the labor market — use the right number

Do **not** lead with the unemployment rate. U-3 went 4.0% → 4.2% and U-6 went 7.5% → 7.9%
— both true, both unimpressive, and a skeptic will say "unemployment is near record lows"
and be right.

**Lead with long-term unemployment: 21.1% → 27.3% of the unemployed have been out 27+
weeks.** Paired with a hiring rate frozen at 3.3% (vs ~3.9% pre-2020) and quits at 1.9%,
the accurate story is a **frozen labor market** — few layoffs, but if you lose a job you
stay out far longer, and you can't move for a raise.

Note honestly: no official statistic captures skill-based underemployment. A laid-off
specialist working full-time at a gas station counts as employed in every U-rate. If the
design wants to convey that, it has to be through the long-term-unemployment and
hiring-rate data, not by implying a statistic exists that doesn't.

## 10. Honesty requirements — these are what make it survive being shared

Non-negotiable, and they are a design opportunity rather than a burden:

- **Zero fabrication.** Every number from an endpoint or a labeled assumption. Missing
  data says "no data" — never a plausible-looking placeholder. (The previous version of
  this project shipped `Math.random()` sparklines and invented Reuters headlines. That is
  the failure mode we are designing against.)
- **Show the rows that cut against us.** Eggs are down 45%/yr — because avian influenza
  resolved, not because of policy, and we say so. The S&P is up. Initial claims are low.
  Design a treatment for these that feels like confidence, not concession.
- **COVID distorts everything.** Trump's first term ends in a pandemic; Biden's begins in
  the recovery. Any administration comparison must make that visible or it's misleading in
  both directions. This needs a real visual solution, not a footnote.
- **Every claim carries what would disprove it**, available inline.

## 11. Constraints

React 19 · Vite · Tailwind v4 · TanStack Query. Charts are hand-rolled (Plotly dropped).
A WebGL/animation library is **fine if the payoff justifies it** — say which and why.
Mobile-first, 44px touch targets, generous type (many readers are 60+).
Self-contained: no external asset hosts.

## 12. What to deliver

**Multiple complete variants** — at least 2–3 genuinely different directions, not
palette swaps. For each: the above-the-fold treatment, the visual language, and the
motion concept. HTML/CSS mockups I can port, or component specs, whichever suits you.

If you only build one thing in full, build **the Hormuz simulation** — it's the
centerpiece and the hardest piece.

## 13. Reference

- `docs/THESIS.md` — every claim tier-graded, plus what we explicitly refuse to claim.
  **Read before writing any copy.**
- Current implementation: `frontend/src/pages/ReceiptPage.tsx`, `frontend/src/v3/charts.tsx`,
  `frontend/src/styles/v3.css`
- Live: `http://localhost:5173` (needs both servers running)
- Attached examples of the interaction quality wanted: `hormuz-map.html`,
  `Crude Oil Timeline.dc.html`
