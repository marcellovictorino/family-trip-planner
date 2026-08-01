One-line: navigation for the whole app — four tabs on top, no bottom bar, no drawer, no settings.

```jsx
<AppHeader title="Copenhagen 2026" active={tab} onSelect={setTab}
  tabs={[{value:"explore",label:"Explore"},{value:"itinerary",label:"Itinerary"},{value:"saved",label:"Saved"},{value:"trip",label:"Trip"}]} />
```

The active tab is accent-coloured with a 3px underline. Tabs scroll horizontally rather than wrapping. Do not add a fifth tab — each excluded section was the same cards under a different filter.
