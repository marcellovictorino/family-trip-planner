# Roadmap

Live: **https://marcellovictorino.github.io/family-trip-planner/**
Task board: `td list` — epics `td-ed4661` (MVP) and `td-1f0fe9` (beyond MVP)

Status as of 1 August 2026.

## Where this stands

The MVP is built, deployed and usable. A family can browse 90 verified Copenhagen
places, filter them by weather, age suitability, cost and duration, build a seven-day
itinerary, record what they have visited and why, and take notes — with the whole thing
cached for use without a signal.

One thing stands between "built" and "proven": nobody has yet opened it on a real iPhone
and turned on airplane mode. Until that happens, offline is an untested claim.

## Shipped

| Slice | What it delivered | Verified by |
| --- | --- | --- |
| S1 | App shell, four tabs, Explore rendering, deployed to GitHub Pages with a service worker | Live URL returns 200; every asset resolves |
| S2 | Research generator driving `claude -p` with web search, plus a validation gate | 90 places generated and validated |
| S3 | Search across six fields and eight filter groups | 14 tests encoding rules R1–R4 |
| S4 | Itinerary: tap-to-assign, reorder, remove, persist | Driven end-to-end in a browser |
| S5 | Favourites, visited, notes, export and import | 13 tests encoding rule R5 |
| S6 | Widened the guide from 3 fixtures to 90 real places | Validator passes; landmarks confirmed present |
| — | Design system applied: tokens, icons, self-hosted fonts, installable PWA | Computed styles checked in a real browser |

74 tests pass under `node --test test/*.test.mjs`. `node tools/verify-app.mjs` checks
asset resolution, CSS URL targets, the manifest, the module graph and the dataset.

Still zero npm dependencies and no build step.

## Next

### Blocking — needs a human

**Offline acceptance test on a real iPhone** (`td-f779f7`). Open the URL in Safari, Add
to Home Screen, open from there, enable airplane mode, force-quit, reopen. The MVP epic
is explicitly blocked on this. Automated checks confirm the service worker registers and
every asset resolves; they cannot prove iOS will not evict the cache.

### Then — data quality

The app's usefulness now rests entirely on generated content, and the schema gate proves
structure, not truth.

- **Isolated places and thin gluten-free coverage** (`td-5d5c84`). Twelve places have no
  `near[]` neighbours. Only 8 of 23 restaurants are rated `good` for gluten-free; the
  rest are `limited`, which is not enough to plan a coeliac meal around.
- **Day trips are unreachable** (`td-920b3a`). Louisiana and Bakken fall outside even the
  padded bounding box, so that batch was cut. Regional batches need their own box.
- **The landmark report over-reports** (`td-e4ea27`). Fixing a substring false negative
  introduced a whole-name false positive; six present landmarks are reported missing.

### Then — scale

- **Verify at 200+ places** (`td-9fdf7e`). The spec targets 200; the guide holds 90.
  Measure before optimising.

## Deferred by choice

Epic `td-1f0fe9`. None of these are needed for the Copenhagen trip to work. Each was cut
to protect the vertical slice, not overlooked.

Interactive map · live weather · budget tracking · reservation tracking · packing
checklist · journal and photo timeline · private hosting via Cloudflare Access · a richer
design pass · drag-and-drop itinerary reordering.

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
