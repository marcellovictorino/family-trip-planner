#!/usr/bin/env node
// Zero-dependency browser check of the app at 200+ places (td-9fdf7e: the spec
// targets responsiveness at 200 places; the guide holds about 100). It doubles
// the real dataset, serves the app with that in place of the guide, drives a
// headless Chrome over the DevTools protocol at phone size with a phone-class
// CPU, and checks speed, layout and correctness. See docs/VERIFICATION.md.
//
//   node tools/scale-check.mjs            # 2x the guide (204 places)
//   node tools/scale-check.mjs --factor 3 # 306 places
//   CHROME=/path/to/chrome node tools/scale-check.mjs
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { filterPlaces, EMPTY_FILTERS } from "../src/filter.js";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = "data/copenhagen-2026.json";

// A phone is several times slower than a laptop. 4x is Lighthouse's mobile
// setting, and the budget below is the "good" interaction threshold (200 ms)
// with headroom for a shared machine, still well under the ~690 ms the
// slowest tap took in Chrome 156 before the card emoji named their fonts.
const CPU_SLOWDOWN = 4;
const TAP_BUDGET_MS = 400;
const VIEWPORT = { width: 390, height: 844 };

const factorFlag = process.argv.indexOf("--factor");
const FACTOR = factorFlag > 0 ? Number(process.argv[factorFlag + 1]) : 2;

// Copies of the real places under new ids and names, so every field keeps the
// guide's real mix of kinds, settings, prices and text lengths.
export function scaleDataset(data, factor) {
  const places = [];
  for (let copy = 0; copy < factor; copy++) {
    for (const place of data.places) {
      if (copy === 0) { places.push(place); continue; }
      const suffix = `-copy${copy}`;
      places.push({
        ...place,
        id: `${place.id}${suffix}`,
        name: `${place.name} (${copy + 1})`,
        near: (place.near ?? []).map((near) => ({ ...near, id: `${near.id}${suffix}` })),
      });
    }
  }
  return { ...data, places };
}

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".woff2": "font/woff2",
};

function startServer(datasetBody) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      if (urlPath === `/${DATA_PATH}`) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(datasetBody);
        return;
      }
      try {
        const filePath = join(ROOT, urlPath);
        const body = readFileSync(filePath);
        res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error("No Chrome found. Set CHROME to a Chrome or Chromium executable.");
  return found;
}

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "scale-check-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check",
    // Headless Chrome otherwise treats its only tab as hidden: no frames, no
    // layout until something reads it, and timings that measure nothing.
    "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let log = "";
    chrome.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.once("exit", (code) => reject(new Error(`Chrome exited (${code}) before DevTools was ready`)));
  });
  const close = async () => {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  return { wsUrl, close };
}

// The smallest DevTools client: one socket, flat sessions, promises by id.
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { send, on: (fn) => listeners.push(fn), close: () => socket.close() };
}

async function openPage(cdp) {
  const { targetInfos } = await cdp.send("Target.getTargets");
  const { targetId } = targetInfos.find((target) => target.type === "page");
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const errors = [];
  cdp.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? "exception");
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 2, mobile: process.env.MOBILE === "1" });
  await send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  // Leave the service worker out: this measures the page, not the cache.
  await send("Network.enable");
  await send("Network.setBypassServiceWorker", { bypass: true });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const waitFor = async (expression, timeoutMs = 20000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  };
  return { send, evaluate, waitFor, errors };
}

// In-page helpers, installed once. A tap is timed from the click to the frame
// after it: the click handler re-renders synchronously, rAF lands before that
// frame's style and layout, and the timeout after it lands once they are done.
const HELPERS = `
  window.scaleCheck = {
    cards: () => [...document.querySelectorAll("#panel-explore details.card")],
    ids: () => window.scaleCheck.cards().map((el) => el.getAttribute("data-id")),
    count: () => document.querySelector("#panel-explore .count")?.textContent,
    nextFrame: () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))),
    async tap(el) {
      const start = performance.now();
      el.click();
      // Lay the page out now rather than trusting headless Chrome to draw a
      // frame: it may not, and then the timing would leave layout out.
      document.documentElement.getBoundingClientRect();
      await window.scaleCheck.nextFrame();
      return performance.now() - start;
    },
    chip: (label) => [...document.querySelectorAll("#panel-explore .chip")].find((el) => el.textContent.trim() === label),
  };
`;

