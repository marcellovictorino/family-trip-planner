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

## What it deliberately does not check

- **That the service worker actually caches correctly at runtime.** This
  script confirms every listed asset is fetchable over HTTP; it does not
  register a service worker, so it cannot prove the `install`/`activate`
  handlers behave, that `caches.match` falls back correctly, or that a real
  browser goes offline cleanly after a first visit. That needs a real device
  or browser with airplane mode toggled.
- **That the app looks right.** No visual, layout or tap-target check is
  performed. Confirming 44px tap targets, no horizontal scroll at 375px, or
  that the design system renders as intended still needs manual review in a
  browser or on a phone.
- **Accessibility beyond what static analysis can catch here.** This script
  checks structural integrity (files, paths, JSON), not ARIA correctness,
  focus order, colour contrast, or screen-reader behaviour.

Treat a `PASS` here as "nothing is silently broken offline", not as a
substitute for the manual device check.
