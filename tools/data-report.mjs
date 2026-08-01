#!/usr/bin/env node
// Zero-dependency data-quality report for a generated trip dataset.
// This is a report, not a gate: it exits 0 whenever it runs to completion,
// even if it finds data problems (missing Tivoli, duplicate names, etc — those
// are informational). It exits non-zero only if the tool itself crashes (bad
// JSON, missing file, a bug in the report), so a caller can tell "ran and the
// data looks fine/has findings" from "never actually ran". See
// docs/DATA-QUALITY.md for a reading guide to what each section means.
import { readFile } from "node:fs/promises";

const MIN_DESCRIPTION_LENGTH = 40;
const SUSPICIOUSLY_SHORT_LENGTH = 60;

// Well-known Copenhagen family attractions. Recorded here because an earlier
// generated dataset was technically valid but silently contained no Tivoli at
// all — the schema cannot catch an entire obvious category going missing.
//
// `names` are compared against a place's *whole* normalised name, never as a
// substring — a substring match let a restaurant called "Wagamama Tivoli"
// convince an earlier version of this check that Tivoli Gardens was present.
const KNOWN_ATTRACTIONS = [
  { label: "Tivoli Gardens", names: ["tivoli", "tivoli gardens"] },
  { label: "Den Blå Planet", names: ["den blå planet", "den bla planet", "blue planet", "the blue planet"] },
  { label: "Nyhavn", names: ["nyhavn"] },
  { label: "Rundetaarn / the Round Tower", names: ["rundetårn", "rundetaarn", "the round tower", "round tower"] },
  { label: "Copenhagen Zoo", names: ["copenhagen zoo", "zoologisk have"] },
  { label: "The National Aquarium", names: ["national aquarium", "den blå planet", "den bla planet", "the national aquarium denmark"] },
  { label: "Louisiana Museum of Modern Art", names: ["louisiana", "louisiana museum of modern art"] },
  { label: "Bakken", names: ["bakken"] },
  { label: "The Little Mermaid", names: ["little mermaid", "the little mermaid", "den lille havfrue"] },
  { label: "Amalienborg", names: ["amalienborg"] },
];

