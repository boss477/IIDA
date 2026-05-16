/**
 * Best-effort repair for truncated or slightly invalid JSON from LLMs.
 * @param {string} text
 * @returns {string}
 */
export function repairJsonText(text) {
  var t = String(text || "").trim();
  t = t.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  var start = t.indexOf("{");
  if (start > 0) t = t.slice(start);
  var end = t.lastIndexOf("}");
  if (end > 0) t = t.slice(0, end + 1);
  return t;
}
