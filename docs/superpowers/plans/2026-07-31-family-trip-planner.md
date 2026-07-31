# Family Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline-capable, mobile-first trip planner that a family uses during a trip, built from a static dataset generated at build time by a headless Claude research script.

**Architecture:** Two programs. `tools/generate-trip.mjs` calls `claude -p` with WebSearch to research a city and writes a validated JSON dataset. `index.html` plus a handful of ES modules read that dataset, hold user state in `localStorage`, and are cached by a service worker for offline use. The app contains no city-specific knowledge.

**Tech Stack:** Vanilla ES2022 modules, no framework, no build step, zero npm dependencies. `node --test` for tests. GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-07-31-family-trip-planner-design.md`

## Global Constraints

- **Zero npm dependencies.** No `package.json` `dependencies` or `devDependencies` ever. Tests use `node:test` and `node:assert` only.
- **No build step.** Files are served as authored. Never introduce a bundler, transpiler, or minifier.
- Node 26 is installed. ES modules only; `.mjs` for tools and tests, `.js` for `src/` (loaded as `type="module"`).
- The app must never make a network request at runtime other than fetching its own `data/*.json`.
- **British English** in all user-facing copy and in identifiers where a spelling choice exists: `favourites`, `neighbourhood`.
- All interactive targets minimum 44×44 px. No horizontal page scrolling at 375 px width.
- `price_band` enum: exactly `free`, `€`, `€€`, `€€€`.
- `kind` enum: exactly `attraction`, `playground`, `restaurant`.
- `setting` enum: exactly `indoor`, `outdoor`, `mixed`.
- `booking` enum: exactly `none`, `recommended`, `required`.
- `gluten_free` enum: exactly `none`, `limited`, `good`.
- `ages` values: exactly `baby`, `toddler`, `child`, `adult`.
- Duration buckets: `<1h` = ≤60 min, `1-2h` = 61–120, `half-day` = 121–240, `full-day` = >240.
- `near[]` radius 800 m; walking minutes computed at 60 m/min (slow family pace).
- Styling stays plain and minimal. A design system is applied in a later, out-of-scope slice. Do not invest in visual polish.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `index.html` | Shell: top nav, four tab containers, module entry point |
| `styles.css` | Plain minimal styling. Single file. |
| `sw.js` | Service worker. Versioned cache, offline shell. |
| `src/dom.js` | `h()` element helper and `mount()`. No app knowledge. |
| `src/schema.mjs` | Single source of truth for the data contract. Imported by generator, validator, and data test. |
| `src/filter.js` | Pure. `filterPlaces()`, `searchPlaces()`, duration bucket maths. No DOM, no storage. |
| `src/state.js` | Pure-ish. Reads/writes one `localStorage` key. Emits change events. No DOM. |
| `src/app.js` | Wiring: loads data, owns tab routing, re-renders views on state change. |
| `src/views/explore.js` | Renders search, filter chips and place cards. |
| `src/views/itinerary.js` | Renders day sections, reorder and remove controls. |
| `src/views/saved.js` | Renders favourites, visited and notes. |
| `src/views/trip.js` | Renders countdown, counts, export/import. |
| `tools/generate-trip.mjs` | Research driver. Batches, `claude -p`, haversine `near[]`. |
| `tools/validate-data.mjs` | Untrusted-input gate. Exits non-zero on any violation. |
| `test/*.test.mjs` | `node --test`. One file per pure module. |
| `data/copenhagen-2026.json` | Generated. Immutable once committed. |

---

## Task 1: Shell, fixture data, and Explore rendering

**Files:**
- Create: `index.html`, `styles.css`, `src/dom.js`, `src/app.js`, `src/views/explore.js`, `data/copenhagen-2026.json`
- Create: `test/dom.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/dom.js` → `h(tag, attrs, ...children) => HTMLElement`, where `attrs` is an object; keys starting `on` become lowercase event listeners, `class` sets `className`, everything else becomes an attribute. Children may be strings, numbers, nodes, or arrays; `null`/`undefined`/`false` are skipped.
  - `src/dom.js` → `clear(el) => void` removing all children.
  - `src/views/explore.js` → `renderExplore(places) => HTMLElement`
  - `data/copenhagen-2026.json` → `{ trip: {...}, places: [...] }` matching the spec's data model.

- [ ] **Step 1: Write the failing test for `h()`**

Create `test/dom.test.mjs`. `h()` touches the DOM, so the test asserts against a minimal stub rather than pulling in a DOM library (zero dependencies is a hard constraint). Extract the element-building logic so it takes a document:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildElement } from "../src/dom.js";

function fakeDocument() {
  return {
    createElement(tag) {
      return {
        tag,
        className: "",
        attrs: {},
        listeners: {},
        children: [],
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(k, fn) { this.listeners[k] = fn; },
        append(...kids) { this.children.push(...kids); },
      };
    },
    createTextNode(text) { return { text }; },
  };
}

test("h sets class, attributes and listeners distinctly", () => {
  const doc = fakeDocument();
  const onClick = () => {};
  const el = buildElement(doc, "button", { class: "chip", "aria-pressed": "true", onClick }, "Rainy");
  assert.equal(el.tag, "button");
  assert.equal(el.className, "chip");
  assert.equal(el.attrs["aria-pressed"], "true");
  assert.equal(el.listeners.click, onClick);
  assert.deepEqual(el.children, [{ text: "Rainy" }]);
});

test("h skips null, undefined and false children so conditional rendering is safe", () => {
  const doc = fakeDocument();
  const el = buildElement(doc, "div", {}, "a", null, undefined, false, ["b", "c"]);
  assert.deepEqual(el.children.map((c) => c.text), ["a", "b", "c"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/dom.test.mjs`
Expected: FAIL — `Cannot find module '../src/dom.js'`.

- [ ] **Step 3: Implement `src/dom.js`**

```js
export function buildElement(doc, tag, attrs = {}, ...children) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(doc, el, children);
  return el;
}

function append(doc, el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(doc, el, child);
    else if (typeof child === "object") el.append(child);
    else el.append(doc.createTextNode(String(child)));
  }
}

export const h = (tag, attrs, ...children) => buildElement(document, tag, attrs, ...children);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/dom.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the fixture dataset**

Create `data/copenhagen-2026.json` with exactly three hand-written places — one per `kind` — so every card variant renders. These are real places with real coordinates; they are replaced wholesale by the generator in Task 6.

```json
{
  "trip": {
    "city": "Copenhagen",
    "country": "Denmark",
    "from": "2026-08-02",
    "to": "2026-08-08",
    "bbox": { "west": 12.40, "east": 12.70, "south": 55.60, "north": 55.75 },
    "generated_at": "2026-07-31T00:00:00Z"
  },
  "places": [
    {
      "id": "tivoli",
      "name": "Tivoli Gardens",
      "kind": "attraction",
      "category": "theme-park",
      "neighbourhood": "Indre By",
      "lat": 55.6736,
      "lon": 12.5681,
      "description": "Historic pleasure garden with gentle rides for a 6-year-old and quiet lakeside lawns where a 1-year-old can crawl. Several indoor halls make it usable in rain.",
      "duration_minutes": 240,
      "price_band": "€€€",
      "booking": "recommended",
      "booking_url": "https://www.tivoli.dk/en/",
      "website": "https://www.tivoli.dk/en/",
      "maps_url": "https://www.google.com/maps/search/?api=1&query=55.6736,12.5681",
      "setting": "mixed",
      "ages": ["baby", "toddler", "child", "adult"],
      "baby_friendly": true,
      "stroller": true,
      "changing_table": true,
      "baby_notes": "Quiet garden by the lake for naps",
      "gluten_free": "limited",
      "kids_menu": true,
      "high_chair": true,
      "nearest_metro": "København H",
      "tags": ["classic", "evening", "rides"],
      "tips": "Enter before 11:00 to beat the queues",
      "best_time": "morning",
      "near": []
    },
    {
      "id": "den-bla-planet",
      "name": "Den Blå Planet",
      "kind": "attraction",
      "category": "aquarium",
      "neighbourhood": "Kastrup",
      "lat": 55.6329,
      "lon": 12.6549,
      "description": "Northern Europe's largest aquarium. Fully indoors, flat throughout, and dark tunnels hold a toddler's attention. Prams roll everywhere.",
      "duration_minutes": 150,
      "price_band": "€€€",
      "booking": "recommended",
      "booking_url": "https://denblaaplanet.dk/en/",
      "website": "https://denblaaplanet.dk/en/",
      "maps_url": "https://www.google.com/maps/search/?api=1&query=55.6329,12.6549",
      "setting": "indoor",
      "ages": ["baby", "toddler", "child", "adult"],
      "baby_friendly": true,
      "stroller": true,
      "changing_table": true,
      "baby_notes": "Floor space in the tunnel gallery for a crawler",
      "gluten_free": "limited",
      "kids_menu": true,
      "high_chair": true,
      "nearest_metro": "Kastrup",
      "tags": ["rainy-day", "animals"],
      "tips": "Go on arrival or last two hours; midday is busiest",
      "best_time": "afternoon",
      "near": []
    },
    {
      "id": "kongens-have-playground",
      "name": "Kongens Have Playground",
      "kind": "playground",
      "category": "playground",
      "neighbourhood": "Indre By",
      "lat": 55.6845,
      "lon": 12.5797,
      "description": "Fenced wooden playground in the King's Garden. Separate toddler area with low equipment and soft ground, so a 1-year-old can move around without being run over by older children.",
      "duration_minutes": 60,
      "price_band": "free",
      "booking": "none",
      "booking_url": null,
      "website": "https://www.kongernessamling.dk/en/rosenborg/",
      "maps_url": "https://www.google.com/maps/search/?api=1&query=55.6845,12.5797",
      "setting": "outdoor",
      "ages": ["baby", "toddler", "child"],
      "baby_friendly": true,
      "stroller": true,
      "changing_table": false,
      "baby_notes": "Soft ground in the toddler pen; no changing table, bring a mat",
      "gluten_free": "none",
      "kids_menu": false,
      "high_chair": false,
      "nearest_metro": "Nørreport",
      "tags": ["free", "quick", "park"],
      "tips": "Combine with Rosenborg Castle grounds",
      "best_time": "morning",
      "near": []
    }
  ]
}
```

- [ ] **Step 6: Write `src/views/explore.js`**

Cards are collapsed by default and expand in place via a native `<details>` element, which gives keyboard and screen-reader behaviour for free. No images: a glyph and a colour band per `kind`.

```js
import { h } from "../dom.js";

const GLYPH = { attraction: "🎡", playground: "🛝", restaurant: "🍽" };

const PRICE_LABEL = { free: "Free", "€": "€", "€€": "€€", "€€€": "€€€" };

function facts(place) {
  const bits = [place.neighbourhood, durationLabel(place.duration_minutes), PRICE_LABEL[place.price_band]];
  return bits.filter(Boolean).join(" · ");
}

export function durationLabel(minutes) {
  if (minutes <= 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h${minutes % 60}`;
}

function icons(place) {
  return [
    place.baby_friendly && { glyph: "👶", label: "Room for a baby to move around" },
    place.stroller && { glyph: "🛒", label: "Pram accessible" },
    place.setting === "indoor" && { glyph: "🌧", label: "Indoors" },
    place.setting === "mixed" && { glyph: "🌤", label: "Indoor and outdoor" },
    place.gluten_free === "good" && { glyph: "GF", label: "Good gluten-free options" },
    place.booking === "required" && { glyph: "🎫", label: "Booking required" },
  ]
    .filter(Boolean)
    .map((i) => h("span", { class: "icon", title: i.label, "aria-label": i.label }, i.glyph));
}

function detail(place) {
  return h(
    "div",
    { class: "detail" },
    h("p", {}, place.description),
    place.tips && h("p", { class: "tip" }, `Tip: ${place.tips}`),
    place.baby_notes && h("p", { class: "tip" }, `Baby: ${place.baby_notes}`),
    h(
      "dl",
      { class: "facts" },
      place.nearest_metro && [h("dt", {}, "Metro"), h("dd", {}, place.nearest_metro)],
      place.best_time && [h("dt", {}, "Best time"), h("dd", {}, place.best_time)],
      h("dt", {}, "Booking"),
      h("dd", {}, place.booking),
    ),
    h(
      "p",
      { class: "links" },
      place.website && h("a", { href: place.website, target: "_blank", rel: "noopener" }, "Website"),
      place.booking_url && h("a", { href: place.booking_url, target: "_blank", rel: "noopener" }, "Book"),
      place.maps_url && h("a", { href: place.maps_url, target: "_blank", rel: "noopener" }, "Map"),
    ),
  );
}

export function renderCard(place) {
  return h(
    "details",
    { class: `card kind-${place.kind}`, "data-id": place.id },
    h(
      "summary",
      {},
      h("span", { class: "band" }, `${GLYPH[place.kind]} ${place.category}`),
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, facts(place)),
      h("span", { class: "icons" }, icons(place)),
    ),
    detail(place),
  );
}

export function renderExplore(places) {
  if (places.length === 0) {
    return h("p", { class: "empty" }, "Nothing matches those filters.");
  }
  return h("div", { class: "cards" }, places.map(renderCard));
}
```

- [ ] **Step 7: Write `index.html`**

Four tab panels, top navigation, one module entry point.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b4965">
<title>Trip Planner</title>
<link rel="stylesheet" href="styles.css">
<link rel="manifest" href="manifest.webmanifest">
</head>
<body>
<header>
  <h1 id="trip-title">Trip Planner</h1>
  <nav id="tabs" role="tablist">
    <button role="tab" class="tab" data-tab="explore" aria-selected="true">Explore</button>
    <button role="tab" class="tab" data-tab="itinerary" aria-selected="false">Itinerary</button>
    <button role="tab" class="tab" data-tab="saved" aria-selected="false">Saved</button>
    <button role="tab" class="tab" data-tab="trip" aria-selected="false">Trip</button>
  </nav>
</header>
<main>
  <section id="panel-explore" role="tabpanel"></section>
  <section id="panel-itinerary" role="tabpanel" hidden></section>
  <section id="panel-saved" role="tabpanel" hidden></section>
  <section id="panel-trip" role="tabpanel" hidden></section>
</main>
<script type="module" src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 8: Write `src/app.js`**

Only what Task 1 needs: load data, render Explore, switch tabs. Later tasks extend it.

```js
import { clear } from "./dom.js";
import { renderExplore } from "./views/explore.js";

const DATA_URL = "data/copenhagen-2026.json";

const panels = {
  explore: document.querySelector("#panel-explore"),
  itinerary: document.querySelector("#panel-itinerary"),
  saved: document.querySelector("#panel-saved"),
  trip: document.querySelector("#panel-trip"),
};

function showTab(name) {
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  }
}

document.querySelector("#tabs").addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) showTab(tab.dataset.tab);
});

async function start() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  const data = await response.json();
  document.querySelector("#trip-title").textContent = `${data.trip.city} ${data.trip.from.slice(0, 4)}`;
  document.title = `${data.trip.city} Trip Planner`;
  clear(panels.explore);
  panels.explore.append(renderExplore(data.places));
  showTab("explore");
}

start().catch((error) => {
  panels.explore.textContent = error.message;
  console.error(error);
});
```

- [ ] **Step 9: Write `styles.css`**

Minimal and deliberately plain. Do not expand this beyond what is here.

```css
:root {
  --ink: #17242b;
  --muted: #5d6b73;
  --line: #dfe5e8;
  --bg: #f6f8f9;
  --accent: #1b4965;
  --attraction: #cfe3ef;
  --playground: #d6ecd8;
  --restaurant: #f4e2cf;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 16px/1.5 -apple-system, system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
  padding-bottom: env(safe-area-inset-bottom);
}
header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid var(--line); z-index: 2; }
h1 { margin: 0; padding: 0.6rem 1rem 0.2rem; font-size: 1.1rem; }
nav { display: flex; overflow-x: auto; }
.tab {
  flex: 1 0 auto; min-height: 44px; padding: 0 1rem;
  border: 0; border-bottom: 3px solid transparent; background: none;
  font: inherit; color: var(--muted); cursor: pointer;
}
.tab[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
main { padding: 1rem; max-width: 46rem; margin: 0 auto; }
.cards { display: grid; gap: 0.75rem; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.card summary { display: grid; gap: 0.15rem; padding: 0.75rem; min-height: 44px; cursor: pointer; }
.card summary::-webkit-details-marker { display: none; }
.band { font-size: 0.75rem; color: var(--muted); }
.kind-attraction .band { background: var(--attraction); }
.kind-playground .band { background: var(--playground); }
.kind-restaurant .band { background: var(--restaurant); }
.band { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 6px; justify-self: start; }
.name { font-weight: 600; }
.facts-line { font-size: 0.85rem; color: var(--muted); }
.icons { display: flex; gap: 0.4rem; font-size: 0.9rem; }
.icon { line-height: 1; }
.detail { padding: 0 0.75rem 0.75rem; border-top: 1px solid var(--line); }
.detail p { margin: 0.6rem 0; }
.tip { font-size: 0.9rem; color: var(--muted); }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; margin: 0.6rem 0; font-size: 0.9rem; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.links a { min-height: 44px; display: inline-flex; align-items: center; color: var(--accent); }
.empty { color: var(--muted); }
```

- [ ] **Step 10: Verify in a browser**

Run: `python3 -m http.server 8000`
Open `http://localhost:8000`. Confirm: title reads "Copenhagen 2026", three cards render with distinct colour bands, tapping a card expands it, the four tabs switch (three are empty), and no console errors. Narrow the window to 375 px and confirm no horizontal scrolling.

- [ ] **Step 11: Commit**

```bash
git add index.html styles.css src data test
git commit -m "feat: app shell, dom helper and Explore rendering on fixture data"
```

---

## Task 2: Offline support and deployment

**Files:**
- Create: `sw.js`, `manifest.webmanifest`, `.nojekyll`
- Modify: `src/app.js` (register the service worker)

**Interfaces:**
- Consumes: Task 1's `index.html`, `styles.css`, `src/`, `data/`.
- Produces: a live URL that works in airplane mode. No JavaScript exports.

- [ ] **Step 1: Write `sw.js`**

The cache name carries a version. Bumping it is what makes a deployment take effect, so a stale cache can never become permanent.

```js
const CACHE = "trip-planner-v1";

const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "src/app.js",
  "src/dom.js",
  "src/views/explore.js",
  "data/copenhagen-2026.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first so a deployed change is picked up when online, falling back to
// the cache when offline. Every successful response refreshes the cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("index.html"))),
  );
});
```

- [ ] **Step 2: Write `manifest.webmanifest`**

No icon files, to avoid binary assets. iOS falls back to a screenshot of the page.

```json
{
  "name": "Trip Planner",
  "short_name": "Trip",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f6f8f9",
  "theme_color": "#1b4965",
  "orientation": "portrait"
}
```

- [ ] **Step 3: Register the worker in `src/app.js`**

Append to the end of the file:

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("SW registration failed", error));
  });
}
```

- [ ] **Step 4: Add `.nojekyll`**

GitHub Pages runs Jekyll by default, which ignores files and directories beginning with an underscore. This project has none today, but the file costs nothing and prevents a confusing future failure.

```bash
touch .nojekyll
```

- [ ] **Step 5: Commit and push to a new public repository**

The repository must be public: private GitHub Pages requires Enterprise Cloud, so a private repo would still publish a public site while adding no privacy. Nothing personal lives in the repository — user notes stay in `localStorage` on the device.

```bash
git add sw.js manifest.webmanifest .nojekyll src/app.js
git commit -m "feat: service worker, manifest and Pages deployment config"
gh repo create trip-planner --public --source=. --remote=origin --push
```

- [ ] **Step 6: Enable Pages**

```bash
gh api -X POST repos/{owner}/trip-planner/pages -f 'source[branch]=main' -f 'source[path]=/'
gh api repos/{owner}/trip-planner/pages --jq .html_url
```

Wait for the first build:

```bash
gh api repos/{owner}/trip-planner/pages/builds/latest --jq .status
```

Expected: `built`.

- [ ] **Step 7: Verify offline on the phone**

This is the acceptance test for slice 1 and must be done by the user on the real device:

1. Open the Pages URL in iPhone Safari. Confirm three cards render.
2. Share → Add to Home Screen. Open from the home screen.
3. Enable airplane mode. Force-quit and reopen from the home screen.
4. Expected: the app still loads and the three cards still render.

If it fails, check the service worker registered at all: Safari → Settings → Advanced → Web Inspector, or load the URL on a desktop and inspect Application → Service Workers.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A && git commit -m "fix: offline caching corrections from device testing"
git push
```

---
## Task 3: The data contract (`src/schema.mjs`)

**Files:**
- Create: `src/schema.mjs`, `test/schema.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ENUMS` → `{ kind, setting, price_band, booking, gluten_free, ages }`, each a frozen array of the exact allowed strings.
  - `REQUIRED_PLACE_FIELDS` → frozen array of field names that must be present and non-null on every place.
  - `DURATION_BUCKETS` → `{ "<1h": [0,60], "1-2h": [61,120], "half-day": [121,240], "full-day": [241, Infinity] }`
  - `WALK_METRES_PER_MINUTE` → `60`
  - `NEAR_RADIUS_METRES` → `800`
  - `validatePlace(place, { bbox, knownIds }) => string[]` returning a list of human-readable problems; empty means valid. `knownIds` is a `Set` used to check `near[].id`; pass an empty `Set` to skip reference checking.
  - `validateDataset(data) => string[]` running `validatePlace` over every place plus dataset-level checks (trip fields present, no duplicate ids).

This module is imported by the generator, the validator and the data test, so there is exactly one definition of the contract.

- [ ] **Step 1: Write the failing tests**

Create `test/schema.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlace, validateDataset, DURATION_BUCKETS, ENUMS } from "../src/schema.mjs";

const BBOX = { west: 12.40, east: 12.70, south: 55.60, north: 55.75 };

function validPlace(overrides = {}) {
  return {
    id: "tivoli", name: "Tivoli Gardens", kind: "attraction", category: "theme-park",
    neighbourhood: "Indre By", lat: 55.6736, lon: 12.5681,
    description: "A long enough description to be useful to a family reading it.",
    duration_minutes: 240, price_band: "€€€", booking: "recommended",
    website: "https://www.tivoli.dk/en/", maps_url: "https://maps.example/1",
    setting: "mixed", ages: ["toddler", "child", "adult"], baby_friendly: true,
    stroller: true, changing_table: true, gluten_free: "limited",
    nearest_metro: "København H", tags: ["classic"], near: [],
    ...overrides,
  };
}

test("a well-formed place has no problems", () => {
  assert.deepEqual(validatePlace(validPlace(), { bbox: BBOX, knownIds: new Set() }), []);
});

test("a place outside the trip bbox is rejected, because that is how a hallucinated city is caught", () => {
  // Malmö, Sweden — plausible-looking, wrong country.
  const problems = validatePlace(validPlace({ lat: 55.6050, lon: 13.0038 }), { bbox: BBOX, knownIds: new Set() });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /outside trip bbox/);
});

test("an unknown enum value is rejected rather than passed through to the UI", () => {
  const problems = validatePlace(validPlace({ price_band: "$$" }), { bbox: BBOX, knownIds: new Set() });
  assert.match(problems.join(" "), /price_band/);
});

test("a missing required field is reported by name", () => {
  const place = validPlace();
  delete place.description;
  const problems = validatePlace(place, { bbox: BBOX, knownIds: new Set() });
  assert.match(problems.join(" "), /description/);
});

test("a dangling near[].id is rejected, because near[] is computed by us so a broken ref is our own bug", () => {
  const problems = validatePlace(
    validPlace({ near: [{ id: "does-not-exist", walk_minutes: 4 }] }),
    { bbox: BBOX, knownIds: new Set(["tivoli"]) },
  );
  assert.match(problems.join(" "), /does-not-exist/);
});

test("duplicate ids are rejected at dataset level", () => {
  const data = {
    trip: { city: "Copenhagen", country: "Denmark", from: "2026-08-02", to: "2026-08-08", bbox: BBOX },
    places: [validPlace(), validPlace()],
  };
  assert.match(validateDataset(data).join(" "), /duplicate id/i);
});

test("duration buckets do not overlap and cover every positive duration", () => {
  const ranges = Object.values(DURATION_BUCKETS).sort((a, b) => a[0] - b[0]);
  assert.equal(ranges[0][0], 0);
  for (let i = 1; i < ranges.length; i += 1) {
    assert.equal(ranges[i][0], ranges[i - 1][1] + 1, "buckets must be contiguous with no gap or overlap");
  }
  assert.equal(ranges.at(-1)[1], Infinity);
});

test("the enums are exactly the values the spec fixes", () => {
  assert.deepEqual([...ENUMS.price_band], ["free", "€", "€€", "€€€"]);
  assert.deepEqual([...ENUMS.kind], ["attraction", "playground", "restaurant"]);
  assert.deepEqual([...ENUMS.setting], ["indoor", "outdoor", "mixed"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/schema.test.mjs`
Expected: FAIL — `Cannot find module '../src/schema.mjs'`.

- [ ] **Step 3: Implement `src/schema.mjs`**

```js
export const ENUMS = Object.freeze({
  kind: Object.freeze(["attraction", "playground", "restaurant"]),
  setting: Object.freeze(["indoor", "outdoor", "mixed"]),
  price_band: Object.freeze(["free", "€", "€€", "€€€"]),
  booking: Object.freeze(["none", "recommended", "required"]),
  gluten_free: Object.freeze(["none", "limited", "good"]),
  ages: Object.freeze(["baby", "toddler", "child", "adult"]),
});

export const REQUIRED_PLACE_FIELDS = Object.freeze([
  "id", "name", "kind", "category", "neighbourhood", "lat", "lon", "description",
  "duration_minutes", "price_band", "booking", "website", "maps_url", "setting",
  "ages", "baby_friendly", "stroller", "gluten_free", "tags", "near",
]);

export const DURATION_BUCKETS = Object.freeze({
  "<1h": Object.freeze([0, 60]),
  "1-2h": Object.freeze([61, 120]),
  "half-day": Object.freeze([121, 240]),
  "full-day": Object.freeze([241, Infinity]),
});

export const WALK_METRES_PER_MINUTE = 60;
export const NEAR_RADIUS_METRES = 800;

const MIN_DESCRIPTION_LENGTH = 40;

export function validatePlace(place, { bbox, knownIds }) {
  const problems = [];
  const where = place?.id ?? place?.name ?? "<unidentified place>";

  if (!place || typeof place !== "object") return [`${where}: not an object`];

  for (const field of REQUIRED_PLACE_FIELDS) {
    if (place[field] === undefined || place[field] === null) problems.push(`${where}: missing ${field}`);
  }

  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (field === "ages") continue;
    const value = place[field];
    if (value !== undefined && value !== null && !allowed.includes(value)) {
      problems.push(`${where}: ${field} "${value}" is not one of ${allowed.join(", ")}`);
    }
  }

  if (Array.isArray(place.ages)) {
    for (const age of place.ages) {
      if (!ENUMS.ages.includes(age)) problems.push(`${where}: ages contains "${age}"`);
    }
  } else if (place.ages !== undefined) {
    problems.push(`${where}: ages must be an array`);
  }

  if (typeof place.lat === "number" && typeof place.lon === "number" && bbox) {
    const inside =
      place.lat >= bbox.south && place.lat <= bbox.north && place.lon >= bbox.west && place.lon <= bbox.east;
    if (!inside) problems.push(`${where}: lat/lon ${place.lat},${place.lon} outside trip bbox`);
  }

  if (typeof place.duration_minutes === "number" && place.duration_minutes <= 0) {
    problems.push(`${where}: duration_minutes must be positive`);
  }

  if (typeof place.description === "string" && place.description.length < MIN_DESCRIPTION_LENGTH) {
    problems.push(`${where}: description shorter than ${MIN_DESCRIPTION_LENGTH} characters`);
  }

  if (typeof place.id === "string" && !/^[a-z0-9-]+$/.test(place.id)) {
    problems.push(`${where}: id must be lower-case kebab-case`);
  }

  if (Array.isArray(place.near) && knownIds && knownIds.size > 0) {
    for (const ref of place.near) {
      if (!knownIds.has(ref?.id)) problems.push(`${where}: near[] references unknown id "${ref?.id}"`);
    }
  }

  return problems;
}

export function validateDataset(data) {
  const problems = [];
  const trip = data?.trip;
  if (!trip) return ["dataset: missing trip"];
  for (const field of ["city", "country", "from", "to", "bbox"]) {
    if (!trip[field]) problems.push(`trip: missing ${field}`);
  }
  if (!Array.isArray(data.places) || data.places.length === 0) return [...problems, "dataset: no places"];

  const seen = new Set();
  for (const place of data.places) {
    if (seen.has(place?.id)) problems.push(`duplicate id "${place.id}"`);
    seen.add(place?.id);
  }
  for (const place of data.places) {
    problems.push(...validatePlace(place, { bbox: trip.bbox, knownIds: seen }));
  }
  return problems;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/schema.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/schema.mjs test/schema.test.mjs
git commit -m "feat: single-source data contract with bbox and enum validation"
```

---

## Task 4: The validation gate (`tools/validate-data.mjs`)

**Files:**
- Create: `tools/validate-data.mjs`
- Create: `test/data.test.mjs`

**Interfaces:**
- Consumes: `validateDataset` from `src/schema.mjs` (Task 3).
- Produces: a CLI that exits `0` on a clean dataset and `1` after printing every problem. Also `test/data.test.mjs`, which asserts the committed dataset is valid so a bad commit fails CI or a local test run.

- [ ] **Step 1: Write the failing test**

Create `test/data.test.mjs`. This is a guard on real committed data, so it reads the actual file.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDataset } from "../src/schema.mjs";

test("the committed dataset satisfies the contract", async () => {
  const raw = await readFile(new URL("../data/copenhagen-2026.json", import.meta.url), "utf8");
  const problems = validateDataset(JSON.parse(raw));
  assert.deepEqual(problems, [], `dataset problems:\n${problems.join("\n")}`);
});
```

- [ ] **Step 2: Run it to verify it passes against the Task 1 fixture**

Run: `node --test test/data.test.mjs`
Expected: PASS. If it fails, the Task 1 fixture is wrong — fix the fixture, not the schema.

- [ ] **Step 3: Implement `tools/validate-data.mjs`**

```js
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateDataset } from "../src/schema.mjs";

const file = process.argv[2] ?? "data/copenhagen-2026.json";

const problems = validateDataset(JSON.parse(await readFile(file, "utf8")));

if (problems.length > 0) {
  console.error(`${file}: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`${file}: valid`);
```

- [ ] **Step 4: Verify both outcomes**

Run: `node tools/validate-data.mjs`
Expected: `data/copenhagen-2026.json: valid`, exit 0. Confirm with `echo $?`.

Now prove it fails loudly. Create a deliberately broken copy:

```bash
node -e 'const d=require("./data/copenhagen-2026.json"); d.places[0].lat=55.6050; d.places[0].lon=13.0038; require("fs").writeFileSync("/tmp/bad.json", JSON.stringify(d));'
node tools/validate-data.mjs /tmp/bad.json; echo "exit=$?"
```

Expected: prints `outside trip bbox` and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add tools/validate-data.mjs test/data.test.mjs
git commit -m "feat: dataset validation CLI and committed-data guard test"
```

---
## Task 5: The research generator (`tools/generate-trip.mjs`)

**Files:**
- Create: `tools/generate-trip.mjs`, `tools/geo.mjs`
- Create: `test/geo.test.mjs`

**Interfaces:**
- Consumes: `ENUMS`, `REQUIRED_PLACE_FIELDS`, `NEAR_RADIUS_METRES`, `WALK_METRES_PER_MINUTE`, `validatePlace` from `src/schema.mjs` (Task 3).
- Produces:
  - `tools/geo.mjs` → `haversineMetres(a, b)` where `a`/`b` are `{ lat, lon }`, returning metres as a number.
  - `tools/geo.mjs` → `computeNear(places, { radius, pace })` returning a new array of places, each with `near` replaced by `[{ id, walk_minutes }]` sorted ascending by distance, excluding self.
  - `tools/generate-trip.mjs` → CLI: `node tools/generate-trip.mjs --city Copenhagen --from 2026-08-02 --to 2026-08-08 [--out data/copenhagen-2026.json] [--batches 4]`

**Why `claude -p` and not an HTTP API:** WebSearch is built in and no API key or SDK is needed, which keeps the zero-dependency constraint. The research call is isolated in `runResearch()` with the command in one constant, so a `pi`-driven gpt backend can replace it by editing one place.

- [ ] **Step 1: Write the failing tests for the geo maths**

Create `test/geo.test.mjs`. Distances are the one thing here that must be right, because every "what's nearby" answer depends on them.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMetres, computeNear } from "../tools/geo.mjs";

const TIVOLI = { lat: 55.6736, lon: 12.5681 };
const GLYPTOTEKET = { lat: 55.6725, lon: 12.5729 };   // ~320 m east of Tivoli
const BLA_PLANET = { lat: 55.6329, lon: 12.6549 };    // ~7 km away

test("haversine matches a known short distance within 5%", () => {
  const metres = haversineMetres(TIVOLI, GLYPTOTEKET);
  assert.ok(metres > 300 && metres < 360, `expected ~320 m, got ${Math.round(metres)}`);
});

test("haversine is symmetric and zero for the same point", () => {
  assert.equal(haversineMetres(TIVOLI, TIVOLI), 0);
  assert.equal(
    Math.round(haversineMetres(TIVOLI, BLA_PLANET)),
    Math.round(haversineMetres(BLA_PLANET, TIVOLI)),
  );
});

test("computeNear links places inside the radius and excludes those outside", () => {
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
    { id: "bla-planet", ...BLA_PLANET, near: [] },
  ];
  const [tivoli, , blaPlanet] = computeNear(places, { radius: 800, pace: 60 });
  assert.deepEqual(tivoli.near.map((n) => n.id), ["glyptoteket"]);
  assert.deepEqual(blaPlanet.near, [], "7 km away must not be 'near'");
});

test("walk_minutes uses a slow family pace, not an adult one", () => {
  // 320 m at 60 m/min is ~5 min; at an adult 80 m/min it would be 4.
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
  ];
  const [tivoli] = computeNear(places, { radius: 800, pace: 60 });
  assert.equal(tivoli.near[0].walk_minutes, 5);
});

test("computeNear never links a place to itself", () => {
  const places = [{ id: "tivoli", ...TIVOLI, near: [] }];
  assert.deepEqual(computeNear(places, { radius: 800, pace: 60 })[0].near, []);
});

test("near[] is sorted nearest first so the UI can show the closest option", () => {
  const places = [
    { id: "tivoli", ...TIVOLI, near: [] },
    { id: "glyptoteket", ...GLYPTOTEKET, near: [] },
    { id: "far-ish", lat: 55.6700, lon: 12.5760, near: [] },
  ];
  const [tivoli] = computeNear(places, { radius: 800, pace: 60 });
  const distances = tivoli.near.map((n) => n.walk_minutes);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/geo.test.mjs`
Expected: FAIL — `Cannot find module '../tools/geo.mjs'`.

- [ ] **Step 3: Implement `tools/geo.mjs`**

```js
const EARTH_RADIUS_METRES = 6_371_008.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function haversineMetres(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeNear(places, { radius, pace }) {
  return places.map((place) => {
    const near = places
      .filter((other) => other.id !== place.id)
      .map((other) => ({ id: other.id, metres: haversineMetres(place, other) }))
      .filter((entry) => entry.metres <= radius)
      .sort((a, b) => a.metres - b.metres)
      .map((entry) => ({ id: entry.id, walk_minutes: Math.max(1, Math.round(entry.metres / pace)) }));
    return { ...place, near };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/geo.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement `tools/generate-trip.mjs`**

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ENUMS,
  REQUIRED_PLACE_FIELDS,
  NEAR_RADIUS_METRES,
  WALK_METRES_PER_MINUTE,
  validatePlace,
} from "../src/schema.mjs";
import { computeNear } from "./geo.mjs";

// The single seam for swapping research backends. To use pi with a gpt model,
// change only this constant and the argv it builds.
const RESEARCH_COMMAND = "claude";
const RESEARCH_ARGS = ["-p", "--model", "claude-sonnet-5", "--effort", "medium",
  "--allowed-tools", "WebSearch", "--output-format", "json"];

const MAX_ATTEMPTS = 3;

const BATCHES = [
  { key: "rainy", count: 6, brief: "indoor attractions and museums that work on a wet day" },
  { key: "sunny", count: 6, brief: "outdoor attractions, parks and waterfront spots for fine weather" },
  { key: "playgrounds", count: 4, brief: "playgrounds and indoor play spaces, prioritising ones with a separate toddler area where a crawling 1-year-old is safe from older children" },
  { key: "food", count: 4, brief: "family-friendly restaurants and cafes with reliable gluten-free options" },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!args.city || !args.from || !args.to) {
    console.error("Usage: node tools/generate-trip.mjs --city Copenhagen --from 2026-08-02 --to 2026-08-08 [--out path]");
    process.exit(2);
  }
  return args;
}

function runResearch(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(RESEARCH_COMMAND, [...RESEARCH_ARGS, prompt], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`${RESEARCH_COMMAND} exited ${code}: ${stderr.trim()}`));
      resolve(stdout);
    });
  });
}

// claude -p --output-format json wraps the reply in an envelope whose `result`
// field holds the model's text. Fall back to treating stdout as the text itself
// so a backend swap that prints raw text still works.
function extractText(stdout) {
  try {
    const envelope = JSON.parse(stdout);
    if (typeof envelope?.result === "string") return envelope.result;
  } catch { /* not an envelope */ }
  return stdout;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in response");
  return JSON.parse(candidate.slice(start));
}

