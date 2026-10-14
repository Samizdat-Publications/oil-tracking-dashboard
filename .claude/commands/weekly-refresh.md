---
description: Weekly refresh of The Bill. Check the hand-checked figures against the news, update them from sourced reporting, refresh every data series, publish, and report what moved.
---

Refresh "The Bill" (the oil dashboard). Work in
`C:\Users\stewa\Documents\Claude\Oil Traacking Dashboard\oil-dashboard`. Read its `CLAUDE.md`
first. The first rule is zero fabrication: never type a figure without a named source and a
URL.

## 1. The hand-checked figures

Run `py backend/scripts/check_curated.py`. It lists every figure the page shows that is typed
in from a source rather than fetched: the war cost, casualties, aircraft, CBO estimate,
interceptors, the Fed's gold table, the gold price and the latest Fed rate decision. Each line
says whether the figure is due and where to look.

For each one marked **DUE**:

- Search for the latest figure. Accept Tier 1 sources (official statistics, the Pentagon, CRS,
  CBO, the Fed) or Tier 2 sources (AP, Reuters, Bloomberg, major outlets reporting an official
  figure). Never use a Tier 3 source. Open the source itself; do not rely on a search snippet.
- **If there is a newer figure,** edit `backend/data/context_figures.json` by hand, a few
  lines at a time, keeping the file's formatting. Do not re-dump it with `json.dump`. Update
  the value, `as_of`, `source`, `url` and `tier`. When a headline number changes, keep the old
  one under `previous`; the page prints how the count moved. Mirror the change in
  `docs/THESIS.md`.
- **If nothing is newer,** run `py backend/scripts/check_curated.py --mark <path>`.

If a new figure changes the meaning of a sentence on the page, change the computed copy and
not the number alone. Copy that states a figure or a verdict is built from the data in
`TheBill.jsx` and mirrored in the design handoff (see "Copy that states a verdict" in
`CLAUDE.md`). On 2026-10-13, for example, the aircraft tally went from 42 to 81, but the
Pentagon's $2.6bn estimate covered only the first 42, so block 07 had to say that.

## 2. Build without publishing

Stop any `vite preview` running from `oil-dashboard\frontend` first. Stop only that one: never
kill every node process, because other projects' servers run on this machine.

```
powershell -File backend\scripts\refresh.ps1 -Dry
```

Read the "Recording the figures" lines (what moved since the last refresh) and any warning. If
`build_v5_data.py` exits 2, a series mapping is broken: fix it, and do not publish with
`--allow-stale`. Then `git checkout docs/refresh-history.csv`, because the real run records the
row again.

## 3. Look at it

Serve `frontend/dist` (`npx vite preview --port <a free port>`). Screenshot blocks 00 to 10 at
1440x900 and at 390x844 with reduced motion, and check any block whose figures moved for text
that collides or that no longer reads true. Verdicts drop out on their own when they stop
being true; numbers typed into copy do not.

## 4. Publish

Commit any code or data you changed. Then run `powershell -File backend\scripts\refresh.ps1`.
It rebuilds the data, rewrites the landing page's figures (`build_landing.py`), deploys both
V5 sites and V4, records the figures, and commits and pushes the data. Run it in a terminal
without redirecting its output: under Windows PowerShell 5.1, `*> file` turns git's progress
messages into errors and stops the script after the V5 deploy, before the V4 pass. Confirm that https://trumps-economy-the-bill.pages.dev/ serves the new date
and that the `og:image` URL in its HTML carries the new `?v=` date.

## 5. Report to Stewart

Report what moved, in plain words with the dates of the reports. Name each hand-checked figure
you updated, with its source as a link. Name anything you could not verify. Remind him that
Facebook caches link previews: to update a post he has already shared, paste the URL into
https://developers.facebook.com/tools/debug/ and press "Scrape Again". New posts pick up the
new card on their own.
