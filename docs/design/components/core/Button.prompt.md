One-line: the 44px tap-target button behind every card action ("♡ Save", "+ Add to day", "⬇ Export"); use `pressed` for toggles, never a separate "active" component.

```jsx
<Button variant="primary" icon="+">Add to day</Button>
<Button pressed={isFavourite} icon={isFavourite ? "♥" : "♡"}>{isFavourite ? "Saved" : "Save"}</Button>
```

Variants: `quiet` (default, white card action) · `primary` (accent outline + semibold, the one recommended action per row) · `filled` (accent background, dialog confirm) · `ghost` (borderless, destructive/secondary). `disabled` dims to 45%. Never shrink below `--tap-min` (44px) — this UI is used one-handed with a pram.
