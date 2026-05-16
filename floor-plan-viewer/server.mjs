/**
 * Local analyze proxy for LM Studio (OpenAI-compatible API).
 * Env: LM_STUDIO_URL (default http://127.0.0.1:1234/v1), LM_STUDIO_MODEL, PORT (default 8787)
 */
import http from "http";
import { VISION_SYSTEM_PROMPT, VISION_USER_TEXT } from "./src/lib/visionPrompt.js";

var LM_BASE = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1";
var MODEL = process.env.LM_STUDIO_MODEL || "";
var PORT = parseInt(process.env.PORT || "8787", 10);
var LM_READ_TIMEOUT_MS = 36000 * 1000;

function json(res, status, body, headers) {
  var h = Object.assign(
    { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    headers || {}
  );
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      try {
        resolve(Buffer.concat(chunks).toString("utf8"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function lmChat(imageBase64, mimeType) {
  var url = LM_BASE.replace(/\/$/, "") + "/chat/completions";
  var body = {
    model: MODEL || "local-model",
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: VISION_USER_TEXT,
          },
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
    max_tokens: 120000,
    enable_thinking: false,
    chat_template_kwargs: { enable_thinking: false },
  };
  var r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LM_READ_TIMEOUT_MS),
  });
  if (!r.ok) {
    var t = await r.text();
    throw new Error("LM Studio: " + r.status + " " + t);
  }
  var data = await r.json();
  var txt = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!txt) throw new Error("No content from model");
  return txt;
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

var server = http.createServer(async function (req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/analyze") {
    try {
      var raw = await readBody(req);
      var payload = JSON.parse(raw || "{}");
      var b64 = payload.imageBase64;
      if (!b64) {
        json(res, 400, { error: "imageBase64 required" });
        return;
      }
      var mime = payload.mimeType || "image/png";
      var text = await lmChat(b64, mime);
      var parsed;
      try {
        parsed = JSON.parse(stripFence(text));
      } catch (e) {
        var m = stripFence(text).match(/\{[\s\S]*\}/);
        if (!m) throw e;
        parsed = JSON.parse(m[0]);
      }
      json(res, 200, parsed);
    } catch (e) {
      json(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, function () {
  console.log("Analyze proxy http://127.0.0.1:" + PORT + " -> LM " + LM_BASE);
});
