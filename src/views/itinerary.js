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

function emptyDay(text) {
  return h("p", { class: "empty-state" }, h("span", { class: "glyph", "aria-hidden": "true" }, "🗓"), text);
}

export function renderItinerary({ trip, places, days, dates, handlers }) {
  const byId = new Map(places.map((place) => [place.id, place]));
  const allEmpty = dates.every((date) => (days[date] ?? []).length === 0);

  return h(
    "div",
    { class: "itinerary" },
    // First run: one clear explanation of the mechanism, instead of the same
    // instruction repeated under every single day.
    allEmpty &&
      emptyDay('Nothing planned yet. Open a place in Explore and tap "+ Add to day" to put it here.'),
    dates.map((date) => {
      // A stored id with no matching place means the dataset was regenerated
      // without it. Show it as unknown rather than dropping it silently.
      const ids = days[date] ?? [];
      const items = ids.map((id) => byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, duration_minutes: 0 });
      return h(
        "section",
        { class: "day" },
        h("h2", { class: "section-heading" }, formatDayHeading(date), items.length > 0 && h("span", { class: "meta" },
          `${items.length} stop${items.length === 1 ? "" : "s"} · ${durationLabel(totalMinutes(items))}`)),
        items.length === 0
          ? emptyDay(allEmpty ? "Nothing here." : 'Nothing planned. Open a place in Explore and tap "+ Add to day".')
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
