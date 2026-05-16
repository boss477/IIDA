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
  return escapeUnescapedInnerQuotes(t);
}

function escapeUnescapedInnerQuotes(text) {
  var out = [];
  var inString = false;
  var escaped = false;
  var n = text.length;

  for (var i = 0; i < n; i++) {
    var ch = text[i];
    if (escaped) {
      out.push(ch);
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      out.push(ch);
      escaped = inString;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        out.push(ch);
        continue;
      }

      var j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      var nextCh = j < n ? text[j] : "";
      if (nextCh === ":" || nextCh === "," || nextCh === "}" || nextCh === "]" || nextCh === "") {
        inString = false;
        out.push(ch);
      } else {
        out.push('\\"');
      }
      continue;
    }

    out.push(ch);
  }

  return out.join("");
}