const bboxPrompt = (city, country) => `Return the geographic bounding box of ${city}, ${country},
covering the area a tourist would plausibly visit on foot or by metro.
Reply with ONLY a JSON object, no prose and no code fence:
{"west":<number>,"east":<number>,"south":<number>,"north":<number>}`;

function batchPrompt({ city, country, from, to, batch, bbox, existingNames }) {
  return `Research ${batch.count} ${batch.brief} in ${city}, ${country}, for a family visiting ${from} to ${to}.
The family is two adults, a 6-year-old and a 1-year-old who is starting to walk.
Use web search and prefer official sites. Do not invent anything: if you cannot confirm a
detail, omit that place entirely rather than guessing.

Already covered, do not repeat: ${existingNames.length ? existingNames.join("; ") : "(nothing yet)"}

Reply with ONLY a JSON array of ${batch.count} objects, no prose and no code fence.
Every object must have exactly these keys:

id                lower-case kebab-case, unique, derived from the name
name              official name
kind              one of ${ENUMS.kind.join(" | ")}
category          short lower-case kebab-case type, e.g. museum, aquarium, playground, bakery
neighbourhood     district name
lat, lon          decimal degrees, must lie inside west ${bbox.west}, east ${bbox.east}, south ${bbox.south}, north ${bbox.north}
description       2-3 sentences, at least 40 characters, written for THIS family: say what the
                  6-year-old does and what the 1-year-old does
duration_minutes  realistic visit length in minutes, including the faff of arriving with a pram
price_band        one of ${ENUMS.price_band.join(" | ")} where free = 0 kr, € < 100 kr,
                  €€ = 100-200 kr, €€€ > 200 kr, per adult entry or per main course
booking           one of ${ENUMS.booking.join(" | ")}
booking_url       URL or null
website           official URL
maps_url          https://www.google.com/maps/search/?api=1&query=<lat>,<lon>
setting           one of ${ENUMS.setting.join(" | ")}. Use "mixed" only if there is genuine
                  indoor shelter, because "mixed" survives the rainy-day filter
ages              array from ${ENUMS.ages.join(" | ")}
baby_friendly     true only if a 1-year-old can move around safely on the floor or ground.
                  This is NOT about changing tables.
stroller          true if a pram can be used throughout
changing_table    true or false, informational only
baby_notes        one sentence on where a baby can nap or crawl, or null
gluten_free       one of ${ENUMS.gluten_free.join(" | ")}
kids_menu         true or false
high_chair        true or false
nearest_metro     nearest metro or S-train station name
tags              2-4 short lower-case kebab-case tags
tips              one practical sentence, e.g. best time to arrive, or null
best_time         one of morning | afternoon | evening | any
near              always the empty array []

Required and never null: ${REQUIRED_PLACE_FIELDS.join(", ")}.`;
}

