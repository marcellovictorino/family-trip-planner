# S7 — Tick and rate itinerary stops · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Itinerary into a todo list — tap a stop to strike it through, tap 👍/👎 to record a verdict and open a sheet for stars, tags and a note — with everything stored locally and surviving a force-quit.

**Architecture:** State gains one additive key, `dayLog`, keyed `date → place id → { done, thumb, stars, tags, at }`. The global `visited[]` is kept in sync from it. Two new modules: `src/feedback.js` (pure tag vocabulary, no DOM) and `src/views/rating.js` (builds the sheet element; the caller shows it). The Itinerary view learns to render a done row. `src/app.js` wires the handlers, exactly as it already does for `askForDay`.

**Tech Stack:** Vanilla ES modules, no build step, no dependencies. Tests are `node --test test/*.test.mjs` against a hand-rolled fake DOM already living in `test/views.test.mjs`.

Spec: `docs/superpowers/specs/2026-08-01-visited-feedback-loop-design.md`. Task: `td-319ae6`.

## Global Constraints

- **Zero npm dependencies. No build step.** Nothing may be added to make this work.
- **Must work fully offline.** No network call at any point in this feature.
- **Static hosting, no backend.** All state lives in `localStorage`.
- **British English** in all user-visible copy (`favourite`, `neighbourhood`, `recommend`).
- **Tap targets ≥ `var(--tap-min)`** — the design system's minimum. Never hardcode pixel sizes where a token exists.
- **No icon font, no SVG icons.** Facilities and glyphs are emoji, per `docs/design/components/core/FacilityIcon.prompt.md`.
- **Existing tests must keep passing unchanged.** `renderItinerary` is called in four existing tests without `dayLog` or the new handlers; both must default so those calls still work.
- **Tests encode the business reason**, following the `R1`–`R5` comment convention already in `test/`.
- Run the full suite with `node --test test/*.test.mjs` and the asset check with `node tools/verify-app.mjs`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/feedback.js` (new) | The tag vocabulary per `place.kind`, and nothing else. Pure data plus one lookup. |
| `src/views/rating.js` (new) | Builds the rating sheet `<dialog>` element from a place, its log entry and its note. Does not show, close or persist — the caller does. |
| `src/state.js` (modify) | Adds `dayLog`, `toggleDayVisited`, `setDayRating`; keeps `visited[]` derived; makes a failed write throw instead of vanishing. |
| `src/views/itinerary.js` (modify) | Renders a done row: struck through, thumb pill instead of reorder arrows, stars on the facts line. |
| `src/app.js` (modify) | Wires the new handlers and shows the sheet, following the existing `askForDay` pattern. |
| `styles.css` (modify) | Styles for the done row, thumb pill, and sheet. |
| `test/feedback.test.mjs` (new) | R8. |
| `test/state.test.mjs` (modify) | R6, R7, R9, R10. |
| `test/views.test.mjs` (modify) | Row and sheet rendering. |

---

### Task 1: Tag vocabulary

**Files:**
- Create: `src/feedback.js`
- Test: `test/feedback.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `TAGS` (object keyed by kind), `tagsForKind(kind) -> Array<{value: string, label: string}>`, `tagLabel(value) -> string`.

- [ ] **Step 1: Write the failing test**

Create `test/feedback.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TAGS, tagsForKind, tagLabel } from "../src/feedback.js";

// ── R8: the tags offered must match what the place can actually fail at ──
// A playground and a restaurant fail in different ways. One shared list would
// be vague enough to be useless for both, and the whole point of a tag is that
// it maps to a dataset field the research agent can be held to.
test("each kind offers its own vocabulary, and they do not overlap by accident", () => {
  assert.deepEqual(Object.keys(TAGS).sort(), ["attraction", "playground", "restaurant"]);
  const gf = tagsForKind("restaurant").map((t) => t.value);
  assert.ok(gf.includes("gf-claim-wrong"));
  assert.ok(!tagsForKind("playground").map((t) => t.value).includes("gf-claim-wrong"));
});

test("every kind offers the same number of tags, so no sheet feels emptier than another", () => {
  const counts = Object.values(TAGS).map((list) => list.length);
  assert.deepEqual(counts, [8, 8, 8]);
});

// An unknown kind reaches here when a stored place id outlives the dataset.
// Offering nothing is correct; throwing would take the sheet down with it.
test("an unknown kind yields no tags rather than throwing", () => {
  assert.deepEqual(tagsForKind("spaceship"), []);
  assert.deepEqual(tagsForKind(undefined), []);
});

// Tags are stored as slugs and rendered as labels. A stored slug whose label
// was later renamed must still be readable, not blank.
test("a stored slug always resolves to something readable", () => {
  assert.equal(tagLabel("gf-claim-wrong"), "GF claim was wrong");
  assert.equal(tagLabel("retired-tag"), "retired-tag");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/feedback.test.mjs`
