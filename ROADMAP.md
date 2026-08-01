# Roadmap

Live: **https://marcellovictorino.github.io/family-trip-planner/**
Task board: `td list` — epics `td-ed4661` (MVP), `td-1f0fe9` (beyond MVP),
`td-0f99ca` (feedback loop) and `td-6a2f15` (logistics)

Status as of 1 August 2026.

## Where this stands

The MVP is built, deployed and proven on hardware. A family can browse 98 verified
Copenhagen places, filter them by weather, age suitability, cost and duration, build a
seven-day itinerary ordered so it does not pinball across the city, tick each stop off as
the day happens, rate it and say why, and take notes — with the whole thing cached for
use without a signal.

The offline claim is no longer a claim: the app has been opened from an iPhone home
screen in airplane mode and still worked (`td-f779f7`).

What is left is mostly post-trip by design. The feedback loop's second half needs real
ratings to build against, and the guide's accuracy needs a trip to test it.

## Shipped

| Slice | What it delivered | Verified by |
| --- | --- | --- |
| S1 | App shell, four tabs, Explore rendering, deployed to GitHub Pages with a service worker | Live URL returns 200; every asset resolves |
| S2 | Research generator driving `claude -p` with web search, plus a validation gate | 90 places generated and validated |
| S3 | Search across six fields and eight filter groups | 14 tests encoding rules R1–R4 |
| S4 | Itinerary: tap-to-assign, reorder, remove, persist | Driven end-to-end in a browser |
| S5 | Favourites, visited, notes, export and import | 13 tests encoding rule R5 |
| S6 | Widened the guide from 3 fixtures to 90 real places | Validator passes; landmarks confirmed present |
| S7 | Tick a stop off, thumb it, rate it: stars, kind-specific tags, a note | Nine-point walkthrough driven in a browser; 24 tests |
| S11–S14 | Logistics: travel-time primitive, itinerary leg times and a day budget, anchored distance sort, Auto Re-Order | 132-line `travel.test.mjs` plus view tests; `verify-app` green |
| — | Data quality: gluten-free `good` from 7 to 15 restaurants, landmark matching fixed, guide widened to 98 places | Validator passes; a test per matching direction |
| — | Design system applied: tokens, icons, self-hosted fonts, installable PWA | Computed styles checked in a real browser |
| — | Offline acceptance on a real iPhone (`td-f779f7`) | Home-screen launch in airplane mode, by hand |

127 tests pass under `node --test test/*.test.mjs`. `node tools/verify-app.mjs` checks
asset resolution, CSS URL targets, the manifest, the module graph, that every module in
that graph is precached by the service worker, and the dataset.

Still zero npm dependencies and no build step.

## Next

### Blocking — needs a human

**Spot-check the zone table** (`td-6a2f15`). The nine-zone transit table in
`data/copenhagen-2026.json` holds researched estimates, not measured journeys. The
water-crossing pairs are the ones that matter, because correcting exactly those is why
the table exists: if `indre-by|refshaleoen: 28` is wrong, the app now states a confident
number it invented. Everything else in the model degrades gracefully; this does not.

### Then — data quality

The app's usefulness rests on generated content, and the schema gate proves structure,
not truth.

- **Day trips are unreachable** (`td-920b3a`). Louisiana and Bakken fall outside even the
  padded bounding box, so that batch was cut. Regional batches need their own box.
- **`nearest_metro` is 55 free-text variants** (`td-1e55cb`). `Nørreport`,
  `Nørreport Station` and `Nørreport St.` are three separate values across 98 places.
  Blocks any future station-graph routing; deliberately out of scope for S11–S14, which
  need only coordinates.

### Then — scale

- **Verify at 200+ places** (`td-9fdf7e`). The spec targets 200; the guide holds 98.
  Measure before optimising. Note that Auto Re-Order is exact only to eight stops a day,
  which is a per-day bound and does not move with the dataset.

## Shipped — logistics

Epic `td-6a2f15`. Designed and built 1 August 2026; full spec in
`docs/superpowers/specs/2026-08-01-proximity-routing-design.md`.

A seven-day plan that ignores geography sends a family back and forth across the city.
This closes that, without a routing API or a network call: `travelMinutes(from, to)` is a
haversine estimate with a walk branch and a transit branch, corrected by a nine-zone
table for the pairs a straight line gets dangerously wrong. Explore sorts from an anchor,
the itinerary shows leg times and a moving-versus-stopped budget, and Auto Re-Order
proposes a running order the user accepts or dismisses.

