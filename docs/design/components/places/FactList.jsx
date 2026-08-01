import React from "react";

export function FactList({ items = [], style }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.2rem 0.75rem", margin: "var(--space-md) 0", fontFamily: "var(--font-body)", fontSize: "var(--text-small)", ...style }}>
      {items.map(([term, value]) => (
        <React.Fragment key={term}>
          <dt style={{ color: "var(--text-muted)" }}>{term}</dt>
          <dd style={{ margin: 0 }}>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
