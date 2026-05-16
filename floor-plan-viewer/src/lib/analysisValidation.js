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
 * @param {number} imageWidth natural pixels
 * @param {number} imageHeight natural pixels
 * @returns {string|null} error message or null if valid
 */
export function validateAnalysis(data, imageWidth, imageHeight) {
  var errors = [];
  var rooms = data.rooms || [];
  var walls = data.walls || [];

  if (!walls.length) {
    errors.push("walls[] is empty — structural walls are required (wall layer will not be drawn).");
  }

  if (rooms.length > 3) {
    var boxRooms = rooms.filter(function (r) {
      return r.polygon && r.polygon.length === 4;
    });
    if (boxRooms.length > 0) {
      errors.push(
        boxRooms.length +
          " room(s) have only 4 polygon points (likely bounding boxes, not traced shapes). Re-analyze or edit vertices."
      );
    }
  }

  if (imageWidth > 0 && imageHeight > 0 && walls.length) {
    var shellAr = shellAspectRatio(walls);
    if (shellAr != null) {
      var imgAr = imageWidth / imageHeight;
      var relDiff = Math.abs(shellAr - imgAr) / Math.max(imgAr, 1e-6);
      if (relDiff > 0.4) {
        errors.push(
          "Shell aspect ratio (" +
            shellAr.toFixed(2) +
            ") differs from image (" +
            imgAr.toFixed(2) +
            ") by " +
            Math.round(relDiff * 100) +
            "% — coordinates may be cropped or wrong."
        );
      }
    }
  }

  return errors.length ? errors.join(" ") : null;
}