async function researchBatch(context) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await runResearch(batchPrompt(context));
      const places = extractJson(extractText(raw));
      if (!Array.isArray(places)) throw new Error("response was not an array");
      const problems = places.flatMap((place) =>
        validatePlace(place, { bbox: context.bbox, knownIds: new Set() }),
      );
      if (problems.length > 0) throw new Error(`invalid batch:\n  ${problems.join("\n  ")}`);
      return places;
    } catch (error) {
      console.error(`  attempt ${attempt}/${MAX_ATTEMPTS} for "${context.batch.key}" failed: ${error.message}`);
      if (attempt === MAX_ATTEMPTS) {
        console.error(`  giving up on "${context.batch.key}" — continuing without it`);
        return [];
      }
    }
  }
  return [];
}

const args = parseArgs(process.argv.slice(2));
const country = args.country ?? "Denmark";
const out = args.out ?? `data/${args.city.toLowerCase().replace(/\s+/g, "-")}-${args.from.slice(0, 4)}.json`;

console.log(`Resolving bounding box for ${args.city}...`);
const bbox = extractJson(extractText(await runResearch(bboxPrompt(args.city, country))));
console.log(`  ${JSON.stringify(bbox)}`);

const places = [];
for (const batch of BATCHES) {
  console.log(`Researching "${batch.key}" (${batch.count})...`);
  const found = await researchBatch({
    city: args.city, country, from: args.from, to: args.to, batch, bbox,
    existingNames: places.map((p) => p.name),
  });
  const fresh = found.filter((p) => !places.some((existing) => existing.id === p.id));
  console.log(`  kept ${fresh.length} of ${found.length}`);
  places.push(...fresh);
}

