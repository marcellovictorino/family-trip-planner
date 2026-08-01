# Demo script — two minutes

For a non-technical audience. Everything below is a real tap on the deployed app; nothing is simulated or narrated in place of doing it.

Open on a phone, at `https://marcellovictorino.github.io/family-trip-planner/`, before starting.

1. **Open the app.** It is already added to the home screen — tap the icon like any other app. Point out there is no loading spinner, no login: the four tabs (Explore · Itinerary · Saved · Trip) are there immediately.

2. **Explore, filters.** On the Explore tab, tap the **🌧 Rainy** chip.
   - Kongens Have Playground (outdoor only) disappears.
   - Tivoli Gardens and Den Blå Planet stay, because one has indoor shelter and the other is fully indoors.
   - Say this out loud: *"outdoor-only places drop, but anywhere with cover stays — because a soaked toddler ends the day, not a bit of rain."*
   - Tap **Rainy** again to clear it.

3. **Add something to a day.** Expand a place card, tap **+ Add to day**, pick a day from the dialog that opens.

4. **Show the itinerary persisting.** Switch to the Itinerary tab — the place is there, under the day just picked. Force-quit Safari (swipe it away from the app switcher) and reopen: it is still there, because it was written to `localStorage` the moment it was added, not on some later save.

5. **Show a note surviving.** Go to Saved (or Trip), add a short note to a place. Reload the page. The note is still there — same mechanism as the itinerary: written immediately, read back on load.

6. **Airplane mode.** Turn on airplane mode on the phone, then reload the app. It opens exactly as before — same data, same itinerary, same note — because the service worker cached everything on first load and the app never phones home for anything it needs mid-trip.

## What this is not

State plainly, before anyone asks:

- **No map.** Places show a neighbourhood name and coordinates, not a pin.
- **No live weather.** The rain filter is something *you* toggle when it starts raining; the app does not know the forecast.
- **No budget tracking.**
- **No packing list.**

These are deliberately out of scope for this slice, not missing by oversight — see the roadmap in `README.md`.
