import React from "react";

export const FACILITIES = {
  baby: { glyph: "👶", label: "Room for a baby to move around" },
  stroller: { glyph: "🛒", label: "Pram accessible" },
  indoor: { glyph: "🌧", label: "Indoors" },
  mixed: { glyph: "🌤", label: "Indoor and outdoor" },
  glutenFree: { glyph: "GF", label: "Good gluten-free options" },
  booking: { glyph: "🎫", label: "Booking required" },
  kidsMenu: { glyph: "🧒", label: "Kids menu" },
  highChair: { glyph: "🪑", label: "High chair" },
};

export function FacilityIcon({ facility, style }) {
  const f = FACILITIES[facility];
  if (!f) return null;
  return (
    <span title={f.label} aria-label={f.label} role="img"
      style={{ lineHeight: 1, fontSize: "var(--text-small)", fontFamily: f.glyph === "GF" ? "var(--font-mono)" : "inherit", fontWeight: f.glyph === "GF" ? 600 : undefined, color: "var(--text-body)", ...style }}>
      {f.glyph}
    </span>
  );
}

export function FacilityRow({ facilities = [], style }) {
  return (
    <span style={{ display: "flex", gap: "var(--gap-chips)", ...style }}>
      {facilities.map((f) => <FacilityIcon key={f} facility={f} />)}
    </span>
  );
}
