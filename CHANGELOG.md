# Changelog

Notable changes, newest first. Dates are the day the work merged to `main`.

## 1 August 2026 — S11–S14: logistics

Stops the itinerary pinballing across the city. Explore can sort by how far a place is,
the itinerary shows how long each hop takes, and a day can propose its own running order.
All of it offline, with no dependencies and no routing API
(`docs/superpowers/specs/2026-08-01-proximity-routing-design.md`).

### Added

- `src/travel.js`: `travelMinutes(from, to)` returning minutes and a mode. Haversine
  distance with a detour factor, a walk branch and a transit branch, taking whichever is
  cheaper.
- A nine-zone table in the dataset overrides that estimate for cross-zone pairs. Straight
  lines lie about harbour crossings, and lie optimistically — Refshaleøen is 1.4 km from
  Nyhavn as the crow flies and nowhere near a 20-minute walk. A pair the table does not
  cover falls back to the estimate rather than throwing.
- Itinerary legs: a connector between consecutive stops showing mode and minutes, with a
  slow leg coloured rather than blocked. The day header splits time at stops from time
  moving, and flags a long day quietly.
- Explore gains an explicit **Nearest first** sort. The anchor is the last stop on the
  active day, else where you are staying, else the city centre — always shown as a
  dismissible chip, because a list that silently reorders itself when you tap a stop is
  disorienting.
- **Auto Re-Order** proposes a running order for a day and shows the before and after
  moving time. At eight or fewer stops the optimal order is an exact search over at most
  5 040 permutations, so nothing is approximated. It is a proposal you accept or dismiss;
  it never rewrites a day on its own.

### Changed

- State is now `trip.state.v3`, adding `base` for where the family is staying. Additive,
  same shape as v1 → v2: an older payload gains `base: null` and the anchor chain skips
  to the city centre.

### Known limitation

The zone table's numbers are researched estimates, not measured journeys. The
water-crossing pairs are the ones worth checking against reality before trusting them,
since correcting exactly those is the reason the table exists. Separately, the dataset
carries no opening hours — only a free-text `best_time` — so a day can be geometrically
feasible and still impossible. Nothing in the app implies otherwise.

## 1 August 2026 — data quality

- Gluten-free coverage across the guide's restaurants went from 7 rated `good` to 15.
  Only the dedicated gluten-free batch had been briefed for it, so weak coverage leaked
  in through the quick-meal and evening batches. The guide now holds 98 places.
- `tools/data-report.mjs` matched landmark names by whole-name equality, which fixed a
  substring false negative by introducing a false positive: six landmarks that were
  present were reported missing. Matching is now by word-boundary prefix, with a test for
  each direction.
- The twelve places with an empty `near[]` were investigated and left alone. At an 800 m
  radius that is accurate geography, not a defect.

## 1 August 2026 — S7: tick and rate

Turns the Itinerary into a todo list you tick as the day happens, and captures why each
stop was or was not worth it. The first half of the feedback loop
(`docs/superpowers/specs/2026-08-01-visited-feedback-loop-design.md`); the ingest and
digest scripts follow after the trip, once there are real ratings to build against.

### Added

- Tapping an itinerary row marks that stop visited for that day — struck through and
  greyed. Tapping again un-ticks it.
- A visited row swaps its reorder arrows for a 👍/👎 pill. Pressing a thumb records the
  verdict and opens a rating sheet with it already set.
- Rating sheet: recommend-to-another-family thumb, one-to-five stars, tag chips, and the
  place's note. Every field commits as it is touched, so dismissing the sheet loses
  nothing. Tapping an already-set thumb or star clears it.
- Tag vocabulary varies by `place.kind` — attractions, playgrounds and restaurants fail
  in different ways, and each tag maps to a field the research generator emits, so a tag
  is a testable claim about the dataset rather than a mood.
- Stars appear on the itinerary row once given, so a day reads as a summary.
- `tools/verify-app.mjs` now fails if any module in the app's import graph is missing
  from the service worker's precache list.

### Changed

- State is now `trip.state.v2`. The change is additive: a new `dayLog`, keyed
  `date → place id → {done, thumb, stars, tags, at}`. Nothing existing moves, and a v1
  payload — stored or imported — upgrades with no data loss.
- The global `visited` flag is derived from the day ticks: ticking any day sets it,
  un-ticking the last remaining day clears it. It can still be set by hand from Explore
  for somewhere that was never on the plan.
- Un-ticking a stop that carries a rating keeps the entry with `done: false` rather than
  deleting it — a stray tap must not cost a rating. Ingest will skip those rows.

### Fixed

- A failed `localStorage` write now throws and surfaces to the user instead of vanishing
  silently, and the in-memory state no longer diverges from what is on disk. Notes are
  unbounded text beside a cached 90-place dataset, so a full quota mid-trip is realistic.
- `src/schema.mjs` was reachable from the app's import graph but absent from the service
  worker's precache list — a genuine offline hole, found by the new coverage check.
- A cache miss for a sub-resource no longer falls back to `index.html`. Serving HTML for
  a module script fails the MIME check and kills the import chain, turning a partly-failed
  install into a blank screen offline. The shell fallback is now scoped to navigations.

## 1 August 2026 — S1–S6: the MVP

App shell and four tabs, deployed to GitHub Pages with a service worker. A research
generator driving `claude -p` with web search behind a validation gate that rejects
anything outside the trip's bounding box. Search across six fields and eight filter
groups. An itinerary with tap-to-assign, reorder and remove. Favourites, visited, notes,
export and import. The guide widened from three fixtures to 90 verified Copenhagen
places. The design system applied: tokens, icons, self-hosted fonts, installable PWA.

Zero npm dependencies and no build step throughout.
