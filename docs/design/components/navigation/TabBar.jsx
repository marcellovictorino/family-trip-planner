import React from "react";

export function TabBar({ tabs = [], active, onSelect, style }) {
  return (
    <nav role="tablist" style={{ display: "flex", overflowX: "auto", ...style }}>
      {tabs.map((t) => {
        const value = t.value ?? t;
        const on = value === active;
        return (
          <button key={value} role="tab" aria-selected={String(on)} type="button" onClick={() => onSelect && onSelect(value)}
            style={{ flex: "1 0 auto", minHeight: "var(--tap-min)", padding: "0 var(--space-xl)", border: 0,
              borderBottom: "3px solid " + (on ? "var(--accent)" : "transparent"), background: "none",
              fontFamily: "var(--font-body)", fontSize: "var(--text-small)",
              fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
              color: on ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", transition: "var(--transition-tap)" }}>
            {t.label ?? value}
          </button>
        );
      })}
    </nav>
  );
}

export function AppHeader({ title, tabs, active, onSelect, style }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg-header)", borderBottom: "1px solid var(--line)", ...style }}>
      <h1 style={{ margin: 0, padding: "var(--space-md) var(--space-xl) var(--space-2xs)",
        fontFamily: "var(--font-display)", fontSize: "var(--text-title)", fontWeight: "var(--weight-bold)",
        letterSpacing: "var(--tracking-tight)", color: "var(--text-body)" }}>{title}</h1>
      <TabBar tabs={tabs} active={active} onSelect={onSelect} />
    </header>
  );
}
