# Visited ticks, ratings, and the feedback loop

Design agreed 1 August 2026, via the review artifact at `.lavish/feedback-loop.html`.

## Goal

Turn the itinerary into a todo list you tick as the day happens, capture why each place
was or was not worth it, and accumulate that judgement in the repository so the next
`generate-trip` run produces a better guide than the last one.

The trip starts 2 August 2026. Only the in-app half must exist before the flight. The
scripts are post-trip work and cannot be honestly verified until real ratings exist.

## Current state

Already built, and this design must not break it:

| Thing | Where |
| --- | --- |
| `visited[]` — a flat set of place ids, toggled from Explore and Saved | `src/state.js:52` |
| `notes{}` — one free-text note per place, committed on blur | `src/state.js:56`, `src/views/saved.js:41` |
| `.is-visited` strike-through styling | `styles.css` |
| Export/import of the whole state object as a JSON download | `src/app.js`, `src/views/trip.js` |
| Promise-returning native `<dialog>` pattern | `src/app.js` `askForDay` |
| Research generator, nine category batches | `tools/generate-trip.mjs` |

Constraints held so far and held here: zero npm dependencies, no build step, works fully
offline, static GitHub Pages hosting with no backend.

## Decisions

Every one of these was chosen by the user during review. Where a recommendation was
overruled, that is noted.

| # | Decision |
| --- | --- |
| D1 | Thumb and stars have different jobs. The thumb is the one-tap verdict on the itinerary row; stars are the considered rating inside the sheet. Both optional. |
| D2 | A fixed tag set, **varying by `place.kind`**. Attraction, playground and restaurant fail in different ways and get different vocabularies. |
| D3 | Visited is per `(date, place)` in the Itinerary, and global in Explore. |
| D4 | One note per place, shared across days. Two entry points — the sheet and the Saved tab — editing the same string. |
| D5 | The store is JSONL in git. A real database only if this ever gets a backend. |
| D6 | Notes are committed plainly. The sheet warns that they may become public. |
| D7 | Feedback reaches the next guide as a prompt block only. No exclude list, no dataset rescoring. |
| D8 | Rating happens **only** in the Itinerary view. Explore and Saved keep their plain ✓ and note box. (Overrules the proposed "rate anywhere".) |
| D9 | The Explore ✓ is derived from the day ticks, and still settable by hand. |
| D10 | No rater identity. One shared family device. |

### D9 in full

Ticking a place on any day sets the global `visited` flag. Un-ticking the last remaining
day clears it. The flag can still be set directly from Explore or Saved for somewhere
that was never on the plan.

A place ticked in Explore but never scheduled carries no rating — rating lives in the
Itinerary only, per D8. That is a deliberate gap.

## In-app behaviour

### Itinerary row

- Tapping the row body toggles visited for that `(date, place)`. Visited rows are struck
  through and greyed.
- A visited row loses its reorder arrows and gains a thumb pill (👍 👎). You cannot
  re-plan the past, and the space is better spent on the verdict.
- Pressing 👍 or 👎 records that verdict **and** opens the sheet with it pre-filled.
- Once stars are set, they appear on the row's facts line, so the row is a summary rather
  than a checkbox.
- A not-yet-visited row is unchanged from today: arrows, no thumb pill.

### Rating sheet

A native `<dialog>`, following the existing `askForDay` pattern. Fields, all optional:

1. **Would you recommend to another family?** — 👍 / 👎.
2. **Rating** — one to five stars.
3. **What stood out** — the tag chips for this place's `kind`.
4. **Notes** — the place-level note, the same string the Saved tab edits, with a
   one-line reminder that it may be published.

One button: Done. Every field commits as it is touched, so there is nothing to cancel and
nothing lost by dismissing the sheet.

### Tag vocabulary

Stored as slugs. Labels are presentation.

| kind | tags |
| --- | --- |
| attraction | `baby-great`, `too-crowded`, `worth-money`, `ran-long`, `too-far`, `better-than-expected`, `wrong-age-range`, `do-again` |
| playground | `safe-toddler-area`, `unsafe-for-crawler`, `big-kids-dominated`, `has-shade`, `no-toilet-nearby`, `too-small`, `held-them-hour`, `do-again` |
| restaurant | `gf-reliable`, `gf-claim-wrong`, `high-chair`, `good-kids-menu`, `too-slow`, `overpriced`, `pram-friendly`, `do-again` |

Each maps to a field the generator already emits — `baby_friendly`, `gluten_free`,
`high_chair`, `duration_minutes`, `price_band` — so a tag is a testable claim about the
dataset, not a mood.

## Data model

`trip.state.v1` becomes `trip.state.v2`. The change is purely additive; nothing existing
moves, so there is no destructive migration and an old exported file still imports.

```js
{
  version: 2,
  favourites: [...],
  visited:    [...],   // unchanged — Explore and Saved
  notes:      {...},   // unchanged — one note per place
  days:       {...},   // unchanged — ordered ids per date
  filters:    {...},

  dayLog: {            // new
    "2026-08-02": {
      "tivoli-gardens": {
        done:  true,
        thumb: "up",   // "up" | "down" | null
        stars: 4,      // 1–5 | null
        tags:  ["baby-great", "worth-money"],
        at:    "2026-08-02T18:41:07Z"
      }
    }
  }
}
```

