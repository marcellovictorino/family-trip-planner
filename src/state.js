import { EMPTY_FILTERS } from "./filter.js";

export const STORAGE_KEY = "trip.state.v1";
export const STATE_VERSION = 3;

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
  // Where the family is staying. Anchors the Explore distance sort when there
  // is no active day to anchor on instead; null until the user sets it, in
  // which case the anchor chain skips straight to the city centre.
  base: null,
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
// field undefined and crash a view mid-trip. Each version bump is purely
// additive: v1 → v2 gained an empty dayLog, v2 → v3 gains base: null — older
// payloads keep everything else exactly as it was.
function hydrate(parsed) {
  return {
    ...emptyState(),
    ...parsed,
    version: STATE_VERSION,
    dayLog: parsed.dayLog ?? {},
    filters: { ...EMPTY_FILTERS, ...(parsed.filters ?? {}) },
    base: parsed.base ?? null,
  };
}

const toggle = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

export function createState(storage) {
  let current = read(storage);
  const listeners = new Set();

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

  function withDay(date, mutate) {
    const items = current.days[date] ?? [];
    const updated = mutate([...items]);
    const days = { ...current.days };
    if (updated.length === 0) delete days[date];
    else days[date] = updated;
    commit({ ...current, days });
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

    // Auto Re-Order's proposal, once accepted: an outright replacement of the
    // day's order, never applied except in response to that explicit accept.
    reorderDay(date, order) {
      withDay(date, () => order);
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

    toggleDayVisited(date, id) {
      // Un-ticking a stop with no rating discards the entry entirely — an
      // untouched stop and an un-ticked one are the same thing, and a stray
      // entry would leak into the export as a phantom visit. But un-ticking a
      // *rated* stop must not cost the rating: an accidental tap should not
      // wipe a thumb, stars, or tags, so that entry is kept with done: false,
      // and re-ticking it later restores done: true with the rating intact.
      withDayEntry(date, id, (entry) => {
        if (!entry) return emptyEntry();
        if (!entry.done) return { ...entry, done: true };
        const hasRating = entry.thumb !== null || entry.stars !== null || entry.tags.length > 0;
        return hasRating ? { ...entry, done: false } : null;
      });
    },

    setDayRating(date, id, patch, now = new Date().toISOString()) {
      // Rating something implies you went: there is no way to open the sheet
      // without having ticked the stop, and a rating with done:false would be
      // meaningless in the store.
      withDayEntry(date, id, (entry) => ({ ...emptyEntry(), ...entry, ...patch, done: true, at: now }));
    },

    setFilters(filters) {
      commit({ ...current, filters: { ...EMPTY_FILTERS, ...filters } });
    },

    setBase(base) {
      commit({ ...current, base });
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
      commit(hydrate(parsed));
    },
  };
}

export const state = typeof localStorage === "undefined" ? null : createState(localStorage);
