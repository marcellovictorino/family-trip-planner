// Parsing helpers for untrusted model output. Kept in their own module so they
// can be tested without executing the generator's top-level script body.

// `claude -p --output-format json` wraps the reply in an envelope whose `result`
// field holds the model's text. Fall back to treating stdout as the text itself,
// so swapping in a backend that prints raw text still works.
export function extractText(stdout) {
  try {
    const envelope = JSON.parse(stdout);
    if (typeof envelope?.result === "string") return envelope.result;
  } catch { /* not an envelope */ }
  return stdout;
}

// Scan out exactly one balanced JSON value, ignoring anything before or after
// it. A model will sometimes append a stray remark after otherwise valid JSON
// ("Wait, fix typo."), which slicing to end-of-string would feed to JSON.parse.
// String and escape handling matters: a brace inside a quoted value must not
// change the nesting depth.
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in response");

  const closing = { "{": "}", "[": "]" };
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{" || char === "[") stack.push(closing[char]);
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) throw new Error(`mismatched ${char} at position ${i}`);
      if (stack.length === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("unterminated JSON in response");
}
