import { clear, h } from "./dom.js";
import { renderExplore } from "./views/explore.js";
import { renderItinerary } from "./views/itinerary.js";
import { state } from "./state.js";

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
  const active = document.activeElement;
  const wasSearch = active?.classList?.contains("search");
  const caret = wasSearch ? active.selectionStart : null;
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
  // Later tasks add the other branches here.
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
  const response = await fetch(DATA_URL);
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