if (places.length === 0) {
  console.error("No valid places were produced. Not writing a file.");
  process.exit(1);
}

const dataset = {
  trip: { city: args.city, country, from: args.from, to: args.to, bbox, generated_at: new Date().toISOString() },
  places: computeNear(places, { radius: NEAR_RADIUS_METRES, pace: WALK_METRES_PER_MINUTE }),
};

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`Wrote ${dataset.places.length} places to ${out}`);
console.log(`Now run: node tools/validate-data.mjs ${out}`);
```

- [ ] **Step 6: Smoke-test the CLI's argument handling without spending a research call**

Run: `node tools/generate-trip.mjs`
Expected: the usage message and exit code 2.

- [ ] **Step 7: Commit**

```bash
git add tools/generate-trip.mjs tools/geo.mjs test/geo.test.mjs
git commit -m "feat: trip data generator driving claude -p with computed proximity"
```

---

## Task 6: Generate and commit the real dataset

**Files:**
- Modify: `data/copenhagen-2026.json` (replaced wholesale)
- Modify: `sw.js` (bump the cache version)

**Interfaces:**
- Consumes: `tools/generate-trip.mjs` (Task 5), `tools/validate-data.mjs` (Task 4).
- Produces: a real 20-place dataset. No new exports.

- [ ] **Step 1: Run the generator**

This makes several real web-search calls and takes a few minutes.

```bash
node tools/generate-trip.mjs --city Copenhagen --country Denmark --from 2026-08-02 --to 2026-08-08 --out data/copenhagen-2026.json
```

Expected: roughly 20 places written. Batches that fail three times are skipped with a loud message — note which, if any.

- [ ] **Step 2: Validate**

Run: `node tools/validate-data.mjs data/copenhagen-2026.json`
Expected: `valid`, exit 0. If it fails, do **not** hand-edit the data to make it pass; fix the generator prompt or re-run the failing batch. Hand-editing hides a generator bug that will recur in Task 13.

- [ ] **Step 3: Run the full test suite**

Run: `node --test test/`
Expected: all pass, including `test/data.test.mjs` against the new real data.

- [ ] **Step 4: Spot-check three places by hand**

Open the `website` of three places, one per `kind`, and confirm the place exists, is in Copenhagen, and is not permanently closed. This catches the failure the schema cannot: confidently-stated but wrong facts.

Also confirm at least one place has `kind: "restaurant"` so the restaurant colour band is exercised — the Task 1 fixture had none.

- [ ] **Step 5: Bump the service worker cache**

In `sw.js`, change `const CACHE = "trip-planner-v1"` to `"trip-planner-v2"`, so devices holding the fixture data pick up the real dataset.

- [ ] **Step 6: Verify in the browser, then commit and deploy**

```bash
python3 -m http.server 8000   # confirm ~20 cards render, then stop
git add data/copenhagen-2026.json sw.js
git commit -m "feat: real 20-place Copenhagen dataset from generator"
git push
```

Confirm on the phone that the card count went up.

---
## Task 7: Filtering and search (`src/filter.js`)

**Files:**
- Create: `src/filter.js`, `test/filter.test.mjs`

**Interfaces:**
- Consumes: `DURATION_BUCKETS` from `src/schema.mjs` (Task 3).
- Produces:
  - `EMPTY_FILTERS` → frozen `{ weather: null, ages: [], price: [], duration: null, kind: null, glutenFree: false, query: "" }`
  - `matchesDuration(minutes, bucketKey) => boolean`
  - `searchPlace(place, query) => boolean` — case-insensitive substring over `name`, `tags`, `description`, `category`, `neighbourhood`, `nearest_metro`
  - `filterPlaces(places, filters) => Place[]` preserving input order
  - `activeFilterCount(filters) => number` for a "clear filters" affordance

Rules this encodes, from the spec's testing table:
- **R1** `weather: "rainy"` keeps `indoor` and `mixed`, drops `outdoor`. `"sunny"` keeps `outdoor` and `mixed`.
- **R2** `ages` containing `"baby"` requires `baby_friendly === true` and ignores `changing_table` entirely.
- **R3** duration buckets never over-return.
- **R4** one query box across six fields.

- [ ] **Step 1: Write the failing tests**

Create `test/filter.test.mjs`. Each test name states the family reason, so a future change that breaks intent produces a readable failure.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlaces, matchesDuration, searchPlace, activeFilterCount, EMPTY_FILTERS } from "../src/filter.js";

function place(overrides = {}) {
  return {
    id: "x", name: "Somewhere", kind: "attraction", category: "museum",
    neighbourhood: "Indre By", description: "A pleasant place to spend an afternoon.",
    duration_minutes: 90, price_band: "€€", setting: "indoor",
    ages: ["toddler", "child", "adult"], baby_friendly: false, changing_table: false,
    gluten_free: "none", nearest_metro: "Nørreport", tags: ["quiet"],
    ...overrides,
  };
}

const withFilters = (overrides) => ({ ...EMPTY_FILTERS, ...overrides });

// ── R1: a soaked 1-year-old ends the day ──
test("rainy keeps indoor and mixed but drops outdoor", () => {
  const places = [
    place({ id: "indoor", setting: "indoor" }),
    place({ id: "mixed", setting: "mixed" }),
    place({ id: "outdoor", setting: "outdoor" }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "rainy" })).map((p) => p.id);
  assert.deepEqual(kept, ["indoor", "mixed"]);
});

test("mixed survives the rainy filter because indoor shelter is still usable in rain", () => {
  const kept = filterPlaces([place({ id: "tivoli", setting: "mixed" })], withFilters({ weather: "rainy" }));
  assert.equal(kept.length, 1);
});

test("sunny keeps outdoor and mixed but drops indoor-only", () => {
  const places = [
    place({ id: "indoor", setting: "indoor" }),
    place({ id: "mixed", setting: "mixed" }),
    place({ id: "outdoor", setting: "outdoor" }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "sunny" })).map((p) => p.id);
  assert.deepEqual(kept, ["mixed", "outdoor"]);
});

// ── R2: what matters is room to move around; we carry a changing mat ──
test("the baby filter requires baby_friendly", () => {
  const places = [
    place({ id: "soft-play", baby_friendly: true, ages: ["baby", "toddler"] }),
    place({ id: "spiral-tower", baby_friendly: false, ages: ["baby", "child"] }),
  ];
  const kept = filterPlaces(places, withFilters({ ages: ["baby"] })).map((p) => p.id);
  assert.deepEqual(kept, ["soft-play"]);
});

test("the baby filter ignores changing_table, because we bring a portable mat", () => {
  const kept = filterPlaces(
    [place({ id: "no-table", baby_friendly: true, changing_table: false, ages: ["baby"] })],
    withFilters({ ages: ["baby"] }),
  );
  assert.equal(kept.length, 1, "a baby-friendly place with no changing table must still be offered");
});

test("selecting several ages keeps a place suitable for any of them", () => {
  const places = [
    place({ id: "for-child", ages: ["child", "adult"] }),
    place({ id: "for-adult", ages: ["adult"] }),
  ];
  const kept = filterPlaces(places, withFilters({ ages: ["child", "toddler"] })).map((p) => p.id);
  assert.deepEqual(kept, ["for-child"]);
});

// ── R3: nap windows are short ──
test("the under-one-hour bucket never returns a four-hour place", () => {
  const places = [place({ id: "quick", duration_minutes: 45 }), place({ id: "park", duration_minutes: 240 })];
  const kept = filterPlaces(places, withFilters({ duration: "<1h" })).map((p) => p.id);
  assert.deepEqual(kept, ["quick"]);
});

test("bucket boundaries are inclusive at the stated minute", () => {
  assert.equal(matchesDuration(60, "<1h"), true);
  assert.equal(matchesDuration(61, "<1h"), false);
  assert.equal(matchesDuration(61, "1-2h"), true);
  assert.equal(matchesDuration(120, "1-2h"), true);
  assert.equal(matchesDuration(240, "half-day"), true);
  assert.equal(matchesDuration(241, "full-day"), true);
  assert.equal(matchesDuration(600, "full-day"), true);
});

// ── R4: one box, no thinking about which field ──
test("search covers all six fields so a word never hides in the wrong one", () => {
  const target = place({
    name: "Louisiana", category: "art-museum", neighbourhood: "Humlebæk",
    nearest_metro: "Nørreport", tags: ["rainy-day"], description: "Sculpture garden by the sea.",
  });
  for (const query of ["louisiana", "art-museum", "humlebæk", "nørreport", "rainy-day", "sculpture"]) {
    assert.equal(searchPlace(target, query), true, `query "${query}" should match`);
  }
  assert.equal(searchPlace(target, "aquarium"), false);
});

test("search is case-insensitive and ignores surrounding whitespace", () => {
  assert.equal(searchPlace(place({ name: "Den Blå Planet" }), "  BLÅ  "), true);
});

// ── combination and housekeeping ──
test("filters combine as AND, so a rainy free quick option is genuinely all three", () => {
  const places = [
    place({ id: "yes", setting: "indoor", price_band: "free", duration_minutes: 50 }),
    place({ id: "too-long", setting: "indoor", price_band: "free", duration_minutes: 200 }),
    place({ id: "outdoors", setting: "outdoor", price_band: "free", duration_minutes: 50 }),
  ];
  const kept = filterPlaces(places, withFilters({ weather: "rainy", price: ["free"], duration: "<1h" }));
  assert.deepEqual(kept.map((p) => p.id), ["yes"]);
});

test("the gluten-free filter keeps only places with reliable options", () => {
  const places = [
    place({ id: "good", gluten_free: "good" }),
    place({ id: "limited", gluten_free: "limited" }),
    place({ id: "none", gluten_free: "none" }),
  ];
  const kept = filterPlaces(places, withFilters({ glutenFree: true })).map((p) => p.id);
  assert.deepEqual(kept, ["good"], "limited is not reliable enough to plan a coeliac meal around");
});

test("no filters returns everything in the original order", () => {
  const places = [place({ id: "a" }), place({ id: "b" }), place({ id: "c" })];
  assert.deepEqual(filterPlaces(places, EMPTY_FILTERS).map((p) => p.id), ["a", "b", "c"]);
});

test("activeFilterCount reports how many filters are on, for a clear-all affordance", () => {
  assert.equal(activeFilterCount(EMPTY_FILTERS), 0);
  assert.equal(activeFilterCount(withFilters({ weather: "rainy", ages: ["baby"], query: "tivoli" })), 3);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/filter.test.mjs`
