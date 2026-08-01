import React from "react";

export function SearchField({ value, onChange, placeholder = "Search places, areas, metro…", style, ...rest }) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label="Search places"
      style={{
        minHeight: "var(--tap-min)", width: "100%", padding: "0 0.75rem",
        fontFamily: "var(--font-body)", fontSize: "var(--text-body-size)", color: "var(--text-body)",
        border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
        background: "var(--surface-raised)", boxShadow: "var(--shadow-card)", outlineColor: "var(--line-focus)",
        ...style,
      }}
      {...rest}
    />
  );
}
