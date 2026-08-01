import React from "react";

const base = {
  minHeight: "var(--tap-min)", padding: "0 0.8rem", font: "inherit",
  fontFamily: "var(--font-body)", fontSize: "var(--text-small)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
  border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
  background: "var(--surface-raised)", color: "var(--text-body)", cursor: "pointer",
  transition: "var(--transition-tap)", boxShadow: "var(--shadow-card)",
};

const variants = {
  quiet: {},
  primary: { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: "var(--weight-semibold)" },
  filled: { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--text-on-accent)", fontWeight: "var(--weight-semibold)" },
  ghost: { background: "transparent", borderColor: "transparent", boxShadow: "none", color: "var(--text-muted)" },
};

export function Button({ variant = "quiet", pressed, disabled, icon, children, style, ...rest }) {
  const on = pressed === true;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed === undefined ? undefined : String(on)}
      style={{
        ...base, ...variants[variant],
        ...(on ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--text-on-accent)" } : null),
        ...(disabled ? { opacity: 0.45, cursor: "default", boxShadow: "none" } : null),
        ...style,
      }}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
