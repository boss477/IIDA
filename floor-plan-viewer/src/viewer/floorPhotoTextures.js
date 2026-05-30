/**
 * Photo-style seamless floor tiles for 2D SVG room fills (Drafted-like).
 * Generated once on canvas, cached as data URLs, embedded in SVG patterns.
 */

const NS = "http://www.w3.org/2000/svg";
const _dataUrlCache = {};

function canvasDataUrl(key, width, height, draw) {
  if (_dataUrlCache[key]) return _dataUrlCache[key];
  var cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  draw(cv.getContext("2d"), width, height);
  _dataUrlCache[key] = cv.toDataURL("image/png");
  return _dataUrlCache[key];
}

function svgEl(tag) {
  return document.createElementNS(NS, tag);
}

function addImagePattern(defs, id, dataUrl, pw, ph) {
  if (defs.querySelector("#" + id)) return;
  var pat = svgEl("pattern");
  pat.setAttribute("id", id);
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("width", String(pw));
  pat.setAttribute("height", String(ph));
  var img = svgEl("image");
  img.setAttribute("href", dataUrl);
  img.setAttribute("width", String(pw));
  img.setAttribute("height", String(ph));
  img.setAttribute("preserveAspectRatio", "none");
  pat.appendChild(img);
  defs.appendChild(pat);
}

