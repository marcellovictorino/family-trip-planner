export function buildElement(doc, tag, attrs = {}, ...children) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(doc, el, children);
  return el;
}

function append(doc, el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(doc, el, child);
    else if (typeof child === "object") el.append(child);
    else el.append(doc.createTextNode(String(child)));
  }
}

export const h = (tag, attrs, ...children) => buildElement(document, tag, attrs, ...children);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
