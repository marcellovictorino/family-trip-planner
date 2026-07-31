import { h } from "../dom.js";

const MS_PER_DAY = 86_400_000;

export function daysUntil(fromIso, todayIso) {
  return Math.round((Date.parse(`${fromIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / MS_PER_DAY);
}

function stat(value, label) {
  return h("div", { class: "stat" }, h("strong", {}, String(value)), h("span", {}, label));
}

function countdown(trip, today) {
  const days = daysUntil(trip.from, today);
  if (days > 0) return h("div", { class: "countdown" }, h("strong", {}, String(days)), h("span", {}, `days to ${trip.city}`));
  const ended = daysUntil(trip.to, today) < 0;
  return h("div", { class: "countdown" }, h("strong", {}, ended ? "🏠" : "🎉"),
    h("span", {}, ended ? `${trip.city} done` : `In ${trip.city} now`));
}

export function renderTrip({ trip, places, snapshot, today, handlers }) {
  const planned = Object.values(snapshot.days).reduce((sum, ids) => sum + ids.length, 0);
  return h(
    "div",
    { class: "itinerary" },
    countdown(trip, today),
    h("div", { class: "stats" },
      stat(`${snapshot.visited.length}/${places.length}`, "visited"),
      stat(snapshot.favourites.length, "favourites"),
      stat(planned, "planned stops"),
      stat(Object.keys(snapshot.notes).length, "notes")),
    h("section", { class: "day" },
      h("h2", {}, "Backup"),
      h("p", { class: "tip" }, "Export before regenerating the guide, so your notes and plan can be restored."),
      h("div", { class: "actions" },
        h("button", { class: "action primary", type: "button", onClick: handlers.onExport }, "⬇ Export"),
        h("label", { class: "action", for: "import-file" }, "⬆ Import"),
        h("input", {
          id: "import-file", class: "hidden-input", type: "file", accept: "application/json",
          onChange: async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            handlers.onImport(await file.text());
            event.target.value = "";
          },
        }))),
    h("p", { class: "tip" }, `Guide generated ${trip.generated_at?.slice(0, 10) ?? "unknown"} · ${places.length} places`),
  );
}
