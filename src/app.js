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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => console.warn("SW registration failed", error));
  });
}
