import React from "react";

export function Countdown({ headline, caption, style }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
      padding: "var(--space-xl)", textAlign: "center", display: "grid", gap: "var(--space-2xs)",
      boxShadow: "var(--shadow-raised)", fontFamily: "var(--font-body)", ...style }}>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: "2rem", lineHeight: 1, letterSpacing: "var(--tracking-tight)", color: "var(--accent)" }}>{headline}</strong>
      <span style={{ color: "var(--text-muted)", fontSize: "var(--text-small)" }}>{caption}</span>
    </div>
  );
}
