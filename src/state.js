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
