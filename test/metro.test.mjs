import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalMetro } from "../tools/metro.mjs";

// td-1e55cb: the research step wrote one station under several spellings, so
// two places at the same station looked like different stations.
test("every spelling of one station collapses to one value", () => {
  const spellings = {
    "Nørreport": ["Nørreport", "Nørreport St.", "Nørreport Station"],
    "Kongens Nytorv": ["Kongens Nytorv", "Kongens Nytorv St.", "Kongens Nytorv (Metro)", "Kongens Nytorv Metro Station"],
    "København H": ["København H", "København H (Central Station)"],
    "Vesterport": ["Vesterport", "Vesterport Station", "Vesterport St-train station"],
    "Østerport": ["Østerport", "Østerport St.", "Østerport Station", "Østerport (then bus 9A)"],
  };
  for (const [canonical, variants] of Object.entries(spellings)) {
    for (const variant of variants) {
      assert.equal(canonicalMetro(variant), canonical, `${variant} should name ${canonical}`);
    }
  }
});

// Nørrebro and Nørrebros Runddel are two metro stations. Merging them would
// tell a family that a place is one stop from a station it is not near.
test("a different station keeps its own value", () => {
  assert.equal(canonicalMetro("Nørrebro St."), "Nørrebro");
  assert.equal(canonicalMetro("Nørrebros Runddel St."), "Nørrebros Runddel");
  assert.notEqual(canonicalMetro("Nørrebros Runddel St."), canonicalMetro("Nørrebro St."));
});

// A name with no station word is already canonical, so it must not be trimmed.
test("a name without a station word is returned unchanged", () => {
  assert.equal(canonicalMetro("DR Byen"), "DR Byen");
  assert.equal(canonicalMetro("Vestamager"), "Vestamager");
});