// Each chip the Explore panel shows, with the filters it sets.
const CHIPS = [
  { label: "🌧 Rainy", filters: { weather: "rainy" } },
  { label: "☀️ Sunny", filters: { weather: "sunny" } },
  { label: "👶 Baby", filters: { ages: ["baby"] } },
  { label: "🧒 Toddler", filters: { ages: ["toddler"] } },
  { label: "👧 6-year-old", filters: { ages: ["child"] } },
  { label: "🎡 Things to do", filters: { kind: "attraction" } },
  { label: "🛝 Playgrounds", filters: { kind: "playground" } },
  { label: "🍽 Food", filters: { kind: "restaurant" } },
  { label: "Under 1h", filters: { duration: "<1h" } },
  { label: "1–2h", filters: { duration: "1-2h" } },
  { label: "Half day", filters: { duration: "half-day" } },
  { label: "Full day", filters: { duration: "full-day" } },
  { label: "Free", filters: { price: ["free"] } },
  { label: "€", filters: { price: ["€"] } },
  { label: "€€", filters: { price: ["€€"] } },
  { label: "€€€", filters: { price: ["€€€"] } },
  { label: "GF", filters: { glutenFree: true } },
];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function run() {
  const real = JSON.parse(readFileSync(join(ROOT, DATA_PATH), "utf8"));
  const dataset = scaleDataset(real, FACTOR);
  const total = dataset.places.length;
  const server = await startServer(JSON.stringify(dataset));
  const chrome = await launchChrome();
  const cdp = await connect(chrome.wsUrl);
  const { product } = await cdp.send("Browser.getVersion");
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok, detail });
  const timings = {};

  try {
    const page = await openPage(cdp);
    const allShown = `window.scaleCheck?.cards().length === ${total}`;
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS });
    await page.send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
    await page.waitFor(allShown);

    // Correctness: every place renders once, and the count says so.
    const ids = await page.evaluate("scaleCheck.ids()");
    check(`all ${total} places render, once each`,
      ids.length === total && new Set(ids).size === total && dataset.places.every((p) => ids.includes(p.id)),
      `${new Set(ids).size} distinct cards`);
    const count = await page.evaluate("scaleCheck.count()");
    check("the count reads all of all", count === `${total} of ${total}`, count);

    // Correctness and speed: every chip shows exactly what the filter
    // module says it should, and each tap is timed.
    const chipMs = [];
    const wrongChips = [];
    for (const { label, filters } of CHIPS) {
      const expected = filterPlaces(dataset.places, { ...EMPTY_FILTERS, ...filters }).map((p) => p.id);
      chipMs.push(await page.evaluate(`scaleCheck.tap(scaleCheck.chip(${JSON.stringify(label)}))`));
      const shown = await page.evaluate("scaleCheck.ids()");
      const shownCount = await page.evaluate("scaleCheck.count()");
      if (shown.join() !== expected.join() || shownCount !== `${expected.length} of ${total}`) {
        wrongChips.push(`${label}: showed ${shown.length}, expected ${expected.length}`);
      }
      await page.evaluate(`scaleCheck.tap(scaleCheck.chip(${JSON.stringify(label)}))`);
      await page.waitFor(allShown);
    }
    check(`each of ${CHIPS.length} filter chips shows exactly the matching places`, wrongChips.length === 0,
      wrongChips.join("; ") || "all match");

    // Search: the debounce commits once typing pauses; the result must match.
    const query = "museum";
    const expectedSearch = filterPlaces(dataset.places, { ...EMPTY_FILTERS, query }).map((p) => p.id);
    const searchMs = await page.evaluate(`(async () => {
      const box = document.querySelector("#panel-explore .search");
      box.focus();
      let start;
      for (const c of ${JSON.stringify(query)}) {
        start = performance.now();
        box.value += c;
        box.dispatchEvent(new Event("input", { bubbles: true }));
      }
      while (scaleCheck.cards().length === ${total}) await new Promise((r) => setTimeout(r, 5));
      await scaleCheck.nextFrame();
      return performance.now() - start;
    })()`);
    const searched = await page.evaluate("scaleCheck.ids()");
    check(`search "${query}" shows exactly the matching places`, searched.join() === expectedSearch.join(),
      `${searched.length} shown, ${expectedSearch.length} expected`);
    timings.searchSettleMs = Math.round(searchMs);
    await page.evaluate(`(() => { const box = document.querySelector("#panel-explore .search"); box.value = ""; box.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    // The rebuild hands focus to the new search box; a real tap elsewhere
    // takes it away, and a scripted click does not.
    await page.evaluate("document.activeElement.blur()");
    await page.waitFor(allShown);

    // Stillness: saving a place deep in the list must not move it. The tap
    // rebuilds every card; a card that forgets its height jumps.
    const deep = Math.min(150, total - 1);
    const jump = await page.evaluate(`(async () => {
      const card = scaleCheck.cards()[${deep}];
      card.open = true;
      card.scrollIntoView();
      // Cards near the viewport are drawn, and their estimated heights
      // replaced, on the frames after a scroll. Let that finish first.
      for (let i = 0; i < 5; i++) await scaleCheck.nextFrame();
      await new Promise((r) => setTimeout(r, 200));
      const before = card.getBoundingClientRect().top;
      const ms = await scaleCheck.tap(card.querySelector('[aria-label="Add to favourites"]'));
      const after = scaleCheck.cards()[${deep}];
      return { ms, moved: after.getBoundingClientRect().top - before, open: after.open,
        saved: Boolean(after.querySelector('[aria-label="Remove from favourites"]')) };
    })()`);
    check(`saving place ${deep + 1} of ${total} leaves it where it was, open and saved`,
      Math.abs(jump.moved) <= 1 && jump.open && jump.saved,
      `moved ${Math.round(jump.moved)}px, open ${jump.open}, saved ${jump.saved}`);
    timings.saveTapMs = Math.round(jump.ms);

    timings.nearestTapMs = Math.round(await page.evaluate(`(async () => {
      scrollTo(0, 0);
      const ms = await scaleCheck.tap(scaleCheck.chip("📍 Nearest first"));
      await scaleCheck.tap(scaleCheck.chip("📍 Nearest first"));
      return ms;
    })()`));

    timings.chipTapMedianMs = Math.round(median(chipMs));
    timings.chipTapWorstMs = Math.round(Math.max(...chipMs));
    // Layout: nothing pushes the page sideways at phone width, in Explore or
    // in Saved with every place saved.
    const overflow = await page.evaluate("document.documentElement.scrollWidth - innerWidth");
    check(`Explore fits ${VIEWPORT.width}px with no sideways scroll`, overflow <= 0, `${overflow}px over`);
    await page.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem("trip.state.v1"));
      state.favourites = ${JSON.stringify(dataset.places.map((p) => p.id))};
      localStorage.setItem("trip.state.v1", JSON.stringify(state));
    })()`);
    await page.send("Page.reload");
    await page.waitFor(allShown);
    timings.savedTabMs = Math.round(await page.evaluate(`scaleCheck.tap(document.querySelector("#tab-saved"))`));
    const saved = await page.evaluate(`({
      items: document.querySelectorAll("#panel-saved .saved-list li").length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    })`);
    check(`Saved lists all ${total} favourites and fits ${VIEWPORT.width}px`,
      saved.items === total && saved.overflow <= 0, `${saved.items} listed, ${saved.overflow}px over`);
    timings.backToExploreMs = Math.round(await page.evaluate(`scaleCheck.tap(document.querySelector("#tab-explore"))`));

    // Speed: the slowest tap of the run, as a phone user would feel it.
    // Emoji font lookup costs differ a lot between Chrome builds (156 took
    // ~0.7 s before the fix, 157 a tenth of that), so a fast build can pass
    // either way; the timings line shows what was measured.
    const slowest = Object.entries(timings).filter(([key]) => key !== "searchSettleMs" && key !== "chipTapMedianMs")
      .sort((a, b) => b[1] - a[1])[0];
    check(`every tap paints within ${TAP_BUDGET_MS} ms on a ${CPU_SLOWDOWN}x slower CPU`,
      slowest[1] <= TAP_BUDGET_MS, `slowest ${slowest[0]} ${slowest[1]} ms`);

    check("no console errors", page.errors.length === 0, page.errors.join(" | ") || "none");
  } finally {
    cdp.close();
    await chrome.close();
    server.close();
  }

  console.log(`Scale check: ${total} places, ${product}, ${VIEWPORT.width}x${VIEWPORT.height}, CPU ${CPU_SLOWDOWN}x slower\n`);
  for (const { name, ok, detail } of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name} (${detail})`);
  console.log(`\nTimings: ${JSON.stringify(timings)}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\nRESULT: ${failed === 0 ? "PASS" : `FAIL (${failed} of ${checks.length})`}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    console.log("\nRESULT: FAIL");
    process.exitCode = 1;
  });
}
