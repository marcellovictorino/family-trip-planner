import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, STORAGE_KEY } from "../src/state.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

test("a fresh state starts empty rather than throwing", () => {
  const state = createState(fakeStorage());
  const snapshot = state.get();
  assert.deepEqual(snapshot.favourites, []);
  assert.deepEqual(snapshot.visited, []);
  assert.deepEqual(snapshot.notes, {});
  assert.deepEqual(snapshot.days, {});
});

test("corrupt stored JSON falls back to empty state instead of breaking the app mid-trip", () => {
  const state = createState(fakeStorage({ [STORAGE_KEY]: "{not json" }));
  assert.deepEqual(state.get().favourites, []);
});

test("toggling a favourite adds then removes it, and persists each time", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.toggleFavourite("tivoli");
  assert.deepEqual(state.get().favourites, ["tivoli"]);
  assert.match(storage.dump()[STORAGE_KEY], /tivoli/);
  state.toggleFavourite("tivoli");
  assert.deepEqual(state.get().favourites, []);
});

// ── R5: notes must survive a re-research ──
test("state is keyed by place id, so regenerating the dataset cannot erase notes", () => {
  const storage = fakeStorage();
  const first = createState(storage);
  first.setNote("tivoli", "buy tickets Sunday night");
  first.toggleVisited("rundetaarn");

  // Simulate a completely new dataset object being loaded: state is reconstructed
  // from storage alone and never consults the dataset.
  const afterRegeneration = createState(storage);
  assert.equal(afterRegeneration.get().notes.tivoli, "buy tickets Sunday night");
  assert.deepEqual(afterRegeneration.get().visited, ["rundetaarn"]);
});

test("a note on a place that has vanished from the dataset is orphaned, not deleted", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.setNote("closed-cafe", "they do gluten-free waffles");
  const reloaded = createState(storage);
  assert.equal(reloaded.get().notes["closed-cafe"], "they do gluten-free waffles");
});

test("clearing a note removes the key rather than storing an empty string", () => {
  const state = createState(fakeStorage());
  state.setNote("tivoli", "something");
  state.setNote("tivoli", "   ");
  assert.equal("tivoli" in state.get().notes, false);
});

test("adding to a day appends in order and refuses duplicates on the same day", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.addToDay("2026-08-03", "madkaffe");
  state.addToDay("2026-08-03", "tivoli");
  assert.deepEqual(state.get().days["2026-08-03"], ["tivoli", "madkaffe"]);
});

test("the same place may appear on two different days, because you might go twice", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.addToDay("2026-08-05", "tivoli");
  assert.deepEqual(state.get().days["2026-08-05"], ["tivoli"]);
});

test("moveInDay reorders within a day and clamps at the ends", () => {
  const state = createState(fakeStorage());
  for (const id of ["a", "b", "c"]) state.addToDay("2026-08-03", id);
  state.moveInDay("2026-08-03", "c", -1);
  assert.deepEqual(state.get().days["2026-08-03"], ["a", "c", "b"]);
  state.moveInDay("2026-08-03", "a", -1);
  assert.deepEqual(state.get().days["2026-08-03"], ["a", "c", "b"], "moving the first item up is a no-op");
});

test("removing the last item on a day drops the empty day key", () => {
  const state = createState(fakeStorage());
  state.addToDay("2026-08-03", "tivoli");
  state.removeFromDay("2026-08-03", "tivoli");
  assert.equal("2026-08-03" in state.get().days, false);
});

test("subscribers are notified on change and can unsubscribe", () => {
  const state = createState(fakeStorage());
  let calls = 0;
  const off = state.subscribe(() => { calls += 1; });
  state.toggleFavourite("tivoli");
  assert.equal(calls, 1);
  off();
  state.toggleFavourite("rundetaarn");
  assert.equal(calls, 1);
});

test("export then import round-trips the whole state, so notes can be backed up", () => {
  const source = createState(fakeStorage());
  source.setNote("tivoli", "tickets");
  source.toggleFavourite("den-bla-planet");
  source.addToDay("2026-08-03", "tivoli");

  const target = createState(fakeStorage());
  target.importJson(source.exportJson());
  assert.deepEqual(target.get(), source.get());
});

test("importing rubbish throws rather than silently wiping the trip", () => {
  const state = createState(fakeStorage());
  state.toggleFavourite("tivoli");
  assert.throws(() => state.importJson("{not json"));
  assert.deepEqual(state.get().favourites, ["tivoli"], "existing state must survive a failed import");
});
