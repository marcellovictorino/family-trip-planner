#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ENUMS,
  REQUIRED_PLACE_FIELDS,
  NEAR_RADIUS_METRES,
  WALK_METRES_PER_MINUTE,
  validatePlace,
} from "../src/schema.mjs";
import { computeNear } from "./geo.mjs";
import { extractJson, extractText } from "./parse.mjs";

// The single seam for swapping research backends. To use pi with a gpt model,
// change only this constant and the argv it builds.
const RESEARCH_COMMAND = "claude";
const RESEARCH_ARGS = ["-p", "--model", "claude-sonnet-5", "--effort", "medium",
  "--allowed-tools", "WebSearch", "--output-format", "json"];

const MAX_ATTEMPTS = 3;

const BATCHES = [
  { key: "rainy", count: 6, brief: "indoor attractions and museums that work on a wet day" },
  { key: "sunny", count: 6, brief: "outdoor attractions, parks and waterfront spots for fine weather" },
  { key: "playgrounds", count: 4, brief: "playgrounds and indoor play spaces, prioritising ones with a separate toddler area where a crawling 1-year-old is safe from older children" },
  { key: "food", count: 4, brief: "family-friendly restaurants and cafes with reliable gluten-free options" },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!args.city || !args.from || !args.to) {
    console.error("Usage: node tools/generate-trip.mjs --city Copenhagen --from 2026-08-02 --to 2026-08-08 [--out path]");
    process.exit(2);
  }
  return args;
}

function runResearch(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(RESEARCH_COMMAND, [...RESEARCH_ARGS, prompt], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`${RESEARCH_COMMAND} exited ${code}: ${stderr.trim()}`));
      resolve(stdout);
    });
  });
}

// Ask the model, then pull one balanced JSON value out of whatever it said.
// Retried, because one chatty reply must not abort a multi-minute run.
async function research(prompt, label) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return extractJson(extractText(await runResearch(prompt)));
    } catch (error) {
      console.error(`  attempt ${attempt}/${MAX_ATTEMPTS} for "${label}" failed: ${error.message}`);
      if (attempt === MAX_ATTEMPTS) throw error;
    }
  }
  throw new Error("unreachable");
}

const bboxPrompt = (city, country) => `Return the geographic bounding box of ${city}, ${country},
covering the area a tourist would plausibly visit on foot or by metro.
Output nothing except the JSON object. No prose before it, no remarks after it, no code fence:
{"west":<number>,"east":<number>,"south":<number>,"north":<number>}`;

function batchPrompt({ city, country, from, to, batch, bbox, existingNames }) {
  return `Research ${batch.count} ${batch.brief} in ${city}, ${country}, for a family visiting ${from} to ${to}.
The family is two adults, a 6-year-old and a 1-year-old who is starting to walk.
Use web search and prefer official sites. Do not invent anything: if you cannot confirm a
detail, omit that place entirely rather than guessing.

Already covered, do not repeat: ${existingNames.length ? existingNames.join("; ") : "(nothing yet)"}

Reply with ONLY a JSON array of ${batch.count} objects, no prose and no code fence.
Every object must have exactly these keys:

id                lower-case kebab-case, unique, derived from the name
name              official name
kind              one of ${ENUMS.kind.join(" | ")}
category          short lower-case kebab-case type, e.g. museum, aquarium, playground, bakery
neighbourhood     district name
lat, lon          decimal degrees, must lie inside west ${bbox.west}, east ${bbox.east}, south ${bbox.south}, north ${bbox.north}
description       2-3 sentences, at least 40 characters, written for THIS family: say what the
                  6-year-old does and what the 1-year-old does
duration_minutes  realistic visit length in minutes, including the faff of arriving with a pram
price_band        one of ${ENUMS.price_band.join(" | ")} where free = 0 kr, € < 100 kr,
                  €€ = 100-200 kr, €€€ > 200 kr, per adult entry or per main course
booking           one of ${ENUMS.booking.join(" | ")}
booking_url       URL or null
website           official URL
maps_url          https://www.google.com/maps/search/?api=1&query=<lat>,<lon>
setting           one of ${ENUMS.setting.join(" | ")}. Use "mixed" only if there is genuine
                  indoor shelter, because "mixed" survives the rainy-day filter
ages              array from ${ENUMS.ages.join(" | ")}
baby_friendly     true only if a 1-year-old can move around safely on the floor or ground.
                  This is NOT about changing tables.
stroller          true if a pram can be used throughout
changing_table    true or false, informational only
baby_notes        one sentence on where a baby can nap or crawl, or null
gluten_free       one of ${ENUMS.gluten_free.join(" | ")}
kids_menu         true or false
high_chair        true or false
nearest_metro     nearest metro or S-train station name
tags              2-4 short lower-case kebab-case tags
tips              one practical sentence, e.g. best time to arrive, or null
best_time         one of morning | afternoon | evening | any
near              always the empty array []

Required and never null: ${REQUIRED_PLACE_FIELDS.join(", ")}.`;
}

