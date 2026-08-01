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
| No place photography | Verified, hotlink-stable, cacheable image URLs for *places* cost hours and break silently. A category glyph and colour band cost nothing. This is narrower than "no images" — the app icon and the self-hosted font files below are images and fonts, not place photos, and carry none of that risk because they ship once, in the repo, at a fixed set of sizes |

## Design system

A design system was produced separately from this app (see `docs/design/design-system.md`) and its outputs are vendored here rather than linked externally, so the app keeps working with no network access:

- `design/tokens/*.css` — colour, typography, spacing, shape and motion custom properties. These are the single source of truth for values: `styles.css` is written to match them rather than inventing its own numbers, so a token changing in one place is a deliberate, traceable decision, not a drift.
- `assets/icons/` — the app icon at 180/192/512px plus a maskable 512px tile, wired up through `manifest.webmanifest` and the `<link rel="apple-touch-icon">` in `index.html`.
- `assets/fonts/` — Bricolage Grotesque, Nunito Sans and JetBrains Mono, self-hosted as `.woff2` files and declared in `design/tokens/fonts.css`.

The one deliberate deviation from the design system as published: its font tokens `@import` the same three typefaces from Google Fonts, but a runtime font fetch is exactly the kind of thing that breaks in airplane mode, which is the app's core promise. The fonts are vendored as static files and served from the app's own cache instead. `docs/design/ADHERENCE.md` has the full token-by-token mapping and every other deviation, with reasons.

## Family rules encoded in tests

Filtering is not generic. Each rule exists for a reason, and each test states that reason so it fails when intent changes rather than when an implementation detail moves.

- Rain filter excludes outdoor-only places but keeps mixed ones — *a soaked 1-year-old ends the day, but somewhere with indoor shelter is still usable.*
- The baby filter requires room for a 1-year-old to move around and deliberately ignores changing tables — *we carry a portable mat; floor space is the thing that cannot be improvised.*
- The under-one-hour bucket never returns a four-hour place — *nap windows are short.*
- One search box covers name, tags, description, category, neighbourhood and metro — *no thinking about which field a word lives in.*
- State survives a dataset regeneration, and a note on a place that has vanished is orphaned rather than deleted.
- A place outside the trip's bounding box fails the build loudly — *silent bad data is worse than no data.*

## Status and roadmap

Seven slices are shipped: the app is live with 90 verified Copenhagen places, 98 tests
pass, and it installs to an iPhone home screen. One claim remains unproven — nobody has
yet opened it on real hardware and turned on airplane mode.

See **[ROADMAP.md](ROADMAP.md)** for what shipped, what is next, and what was deliberately
deferred; **[CHANGELOG.md](CHANGELOG.md)** for the release history. Live work is tracked
in `td`: `td list`.

| Slice | Delivered |
| --- | --- |
| S1 | Shell, four tabs, Explore, deployed with a service worker |
| S2 | Generator driving `claude -p` with web search, plus a validation gate |
| S3 | Search across six fields, eight filter groups |
| S4 | Itinerary: tap-to-assign, reorder, persist |
| S5 | Favourites, visited, notes, export and import |
| S6 | 90 real places — 51 attractions, 16 playgrounds, 23 restaurants |
| S7 | Tick a stop off, thumb it, rate it: stars, kind-specific tags and a note |

## Running it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node --test test/*.test.mjs   # the whole suite; no install step
```

## Documents

- Design spec — `docs/superpowers/specs/2026-07-31-family-trip-planner-design.md`
- Implementation plan — `docs/superpowers/plans/2026-07-31-family-trip-planner.md`

The plan is deliberately self-contained: each task lists its files, its tests, its implementation and its verification steps, so it can be executed without reading the conversation that produced it.
