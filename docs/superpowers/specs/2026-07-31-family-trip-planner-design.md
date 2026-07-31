# Family Trip Planner — Design

Date: 2026-07-31
Status: approved
First trip: Copenhagen, 2–8 Aug 2026

## Goal

A trip planner a family actually uses *during* the trip, on an iPhone, with no signal.
Two adults, a 6-year-old and a 1-year-old.

Success criteria:

1. Discover places by weather, age suitability, cost and duration.
2. Build and edit a 7-day itinerary.
3. Record visited places and free-text notes that survive data regeneration.
4. Find gluten-free, family-friendly food.
5. Work offline on an iPhone home screen.
6. Reusable for a different city without touching app code.

## Architecture: two programs

The original brain-dump spec contained an unresolvable contradiction: "the app does the
research" requires live web + an LLM; "no backend, no dependencies, offline" forbids it.

Resolution — research is a **build step**, not a runtime feature:

```
tools/generate-trip.mjs     claude -p headless + WebSearch. Runs on the laptop. Smart.
        ↓ raw batches
tools/validate-data.mjs     schema · bbox · dupes · refs. Rejects hallucinations loudly.
        ↓ pass
data/<city>-<year>.json     verified, static, immutable
        ↓ fetch
src/*.js + index.html       location-agnostic reader. Offline. Dumb.
        ↕
localStorage                favourites · visited · notes · days
        ↓
GitHub Pages + service worker → Add to Home Screen
```

The app contains no Copenhagen knowledge. A new trip is:

```
node tools/generate-trip.mjs --city Lisbon --from 2027-04-02 --to 2027-04-09
```

### Why `claude -p` and not the OpenAI API

`claude -p` has WebSearch built in, needs no API key in the script, and needs no SDK —
which keeps the project at **zero npm dependencies**, as the original spec demanded.
The OpenAI path would have added one.

```
claude -p "<batch prompt with JSON schema inline>" \
  --model claude-sonnet-5 \
  --effort medium \
  --allowed-tools WebSearch \
  --output-format json
```

Structured output is enforced by us, not the model: parse, validate against
`src/schema.mjs`, and re-request the batch on failure. Never merge an invalid batch.

The research call lives in a single `runResearch(prompt)` function with the command held in
one constant, so a `pi`-driven gpt backend can replace it by editing one place. Claude is
preferred for now on output quality. This is a single seam, not an abstraction layer.

## Data model

One collection. `activities[]` + `restaurants[]` + playgrounds collapse into `places[]`
discriminated by `kind`, because they share the same card, filters and itinerary
behaviour. This removes roughly 40% of the render code implied by the original spec.

```jsonc
{
  "trip": {
    "city": "Copenhagen", "country": "Denmark",
    "from": "2026-08-02", "to": "2026-08-08",
    "bbox": { "west": 12.40, "east": 12.70, "south": 55.60, "north": 55.75 },
    "generated_at": "2026-07-31T14:00:00Z"
  },
  "places": [{
    "id": "tivoli",
    "name": "Tivoli Gardens",
    "kind": "attraction",              // attraction | playground | restaurant
    "category": "theme-park",
    "neighbourhood": "Indre By",
    "lat": 55.6736, "lon": 12.5681,
    "description": "…why this family should go",
    "duration_minutes": 240,
    "price_band": "€€€",               // free | € | €€ | €€€
    "booking": "recommended",          // none | recommended | required
    "booking_url": "…", "website": "…", "maps_url": "…",
    "setting": "outdoor",              // indoor | outdoor | mixed
    "ages": ["toddler", "child", "adult"],   // baby | toddler | child | adult
    "baby_friendly": true,             // space for a 1yo to move around safely
    "stroller": true,
    "changing_table": true,            // informational only, never a filter gate
    "baby_notes": "Quiet garden by the lake for naps",
    "gluten_free": "good",             // none | limited | good
    "kids_menu": true, "high_chair": true,
    "nearest_metro": "København H",
    "tags": ["classic", "evening"],
    "tips": "Enter before 11:00",
    "best_time": "morning",
    "near": [{ "id": "glyptoteket", "walk_minutes": 4 }]
  }]
}
```

