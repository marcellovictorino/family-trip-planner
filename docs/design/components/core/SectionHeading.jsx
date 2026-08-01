import React from "react";

export function SectionHeading({ children, meta, as: Tag = "h2", style }) {
  return (
    <Tag style={{
      margin: "0 0 var(--space-xs)", display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", alignItems: "baseline",
      fontFamily: "var(--font-display)", fontSize: "var(--text-subheading)", fontWeight: "var(--weight-bold)",
      letterSpacing: "var(--tracking-tight)", color: "var(--text-body)", ...style,
    }}>
      {children}
      {meta ? <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-micro)", fontWeight: "var(--weight-regular)", color: "var(--text-muted)" }}>{meta}</span> : null}
    </Tag>
  );
}
