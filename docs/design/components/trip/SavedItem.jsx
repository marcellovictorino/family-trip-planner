import React from "react";

export function SavedItem({ name, meta, favourite = false, visited = false, onFavourite, onVisited, style }) {
  const mark = (active, glyph, label, onClick) => (
    <button type="button" aria-pressed={String(active)} aria-label={label} onClick={onClick}
      style={{ minHeight: "var(--tap-min)", minWidth: "var(--tap-min)", padding: "0 0.6rem",
        border: "1px solid " + (active ? "var(--accent)" : "var(--line)"), borderRadius: "var(--radius-sm)",
        background: active ? "var(--accent)" : "var(--surface-raised)", color: active ? "var(--text-on-accent)" : "var(--text-muted)",
        fontSize: "var(--text-small)", cursor: "pointer", transition: "var(--transition-tap)" }}>{glyph}</button>
  );
  return (
    <li style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", background: "var(--surface-card)",
      border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--pad-row)",
      boxShadow: "var(--shadow-card)", fontFamily: "var(--font-body)", ...style }}>
      <span style={{ flex: 1, display: "grid" }}>
        <span style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-small)",
          textDecoration: visited ? "line-through" : "none", textDecorationColor: "var(--text-muted)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-fine)", color: "var(--text-muted)" }}>{meta}</span>
      </span>
      {mark(favourite, favourite ? "♥" : "♡", favourite ? "Remove from favourites" : "Add to favourites", onFavourite)}
      {mark(visited, "✓", visited ? "Mark not visited" : "Mark visited", onVisited)}
    </li>
  );
}
