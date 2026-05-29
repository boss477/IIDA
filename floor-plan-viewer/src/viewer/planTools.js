import {
  formatDistanceMeters,
  normDeltaToMeters,
  polygonAreaSqMFromNorm,
  segmentLengthPx,
} from "../lib/calibration.js";
import { polygonArea, polygonBBox } from "../lib/geometry.js";
import { formatAreaFromSqM, formatLength } from "./plan3dMeasure.js";

export const FLOORING_OPTIONS = [
  { value: "wood", label: "Wood" },
  { value: "tile", label: "Bathroom / tile" },
  { value: "kitchen", label: "Kitchen / utility" },
  { value: "stone", label: "Balcony / stone" },
  { value: "plain", label: "Plain / neutral" },
];

export const WALL_COLOR_OPTIONS = [
  { value: "warm-white", label: "Warm white" },
  { value: "champagne", label: "Champagne" },
  { value: "desert-sand", label: "Desert sand" },
  { value: "warm-greige", label: "Warm greige" },
  { value: "soft-sage", label: "Soft sage" },
  { value: "eucalyptus", label: "Eucalyptus" },
  { value: "sea-mist", label: "Sea mist" },
  { value: "blush-rose", label: "Blush rose" },
  { value: "terracotta", label: "Terracotta" },
  { value: "deep-navy", label: "Deep navy" },
  { value: "midnight-teal", label: "Midnight teal" },
  { value: "charcoal-stone", label: "Charcoal stone" },
];

var WALL_COLOR_BY_TYPE = {
  bedroom: "blush-rose",
  living: "soft-sage",
  hall: "warm-greige",
  bathroom: "sea-mist",
  kitchen: "champagne",
  utility: "warm-greige",
  room: "warm-white",
};

/**
 * @param {object} room
 * @returns {string}
 */
export function resolveRoomWallColor(room) {
  if (!room) return "warm-white";
  if (room.wallColor) return String(room.wallColor);
  var type = String(room.type || "").toLowerCase();
  if (WALL_COLOR_BY_TYPE[type]) return WALL_COLOR_BY_TYPE[type];
  var name = String(room.name || "").toLowerCase();
  if (name.indexOf("bed") >= 0) return "blush-rose";
  if (name.indexOf("bath") >= 0) return "sea-mist";
  if (name.indexOf("living") >= 0 || name.indexOf("lounge") >= 0) return "soft-sage";
  if (name.indexOf("kitchen") >= 0) return "champagne";
  if (name.indexOf("hall") >= 0 || name.indexOf("passage") >= 0) return "warm-greige";
  return "warm-white";
}

/** @param {string} sourceId @param {number} segmentIndex */
export function wallSegmentKey(sourceId, segmentIndex) {
  return String(sourceId || "wall") + ":" + String(segmentIndex);
}

/** @param {object} data */
export function ensureWallSegmentColors(data) {
  if (!data) return {};
  if (!data.wallSegmentColors || typeof data.wallSegmentColors !== "object") {
    data.wallSegmentColors = {};
  }
  return data.wallSegmentColors;
}

/**
 * @param {object} data
 * @param {string} segmentKey
 * @param {object|null} room
 */
export function resolveWallSegmentColor(data, segmentKey, room) {
  var map = data && data.wallSegmentColors;
  if (map && map[segmentKey]) return map[segmentKey];
  return resolveRoomWallColor(room);
}

/**
 * @param {object} data
 * @param {string} segmentKey
 * @param {string} presetId
 */
export function setWallSegmentColor(data, segmentKey, presetId) {
  if (!data || !segmentKey || !presetId) return;
  ensureWallSegmentColors(data)[segmentKey] = presetId;
}

export const ROOM_PRESETS = [
  { id: "bedroom", label: "Bedroom", name: "BEDROOM", type: "bedroom", flooring: "wood" },
  { id: "hall", label: "Hall / passage", name: "HALL", type: "hall", flooring: "wood" },
  { id: "utility", label: "Utility", name: "UTILITY", type: "utility", flooring: "kitchen" },
  { id: "bathroom", label: "Bathroom", name: "BATHROOM", type: "bathroom", flooring: "tile" },
  { id: "living", label: "Living", name: "LIVING", type: "living", flooring: "wood" },
  { id: "kitchen", label: "Kitchen", name: "KITCHEN", type: "kitchen", flooring: "kitchen" },
  { id: "other", label: "Other", name: "ROOM", type: "room", flooring: "plain" },
];

const USER_SCALE_ID = "user-scale";

/**
 * @param {object} data
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} lengthM
 */
export function upsertCalibrationSegment(data, from, to, lengthM) {
  if (!data.calibration) {
    data.calibration = { unit: "m", segments: [] };
  }
  if (!Array.isArray(data.calibration.segments)) {
    data.calibration.segments = [];
  }
  var seg = {
    id: USER_SCALE_ID,
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    lengthM: lengthM,
  };
  var idx = data.calibration.segments.findIndex(function (s) {
    return s && s.id === USER_SCALE_ID;
  });
  if (idx >= 0) data.calibration.segments[idx] = seg;
  else data.calibration.segments.push(seg);
}

