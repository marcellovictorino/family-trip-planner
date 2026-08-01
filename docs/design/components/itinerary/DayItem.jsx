import React from "react";

function Nudge({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      style={{ width: "44px", height: "22px", border: 0, background: "none", cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--line-strong)" : "var(--accent)", fontSize: "var(--text-small)", transition: "var(--transition-tap)" }}>
      {children}
    </button>
  );
}

export function DayItem({ name, meta, first = false, last = false, onMoveUp, onMoveDown, onRemove, style }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", background: "var(--surface-card)",
      border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--pad-row)",
      boxShadow: "var(--shadow-card)", fontFamily: "var(--font-body)", ...style }}>
      <span style={{ display: "grid" }}>
        <Nudge label={`Move ${name} earlier`} disabled={first} onClick={onMoveUp}>⌃</Nudge>
        <Nudge label={`Move ${name} later`} disabled={last} onClick={onMoveDown}>⌄</Nudge>
      </span>
      <span style={{ flex: 1, display: "grid" }}>
        <span style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-small)" }}>{name}</span>
        <span style={{ fontSize: "var(--text-fine)", color: "var(--text-muted)" }}>{meta}</span>
      </span>
      <button type="button" aria-label={`Remove ${name}`} onClick={onRemove}
        style={{ width: "44px", minHeight: "var(--tap-min)", border: 0, background: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
    </li>
  );
}
