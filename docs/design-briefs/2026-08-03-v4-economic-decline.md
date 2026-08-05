# Design Brief — V4: The Economic Record, Measured Against the World

**Date:** 2026-08-03 · **Supersedes every earlier brief in this folder.**
**For:** Claude Design · **From:** Claude Code
**Ask:** Propose **multiple complete redesign variants.** Full control over look, feel,
structure and interaction. Do not inherit the current design.

---

## 1. The argument — read this section twice

Most economic comparisons between administrations are garbage, and a sharp reader knows
it. Presidents inherit recessions. Pandemics arrive. Comparing raw inflation under one
president to raw inflation under another tells you mostly about who was unlucky.

**This page solves that problem, and the solution is the reason it exists.**

The 2021–22 inflation surge was **global**. Every advanced economy had it — supply chains,
energy, the post-pandemic reopening. So the honest question is not *"how much inflation
happened under this president?"* It is *"how much inflation happened here, compared with
other rich countries hit by the same shock?"*

Other countries are the control group. The difference is what's domestic.

### The result

| Administration | US inflation | Euro area | **US-specific excess** |
|---|---|---|---|
| Clinton | 2.82% | 1.69% | +1.12 |
| Bush | 2.79% | 2.35% | +0.44 |
| Obama | 1.40% | 1.18% | +0.23 |
| Trump I | 1.89% | 1.17% | +0.72 |
| **Biden** | **4.98%** | **4.72%** | **+0.25** |
| **Trump II** | **3.00%** | **2.23%** | **+0.77** |

At the October 2022 peak, **US inflation was 2.86 points BELOW the euro area** — 7.76%
against 10.62%. America came through the global shock better than its peers.

Today (June 2026): **US 3.73%, euro area 2.73%, France 2.02%.**

### The one sentence this whole page exists to earn

> **When the whole world had inflation, America had slightly less than average.
> Now that the world doesn't, America has more.**

Biden's 5% was the world's 5%. Trump II's 3% is America's alone — with no pandemic, no
financial crisis, and no global shock to point at. Just tariffs and a war.

**This reframing is the spine of the redesign.** Everything else supports it.

## 2. What this page is about now

**Less oil. More household economics.** The Iran war matters because it moved fuel prices,
and fuel moves everything else — but it is *one input*, not the subject. The subject is
the broad economic record: jobs, food, wages, and what a household actually pays.

Tariffs and the war are the two named policy drivers. Both are choices. Both are datable.
Both have measurable consequences on a grocery receipt.

## 3. Above the fold is the whole ballgame

Most readers never scroll. Everything essential must land at **375×667 on a phone**.

The strongest candidate hero: **the two-line comparison chart** — US inflation and
peer-country inflation, plotted together, 2015→today, party-banded. The lines converge
through the global surge and then **separate after January 2025**. That divergence *is*
the argument, and it needs no explanation.

Other directions worth proposing:
- A **cold open** that animates the two lines apart over ~6 seconds
- A **split screen**: "what the world did" / "what America did"
- One **counting number** — the US-specific excess — assembling from the chart behind it

Constraints: something meaningful on screen inside ~2 seconds; the reader grasps the
subject without reading a paragraph; and it must not pattern-match to "political content"
in the first second or the audience we need is gone.

## 4. NON-NEGOTIABLE: a plain-English callout under every chart

Most readers do not read charts fluently. A chart without an explicit takeaway is
decoration.

**Every chart carries a "What this shows" line directly beneath it**, stating the finding
in plain language — not describing the axes.

Good:
> **What this shows:** In 2022 nearly every rich country had high inflation at once —
> America's was slightly *lower* than Europe's. Since 2025 Europe's has come down and
> America's hasn't.

> **What this shows:** Ground beef cost $5.55 in January 2025. It costs $6.83 now.

Bad:
> *This chart shows US and euro-area CPI over time.*

Design these with as much care as the charts. **The page should work if you read only the
callouts.**

## 5. Structure

1. **Hero** — the divergence, above the fold
2. **The world as control group** — the full comparison, all peer countries, interactive
3. **The shelf** — grocery prices in actual dollars, then vs. now
4. **Work** — job creation and the frozen labour market
5. **What drove it** — tariffs and the war, with the Hormuz simulation
6. **Compare administrations** — Clinton→today, any metric, party-banded, with the
   cycle-adjustment toggles
7. **Your receipt** — the personal calculator, *moved here*, after the case is made
8. **Check our work** — sources, methods, what we refuse to claim

## 6. Interaction and visual ambition

Use the full toolbox — WebGL, shaders, particle systems, canvas, SVG morphing. Two hard
limits: 60fps on a mid-range phone, and `prefers-reduced-motion` yields a static but
complete version.

**The Hormuz simulation** (now section 5, not the centerpiece): press play, scrub through
the war at any speed. Tanker traffic, barrels through vs. baseline, ships queued, the
crude price responding live, war events firing as annotations. Free transit data from IMF
PortWatch (no key needed). Tanker *day rates* are genuinely unavailable at any reasonable
price — design around volumes and barrels, not freight costs.