function drawWoodPlanks(ctx, w, h) {
  var plankW = Math.max(14, Math.round(w / 5));
  ctx.fillStyle = "#ebe0d0";
  ctx.fillRect(0, 0, w, h);
  for (var x = 0; x < w; x += plankW) {
    var tone = 228 + Math.sin(x * 0.31) * 8 + Math.cos(h * 0.02) * 4;
    var r = tone;
    var g = tone - 12;
    var b = tone - 28;
    ctx.fillStyle = "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
    ctx.fillRect(x, 0, plankW - 1, h);
    ctx.strokeStyle = "rgba(120, 90, 60, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
    for (var y = 0; y < h; y += 3) {
      var gOff = Math.sin(y * 0.08 + x * 0.05) * 1.2;
      ctx.strokeStyle = "rgba(80, 55, 35, " + (0.04 + Math.abs(Math.sin(y * 0.02 + x)) * 0.03) + ")";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + plankW - 3, y + gOff);
      ctx.stroke();
    }
  }
  for (var n = 0; n < w * h * 0.002; n++) {
    ctx.fillStyle = "rgba(0,0,0," + (Math.random() * 0.04) + ")";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawMarbleTile(ctx, w, h) {
  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(0, 0, w, h);
  var tile = Math.round(w / 4);
  for (var ty = 0; ty < h; ty += tile) {
    for (var tx = 0; tx < w; tx += tile) {
      var v = Math.sin(tx * 0.07) * Math.cos(ty * 0.09) * 6;
      ctx.fillStyle = "rgb(" + Math.round(244 + v) + "," + Math.round(246 + v) + "," + Math.round(250 + v) + ")";
      ctx.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
    }
  }
  ctx.strokeStyle = "rgba(180, 195, 210, 0.55)";
  ctx.lineWidth = 1;
  for (var i = 0; i <= w; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#b8c4d0";
  ctx.lineWidth = 1.2;
  for (var v = 0; v < 6; v++) {
    ctx.beginPath();
    var sx = Math.random() * w;
    var sy = Math.random() * h;
    ctx.moveTo(sx, sy);
    for (var s = 0; s < 5; s++) {
      ctx.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 40);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawKitchenTile(ctx, w, h) {
  ctx.fillStyle = "#faf3e4";
  ctx.fillRect(0, 0, w, h);
  var tile = Math.round(w / 4);
  for (var ky = 0; ky < h; ky += tile) {
    for (var kx = 0; kx < w; kx += tile) {
      var kv = ((kx + ky) % (tile * 2) === 0) ? 4 : -2;
      ctx.fillStyle = "rgb(" + (250 + kv) + "," + (243 + kv) + "," + (228 + kv) + ")";
      ctx.fillRect(kx + 1, ky + 1, tile - 2, tile - 2);
    }
  }
  ctx.strokeStyle = "rgba(210, 190, 150, 0.5)";
  ctx.lineWidth = 1;
  for (var gi = 0; gi <= w; gi += tile) {
    ctx.beginPath();
    ctx.moveTo(gi, 0);
    ctx.lineTo(gi, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, gi);
    ctx.lineTo(w, gi);
    ctx.stroke();
  }
}

function drawConcrete(ctx, w, h) {
  ctx.fillStyle = "#b8bcc2";
  ctx.fillRect(0, 0, w, h);
  for (var c = 0; c < w * h * 0.008; c++) {
    var a = Math.random() * 0.12;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255," + a + ")" : "rgba(0,0,0," + a + ")";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.globalAlpha = 0.15;
  for (var s = 0; s < 8; s++) {
    ctx.fillStyle = "#a0a4aa";
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 8 + Math.random() * 12, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCarpet(ctx, w, h) {
  ctx.fillStyle = "#e8dfd2";
  ctx.fillRect(0, 0, w, h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var n = Math.sin(x * 0.9) * Math.cos(y * 0.7) * 0.5 + Math.random() * 0.5;
      var t = 232 + n * 8;
      ctx.fillStyle = "rgb(" + Math.round(t) + "," + Math.round(t - 6) + "," + Math.round(t - 14) + ")";
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** @typedef {{ id: string, url: string, pw: number, ph: number }} PhotoPatternSpec */

/** @returns {PhotoPatternSpec[]} */
export function getPhotoPatternSpecs() {
  return [
    {
      id: "photo-wood-floor",
      url: canvasDataUrl("wood", 256, 512, drawWoodPlanks),
      pw: 64,
      ph: 128,
    },
    {
      id: "photo-tile-floor",
      url: canvasDataUrl("marble", 256, 256, drawMarbleTile),
      pw: 64,
      ph: 64,
    },
    {
      id: "photo-kitchen-floor",
      url: canvasDataUrl("kitchen", 256, 256, drawKitchenTile),
      pw: 64,
      ph: 64,
    },
    {
      id: "photo-stone-floor",
      url: canvasDataUrl("concrete", 256, 256, drawConcrete),
      pw: 80,
      ph: 80,
    },
    {
      id: "photo-carpet",
      url: canvasDataUrl("carpet", 128, 128, drawCarpet),
      pw: 48,
      ph: 48,
    },
  ];
}

/**
 * Inject photo SVG patterns into defs (idempotent).
 * @param {SVGDefsElement} defs
 */
export function ensurePhotoFloorPatterns(defs) {
  if (!defs || defs.getAttribute("data-photo-floor-patterns") === "1") return;
  getPhotoPatternSpecs().forEach(function (spec) {
    addImagePattern(defs, spec.id, spec.url, spec.pw, spec.ph);
  });
  defs.setAttribute("data-photo-floor-patterns", "1");
}

/**
 * @param {object} room
 * @returns {string}
 */
export function photoPatternForRoom(room) {
  var flooring = String(room.flooring || "").toLowerCase();
  var name = String(room.type || room.name || "").toLowerCase();
  if (flooring === "carpet") return "url(#photo-carpet)";
  if (flooring === "stone" || name.indexOf("garage") >= 0) return "url(#photo-stone-floor)";
  if (flooring === "tile" || name.indexOf("bath") >= 0) return "url(#photo-tile-floor)";
  if (name.indexOf("kitchen") >= 0 || name.indexOf("pantry") >= 0 || name.indexOf("laundry") >= 0) {
    return "url(#photo-kitchen-floor)";
  }
  if (
    flooring === "wood" ||
    name.indexOf("bed") >= 0 ||
    name.indexOf("living") >= 0 ||
    name.indexOf("dining") >= 0 ||
    name.indexOf("hall") >= 0 ||
    name.indexOf("foyer") >= 0 ||
    name.indexOf("office") >= 0 ||
    name.indexOf("great") >= 0 ||
    name.indexOf("porch") >= 0
  ) {
    return "url(#photo-wood-floor)";
  }
  return "url(#photo-wood-floor)";
}
