# Family Trip Planner

A trip planner built for using *during* a trip, on a phone, with no signal — not for browsing beforehand on a laptop.

First trip: Copenhagen, 2–8 August 2026. Two adults, a 6-year-old, and a 1-year-old.

## The problem

Travel guides optimise for inspiration. A family mid-trip needs something else: what is open, what is indoors now that it is raining, where a 1-year-old can be put down safely, which lunch place has reliable gluten-free options, and what was already agreed for tomorrow. Then it needs to answer all of that on a phone with no data connection.

## How it works: two programs

The obvious design — an app that researches a destination on demand — cannot also work offline with no backend. So the two jobs are separated:

```
tools/generate-trip.mjs     Research. Runs on a laptop, at build time.
                            claude -p with WebSearch, output constrained by a JSON schema.
        │
        ▼
tools/validate-data.mjs     Gate. Untrusted input. Rejects anything outside the
                            trip's bounding box, duplicate ids, dangling references,
                            enum violations. Exits non-zero rather than merging
                            plausible-looking fiction.
        │
        ▼
data/<city>-<year>.json     Verified. Static. Immutable once committed.
        │
        ▼
index.html + src/*.js       The app. Location-agnostic, offline, zero dependencies.
        │
        ▼
GitHub Pages + service worker → Add to Home Screen
```

The app contains no knowledge of Copenhagen. A different trip is one command:

```bash
node tools/generate-trip.mjs --city Lisbon --from 2027-04-02 --to 2027-04-09
```

Two consequences of the split are worth stating explicitly:

- **Facts are asked for; relationships are derived.** The research step supplies coordinates, which can be checked against a bounding box. Proximity between places is then computed locally by haversine distance — never requested from a language model, which would invent it confidently.
- **User state is never in the data file.** Favourites, visited places, notes and the itinerary live in `localStorage` keyed by place id. Regenerating the dataset cannot destroy them.

## Design constraints

| Constraint | Reason |
| --- | --- |
| Zero npm dependencies | Nothing to install, nothing to break, nothing to audit |
| No build step | Files are served exactly as authored |
| Offline after first load | The whole point; verified in airplane mode, not assumed |
| Mobile first, iPhone Safari | Where it will actually be used |
| Tap-to-assign, no drag-and-drop | HTML5 drag does not work on iOS, and a day picker is better on touch anyway |
| No images | Verified, hotlink-stable, cacheable image URLs cost hours and break silently. A category glyph and colour band cost nothing |
| Plain CSS | A design system comes later and must not block function |

## Family rules encoded in tests

Filtering is not generic. Each rule exists for a reason, and each test states that reason so it fails when intent changes rather than when an implementation detail moves.

- Rain filter excludes outdoor-only places but keeps mixed ones — *a soaked 1-year-old ends the day, but somewhere with indoor shelter is still usable.*
- The baby filter requires room for a 1-year-old to move around and deliberately ignores changing tables — *we carry a portable mat; floor space is the thing that cannot be improvised.*
- The under-one-hour bucket never returns a four-hour place — *nap windows are short.*
- One search box covers name, tags, description, category, neighbourhood and metro — *no thinking about which field a word lives in.*
- State survives a dataset regeneration, and a note on a place that has vanished is orphaned rather than deleted.
- A place outside the trip's bounding box fails the build loudly — *silent bad data is worse than no data.*

## Roadmap

Each slice ends with something usable on a phone.

| | Slice | Done when |
| --- | --- | --- |
| S1 | Shell, fixture data, Explore, deployment | The URL opens on an iPhone in airplane mode |
| S2 | Generator, validator, 20 verified real places | `validate-data.mjs` exits 0 on real data |
| S3 | Search and filters | The six family rules pass under `node --test` |
| S4 | Itinerary: add to day, reorder, persist | A 7-day plan survives force-quitting Safari |
| S5 | Favourites, visited, notes, backup | Export and import round-trip the whole state |
| S6 | Widen the dataset to full coverage | ~85 places, zero code changes |

Deferred by choice, not oversight: private hosting via Cloudflare Access, a dedicated design system, an interactive map, live weather, budget tracking, packing lists, transit routing, and a journal.

## Running it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node --test test/             # the whole suite; no install step
```

## Documents

- Design spec — `docs/superpowers/specs/2026-07-31-family-trip-planner-design.md`
- Implementation plan — `docs/superpowers/plans/2026-07-31-family-trip-planner.md`

The plan is deliberately self-contained: each task lists its files, its tests, its implementation and its verification steps, so it can be executed without reading the conversation that produced it.
