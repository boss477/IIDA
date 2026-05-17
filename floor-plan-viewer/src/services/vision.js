/**
 * Floor plan vision: Flask /api/analyze proxy (Fireworks Kimi on server).
 */
import { repairJsonText } from "../lib/jsonRepair.js";
import { VISION_SYSTEM_PROMPT, VISION_USER_TEXT } from "../lib/visionPrompt.js";

/**
 * @param {File} file
 * @returns {Promise<{ imageBase64: string, mimeType: string }>}
 */
export function fileToImageBase64(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () {
      var dataUrl = String(r.result || "");
      var m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        reject(new Error("Could not read image as base64"));
        return;
      }
      resolve({ mimeType: m[1] || "image/png", imageBase64: m[2] });
    };
    r.onerror = function () {
      reject(new Error("FileReader failed"));
    };
    r.readAsDataURL(file);
  });
}

function stripFence(s) {
  var t = String(s).trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  t = t.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "");
  t = t.replace(/<think[\s\S]*?<\/think>/gi, "");
  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  return t.trim();
}

/**
 * @param {string} text
 * @returns {object}
 */
export function parseVisionJson(text) {
  var cleaned = stripFence(text);
  var candidates = [cleaned, repairJsonText(cleaned)];
  var lastErr = null;
  for (var i = 0; i < candidates.length; i++) {
    try {
      return JSON.parse(candidates[i]);
    } catch (e1) {
      lastErr = e1;
    }
  }
  var m = cleaned.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(repairJsonText(m[0]));
  throw lastErr || new Error("Invalid JSON from model");
}

function analyzeApiUrl() {
  var u =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_ANALYZE_API) ||
    (typeof window !== "undefined" && window.__ANALYZE_API__) ||
    "";
  return String(u).replace(/\/$/, "");
}

/**
 * @param {string} imageBase64
 * @param {string} mimeType
 * @param {string} baseUrl proxy base e.g. http://127.0.0.1:5173
 */
function analyzeViaProxy(imageBase64, mimeType, baseUrl) {
  return fetch(baseUrl + "/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: imageBase64,
      mimeType: mimeType || "image/png",
    }),
  }).then(function (r) {
    return r.json().then(function (body) {
      if (!r.ok) throw new Error((body && body.error) || "Analyze failed: " + r.status);
      if (body && body.error) throw new Error(String(body.error));
      return body;
    });
  });
}

/**
 * @param {string} imageBase64 raw base64 (no data: prefix)
 * @param {string} mimeType
 */
export function analyzeFloorPlan(imageBase64, mimeType) {
  var proxy = analyzeApiUrl();
  if (!proxy) {
    return Promise.reject(
      new Error("Vision not configured. Run npm start (Flask injects __ANALYZE_API__) or set VITE_ANALYZE_API.")
    );
  }
  return analyzeViaProxy(imageBase64, mimeType, proxy);
}

/**
 * True if auto-run on file open is configured.
 */
export function isVisionConfigured() {
  return !!analyzeApiUrl();
}

// Kept for any direct imports; server uses Fireworks via proxy only.
export { VISION_SYSTEM_PROMPT, VISION_USER_TEXT };