function counts(places, field) {
  const tally = new Map();
  for (const place of places) {
    const key = place[field] ?? "(missing)";
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normaliseName(name) {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Cheap bigram-overlap similarity — good enough to flag "Tivoli Garden" vs
// "Tivoli Gardens", not meant to be a real string-distance algorithm.
function bigrams(str) {
  const set = new Set();
  for (let i = 0; i < str.length - 1; i += 1) set.add(str.slice(i, i + 2));
  return set;
}

function similarity(a, b) {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let shared = 0;
  for (const gram of bigramsA) if (bigramsB.has(gram)) shared += 1;
  return (2 * shared) / (bigramsA.size + bigramsB.size);
}

function findDuplicateNames(places) {
  const findings = [];
  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      const a = places[i];
      const b = places[j];
      const normA = normaliseName(a.name);
      const normB = normaliseName(b.name);
      if (normA === normB) {
        findings.push(`exact match: "${a.name}" (${a.id}) / "${b.name}" (${b.id})`);
      } else if (similarity(normA, normB) >= 0.8) {
        findings.push(`near-duplicate: "${a.name}" (${a.id}) / "${b.name}" (${b.id})`);
      }
    }
  }
  return findings;
}

function findTemplatedOrShortDescriptions(places) {
  const findings = [];
  const byText = new Map();
  for (const place of places) {
    const text = place.description ?? "";
    if (text.length < MIN_DESCRIPTION_LENGTH) {
      findings.push(`"${place.name}" (${place.id}): only ${text.length} chars, below the ${MIN_DESCRIPTION_LENGTH}-char minimum`);
    } else if (text.length < SUSPICIOUSLY_SHORT_LENGTH) {
      findings.push(`"${place.name}" (${place.id}): suspiciously short at ${text.length} chars`);
    }
    if (text) {
      if (!byText.has(text)) byText.set(text, []);
      byText.get(text).push(place);
    }
  }
  for (const [text, group] of byText) {
    if (group.length > 1) {
      findings.push(`templated: identical description shared by ${group.map((p) => `"${p.name}"`).join(", ")}`);
    }
  }
  return findings;
}

function findNonHttpsWebsites(places) {
  return places
    .filter((p) => p.website && !p.website.startsWith("https://"))
    .map((p) => `"${p.name}" (${p.id}): ${p.website}`);
}

function findAbsentKnownAttractions(places) {
  const normalisedNames = new Set(places.map((p) => normaliseName(p.name)));
  return KNOWN_ATTRACTIONS.filter(
    (attraction) => !attraction.names.some((name) => normalisedNames.has(normaliseName(name))),
  ).map((a) => a.label);
}

// Proves the Wagamama Tivoli false negative stays fixed: a restaurant whose
// name merely contains "Tivoli" must not be read as Tivoli Gardens itself.
// Runs on every invocation so a future edit that reintroduces substring
// matching fails loudly (a crash, non-zero exit) rather than silently.
function selfCheckAttractionMatching() {
  const decoy = [{ name: "Wagamama Tivoli", tags: [] }];
  if (!findAbsentKnownAttractions(decoy).includes("Tivoli Gardens")) {
    throw new Error(
      "self-check failed: a place named \"Wagamama Tivoli\" fooled the attraction-absence check into treating Tivoli Gardens as present",
    );
  }
}

function formatDistribution(pairs, total) {
  return pairs.map(([key, count]) => `  ${key}: ${count} (${Math.round((count / total) * 100)}%)`).join("\n");
}

function report(dataset, path) {
  const places = dataset.places ?? [];
  const total = places.length;
  const lines = [];
  const push = (line = "") => lines.push(line);

  push(`Data quality report for ${path}`);
  push(`${total} places`);
  push();

  push("== Counts by kind ==");
  push(formatDistribution(counts(places, "kind"), total));
  push();

  push("== Counts by setting ==");
  push(formatDistribution(counts(places, "setting"), total));
  push();

  const babyFriendly = places.filter((p) => p.baby_friendly).length;
  const stroller = places.filter((p) => p.stroller).length;
  const changingTable = places.filter((p) => p.changing_table).length;
  push("== Baby/pram accessibility ==");
  push(`  baby_friendly: ${babyFriendly}/${total} (${Math.round((babyFriendly / total) * 100)}%)`);
  push(`  stroller-accessible: ${stroller}/${total} (${Math.round((stroller / total) * 100)}%)`);
  push(`  changing_table: ${changingTable}/${total} (${Math.round((changingTable / total) * 100)}%)`);
  push();

  push("== Gluten-free distribution ==");
  push(formatDistribution(counts(places, "gluten_free"), total));
  push();

  push("== Price band distribution ==");
  push(formatDistribution(counts(places, "price_band"), total));
  push();

  const isolated = places.filter((p) => (p.near ?? []).length === 0);
  push("== Isolated places (empty near[]) ==");
  push(`  ${isolated.length}/${total} places have no nearby neighbour within the near-radius`);
  if (isolated.length > 0) {
    for (const p of isolated) push(`    - ${p.name} (${p.id})`);
  }
  push();

  const durations = places.map((p) => p.duration_minutes).filter((n) => typeof n === "number");
  push("== duration_minutes ==");
  push(`  min: ${Math.min(...durations)}`);
  push(`  median: ${median(durations)}`);
  push(`  max: ${Math.max(...durations)}`);
  push();

  const descriptionFindings = findTemplatedOrShortDescriptions(places);
  push("== Templated or suspiciously short descriptions ==");
  push(descriptionFindings.length === 0 ? "  none found" : descriptionFindings.map((f) => `  - ${f}`).join("\n"));
  push();

  const nameFindings = findDuplicateNames(places);
  push("== Duplicate or near-duplicate names ==");
  push(nameFindings.length === 0 ? "  none found" : nameFindings.map((f) => `  - ${f}`).join("\n"));
  push();

  const httpFindings = findNonHttpsWebsites(places);
  push("== Non-https website URLs ==");
  push(httpFindings.length === 0 ? "  none found" : httpFindings.map((f) => `  - ${f}`).join("\n"));
  push();

  const absent = findAbsentKnownAttractions(places);
  push("== Well-known Copenhagen attractions absent from the dataset ==");
  push(absent.length === 0 ? "  none — all reference attractions are present" : absent.map((a) => `  - ${a}`).join("\n"));

  return lines.join("\n");
}

async function main() {
  selfCheckAttractionMatching();
  const path = process.argv[2] ?? "data/copenhagen-2026.json";
  const dataset = JSON.parse(await readFile(path, "utf8"));
  console.log(report(dataset, path));
  console.log();
  console.log(
    "Exit 0: the report ran to completion. This says nothing about whether the data is clean — read the findings above.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`data-report CRASHED — this is exit 1, distinct from the report's own exit 0: ${error.stack}`);
    process.exit(1);
  });
