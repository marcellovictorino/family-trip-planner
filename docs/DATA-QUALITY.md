# Data quality report

`tools/data-report.mjs` is a zero-dependency Node script that summarises a
generated trip dataset so a human can judge whether it's good enough to
travel on. Run it with:

```bash
node tools/data-report.mjs data/copenhagen-2026.json
```

It always exits `0` — this is a report to read, not a gate that blocks a
build. Argument defaults to `data/copenhagen-2026.json` if omitted.

## Reading guide

Some findings are load-bearing; others are cosmetic. Roughly in order of how
much they should worry you:

- **Well-known attractions absent from the dataset** — the reason this tool
  exists. An earlier generated dataset was schema-valid but silently had no
  Tivoli in it; nothing in the validator catches a whole obvious category
  going missing. Anything listed here should be investigated before the trip,
  not just noted.
- **Duplicate or near-duplicate names** — usually means the generator asked
  overlapping batches for the same place and both slipped through. Worth a
  quick check; may just need one entry removed.
- **Templated or suspiciously short descriptions** — a description under the
  schema's 40-character minimum is a real data problem. One in the
  60-character "suspiciously short" band, or an identical description shared
  across places, is a weaker signal but worth a skim — it usually means the
  model ran out of things to say about a place, which correlates with the
  model not really knowing it.
- **Isolated places (empty `near[]`)** — informational, not a defect. A place
  can legitimately be a standalone day trip. Only worth a second look if a
  large fraction of the dataset is isolated, which would suggest the dataset
  is more scattered than a single city break should be.
- **Non-https website URLs** — a broken-link and trust smell, not urgent, but
  cheap to fix if it shows up.
- **Counts by kind/setting, accessibility percentages, price band and
  gluten-free distribution, duration min/median/max** — these are shape
  checks. There's no single right answer, but a family trip guide with, say,
  zero playgrounds or zero free places would be a shape worth questioning.

## Current output

Generated against `data/copenhagen-2026.json`:

```
Data quality report for data/copenhagen-2026.json
20 places

== Counts by kind ==
  attraction: 10 (50%)
  playground: 5 (25%)
  restaurant: 5 (25%)

== Counts by setting ==
  indoor: 10 (50%)
  outdoor: 9 (45%)
  mixed: 1 (5%)

== Baby/pram accessibility ==
  baby_friendly: 15/20 (75%)
  stroller-accessible: 19/20 (95%)
  changing_table: 11/20 (55%)

== Gluten-free distribution ==
  limited: 9 (45%)
  none: 8 (40%)
  good: 3 (15%)

== Price band distribution ==
  free: 9 (45%)
  €€: 6 (30%)
  €: 3 (15%)
  €€€: 2 (10%)

== Isolated places (empty near[]) ==
  5/20 places have no nearby neighbour within the near-radius
    - Experimentarium (experimentarium)
    - Kastellet (kastellet)
    - Broens Gadekøkken (broens-gadekokken)
    - Bermuda Triangle Playground, Nørrebroparken (boernuda-triangle-noerrebroparken)
    - Toddler Playground at Christianshavns Vold (Panterens Bastion) (christianshavns-vold-toddler-legeplads)

== duration_minutes ==
  min: 30
  median: 90
  max: 210

== Templated or suspiciously short descriptions ==
  none found

== Duplicate or near-duplicate names ==
  none found

== Non-https website URLs ==
  none found

== Well-known Copenhagen attractions absent from the dataset ==
  - Den Blå Planet
  - Nyhavn
  - Rundetaarn / the Round Tower
  - The National Aquarium
  - Louisiana Museum of Modern Art
  - Bakken
  - The Little Mermaid
  - Amalienborg
```

This dataset is the earlier 20-place fixture, ahead of the orchestrator's wider
regeneration. The eight attractions absent above are exactly the gap the wider
batch run is meant to close — re-run this report once that dataset lands.
