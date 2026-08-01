import React from "react";

const KINDS = {
  attraction: { bg: "var(--kind-attraction)", ink: "var(--kind-attraction-ink)", glyph: "🎡" },
  playground: { bg: "var(--kind-playground)", ink: "var(--kind-playground-ink)", glyph: "🛝" },
  restaurant: { bg: "var(--kind-restaurant)", ink: "var(--kind-restaurant-ink)", glyph: "🍽" },
};

export function KindBand({ kind = "attraction", label, style }) {
  const k = KINDS[kind] || KINDS.attraction;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.3rem", justifySelf: "start",
        padding: "0.1rem 0.4rem", borderRadius: "var(--radius-xs)",
        background: k.bg, color: k.ink,
        fontFamily: "var(--font-body)", fontSize: "var(--text-micro)", fontWeight: "var(--weight-semibold)",
        letterSpacing: "var(--tracking-wide)", textTransform: "lowercase",
        ...style,
      }}
    >
      <span aria-hidden="true">{k.glyph}</span>
      {label || kind}
    </span>
  );
}
