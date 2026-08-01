import React from "react";

export function NoteEditor({ id, placeName, defaultValue = "", onCommit, placeholder = "Add a note…", style }) {
  return (
    <div style={{ fontFamily: "var(--font-body)", ...style }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "var(--text-fine)", fontWeight: "var(--weight-semibold)", marginBottom: "var(--space-2xs)" }}>{placeName}</label>
      <textarea id={id} rows={2} defaultValue={defaultValue} placeholder={placeholder}
        onBlur={(e) => onCommit && onCommit(e.target.value)}
        style={{ width: "100%", font: "inherit", fontSize: "var(--text-small)", padding: "var(--space-sm)",
          border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--surface-raised)",
          color: "var(--text-body)", resize: "vertical", outlineColor: "var(--line-focus)" }} />
    </div>
  );
}
