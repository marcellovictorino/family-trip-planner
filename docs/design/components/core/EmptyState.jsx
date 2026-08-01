import React from "react";

export function EmptyState({ children = "Nothing yet.", glyph, style }) {
  return (
    <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-small)", ...style }}>
      {glyph ? <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>{glyph}</span> : null}
      {children}
    </p>
  );
}