Expected: FAIL — `Cannot find module '../src/feedback.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/feedback.js`:

```js
// Tag vocabulary, per place kind. Each tag maps to a field the research
// generator already emits — baby_friendly, gluten_free, high_chair,
// duration_minutes, price_band — so a tag is a testable claim about the
// dataset rather than a mood. Slugs are stored; labels are presentation and
// can be reworded without invalidating a season of ratings.
export const TAGS = Object.freeze({
  attraction: Object.freeze([
    { value: "baby-great", label: "Great with the baby" },
    { value: "too-crowded", label: "Too crowded" },
    { value: "worth-money", label: "Worth the money" },
    { value: "ran-long", label: "Took much longer" },
    { value: "too-far", label: "Too far to get to" },
    { value: "better-than-expected", label: "Better than expected" },
    { value: "wrong-age-range", label: "Wrong age range" },
    { value: "do-again", label: "Do it again" },
  ]),
  playground: Object.freeze([
    { value: "safe-toddler-area", label: "Safe toddler area" },
    { value: "unsafe-for-crawler", label: "Unsafe for a crawler" },
    { value: "big-kids-dominated", label: "Dominated by big kids" },
    { value: "has-shade", label: "Shade in the sun" },
    { value: "no-toilet-nearby", label: "No toilet nearby" },
    { value: "too-small", label: "Too small" },
    { value: "held-them-hour", label: "Held them for an hour+" },
    { value: "do-again", label: "Do it again" },
  ]),
  restaurant: Object.freeze([
    { value: "gf-reliable", label: "Gluten-free was reliable" },
    { value: "gf-claim-wrong", label: "GF claim was wrong" },
    { value: "high-chair", label: "High chair available" },
    { value: "good-kids-menu", label: "Good kids' menu" },
    { value: "too-slow", label: "Too slow with children" },
    { value: "overpriced", label: "Overpriced" },
    { value: "pram-friendly", label: "Pram fitted easily" },
    { value: "do-again", label: "Do it again" },
  ]),
});

export const tagsForKind = (kind) => TAGS[kind] ?? [];

const LABELS = new Map(Object.values(TAGS).flat().map((tag) => [tag.value, tag.label]));

// A slug retired from the vocabulary still has ratings attached to it in the
// store. Showing the raw slug is ugly; showing nothing would be a lie.
export const tagLabel = (value) => LABELS.get(value) ?? value;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/feedback.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/feedback.js test/feedback.test.mjs
git commit -m "feat: tag vocabulary keyed by place kind"
```

---

### Task 2: State — `dayLog`, derived visited, and a loud failure

**Files:**
- Modify: `src/state.js`
- Test: `test/state.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `state.toggleDayVisited(date: string, id: string): void`
  - `state.setDayRating(date: string, id: string, patch: {thumb?: "up"|"down"|null, stars?: number|null, tags?: string[]}, now?: string): void`
  - snapshot shape gains `dayLog: Record<string, Record<string, {done: boolean, thumb: string|null, stars: number|null, tags: string[], at: string|null}>>`
  - `STATE_VERSION = 2`

- [ ] **Step 1: Write the failing tests**

Append to `test/state.test.mjs`:

```js
// ── R6: a visit is a per-day event, but "we have been here" is not ──
// A place can sit on two days, and each visit is its own event with its own
// rating. Explore only ever asks the simpler question, so its flag is derived:
// any ticked day means yes, and un-ticking the last one means no again.
test("ticking a day sets the global visited flag; un-ticking the last day clears it", () => {
  const state = createState(fakeStorage());
  state.toggleDayVisited("2026-08-02", "tivoli");
  assert.equal(state.get().dayLog["2026-08-02"].tivoli.done, true);
  assert.deepEqual(state.get().visited, ["tivoli"]);

  state.toggleDayVisited("2026-08-02", "tivoli");
  assert.equal(state.get().dayLog["2026-08-02"]?.tivoli, undefined);
  assert.deepEqual(state.get().visited, []);
});

test("un-ticking one of two days leaves the global flag set, because we did still go", () => {
  const state = createState(fakeStorage());
  state.toggleDayVisited("2026-08-02", "emmerys");
  state.toggleDayVisited("2026-08-04", "emmerys");
  state.toggleDayVisited("2026-08-02", "emmerys");
  assert.deepEqual(state.get().visited, ["emmerys"]);
  assert.equal(state.get().dayLog["2026-08-04"].emmerys.done, true);
});

test("a rating implies the visit happened, so rating an unticked stop ticks it", () => {
  const state = createState(fakeStorage());
  state.setDayRating("2026-08-02", "tivoli", { thumb: "up" }, "2026-08-02T18:41:07Z");
  const entry = state.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.done, true);
  assert.equal(entry.thumb, "up");
  assert.equal(entry.at, "2026-08-02T18:41:07Z");
  assert.deepEqual(state.get().visited, ["tivoli"]);
});

