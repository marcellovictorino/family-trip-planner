import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil } from "../src/views/trip.js";

test("counts whole days remaining before the trip", () => {
  assert.equal(daysUntil("2026-08-02", "2026-07-31"), 2);
});

test("the first day of the trip counts as zero, not one", () => {
  assert.equal(daysUntil("2026-08-02", "2026-08-02"), 0);
});

test("a past start date returns a negative number so the view can say the trip has begun", () => {
  assert.equal(daysUntil("2026-08-02", "2026-08-04"), -2);
});
