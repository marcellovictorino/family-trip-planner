# Adversarial code review

Read-only review of `src/`, `tools/`, `styles.css`, `sw.js` and `index.html` as they
stand after roughly two dozen commits from several agents working in parallel
(`git log --oneline -25`). Findings are ranked by how likely each is to actually bite
a family using this app mid-trip in Copenhagen with no signal, not by how unusual
the code looks. Style opinions are excluded.

## 1. Opening a place's details, then touching anything else, silently closes it

**Where:** `src/app.js:75-89` (`render()`) together with `src/views/explore.js:193-209`
(`renderExplore`/`renderCard`).

**Why it's wrong, not just unusual:** every state change — typing another character
in search, toggling a weather/age/kind chip, marking a *different* place visited —
calls `state.setFilters`/`toggleVisited`/etc., which calls `commit`, which notifies
`render()`, which does `clear(panels.explore)` and rebuilds the entire card list from
scratch. A `<details>` card's `open` state lives only on that DOM node, and
`renderCard` never sets `open` from anywhere — there is no "which cards are expanded"
field in state at all. So a card that was open before the rebuild comes back closed.
This is 100% reproducible, not an edge case: open Tivoli's details to read the
opening hours, then type one more letter to narrow the list, and it snaps shut. The
authors clearly knew re-render destroys transient DOM state — they explicitly
preserved search-input focus and caret position for exactly this reason (the
`wasSearch`/`caret` block at `app.js:76-78,142-146`) — but missed the sibling symptom
of the same root cause for `<details>`.

**Smallest fix:** track open card ids in a `Set` inside `app.js` (or read
`panels.explore.querySelectorAll("details[open]")` before `clear()` and reapply
`open` after `append()`, the same pattern already used for the search caret).

## 2. Service worker: cache refresh isn't awaited, so it can silently not happen

**Where:** `sw.js:52-62` (the `fetch` handler).

```js
fetch(event.request)
  .then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })
```

**Why it's wrong:** `caches.open(...).then(cache => cache.put(...))` is fired but never
returned or chained — it isn't part of the promise passed to `event.respondWith()`,
and it isn't wrapped in `event.waitUntil()` either. The browser is free to suspend or
kill the service worker as soon as `event.respondWith()`'s promise settles (i.e. the
moment `response` is handed back to the page), with no obligation to let that
detached `cache.put()` finish first. iOS Safari in particular suspends service
workers far more aggressively than desktop Chrome to save battery, so this is a real
platform difference, not a theoretical one. The comment above this handler even says
"every successful response refreshes the cache" — that's the intent, but it's not
guaranteed, and when it silently fails the family is looking at stale content
offline with no signal that anything went wrong. This is exactly the invisible,
only-noticed-mid-trip failure mode the `no-cache` fetch in `app.js:164-167` was
written to avoid for the *initial* load; the same risk reappears here through a
different door.

