import { h } from "../dom.js";
import { durationLabel, unknownPlace } from "./explore.js";
import { travelMinutes } from "../travel.js";

const MODE_GLYPH = { walk: "🚶", transit: "🚇" };

// A family day of sightseeing with small children realistically runs from a
// late-morning start to an early-evening finish. Past this, the plan is
// worth a second look — but geometry alone can't say whether it's actually
// too much, so the flag stays quiet rather than blocking anything.
const LONG_DAY_MINUTES = 540;

function totalMinutes(items) {
  return items.reduce((sum, place) => sum + (place?.duration_minutes ?? 0), 0);
}

// Legs only exist between two real, geolocated stops — an unknown place (its
// id survived a dataset regeneration that dropped it) has no lat/lon to route
// from, so the leg either side of it is left out rather than guessed at.
function legMinutes(items, zonesConfig) {
  let total = 0;
  const legs = [];
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i];
    const b = items[i + 1];
    if (typeof a.lat !== "number" || typeof b.lat !== "number") {
      legs.push(null);
      continue;
    }
    const leg = travelMinutes(a, b, zonesConfig);
    total += leg.minutes;
    legs.push(leg);
  }
  return { legs, total };
}

function legRow(leg) {
  if (!leg) return null;
  return h(
    "li",
    { class: "day-leg", "aria-hidden": "true" },
    h("span", { class: "day-leg-glyph" }, MODE_GLYPH[leg.mode]),
    h("span", { class: "day-leg-minutes" }, `~${leg.minutes} min`),
  );
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

export function renderItinerary({ trip, places, days, dates, dayLog = {}, zonesConfig, handlers }) {
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
      const stopsTotal = totalMinutes(items);
      const { legs, total: movingTotal } = legMinutes(items, zonesConfig);
      const isLongDay = stopsTotal + movingTotal > LONG_DAY_MINUTES;
      return h(
        "section",
        { class: "day" },
        h(
          "h2",
          { class: "section-heading" },
          formatDayHeading(date),
          items.length > 0 &&
            h(
              "span",
              { class: "meta" },
              `${items.length} stop${items.length === 1 ? "" : "s"} · ${durationLabel(stopsTotal)} at stops`,
              movingTotal > 0 && ` · ${durationLabel(movingTotal)} moving`,
            ),
          isLongDay && h("span", { class: "day-flag day-flag--long" }, "Long day"),
        ),
        items.length === 0
          ? emptyDay(allEmpty ? "Nothing here." : 'Nothing planned. Open a place in Explore and tap "+ Add to day".')
          : h("ol", { class: "day-items" },
              items.map((place, index) => [
                row(place, date, index, items.length, handlers, dayLog[date]?.[place.id]),
                legRow(legs[index]),
              ])),
      );
    }),
  );
}

function formatDayHeading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
