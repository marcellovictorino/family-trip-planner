# Working on this repo

Zero-dependency static app (no `package.json`, no npm packages, no build step). Node version is in `.node-version`.

## For every change

1. Branch off `main`; changes reach `main` only through a pull request.
2. Title commits and the PR as `type(scope): summary` (`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`).
3. Bump `APP_VERSION` in `src/version.js` (patch for fixes, minor for features, major for breaking saved data).
4. Add an entry under that version at the top of `CHANGELOG.md` (Added, Changed, Fixed or Improved). `test/changelog.test.mjs` fails if the two disagree; CI fails a PR that leaves `CHANGELOG.md` untouched.
5. Run the CI checks locally before pushing:
   ```bash
   node --test test/*.test.mjs
   node tools/validate-data.mjs
   node tools/verify-app.mjs
   ```
   `tools/scale-check.mjs` and `tools/map-check.mjs` need Chrome; run them when you touch views or the map (CI runs them weekly).
6. Pin any new GitHub Action by full commit SHA and keep workflow `permissions` minimal (`test/ci-policy.test.mjs` enforces this).
7. A new file the app loads offline must be listed in `ASSETS` in `sw.js`.