A baked pair matrix from a real routing engine was considered and rejected: the free
service has no transit profile, so it would have bought street geometry at the cost of
the public-transport model, and shipped a quadratic blob nobody could review.

## Next — the feedback loop

Epic `td-0f99ca`. Designed 1 August 2026; full spec in
`docs/superpowers/specs/2026-08-01-visited-feedback-loop-design.md`.

The guide is generated, and nothing currently tells us whether any of it was any good.
This closes that: tick stops off as the day happens, say why they worked or did not, and
accumulate that judgement in the repository so the next `generate-trip` run starts from
what the last trip taught.

- **S7 · Tick and rate** — **shipped 1 August 2026** (`td-319ae6`). Tapping an itinerary row marks the stop visited —
  struck through and greyed. A visited row swaps its reorder arrows for a 👍/👎 pill; the
  thumb records a verdict and opens a sheet with stars, tag chips and a note. Tags vary by
  `place.kind`, because a playground and a restaurant fail in different ways. State gains a
  per-`(date, place)` `dayLog`; the Explore visited flag derives from it. Un-ticking a
  rated stop keeps the rating, so a stray tap costs nothing.
- **S8 · Ingest** (`td-f7cc82`). One command turns an exported state file into rows in
  `feedback/<YYYY-MM>-<city>.jsonl`, denormalising place attributes so a row still means
  something after the dataset is regenerated. JSONL rather than a committed SQLite or
  DuckDB file: a binary in git cannot be diffed or merged, and it would break the
  zero-dependency rule. DuckDB stays available as an optional read-only lens.
- **S9 · Close the loop** (`td-0de853`). A digest splits findings into portable family
  signals and city-specific corrections, both stating sample sizes, and
  `generate-trip.mjs` prepends them to every batch brief. Prompt guidance only — no
  exclude list, no dataset rescoring, because a dozen ratings is not a preference model.

S8 and S9 are post-trip work by design. Building them now means building against imagined
data; S7 is useful with neither ever built, since the ratings ride along in the existing
export file.

Two S7 decisions the review recorded rather than fixed, both chosen deliberately.
Hand-ticking a place in Explore, then ticking and un-ticking it on a day, clears the
hand-set flag — one rule, no provenance tracking, and re-ticking in Explore restores it.
And an un-ticked-but-rated row still shows its stars while styled as not visited, which
is the only remaining signal that the preserved rating exists. The rest of the review's
deferred items are in `td-37a677`.

## Deferred by choice

Epic `td-1f0fe9`. None of these are needed for the Copenhagen trip to work. Each was cut
to protect the vertical slice, not overlooked.

Interactive map · live weather · budget tracking · reservation tracking · packing
checklist · journal and photo timeline · private hosting via Cloudflare Access · a richer
design pass · drag-and-drop itinerary reordering.

**Shared trips** (`td-fa47a8`) is the largest of them and the one that changes the
architecture. Two parents cannot edit one itinerary today: state lives in a single
browser's localStorage, and two phones cannot see each other without a server. It would
need a deployed app (Cloudflare), Google sign-in, and server-side trip state — at which
point a backend database replaces the JSONL feedback store.

Two carry a constraint worth stating before anyone starts. A **Leaflet map** needs
vendored library code and offline tiles, which collides head-on with the zero-dependency
and offline rules. **Live weather** needs a runtime network call and must degrade to the
existing manual Rainy and Sunny chips when there is no signal.

## Reusing this for another trip

The app holds no knowledge of Copenhagen. A different city is one command:

```bash
node tools/generate-trip.mjs --city Lisbon --country Portugal \
  --from 2027-04-02 --to 2027-04-09 --out data/lisbon-2027.json
node tools/validate-data.mjs data/lisbon-2027.json
node tools/data-report.mjs  data/lisbon-2027.json
```

Then point `DATA_URL` in `src/app.js` at the new file and bump the cache version in
`sw.js`. The landmark list inside `tools/data-report.mjs` is Copenhagen-specific and
would need swapping for the new city.

## How this was built

Three parallel Claude sessions in Herdr tabs plus an orchestrator, with strict per-agent
file ownership so concurrent work could not collide. The practices that mattered, and the
traps, are recorded in `RESUME.md`. The adversarial review that caught six real defects is
in `docs/REVIEW.md`.
