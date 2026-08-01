One-line: an itinerary row — tap-to-reorder with ⌃/⌄, never drag-and-drop (HTML5 drag does not fire on iOS Safari).

```jsx
<ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.4rem" }}>
  <DayItem name="Tivoli Gardens" meta="Indre By · 4h" first onMoveDown={...} onRemove={...} />
</ol>
```

Always inside an `<ol>`. Disable — never hide — the first row's up control and the last row's down control.
