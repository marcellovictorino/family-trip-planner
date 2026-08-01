# Family Trip Planner — Design System

A design system for **Family Trip Planner**: a trip planner built for use *during* a trip, on a phone, with no signal. First trip: Copenhagen, 2–8 August 2026 — two adults, a 6-year-old and a 1-year-old.

The product answers mid-trip questions: what is open, what is indoors now that it is raining, where a 1-year-old can be put down safely, which lunch place has reliable gluten-free options, and what was already agreed for tomorrow.

## Sources

Everything here is grounded in one repository (you may not have access; recorded so you can check if you do):

- **GitHub** — https://github.com/marcellovictorino/family-trip-planner
  - `README.md` — product framing, constraints, roadmap
  - `docs/superpowers/specs/2026-07-31-family-trip-planner-design.md` — data model, interface, interaction decisions
  - `docs/superpowers/plans/2026-07-31-family-trip-planner.md` — task-by-task implementation plan containing the **actual `styles.css`, markup and view code** this system is derived from

The repository at the time of writing contains documentation only — no built app, no font files, no logo, no image or icon assets. The design spec explicitly defers the visual layer: *"A dedicated design system will be produced separately and applied in a later slice."* This project is that layer. Read the two documents above for anything not covered here — they carry the reasoning behind every constraint.

There is **one product**: a zero-dependency, offline-first PWA added to an iPhone home screen. There is no marketing site, no desktop app, no admin surface.

## Index

| File | What it is |
| --- | --- |
| `styles.css` | Entry point — `@import`s every token file. Consumers link this one file. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `shape.css`, `motion.css` |
| `guidelines/` | Foundation specimen cards (colours, type, spacing, shape, brand, app icon, motion) |
| `assets/app-icon/` | App icon tiles (180/192/512 + maskable) and `manifest.webmanifest` |
| `components/core/` | `Button`, `Chip` (+`ChipRow`), `SearchField`, `KindBand`, `FacilityIcon` (+`FacilityRow`), `EmptyState`, `SectionHeading` |
| `components/places/` | `PlaceCard`, `FactList` |
| `components/itinerary/` | `DayItem`, `DayPicker` |
| `components/trip/` | `Countdown`, `Stat` (+`StatGrid`), `SavedItem`, `NoteEditor` |
| `components/navigation/` | `TabBar`, `AppHeader` |
| `ui_kits/trip-planner-app/` | Interactive recreation of the four-tab phone app |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Upstream source association and sync record |
| `docs/superpowers/plans/…` | Copy of the upstream implementation plan, kept as the source of truth for exact CSS values |

Each component directory has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` and one `@dsCard` HTML.

## Content fundamentals

The product's voice comes straight from the repository's own prose, which is unusually consistent: **plain, British, reason-first, and allergic to enthusiasm.**

- **British spelling and vocabulary.** "favourites", "neighbourhood", "pram", "gluten-free", "metro". Never "favorites" or "stroller" in copy (the data field is `stroller`; the label is "Pram accessible").
- **Sentence case everywhere.** "Add to day", "Best time", "Nothing planned." Never Title Case buttons, never ALL CAPS except the tiny lettered category band.
- **No first person, minimal second person.** Labels are nouns and verbs — "Export", "Backup", "Visited". The app does not say "your trip" when "the trip" will do, and never says "we".
- **Every statement carries its reason.** Product copy explains *why*, briefly: "Export before regenerating the guide, so your notes and plan can be restored." "Soft ground in the toddler pen; no changing table, bring a mat."
- **Concrete over evocative.** Descriptions state facts a parent can act on — "Separate toddler area with low equipment and soft ground" — not "a magical spot the whole family will love". No superlatives, no "hidden gem", no "must-see".
- **Empty states are one calm sentence and say what to do next.** "Nothing planned. Add something from Explore." "Favourite something to start noting." "Nothing matches those filters."
- **Numbers are terse and human.** "45 min", "2h", "4h30", "3 stops · 4h30", "12/85 visited", "€€". Dates read "Mon 3 Aug" in pickers and "Monday, 3 August" as day headings.
- **Emoji are functional, not decorative.** They are the icon set (see Iconography). They never appear in sentences, never in headings other than as a leading glyph, and never as tone ("Oops! 😅" is wrong for this product).
- **Failure is loud and specific, not apologetic.** "That file could not be read: <reason>". "Tivoli (no longer in the guide)". No "Something went wrong".
- **Punctuation.** No exclamation marks. Middle dot `·` separates facts. En dash for ranges ("1–2h", "2–8 August").

Vibe in one line: *a well-organised parent's notebook — calm, warm, factual, quietly fun.*

## Visual foundations

**Overall direction.** Calm and fun, light theme, warm. The base is a soft beige (`--sand-200 #f7f3ec`) rather than white; cards sit a shade lighter on it (`--sand-50 #fffdf9`). One saturated colour — harbour blue `#1b4965`, carried verbatim from the app's `--accent` — does all the work of selection, links and emphasis. The playfulness comes from the pastel category bands and the emoji glyph set, not from gradients or illustration.

