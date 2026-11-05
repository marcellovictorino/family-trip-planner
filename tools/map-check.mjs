#!/usr/bin/env node
// Source: the captain's replacement TRIP-7 brief requires real tiles, regional
// day trips, popups and selection, and a browser test that catches a broken map.
// Uses the real guide and the existing isolated Chrome launcher; no tile mocks.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { startServer, launchChrome, connect, openPage } from "./scale-check.mjs";

const data = JSON.parse(readFileSync(new URL("../data/copenhagen-2026.json", import.meta.url)));
// Fault injection uses the real city box or blocks actual resources. These
// modes must fail the same journey, never turn missing functionality into a pass.
if (process.argv.includes("--city-bounds")) data.trip.region_bbox = data.trip.bbox;
const output = process.env.EVIDENCE;
if (output) mkdirSync(output, { recursive: true });
const server = await startServer(JSON.stringify(data));
const chrome = await launchChrome();
const cdp = await connect(chrome.wsUrl);
const page = await openPage(cdp);
const { send, evaluate, waitFor, errors } = page;
const requests = [];
cdp.on((message) => {
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text);
  if (message.method === "Network.responseReceived" && message.params.response.url.includes("tile.openstreetmap.org")) {
    requests.push({ url: message.params.response.url, status: message.params.response.status });
  }
});
const click = async (selector) => {
  const point = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('Missing control: ' + ${JSON.stringify(selector)});
    (el.closest('.place-map') ?? el).scrollIntoView({block:'center'});
    const r = el.getBoundingClientRect();
    const x = r.x+r.width/2, y = r.y+r.height/2;
    if (!el.contains(document.elementFromPoint(x,y))) throw new Error('Control obscured: ' + ${JSON.stringify(selector)} + ' at ' + JSON.stringify({x,y,hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,400)}));
    return {x, y};
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
};
const capture = async (name) => {
  if (!output) return;
  // A decoded tile can precede Leaflet's popup/tile fade completing. Capture
  // the settled result, not a half-drawn transition frame.
  await waitFor(`document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle')`);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(resolve(output, `${name}.png`), Buffer.from(data, "base64"));
};
const loadedTiles = `(() => {
  const map = document.querySelector('.place-map').getBoundingClientRect();
  const tiles = [...document.querySelectorAll('.leaflet-tile')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.right > map.left && r.left < map.right && r.bottom > map.top && r.top < map.bottom;
  });
  return tiles.length > 0 && tiles.every(el => el.complete && el.naturalWidth === 256);
})()`;
const fitRegion = async () => {
  await click("#panel-map .controls button");
  // Leaflet fades the previous popup out; it can still intercept a pointer
  // until removed. Wait for that real state, never a fixed delay or retry.
  await waitFor(`!document.querySelector('.leaflet-popup')`);
};
const dayTrips = data.places.filter(p => p.day_trip);
// Their names come from the actual guide; this requirement must not silently
// pass if any of the four places named in the brief disappears.
for (const name of ["Louisiana", "Bakken", "Frederiksborg", "Kronborg"]) {
  assert(dayTrips.some(p => p.name.includes(name)), `Missing required day trip: ${name}`);
}
async function checkRegion() {
  const positions = await evaluate(`(() => {
    const map = document.querySelector('.place-map').getBoundingClientRect();
    return [...document.querySelectorAll('.place-marker')].map(el => {
      const r = el.getBoundingClientRect();
      return {id:el.dataset.placeId, visible:r.left>=map.left && r.right<=map.right && r.top>=map.top && r.bottom<=map.bottom};
    });
  })()`);
  assert.equal(positions.length, data.places.length, "Every guide place must have a marker");
  for (const p of dayTrips) assert(positions.find(m => m.id === p.id)?.visible, `${p.name} must be inside the initial regional viewport`);
  console.log("PASS regional marker visibility:", dayTrips.map(p => p.name).join(", "));
}
try {
  await send("Log.enable");
  if (process.argv.includes("--break-library")) {
    await send("Network.setBlockedURLs", { urls: ["*assets/leaflet/leaflet.js"] });
  }
  if (process.argv.includes("--break-tiles")) {
    await send("Network.setBlockedURLs", { urls: ["*tile.openstreetmap.org/*"] });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor(`document.querySelectorAll('#panel-explore details.card').length === ${data.places.length}`);
  await capture("after-explore");
  await click("#tab-map");
  await waitFor(`document.querySelectorAll('.place-marker').length === ${data.places.length}`);
  await waitFor(loadedTiles);
  await checkRegion();
  await capture("map-region-desktop");
  console.log(`PASS real visible tiles: ${requests.length} successful provider responses`);

  for (const place of dayTrips) {
    await fitRegion();
    await click(`[data-place-id="${place.id}"]`);
    await waitFor(`document.querySelector('.leaflet-popup-content strong')?.textContent === ${JSON.stringify(place.name)}`);
    assert.equal(await evaluate(`document.querySelector('#map-place').value`), place.id);
    assert.equal(await evaluate(`document.querySelector('.map-selection details')?.dataset.id`), place.id);
    await waitFor(loadedTiles);
    await capture(`popup-${place.id}`);
    console.log(`PASS marker → popup → selected details: ${place.name}`);
  }
  // Exercise the native select's change interface, independently of marker
  // clicks. Chrome's headless macOS select menu does not accept CDP arrow keys.
  const louisiana = dayTrips.find(p => p.name.includes("Louisiana"));
  await evaluate(`(() => {
    const select = document.querySelector('#map-place');
    select.value = ${JSON.stringify(louisiana.id)};
    select.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await waitFor(`document.querySelector('.map-selection details')?.dataset.id === ${JSON.stringify(louisiana.id)}`);
  await waitFor(loadedTiles);
  await evaluate(`document.querySelector('.place-map').scrollIntoView({block:'center'})`);
  await capture("selector-louisiana");
  await click(".map-selection .actions button");
  assert.equal(await evaluate(`document.querySelector('.map-selection .actions button').getAttribute('aria-pressed')`), "true");
  await click(".map-selection .actions button:nth-child(2)");
  await waitFor(`document.querySelector('dialog[open]')`);
  await click("dialog .day-list button");
  await click("#tab-itinerary");
  await waitFor(`document.querySelector('#panel-itinerary').textContent.includes(${JSON.stringify(louisiana.name)})`);
  await capture("selected-place-itinerary");
  await click("#tab-saved");
  await waitFor(`document.querySelector('#panel-saved').textContent.includes(${JSON.stringify(louisiana.name)})`);
  await capture("selected-place-saved");
  await click("#tab-map");
  assert.equal(await evaluate(`document.querySelector('#map-place').value`), louisiana.id, "Tab switches must retain selection");
  console.log("PASS selector change, save, add to day, itinerary and return");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await fitRegion();
  await waitFor(loadedTiles);
  await checkRegion();
  assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), "Phone must not scroll horizontally");
  await capture("map-region-phone");
  await click(`[data-place-id="${louisiana.id}"]`);
  await waitFor(loadedTiles);
  await capture("map-popup-phone");
  console.log("PASS phone tiles, regional bounds, popup and no horizontal overflow");
  assert.deepEqual(errors, [], "No browser errors");
  assert(requests.length > 0 && requests.every(r => r.status === 200), "Tile responses must succeed");
  console.log("PASS console: no exceptions, console errors or browser error logs\nRESULT: PASS");
} catch (error) {
  console.error(error);
  console.error("Browser errors:", errors);
  await capture("map-failure");
  process.exitCode = 1;
} finally {
  if (output) writeFileSync(resolve(output, "browser-network.json"), JSON.stringify({ requests, errors }, null, 2));
  cdp.close();
  await chrome.close();
  server.close();
}
