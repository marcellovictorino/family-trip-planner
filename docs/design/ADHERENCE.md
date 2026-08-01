# Design system adherence

This is the token-by-token account of `design/tokens/*.css`: where each value lands in the app, and where it deliberately does not. It exists so a reviewer can check the app against the design system without re-deriving it from both source trees by eye.

A note on method: `styles.css` predates the design system (see `README.md`) and is not yet rewired to `@import` the token files directly — it is hand-authored CSS with its own `:root` block. Where a token's value is reproduced correctly in `styles.css` under a different variable name, that is marked **matched**. Where a token has no counterpart at all in the app yet, that is marked **not adopted**, not "deviation" — a deviation is a considered choice with a reason; an unadopted token is simply downstream of a design system applied after the fact, per the roadmap's own S6+ scope. Only the fonts fall into the true deviation category below.

## `colors.css`

| Token | Value | Used in the app | Status |
| --- | --- | --- | --- |
| `--ink-900` | `#17242b` | `styles.css` `--ink`, body text colour | Matched |
| `--ink-500` | `#5d6b73` | `styles.css` `--muted`, all secondary/meta text | Matched |
| `--ink-700`, `--ink-300` | `#3a4a53`, `#8d979d` | — | Not adopted |
| `--harbour-700` | `#1b4965` | `styles.css` `--accent`; `<meta name="theme-color">` in `index.html`; `theme_color` in `manifest.webmanifest` | Matched |
| `--harbour-900`, `--harbour-500`, `--harbour-100` | `#123549`, `#3d7191`, `#e6f0f6` | — (no hover/pressed states styled yet) | Not adopted |
| `--harbour-200` | `#cfe3ef` | Same hex as `--kind-attraction` below, but the app has no focus-ring styling to use it as one | Not adopted (as a ring) |
| `--kind-attraction` | `#cfe3ef` | `styles.css` `--attraction`, `.kind-attraction .band` | Matched |
| `--kind-playground` | `#d6ecd8` | `styles.css` `--playground`, `.kind-playground .band` | Matched |
| `--kind-restaurant` | `#f4e2cf` | `styles.css` `--restaurant`, `.kind-restaurant .band` | Matched |
| `--kind-*-ink` (3) | `#1b4965`, `#31593a`, `#8a5326` | — | Not adopted. Band text currently takes the flat `--muted` grey regardless of kind; the darkened per-kind ink for band text is a token-only value today |
| `--sand-200` | `#f7f3ec` | `manifest.webmanifest` `background_color` | Matched (splash/background only) |
| `--sand-50`, `--sand-100`, `--sand-300`, `--sand-400`, `--sand-500` | warm neutrals | — | Not adopted. `styles.css` still uses the pre-design-system cool greys (`--bg:#f6f8f9`, `--line:#dfe5e8`, cards on plain `#fff`) that `docs/design/design-system.md` records as "substitutions to confirm" |
| `--sun-*`, `--rain-*`, `--leaf-*`, `--clay-*` | weather/status accents | — | Not adopted. Weather chips (`🌧`/`🌤`/`☀️`) use the generic `.chip` treatment, not a per-weather accent colour |
| Semantic aliases (`--bg-page`, `--surface-card`, `--text-link`, `--status-*`, `--focus-ring`, etc.) | — | — | Not adopted, downstream of the neutrals/accents above not yet flowing through |

## `typography.css`

| Token | Value | Used in the app | Status |
| --- | --- | --- | --- |
| `--font-display` | `"Bricolage Grotesque", …` | — | Not yet wired. `styles.css` still sets `body { font: 16px/1.5 -apple-system, system-ui, sans-serif; }` as a literal; nothing in the app references `var(--font-display)` or `var(--font-body)` yet |
| `--font-body` | `"Nunito Sans", …` | — | Not yet wired (see above) |
| `--font-mono` | `"JetBrains Mono", …` | — | Not adopted; the app has no monospace usage yet (no coordinates or `GF` badge rendered) |
| `--text-display` … `--text-micro`, `--leading-*`, `--weight-*`, `--tracking-*` | sizing/weight scale | — | Not adopted. `styles.css` sets font sizes as literal `rem`/`px` values inline (e.g. `.name { font-weight: 600; }`, `.count { font-size: 0.85rem; }`) rather than through these tokens |

## `spacing.css`

