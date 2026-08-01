import React from "react";

export function Stat({ value, label, style }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
      padding: "var(--space-md)", textAlign: "center", display: "grid", gap: "0.1rem",
      boxShadow: "var(--shadow-card)", fontFamily: "var(--font-body)", ...style }}>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", letterSpacing: "var(--tracking-tight)" }}>{value}</strong>
      <span style={{ fontSize: "var(--text-micro)", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

export function StatGrid({ children, style }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-sm)", ...style }}>{children}</div>;
}
