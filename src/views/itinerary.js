import { h } from "../dom.js";
import { durationLabel, unknownPlace } from "./explore.js";

function totalMinutes(items) {
  return items.reduce((sum, place) => sum + (place?.duration_minutes ?? 0), 0);
}

export function starLabel(stars) {
  return "★★★★★".slice(0, stars) + "☆☆☆☆☆".slice(0, 5 - stars);
}

function thumbButton(place, date, entry, direction, handlers) {
  const glyph = direction === "up" ? "👍" : "👎";
  const wording = direction === "up" ? "recommend" : "not recommend";
  return h("button", {
    class: "thumb", type: "button",
    "aria-pressed": String(entry.thumb === direction),
    "aria-label": `Would ${wording} ${place.name} to another family, and open notes`,
    onClick: () => handlers.onRate(date, place.id, direction),
  }, glyph);
}

function row(place, date, index, count, handlers, entry) {
  const done = Boolean(entry?.done);
  const log = entry ?? { thumb: null, stars: null, tags: [] };
  const facts = [
    place.neighbourhood,
    // An unknown place has no duration_minutes at all — showing "0 min"
    // would claim it takes no time, rather than that its length is unknown.
    typeof place.duration_minutes === "number" ? durationLabel(place.duration_minutes) : null,
    log.stars ? starLabel(log.stars) : null,
  ].filter(Boolean).join(" · ");

  return h(
    "li",
    { class: `day-item${done ? " is-visited" : ""}` },
    // Reordering a stop that already happened is meaningless, and the space is
    // better spent on the verdict.
    done
      ? h("span", { class: "thumbs" },
          thumbButton(place, date, log, "up", handlers),
          thumbButton(place, date, log, "down", handlers))
      : h("span", { class: "grip" },
          h("button", {
            class: "nudge", type: "button", "aria-label": `Move ${place.name} earlier`,
            disabled: index === 0, onClick: () => handlers.onMove(date, place.id, -1),
          }, "⌃"),
          h("button", {
            class: "nudge", type: "button", "aria-label": `Move ${place.name} later`,
            disabled: index === count - 1, onClick: () => handlers.onMove(date, place.id, 1),
          }, "⌄")),
    h("button", {
      class: "day-item-body", type: "button", "aria-pressed": String(done),
      "aria-label": `Mark ${place.name} ${done ? "not visited" : "visited"}`,
      onClick: () => handlers.onToggleDone(date, place.id),
    },
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, facts)),
    h("button", {
      class: "remove", type: "button", "aria-label": `Remove ${place.name} from ${date}`,
      onClick: () => handlers.onRemove(date, place.id),
    }, "×"),
  );
}

function emptyDay(text) {
  return h("p", { class: "empty-state" }, h("span", { class: "glyph", "aria-hidden": "true" }, "🗓"), text);
}

export function renderItinerary({ trip, places, days, dates, dayLog = {}, handlers }) {
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
      const items = ids.map((id) => byId.get(id) ?? unknownPlace(id));
      return h(
        "section",
        { class: "day" },
        h("h2", { class: "section-heading" }, formatDayHeading(date), items.length > 0 && h("span", { class: "meta" },
          `${items.length} stop${items.length === 1 ? "" : "s"} · ${durationLabel(totalMinutes(items))}`)),
        items.length === 0
          ? emptyDay(allEmpty ? "Nothing here." : 'Nothing planned. Open a place in Explore and tap "+ Add to day".')
          : h("ol", { class: "day-items" },
              items.map((place, index) =>
                row(place, date, index, items.length, handlers, dayLog[date]?.[place.id]))),
      );
    }),
  );
}

function formatDayHeading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