| Token | Value | Used in the app | Status |
| --- | --- | --- | --- |
| `--tap-min` | `44px` | Every interactive element's `min-height: 44px` (tabs, chips, actions, links, remove button) | Matched by value (literal, not `var()`) |
| `--content-max` | `46rem` | `main { max-width: 46rem; }` | Matched by value |
| `--pad-screen` | `1rem` | `main { padding: 1rem; }` | Matched by value |
| `--gap-cards` | `0.75rem` | `.cards { gap: 0.75rem; }` | Matched by value |
| `--gap-chips` | `0.4rem` | `.chips { gap: 0.4rem; }` | Matched by value |
| `--space-xs`, `--space-sm`, `--space-md`, `--space-lg` | `0.4/0.5/0.6/0.75rem` | Scattered through card, row and control padding (e.g. `.detail p { margin: 0.6rem 0; }`, `.day-item { padding: 0.4rem 0.5rem; }`) | Matched by value, case by case |
| `--space-2xs`, `--space-2xl`, `--space-3xl`, `--gap-sections`, `--pad-card`, `--pad-row` | — | Present in some literals (e.g. `.card summary { padding: 0.75rem; }` matches `--pad-card`) but not exhaustively checked line by line | Matched by value where used |

## `shape.css`

| Token | Value | Used in the app | Status |
| --- | --- | --- | --- |
| `--radius-xs` | `6px` | `.band { border-radius: 6px; }` | Matched by value |
| `--radius-sm` | `10px` | `.search`, `.action`, `.day-item`, `.saved-item`, `.note-input` border-radius | Matched by value |
| `--radius-md` | `12px` | `.card { border-radius: 12px; }` | Matched by value |
| `--radius-lg` | `14px` | `.day-picker { border-radius: 14px; }` | Matched by value |
| `--radius-pill` | `22px` | `.chip { border-radius: 22px; }` | Matched by value |
| `--border-hairline` | `1px solid var(--line)` | Cards and rows use `1px solid var(--line)` with the app's own (unmatched) `--line` | Matched pattern, mismatched colour — see `--sand-400` above |
| `--shadow-card`, `--shadow-raised`, `--shadow-dialog`, `--shadow-inset-press` | elevation | — | Not adopted. `styles.css` has no `box-shadow` anywhere; cards, the countdown and the day-picker dialog currently sit flat against the page |
| `--backdrop` | `rgb(23 36 43 / 0.4)` | `.day-picker::backdrop { background: rgb(0 0 0 / 0.4); }` | **Deviation, unintentional**: a plain black scrim instead of the ink-tinted one. Worth a one-line fix, not urgent for the demo |

## `motion.css`

| Token | Value | Used in the app | Status |
| --- | --- | --- | --- |
| `--ease-calm`, `--dur-instant`, `--dur-quick`, `--dur-settle`, `--press-scale`, `--transition-tap` | timing scale | — | Not adopted. Nothing in `styles.css` currently transitions; taps, the `<details>` expand and the day-picker dialog all snap instantly. `prefers-reduced-motion` is therefore moot today because there is no motion to reduce |

## `fonts.css`

| Item | Status |
| --- | --- |
| `assets/fonts/bricolage-grotesque-{1,2,3}.woff2`, `assets/fonts/nunito-sans-{1..5}.woff2` | Vendored in the repo and listed in `sw.js`'s `ASSETS` cache list, so they download once and then work offline |
| `@font-face` declarations in `design/tokens/fonts.css` | Present, correct, but **not yet loaded** — no `<link>` to this file in `index.html` and no `@import` from `styles.css`. The files are in place; the wiring that makes the display and body faces actually render is the same in-flight `styles.css` work as the colour/spacing tokens above |

## Deviations from the design system (intentional)

**Self-hosted fonts instead of the kit's Google Fonts `@import`.** `docs/design/design-system.md` records the substitution plainly: *"Bricolage Grotesque / Nunito Sans / JetBrains Mono are chosen substitutions loaded from Google Fonts."* That import is a runtime network fetch. This app's entire premise is working in airplane mode on a Copenhagen street corner — a font request that fails offline would fall back to the system font mid-trip, which is a worse and less predictable outcome than never having a display face at all. `design/tokens/fonts.css` in this repo overrides the same three `@font-face` families to load from `assets/fonts/*.woff2`, vendored and served from the service worker's cache instead of Google's CDN. No other component of the design system carries a similar functional reason to diverge; everything else above is either matched or simply not yet applied.
