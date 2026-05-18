import { polygonBBox } from "./geometry.js";

/**
 * Exterior shell aspect ratio (width / height) from walls[].
 * @param {Array<object>} walls
 * @returns {number|null}
 */
export function shellAspectRatio(walls) {
  var list = walls || [];
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var w = list[i];
    if (!w.points || w.points.length < 3) continue;
    var role = String(w.role || "").toLowerCase();
    if (role === "exterior") {
      best = w;
      break;
    }
    if (!best || w.points.length > best.points.length) best = w;
  }
  if (!best) return null;
  var bbox = polygonBBox(best.points);
  var bw = bbox.maxX - bbox.minX;
  var bh = bbox.maxY - bbox.minY;
  if (bh < 1e-6) return null;
  return bw / bh;
}

/**
 * @param {object} data normalized analysis
 * @returns {{ boxCount: number, roomCount: number }}
 */
export function countBoxRooms(data) {
  var rooms = data.rooms || [];
  var boxCount = rooms.filter(function (r) {
    return r.polygon && r.polygon.length === 4;
  }).length;
  return { boxCount: boxCount, roomCount: rooms.length };
}

/**
 * @param {object} data normalized analysis
 * @param {number} imageWidth natural pixels
 * @param {number} imageHeight natural pixels
 * @returns {{ blocking: string|null, warnings: string[] }}
 */
export function validateAnalysis(data, imageWidth, imageHeight) {
  var warnings = [];
  var blocking = null;
  var rooms = data.rooms || [];
  var walls = data.walls || [];

  if (!walls.length) {
    blocking =
      "walls[] is empty — structural walls are required (wall layer will not be drawn). Re-analyze or add walls in JSON.";
  }

  var boxInfo = countBoxRooms(data);
  if (boxInfo.roomCount > 3 && boxInfo.boxCount > 0) {
    warnings.push(
      boxInfo.boxCount +
        " room(s) have only 4 polygon points (likely bounding boxes). Use Edit vertices or Add room to refine, or re-analyze."
    );
  }

  if (imageWidth > 0 && imageHeight > 0 && walls.length) {
    var shellAr = shellAspectRatio(walls);
    if (shellAr != null) {
      var imgAr = imageWidth / imageHeight;
      var relDiff = Math.abs(shellAr - imgAr) / Math.max(imgAr, 1e-6);
      if (relDiff > 0.4) {
        warnings.push(
          "Shell aspect ratio (" +
            shellAr.toFixed(2) +
            ") differs from image (" +
            imgAr.toFixed(2) +
            ") by " +
            Math.round(relDiff * 100) +
            "% — check scale or re-analyze."
        );
      }
    }
  }

  return { blocking: blocking, warnings: warnings };
}

/** @deprecated use validateAnalysis().blocking */
export function validateAnalysisMessage(data, imageWidth, imageHeight) {
  var r = validateAnalysis(data, imageWidth, imageHeight);
  if (r.blocking) return r.blocking;
  return r.warnings.length ? r.warnings.join(" ") : null;
}
