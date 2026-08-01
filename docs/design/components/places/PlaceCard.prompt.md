One-line: the expandable place card used in Explore and anywhere a place is listed with detail — no photography, a colour band and glyphs instead.

```jsx
<PlaceCard place={place} visited={isVisited} actions={<>
  <Button pressed={fav} icon={fav ? "♥" : "♡"}>{fav ? "Saved" : "Save"}</Button>
  <Button variant="primary" icon="+">Add to day</Button>
</>} />
```

Summary order is fixed: band → name → "neighbourhood · duration · price" → facility glyphs. Detail order: description → Tip → Baby → facts list → links → actions. Visited places keep their place in the list and are struck through, never hidden.