Expected: FAIL — `Cannot find module '../src/filter.js'`.

- [ ] **Step 3: Implement `src/filter.js`**

```js
import { DURATION_BUCKETS } from "./schema.mjs";

export const EMPTY_FILTERS = Object.freeze({
  weather: null,      // null | "rainy" | "sunny"
  ages: [],           // subset of baby | toddler | child | adult
  price: [],          // subset of free | € | €€ | €€€
  duration: null,     // null | key of DURATION_BUCKETS
  kind: null,         // null | attraction | playground | restaurant
  glutenFree: false,
  query: "",
});

const WEATHER_SETTINGS = { rainy: ["indoor", "mixed"], sunny: ["outdoor", "mixed"] };

const SEARCH_FIELDS = ["name", "description", "category", "neighbourhood", "nearest_metro"];

export function matchesDuration(minutes, bucketKey) {
  const range = DURATION_BUCKETS[bucketKey];
  if (!range) return true;
  return minutes >= range[0] && minutes <= range[1];
}

export function searchPlace(place, query) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  for (const field of SEARCH_FIELDS) {
    if (String(place[field] ?? "").toLowerCase().includes(needle)) return true;
  }
  return (place.tags ?? []).some((tag) => tag.toLowerCase().includes(needle));
}

// A place suits an age if it lists that age. "baby" is special: it additionally
// requires room for a 1-year-old to move around, and deliberately says nothing
// about changing facilities.
function matchesAge(place, age) {
  if (age === "baby") return place.baby_friendly === true;
  return (place.ages ?? []).includes(age);
}

export function filterPlaces(places, filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return places.filter((place) => {
    if (f.weather && !WEATHER_SETTINGS[f.weather].includes(place.setting)) return false;
    if (f.ages.length > 0 && !f.ages.some((age) => matchesAge(place, age))) return false;
    if (f.price.length > 0 && !f.price.includes(place.price_band)) return false;
    if (f.duration && !matchesDuration(place.duration_minutes, f.duration)) return false;
    if (f.kind && place.kind !== f.kind) return false;
    if (f.glutenFree && place.gluten_free !== "good") return false;
    if (!searchPlace(place, f.query)) return false;
    return true;
  });
}

export function activeFilterCount(filters) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return [
    f.weather !== null,
    f.ages.length > 0,
    f.price.length > 0,
    f.duration !== null,
    f.kind !== null,
    f.glutenFree,
    f.query.trim() !== "",
  ].filter(Boolean).length;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/filter.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/filter.js test/filter.test.mjs
git commit -m "feat: place filtering and search encoding the family rules"
```

---

## Task 8: User state (`src/state.js`)

**Files:**
- Create: `src/state.js`, `test/state.test.mjs`

**Interfaces:**
- Consumes: `EMPTY_FILTERS` from `src/filter.js` (Task 7).
- Produces:
  - `STORAGE_KEY` → `"trip.state.v1"`
  - `createState(storage) => State` where `storage` is any object with `getItem`/`setItem`. Injecting it is what makes this testable in node without a DOM.
  - `State` methods: `get()`, `toggleFavourite(id)`, `toggleVisited(id)`, `setNote(id, text)`, `addToDay(date, id)`, `removeFromDay(date, id)`, `moveInDay(date, id, delta)`, `setFilters(filters)`, `subscribe(fn) => unsubscribe`, `exportJson()`, `importJson(text)`
  - `state` → a default instance bound to `window.localStorage`, for the app to import.

Rule this encodes:
- **R5** state is keyed by place id and survives a dataset regeneration; a note on a place that has disappeared is orphaned, never deleted.

- [ ] **Step 1: Write the failing tests**

