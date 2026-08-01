One-line: the modal list of trip days shown after "+ Add to day"; one full-width tap target per day plus Cancel.

```jsx
<DayPicker placeName="Tivoli Gardens" dates={[{ value: "2026-08-03", label: "Mon 3 Aug" }]} onPick={add} onCancel={close} />
```

Dates are derived from the trip range, never hardcoded. Render over a `--backdrop` scrim; Escape and Cancel both close without assigning.