The defensive merge at `src/state.js:18` already tolerates this shape; reading a v1
payload needs only an empty `dayLog` default.

### Store record

One JSONL line per `(trip, day, place)`. Three breakfasts at the same bakery produce three
rows with three dates — the signal "we went back", which a single global rating erases.

```json
{"trip":"copenhagen-2026-08","city":"Copenhagen","month":"2026-08",
 "visited_on":"2026-08-02","place_id":"tivoli-gardens","name":"Tivoli Gardens",
 "kind":"attraction","category":"amusement-park","neighbourhood":"Vesterbro",
 "price_band":"€€","planned_minutes":240,"gluten_free":"good","baby_friendly":true,
 "thumb":"up","stars":4,"tags":["baby-great","worth-money"],
 "note":"Family zone rides open 11:00…","rated_at":"2026-08-02T18:41:07Z"}
```

Place attributes are denormalised at ingest from `data/<trip>.json`. That is what lets a
row answer a question years later — *are €€€ places ever worth it?* — with the original
dataset long since regenerated. The place-level note is copied onto every row for that
place; the redundancy is in the store, not the interface.

Path: `feedback/<YYYY-MM>-<city>.jsonl`, git-tracked.

## The two scripts

### `tools/ingest-feedback.mjs`

Joins an exported state file against the dataset it came from and appends rows.
Idempotent on `(trip, visited_on, place_id)`: re-ingesting the same export replaces rows
rather than duplicating them. Refuses to run if the export's city and dates do not match
the dataset's.

### `tools/feedback-digest.mjs`

Reads every JSONL file and writes two briefs:

- `feedback/PREFERENCES.md` — portable family signals that hold in any city. *Playgrounds
  with a separate toddler area rate 4.6; shared-equipment ones rate 2.1.*
- `feedback/corrections/<city>.md` — place-specific facts, useful only on return. *Tivoli
  family rides open 11:00, not 10:00.*

Both state sample sizes inline, so thin evidence is visibly thin. `generate-trip.mjs`
prepends both to every batch brief. Markdown, not a query, because the consumer is an LLM
prompt and because a bad aggregate must be readable and hand-editable before it poisons a
run.

A later addition, captured now: the digest also reads the free-text notes and **proposes
tag-set changes** — new tags for themes that recur in prose, retirement for tags nobody
taps. The vocabulary then evolves from use rather than from guesses made today.

## Build order

| Slice | Delivers | Done when | When |
| --- | --- | --- | --- |
| S7 | Tappable itinerary rows, strike-through, thumb pill, rating sheet, kind-specific tags, `dayLog` in state v2, storage-quota errors surfaced | Rate a place on the phone, force-quit, reopen — still there. An old export still imports. | Before the flight |
| S8 | `tools/ingest-feedback.mjs`, the JSONL store, the first real Copenhagen rows, a record-shape validator | Export from the phone, run one command, read the git diff. Re-run: no duplicates. | Post-trip |
| S9 | `tools/feedback-digest.mjs`, the two briefs, the `generate-trip.mjs` prompt injection, tag-vocabulary proposals | Generate a second city's guide and point at a line that exists because of Copenhagen | Post-trip |
| S10 | Shared trips: hosted app, Google sign-in, server-side state so two parents edit one itinerary. A backend database replaces JSONL as the primary store. | Roadmap entry only | Someday |

S7 is deliberately useful with S8 and S9 never built — the ratings sit in the export file
regardless. If the trip ends with three ratings, the pipeline was not worth building, and
that is worth knowing before building it.

S10 exists because the current design cannot support two people editing one trip: state
lives in one browser's localStorage and two phones cannot see each other without a server.

## Testing

Following the existing convention — `node --test test/*.test.mjs`, no runner, rules
numbered like R1–R5 in the current suite.

- R6: ticking a day entry sets the global visited flag; un-ticking the last day entry
  clears it; un-ticking one of two leaves it set.
- R7: a v1 payload loads into v2 with an empty `dayLog` and no data loss.
- R8: the tag list offered for a place matches its `kind`.
- R9: a rating survives a state round-trip through export and import.
- R10: a storage write that throws surfaces an error rather than failing silently.

## Risks

**Nobody rates anything.** The commonest failure of feedback features. Mitigated by making
👍 one tap from the itinerary and everything else optional. If it still does not happen,
S8 and S9 stay unbuilt — the deferral is the hedge.

**Fat-finger ticks.** The row body becomes the biggest tap target on screen. Un-tapping
restores it, so the blast radius is one tap, but it needs watching on a real phone.

**Storage quota.** Unbounded notes plus a cached 90-place dataset. A quota error currently
throws inside `commit()` and the write is lost silently. S7 surfaces it.

**Overfitting to one trip.** A dozen ratings is not a preference model. The digest states
sample sizes so both the LLM and the reader can discount thin evidence.
