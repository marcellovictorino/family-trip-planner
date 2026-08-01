import React from "react";

export function Chip({ pressed = false, dashed = false, children, style, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={String(pressed)}
      style={{
        minHeight: "var(--tap-min)", padding: "0 0.7rem",
        fontFamily: "var(--font-body)", fontSize: "var(--text-fine)", fontWeight: "var(--weight-medium)",
        display: "inline-flex", alignItems: "center", gap: "0.35rem",
        border: dashed ? "1px dashed var(--line-strong)" : "1px solid var(--line)",
        borderRadius: "var(--radius-pill)",
        background: pressed ? "var(--accent)" : "var(--surface-raised)",
        color: pressed ? "var(--text-on-accent)" : "var(--text-body)",
        cursor: "pointer", transition: "var(--transition-tap)", whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, style }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--gap-chips)", ...style }}>{children}</div>;
}
