import { test } from "node:test";
import assert from "node:assert/strict";
import { buildElement } from "../src/dom.js";

function fakeDocument() {
  return {
    createElement(tag) {
      return {
        tag,
        className: "",
        attrs: {},
        listeners: {},
        children: [],
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(k, fn) { this.listeners[k] = fn; },
        append(...kids) { this.children.push(...kids); },
      };
    },
    createTextNode(text) { return { text }; },
  };
}

test("h sets class, attributes and listeners distinctly", () => {
  const doc = fakeDocument();
  const onClick = () => {};
  const el = buildElement(doc, "button", { class: "chip", "aria-pressed": "true", onClick }, "Rainy");
  assert.equal(el.tag, "button");
  assert.equal(el.className, "chip");
  assert.equal(el.attrs["aria-pressed"], "true");
  assert.equal(el.listeners.click, onClick);
  assert.deepEqual(el.children, [{ text: "Rainy" }]);
});

test("h skips null, undefined and false children so conditional rendering is safe", () => {
  const doc = fakeDocument();
  const el = buildElement(doc, "div", {}, "a", null, undefined, false, ["b", "c"]);
  assert.deepEqual(el.children.map((c) => c.text), ["a", "b", "c"]);
});
