#!/usr/bin/env node
// Zero-dependency offline + accessibility-adjacent verification for the app.
// See docs/VERIFICATION.md for what this does and does not prove.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, posix, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDataset } from "../src/schema.mjs";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".woff2": "font/woff2",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = join(ROOT, urlPath);
      readFile(filePath)
        .then((body) => {
          res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
          res.end(body);
        })
        .catch(() => {
          res.writeHead(404);
          res.end("Not found");
        });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Pulls the ASSETS array out of sw.js as data, rather than hand-copying the
// list here where the two would drift apart.
async function parseSwAssets() {
  const source = await readFile(join(ROOT, "sw.js"), "utf8");
  const match = source.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!match) throw new Error("could not find `const ASSETS = [...]` in sw.js");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

async function checkAssetsServe(baseUrl) {
  const assets = await parseSwAssets();
  const results = [];
  for (const asset of assets) {
    const url = `${baseUrl}/${asset === "./" ? "" : asset}`;
    try {
      const response = await fetch(url);
      results.push({ item: asset, ok: response.status === 200, detail: `HTTP ${response.status}` });
    } catch (error) {
      results.push({ item: asset, ok: false, detail: error.message });
    }
  }
  return { name: `sw.js ASSETS resolve to 200 (${assets.length} paths)`, results };
}

// CSS url()/@import targets resolve relative to the stylesheet that names
// them, not the page that imported it — the exact rule a font path just
// violated when it was written relative to the wrong base.
async function findCssFiles() {
  const tokensDir = join(ROOT, "design/tokens");
  const tokenFiles = (await readdir(tokensDir)).filter((f) => f.endsWith(".css")).map((f) => join(tokensDir, f));
  return [join(ROOT, "styles.css"), ...tokenFiles];
}

async function checkCssUrls() {
  const results = [];
  for (const cssFile of await findCssFiles()) {
    const source = await readFile(cssFile, "utf8");
    const cssDir = dirname(cssFile);
    for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const target = match[1];
      if (/^(data:|https?:)/.test(target)) continue;
      const resolved = resolvePath(cssDir, target);
      const rel = posix.relative(ROOT, resolved);
      results.push({ item: `${posix.relative(ROOT, cssFile)} -> ${target}`, ok: existsSync(resolved), detail: rel });
    }
  }
  return { name: "styles.css and design/tokens/*.css url()/@import targets exist", results };
}

async function checkManifest() {
  const manifestPath = join(ROOT, "manifest.webmanifest");
  const results = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    results.push({ item: "manifest.webmanifest parses as JSON", ok: true, detail: "" });
  } catch (error) {
    return { name: "manifest.webmanifest", results: [{ item: "parses as JSON", ok: false, detail: error.message }] };
  }
  for (const icon of manifest.icons ?? []) {
    const resolved = resolvePath(ROOT, icon.src);
    results.push({ item: `icon ${icon.src}`, ok: existsSync(resolved), detail: `${icon.sizes ?? "?"} ${icon.purpose ?? "any"}` });
  }
  return { name: "manifest.webmanifest parses and its icons exist", results };
}

// Follows relative import specifiers transitively from src/app.js, catching
// a file that was renamed or deleted but left referenced.
async function checkModuleGraph() {
  const results = [];
  const visited = new Set();
  const importRe = /(?:^|\s)(?:import|export)\s+(?:[^'"]*?from\s+)?["']([^"']+)["']/g;

  async function visit(filePath, importedFrom) {
    const rel = posix.relative(ROOT, filePath);
    if (visited.has(filePath)) return;
    visited.add(filePath);
    if (!existsSync(filePath)) {
      results.push({ item: rel, ok: false, detail: `imported from ${importedFrom} but missing` });
      return;
    }
    results.push({ item: rel, ok: true, detail: "" });
    const source = await readFile(filePath, "utf8");
    for (const match of source.matchAll(importRe)) {
      const specifier = match[1];
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      const resolved = resolvePath(dirname(filePath), specifier);
      await visit(resolved, rel);
    }
  }

  await visit(join(ROOT, "src/app.js"), "(entry point)");
  return { name: "src/app.js module graph resolves transitively", results };
}

async function checkDataset() {
  const dataPath = join(ROOT, "data/copenhagen-2026.json");
  try {
    const dataset = JSON.parse(await readFile(dataPath, "utf8"));
    const problems = validateDataset(dataset);
    if (problems.length === 0) {
      return { name: "data/copenhagen-2026.json", results: [{ item: `${dataset.places.length} places`, ok: true, detail: "validateDataset found no problems" }] };
    }
    return { name: "data/copenhagen-2026.json", results: problems.map((p) => ({ item: "validateDataset", ok: false, detail: p })) };
  } catch (error) {
    return { name: "data/copenhagen-2026.json", results: [{ item: "parses as JSON", ok: false, detail: error.message }] };
  }
}

function printSection({ name, results }) {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? "PASS" : "FAIL"}  ${name}`);
  for (const r of results) {
    if (r.ok) continue;
    console.log(`  ✗ ${r.item}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  if (failed.length === 0 && results.length > 0) {
    console.log(`  ✓ all ${results.length} checked`);
  }
  return failed.length === 0;
}

async function main() {
  const server = await startServer();
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Serving ${ROOT} on ${baseUrl}`);

  let allPass = true;
  try {
    const sections = [
      await checkAssetsServe(baseUrl),
      await checkCssUrls(),
      await checkManifest(),
      await checkModuleGraph(),
      await checkDataset(),
    ];
    for (const section of sections) {
      allPass = printSection(section) && allPass;
    }
  } finally {
    server.close();
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(allPass ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(`verify-app crashed: ${error.stack}`);
  process.exit(1);
});
