/**
 * Floor plan vision: Kimi (Fireworks), Gemini, analyze proxy, or LM Studio.
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
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  t = t.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "");
  t = t.replace(/<think[\s\S]*?<\/think>/gi, "");
  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  return t.trim();
}

/** @param {string} text */
function stripTrailingCommas(text) {
  return text.replace(/,\s*([}\]])/g, "$1");
}

/** @param {string} text */
function extractBalancedJson(text) {
  var start = text.indexOf("{");
  if (start < 0) return null;
  var depth = 0;
  var inStr = false;
  var esc = false;
  for (var i = start; i < text.length; i++) {
    var c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** @param {unknown} content */
function openAiContentToText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    var out = "";
    for (var i = 0; i < content.length; i++) {
      var p = content[i];
      if (p && typeof p === "object" && p.text) out += p.text;
      else if (typeof p === "string") out += p;
    }
    return out;
  }
  if (typeof content === "object" && content.text) return String(content.text);
  return "";
}

/** @param {object} message */
function messageTextCandidates(message) {
  var list = [];
  var main = openAiContentToText(message && message.content);
  if (main.trim()) list.push(main);
  var reasoning = message && (message.reasoning_content || message.reasoning);
  if (typeof reasoning === "string" && reasoning.trim() && reasoning !== main) {
    list.push(reasoning);
  }
  return list;
}

/**
 * @param {string} text
 * @returns {object}
 */
export function parseVisionJson(text) {
  var cleaned = stripFence(text);
  var brace = cleaned.indexOf("{");
  if (brace > 0) cleaned = cleaned.slice(brace);
  var attempts = [cleaned];
  var balanced = extractBalancedJson(cleaned);
  if (balanced && balanced !== cleaned) attempts.push(balanced);
  var lastErr;
  for (var a = 0; a < attempts.length; a++) {
    var candidate = stripTrailingCommas(attempts[a]);
    try {
      return JSON.parse(candidate);
    } catch (e1) {
      lastErr = e1;
    }
  }
throw lastErr;
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

function kimiApiKey() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_KIMI_API_KEY) ||
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREWORKS_API_KEY) ||
    (typeof window !== "undefined" && window.__KIMI_API_KEY__) ||
    ""
  );
}

function kimiModel() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_KIMI_MODEL) ||
    (typeof window !== "undefined" && window.__KIMI_MODEL__) ||
    "accounts/fireworks/models/kimi-k2p5"
  );
}

function fireworksBaseUrl() {
  var u =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FIREWORKS_BASE_URL) ||
    (typeof window !== "undefined" && window.__FIREWORKS_BASE_URL__) ||
    "https://api.fireworks.ai/inference/v1";
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

function openAiVisionBody(modelId, imageBase64, mimeType) {
  return {
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
    response_format: { type: "json_object" },
  };
}

function parseOpenAiChatCompletion(txt, label) {
  var data;
  try {
    data = JSON.parse(txt);
  } catch (e) {
    throw new Error(label + " returned non-JSON: " + txt.slice(0, 300));
  }
  var choice = data.choices && data.choices[0];
  var message = choice && choice.message;
  if (!message) throw new Error("No message from " + label);
  var candidates = messageTextCandidates(message);
if (!candidates.length) throw new Error("No message content from " + label);
  var lastErr;
  for (var i = 0; i < candidates.length; i++) {
    try {
      return parseVisionJson(candidates[i]);
    } catch (e) {
      lastErr = e;
    }
  }
  if (choice.finish_reason === "length") {
    throw new Error(
      label + " response was truncated (token limit). Try a smaller image or re-run."
    );
  }
  throw lastErr || new Error("Could not parse JSON from " + label);
}

/**
 * Kimi K2.x via Fireworks (OpenAI-compatible chat completions + vision).
 */
function analyzeViaKimi(imageBase64, mimeType) {
  var key = kimiApiKey();
  if (!key) {
    return Promise.reject(new Error("Set VITE_KIMI_API_KEY in .env"));
  }
  var url = fireworksBaseUrl() + "/chat/completions";
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify(openAiVisionBody(kimiModel(), imageBase64, mimeType)),
  }).then(function (r) {
    return r.text().then(function (txt) {
      if (!r.ok) throw new Error("Kimi: " + r.status + " " + txt.slice(0, 500));
      return parseOpenAiChatCompletion(txt, "Kimi");
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
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(openAiVisionBody(modelId, imageBase64, mimeType)),
  }).then(function (r) {
    return r.text().then(function (txt) {
      if (!r.ok) throw new Error("LM Studio: " + r.status + " " + txt.slice(0, 500));
      return parseOpenAiChatCompletion(txt, "LM Studio");
    });
  });
}

/**
 * Priority: Kimi (Fireworks) → Gemini → proxy → LM Studio.
 * @param {string} imageBase64 raw base64 (no data: prefix)
 * @param {string} mimeType
 */
export function analyzeFloorPlan(imageBase64, mimeType) {
  if (kimiApiKey()) {
    return analyzeViaKimi(imageBase64, mimeType);
  }
  if (geminiApiKey()) {
    return analyzeViaGemini(imageBase64, mimeType);
  }
  var proxy = analyzeApiUrl();
  if (proxy) {
    return analyzeViaProxy(imageBase64, mimeType, proxy);
  }
  var lm = lmStudioUrl();
  if (!lm) {
    return Promise.reject(
      new Error(
        "Set VITE_KIMI_API_KEY, VITE_GEMINI_API_KEY, VITE_LM_STUDIO_URL, or VITE_ANALYZE_API in .env"
      )
    );
  }
  return analyzeViaLmStudio(imageBase64, mimeType, lm, lmStudioModel());
}

/** @returns {"kimi"|"gemini"|"proxy"|"lm"|null} */
export function visionProvider() {
  if (kimiApiKey()) return "kimi";
  if (geminiApiKey()) return "gemini";
  if (analyzeApiUrl()) return "proxy";
  if (lmStudioUrl()) return "lm";
  return null;
}

/** Human-readable provider for toolbar status. */
export function visionProviderLabel() {
  var p = visionProvider();
  if (p === "kimi") return "Kimi " + kimiModel();
  if (p === "gemini") return "Gemini " + geminiModel();
  if (p === "proxy") return "analyze proxy";
  if (p === "lm") return "LM Studio " + lmStudioModel();
  return "not configured";
}

/** Message while the model is running. */
export function visionAnalyzingMessage() {
  var p = visionProvider();
  if (p === "kimi") return "LLM: analyzing with Kimi (" + kimiModel() + ")...";
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
