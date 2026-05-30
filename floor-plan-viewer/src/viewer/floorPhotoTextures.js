/**
 * Drafted-style floor PNG patterns for 2D SVG room fills.
 * Textures live in public/textures/ (see scripts/generate-drafted-floor-textures.py).
 */

const NS = "http://www.w3.org/2000/svg";

/** @type {{ id: string, href: string, pw: number, ph: number }[]} */
export var DRAFTED_FLOOR_PATTERNS = [
  { id: "photo-wood-floor", href: "/textures/drafted-wood-plank.png", pw: 72, ph: 72 },
  { id: "photo-tile-floor", href: "/textures/drafted-marble-tile.png", pw: 64, ph: 64 },
  { id: "photo-kitchen-floor", href: "/textures/drafted-kitchen-tile.png", pw: 56, ph: 56 },
  { id: "photo-stone-floor", href: "/textures/drafted-concrete.png", pw: 80, ph: 80 },
  { id: "photo-outdoor-floor", href: "/textures/drafted-outdoor-stone.png", pw: 72, ph: 72 },
  { id: "photo-carpet", href: "/textures/drafted-carpet.png", pw: 48, ph: 48 },
];

function svgEl(tag) {
  return document.createElementNS(NS, tag);
}

function addImagePattern(defs, spec) {
  if (defs.querySelector("#" + spec.id)) return;
  var pat = svgEl("pattern");
  pat.setAttribute("id", spec.id);
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("width", String(spec.pw));
  pat.setAttribute("height", String(spec.ph));
  var img = svgEl("image");
  img.setAttribute("href", spec.href);
  img.setAttribute("width", String(spec.pw));
  img.setAttribute("height", String(spec.ph));
  img.setAttribute("preserveAspectRatio", "none");
  pat.appendChild(img);
  defs.appendChild(pat);
}

/**
 * @param {SVGDefsElement} defs
 */
export function ensurePhotoFloorPatterns(defs) {
  if (!defs || defs.getAttribute("data-photo-floor-patterns") === "1") return;
  DRAFTED_FLOOR_PATTERNS.forEach(function (spec) {
    addImagePattern(defs, spec);
  });
  defs.setAttribute("data-photo-floor-patterns", "1");
}

/**
 * @param {string|null|undefined} activeId
 * @param {object} room
 */
export function roomMatchesActive(activeId, room) {
  if (!activeId || !room) return false;
  var key = room.id || room.name || "";
  return activeId === key || activeId === room.id || activeId === room.name;
}

/**
 * @param {object} room
 * @returns {string}
 */
export function photoPatternForRoom(room) {
  var flooring = String(room.flooring || "").toLowerCase();
  var name = String(room.type || room.name || "").toLowerCase();
  if (flooring === "carpet") return "url(#photo-carpet)";
  if (
    flooring === "stone" ||
    name.indexOf("garage") >= 0 ||
    name.indexOf("utility") >= 0
  ) {
    return "url(#photo-stone-floor)";
  }
  if (
    name.indexOf("balcon") >= 0 ||
    name.indexOf("patio") >= 0 ||
    name.indexOf("outdoor") >= 0 ||
    name.indexOf("terrace") >= 0 ||
    name.indexOf("porch") >= 0
  ) {
    return "url(#photo-outdoor-floor)";
  }
  if (flooring === "tile" || name.indexOf("bath") >= 0) return "url(#photo-tile-floor)";
  if (
    name.indexOf("kitchen") >= 0 ||
    name.indexOf("pantry") >= 0 ||
    name.indexOf("laundry") >= 0
  ) {
    return "url(#photo-kitchen-floor)";
  }
  return "url(#photo-wood-floor)";
}

/**
 * @param {object} room
 */
export function photoBaseColorForRoom(room) {
  var pattern = photoPatternForRoom(room);
  if (pattern.indexOf("photo-tile-floor") >= 0) return "#eef4f8";
  if (pattern.indexOf("photo-kitchen-floor") >= 0) return "#f5f5f0";
  if (pattern.indexOf("photo-stone-floor") >= 0) return "#c8c8c8";
  if (pattern.indexOf("photo-outdoor-floor") >= 0) return "#e0ddd5";
  if (pattern.indexOf("photo-carpet") >= 0) return "#e8dfd2";
  return "#e8e0d5";
}