`trip.bbox` is derived by the generator from the target city, not hardcoded, so the
validator stays generic across cities.

### Agreed thresholds

These were undefined in the original spec. The generator prompt states them explicitly so
bands mean the same thing for every place.

| Concept | Definition |
| --- | --- |
| `price_band` | `free` = 0 kr · `€` < 100 kr · `€€` 100–200 kr · `€€€` > 200 kr, per adult entry or per main course |
| Duration buckets | `<1h` ≤ 60 min · `1–2h` 61–120 · `half day` 121–240 · `full day` > 240 |
| `near[]` radius | 800m haversine, walking minutes quoted at a slow family pace of 60 m/min (≈13 min at 800m), not an adult 80 m/min |

### Fields deliberately excluded

| Excluded | Reason |
| --- | --- |
| `heroImage` | Verified, hotlink-stable, offline-cacheable image URLs are the largest time sink and the main source of broken UI. Replaced by a category glyph and colour band. |
| `rating` | A model inventing `4.6` creates false authority in an unfamiliar city. |
| `recommendation` | Redundant with `description`. Two prose fields double generation cost and invite drift. |
| `weather` | Derivable from `setting`. Two fields that can disagree is a latent bug. |
| `visited` / `favorite` / `notes` | User state, not trip data. See below. |

### User state is separate from trip data

The original spec placed `visited`, `favorite` and `notes` on the place object. That
means regenerating the dataset destroys the user's notes — data loss mid-trip.

User state lives in `localStorage` under one key, keyed by place `id`:

```js
localStorage["trip.state.v1"] = {
  version: 1,
  favourites: ["tivoli"],
  visited: ["rundetaarn"],
  notes: { tivoli: "buy tickets Sunday night" },
  days: { "2026-08-03": ["tivoli", "madkaffe"] },   // array order = itinerary order
  filters: { setting: null, ages: [], price: [], duration: null, kind: null }
}
```

The data file is immutable. Regeneration is always safe.

### Relationships are computed, never requested

The original spec asked the model for `nearbyRestaurants[]`, `nearbyPlaygrounds[]` and
`nearbyActivities[]` — three lists an LLM will invent confidently.

The model supplies only `lat`/`lon`, which are checkable. `near[]` is computed locally by
haversine distance under 800m, with walking minutes derived at 80m/min. Ask for facts;
derive relationships.

## Validation gate

Generator output is untrusted. `tools/validate-data.mjs` exits non-zero on:

- `lat`/`lon` outside `trip.bbox`
- duplicate `id`
- unresolvable `near[].id`
- enum violation on `kind`, `setting`, `price_band`, `booking`, `gluten_free`, `ages`
- missing required field

Places are requested in batches by category (indoor-rainy, outdoor-sunny,
playgrounds-baby, restaurants-gluten-free, evening, day-trip) so a single bad batch is
re-requested rather than poisoning the dataset. Nothing invalid is ever merged silently.

## Interface

Four tabs, navigation on top. The 1-year-old travels in a stroller, so one-handed
thumb-reach is not a constraint; top navigation is conventional and simpler.

| Tab | Contents |
| --- | --- |
| Explore | search, filter chips, place cards, expand in place |
| Itinerary | seven day sections, ordered lists, `⌃⌄` reorder, remove |
| Saved | favourites, visited, all notes in one view |
| Trip | countdown, visited count, export/import state JSON |

Export/import exists so notes can be backed up before regenerating data.

Excluded from the original spec: Settings (nothing to configure), Footer, Dashboard as a
separate screen, Restaurants / Favorites / Progress as separate sections (each was the
same cards under a different filter), collapsible panels, completion percentage, weather
placeholders.

### Itinerary interaction

Tap-to-assign, not drag-and-drop. A card offers "Add to day", which opens a day picker;
the day view reorders with up/down controls. HTML5 drag events do not fire on iOS
Safari, so drag would require a hand-rolled pointer-event implementation — roughly five
hours for an interaction that is worse on touch than a day picker.

`days` maps ISO date to an ordered array of place ids, so drag can be layered on later
without changing the data shape.

### Styling