The war's signature is a **round trip** — oil went $57 → $114 → $70 during the June
ceasefire → $84 when strikes resumed. Prices track the war in both directions. That is
inherently a time animation; a static chart cannot make the point.

## 7. Data available

Live at `http://localhost:8020/api/attribution/` (Swagger at `/docs`):

| Endpoint | Gives you |
|---|---|
| `/administrations?metric=` | Any metric Clinton→today, party-banded, with rankings, per-term inherited-shock context, and **four cycle-adjustment filters** (`none`, `ex_covid`, `ex_recession`, `lag12`) |
| `/staples` | 13 grocery items, actual dollars, both terms, annualised |
| `/jobs` | Monthly payrolls + labour-market counterweights |
| `/breadth` | Headline vs core vs median vs trimmed CPI |
| `/event-study` | War events with price response |
| `/scorecard` | Full macro ledger |
| `/receipt` | Personalised household cost |
| `/methodology` | Every series ID, data gaps, claims we decline to make |

*(International comparison endpoint is being added — same shape, US vs peer countries.)*

Headline numbers available today:

- **US-specific inflation excess: Biden +0.25 · Trump II +0.77**
- Job creation **+320,938/mo → +42,118/mo**
- **Long-term unemployed 21.1% → 27.3%** of all unemployed
- Ground beef **$5.55 → $6.83** · Coffee **$7.02 → $9.46** · Gas **$3.21 → $4.20**
- Headline inflation 3.7% but **median 2.7%** — concentrated, not broad
- Oil **$57 → $114 → $70 → $84** across the war's phases

## 8. On the labour market — use the right number

Do **not** lead with the unemployment rate. U-3 went 4.0% → 4.2%, U-6 went 7.5% → 7.9%.
Both true, both unimpressive, and "unemployment is near record lows" is an available and
correct rebuttal.

**Lead with long-term unemployment: 21.1% → 27.3%** of the unemployed have been out 27+
weeks. With the hiring rate frozen at 3.3% (vs ~3.9% pre-2020) and quits at 1.9%, the
accurate story is a **frozen labour market** — few layoffs, but if you lose a job you stay
out far longer and can't move for a raise.

No official statistic captures skill-based underemployment; a laid-off specialist working
full-time at a gas station counts as employed in every U-rate. Convey it through
long-term unemployment and hiring rates, not by implying a statistic exists that doesn't.

## 9. Honesty requirements — these are load-bearing, not decoration

- **Zero fabrication.** Every number from an endpoint or a labelled assumption. Missing
  data says "no data". (V2 shipped `Math.random()` sparklines and invented Reuters
  headlines. That is the failure mode we design against.)
- **Show the rows that cut against us.** Eggs are down 45%/yr — because avian influenza
  resolved, not because of policy, and we say so. The S&P is up. Initial claims are low.
  Design a treatment for these that reads as confidence, not concession.
- **The cycle-adjustment toggles must be honest.** Excluding COVID flips Trump I's job
  number from −57,604 to +180,135. **Show that.** A tool that lets the reader watch a
  number move against our own argument is the reason they will believe the rest.
- **Every claim carries what would disprove it**, available inline.

⚠️ The `ex_recession` filter produces an artifact for Trump I (+418,667/mo): NBER dated
COVID as only Feb–Apr 2020, so it strips the crash but keeps the rebound. The UI must
flag this, not hide it.

## 10. Tone

Neutral, declarative, specific. The numbers carry the weight; the prose should not strain.
Name people and dates plainly — "Biden", "Trump", "January 2025". No epithets, no scare
quotes, no exclamation marks.

Register: investigative data journalism — FT, Reuters Graphics, NYT Upshot. **Not** a
campaign site. The conclusion is pointed; the presentation is not.

## 11. Visual direction

**American, institutional.** Reference points: Federal Reserve publications, Census data
products. Red and blue must be **equal in visual weight** — squint at it; neither side
should dominate. Party colours follow the US convention (red R, blue D), so every neutral
element — axes, gridlines, annotations — must be scrupulously grey/black.

Light or dark is your call. Light probably reads as more official and screenshots better,
which matters for sharing.

## 12. Constraints

React 19 · Vite · Tailwind v4 · TanStack Query · hand-rolled SVG charts (Plotly dropped).
An animation/WebGL library is fine if the payoff justifies it — say which and why.
Mobile-first, 44px touch targets, generous type (many readers are 60+). Self-contained.

## 13. Deliverable

**Multiple complete variants** — at least 2–3 genuinely different directions, not palette
swaps. For each: the above-the-fold treatment, visual language, and motion concept.

If you build only one thing in full, build **the hero divergence chart** (§3). It carries
the argument.

## 14. Reference

- `docs/THESIS.md` — every claim tier-graded, plus what we refuse to claim. **Read before
  writing copy.**
- `docs/SESSION-HANDOFF.md` — current state and open threads
- Current implementation: `frontend/src/pages/ReceiptPage.tsx`, `frontend/src/v3/`
- Repo: `Samizdat-Publications/oil-tracking-dashboard`
