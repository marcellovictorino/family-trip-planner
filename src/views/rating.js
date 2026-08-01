import { h } from "../dom.js";
import { tagsForKind } from "../feedback.js";

function heading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function field(label, ...children) {
  return h("div", { class: "field" }, h("p", { class: "field-label" }, label), ...children);
}

function thumbs(entry, handlers) {
  return h(
    "div",
    { class: "thumbs" },
    ["up", "down"].map((direction) =>
      h("button", {
        class: "thumb", type: "button",
        "aria-pressed": String(entry.thumb === direction),
        "aria-label": direction === "up" ? "Would recommend" : "Would not recommend",
        // Tapping the thumb that is already set clears it: the sheet opens with
        // one pre-filled, and changing your mind must not mean living with it.
        onClick: () => handlers.onThumb(entry.thumb === direction ? null : direction),
      }, direction === "up" ? "👍" : "👎"),
    ),
  );
}

function stars(entry, handlers) {
  return h(
    "div",
    { class: "stars" },
    [1, 2, 3, 4, 5].map((n) =>
      h("button", {
        class: "star", type: "button",
        "aria-pressed": String((entry.stars ?? 0) >= n),
        "aria-label": `${n} star${n === 1 ? "" : "s"}`,
        onClick: () => handlers.onStars(entry.stars === n ? null : n),
      }, (entry.stars ?? 0) >= n ? "★" : "☆"),
    ),
  );
}

function tags(place, entry, handlers) {
  const chosen = entry.tags ?? [];
  return h(
    "div",
    { class: "chips" },
    // A place whose id outlived the dataset has no kind, so it gets no tags —
    // the thumb, the stars and the note still work.
    tagsForKind(place.kind).map((tag) =>
      h("button", {
        class: "tag", type: "button",
        "aria-pressed": String(chosen.includes(tag.value)),
        onClick: () =>
          handlers.onTags(
            chosen.includes(tag.value) ? chosen.filter((v) => v !== tag.value) : [...chosen, tag.value],
          ),
      }, tag.label),
    ),
  );
}

export function renderRatingSheet({ place, date, entry, note, handlers }) {
  return h(
    "dialog",
    { class: "rating-sheet", "aria-label": `Rate ${place.name}` },
    h("h2", {}, place.name),
    h("p", { class: "sheet-sub" }, [heading(date), place.neighbourhood].filter(Boolean).join(" · ")),
    field("Would you recommend to another family?", thumbs(entry, handlers)),
    field("Rating", stars(entry, handlers)),
    field("What stood out", tags(place, entry, handlers)),
    field(
      "Notes",
      h("textarea", {
        class: "note-input", rows: 3, "aria-label": `Notes about ${place.name}`,
        placeholder: "What would you tell another family?",
        // Commit on blur rather than on every keystroke, matching the Saved
        // tab's editor — a re-render mid-sentence would eat the caret.
        onBlur: (event) => handlers.onNote(event.target.value),
      }, note ?? ""),
      h("p", { class: "sheet-warning" },
        "Saved into this repository when you ingest it — keep it publishable."),
    ),
    h("button", { class: "action primary", type: "button", onClick: () => handlers.onClose() }, "Done"),
  );
}