Create `test/state.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, STORAGE_KEY } from "../src/state.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

test("a fresh state starts empty rather than throwing", () => {
  const state = createState(fakeStorage());
  const snapshot = state.get();
  assert.deepEqual(snapshot.favourites, []);
  assert.deepEqual(snapshot.visited, []);
  assert.deepEqual(snapshot.notes, {});
  assert.deepEqual(snapshot.days, {});
});

test("corrupt stored JSON falls back to empty state instead of breaking the app mid-trip", () => {
  const state = createState(fakeStorage({ [STORAGE_KEY]: "{not json" }));
  assert.deepEqual(state.get().favourites, []);
});

test("toggling a favourite adds then removes it, and persists each time", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.toggleFavourite("tivoli");
  assert.deepEqual(state.get().favourites, ["tivoli"]);
  assert.match(storage.dump()[STORAGE_KEY], /tivoli/);
  state.toggleFavourite("tivoli");
  assert.deepEqual(state.get().favourites, []);
});

// ── R5: notes must survive a re-research ──
test("state is keyed by place id, so regenerating the dataset cannot erase notes", () => {
  const storage = fakeStorage();
  const first = createState(storage);
  first.setNote("tivoli", "buy tickets Sunday night");
  first.toggleVisited("rundetaarn");

  // Simulate a completely new dataset object being loaded: state is reconstructed
  // from storage alone and never consults the dataset.
  const afterRegeneration = createState(storage);
  assert.equal(afterRegeneration.get().notes.tivoli, "buy tickets Sunday night");
  assert.deepEqual(afterRegeneration.get().visited, ["rundetaarn"]);
});

test("a note on a place that has vanished from the dataset is orphaned, not deleted", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.setNote("closed-cafe", "they do gluten-free waffles");
  const reloaded = createState(storage);
  assert.equal(reloaded.get().notes["closed-cafe"], "they do gluten-free waffles");
});

test("clearing a note removes the key rather than storing an empty string", () => {
  const state = createState(fakeStorage());
  state.setNote("tivoli", "something");
  state.setNote("tivoli", "   ");
  assert.equal("tivoli" in state.get().notes, false);
});

test("adding to a day appends in order and refuses duplicates on the same day", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.addToDay("2026-08-03", "madkaffe");
  state.addToDay("2026-08-03", "tivoli");
  assert.deepEqual(state.get().days["2026-08-03"], ["tivoli", "madkaffe"]);
});

test("the same place may appear on two different days, because you might go twice", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.addToDay("2026-08-05", "tivoli");
  assert.deepEqual(state.get().days["2026-08-05"], ["tivoli"]);
});

test("moveInDay reorders within a day and clamps at the ends", () => {
  const state = createState(fakeStorage());
  for (const id of ["a", "b", "c"]) state.addToDay("2026-08-03", id);
  state.moveInDay("2026-08-03", "c", -1);
  assert.deepEqual(state.get().days["2026-08-03"], ["a", "c", "b"]);
  state.moveInDay("2026-08-03", "a", -1);
  assert.deepEqual(state.get().days["2026-08-03"], ["a", "c", "b"], "moving the first item up is a no-op");
});

test("removing the last item on a day drops the empty day key", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.removeFromDay("2026-08-03", "tivoli");
  assert.equal("2026-08-03" in state.get().days, false);
});

test("subscribers are notified on change and can unsubscribe", () => {
  const state = createState(fakeStorage());
  let calls = 0;
  const off = state.subscribe(() => { calls += 1; });
  state.toggleFavourite("tivoli");
  assert.equal(calls, 1);
  off();
  state.toggleFavourite("rundetaarn");
  assert.equal(calls, 1);
});

test("export then import round-trips the whole state, so notes can be backed up", () => {
  const source = createState(fakeStorage());
  source.setNote("tivoli", "tickets");
  source.toggleFavourite("den-bla-planet");
  source.addToDay("2026-08-03", "tivoli");

  const target = createState(fakeStorage());
  target.importJson(source.exportJson());
  assert.deepEqual(target.get(), source.get());
});

test("importing rubbish throws rather than silently wiping the trip", () => {
  const state = createState(fakeStorage());
  state.toggleFavourite("tivoli");
  assert.throws(() => state.importJson("{not json"));
  assert.deepEqual(state.get().favourites, ["tivoli"], "existing state must survive a failed import");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `Cannot find module '../src/state.js'`.

- [ ] **Step 3: Implement `src/state.js`**

```js
import { EMPTY_FILTERS } from "./filter.js";

export const STORAGE_KEY = "trip.state.v1";

const emptyState = () => ({
  version: 1,
  favourites: [],
  visited: [],
  notes: {},
  days: {},
  filters: { ...EMPTY_FILTERS },
});

function read(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    // Merge over a fresh empty state so a partial or older payload cannot
    // leave a field undefined and crash a view mid-trip.
    return { ...emptyState(), ...parsed, filters: { ...EMPTY_FILTERS, ...(parsed.filters ?? {}) } };
  } catch {
    return emptyState();
  }
}

const toggle = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

export function createState(storage) {
  let current = read(storage);
  const listeners = new Set();

  function commit(next) {
    current = next;
    storage.setItem(STORAGE_KEY, JSON.stringify(current));
    for (const listener of listeners) listener(current);
  }

  function withDay(date, mutate) {
    const items = current.days[date] ?? [];
    const updated = mutate([...items]);
    const days = { ...current.days };
    if (updated.length === 0) delete days[date];
    else days[date] = updated;
    commit({ ...current, days });
  }

  return {
    get: () => current,

    toggleFavourite(id) {
      commit({ ...current, favourites: toggle(current.favourites, id) });
    },

    toggleVisited(id) {
      commit({ ...current, visited: toggle(current.visited, id) });
    },

    setNote(id, text) {
      const notes = { ...current.notes };
      if (text.trim() === "") delete notes[id];
      else notes[id] = text;
      commit({ ...current, notes });
    },

    addToDay(date, id) {
      withDay(date, (items) => (items.includes(id) ? items : [...items, id]));
    },

    removeFromDay(date, id) {
      withDay(date, (items) => items.filter((item) => item !== id));
    },

    moveInDay(date, id, delta) {
      withDay(date, (items) => {
        const from = items.indexOf(id);
        const to = from + delta;
        if (from === -1 || to < 0 || to >= items.length) return items;
        items.splice(to, 0, items.splice(from, 1)[0]);
        return items;
      });
    },

    setFilters(filters) {
      commit({ ...current, filters: { ...EMPTY_FILTERS, ...filters } });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    exportJson: () => JSON.stringify(current, null, 2),

    // Parse before touching anything, so a bad paste cannot destroy a trip.
    importJson(text) {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) throw new Error("not a state object");
      commit({ ...emptyState(), ...parsed, filters: { ...EMPTY_FILTERS, ...(parsed.filters ?? {}) } });
    },
  };
}

export const state = typeof localStorage === "undefined" ? null : createState(localStorage);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/state.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state.js test/state.test.mjs
git commit -m "feat: id-keyed user state that survives dataset regeneration"
```

---
## Task 9: Wire search, filters and per-card actions into Explore

**Files:**
- Modify: `src/views/explore.js`, `src/app.js`, `styles.css`
- Modify: `sw.js` (add `src/filter.js`, `src/state.js` to `ASSETS`, bump cache to `v3`)

**Interfaces:**
- Consumes: `filterPlaces`, `activeFilterCount`, `EMPTY_FILTERS` (Task 7); `state` (Task 8); `h`, `clear` (Task 1).
- Produces: `renderExplore(places, { filters, onFilterChange, actions }) => HTMLElement`, where `actions` is `{ isFavourite(id), isVisited(id), onFavourite(id), onVisited(id), onAddToDay(id) }`.

- [ ] **Step 1: Replace `renderExplore` and extend `renderCard` in `src/views/explore.js`**

Keep everything already in the file; replace the exported `renderExplore` and add the pieces below. Filter chips are `<button aria-pressed>` rather than checkboxes so one tap toggles and screen readers announce state.

```js
import { filterPlaces, activeFilterCount, EMPTY_FILTERS } from "../filter.js";

const WEATHER_CHIPS = [
  { value: "rainy", label: "🌧 Rainy" },
  { value: "sunny", label: "☀️ Sunny" },
];
const AGE_CHIPS = [
  { value: "baby", label: "👶 Baby" },
  { value: "toddler", label: "🧒 Toddler" },
  { value: "child", label: "👧 6-year-old" },
];
const PRICE_CHIPS = ["free", "€", "€€", "€€€"].map((value) => ({ value, label: value === "free" ? "Free" : value }));
const DURATION_CHIPS = [
  { value: "<1h", label: "Under 1h" },
  { value: "1-2h", label: "1–2h" },
  { value: "half-day", label: "Half day" },
  { value: "full-day", label: "Full day" },
];
const KIND_CHIPS = [
  { value: "attraction", label: "🎡 Things to do" },
  { value: "playground", label: "🛝 Playgrounds" },
  { value: "restaurant", label: "🍽 Food" },
];

function chip(label, pressed, onClick) {
  return h("button", { class: "chip", type: "button", "aria-pressed": String(pressed), onClick }, label);
}

// A single-value group: tapping the active chip clears it.
function singleGroup(items, currentValue, onPick) {
  return items.map((item) =>
    chip(item.label, currentValue === item.value, () => onPick(currentValue === item.value ? null : item.value)),
  );
}

// A multi-value group: tapping toggles membership.
function multiGroup(items, currentList, onPick) {
  return items.map((item) =>
    chip(item.label, currentList.includes(item.value), () =>
      onPick(
        currentList.includes(item.value)
          ? currentList.filter((v) => v !== item.value)
          : [...currentList, item.value],
      ),
    ),
  );
}

function renderControls(filters, onFilterChange) {
  const set = (patch) => onFilterChange({ ...filters, ...patch });
  const count = activeFilterCount(filters);
  return h(
    "div",
    { class: "controls" },
    h("input", {
      class: "search",
      type: "search",
      value: filters.query,
      placeholder: "Search places, areas, metro…",
      "aria-label": "Search places",
      onInput: (event) => set({ query: event.target.value }),
    }),
    h(
      "div",
      { class: "chips" },
      singleGroup(WEATHER_CHIPS, filters.weather, (weather) => set({ weather })),
      multiGroup(AGE_CHIPS, filters.ages, (ages) => set({ ages })),
      singleGroup(KIND_CHIPS, filters.kind, (kind) => set({ kind })),
      singleGroup(DURATION_CHIPS, filters.duration, (duration) => set({ duration })),
      multiGroup(PRICE_CHIPS, filters.price, (price) => set({ price })),
      chip("GF", filters.glutenFree, () => set({ glutenFree: !filters.glutenFree })),
      count > 0 &&
        h("button", { class: "chip clear", type: "button", onClick: () => onFilterChange({ ...EMPTY_FILTERS }) },
          `Clear ${count}`),
    ),
  );
}

function cardActions(place, actions) {
  const favourite = actions.isFavourite(place.id);
  const visited = actions.isVisited(place.id);
  return h(
    "div",
    { class: "actions" },
    h("button", {
      class: "action", type: "button", "aria-pressed": String(favourite),
      "aria-label": `${favourite ? "Remove from" : "Add to"} favourites`,
      onClick: () => actions.onFavourite(place.id),
    }, favourite ? "♥ Saved" : "♡ Save"),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(visited),
      "aria-label": `Mark ${visited ? "not visited" : "visited"}`,
      onClick: () => actions.onVisited(place.id),
    }, visited ? "✓ Visited" : "✓ Visited?"),
    h("button", {
      class: "action primary", type: "button",
      onClick: () => actions.onAddToDay(place.id),
    }, "+ Add to day"),
  );
}

export function renderExplore(places, { filters, onFilterChange, actions }) {
  const matching = filterPlaces(places, filters);
  return h(
    "div",
    {},
    renderControls(filters, onFilterChange),
    h("p", { class: "count" }, `${matching.length} of ${places.length}`),
    matching.length === 0
      ? h("p", { class: "empty" }, "Nothing matches those filters.")
      : h("div", { class: "cards" }, matching.map((place) => {
          const card = renderCard(place);
          card.querySelector(".detail").append(cardActions(place, actions));
          if (actions.isVisited(place.id)) card.classList.add("is-visited");
          return card;
        })),
  );
}
```

- [ ] **Step 2: Add the day-picker dialog to `src/app.js`**

Tap-to-assign, per the spec. A native `<dialog>` gives Escape-to-close and focus trapping without custom code.

```js
import { state } from "./state.js";

// Inclusive list of trip dates, derived from the dataset so it works for any trip.
export function tripDates({ from, to }) {
  const dates = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

function askForDay(dates, placeName) {
  const dialog = h(
    "dialog",
    { class: "day-picker" },
    h("h2", {}, `Add ${placeName} to`),
    h("div", { class: "day-list" },
      dates.map((date) =>
        h("button", { class: "action", type: "button", onClick: () => dialog.close(date) }, formatDay(date)))),
    h("button", { class: "action", type: "button", onClick: () => dialog.close("") }, "Cancel"),
  );
  document.body.append(dialog);
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value || null);
    });
  });
}
```

- [ ] **Step 3: Rewrite the render loop in `src/app.js`**

Replace the Task 1 `start()` with a version that re-renders the active tab whenever state changes. Full-panel re-render is fast enough at 200 places and removes any risk of stale DOM.

```js
let data;
let activeTab = "explore";

const actions = {
  isFavourite: (id) => state.get().favourites.includes(id),
  isVisited: (id) => state.get().visited.includes(id),
  onFavourite: (id) => state.toggleFavourite(id),
  onVisited: (id) => state.toggleVisited(id),
  onAddToDay: async (id) => {
    const place = data.places.find((p) => p.id === id);
    const date = await askForDay(tripDates(data.trip), place.name);
    if (date) state.addToDay(date, id);
  },
};

