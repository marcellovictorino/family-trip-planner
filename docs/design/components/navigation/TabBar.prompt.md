One-line: navigation for the whole app — five tabs on top, no bottom bar, no drawer, no settings.

```jsx
<AppHeader title="Copenhagen 2026" active={tab} onSelect={setTab}
  tabs={[{value:"explore",label:"Explore"},{value:"map",label:"Map"},{value:"itinerary",label:"Itinerary"},{value:"saved",label:"Saved"},{value:"trip",label:"Trip"}]} />
```

The active tab is accent-coloured with a 3px underline. Tabs scroll horizontally rather than wrapping. Map is a separate spatial view, not another filter over the same cards. Keep all five tabs on one scrollable row; do not add tabs for filter variants.
