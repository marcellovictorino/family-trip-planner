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

// ── R6: a visit is a per-day event, but "we have been here" is not ──
// A place can sit on two days, and each visit is its own event with its own
// rating. Explore only ever asks the simpler question, so its flag is derived:
// any ticked day means yes, and un-ticking the last one means no again.
test("ticking a day sets the global visited flag; un-ticking the last day clears it", () => {
  const state = createState(fakeStorage());
  state.toggleDayVisited("2026-08-02", "tivoli");
  assert.equal(state.get().dayLog["2026-08-02"].tivoli.done, true);
  assert.deepEqual(state.get().visited, ["tivoli"]);

  state.toggleDayVisited("2026-08-02", "tivoli");
  assert.equal(state.get().dayLog["2026-08-02"]?.tivoli, undefined);
  assert.deepEqual(state.get().visited, []);
});

test("un-ticking one of two days leaves the global flag set, because we did still go", () => {
  const state = createState(fakeStorage());
  state.toggleDayVisited("2026-08-02", "emmerys");
  state.toggleDayVisited("2026-08-04", "emmerys");
  state.toggleDayVisited("2026-08-02", "emmerys");
  assert.deepEqual(state.get().visited, ["emmerys"]);
  assert.equal(state.get().dayLog["2026-08-04"].emmerys.done, true);
});

test("a rating implies the visit happened, so rating an unticked stop ticks it", () => {
  const state = createState(fakeStorage());
  state.setDayRating("2026-08-02", "tivoli", { thumb: "up" }, "2026-08-02T18:41:07Z");
  const entry = state.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.done, true);
  assert.equal(entry.thumb, "up");
  assert.equal(entry.at, "2026-08-02T18:41:07Z");
  assert.deepEqual(state.get().visited, ["tivoli"]);
});

test("a second rating merges rather than replacing, so stars do not wipe the thumb", () => {
  const state = createState(fakeStorage());
  state.setDayRating("2026-08-02", "tivoli", { thumb: "up" }, "2026-08-02T18:00:00Z");
  state.setDayRating("2026-08-02", "tivoli", { stars: 4, tags: ["baby-great"] }, "2026-08-02T18:05:00Z");
  const entry = state.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.thumb, "up");
  assert.equal(entry.stars, 4);
  assert.deepEqual(entry.tags, ["baby-great"]);
});

// ── R7: an upgrade must never cost a trip ──
// Someone mid-trip reloads the page and gets new code. Their v1 payload has no
// dayLog. It must load intact, not reset to an empty trip.
test("a v1 payload loads into v2 with an empty dayLog and nothing lost", () => {
  const v1 = JSON.stringify({
    version: 1,
    favourites: ["tivoli"],
    visited: ["rundetaarn"],
    notes: { tivoli: "buy tickets Sunday" },
    days: { "2026-08-02": ["tivoli"] },
  });
  const state = createState(fakeStorage({ [STORAGE_KEY]: v1 }));
  const snapshot = state.get();
  assert.deepEqual(snapshot.favourites, ["tivoli"]);
  assert.deepEqual(snapshot.visited, ["rundetaarn"]);
  assert.equal(snapshot.notes.tivoli, "buy tickets Sunday");
  assert.deepEqual(snapshot.days["2026-08-02"], ["tivoli"]);
  assert.deepEqual(snapshot.dayLog, {});
});

// ── R9: ratings are the point; losing them in transit defeats the feature ──
test("ratings survive an export and import round trip", () => {
  const source = createState(fakeStorage());
  source.setDayRating("2026-08-02", "tivoli", { thumb: "up", stars: 4, tags: ["worth-money"] }, "2026-08-02T18:41:07Z");

  const target = createState(fakeStorage());
  target.importJson(source.exportJson());
  const entry = target.get().dayLog["2026-08-02"].tivoli;
  assert.equal(entry.stars, 4);
  assert.deepEqual(entry.tags, ["worth-money"]);
  assert.deepEqual(target.get().visited, ["tivoli"]);
});

// ── R10: a full disk must not look like a successful save ──
// Notes are unbounded text sitting beside a cached 90-place dataset. If the
// quota is hit, the write silently vanishing is the worst outcome: the screen
// says saved, the phone disagrees, and you find out days later.
test("a storage write that fails throws, and leaves the in-memory state untouched", () => {
  const storage = fakeStorage();
  const state = createState(storage);
  state.toggleFavourite("tivoli");

  storage.setItem = () => {
    throw new DOMException("quota", "QuotaExceededError");
  };
  assert.throws(() => state.toggleFavourite("rundetaarn"), /Could not save/);
  assert.deepEqual(state.get().favourites, ["tivoli"]);
});