function render() {
  const snapshot = state.get();
  if (activeTab === "explore") {
    clear(panels.explore);
    panels.explore.append(
      renderExplore(data.places, {
        filters: snapshot.filters,
        onFilterChange: (filters) => state.setFilters(filters),
        actions,
      }),
    );
  }
  // Later tasks add the other three branches here.
}

function showTab(name) {
  activeTab = name;
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  }
  render();
}

async function start() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  data = await response.json();
  document.querySelector("#trip-title").textContent = `${data.trip.city} ${data.trip.from.slice(0, 4)}`;
  document.title = `${data.trip.city} Trip Planner`;
  state.subscribe(render);
  showTab("explore");
}
```

Note: `renderExplore` re-creates the search input on every keystroke, which loses focus. Preserve it by restoring focus and caret after render:

```js
function render() {
  const active = document.activeElement;
  const wasSearch = active?.classList?.contains("search");
  const caret = wasSearch ? active.selectionStart : null;
  /* ... existing render body ... */
  if (wasSearch) {
    const search = panels.explore.querySelector(".search");
    search?.focus();
    if (caret !== null) search?.setSelectionRange(caret, caret);
  }
}
```

- [ ] **Step 4: Add the styles**

Append to `styles.css`:

```css
.controls { display: grid; gap: 0.6rem; margin-bottom: 0.75rem; }
.search { min-height: 44px; padding: 0 0.75rem; font: inherit; border: 1px solid var(--line); border-radius: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip {
  min-height: 44px; padding: 0 0.7rem; font: inherit; font-size: 0.85rem;
  border: 1px solid var(--line); border-radius: 22px; background: #fff; color: var(--ink); cursor: pointer;
}
.chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip.clear { border-style: dashed; }
.count { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.5rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
.action {
  min-height: 44px; padding: 0 0.8rem; font: inherit; font-size: 0.9rem;
  border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--ink); cursor: pointer;
}
.action[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.action.primary { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.is-visited summary .name { text-decoration: line-through; text-decoration-color: var(--muted); }
.day-picker { border: 0; border-radius: 14px; padding: 1rem; max-width: 22rem; width: calc(100% - 2rem); }
.day-picker::backdrop { background: rgb(0 0 0 / 0.4); }
.day-picker h2 { margin: 0 0 0.75rem; font-size: 1rem; }
.day-list { display: grid; gap: 0.4rem; margin-bottom: 0.6rem; }
```

- [ ] **Step 5: Verify in the browser**

Run: `python3 -m http.server 8000`

Confirm: typing in search narrows the list without losing focus; tapping "🌧 Rainy" excludes outdoor places; tapping it again clears it; "Clear N" resets everything; "♡ Save" persists across a page reload; "+ Add to day" opens a dialog listing the seven trip dates.

- [ ] **Step 6: Update the service worker and commit**

In `sw.js`, add `"src/filter.js"` and `"src/state.js"` to `ASSETS` and bump `CACHE` to `"trip-planner-v3"`.

```bash
node --test test/
git add src/views/explore.js src/app.js styles.css sw.js
git commit -m "feat: search, filter chips and per-card actions in Explore"
git push
```

---

## Task 10: Itinerary view

**Files:**
- Create: `src/views/itinerary.js`
- Modify: `src/app.js`, `styles.css`, `sw.js` (add the view, bump to `v4`)

**Interfaces:**
- Consumes: `state` (Task 8), `tripDates`, `formatDay` (Task 9), `h` (Task 1), `durationLabel` (Task 1).
- Produces: `renderItinerary({ trip, places, days, handlers }) => HTMLElement` where `handlers` is `{ onMove(date, id, delta), onRemove(date, id) }`.

- [ ] **Step 1: Write `src/views/itinerary.js`**

```js
import { h } from "../dom.js";
import { durationLabel } from "./explore.js";

function totalMinutes(items) {
  return items.reduce((sum, place) => sum + (place?.duration_minutes ?? 0), 0);
}

function row(place, date, index, count, handlers) {
  return h(
    "li",
    { class: "day-item" },
    h("span", { class: "grip" },
      h("button", {
        class: "nudge", type: "button", "aria-label": `Move ${place.name} earlier`,
        disabled: index === 0, onClick: () => handlers.onMove(date, place.id, -1),
      }, "⌃"),
      h("button", {
        class: "nudge", type: "button", "aria-label": `Move ${place.name} later`,
        disabled: index === count - 1, onClick: () => handlers.onMove(date, place.id, 1),
      }, "⌄")),
    h("span", { class: "day-item-body" },
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" },
        [place.neighbourhood, durationLabel(place.duration_minutes)].filter(Boolean).join(" · "))),
    h("button", {
      class: "remove", type: "button", "aria-label": `Remove ${place.name} from ${date}`,
      onClick: () => handlers.onRemove(date, place.id),
    }, "×"),
  );
}

export function renderItinerary({ trip, places, days, dates, handlers }) {
  const byId = new Map(places.map((place) => [place.id, place]));
  return h(
    "div",
    { class: "itinerary" },
    dates.map((date) => {
      // A stored id with no matching place means the dataset was regenerated
      // without it. Show it as unknown rather than dropping it silently.
      const ids = days[date] ?? [];
      const items = ids.map((id) => byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, duration_minutes: 0 });
      return h(
        "section",
        { class: "day" },
        h("h2", {}, formatDayHeading(date), items.length > 0 && h("span", { class: "day-total" },
          `${items.length} stop${items.length === 1 ? "" : "s"} · ${durationLabel(totalMinutes(items))}`)),
        items.length === 0
          ? h("p", { class: "empty" }, "Nothing planned. Add something from Explore.")
          : h("ol", { class: "day-items" },
              items.map((place, index) => row(place, date, index, items.length, handlers))),
      );
    }),
  );
}

function formatDayHeading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
```

- [ ] **Step 2: Wire it into `src/app.js`**

Add the import and the render branch:

```js
import { renderItinerary } from "./views/itinerary.js";

// inside render(), after the explore branch:
if (activeTab === "itinerary") {
  clear(panels.itinerary);
  panels.itinerary.append(
    renderItinerary({
      trip: data.trip,
      places: data.places,
      days: snapshot.days,
      dates: tripDates(data.trip),
      handlers: {
        onMove: (date, id, delta) => state.moveInDay(date, id, delta),
        onRemove: (date, id) => state.removeFromDay(date, id),
      },
    }),
  );
}
```

- [ ] **Step 3: Add the styles**

Append to `styles.css`:

```css
.itinerary { display: grid; gap: 1.25rem; }
.day h2 { margin: 0 0 0.4rem; font-size: 0.95rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
.day-total { font-size: 0.8rem; font-weight: 400; color: var(--muted); }
.day-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.day-item { display: flex; align-items: center; gap: 0.5rem; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 0.4rem 0.5rem; }
.grip { display: grid; }
.nudge { width: 44px; height: 22px; border: 0; background: none; color: var(--accent); font-size: 0.9rem; cursor: pointer; }
.nudge:disabled { color: var(--line); cursor: default; }
.day-item-body { flex: 1; display: grid; }
.remove { width: 44px; min-height: 44px; border: 0; background: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; }
```

- [ ] **Step 4: Verify persistence in the browser**

Add three places to one day and two to another. Reorder with the chevrons. Confirm the first item's up arrow and last item's down arrow are disabled. Reload the page — the plan is unchanged. In Safari, force-quit and reopen — still unchanged.

- [ ] **Step 5: Update the service worker and commit**

Add `"src/views/itinerary.js"` to `ASSETS` in `sw.js` and bump `CACHE` to `"trip-planner-v4"`.

```bash
node --test test/
git add src/views/itinerary.js src/app.js styles.css sw.js
git commit -m "feat: itinerary with tap-to-assign, reordering and persistence"
git push
```

---
## Task 11: Saved view

**Files:**
- Create: `src/views/saved.js`
- Modify: `src/app.js`, `styles.css`, `sw.js` (add the view, bump to `v5`)

**Interfaces:**
- Consumes: `state` (Task 8), `renderCard` (Task 1/9), `h` (Task 1).
- Produces: `renderSaved({ places, favourites, visited, notes, handlers }) => HTMLElement` where `handlers` is `{ onNote(id, text), onFavourite(id), onVisited(id) }`.

Notes are edited here rather than on the Explore card, so there is one place to find every note.

- [ ] **Step 1: Write `src/views/saved.js`**

```js
import { h } from "../dom.js";

function line(place, handlers, { favourite, visited }) {
  return h(
    "li",
    { class: `saved-item${visited ? " is-visited" : ""}` },
    h("span", { class: "day-item-body" },
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, place.neighbourhood ?? "")),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(favourite),
      "aria-label": `${favourite ? "Remove from" : "Add to"} favourites`,
      onClick: () => handlers.onFavourite(place.id),
    }, favourite ? "♥" : "♡"),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(visited),
      "aria-label": `Mark ${visited ? "not visited" : "visited"}`,
      onClick: () => handlers.onVisited(place.id),
    }, "✓"),
  );
}

function section(title, items) {
  return h(
    "section",
    { class: "day" },
    h("h2", {}, title),
    items.length === 0 ? h("p", { class: "empty" }, "Nothing yet.") : h("ul", { class: "saved-list" }, items),
  );
}

function noteEditor(place, text, handlers) {
  return h(
    "div",
    { class: "note" },
    h("label", { class: "note-label", for: `note-${place.id}` }, place.name),
    h("textarea", {
      id: `note-${place.id}`, class: "note-input", rows: 2,
      placeholder: "Add a note…",
      // Commit on blur rather than on every keystroke, so a full re-render
      // never interrupts typing.
      onBlur: (event) => handlers.onNote(place.id, event.target.value),
    }, text ?? ""),
  );
}

export function renderSaved({ places, favourites, visited, notes, handlers }) {
  const byId = new Map(places.map((place) => [place.id, place]));
  const resolve = (id) => byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, neighbourhood: "" };
  const flags = (id) => ({ favourite: favourites.includes(id), visited: visited.includes(id) });

  // Every place with a note, plus every favourite, gets an editor — so a note
  // can be written before deciding to favourite something.
  const noteIds = [...new Set([...Object.keys(notes), ...favourites])];

  return h(
    "div",
    { class: "itinerary" },
    section(`♥ Favourites · ${favourites.length}`,
      favourites.map((id) => line(resolve(id), handlers, flags(id)))),
    section(`✓ Visited · ${visited.length}`,
      visited.map((id) => line(resolve(id), handlers, flags(id)))),
    h("section", { class: "day" },
      h("h2", {}, `📝 Notes · ${Object.keys(notes).length}`),
      noteIds.length === 0
        ? h("p", { class: "empty" }, "Favourite something to start noting.")
        : h("div", { class: "notes" }, noteIds.map((id) => noteEditor(resolve(id), notes[id], handlers)))),
  );
}
```

- [ ] **Step 2: Wire it into `src/app.js`**

```js
import { renderSaved } from "./views/saved.js";

