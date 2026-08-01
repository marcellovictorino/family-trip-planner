import { test } from "node:test";
import assert from "node:assert/strict";

// A richer fake DOM than test/dom.test.mjs's, capable of rendering a real
// card tree and then querying it back — enough to assert on user-visible
// behaviour without a browser or any dependency.
class FakeElement {
  constructor(tag) {
    this.tag = tag.toLowerCase();
    this.attrs = {};
    this.className = "";
    this.children = [];
    this.parent = null;
    this.listeners = {};
  }
  get classList() {
    const self = this;
    return {
      add(name) {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        set.add(name);
        self.className = [...set].join(" ");
      },
      contains(name) {
        return self.className.split(/\s+/).filter(Boolean).includes(name);
      },
    };
  }
  setAttribute(key, value) {
    this.attrs[key] = String(value);
  }
  getAttribute(key) {
    return this.attrs[key];
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  append(...kids) {
    for (const kid of kids) {
      if (typeof kid === "string") this.children.push({ text: kid });
      else {
        kid.parent = this;
        this.children.push(kid);
      }
    }
  }
  get textContent() {
    return collectText(this);
  }
  querySelectorAll(selector) {
    return queryAll(this, selector);
  }
  querySelector(selector) {
    return queryAll(this, selector)[0] ?? null;
  }
}

function collectText(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(collectText).join("");
}

function descendants(el, acc = []) {
  for (const child of el.children) {
    if (child.text === undefined) {
      acc.push(child);
      descendants(child, acc);
    }
  }
  return acc;
}

function parseCompound(compound) {
  const tagMatch = compound.match(/^[a-zA-Z][\w-]*/);
  const tag = tagMatch ? tagMatch[0].toLowerCase() : null;
  const rest = tag ? compound.slice(tag.length) : compound;
  const classes = [];
  const attrs = [];
  let id = null;
  for (const part of rest.match(/\.[\w-]+|#[\w-]+|\[[^\]]+\]/g) ?? []) {
    if (part.startsWith(".")) {
      classes.push(part.slice(1));
    } else if (part.startsWith("#")) {
      id = part.slice(1);
    } else {
      const inner = part.slice(1, -1);
      const eq = inner.indexOf("=");
      if (eq === -1) attrs.push([inner.trim(), null]);
      else attrs.push([inner.slice(0, eq).trim(), inner.slice(eq + 1).trim().replace(/^["']|["']$/g, "")]);
    }
  }
  return { tag, classes, attrs, id };
}

function elMatches(el, compound) {
  const p = parseCompound(compound);
  if (p.tag && el.tag !== p.tag) return false;
  if (p.id && el.attrs.id !== p.id) return false;
  const classes = el.className.split(/\s+/).filter(Boolean);
  if (!p.classes.every((c) => classes.includes(c))) return false;
  return p.attrs.every(([name, value]) => {
    const actual = el.attrs[name];
    if (actual === undefined) return false;
    return value === null || actual === value;
  });
}

function queryAll(root, selector) {
  const parts = selector.trim().split(/\s+/);
  const candidates = descendants(root);
  return candidates.filter((el) => {
    if (!elMatches(el, parts[parts.length - 1])) return false;
    let cursor = el.parent;
    let idx = parts.length - 2;
    while (cursor && idx >= 0) {
      if (elMatches(cursor, parts[idx])) idx -= 1;
      cursor = cursor.parent;
    }
    return idx < 0;
  });
}

globalThis.document = {
  createElement: (tag) => new FakeElement(tag),
  createTextNode: (text) => ({ text }),
};

const { renderExplore, collectOpenIds, restoreOpenIds } = await import("../src/views/explore.js");
const { renderItinerary, starLabel } = await import("../src/views/itinerary.js");
const { renderSaved } = await import("../src/views/saved.js");
const { renderTrip } = await import("../src/views/trip.js");
const { EMPTY_FILTERS } = await import("../src/filter.js");

function place(overrides) {
  return {
    id: "tivoli",
    name: "Tivoli Gardens",
    kind: "attraction",
    category: "amusement park",
    neighbourhood: "Indre By",
    duration_minutes: 240,
    price_band: "€€",
    description: "A historic amusement park in the heart of Copenhagen with rides and gardens.",
    tips: "Go at opening time to beat the queues.",
    baby_notes: null,
    nearest_metro: "Nørreport",
    best_time: "morning",
    booking: "none",
    website: "https://example.com",
    booking_url: null,
    maps_url: "https://maps.example.com",
    baby_friendly: true,
    stroller: true,
    setting: "mixed",
    gluten_free: "good",
    ...overrides,
  };
}

const noopActions = {
  isFavourite: () => false,
  isVisited: () => false,
  onFavourite: () => {},
  onVisited: () => {},
  onAddToDay: () => {},
};

test("renderExplore shows an empty-state message when no place matches the filters, rather than a blank screen", () => {
  const places = [place()];
  const root = renderExplore(places, {
    filters: { ...EMPTY_FILTERS, query: "no-such-place-anywhere" },
    onFilterChange: () => {},
    actions: noopActions,
  });
  assert.equal(root.querySelectorAll(".card").length, 0);
  const empty = root.querySelector(".empty-state");
  assert.ok(empty, "expected an empty-state element");
  assert.match(empty.textContent, /nothing matches/i);
});

test("renderExplore renders one card per matching place and the count line agrees with that number", () => {
  const places = [place({ id: "tivoli" }), place({ id: "rundetaarn", name: "Rundetaarn" })];
  const root = renderExplore(places, { filters: { ...EMPTY_FILTERS }, onFilterChange: () => {}, actions: noopActions });
  assert.equal(root.querySelectorAll(".card").length, 2);
  assert.equal(root.querySelector(".count").textContent, "2 of 2");
});

test("a visited place is visually marked so a user can tell what they've already done", () => {
  const places = [place({ id: "tivoli" }), place({ id: "rundetaarn", name: "Rundetaarn" })];
  const actions = { ...noopActions, isVisited: (id) => id === "rundetaarn" };
  const root = renderExplore(places, { filters: { ...EMPTY_FILTERS }, onFilterChange: () => {}, actions });
  const cards = root.querySelectorAll(".card");
  const visitedCard = cards.find((c) => c.attrs["data-id"] === "rundetaarn");
  const otherCard = cards.find((c) => c.attrs["data-id"] === "tivoli");
  assert.ok(visitedCard.classList.contains("is-visited"));
  assert.ok(!otherCard.classList.contains("is-visited"));
});

test("renderItinerary shows every trip day, including empty ones, so a gap in the plan is obvious", () => {
  const dates = ["2026-08-03", "2026-08-04", "2026-08-05"];
  const places = [place({ id: "tivoli" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates,
    handlers: { onMove: () => {}, onRemove: () => {} },
  });
  const days = root.querySelectorAll(".day");
  assert.equal(days.length, dates.length);
  const emptyDays = days.filter((d) => d.querySelector(".empty-state"));
  assert.equal(emptyDays.length, 2);
});

test("the first item's move-earlier control and the last item's move-later control are disabled", () => {
  const places = [
    place({ id: "a", name: "A" }),
    place({ id: "b", name: "B" }),
    place({ id: "c", name: "C" }),
  ];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["a", "b", "c"] },
    dates: ["2026-08-03"],
    handlers: { onMove: () => {}, onRemove: () => {} },
  });
  const buttons = root.querySelectorAll("button.nudge");
  const earlier = (name) => buttons.find((b) => b.attrs["aria-label"] === `Move ${name} earlier`);
  const later = (name) => buttons.find((b) => b.attrs["aria-label"] === `Move ${name} later`);
  assert.equal(earlier("A").attrs.disabled, "");
  assert.equal(later("C").attrs.disabled, "");
  assert.equal(earlier("B").attrs.disabled, undefined);
  assert.equal(later("B").attrs.disabled, undefined);
});

test("an itinerary entry whose id is no longer in the dataset still renders, labelled, instead of vanishing silently", () => {
  const places = [place({ id: "tivoli" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli", "ghost-place"] },
    dates: ["2026-08-03"],
    handlers: { onMove: () => {}, onRemove: () => {} },
  });
  assert.match(root.textContent, /ghost-place \(no longer in the guide\)/);
});

test("renderSaved lists favourites and visited separately, and shows a note editor for a place with a note", () => {
  const places = [
    place({ id: "tivoli", name: "Tivoli Gardens" }),
    place({ id: "rundetaarn", name: "Rundetaarn" }),
  ];
  const root = renderSaved({
    places,
    favourites: ["tivoli"],
    visited: ["rundetaarn"],
    notes: { tivoli: "Bring extra layers" },
    handlers: { onNote: () => {}, onFavourite: () => {}, onVisited: () => {} },
  });
  const sections = root.querySelectorAll("section.day");
  const favouritesSection = sections.find((s) => /Favourites/.test(s.textContent));
  const visitedSection = sections.find((s) => /Visited/.test(s.textContent));
  assert.match(favouritesSection.textContent, /Tivoli Gardens/);
  assert.doesNotMatch(favouritesSection.textContent, /Rundetaarn/);
  assert.match(visitedSection.textContent, /Rundetaarn/);
  assert.doesNotMatch(visitedSection.textContent, /Tivoli Gardens/);
  const note = root.querySelector("#note-tivoli");
  assert.ok(note, "expected a note editor for the place with a note");
  assert.equal(note.textContent, "Bring extra layers");
});

test("renderTrip shows the countdown and the visited-of-total figure", () => {
  const places = [place({ id: "tivoli" }), place({ id: "rundetaarn", name: "Rundetaarn" })];
  const root = renderTrip({
    trip: { from: "2026-08-10", to: "2026-08-17", city: "Copenhagen", generated_at: "2026-08-01" },
    places,
    snapshot: { favourites: [], visited: ["tivoli"], notes: {}, days: {} },
    today: "2026-08-01",
    handlers: { onExport: () => {}, onImport: () => {} },
  });
  const countdown = root.querySelector(".countdown");
  assert.ok(countdown, "expected a countdown element");
  assert.match(countdown.textContent, /days to Copenhagen/);
  const stats = root.querySelectorAll(".stat");
  const visitedStat = stats.find((s) => /visited/.test(s.textContent));
  assert.match(visitedStat.textContent, /1\/2/);
});

test("a card left open survives collectOpenIds/restoreOpenIds around a rebuild, keyed by data-id", () => {
  const places = [place({ id: "tivoli" }), place({ id: "rundetaarn", name: "Rundetaarn" })];
  const opts = { filters: { ...EMPTY_FILTERS }, onFilterChange: () => {}, actions: noopActions };

  const before = document.createElement("div");
  before.append(renderExplore(places, opts));
  before.querySelector('.card[data-id="tivoli"]').setAttribute("open", "");
  const openIds = collectOpenIds(before);
  assert.ok(openIds.has("tivoli"));
  assert.ok(!openIds.has("rundetaarn"));

  // A fresh render — the same rebuild that would otherwise silently close it.
  const after = document.createElement("div");
  after.append(renderExplore(places, opts));
  restoreOpenIds(after, openIds);
  assert.equal(after.querySelector('.card[data-id="tivoli"]').getAttribute("open"), "");
  assert.equal(after.querySelector('.card[data-id="rundetaarn"]').getAttribute("open"), undefined);
});

test("collectOpenIds finds nothing on a panel with no expanded cards, and restoreOpenIds is a no-op", () => {
  const places = [place({ id: "tivoli" })];
  const opts = { filters: { ...EMPTY_FILTERS }, onFilterChange: () => {}, actions: noopActions };
  const container = document.createElement("div");
  container.append(renderExplore(places, opts));
  const openIds = collectOpenIds(container);
  assert.equal(openIds.size, 0);
  restoreOpenIds(container, openIds);
  assert.equal(container.querySelector('.card[data-id="tivoli"]').getAttribute("open"), undefined);
});

test("a vanished place id reads identically in Itinerary and Saved, and shows no duration", () => {
  const places = []; // "ghost" is no longer in the dataset
  const itinerary = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["ghost"] },
    dates: ["2026-08-03"],
    handlers: { onMove: () => {}, onRemove: () => {} },
  });
  const saved = renderSaved({
    places,
    favourites: ["ghost"],
    visited: [],
    notes: {},
    handlers: { onNote: () => {}, onFavourite: () => {}, onVisited: () => {} },
  });
  assert.match(itinerary.textContent, /ghost \(no longer in the guide\)/);
  assert.match(saved.textContent, /ghost \(no longer in the guide\)/);
  // The old itinerary.js placeholder set duration_minutes: 0, which printed a
  // misleading "0 min" next to the unknown stop itself (the day's own total
  // is a separate computation, out of scope here).
  const row = itinerary.querySelector(".day-item-body .facts-line");
  assert.equal(row.textContent, "");
});

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

// Un-ticking a rated stop keeps the rating, so "has an entry" and "was visited"
// are different questions. If a future change swapped `entry.done` for a bare
// `entry` truthiness check, this row would silently come back struck-through
// with its arrows gone, even though the family hasn't been there yet.
test("an entry with done: false still holding a rating renders as an ordinary, not-yet-visited row", () => {
  const places = [place({ id: "tivoli", name: "Tivoli Gardens" })];
  const root = renderItinerary({
    trip: {},
    places,
    days: { "2026-08-03": ["tivoli"] },
    dates: ["2026-08-03"],
    dayLog: {
      "2026-08-03": {
        tivoli: { done: false, thumb: "up", stars: 3, tags: ["baby-great"], at: "2026-08-02T18:00:00Z" },
      },
    },
    handlers: { onMove: () => {}, onRemove: () => {}, onToggleDone: () => {}, onRate: () => {} },
  });
  const row = root.querySelector("li.day-item");
  assert.ok(!row.classList.contains("is-visited"));
  assert.equal(root.querySelectorAll("button.nudge").length, 2);
  assert.equal(root.querySelectorAll("button.thumb").length, 0);
  assert.match(row.textContent, /★★★☆☆/);
});

test("starLabel always returns five glyphs, filled up to the given count", () => {
  assert.equal(starLabel(1), "★☆☆☆☆");
  assert.equal(starLabel(5), "★★★★★");
  assert.equal(starLabel(1).length, 5);
  assert.equal(starLabel(5).length, 5);
});

test("search input debounces the committed query, but clearing it commits immediately", async () => {
  const places = [place({ id: "tivoli" }), place({ id: "rundetaarn", name: "Rundetaarn" })];
  let committed = null;
  const root = renderExplore(places, {
    filters: { ...EMPTY_FILTERS },
    onFilterChange: (filters) => { committed = filters; },
    actions: noopActions,
  });
  const search = root.querySelector(".search");
  search.listeners.input({ target: { value: "tivo" } });
  assert.equal(committed, null, "typing should not commit synchronously");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(committed.query, "tivo", "the debounced commit should land after the pause");

  committed = null;
  search.listeners.input({ target: { value: "" } });
  assert.ok(committed, "clearing the box should commit immediately, with no debounce");
  assert.equal(committed.query, "");
});