Plain, restrained CSS. A dedicated design system will be produced separately and applied
in a later slice. Visual design must not block functional development.

## Files

```
index.html   styles.css   sw.js
src/  app.js state.js filter.js dom.js schema.mjs
      views/explore.js views/itinerary.js views/saved.js views/trip.js
tools/ generate-trip.mjs validate-data.mjs
test/  filter.test.mjs state.test.mjs data.test.mjs      (node --test)
data/  copenhagen-2026.json
```

`src/schema.mjs` is imported by the generator, the validator and the data test, so there
is one definition and no drift. Files are kept small and single-purpose so parallel
agents can work without collisions.

## Testing

Each test encodes the family reason for the behaviour, so it fails when intent changes
rather than when an implementation detail moves.

| Test | Business reason |
| --- | --- |
| rain filter excludes `setting: outdoor`, keeps `indoor` and `mixed` | a soaked 1-year-old ends the day; a place with indoor shelter is still usable |
| baby filter requires `baby_friendly`, and ignores `changing_table` | what matters is somewhere the 1-year-old can move around; we carry a portable changing mat |
| `<1h` bucket returns only `duration_minutes ≤ 60` | nap windows are short |
| search matches name, tags, description, category, neighbourhood, metro | one box, no thinking about which field |
| state round-trips through a regenerated dataset; a note on a place that vanishes is orphaned, not deleted | notes must survive re-research |
| validator rejects a place outside `trip.bbox` | hallucinations must fail loudly, not silently |
| validator rejects an unresolvable `near[].id` | a dangling reference is a generator bug |

## Deployment

GitHub Pages from a public repository, plus a service worker for offline use.

Private Pages requires GitHub Enterprise Cloud and an organisation-owned repository, so
it is unavailable on a personal plan: a Pages site is public even from a private repo.
This is acceptable because the repository contains only public tourist information —
favourites, notes and the itinerary live in `localStorage` on the device and are never
uploaded.

Cloudflare Pages with Cloudflare Access is the private-hosting path, deferred to a later
phase.

The service worker versions its cache name so a deployment cannot become permanently
un-updatable. Offline behaviour is verified in airplane mode during slice 1, not on the
first day of the trip.

## Slices

Each slice is deployed and usable on a phone before the next begins.

| # | Slice | Rationale for position |
| --- | --- | --- |
| S1 | Skeleton, three fixture places, Explore renders, deployed to Pages with a service worker, verified offline on the phone | Deployment is the largest unknown; prove it first |
| S2 | Generator and validator producing 20 verified real places | Establish the real data shape before building more UI on assumptions |
| S3 | Search and filters | Pure logic, test-first, parallelisable |
| S4 | Itinerary: tap-to-assign, reorder, persistence | The core productivity loop |
| S5 | Favourites, visited, notes, Saved and Trip tabs | Builds on `state.js`, already tested by this point |
| S6 | Re-run the generator to reach 85 places | Data only, zero code change — the payoff of the two-program split |

## Delegation

Pure-logic modules are delegated to `claude -p` (sonnet 5, medium effort) via herdr tabs
driven by loopctl, with tests written first as the specification:
`filter.js`, `state.js`, `schema.mjs`, `generate-trip.mjs`, `validate-data.mjs`.

Retained in the main thread: `styles.css`, the view modules, layout and the service
worker. Visual judgement delegates poorly, and parallel agents editing shared CSS
conflict.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Data quality: gluten-free status and opening hours go stale, and a model may state them confidently regardless | High | Schema and bbox gates catch structure, not truth. Every place carries `website` so the two or three that matter can be checked from the phone before going. |
| Service worker caches so aggressively the app cannot be updated | Medium | Versioned cache name; airplane-mode verification in S1 |
| Generator wall-clock time: web search is slow | Low | Batched, roughly six calls for 85 places; runs on the laptop, off the critical path |

## Deferred

- Cloudflare Pages with Access for private hosting
- Applying a dedicated design system
- Interactive map (Leaflet), live weather, budget tracking, packing checklist, journal,
  transit routing, timeline view, GPS "nearby" mode
- Images, if they later prove worth the maintenance