// inside render():
if (activeTab === "saved") {
  clear(panels.saved);
  panels.saved.append(
    renderSaved({
      places: data.places,
      favourites: snapshot.favourites,
      visited: snapshot.visited,
      notes: snapshot.notes,
      handlers: {
        onNote: (id, text) => state.setNote(id, text),
        onFavourite: (id) => state.toggleFavourite(id),
        onVisited: (id) => state.toggleVisited(id),
      },
    }),
  );
}
```

- [ ] **Step 3: Add the styles**

Append to `styles.css`:

```css
.saved-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.saved-item { display: flex; align-items: center; gap: 0.4rem; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 0.4rem 0.5rem; }
.saved-item.is-visited .name { text-decoration: line-through; text-decoration-color: var(--muted); }
.notes { display: grid; gap: 0.6rem; }
.note-label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem; }
.note-input { width: 100%; font: inherit; padding: 0.5rem; border: 1px solid var(--line); border-radius: 10px; resize: vertical; }
```

- [ ] **Step 4: Verify in the browser**

Favourite two places, mark one visited, type a note and click elsewhere to blur. Reload — the note is still there. Confirm the visited item shows struck-through in both Explore and Saved.

- [ ] **Step 5: Update the service worker and commit**

Add `"src/views/saved.js"` to `ASSETS` and bump `CACHE` to `"trip-planner-v5"`.

```bash
node --test test/
git add src/views/saved.js src/app.js styles.css sw.js
git commit -m "feat: saved view with favourites, visited and notes"
git push
```

---

## Task 12: Trip view with export and import

**Files:**
- Create: `src/views/trip.js`
- Modify: `src/app.js`, `styles.css`, `sw.js` (add the view, bump to `v6`)

**Interfaces:**
- Consumes: `state` (Task 8), `h` (Task 1).
- Produces:
  - `daysUntil(fromIso, todayIso) => number` — exported so it is testable without mocking the clock.
  - `renderTrip({ trip, places, snapshot, today, handlers }) => HTMLElement` where `handlers` is `{ onExport(), onImport(text) }`.

- [ ] **Step 1: Write the failing test for the countdown**

Create `test/trip.test.mjs`. The countdown is the one piece of arithmetic here, and an off-by-one on the first morning of the trip would be visible and annoying.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil } from "../src/views/trip.js";

test("counts whole days remaining before the trip", () => {
  assert.equal(daysUntil("2026-08-02", "2026-07-31"), 2);
});

test("the first day of the trip counts as zero, not one", () => {
  assert.equal(daysUntil("2026-08-02", "2026-08-02"), 0);
});

test("a past start date returns a negative number so the view can say the trip has begun", () => {
  assert.equal(daysUntil("2026-08-02", "2026-08-04"), -2);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/trip.test.mjs`
Expected: FAIL — `Cannot find module '../src/views/trip.js'`.

- [ ] **Step 3: Write `src/views/trip.js`**

```js
import { h } from "../dom.js";

const MS_PER_DAY = 86_400_000;

export function daysUntil(fromIso, todayIso) {
  return Math.round((Date.parse(`${fromIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / MS_PER_DAY);
}

function stat(value, label) {
  return h("div", { class: "stat" }, h("strong", {}, String(value)), h("span", {}, label));
}

function countdown(trip, today) {
  const days = daysUntil(trip.from, today);
  if (days > 0) return h("div", { class: "countdown" }, h("strong", {}, String(days)), h("span", {}, `days to ${trip.city}`));
  const ended = daysUntil(trip.to, today) < 0;
  return h("div", { class: "countdown" }, h("strong", {}, ended ? "🏠" : "🎉"),
    h("span", {}, ended ? `${trip.city} done` : `In ${trip.city} now`));
}

export function renderTrip({ trip, places, snapshot, today, handlers }) {
  const planned = Object.values(snapshot.days).reduce((sum, ids) => sum + ids.length, 0);
  return h(
    "div",
    { class: "itinerary" },
    countdown(trip, today),
    h("div", { class: "stats" },
      stat(`${snapshot.visited.length}/${places.length}`, "visited"),
      stat(snapshot.favourites.length, "favourites"),
      stat(planned, "planned stops"),
      stat(Object.keys(snapshot.notes).length, "notes")),
    h("section", { class: "day" },
      h("h2", {}, "Backup"),
      h("p", { class: "tip" }, "Export before regenerating the guide, so your notes and plan can be restored."),
      h("div", { class: "actions" },
        h("button", { class: "action primary", type: "button", onClick: handlers.onExport }, "⬇ Export"),
        h("label", { class: "action", for: "import-file" }, "⬆ Import"),
        h("input", {
          id: "import-file", class: "hidden-input", type: "file", accept: "application/json",
          onChange: async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            handlers.onImport(await file.text());
            event.target.value = "";
          },
        }))),
    h("p", { class: "tip" }, `Guide generated ${trip.generated_at?.slice(0, 10) ?? "unknown"} · ${places.length} places`),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/trip.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it into `src/app.js`**

```js
import { renderTrip } from "./views/trip.js";

function downloadJson(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = h("a", { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

// inside render():
if (activeTab === "trip") {
  clear(panels.trip);
  panels.trip.append(
    renderTrip({
      trip: data.trip,
      places: data.places,
      snapshot,
      today: new Date().toISOString().slice(0, 10),
      handlers: {
        onExport: () => downloadJson(`${data.trip.city.toLowerCase()}-trip-state.json`, state.exportJson()),
        onImport: (text) => {
          try {
            state.importJson(text);
          } catch (error) {
            alert(`That file could not be read: ${error.message}`);
          }
        },
      },
    }),
  );
}
```

- [ ] **Step 6: Add the styles**

Append to `styles.css`:

```css
.countdown { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 1rem; text-align: center; display: grid; gap: 0.2rem; }
.countdown strong { font-size: 2rem; line-height: 1; }
.countdown span { color: var(--muted); font-size: 0.9rem; }
.stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
.stat { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 0.6rem; text-align: center; display: grid; gap: 0.1rem; }
.stat strong { font-size: 1.2rem; }
.stat span { font-size: 0.75rem; color: var(--muted); }
.hidden-input { position: absolute; width: 1px; height: 1px; opacity: 0; }
label.action { display: inline-flex; align-items: center; cursor: pointer; }
```

- [ ] **Step 7: Verify the round trip in the browser**

Export the file. Clear the site's storage (Safari → Develop → Empty Caches, or `localStorage.clear()` in the console) and reload; confirm everything is empty. Import the file; confirm favourites, notes and the itinerary all return.

- [ ] **Step 8: Update the service worker and commit**

Add `"src/views/trip.js"` to `ASSETS` and bump `CACHE` to `"trip-planner-v6"`.

```bash
node --test test/
git add src/views/trip.js src/app.js styles.css sw.js test/trip.test.mjs
git commit -m "feat: trip view with countdown, counts and state backup"
git push
```

---

## Task 13: Widen the dataset

**Files:**
- Modify: `tools/generate-trip.mjs` (batch counts), `data/copenhagen-2026.json`, `sw.js` (bump to `v7`)

**Interfaces:**
- Consumes: everything. No new exports.

This task changes data, not code. If it requires a code change beyond batch configuration, that is a signal the two-program split leaked and should be raised rather than worked around.

- [ ] **Step 1: Widen the batch configuration**

In `tools/generate-trip.mjs`, replace `BATCHES` with:

```js
const BATCHES = [
  { key: "rainy-museums", count: 8, brief: "indoor museums and galleries that work on a wet day with young children" },
  { key: "rainy-other", count: 7, brief: "indoor attractions that are not museums — aquariums, science centres, swimming halls, indoor play" },
  { key: "sunny-parks", count: 8, brief: "parks, gardens and waterfront spots for fine weather" },
  { key: "sunny-attractions", count: 8, brief: "outdoor attractions, towers, boat trips and open-air museums" },
  { key: "playgrounds", count: 12, brief: "playgrounds and indoor play spaces, prioritising ones with a separate toddler area where a crawling 1-year-old is safe from older children" },
  { key: "food-gf", count: 10, brief: "family-friendly restaurants and cafes with reliable gluten-free options" },
  { key: "food-quick", count: 8, brief: "quick, casual, child-tolerant lunch spots and bakeries" },
  { key: "day-trips", count: 5, brief: "half-day trips reachable by train or metro within about an hour" },
  { key: "evening", count: 4, brief: "early-evening options that work with a 19:00 bedtime" },
];
```

- [ ] **Step 2: Regenerate**

```bash
node tools/generate-trip.mjs --city Copenhagen --country Denmark --from 2026-08-02 --to 2026-08-08 --out data/copenhagen-2026.json
node tools/validate-data.mjs data/copenhagen-2026.json
node --test test/
```

Expected: roughly 70–85 places, `valid`, all tests pass. Note in the commit message any batch that was skipped, so the gap is recorded rather than invisible.

- [ ] **Step 3: Check it is still usable on a phone**

Open the local server on the phone. Confirm: the Explore list scrolls smoothly, typing in search stays responsive, and filters return promptly. If search feels sluggish, measure before optimising:

```js
const t = performance.now(); filterPlaces(data.places, { query: "mus" }); console.log(performance.now() - t);
```

Expected: well under 20 ms. Do not add memoisation or indexing unless a measurement says otherwise.

- [ ] **Step 4: Spot-check five new places by hand**

Open five `website` links across different batches. Confirm each place exists, is in Copenhagen, and is not permanently closed. Delete any that fail and record why in the commit message.

- [ ] **Step 5: Bump the cache, commit and deploy**

```bash
sed -i '' 's/trip-planner-v6/trip-planner-v7/' sw.js
git add tools/generate-trip.mjs data/copenhagen-2026.json sw.js
git commit -m "feat: widen Copenhagen dataset to full coverage"
git push
```

- [ ] **Step 6: Confirm on the phone**

Open from the home screen, confirm the new count, then enable airplane mode and confirm it still works.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| Two-program architecture | 5, 6 |
| `claude -p` research with a swappable backend seam | 5 |
| Agreed thresholds (price, duration, near radius/pace) | 3 (constants), 5 (prompt), 7 (filtering) |
| One `places[]` collection discriminated by `kind` | 1, 3 |
| Excluded fields absent | 1 (fixture), 3 (`REQUIRED_PLACE_FIELDS`) |
| User state separate, id-keyed | 8 |
| `near[]` computed, not requested | 5 |
| Validation gate: bbox, dupes, dangling refs, enums, required | 3, 4 |
| Four tabs, top nav | 1, 9, 10, 11, 12 |
| Tap-to-assign itinerary | 9 (picker), 10 (view) |
| Plain styling | 1, and every task's style block |
| R1 rain excludes outdoor, keeps mixed | 7 |
| R2 baby needs `baby_friendly`, ignores `changing_table` | 7 |
| R3 duration buckets never over-return | 3, 7 |
| R4 search across six fields | 7 |
| R5 state survives regeneration; orphans kept | 8 |
| R6 bbox rejection | 3, 4 |
| R7 dangling `near[].id` rejection | 3, 4 |
| Offline via versioned service worker | 2, and a bump in every task that adds a file |
| Public Pages deployment | 2 |
| Export/import backup | 12 |
| 44 px targets, no horizontal scroll at 375 px | 1 (verified), styles throughout |

**Corrections applied during review:**

1. Task 1 originally claimed the fixture had "one per `kind`" but contained two attractions and a playground, no restaurant. The `kind-restaurant` colour band is therefore first exercised in Task 6; Step 4 of Task 6 now explicitly checks for it.
2. `src/views/itinerary.js` defines its own `formatDayHeading` and does not use `formatDay` from `app.js`. Its Interfaces block lists `formatDay` as consumed — it is not. Treat `tripDates` as the only import needed from `app.js`, and note that `tripDates`/`formatDay` are exported from `src/app.js` in Task 9 purely so they are reachable; if a circular import appears, move both into a new `src/dates.js` and update the two importers.
3. `renderCard` must be exported from `src/views/explore.js` (Task 1 shows `export function renderCard`) because Task 9 composes it and Task 11 does not. Confirmed consistent.
4. Every task that adds a file to `src/` also bumps the service worker cache and adds the file to `ASSETS`. Missing either means a device keeps serving a version that 404s the new module. The version sequence is v1 (Task 2), v2 (6), v3 (9), v4 (10), v5 (11), v6 (12), v7 (13).

**Known limitation, accepted:** `filterPlaces` is called on every keystroke over the full dataset with no memoisation. At 85 places this is microseconds. Task 13 Step 3 measures it rather than assuming.
