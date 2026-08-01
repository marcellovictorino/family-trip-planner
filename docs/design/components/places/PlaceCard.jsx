import React from "react";
import { KindBand } from "../core/KindBand.jsx";
import { FacilityRow } from "../core/FacilityIcon.jsx";
import { FactList } from "./FactList.jsx";

export function durationLabel(minutes) {
  if (!minutes) return "";
  if (minutes <= 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h${minutes % 60}`;
}

const PRICE_LABEL = { free: "Free", "€": "€", "€€": "€€", "€€€": "€€€" };

function facilitiesOf(place) {
  return [
    place.baby_friendly && "baby",
    place.stroller && "stroller",
    place.setting === "indoor" && "indoor",
    place.setting === "mixed" && "mixed",
    place.gluten_free === "good" && "glutenFree",
    place.booking === "required" && "booking",
  ].filter(Boolean);
}

export function PlaceCard({ place, open, visited = false, onToggle, actions = null, style }) {
  const facts = [place.neighbourhood, durationLabel(place.duration_minutes), PRICE_LABEL[place.price_band]].filter(Boolean).join(" · ");
  return (
    <details
      open={open}
      onToggle={onToggle}
      data-id={place.id}
      style={{
        background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
        overflow: "hidden", boxShadow: "var(--shadow-card)", ...style,
      }}
    >
      <summary style={{ display: "grid", gap: "0.15rem", padding: "var(--pad-card)", minHeight: "var(--tap-min)", cursor: "pointer", listStyle: "none", fontFamily: "var(--font-body)" }}>
        <KindBand kind={place.kind} label={place.category} />
        <span style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-heading)", fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-tight)", color: "var(--text-body)",
          textDecoration: visited ? "line-through" : "none", textDecorationColor: "var(--text-muted)",
        }}>{place.name}</span>
        <span style={{ fontSize: "var(--text-fine)", color: "var(--text-muted)" }}>{facts}</span>
        <FacilityRow facilities={facilitiesOf(place)} style={{ marginTop: "0.15rem" }} />
      </summary>
      <div style={{ padding: "0 var(--pad-card) var(--pad-card)", borderTop: "1px solid var(--line)", fontFamily: "var(--font-body)" }}>
        <p style={{ margin: "var(--space-md) 0", fontSize: "var(--text-small)", lineHeight: "var(--leading-normal)", textWrap: "pretty" }}>{place.description}</p>
        {place.tips ? <p style={{ margin: "var(--space-md) 0", fontSize: "var(--text-small)", color: "var(--text-muted)" }}>Tip: {place.tips}</p> : null}
        {place.baby_notes ? <p style={{ margin: "var(--space-md) 0", fontSize: "var(--text-small)", color: "var(--text-muted)" }}>Baby: {place.baby_notes}</p> : null}
        <FactList
          items={[
            place.nearest_metro && ["Metro", place.nearest_metro],
            place.best_time && ["Best time", place.best_time],
            ["Booking", place.booking],
          ].filter(Boolean)}
        />
        <p style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-lg)", margin: "var(--space-md) 0 0" }}>
          {place.website ? <a href={place.website} target="_blank" rel="noopener" style={{ minHeight: "var(--tap-min)", display: "inline-flex", alignItems: "center", color: "var(--text-link)", fontSize: "var(--text-small)", fontWeight: "var(--weight-semibold)" }}>Website</a> : null}
          {place.booking_url ? <a href={place.booking_url} target="_blank" rel="noopener" style={{ minHeight: "var(--tap-min)", display: "inline-flex", alignItems: "center", color: "var(--text-link)", fontSize: "var(--text-small)", fontWeight: "var(--weight-semibold)" }}>Book</a> : null}
          {place.maps_url ? <a href={place.maps_url} target="_blank" rel="noopener" style={{ minHeight: "var(--tap-min)", display: "inline-flex", alignItems: "center", color: "var(--text-link)", fontSize: "var(--text-small)", fontWeight: "var(--weight-semibold)" }}>Map</a> : null}
        </p>
        {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>{actions}</div> : null}
      </div>
    </details>
  );
}
