// Source: TRIP-30 CI plan. Supply-chain intent: every workflow action is pinned
// by commit, tokens are read-only by default, and CI runs on the Node version
// the repo declares. Parses the real workflow files; no mocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../.github/workflows/", import.meta.url);
const workflows = readdirSync(dir).filter((f) => f.endsWith(".yml"))
  .map((f) => ({ file: f, text: readFileSync(new URL(f, dir), "utf8") }));

test("workflows exist for CI (with Pages deploy), browser checks, lint and Scorecard", () => {
  const names = workflows.map((w) => w.file).sort();
  for (const f of ["browser-checks.yml", "ci.yml", "scorecard.yml", "workflow-lint.yml"]) {
    assert.ok(names.includes(f), `${f} missing`);
  }
});

test("every third-party action is pinned to a full commit SHA", () => {
  for (const { file, text } of workflows) {
    for (const [, ref] of text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref} is not pinned by commit`);
    }
  }
});

test("every workflow denies token permissions by default", () => {
  for (const { file, text } of workflows) {
    assert.match(text, /^permissions: \{\}$/m, `${file}: top-level permissions must be {}`);
  }
});

test("CI uses the declared Node version and runs the three gates", () => {
  const ci = workflows.find((w) => w.file === "ci.yml").text;
  assert.match(ci, /node-version-file: \.node-version/);
  assert.match(readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim(), /^\d+$/);
  for (const cmd of ["node --test test/*.test.mjs", "node tools/validate-data.mjs", "node tools/verify-app.mjs"]) {
    assert.ok(ci.includes(cmd), `ci.yml must run: ${cmd}`);
  }
});
