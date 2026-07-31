# Resume notes — paused 2026-08-01 ~00:20, quota exhausted

## State: slices 1–5 complete and deployed. Only real data is missing.

Live: https://marcellovictorino.github.io/family-trip-planner/
Tests: 57/57 passing — `node --test test/*.test.mjs`

All four tabs are built, wired and pushed. Verified in a real browser at 390px:
Explore renders, the Rainy filter correctly drops outdoor-only places and keeps
`mixed`, and the "Clear 1" affordance appears. Only a favicon 404 in console.

## The one thing left for MVP

`data/copenhagen-2026.json` still holds the **3 hand-written fixture places**.
The generator is built, fixed and committed but has never completed a run.

```bash
node tools/generate-trip.mjs --city Copenhagen --country Denmark \
  --from 2026-08-02 --to 2026-08-08 --out data/copenhagen-2026.json
node tools/validate-data.mjs data/copenhagen-2026.json
node --test test/*.test.mjs
```

Then bump `CACHE` in `sw.js` to the next version, commit `data/` and `sw.js`, push.

### Two known facts about the generator

1. First run died on the bbox call: the model returned valid JSON then appended
   `"Wait, fix typo."`. Fixed in `tools/parse.mjs` with a balanced-delimiter
   scanner, covered by 10 tests in `test/parse.test.mjs`.
2. Second run was killed at the quota pause, not because of a defect. It had
   been running several minutes without completing — each batch is a `claude -p`
   web-search call, so budget roughly 10–20 min for four batches.
   **Run it in the foreground and watch it**, or tee to a file; piping to `tail`
   buffers all output until exit, which hid progress last time.

## Remaining after that

- **T13** widen to ~85 places: swap `BATCHES` in `tools/generate-trip.mjs` for the
  9-batch list in Task 13 Step 1 of the plan, re-run, re-validate. Data only.
- Fixture has no `restaurant`, so the restaurant colour band is still unexercised.
  Real data will cover it — confirm visually once generated.
- Verify offline: load on the iPhone, Add to Home Screen, airplane mode, reopen.
  This is the S1 acceptance test and has **not** been done on a real device yet.

## Worker topology (all sessions exited cleanly at pause)

Herdr workspace `w6`, cwd is the repo. Tabs `w6:t2/t3/t4`, panes `w6:p2/p3/p4`.
Relaunch each with `ccc` (= `claude --dangerously-skip-permissions`).

Rules that kept them from colliding, worth reusing:
- strict per-agent file ownership, never `git add -A`
- `node --test test/<file>.test.mjs`, never a bare `test/` directory (Node 26 errors)
- `git pull --rebase origin main` before every push; retry on `index.lock`
- `herdr pane run` pastes long prompts **without submitting** — send `Enter` after
- exit a pane agent with `/exit`, not `Ctrl-C` (signals just cycle permission mode)

## Task board

`td list` — epic `td-ed4661`. T1–T12 done; T6 (real data) and T13 (widen) remain.