**Smallest fix:**
```js
return response;
```
→
```js
event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
return response;
```
(`waitUntil` extends the *event's* lifetime, which is what's needed here, not the
handler's own promise chain.)

## 3. Service-worker install has no `.catch`, and `cache.addAll` is all-or-nothing

**Where:** `sw.js:37-39`.

```js
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
```

**Why it's wrong:** `Cache.addAll()` is atomic — if a single one of the 30 listed
assets returns a non-OK response or the fetch fails, the *entire* call rejects and
*nothing* is written to the cache, not even the 29 that succeeded. With no `.catch`
anywhere in this chain, that rejection propagates out of `event.waitUntil()`, which
tells the browser the install failed, so this service worker version is discarded.
The failure is invisible: `navigator.serviceWorker.register()` in `app.js:182-186`
only rejects on *registration* errors, not on what happens inside the install event,
so nothing is ever logged or shown to the user. Given `data/copenhagen-2026.json` is
one of the 30 cached assets and is, right now, mid-regeneration by another agent in
this repo, a single momentary 404/500 on that file during install is enough to leave
the family with zero offline capability — discovered only once they actually lose
signal.

**Smallest fix:** add `.catch((error) => console.error("SW install failed", error))`
at minimum so the failure isn't silent, and consider replacing `cache.addAll(ASSETS)`
with a loop of individually-caught `cache.add()` calls so one bad asset doesn't sink
the other 29.

## 4. `itinerary.js` and `saved.js` both invent a placeholder for a vanished place, and the two have already drifted

**Where:** `src/views/itinerary.js:41` vs `src/views/saved.js:53`.

```js
// itinerary.js:41
byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, duration_minutes: 0 }
// saved.js:53
byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, neighbourhood: "" }
```

**Why it's wrong:** both exist for the identical situation — a stored id from a
regenerated-away place — but they were written independently and already disagree on
shape. `itinerary.js`'s version sets `duration_minutes: 0`, which `row()` then feeds
into `durationLabel(0)` (`src/views/explore.js:32`, `0 <= 60` is true), printing
**"0 min"** next to the unknown stop — implying it takes no time, not that its
duration is unknown. `saved.js`'s version instead omits `duration_minutes` entirely
and never displays a duration for its unknown items, which is the correct behaviour.
Same bug class the review was asked to look for ("duplicated logic that drifted
between two files") caught in the act, one commit generation in.

**Smallest fix:** extract one `unknownPlace(id)` helper (e.g. into a small shared
module, or duplicate `itinerary.js`'s object without `duration_minutes` so
`durationLabel` is simply never called for it, matching `saved.js`).

## 5. Every keystroke in search tears down and rebuilds every card, in full, with no debounce

**Where:** `src/views/explore.js:140-168` (`renderControls`'s `onInput`) into
`src/app.js:75-89` (`render()`).

**Why it's wrong:** `onInput` calls `set({query})` synchronously on every keystroke,
which calls `state.setFilters` → `commit` → `render()`, which clears and rebuilds the
*entire* matching card list — and each card's full `<details>` subtree (description
paragraph, tip/baby notes, fact list, links, three action buttons) is built
regardless of whether the card is expanded, since `<details>` content exists in the
DOM whether open or not. At the dataset's current ~90 places this is fast enough not
to notice; the generator's batch system (`tools/generate-trip.mjs`) is explicitly
designed to scale, and the review brief itself asks about 200-place behaviour. Typing
a whole word one-handed, holding a baby, means 4-6 full teardown/rebuilds of ~200
`<details>` trees in well under a second, entirely on the main thread, synchronously
inside the `input` event — the one interaction this app is most likely to receive
continuously. Not O(n²) — O(n) per keystroke — but O(n) repeated with zero throttling
on the highest-frequency event in the app is the practical equivalent once n grows.

**Smallest fix:** debounce the commit (~150ms) in `renderControls`'s `onInput`
handler, or split query text into separate local UI state from the committed filter
so typing doesn't touch `state` (and therefore doesn't re-render) until the user
pauses.

## 6. `tools/data-report.mjs` can't distinguish "the report ran and found problems" from "the report crashed"

**Where:** `tools/data-report.mjs:199-202`.

```js
main().catch((error) => {
  console.error(`data-report crashed: ${error.stack}`);
  process.exit(0);
});
```

**Why it's wrong:** the file's own header comment says "this is a report, not a
gate: it always exits 0" — correct and intentional for the *data-quality findings*
the report is designed to surface (missing Tivoli, duplicate names, etc: those
should exit 0, they're informational). But this `catch` also swallows a genuine tool
crash (bad JSON, missing file, a thrown TypeError from a bug in the report itself)
under the exact same exit code. Anyone scripting around this tool (or a human
skimming a green checkmark before a trip) cannot tell "dataset looks fine" from "the
report never actually ran" without reading stderr line by line.

**Smallest fix:** exit non-zero from the `catch` (a genuine crash), and keep `main()`
itself always resolving/exiting 0 for the data-quality findings it deliberately
doesn't gate on.

## Lower-priority / informational

- **`tools/geo.mjs:27-37` (`computeNear`) is O(n²)** — for each place it scans every
  other place. At the current ~90 places or even a hypothetical 200 this is a few
  tens of thousands of haversine calls, sub-second, and it only ever runs offline
  inside the generator, never in the browser, so it will not stall the app itself.
  `tools/data-report.mjs`'s `findDuplicateNames` (lines 62-78) is the same shape for
  the same reason. Worth knowing about if either dataset or this function is ever
  reused client-side; not worth changing today.
- **Copy/British English:** checked every user-visible string in the four views,
  `app.js`, and `index.html` — consistently British spelling ("favourite",
  "gluten-free", "programme"-adjacent phrasing), no Americanisms, no ungrammatical
  strings found. No fix needed here.
- **`<dialog>`/`<details>` cross-browser support itself is fine** (iOS Safari has
  supported both since 15.4); the only real `<details>` defect is the re-render/open
  -state one in finding 1, which is not browser-specific.
