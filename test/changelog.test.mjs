// Source: captain's ask to keep a changelog with the bumped version. The app
// version shown to the user and the newest CHANGELOG entry must be the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "../src/version.js";

const log = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const versions = [...log.matchAll(/^## (\d+\.\d+\.\d+) — /gm)].map((m) => m[1]);
const cmp = (a, b) => a.split(".").map(Number).reduce((d, n, i) => d || n - b.split(".")[i], 0);

test("APP_VERSION matches the newest changelog entry", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(versions[0], APP_VERSION);
});

test("changelog versions are unique and newest first", () => {
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual([...versions].sort((a, b) => cmp(b, a)), versions);
});

test("the service worker caches the version module so the footer works offline", () => {
  assert.ok(readFileSync(new URL("../sw.js", import.meta.url), "utf8").includes('"src/version.js"'));
});