**Colour.** Neutrals are warm sand and cool-ish ink (`#17242b` body, `#5d6b73` muted). Category bands are the app's originals — attraction `#cfe3ef`, playground `#d6ecd8`, restaurant `#f4e2cf` — with darkened inks for legibility. Accents (`sun #f2b544`, `rain #7fa8c4`, `leaf #4a7c59`, `clay #c4643c`) are for weather and status only and appear in small quantities. There is exactly one accent per screen state; never two competing colours in a row of controls.

**Type.** Display face **Bricolage Grotesque** (700/800, tracking −0.02em) for the trip title, place names and section headings — a grotesque with enough character to feel friendly without being cute. Body **Nunito Sans** (300–800) for everything else: humanist, soft-cornered and legible at 13–16px on a phone in daylight. **JetBrains Mono** for coordinates, dates and the "GF" badge. Body copy is 16px/1.5; fact lines 14px; meta 12–13.6px. Nothing on a phone screen goes below 12px.

**Layout.** Mobile first, 390px design width, content capped at `46rem` and centred so it survives a tablet. `1rem` screen padding. A single column always — the product never introduces a second column, a sidebar or a drawer. Navigation is a **sticky top header**: trip title, then four tabs (Explore · Itinerary · Saved · Trip) with a 3px accent underline on the active tab. Nothing else is fixed to the viewport; there is no bottom bar and no floating action button.

**Touch.** Every interactive element is at least **44px** tall (`--tap-min`). The reorder chevrons are the one exception by design: 44px wide, 22px tall, stacked so the pair totals 44px.

**Cards.** 1px hairline border in `--line #e4ddd1`, 12px radius, `--surface-card` background, and a barely-there shadow (`0 1px 2px rgb(23 36 43/0.04)`) — the border does the separating, the shadow only keeps the card from dissolving into the beige. Rows and controls use 10px radius, chips 22px (pill), the dialog 14px, the category band 6px. Corner radii are the app's original values and are never rounded to a grid.

**Elevation.** Three levels only: `--shadow-card` (list cards, rows), `--shadow-raised` (the countdown, the one hero element), `--shadow-dialog` (the day picker, over a `rgb(23 36 43/0.4)` scrim). No inner shadows except the optional press inset. No coloured shadows.

**Imagery.** **There is none, deliberately.** The upstream spec excludes `heroImage`: verified, hotlink-stable, offline-cacheable image URLs were the largest time sink and the main source of broken UI. A category glyph plus a colour band replaces photography. Do not add stock photography, illustration, background patterns, textures or gradients to this product — an offline app cannot afford them and the visual language does not assume them.

**Motion.** Short and calm: 90ms for tap state, 150ms for a card expanding, 240ms for a dialog. Easing `cubic-bezier(0.2,0.7,0.3,1)` — no bounce, no spring, no parallax. `prefers-reduced-motion` zeroes all of it.

**States.**
- *Hover* (a courtesy; this is a touch product): surface lifts to `--surface-hover`, border to `--line-strong`. No colour inversion on hover.
- *Press*: the same colour change plus an optional 0.97 scale; no ripple.
- *Selected / toggled*: filled accent background with `--text-on-accent` text and `aria-pressed="true"` — this single treatment covers chips, favourite, visited and tab selection.
- *Disabled*: 45% opacity, no shadow, cursor default — never removed from the DOM (a disabled reorder chevron tells the user the row is already first).
- *Focus*: 3px `--harbour-200` ring; visible, never suppressed.
- *Visited*: the place name is struck through in `--text-muted`. Visited places stay in the list.

**Transparency and blur.** Only two uses: the modal scrim, and nothing else. No frosted headers, no translucent cards — they cost battery and read badly in bright sun.

