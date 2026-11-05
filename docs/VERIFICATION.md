# Offline verification

`tools/verify-app.mjs` is a zero-dependency Node script that checks the app is
genuinely offline-complete before it ships. Run it with:

```bash
node tools/verify-app.mjs
```

It exits `0` and prints `RESULT: PASS` when every check passes, or exits
non-zero with `RESULT: FAIL` and a list of the specific failures.

## What it checks

1. **Service worker completeness** — parses the `ASSETS` array out of `sw.js`
   (rather than duplicating the list), boots a static server on a free local
   port using only `node:http` and `node:fs`, and confirms every path returns
   HTTP 200.
2. **Stylesheet asset paths** — finds every `url()` and `@import` target in
   `styles.css` and `design/tokens/*.css`, resolves each one relative to the
   stylesheet that names it (not the page that imports it — that distinction
   is exactly what let a self-hosted font path 404 when a token file was
   imported from the repo root), and confirms the target file exists.
3. **Manifest integrity** — parses `manifest.webmanifest` as JSON and confirms
   every icon's `src` exists on disk.
4. **Module graph** — follows relative `import`/`export … from` specifiers
   transitively, starting at `src/app.js`, and confirms every file referenced
   actually exists. Catches a file left dangling after a rename or delete.
5. **Dataset validity** — parses `data/copenhagen-2026.json` and runs it
   through `validateDataset` from `src/schema.mjs`, the same check the
   generator's own pipeline uses.

## Cache-version bumps always fetch fresh bytes, not just fresh names

Bumping `CACHE` in `sw.js` makes `install` write into a new, empty cache — but
that alone does not guarantee the *bytes* it writes are current. The install
handler re-fetches every asset in `ASSETS`, and an ordinary fetch is still
subject to the browser's own HTTP cache: a file whose response was served
with a cacheable `Cache-Control` header can come back from that HTTP cache
with its *old* content even though the request reached the fetch layer and
even though the on-disk file has since changed. That is exactly the same
class of bug the dataset fetch in `src/app.js` was fixed for (`fetch(DATA_URL,
{ cache: "no-cache" })`) — a deploy can look like it worked and still ship
stale JavaScript to a phone that already had a service worker installed.

`sw.js`'s `install` handler now fetches every asset via
`new Request(asset, { cache: "reload" })`, the one fetch mode that always
revalidates against the network regardless of what the HTTP cache already
holds. A version bump is therefore guaranteed to pull current bytes for
every asset, not just a differently-named cache pointing at old ones.

This was proved with a throwaway Node script (not committed) that: served a
file from a real local HTTP server, cached it once through the same
`{ cache: "reload" }` logic `sw.js` uses, changed the file on disk, then
showed that (a) a plain re-fetch to the same URL through a simulated
browser HTTP cache returned the stale bytes, while (b) a second install run
with a bumped cache name and `{ cache: "reload" }` returned the current
ones. Both assertions held.

## What it deliberately does not check

- **That the service worker actually caches correctly at runtime.** This
  script confirms every listed asset is fetchable over HTTP; it does not
  register a service worker, so it cannot prove the `install`/`activate`
  handlers behave, that `caches.match` falls back correctly, or that a real
  browser goes offline cleanly after a first visit. That needs a real device
  or browser with airplane mode toggled.
