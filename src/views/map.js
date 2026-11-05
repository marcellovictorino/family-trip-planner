import { h, clear } from "../dom.js";
import { renderCard } from "./explore.js";

// Keep the map alive across state changes: saving a place must not reset zoom.
export function createMapView({ trip, places, actions }) {
  const canvas = h("div", { class: "place-map", role: "region", "aria-label": "Trip places map" });
  const status = h("p", { class: "count", role: "status" }, "Loading map tiles…");
  const details = h("div", { class: "map-selection", "aria-live": "polite" });
  const select = h("select", { id: "map-place", class: "search" },
    h("option", { value: "" }, "Choose a place…"),
    [...places].sort((a, b) => a.name.localeCompare(b.name)).map((place) =>
      h("option", { value: place.id }, place.name)));
  const fit = h("button", { type: "button", class: "action" }, "Fit region");
  const root = h("div", { class: "map-view" },
    h("h2", { class: "section-heading" }, "Map"),
    h("p", { class: "count" }, "All places, including day trips. Map tiles need a connection; previously viewed tiles may be available offline."),
    h("div", { class: "controls" }, h("label", { for: "map-place" }, "Select a place"), select, fit),
    status, canvas, details);
  let selected;
  let map;
  const markers = new Map();
  const update = () => {
    clear(details);
    if (!selected) {
      details.append(h("p", { class: "count" }, "Tap a marker or choose a place to see its details."));
      return;
    }
    const card = renderCard(selected);
    card.setAttribute("open", "");
    details.append(card, h("div", { class: "actions" },
      h("button", { type: "button", class: "action", "aria-pressed": String(actions.isFavourite(selected.id)),
        onClick: () => actions.onFavourite(selected.id) }, actions.isFavourite(selected.id) ? "♥ Saved" : "♡ Save"),
      h("button", { type: "button", class: "action", onClick: () => actions.onAddToDay(selected.id) }, "Add to day")));
  };
  const choose = (place) => {
    selected = place;
    select.value = place.id;
    map.setView([place.lat, place.lon], 12, { animate: false });
    markers.get(place.id).openPopup();
    update();
  };
  select.addEventListener("change", () => {
    const place = places.find((p) => p.id === select.value);
    if (place) choose(place);
    else { selected = null; map.closePopup(); update(); }
  });
  const mount = () => {
    if (map) { map.invalidateSize(); return; }
    if (!window.L) {
      status.textContent = "The map could not load. Reload to try again; Explore still has every place.";
      select.disabled = fit.disabled = true;
      return;
    }
    const L = window.L;
    map = L.map(canvas, { scrollWheelZoom: false });
    const bounds = trip.region_bbox ?? trip.bbox;
    const fitRegion = () => map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [24, 24], animate: false });
    // Establish a view before adding markers: Leaflet only creates their DOM
    // once the map has a centre and zoom.
    fitRegion();
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    let failed = false;
    tiles.on("loading", () => { failed = false; status.textContent = "Loading map tiles…"; });
    tiles.on("tileerror", () => { failed = true; status.textContent = "Some map tiles are unavailable. Check your connection, then use Fit region to try again. Place markers and details still work."; });
    tiles.on("load", () => { if (!failed) status.textContent = `${places.length} places on the map. Select a marker for details.`; });
    tiles.addTo(map);
    for (const place of places) {
      const label = h("span", { class: "map-dot", "data-kind": place.kind });
      const marker = L.marker([place.lat, place.lon], {
        icon: L.divIcon({ className: "place-marker", html: label, iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: place.name, alt: place.name, keyboard: true,
      }).addTo(map);
      const popup = h("div", {}, h("strong", {}, place.name), h("p", {}, place.neighbourhood),
        h("button", { type: "button", class: "action", onClick: () => details.scrollIntoView({ block: "nearest" }) }, "View selected place"));
      marker.bindPopup(popup).on("click", () => choose(place));
      marker.getElement().dataset.placeId = place.id;
      markers.set(place.id, marker);
    }
    fit.addEventListener("click", () => { map.closePopup(); fitRegion(); tiles.redraw(); });
    update();
  };
  return { root, mount, update };
}