**Protection.** Text never sits on imagery (there is no imagery), so there are no protection gradients or capsules; the category band is the only "capsule" in the system.

## Iconography

**The icon set is emoji, by design.** The upstream product ships no icon font, no SVG sprite and no PNGs — a deliberate consequence of "no images". Every glyph is paired with a `title` and `aria-label`; the glyph alone is never the only signal.

Fixed vocabulary (extend `FACILITIES` in `components/core/FacilityIcon.jsx` rather than inventing glyphs inline):

| Glyph | Meaning | Where |
| --- | --- | --- |
| 🎡 / 🛝 / 🍽 | attraction / playground / restaurant | category band, kind filter chips |
| 👶 | room for a baby to move around | card summary, age chip |
| 🛒 | pram accessible | card summary |
| 🌧 / 🌤 / ☀️ | indoors / mixed / sunny | card summary, weather chips |
| 🎫 | booking required | card summary |
| 🧒 / 👧 | toddler / 6-year-old | age chips |
| ♥ ♡ | favourite / not favourited | card actions, Saved rows |
| ✓ | visited | card actions, Saved rows |
| ⌃ ⌄ × | reorder earlier / later / remove | itinerary rows |
| 📝 🗓 🔍 | notes / itinerary / search headings and empty states | section headings |
| ⬇ ⬆ | export / import | Trip tab |
| 🎉 🏠 | during the trip / after it | countdown |

`GF` is set as text in the mono face, not an emoji. Unicode marks (`⌃ ⌄ × ♥ ♡ ✓ ·`) are used where an emoji would be too loud. No icon library is linked; if a future surface genuinely needs line icons, Lucide at 1.5px stroke is the closest match to this system's weight — but flag it, because it would be new to the product.

**Logo:** the source contains **no logo or brand mark**. Wherever a mark would go, the name is set in the display face (see `guidelines/brand-wordmark.card.html`). Nothing here was drawn or reconstructed.

**App icon:** `assets/app-icon/` — "a day, stacked": three rounded bars in the attraction / playground / restaurant colours on harbour blue, i.e. a planned day with three stops. Opaque and full-bleed (iOS masks the corners itself); the maskable tile keeps all content inside the 80% safe area. Ships at 180 / 192 / 512 plus `app-icon-maskable-512.png`, with a ready `manifest.webmanifest` (theme `#1b4965`, background `#f7f3ec`). This is an icon, not a logo — do not use it as a wordmark substitute in layouts.

## Components

Grounded in the views the implementation plan actually defines — nothing invented beyond them.

- **Core** — `Button`, `Chip`, `ChipRow`, `SearchField`, `KindBand`, `FacilityIcon`, `FacilityRow`, `EmptyState`, `SectionHeading`
- **Places** — `PlaceCard`, `FactList`
- **Itinerary** — `DayItem`, `DayPicker`
- **Trip & Saved** — `Countdown`, `Stat`, `StatGrid`, `SavedItem`, `NoteEditor`
- **Navigation** — `TabBar`, `AppHeader`

### Intentional additions

- `FacilityIcon` / `FacilityRow` — the upstream code builds facility glyphs inline in `explore.js`; wrapping them keeps the glyph→label mapping in one place.
- `ChipRow`, `StatGrid`, `AppHeader` — thin layout wrappers around groupings the source's CSS already defines (`.chips`, `.stats`, `header`).
- `EmptyState`, `SectionHeading` — the source's `.empty` and `.day h2` patterns, named.

## UI kits

- `ui_kits/trip-planner-app/` — the four-tab phone app: Explore (search, filter chips, expandable cards, per-card actions), the day-picker dialog, Itinerary (day sections, reorder, remove), Saved (favourites, visited, notes) and Trip (countdown, stats, backup). Data is a subset of real Copenhagen places in the upstream schema.

## Substitutions to confirm

- **Fonts.** The source used the system stack (`-apple-system, system-ui, sans-serif`) and shipped no font files. Bricolage Grotesque / Nunito Sans / JetBrains Mono are chosen substitutions loaded from Google Fonts. Send real font files if the brand has them.
- **Warm palette.** `--bg`, `--line` and the surfaces were cool greys upstream (`#f6f8f9`, `#dfe5e8`, `#fff`); they were warmed to beige per the brief. The accent and the three category band colours are unchanged.