test("a second rating merges rather than replacing, so stars do not wipe the thumb", () => {
  const state = createState(fakeStorage());
  state.setDayRating("2026-08-02", "tivoli", { thumb: "up" }, "2026-08-02T18:00:00Z");
  state.setDayRating("2026-08-02", "tivoli", { stars: 4, tags: ["baby-great"] }, "2026-08-02T18:05:00Z");
  const entry = state.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.thumb, "up");
  assert.equal(entry.stars, 4);
  assert.deepEqual(entry.tags, ["baby-great"]);
});

// ── R7: an upgrade must never cost a trip ──
// Someone mid-trip reloads the page and gets new code. Their v1 payload has no
// dayLog. It must load intact, not reset to an empty trip.
test("a v1 payload loads into v2 with an empty dayLog and nothing lost", () => {
  const v1 = JSON.stringify({
    version: 1,
    favourites: ["tivoli"],
    visited: ["rundetaarn"],
    notes: { tivoli: "buy tickets Sunday" },
    days: { "2026-08-02": ["tivoli"] },
  });
  const state = createState(fakeStorage({ [STORAGE_KEY]: v1 }));
  const snapshot = state.get();
  assert.deepEqual(snapshot.favourites, ["tivoli"]);
  assert.deepEqual(snapshot.visited, ["rundetaarn"]);
  assert.equal(snapshot.notes.tivoli, "buy tickets Sunday");
  assert.deepEqual(snapshot.days["2026-08-02"], ["tivoli"]);
  assert.deepEqual(snapshot.dayLog, {});
});

// ── R9: ratings are the point; losing them in transit defeats the feature ──
test("ratings survive an export and import round trip", () => {
  const source = createState(fakeStorage());
  source.setDayRating("2026-08-02", "tivoli", { thumb: "up", stars: 4, tags: ["worth-money"] }, "2026-08-02T18:41:07Z");

  const target = createState(fakeStorage());
  target.importJson(source.exportJson());
  const entry = target.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.stars, 4);
  assert.deepEqual(entry.tags, ["worth-money"]);
  assert.deepEqual(target.get().visited, ["tivoli"]);
});

