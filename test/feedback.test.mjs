import { test } from "node:test";
import assert from "node:assert/strict";
import { TAGS, tagsForKind, tagLabel } from "../src/feedback.js";

// ── R8: the tags offered must match what the place can actually fail at ──
// A playground and a restaurant fail in different ways. One shared list would
// be vague enough to be useless for both, and the whole point of a tag is that
// it maps to a dataset field the research agent can be held to.
test("each kind offers its own vocabulary, and they do not overlap by accident", () => {
  assert.deepEqual(Object.keys(TAGS).sort(), ["attraction", "playground", "restaurant"]);
  const gf = tagsForKind("restaurant").map((t) => t.value);
  assert.ok(gf.includes("gf-claim-wrong"));
  assert.ok(!tagsForKind("playground").map((t) => t.value).includes("gf-claim-wrong"));
});

test("every kind offers the same number of tags, so no sheet feels emptier than another", () => {
  const counts = Object.values(TAGS).map((list) => list.length);
  assert.deepEqual(counts, [8, 8, 8]);
});

// An unknown kind reaches here when a stored place id outlives the dataset.
// Offering nothing is correct; throwing would take the sheet down with it.
test("an unknown kind yields no tags rather than throwing", () => {
  assert.deepEqual(tagsForKind("spaceship"), []);
  assert.deepEqual(tagsForKind(undefined), []);
});

// Tags are stored as slugs and rendered as labels. A stored slug whose label
// was later renamed must still be readable, not blank.
test("a stored slug always resolves to something readable", () => {
  assert.equal(tagLabel("gf-claim-wrong"), "GF claim was wrong");
  assert.equal(tagLabel("retired-tag"), "retired-tag");
});
