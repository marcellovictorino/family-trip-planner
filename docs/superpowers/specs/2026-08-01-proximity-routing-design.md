# Proximity, travel time and day feasibility

Epic `td-6a2f15`. Designed 1 August 2026.

## Goal

Stop the itinerary pinballing across the city. Three user-facing behaviours:

1. Explore sorts by how far a place is, so distant options sink.
2. The itinerary shows how long each hop takes, and whether the day is doable.
3. Picking a day's activities in any order yields a proposed sensible sequence.

All of it offline, with no dependencies and no live routing API.

## Current state

Every one of the 90 places carries `lat`/`lon`, and `tools/geo.mjs` already ships
`haversineMetres()` plus `computeNear()`, which fills a `near[]` list of everything
within an 800 m walk. Nothing in `src/` reads `near[]` yet.

`filterPlaces()` preserves dataset order; the app has no concept of sorting at all.

The dataset has no opening hours — only a free-text `best_time`. Feasibility can say
how much of a day is spent moving. It cannot say whether a place is shut on arrival,
and must not imply otherwise.

`nearest_metro` is present on all 90 places but as 55 inconsistent free-text values
(`Nørreport`, `Nørreport Station`, `Nørreport St.`). Normalising it is `td-1e55cb`,
deliberately out of scope here.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | One primitive: `travelMinutes(from, to) → { minutes, mode }` | All three surfaces reduce to it. Pure function, no network, trivially testable. |
| D2 | Approach **A + B in one slice** | A alone lies about harbour crossings, and lies optimistically — it makes an infeasible day look fine. That is the one failure worth paying to fix up front. |
| D3 | Rejected: a baked OSRM pair matrix | The free routing demo has no transit profile. It buys real street geometry and loses the public-transport model, which is the wrong trade. It also adds a quadratic blob nobody can review and must be regenerated whenever the dataset is. |
| D4 | Anchor chain: last stop on the active day → trip base → city centre | Anchoring on the last stop is what turns browsing into routing. Base covers morning planning. Centre is the free fallback, derivable from the bbox. |
| D5 | Distance sort is an explicit control, never a silent default | A list that silently reorders when you tap a stop is disorienting. The anchor shows as a dismissible chip so the sort always explains itself. |
| D6 | Auto Re-Order **proposes**, the user accepts and then tweaks | The user's framing: pick the activities, let the app suggest the sequence, adjust from there. Never applied silently. |
| D7 | Exact optimisation, not a heuristic | At 8 or fewer stops the search space is at most 5 040 permutations. Approximating something that cheap would be a worse answer for no saving. |
| D8 | No pram penalty | A single blunt constant would be invented precision; a real step-free model is a data project of its own. The model stays honest and says nothing. |

## The primitive

```js
// src/travel.js
const DETOUR = 1.25;            // streets are not straight lines
const WALK = 60;                // m/min, pram pace
const TRANSIT_SPEED = 400;      // m/min ≈ 24 km/h effective, stops included
const TRANSIT_OVERHEAD = 10;    // walk to the stop, plus waiting

export function travelMinutes(a, b, zones) {
  const override = zoneMinutes(a, b, zones);   // branch B
  if (override !== null) return { minutes: override, mode: "transit" };

  const d = haversineMetres(a, b) * DETOUR;    // branch A
  const walk = d / WALK;
  const ride = TRANSIT_OVERHEAD + d / TRANSIT_SPEED;
  return walk <= ride
    ? { minutes: Math.round(walk), mode: "walk" }
    : { minutes: Math.round(ride), mode: "transit" };
}
```

Branch B reads two new dataset keys. The 19 neighbourhoods collapse to roughly 10
zones; the table is symmetric, so about 55 numbers.

```jsonc
"zones": {
  "indre-by":     { "members": ["Indre By", "Nyhavn", "Slotsholmen"] },
  "refshaleoen":  { "members": ["Refshaleøen"] }
},
"zone_minutes": {
  "indre-by|refshaleoen": 28,   // the harbour, told truthfully
  "indre-by|vesterbro": 9
}
```

Same zone, or a pair the table does not cover: fall through to branch A rather than
throw. A missing number should degrade to a rough answer, never to a broken screen.

The table is small enough for a human to read and correct, and a wrong value shows up
in a diff. That is the whole argument for it over a generated matrix.

## In-app behaviour

**Itinerary.** A connector between consecutive stops carrying a mode glyph and
minutes. A slow leg is coloured, not blocked. The day header gains a split —
time at stops versus time moving — and a quiet long-day flag.

**Explore.** A sort control beside the filter chips. The active anchor renders as a
dismissible chip (`Sorted from Nyhavn ✕`) with its provenance in small text.
Rows show travel time from the anchor rather than raw distance.

**Auto Re-Order.** Offered on a day with three or more stops. Shows the proposed
order and the before/after moving time. Accepting it rewrites the day; the existing
manual reorder arrows keep working unchanged afterwards.

## State

Trip state gains `base` — a lat/lon for where the family is staying. Additive
hydrate, same shape as the v1 → v2 migration: an older payload gains `base: null`
and the anchor chain skips straight to the city centre.

## Build order

1. `td-68dc24` — `src/travel.js`, both branches, tests. Nothing user-visible.
2. `td-77e6c2` — leg times and the day budget. First visible payoff.
3. `td-df9114` — anchored distance sort, plus the `base` field.
4. `td-f05f97` — Auto Re-Order.

Each slice is runnable and demoable on its own. `src/travel.js` joins the module
graph, so `sw.js` needs it in `ASSETS` with a cache bump — `tools/verify-app.mjs`
already fails loudly if that is missed.

## Testing

Tests encode why, not what:

- A short hop stays a walk; a long one becomes transit; the mode flips where expected.
- An Indre By → Refshaleøen leg is not reported as a walk. This is the defect branch B
  exists to prevent, so it is the test that matters most.
- A zone pair absent from the table falls back to the heuristic instead of throwing.
- The anchor chain degrades: no active day → base; no base → centre.
- Auto Re-Order returns a proposal, never a mutation.

## Risks

**The zone table is LLM-authored.** Numbers nobody verifies are confident guesses.
Mitigated by keeping the table small and diffable, and by spot-checking the handful
of pairs that involve water.

**Estimates read as authoritative.** Rounded minutes look precise. Surface them as
approximations in the UI wording, and never let a feasibility flag block an action.

**No opening hours.** A day can be geometrically feasible and still impossible. Out of
scope, and stated plainly rather than papered over.