// ── R10: a full disk must not look like a successful save ──
// Notes are unbounded text sitting beside a cached 90-place dataset. If the
// quota is hit, the write silently vanishing is the worst outcome: the screen
// says saved, the phone disagrees, and you find out days later.
test("a storage write that fails throws, and leaves the in-memory state untouched", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.toggleFavourite("tivoli");

  storage.setItem = () => {
    throw new DOMException("quota", "QuotaExceededError");
  };
  assert.throws(() => state.toggleFavourite("rundetaarn"), /Could not save/);
  assert.deepEqual(state.get().favourites, ["tivoli"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `state.toggleDayVisited is not a function`, and the R10 test fails because the current `commit` assigns before writing.

- [ ] **Step 3: Write the implementation**

In `src/state.js`, replace the top of the file (`STORAGE_KEY` through `read`) with:

```js
import { EMPTY_FILTERS } from "./filter.js";

export const STORAGE_KEY = "trip.state.v1";
export const STATE_VERSION = 2;

const emptyState = () => ({
  version: STATE_VERSION,
  favourites: [],
  visited: [],
  notes: {},
  days: {},
  // Per (date, place). A place can sit on two days and each visit is its own
  // event, with its own verdict — the global `visited` flag cannot express that.
  dayLog: {},
  filters: { ...EMPTY_FILTERS },
});

function read(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return hydrate(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

// Merge over a fresh empty state so a partial or older payload cannot leave a
// field undefined and crash a view mid-trip. v1 → v2 is purely additive: a v1
// payload gains an empty dayLog and keeps everything else exactly as it was.
function hydrate(parsed) {
  return {
    ...emptyState(),
    ...parsed,
    version: STATE_VERSION,
    dayLog: parsed.dayLog ?? {},
    filters: { ...EMPTY_FILTERS, ...(parsed.filters ?? {}) },
  };
}
```

Replace `commit` and add the day helpers inside `createState`:

```js
  function commit(next) {
    // Write before assigning. If the quota is full, the exception must reach
    // the caller with the in-memory state still matching what is on disk —
    // a silent divergence would show a saved rating that no longer exists.
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      throw new Error(`Could not save your trip: ${error.message}`, { cause: error });
    }
    current = next;
    for (const listener of listeners) listener(current);
  }

  // "We have been here" is derived from the day ticks, and can also be set by
  // hand from Explore for somewhere that was never on the plan.
  function withDerivedVisited(next, id) {
    const stillVisited = Object.values(next.dayLog).some((day) => day[id]?.done);
    const has = next.visited.includes(id);
    if (stillVisited === has) return next;
    return {
      ...next,
      visited: stillVisited ? [...next.visited, id] : next.visited.filter((item) => item !== id),
    };
  }

  function withDayEntry(date, id, mutate) {
    const day = { ...(current.dayLog[date] ?? {}) };
    const updated = mutate(day[id]);
    if (updated === null) delete day[id];
    else day[id] = updated;

    const dayLog = { ...current.dayLog };
    if (Object.keys(day).length === 0) delete dayLog[date];
    else dayLog[date] = day;

    commit(withDerivedVisited({ ...current, dayLog }, id));
  }

  const emptyEntry = () => ({ done: true, thumb: null, stars: null, tags: [], at: null });
```

Add these two methods to the returned object, after `moveInDay`:

```js
    toggleDayVisited(date, id) {
      // Un-ticking discards the entry entirely rather than leaving done:false
      // behind — an untouched stop and an un-ticked one are the same thing,
      // and a stray entry would leak into the export as a phantom visit.
      withDayEntry(date, id, (entry) => (entry ? null : emptyEntry()));
    },

    setDayRating(date, id, patch, now = new Date().toISOString()) {
      // Rating something implies you went: there is no way to open the sheet
      // without having ticked the stop, and a rating with done:false would be
      // meaningless in the store.
      withDayEntry(date, id, (entry) => ({ ...emptyEntry(), ...entry, ...patch, done: true, at: now }));
    },
```

Finally, make `importJson` reuse the same hydration so an imported v1 file is upgraded identically:

```js
    // Parse before touching anything, so a bad paste cannot destroy a trip.
    importJson(text) {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) throw new Error("not a state object");
      commit(hydrate(parsed));
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/state.test.mjs`
Expected: PASS — the 7 new tests plus every pre-existing one.

- [ ] **Step 5: Run the whole suite**

Run: `node --test test/*.test.mjs`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/state.js test/state.test.mjs
git commit -m "feat: per-day visit log, with the global visited flag derived from it"
```

---

### Task 3: Itinerary rows tick, strike through, and offer a thumb

**Files:**
- Modify: `src/views/itinerary.js`
- Test: `test/views.test.mjs`

**Interfaces:**
- Consumes: `tagLabel` is not needed here. Entry shape from Task 2.
- Produces: `renderItinerary({trip, places, days, dates, dayLog, handlers})` where `handlers` may now carry `onToggleDone(date, id)` and `onRate(date, id, thumb)`. Both `dayLog` and the new handlers default, so the four existing call sites keep working.

- [ ] **Step 1: Write the failing tests**

Append to `test/views.test.mjs`:

```js
test("a stop that has been ticked is struck through and loses its reorder arrows", () => {
  const places = [place({ id: "tivoli", name: "Tivoli Gardens" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates: ["2026-08-03"],
    dayLog: { "2026-08-03": { tivoli: { done: true, thumb: null, stars: null, tags: [], at: null } } },
    handlers: { onMove: () => {}, onRemove: () => {}, onToggleDone: () => {}, onRate: () => {} },
  });
  const row = root.querySelector("li.day-item");
  assert.ok(row.classList.contains("is-visited"));
  assert.equal(root.querySelectorAll("button.nudge").length, 0);
  assert.equal(root.querySelectorAll("button.thumb").length, 2);
});

test("tapping the row body reports the toggle, so a stop can be ticked and un-ticked", () => {
  const calls = [];
  const places = [place({ id: "tivoli", name: "Tivoli Gardens" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates: ["2026-08-03"],
    dayLog: {},
    handlers: { onMove: () => {}, onRemove: () => {}, onToggleDone: (date, id) => calls.push([date, id]), onRate: () => {} },
  });
  root.querySelector("button.day-item-body").listeners.click();
  assert.deepEqual(calls, [["2026-08-03", "tivoli"]]);
});

test("pressing a thumb records that verdict, rather than only opening a sheet to ask again", () => {
  const calls = [];
  const places = [place({ id: "tivoli", name: "Tivoli Gardens" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates: ["2026-08-03"],
    dayLog: { "2026-08-03": { tivoli: { done: true, thumb: null, stars: null, tags: [], at: null } } },
    handlers: { onMove: () => {}, onRemove: () => {}, onToggleDone: () => {}, onRate: (date, id, thumb) => calls.push([date, id, thumb]) },
  });
  const down = root.querySelectorAll("button.thumb").find((b) => b.attrs["aria-label"].includes("not recommend"));
  down.listeners.click();
  assert.deepEqual(calls, [["2026-08-03", "tivoli", "down"]]);
});

// A row that says only "visited" wastes the rating you already gave it. Showing
// the stars turns the day into a readable summary at a glance.
test("stars already given appear on the row", () => {
  const places = [place({ id: "tivoli", name: "Tivoli Gardens" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates: ["2026-08-03"],
    dayLog: { "2026-08-03": { tivoli: { done: true, thumb: "up", stars: 4, tags: [], at: null } } },
    handlers: { onMove: () => {}, onRemove: () => {}, onToggleDone: () => {}, onRate: () => {} },
  });
  assert.match(root.querySelector("li.day-item").textContent, /★★★★☆/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/views.test.mjs`
Expected: FAIL — `root.querySelector("button.day-item-body")` is null; the row body is still a `<span>`.

- [ ] **Step 3: Write the implementation**

Replace the `row` function in `src/views/itinerary.js` and add the two helpers above it:

```js
export function starLabel(stars) {
  return "★★★★★".slice(0, stars) + "☆☆☆☆☆".slice(0, 5 - stars);
}

function thumbButton(place, date, entry, direction, handlers) {
  const glyph = direction === "up" ? "👍" : "👎";
  const wording = direction === "up" ? "recommend" : "not recommend";
  return h("button", {
    class: "thumb", type: "button",
    "aria-pressed": String(entry.thumb === direction),
    "aria-label": `Would ${wording} ${place.name} to another family, and open notes`,
    onClick: () => handlers.onRate(date, place.id, direction),
  }, glyph);
}

function row(place, date, index, count, handlers, entry) {
  const done = Boolean(entry?.done);
  const log = entry ?? { thumb: null, stars: null, tags: [] };
  const facts = [
    place.neighbourhood,
    // An unknown place has no duration_minutes at all — showing "0 min"
    // would claim it takes no time, rather than that its length is unknown.
    typeof place.duration_minutes === "number" ? durationLabel(place.duration_minutes) : null,
    log.stars ? starLabel(log.stars) : null,
  ].filter(Boolean).join(" · ");

  return h(
    "li",
    { class: `day-item${done ? " is-visited" : ""}` },
    // Reordering a stop that already happened is meaningless, and the space is
    // better spent on the verdict.
    done
      ? h("span", { class: "thumbs" },
          thumbButton(place, date, log, "up", handlers),
          thumbButton(place, date, log, "down", handlers))
      : h("span", { class: "grip" },
          h("button", {
            class: "nudge", type: "button", "aria-label": `Move ${place.name} earlier`,
            disabled: index === 0, onClick: () => handlers.onMove(date, place.id, -1),
          }, "⌃"),
          h("button", {
            class: "nudge", type: "button", "aria-label": `Move ${place.name} later`,
            disabled: index === count - 1, onClick: () => handlers.onMove(date, place.id, 1),
          }, "⌄")),
    h("button", {
      class: "day-item-body", type: "button", "aria-pressed": String(done),
      "aria-label": `Mark ${place.name} ${done ? "not visited" : "visited"}`,
      onClick: () => handlers.onToggleDone(date, place.id),
    },
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, facts)),
    h("button", {
      class: "remove", type: "button", "aria-label": `Remove ${place.name} from ${date}`,
      onClick: () => handlers.onRemove(date, place.id),
    }, "×"),
  );
}
```

Then update `renderItinerary`'s signature and the row call. Both new inputs default so the four existing call sites keep working:

```js
export function renderItinerary({ trip, places, days, dates, dayLog = {}, handlers }) {
```

and inside the `dates.map`, replace the `items.map(...)` line with:

```js
              items.map((place, index) =>
                row(place, date, index, items.length, handlers, dayLog[date]?.[place.id])),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/views.test.mjs`
Expected: PASS — the 4 new tests plus the 4 existing `renderItinerary` ones, untouched.

- [ ] **Step 5: Commit**

```bash
git add src/views/itinerary.js test/views.test.mjs
git commit -m "feat: tick an itinerary stop off, and thumb it from the row"
```

---

### Task 4: The rating sheet

**Files:**
- Create: `src/views/rating.js`
- Test: `test/views.test.mjs`

**Interfaces:**
- Consumes: `tagsForKind` from Task 1; the entry shape from Task 2; `starLabel` is local to the itinerary view and is **not** reused here — the sheet draws individual star buttons.
- Produces: `renderRatingSheet({place, date, entry, note, handlers}) -> HTMLDialogElement`. Handlers: `onThumb(direction)`, `onStars(n)`, `onTags(list)`, `onNote(text)`, `onClose()`. The element is returned unattached; the caller appends and shows it.

- [ ] **Step 1: Write the failing tests**

Append to `test/views.test.mjs`. Add the import next to the others near line 129:

```js
const { renderRatingSheet } = await import("../src/views/rating.js");
```

```js
function sheetFor(overrides = {}, handlers = {}) {
  return renderRatingSheet({
    place: place({ id: "tivoli", name: "Tivoli Gardens", kind: "attraction" }),
    date: "2026-08-03",
    entry: { done: true, thumb: null, stars: null, tags: [], at: null },
    note: "",
    handlers: {
      onThumb: () => {}, onStars: () => {}, onTags: () => {}, onNote: () => {}, onClose: () => {},
      ...handlers,
    },
    ...overrides,
  });
}

test("the sheet offers the tags for this place's kind, not a generic list", () => {
  const attraction = sheetFor();
  const labels = attraction.querySelectorAll("button.tag").map((b) => b.textContent);
  assert.ok(labels.includes("Great with the baby"));
  assert.ok(!labels.includes("Gluten-free was reliable"));

  const restaurant = sheetFor({ place: place({ id: "gorms", name: "Gorm's", kind: "restaurant" }) });
  const foodLabels = restaurant.querySelectorAll("button.tag").map((b) => b.textContent);
  assert.ok(foodLabels.includes("Gluten-free was reliable"));
});

// Every field commits as it is touched, so there is nothing to cancel and
// nothing lost by dismissing the sheet mid-thought.
test("tapping a star commits that rating immediately", () => {
  const calls = [];
  const sheet = sheetFor({}, { onStars: (n) => calls.push(n) });
  sheet.querySelectorAll("button.star")[3].listeners.click();
  assert.deepEqual(calls, [4]);
});

test("tapping an already-set star clears it, so a mis-tap is recoverable", () => {
  const calls = [];
  const sheet = sheetFor(
    { entry: { done: true, thumb: null, stars: 4, tags: [], at: null } },
    { onStars: (n) => calls.push(n) },
  );
  sheet.querySelectorAll("button.star")[3].listeners.click();
  assert.deepEqual(calls, [null]);
});

test("a tag toggles into and out of the list rather than only ever being added", () => {
  const calls = [];
  const sheet = sheetFor(
    { entry: { done: true, thumb: null, stars: null, tags: ["too-crowded"], at: null } },
    { onTags: (list) => calls.push(list) },
  );
  const tags = sheet.querySelectorAll("button.tag");
  const crowded = tags.find((b) => b.textContent === "Too crowded");
  const baby = tags.find((b) => b.textContent === "Great with the baby");
  crowded.listeners.click();
  baby.listeners.click();
  assert.deepEqual(calls, [[], ["too-crowded", "baby-great"]]);
});

// The repository is public. Somebody typing a note about a restaurant, or
// about their children, must be told before they type, not after they push.
test("the sheet warns that notes may be published", () => {
  assert.match(sheetFor().textContent, /publishable/i);
});

test("the sheet names the day, because the same place can be rated twice", () => {
  assert.match(sheetFor().textContent, /Monday 3 August/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/views.test.mjs`
Expected: FAIL — `Cannot find module '../src/views/rating.js'`

- [ ] **Step 3: Write the implementation**

Create `src/views/rating.js`:

```js
import { h } from "../dom.js";
import { tagsForKind } from "../feedback.js";

function heading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function field(label, ...children) {
  return h("div", { class: "field" }, h("p", { class: "field-label" }, label), ...children);
}

function thumbs(entry, handlers) {
  return h(
    "div",
    { class: "thumbs" },
    ["up", "down"].map((direction) =>
      h("button", {
        class: "thumb", type: "button",
        "aria-pressed": String(entry.thumb === direction),
        "aria-label": direction === "up" ? "Would recommend" : "Would not recommend",
        // Tapping the thumb that is already set clears it: the sheet opens with
        // one pre-filled, and changing your mind must not mean living with it.
        onClick: () => handlers.onThumb(entry.thumb === direction ? null : direction),
      }, direction === "up" ? "👍" : "👎"),
    ),
  );
}

function stars(entry, handlers) {
  return h(
    "div",
    { class: "stars" },
    [1, 2, 3, 4, 5].map((n) =>
      h("button", {
        class: "star", type: "button",
        "aria-pressed": String((entry.stars ?? 0) >= n),
        "aria-label": `${n} star${n === 1 ? "" : "s"}`,
        onClick: () => handlers.onStars(entry.stars === n ? null : n),
      }, (entry.stars ?? 0) >= n ? "★" : "☆"),
    ),
  );
}

function tags(place, entry, handlers) {
  const chosen = entry.tags ?? [];
  return h(
    "div",
    { class: "chips" },
    // A place whose id outlived the dataset has no kind, so it gets no tags —
    // the thumb, the stars and the note still work.
    tagsForKind(place.kind).map((tag) =>
      h("button", {
        class: "tag", type: "button",
        "aria-pressed": String(chosen.includes(tag.value)),
        onClick: () =>
          handlers.onTags(
            chosen.includes(tag.value) ? chosen.filter((v) => v !== tag.value) : [...chosen, tag.value],
          ),
      }, tag.label),
    ),
  );
}

export function renderRatingSheet({ place, date, entry, note, handlers }) {
  return h(
    "dialog",
    { class: "rating-sheet", "aria-label": `Rate ${place.name}` },
    h("h2", {}, place.name),
    h("p", { class: "sheet-sub" }, [heading(date), place.neighbourhood].filter(Boolean).join(" · ")),
    field("Would you recommend to another family?", thumbs(entry, handlers)),
    field("Rating", stars(entry, handlers)),
    field("What stood out", tags(place, entry, handlers)),
    field(
      "Notes",
      h("textarea", {
        class: "note-input", rows: 3, "aria-label": `Notes about ${place.name}`,
        placeholder: "What would you tell another family?",
        // Commit on blur rather than on every keystroke, matching the Saved
        // tab's editor — a re-render mid-sentence would eat the caret.
        onBlur: (event) => handlers.onNote(event.target.value),
      }, note ?? ""),
      h("p", { class: "sheet-warning" },
        "Saved into this repository when you ingest it — keep it publishable."),
    ),
    h("button", { class: "action primary", type: "button", onClick: () => handlers.onClose() }, "Done"),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/views.test.mjs`
Expected: PASS — 6 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/views/rating.js test/views.test.mjs
git commit -m "feat: rating sheet with kind-specific tags"
```

---

### Task 5: Wire it into the app and style it

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `sw.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: nothing further consumed by other tasks.

- [ ] **Step 1: Add the styles**

In `styles.css`, immediately after the `.remove` rule (around line 180), add:

```css
/* Itinerary: a stop that has happened */
.day-item-body {
  flex: 1; display: grid; gap: var(--space-2xs); text-align: left;
  min-height: var(--tap-min); border: 0; background: none; padding: 0;
  font: inherit; color: inherit; cursor: pointer;
}
.day-item.is-visited { background: var(--bg-sunken); }
.day-item.is-visited .name { text-decoration: line-through; text-decoration-color: var(--text-faint); color: var(--text-muted); }
.day-item.is-visited .facts-line { color: var(--text-faint); }
.thumbs { display: flex; gap: var(--space-2xs); }
.thumb {
  min-width: 40px; min-height: var(--tap-min); border: var(--border-hairline);
  border-radius: var(--radius-pill); background: var(--surface-raised);
  font-size: var(--text-small); cursor: pointer; opacity: 0.5;
  transition: var(--transition-tap);
}
.thumb[aria-pressed="true"] { opacity: 1; background: var(--accent-soft); border-color: var(--accent); }
.thumb:active { transform: scale(var(--press-scale)); }

/* Rating sheet */
.rating-sheet {
  border: 0; border-radius: var(--radius-lg); padding: var(--space-xl);
  max-width: 24rem; width: calc(100% - 2rem);
  background: var(--surface-raised); box-shadow: var(--shadow-dialog);
}
.rating-sheet::backdrop { background: var(--backdrop); }
.rating-sheet h2 {
  margin: 0; font-family: var(--font-display); font-size: var(--text-heading);
  letter-spacing: var(--tracking-tight);
}
.sheet-sub { margin: var(--space-2xs) 0 var(--space-lg); font-size: var(--text-fine); color: var(--text-muted); }
.field { margin-bottom: var(--space-lg); }
.field-label {
  margin: 0 0 var(--space-xs); font-size: var(--text-micro); font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-muted);
}
.rating-sheet .thumb { flex: 1; font-size: var(--text-body-size); }
.stars { display: flex; gap: var(--space-2xs); }
.star {
  min-width: var(--tap-min); min-height: var(--tap-min); border: 0; background: none;
  font-size: var(--text-title); color: var(--status-warn); cursor: pointer;
}
.tag {
  min-height: var(--tap-min); padding: 0 var(--space-md); border: var(--border-hairline);
  border-radius: var(--radius-pill); background: var(--surface-card);
  font: inherit; font-size: var(--text-fine); color: var(--text-muted); cursor: pointer;
  transition: var(--transition-tap);
}
.tag[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: var(--weight-semibold); }
.tag:active { transform: scale(var(--press-scale)); }
.sheet-warning { margin: var(--space-2xs) 0 0; font-size: var(--text-micro); color: var(--text-muted); }
```

- [ ] **Step 2: Wire the handlers in `src/app.js`**

Add the import beside the other view imports:

```js
import { renderRatingSheet } from "./views/rating.js";
```

Add these two functions next to `askForDay`. The sheet lives on `<body>`, outside the
panels a re-render clears, so a state change mid-rating does not tear it out from under
the user.

```js
// A quota error must reach the user. Silently losing a rating is worse than an
// ugly alert: the screen would say saved while the phone disagreed.
function guard(action) {
  try {
    action();
  } catch (error) {
    alert(error.message);
  }
}
```

```js
function openRatingSheet(date, id) {
  const build = () => {
    const place = data.places.find((p) => p.id === id) ?? unknownPlace(id);
    const entry = state.get().dayLog[date]?.[id] ?? { done: true, thumb: null, stars: null, tags: [], at: null };
    const patch = (change) => {
      guard(() => state.setDayRating(date, id, change));
      // Rebuild in place: pressed states all read from the entry, and there is
      // no other way for a tap to show up.
      const next = build();
      clear(sheet);
      for (const child of [...next.children]) sheet.append(child);
    };
    return renderRatingSheet({
      place, date, entry,
      note: state.get().notes[id] ?? "",
      handlers: {
        onThumb: (thumb) => patch({ thumb }),
        onStars: (stars) => patch({ stars }),
        onTags: (tags) => patch({ tags }),
        onNote: (text) => guard(() => state.setNote(id, text)),
        onClose: () => sheet.close(),
      },
    });
  };

  const sheet = build();
  document.body.append(sheet);
  sheet.addEventListener("close", () => sheet.remove());
  sheet.showModal();
}
```

Import `unknownPlace` and `clear` if they are not already imported — `clear` is, `unknownPlace` is not:

```js
import { renderExplore, collectOpenIds, restoreOpenIds, unknownPlace } from "./views/explore.js";
```

In the `itinerary` branch of `render()`, pass the log and the two new handlers:

```js
      renderItinerary({
        trip: data.trip,
        places: data.places,
        days: snapshot.days,
        dates: tripDates(data.trip),
        dayLog: snapshot.dayLog,
        handlers: {
          onMove: (date, id, delta) => guard(() => state.moveInDay(date, id, delta)),
          onRemove: (date, id) => guard(() => state.removeFromDay(date, id)),
          onToggleDone: (date, id) => guard(() => state.toggleDayVisited(date, id)),
          onRate: (date, id, thumb) => {
            guard(() => state.setDayRating(date, id, { thumb }));
            openRatingSheet(date, id);
          },
        },
      }),
```

Wrap the remaining direct `state.*` calls in the other three branches with `guard(...)` too, so a full disk surfaces wherever it happens.

- [ ] **Step 3: Bump the service worker cache**

In `sw.js`, add `src/feedback.js` and `src/views/rating.js` to the precache list, and bump the cache name — otherwise a returning phone serves the old module graph and the new imports 404 offline.

- [ ] **Step 4: Run every check**

```bash
node --test test/*.test.mjs
node tools/verify-app.mjs
```

Expected: all tests pass; the verifier reports the module graph and assets resolve, including the two new files.

- [ ] **Step 5: Drive it in a real browser**

Serve the app and exercise the whole path — this is the only step that proves the feature, since none of the tests touch a real `<dialog>`:

```bash
python3 -m http.server 8000
```

Then, in a browser at `http://localhost:8000`:

1. Add two places to the same day from Explore.
2. On the Itinerary tab, tap the first row's body. It strikes through, greys, and its arrows become 👍👎.
3. Tap 👍. The sheet opens with the thumb already pressed.
4. Set four stars, tap two tags, type a note, tap Done.
5. The row shows `★★★★☆`.
6. Reload the page. Everything is still there.
7. Check the Saved tab: the place appears under Visited, and the note is in the note editor.
8. Tap the row body again to un-tick. Confirm it leaves the Saved tab's Visited list.
9. Tap the same place's row on a second day, tick both, un-tick one — it must stay in Visited.

- [ ] **Step 6: Commit**

```bash
git add src/app.js styles.css sw.js
git commit -m "feat: wire the rating sheet into the itinerary"
```

---

## Self-Review

**Spec coverage.** D1 thumb-plus-stars → Tasks 3 and 4. D2 kind-specific tags → Tasks 1 and 4. D3 per-day log → Task 2. D4 one note, two entry points → Task 5's `onNote`, writing to the same `state.setNote` the Saved tab uses. D8 rating only in the Itinerary → the sheet is opened from `renderItinerary`'s handler and nowhere else; Explore's `cardActions` is untouched. D9 derived visited → `withDerivedVisited` in Task 2. D10 no rater identity → nothing captures one. R6, R7, R9, R10 → Task 2. R8 → Task 1. D5, D6, D7 belong to S8 and S9 and are deliberately absent, except D6's warning line, which appears in Task 4.

**Consistency.** `setDayRating(date, id, patch, now)` is defined in Task 2 and called with three arguments everywhere in Task 5, taking the default timestamp. `toggleDayVisited(date, id)` likewise. The entry shape `{done, thumb, stars, tags, at}` is identical in Tasks 2, 3, 4 and 5. `tagsForKind` returns `{value, label}` objects in Task 1 and is destructured as such in Task 4.

**Known rough edge, deliberately left.** Task 5's sheet rebuild replaces the dialog's children rather than diffing them. With four fields this is cheaper than any alternative and keeps the pressed states honest; if it flickers on a real phone, that is a finding for the browser step, not a reason to build a renderer first.
