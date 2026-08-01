One-line: pill filter toggles for weather / ages / kind / duration / price / gluten-free; always inside a `ChipRow`, always labelled glyph-first.

```jsx
<ChipRow>
  <Chip pressed={weather === "rainy"} onClick={...}>🌧 Rainy</Chip>
  <Chip pressed={ages.includes("baby")}>👶 Baby</Chip>
  <Chip dashed>Clear 3</Chip>
</ChipRow>
```

Single-value groups (weather, kind, duration) clear on re-tap; multi-value groups (ages, price) toggle membership. The reset chip is `dashed` and reads "Clear N".
