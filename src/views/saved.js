import { h } from "../dom.js";

function line(place, handlers, { favourite, visited }) {
  return h(
    "li",
    { class: `saved-item${visited ? " is-visited" : ""}` },
    h("span", { class: "day-item-body" },
      h("span", { class: "name" }, place.name),
      h("span", { class: "facts-line" }, place.neighbourhood ?? "")),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(favourite),
      "aria-label": `${favourite ? "Remove from" : "Add to"} favourites`,
      onClick: () => handlers.onFavourite(place.id),
    }, favourite ? "♥" : "♡"),
    h("button", {
      class: "action", type: "button", "aria-pressed": String(visited),
      "aria-label": `Mark ${visited ? "not visited" : "visited"}`,
      onClick: () => handlers.onVisited(place.id),
    }, "✓"),
  );
}

function section(title, items) {
  return h(
    "section",
    { class: "day" },
    h("h2", {}, title),
    items.length === 0 ? h("p", { class: "empty" }, "Nothing yet.") : h("ul", { class: "saved-list" }, items),
  );
}

function noteEditor(place, text, handlers) {
  return h(
    "div",
    { class: "note" },
    h("label", { class: "note-label", for: `note-${place.id}` }, place.name),
    h("textarea", {
      id: `note-${place.id}`, class: "note-input", rows: 2,
      placeholder: "Add a note…",
      // Commit on blur rather than on every keystroke, so a full re-render
      // never interrupts typing.
      onBlur: (event) => handlers.onNote(place.id, event.target.value),
    }, text ?? ""),
  );
}

export function renderSaved({ places, favourites, visited, notes, handlers }) {
  const byId = new Map(places.map((place) => [place.id, place]));
  const resolve = (id) => byId.get(id) ?? { id, name: `${id} (no longer in the guide)`, neighbourhood: "" };
  const flags = (id) => ({ favourite: favourites.includes(id), visited: visited.includes(id) });

  // Every place with a note, plus every favourite, gets an editor — so a note
  // can be written before deciding to favourite something.
  const noteIds = [...new Set([...Object.keys(notes), ...favourites])];

  return h(
    "div",
    { class: "itinerary" },
    section(`♥ Favourites · ${favourites.length}`,
      favourites.map((id) => line(resolve(id), handlers, flags(id)))),
    section(`✓ Visited · ${visited.length}`,
      visited.map((id) => line(resolve(id), handlers, flags(id)))),
    h("section", { class: "day" },
      h("h2", {}, `📝 Notes · ${Object.keys(notes).length}`),
      noteIds.length === 0
        ? h("p", { class: "empty" }, "Favourite something to start noting.")
        : h("div", { class: "notes" }, noteIds.map((id) => noteEditor(resolve(id), notes[id], handlers)))),
  );
}
