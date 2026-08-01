One-line: the emoji glyph vocabulary that carries facility information on cards — this product has no icon font and no SVG icons by design.

```jsx
<FacilityRow facilities={["baby", "stroller", "mixed", "glutenFree"]} />
```

Every glyph carries `title` and `aria-label`; never show a glyph without its label. "GF" is set in the mono face, not an emoji. Do not invent new glyphs — extend `FACILITIES` so the meaning stays stable across screens.