/**
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{ metersPerPixel: number }|null} calibrationState
 * @returns {{ meters: number|null, pixels: number, label: string }}
 */
export function computeMeasure(from, to, naturalWidth, naturalHeight, calibrationState) {
  var pixels = segmentLengthPx(from, to, naturalWidth, naturalHeight);
  if (calibrationState && calibrationState.metersPerPixel) {
    var meters = normDeltaToMeters(
      to.x - from.x,
      to.y - from.y,
      naturalWidth,
      naturalHeight,
      calibrationState.metersPerPixel
    );
    return {
      meters: meters,
      pixels: pixels,
      label: formatDistanceMeters(meters),
    };
  }
  return {
    meters: null,
    pixels: pixels,
    label: pixels.toFixed(1) + " px (set scale for meters)",
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}}
 */
export function clampNorm(x, y) {
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

/**
 * @param {Array<{x:number,y:number}>} poly
 * @returns {{x:number,y:number}}
 */
export function polygonCentroidNorm(poly) {
  if (!poly || !poly.length) return { x: 0.5, y: 0.5 };
  var area = 0;
  var cx = 0;
  var cy = 0;
  for (var i = 0, n = poly.length; i < n; i++) {
    var j = (i + 1) % n;
    var cross = poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    area += cross;
    cx += (poly[i].x + poly[j].x) * cross;
    cy += (poly[i].y + poly[j].y) * cross;
  }
  if (Math.abs(area) < 1e-12) {
    var sx = 0;
    var sy = 0;
    poly.forEach(function (p) {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / poly.length, y: sy / poly.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{ metersPerPixel: number }|null} calibrationState
 */
export function formatAreaLabel(poly, naturalWidth, naturalHeight, calibrationState) {
  if (!poly || poly.length < 3) return "—";
  if (calibrationState && calibrationState.metersPerPixel && naturalWidth && naturalHeight) {
    var sqM = polygonAreaSqMFromNorm(
      poly,
      naturalWidth,
      naturalHeight,
      calibrationState.metersPerPixel
    );
    return formatAreaFromSqM(sqM);
  }
  var apx = polygonArea(poly) * naturalWidth * naturalHeight;
  return Math.round(apx) + " px² · set scale for m²";
}

/**
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{ metersPerPixel: number }|null} calibrationState
 * @returns {string|null}
 */
export function formatRoomDimensions(poly, naturalWidth, naturalHeight, calibrationState) {
  if (!poly || poly.length < 3) return null;
  if (!calibrationState || !calibrationState.metersPerPixel) return null;
  var bbox = polygonBBox(poly);
  var mpp = calibrationState.metersPerPixel;
  var w = (bbox.maxX - bbox.minX) * naturalWidth * mpp;
  var h = (bbox.maxY - bbox.minY) * naturalHeight * mpp;
  return formatLength(w) + " × " + formatLength(h);
}

/**
 * Dimension + area strings for labels, tooltips, and badges.
 * @param {object} room
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {{ metersPerPixel: number }|null} calibrationState
 * @returns {{ dimLine: string|null, areaLine: string|null }}
 */
export function getRoomMeasurementDisplay(room, naturalWidth, naturalHeight, calibrationState) {
  if (!room) return { dimLine: null, areaLine: null };

  var dimLine =
    room.dimensionsText != null && room.dimensionsText !== ""
      ? String(room.dimensionsText)
      : room.dimensions != null && room.dimensions !== ""
        ? String(room.dimensions)
        : null;
  var areaLine = null;

  if (room.polygon && room.polygon.length >= 3 && naturalWidth && naturalHeight) {
    if (calibrationState && calibrationState.metersPerPixel) {
      var computed = formatRoomDimensions(
        room.polygon,
        naturalWidth,
        naturalHeight,
        calibrationState
      );
      if (computed) dimLine = computed;
      var area = formatAreaLabel(room.polygon, naturalWidth, naturalHeight, calibrationState);
      if (area && area !== "—") areaLine = area;
    }
  }

  if (!areaLine && room.areaSqFt != null && isFinite(room.areaSqFt)) {
    areaLine = "~" + room.areaSqFt + " sq ft";
  }

  if (!dimLine && room.polygon && room.polygon.length >= 3 && naturalWidth && naturalHeight) {
    var bbox = polygonBBox(room.polygon);
    var wPx = Math.round((bbox.maxX - bbox.minX) * naturalWidth);
    var hPx = Math.round((bbox.maxY - bbox.minY) * naturalHeight);
    if (wPx > 0 && hPx > 0) {
      dimLine = wPx + " × " + hPx + " px";
      if (!calibrationState || !calibrationState.metersPerPixel) {
        dimLine += " (set scale for meters)";
      }
    }
    if (!areaLine) {
      var pxArea = formatAreaLabel(room.polygon, naturalWidth, naturalHeight, null);
      if (pxArea && pxArea !== "—") areaLine = pxArea;
    }
  }

  return { dimLine: dimLine, areaLine: areaLine };
}

/**
 * @param {Array<object>} rooms
 * @param {string} baseId
 */
export function nextRoomId(rooms, baseId) {
  var n = 1;
  var used = {};
  (rooms || []).forEach(function (r) {
    if (r && r.id) used[r.id] = true;
  });
  while (used[baseId + "-" + n]) n++;
  return baseId + "-" + n;
}

/**
 * @param {Array<object>} rooms
 * @param {string} presetId
 * @param {Array<{x:number,y:number}>} polygon
 */
export function createRoomFromPreset(rooms, presetId, polygon) {
  var preset =
    ROOM_PRESETS.find(function (p) {
      return p.id === presetId;
    }) || ROOM_PRESETS[ROOM_PRESETS.length - 1];
  var id = nextRoomId(rooms, preset.id);
  var suffix = id.indexOf("-") >= 0 ? id.split("-").pop() : "";
  var name =
    suffix && suffix !== "1" ? preset.name + "-" + suffix : preset.name;
  return {
    id: id,
    name: name,
    type: preset.type,
    flooring: preset.flooring,
    polygon: polygon.map(function (p) {
      return { x: p.x, y: p.y };
    }),
    labelPoint: polygonCentroidNorm(polygon),
  };
}

function distPointToSegmentNorm(px, py, ax, ay, bx, by) {
  var dx = bx - ax;
  var dy = by - ay;
  var lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-14) return Math.hypot(px - ax, py - ay);
  var t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  var qx = ax + t * dx;
  var qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/**
 * @param {{x:number,y:number}} pt
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} thresholdNorm
 * @returns {number|null} insert index (vertex after which to splice)
 */
export function findEdgeInsertIndex(pt, poly, thresholdNorm) {
  if (!poly || poly.length < 2) return null;
  var bestDist = thresholdNorm;
  var bestIdx = null;
  for (var i = 0; i < poly.length; i++) {
    var j = (i + 1) % poly.length;
    var d = distPointToSegmentNorm(pt.x, pt.y, poly[i].x, poly[i].y, poly[j].x, poly[j].y);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = j;
    }
  }
  return bestIdx;
}

/**
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} thresholdNorm
 */
export function isNearPoint(a, b, thresholdNorm) {
  return Math.hypot(a.x - b.x, a.y - b.y) < thresholdNorm;
}

/**
 * Wall polylines from room polygons (closed outline).
 * @param {Array<object>} rooms
 */
export function wallSourceFromRooms(rooms) {
  return (rooms || [])
    .filter(function (r) {
      return r.polygon && r.polygon.length >= 3;
    })
    .map(function (r) {
      var poly = r.polygon.map(function (p) {
        return { x: p.x, y: p.y };
      });
      if (
        poly.length &&
        (poly[0].x !== poly[poly.length - 1].x || poly[0].y !== poly[poly.length - 1].y)
      ) {
        poly.push({ x: poly[0].x, y: poly[0].y });
      }
      return {
        id: "wall-from-" + (r.id || r.name || "room"),
        points: poly,
        thickness: 0.006,
      };
    });
}

/**
 * Copy room outlines into data.walls when empty so wall tools can edit them.
 * @param {{ walls?: Array<object>, rooms?: Array<object> }} data
 */
export function ensureEditableWalls(data) {
  if (!data.walls) data.walls = [];
  if (data.walls.length === 0 && data.rooms && data.rooms.length) {
    data.walls = wallSourceFromRooms(data.rooms);
  }
}

/**
 * @param {Array<object>} walls
 */
export function nextWallId(walls) {
  var n = 1;
  var used = {};
  (walls || []).forEach(function (w) {
    if (w && w.id) used[w.id] = true;
  });
  while (used["wall-" + n]) n++;
  return "wall-" + n;
}

/**
 * @param {Array<object>} walls
 * @param {Array<{x:number,y:number}>} points
 */
export function createWallFromPoints(walls, points) {
  return {
    id: nextWallId(walls),
    points: points.map(function (p) {
      return { x: p.x, y: p.y };
    }),
    thickness: 0.006,
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<object>} walls
 * @param {number} thresholdNorm
 */
export function pickWallAtNorm(x, y, walls, thresholdNorm) {
  var best = null;
  var bestDist = thresholdNorm;
  (walls || []).forEach(function (wall) {
    var pts = wall.points;
    if (!pts || pts.length < 2) return;
    for (var i = 0; i < pts.length - 1; i++) {
      var d = distPointToSegmentNorm(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < bestDist) {
        bestDist = d;
        best = wall;
      }
    }
  });
  return best;
}

/**
 * Insert point on open polyline edge (walls).
 * @param {{x:number,y:number}} pt
 * @param {Array<{x:number,y:number}>} points
 * @param {number} thresholdNorm
 */
export function findWallEdgeInsertIndex(pt, points, thresholdNorm) {
  if (!points || points.length < 2) return null;
  var bestDist = thresholdNorm;
  var bestIdx = null;
  for (var i = 0; i < points.length - 1; i++) {
    var d = distPointToSegmentNorm(
      pt.x,
      pt.y,
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y
    );
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i + 1;
    }
  }
  return bestIdx;
}