- **That a real browser's HTTP cache is actually bypassed by `{ cache:
  "reload" }` the way this document claims.** The reload-vs-stale proof above
  runs against a hand-written stand-in for the browser's HTTP cache, in
  Node — it demonstrates the *logic* is correct, not that Safari or Chrome's
  actual cache implementation honours `reload` identically in every case
  (intermediate proxies, some CDN configurations, and Safari's disk cache
  under low storage have all been known to have their own quirks here). Only
  a real device — install the app, deploy a change, bump the cache version,
  reopen without clearing site data — can confirm the phone actually
  receives new bytes end to end.
- **That the app looks right.** No visual, layout or tap-target check is
  performed. Confirming 44px tap targets, no horizontal scroll at 375px, or
  that the design system renders as intended still needs manual review in a
  browser or on a phone.
- **Accessibility beyond what static analysis can catch here.** This script
  checks structural integrity (files, paths, JSON), not ARIA correctness,
  focus order, colour contrast, or screen-reader behaviour.

Treat a `PASS` here as "nothing is silently broken offline", not as a
substitute for the manual device check.

## Scale check — 200+ places

`tools/scale-check.mjs` checks the app at the size the spec targets. It needs a Chrome or
Chromium on the machine (set `CHROME` to point at one) and nothing else:

```bash
node tools/scale-check.mjs            # 204 places: the guide twice over
node tools/scale-check.mjs --factor 3 # 306 places
```

It copies the real places under new ids and names, so kinds, settings, prices and text
lengths keep the guide's real mix, and serves the app with that dataset in place of the
guide. Headless Chrome then loads it at 390 × 844 with the CPU slowed four times, the
setting Lighthouse uses to stand in for a phone, and checks:

1. **Every place renders once**, and the count reads `204 of 204`.
2. **Every filter chip and a search show exactly the right places**, compared id for id
   with `filterPlaces` from `src/filter.js` over the same dataset.
3. **Saving a place deep in the list leaves it where it was**, open and saved. Every tap
   rebuilds the list, so a card that loses its height on the rebuild makes the page jump.
4. **Nothing scrolls sideways at 390 px**, in Explore or in Saved with every place saved.
5. **No tap takes over 400 ms** to paint: filter chips, save, Nearest first, and the
   switch between Saved and Explore.
6. **No console errors.**

It prints `RESULT: PASS` or `RESULT: FAIL`, and the timings it measured.

### What it found, 2026-11-05

At 204 and 306 places, correctness and layout already held. Speed held in WebKit and in
stable Chrome 157, and not in Chrome 156. Measured with Chrome for Testing 156:

| Tap, 204 places | Before | After |
|---|---|---|
| Filter chip, median of 17 | 229 ms | 39 ms |
| Filter chip, slowest | 668 ms | 79 ms |
| Save a place | 663 ms | 78 ms |
| Nearest first | 689 ms | 100 ms |
| Saved back to Explore | 686 ms | 85 ms |

At 306 places the slowest tap went from 1 062 ms to 164 ms.

Timing one tap's forced layout with parts of the card hidden found the cause. Without the
card emoji, layout took 7 ms instead of 120 ms. The browser was searching the system's
fonts for an emoji glyph, once per card, on every re-render. The card emoji now list the
emoji fonts after the body font, so the glyph is found without that search. Screenshots
before and after are identical pixel for pixel in Chrome and in WebKit.

Two other routes were tried and rejected:

- `content-visibility: auto` on cards skips layout for off-screen cards and was as fast.
  An off-screen card then stands in at an estimated height. Chrome hides the correction
  when it scrolls into view; WebKit does not, so scrolling back up the list jumped by
  14–28 px a step in WebKit.
- Naming the emoji font alone, without the body font first, was as fast but drew the
  emoji about a tenth smaller in WebKit.

### What it deliberately does not check

- **Safari.** It drives Chrome only, and WebKit cannot slow its CPU the same way. WebKit
  was measured separately, at full laptop speed: a filter tap took about 30 ms at 204
  places and 45 ms at 306, before and after the fix alike.
- **Every Chrome build.** Stable Chrome 157 laid out the unfixed list in about a tenth of
  the time 156 took, so on 157 the speed check passes before the fix too. The other
  checks fail on the faults they cover in either build.
- **A real phone.** A slowed laptop CPU is a stand-in.

## Live deployment check — 2026-08-01

`tools/verify-app.mjs` only proves the paths are correct on a local server at
the repo root. GitHub Pages serves this app from a subdirectory
(`https://marcellovictorino.github.io/family-trip-planner/`), so a path that
resolves fine locally can still 404 once served from a subpath. Checked by
fetching the site root plus every path in `sw.js`'s `ASSETS` array against
that live origin (not localhost):

| Result | Count |
|---|---|
| 200 | 31 / 31 (site root + all 30 `ASSETS` entries) |
| Non-200 | none |

All paths — `index.html`, `styles.css`, `manifest.webmanifest`, every `src/`
module, every `design/tokens/*.css` file, all four icon PNGs and all eight
font woff2 files, and `data/copenhagen-2026.json` — returned HTTP 200 from
the live GitHub Pages origin. No subpath-resolution problems found.
