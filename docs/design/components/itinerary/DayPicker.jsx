import React from "react";

export function DayPicker({ placeName, dates = [], onPick, onCancel, style }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={`Add ${placeName} to a day`}
      style={{ border: 0, borderRadius: "var(--radius-lg)", padding: "var(--space-xl)", maxWidth: "22rem", width: "calc(100% - 2rem)",
        background: "var(--surface-raised)", boxShadow: "var(--shadow-dialog)", fontFamily: "var(--font-body)", ...style }}>
      <h2 style={{ margin: "0 0 var(--space-lg)", fontFamily: "var(--font-display)", fontSize: "var(--text-body-size)", letterSpacing: "var(--tracking-tight)" }}>
        Add {placeName} to
      </h2>
      <div style={{ display: "grid", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
        {dates.map((d) => (
          <button key={d.value ?? d} type="button" onClick={() => onPick && onPick(d.value ?? d)}
            style={{ minHeight: "var(--tap-min)", padding: "0 0.8rem", textAlign: "left", fontFamily: "var(--font-body)", fontSize: "var(--text-small)",
              border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-body)", cursor: "pointer", transition: "var(--transition-tap)" }}>
            {d.label ?? d}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel}
        style={{ minHeight: "var(--tap-min)", width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
          background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-small)", cursor: "pointer" }}>Cancel</button>
    </div>
  );
}
