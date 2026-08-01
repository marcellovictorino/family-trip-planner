import { clear, h } from "./dom.js";
import { renderExplore, collectOpenIds, restoreOpenIds, unknownPlace } from "./views/explore.js";
import { renderItinerary, renderReorderDialog } from "./views/itinerary.js";
import { renderRatingSheet } from "./views/rating.js";
import { renderSaved } from "./views/saved.js";
import { renderTrip } from "./views/trip.js";
import { state } from "./state.js";
import { resolveAnchor, routeMinutes, proposeOrder } from "./travel.js";

const DATA_URL = "data/copenhagen-2026.json";

const panels = {
  explore: document.querySelector("#panel-explore"),
  itinerary: document.querySelector("#panel-itinerary"),
  saved: document.querySelector("#panel-saved"),
  trip: document.querySelector("#panel-trip"),
};

let data;
let activeTab = "explore";

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

// A quota error must reach the user. Silently losing a rating is worse than an
// ugly alert: the screen would say saved while the phone disagreed.
function guard(action) {
  try {
    action();
  } catch (error) {
    alert(error.message);
  }
}

function zonesConfig() {
  return { zones: data.zones, zone_minutes: data.zone_minutes };
}

// The proposal is computed fresh from the day's current items and never
// touches state until the user explicitly accepts it.
function openReorderDialog(date, items) {
  const { total: currentMinutes } = routeMinutes(items, zonesConfig());
  const { order, movingMinutes: proposedMinutes } = proposeOrder(items, zonesConfig());
  const byId = new Map(items.map((place) => [place.id, place]));
  const proposedItems = order.map((id) => byId.get(id));

  const dialog = renderReorderDialog({
    date, proposedItems, currentMinutes, proposedMinutes,
    handlers: {
      onAccept: () => {
        guard(() => state.reorderDay(date, order));
        dialog.close();
      },
      onDismiss: () => dialog.close(),
    },
  });
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

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

const actions = {
  isFavourite: (id) => state.get().favourites.includes(id),
  isVisited: (id) => state.get().visited.includes(id),
  onFavourite: (id) => guard(() => state.toggleFavourite(id)),
  onVisited: (id) => guard(() => state.toggleVisited(id)),
  onAddToDay: async (id) => {
    const place = data.places.find((p) => p.id === id);
    const date = await askForDay(tripDates(data.trip), place.name);
    if (date) guard(() => state.addToDay(date, id));
  },
};

function downloadJson(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = h("a", { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  const active = document.activeElement;
  const wasSearch = active?.classList?.contains("search");
  const caret = wasSearch ? active.selectionStart : null;
  // A rebuild would otherwise silently snap shut any card the user had open —
  // its <details open> state lives only on the DOM node being replaced.
  const openCardIds = activeTab === "explore" ? collectOpenIds(panels.explore) : null;
  const snapshot = state.get();
  if (activeTab === "explore") {
    clear(panels.explore);
    // "Active day" is today's date when the trip is under way; otherwise the
    // anchor chain has nothing to key a last-stop off and falls straight
    // through to base, then the city centre.
    const today = new Date().toISOString().slice(0, 10);
    const activeDate = tripDates(data.trip).includes(today) ? today : null;
    const anchor = resolveAnchor({
      places: data.places, days: snapshot.days, activeDate, base: snapshot.base, bbox: data.trip.bbox,
    });
    panels.explore.append(
      renderExplore(data.places, {
        filters: snapshot.filters,
        onFilterChange: (filters) => guard(() => state.setFilters(filters)),
        actions,
        anchor,
        zonesConfig: zonesConfig(),
      }),
    );
    restoreOpenIds(panels.explore, openCardIds);
  }
  if (activeTab === "itinerary") {
    clear(panels.itinerary);
    panels.itinerary.append(
      renderItinerary({
        trip: data.trip,
        places: data.places,
        days: snapshot.days,
        dates: tripDates(data.trip),
        dayLog: snapshot.dayLog,
        zonesConfig: zonesConfig(),
        handlers: {
          onMove: (date, id, delta) => guard(() => state.moveInDay(date, id, delta)),
          onRemove: (date, id) => guard(() => state.removeFromDay(date, id)),
          onToggleDone: (date, id) => guard(() => state.toggleDayVisited(date, id)),
          onRate: (date, id, thumb) => {
            guard(() => state.setDayRating(date, id, { thumb }));
            openRatingSheet(date, id);
          },
          onProposeReorder: (date, items) => openReorderDialog(date, items),
        },
      }),
    );
  }
  if (activeTab === "saved") {
    clear(panels.saved);
    panels.saved.append(
      renderSaved({
        places: data.places,
        favourites: snapshot.favourites,
        visited: snapshot.visited,
        notes: snapshot.notes,
        handlers: {
          onNote: (id, text) => guard(() => state.setNote(id, text)),
          onFavourite: (id) => guard(() => state.toggleFavourite(id)),
          onVisited: (id) => guard(() => state.toggleVisited(id)),
        },
      }),
    );
  }
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
  if (wasSearch) {
    const search = panels.explore.querySelector(".search");
    search?.focus();
    if (caret !== null) search?.setSelectionRange(caret, caret);
  }
}

function showTab(name) {
  activeTab = name;
  for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  }
  render();
}

document.querySelector("#tabs").addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) showTab(tab.dataset.tab);
});

async function start() {
  // Revalidate rather than trusting the HTTP cache. Without this the browser
  // happily serves a stale guide forever after the dataset is regenerated,
  // which is invisible and would only be noticed mid-trip. Offline is
  // unaffected: the service worker intercepts and falls back to its cache.
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  data = await response.json();
  document.querySelector("#trip-title").textContent = `${data.trip.city} ${data.trip.from.slice(0, 4)}`;
  document.title = `${data.trip.city} Trip Planner`;
  state.subscribe(render);
  showTab("explore");
}

start().catch((error) => {
  panels.explore.textContent = error.message;
  console.error(error);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("SW registration failed", error));
  });
}
