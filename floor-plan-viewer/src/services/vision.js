/**
 * Floor plan vision: local LM Studio (OpenAI-compatible) or analyze proxy.
 */
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
  var brace = cleaned.indexOf("{");
  if (brace > 0) cleaned = cleaned.slice(brace);
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    var m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw e1;
  }
}

function lmStudioUrl() {
  var u =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_LM_STUDIO_URL) ||
    (typeof window !== "undefined" && window.__LM_STUDIO_URL__) ||
    "";
  return String(u).replace(/\/$/, "");
}

function lmStudioModel() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_LM_STUDIO_MODEL) ||
    (typeof window !== "undefined" && window.__LM_STUDIO_MODEL__) ||
    "local-model"
  );
}

function analyzeApiUrl() {
  var u =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_ANALYZE_API) ||
    (typeof window !== "undefined" && window.__ANALYZE_API__) ||
    "";
  return String(u).replace(/\/$/, "");
}

function geminiApiKey() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
    (typeof window !== "undefined" && window.__GEMINI_API_KEY__) ||
    ""
  );
}

function geminiModel() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_MODEL) ||
    (typeof window !== "undefined" && window.__GEMINI_MODEL__) ||
    "gemini-3-flash-preview"
  );
}

function analyzeViaGemini(imageBase64, mimeType) {
  var key = geminiApiKey();
  if (!key) {
    return Promise.reject(new Error("Set VITE_GEMINI_API_KEY in .env"));
  }
  var model = geminiModel();
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(key);

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: VISION_SYSTEM_PROMPT + "\n\n" + VISION_USER_TEXT },
            {
              inline_data: {
                mime_type: mimeType || "image/png",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  }).then(function (r) {
    return r.text().then(function (txt) {
      if (!r.ok) throw new Error("Gemini: " + r.status + " " + txt.slice(0, 500));
      var data;
      try {
        data = JSON.parse(txt);
      } catch (e) {
        throw new Error("Gemini returned non-JSON: " + txt.slice(0, 300));
      }
      var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      var text = "";
      if (parts) {
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].text) text += parts[i].text;
        }
      }
      if (!text) throw new Error("No text from Gemini");
      return parseVisionJson(text);
    });
  });
}

/**
 * @param {string} imageBase64
 * @param {string} mimeType
 * @param {string} baseUrl proxy base e.g. http://127.0.0.1:8787
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
 * @param {string} imageBase64
 * @param {string} mimeType
 * @param {string} baseUrl LM OpenAI base e.g. http://127.0.0.1:1234/v1
 * @param {string} modelId
 */
function analyzeViaLmStudio(imageBase64, mimeType, baseUrl, modelId) {
  var url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  var body = {
    model: modelId,
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: VISION_USER_TEXT },
          {
            type: "image_url",
            image_url: {
              url: "data:" + (mimeType || "image/png") + ";base64," + imageBase64,
            },
          },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  };

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (txt) {
      if (!r.ok) throw new Error("LM Studio: " + r.status + " " + txt.slice(0, 500));
      var data;
      try {
        data = JSON.parse(txt);
      } catch (e) {
        throw new Error("LM Studio returned non-JSON: " + txt.slice(0, 300));
      }
      var choice = data.choices && data.choices[0] && data.choices[0].message;
      var content = choice && choice.content;
      if (!content) throw new Error("No message content from model");
      return parseVisionJson(content);
    });
  });
}

/**
 * Priority: proxy → Gemini → LM Studio.
 * @param {string} imageBase64 raw base64 (no data: prefix)
 * @param {string} mimeType
 */
export function analyzeFloorPlan(imageBase64, mimeType) {
  var proxy = analyzeApiUrl();
  if (proxy) {
    return analyzeViaProxy(imageBase64, mimeType, proxy);
  }
  if (geminiApiKey()) {
    return analyzeViaGemini(imageBase64, mimeType);
  }
  var lm = lmStudioUrl();
  if (!lm) {
    return Promise.reject(
      new Error(
        "Set VITE_GEMINI_API_KEY, or VITE_LM_STUDIO_URL + VITE_LM_STUDIO_MODEL, or VITE_ANALYZE_API in .env"
      )
    );
  }
  return analyzeViaLmStudio(imageBase64, mimeType, lm, lmStudioModel());
}

/** @returns {"proxy"|"gemini"|"lm"|null} */
export function visionProvider() {
  if (analyzeApiUrl()) return "proxy";
  if (geminiApiKey()) return "gemini";
  if (lmStudioUrl()) return "lm";
  return null;
}

/** Human-readable provider for toolbar status. */
export function visionProviderLabel() {
  var p = visionProvider();
  if (p === "gemini") return "Gemini " + geminiModel();
  if (p === "proxy") return "analyze proxy";
  if (p === "lm") return "LM Studio " + lmStudioModel();
  return "not configured";
}

/** Message while the model is running. */
export function visionAnalyzingMessage() {
  var p = visionProvider();
  if (p === "gemini") return "LLM: analyzing with Gemini (" + geminiModel() + ")...";
  if (p === "proxy") return "LLM: analyzing via proxy...";
  if (p === "lm") return "LLM: analyzing with LM Studio...";
  return "LLM: analyzing...";
}

/**
 * True if auto-run on file open is configured.
 */
export function isVisionConfigured() {
  return !!visionProvider();
}