async function researchBatch(context) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const places = extractJson(extractText(await runResearch(batchPrompt(context))));
      if (!Array.isArray(places)) throw new Error("response was not an array");
      const problems = places.flatMap((place) =>
        validatePlace(place, { bbox: context.bbox, knownIds: new Set() }),
      );
      if (problems.length > 0) throw new Error(`invalid batch:\n  ${problems.join("\n  ")}`);
      return places;
    } catch (error) {
      console.error(`  attempt ${attempt}/${MAX_ATTEMPTS} for "${context.batch.key}" failed: ${error.message}`);
      if (attempt === MAX_ATTEMPTS) {
        console.error(`  giving up on "${context.batch.key}" — continuing without it`);
        return [];
      }
    }
  }
  return [];
}

const args = parseArgs(process.argv.slice(2));
const country = args.country ?? "Denmark";
const out = args.out ?? `data/${args.city.toLowerCase().replace(/\s+/g, "-")}-${args.from.slice(0, 4)}.json`;

console.log(`Resolving bounding box for ${args.city}...`);
const rawBbox = await research(bboxPrompt(args.city, country), "bounding box");

// The model returns a conservative city-centre box. Padding matters: an early
// Copenhagen run produced east 12.62, which would have rejected Den Blå Planet
// (12.6549) as a hallucination. The box is a hallucination detector, not a
// curation filter, so it should be generous enough that only genuinely wrong
// cities fail it.
const BBOX_PAD = 0.35;
function padBbox(box) {
  const lonPad = (box.east - box.west) * BBOX_PAD;
  const latPad = (box.north - box.south) * BBOX_PAD;
  return {
    west: +(box.west - lonPad).toFixed(4), east: +(box.east + lonPad).toFixed(4),
    south: +(box.south - latPad).toFixed(4), north: +(box.north + latPad).toFixed(4),
  };
}
const bbox = padBbox(rawBbox);
console.log(`  model: ${JSON.stringify(rawBbox)}`);
console.log(`  padded: ${JSON.stringify(bbox)}`);

const places = [];
for (const batch of BATCHES) {
  console.log(`Researching "${batch.key}" (${batch.count})...`);
  const found = await researchBatch({
    city: args.city, country, from: args.from, to: args.to, batch, bbox,
    existingNames: places.map((p) => p.name),
  });
  const fresh = found.filter((p) => !places.some((existing) => existing.id === p.id));
  console.log(`  kept ${fresh.length} of ${found.length}`);
  places.push(...fresh);
}

if (places.length === 0) {
  console.error("No valid places were produced. Not writing a file.");
  process.exit(1);
}

const dataset = {
  trip: { city: args.city, country, from: args.from, to: args.to, bbox, generated_at: new Date().toISOString() },
  places: computeNear(places, { radius: NEAR_RADIUS_METRES, pace: WALK_METRES_PER_MINUTE }),
};

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`Wrote ${dataset.places.length} places to ${out}`);
console.log(`Now run: node tools/validate-data.mjs ${out}`);
