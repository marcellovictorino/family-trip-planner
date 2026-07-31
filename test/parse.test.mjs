import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, extractText } from "../tools/parse.mjs";

test("extractText unwraps the claude -p json envelope", () => {
  assert.equal(extractText(JSON.stringify({ result: "hello", type: "result" })), "hello");
});

test("extractText passes plain text through, so a raw-printing backend still works", () => {
  assert.equal(extractText("just text"), "just text");
});

test("a stray remark after valid JSON is ignored rather than crashing the run", () => {
  // Observed for real: the model emitted the object, then second-guessed itself.
  const reply = '{"west":12.4,"east":12.7,"south":55.6,"north":55.75}\n\nWait, fix typo.';
  assert.deepEqual(extractJson(reply), { west: 12.4, east: 12.7, south: 55.6, north: 55.75 });
});

test("prose before the JSON is ignored", () => {
  assert.deepEqual(extractJson('Here is the bounding box you asked for:\n{"west":1,"east":2}'), { west: 1, east: 2 });
});

test("a fenced code block is unwrapped", () => {
  assert.deepEqual(extractJson('```json\n[{"id":"a"}]\n```'), [{ id: "a" }]);
});

test("a brace inside a string does not confuse the depth counter", () => {
  const reply = '{"tips":"go via the {north} gate","n":1} trailing junk';
  assert.deepEqual(extractJson(reply), { tips: "go via the {north} gate", n: 1 });
});

test("an escaped quote inside a string does not end the string early", () => {
  const reply = '{"name":"Cafe \\"Ole\\"","n":2} and then some words';
  assert.deepEqual(extractJson(reply), { name: 'Cafe "Ole"', n: 2 });
});

test("an array of objects with nested arrays is extracted whole", () => {
  const reply = 'Result:\n[{"id":"a","near":[{"id":"b","walk_minutes":4}]},{"id":"b","near":[]}]\nDone.';
  const parsed = extractJson(reply);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].near[0].id, "b");
});

test("truncated JSON throws rather than silently returning a partial object", () => {
  assert.throws(() => extractJson('{"west":12.4,"east":'), /unterminated/);
});

test("a response with no JSON at all throws a clear error", () => {
  assert.throws(() => extractJson("I could not find that information."), /no JSON found/);
});
