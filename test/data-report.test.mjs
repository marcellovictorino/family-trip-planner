import { test } from "node:test";
import assert from "node:assert/strict";
import { findAbsentKnownAttractions } from "../tools/data-report.mjs";

test("substring false negative: a restaurant merely containing the landmark's name must not count as the landmark", () => {
  const places = [{ name: "Wagamama Tivoli" }];
  const absent = findAbsentKnownAttractions(places);
  assert.ok(
    absent.includes("Tivoli Gardens"),
    "a restaurant called \"Wagamama Tivoli\" must not satisfy the Tivoli Gardens check",
  );
});

test("whole-name false positive: a landmark carrying a trailing descriptor must still count as present", () => {
  const places = [{ name: "Den Blå Planet (National Aquarium Denmark)" }];
  const absent = findAbsentKnownAttractions(places);
  assert.ok(
    !absent.includes("Den Blå Planet"),
    "\"Den Blå Planet (National Aquarium Denmark)\" is the same place as \"Den Blå Planet\" and must not be reported absent",
  );
  assert.ok(
    !absent.includes("The National Aquarium"),
    "the same place also satisfies the National Aquarium check under its other label",
  );
});
