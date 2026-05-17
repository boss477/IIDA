/**
 * Calibrate raster floor plans: known real-world segment lengths + endpoints in
 * normalized image coordinates (0–1 relative to bitmap width/height).
 */

/**
 * @param {{ lengthM?: number, lengthMm?: number, from: {x:number,y:number}, to: {x:number,y:number} }} seg
 * @returns {number|null} length in meters
 */
export function segmentLengthMeters(seg) {
  if (!seg) return null;
  if (seg.lengthM != null) return seg.lengthM;
  if (seg.lengthMeters != null) return seg.lengthMeters;
  if (seg.lengthMm != null) return seg.lengthMm / 1000;
  return null;
}

/**
 * Pixel length of a segment defined in normalized coordinates.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 */
export function segmentLengthPx(a, b, naturalWidth, naturalHeight) {
  var dx = (b.x - a.x) * naturalWidth;
  var dy = (b.y - a.y) * naturalHeight;
  return Math.hypot(dx, dy);
}

/**
 * @param {{ segments?: Array<object> }|null} calibration
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {{ metersPerPixel: number, mmPerPixel: number, segmentCount: number, summary: string, pixelPerMeter: number }|null}
 */
export function resolveCalibration(calibration, naturalWidth, naturalHeight) {
  if (!calibration || !calibration.segments || !calibration.segments.length) return null;
  if (!naturalWidth || !naturalHeight) return null;

  var mppSum = 0;
  var used = 0;
  for (var i = 0; i < calibration.segments.length; i++) {
    var s = calibration.segments[i];
    var lenM = segmentLengthMeters(s);
    var from = s.from || s.a;
    var to = s.to || s.b;
    if (lenM == null || !from || !to) continue;
    var Lpx = segmentLengthPx(from, to, naturalWidth, naturalHeight);
    if (Lpx < 1e-6) continue;
    mppSum += lenM / Lpx;
    used++;
  }
  if (!used) return null;

  var metersPerPixel = mppSum / used;
  var mmPerPixel = metersPerPixel * 1000;
  var pixelPerMeter = 1 / metersPerPixel;

  return {
    metersPerPixel: metersPerPixel,
    mmPerPixel: mmPerPixel,
    segmentCount: used,
    pixelPerMeter: pixelPerMeter,
    summary:
      used +
      " ref. segment(s) · 1 px ≈ " +
      mmPerPixel.toFixed(2) +
      " mm · 1 m ≈ " +
      pixelPerMeter.toFixed(1) +
      " px",
  };
}

/**
 * Shoelace area in px² for polygon vertices in normalized coords.
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 */
export function polygonAreaPxFromNorm(poly, naturalWidth, naturalHeight) {
  if (!poly || poly.length < 3) return 0;
  var a = 0;
  for (var i = 0, n = poly.length; i < n; i++) {
    var j = (i + 1) % n;
    var xi = poly[i].x * naturalWidth;
    var yi = poly[i].y * naturalHeight;
    var xj = poly[j].x * naturalWidth;
    var yj = poly[j].y * naturalHeight;
    a += xi * yj - xj * yi;
  }
  return Math.abs(a) * 0.5;
}

/**
 * @param {Array<{x:number,y:number}>} poly
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {number} metersPerPixel
 */
export function polygonAreaSqMFromNorm(poly, naturalWidth, naturalHeight, metersPerPixel) {
  var apx = polygonAreaPxFromNorm(poly, naturalWidth, naturalHeight);
  return apx * metersPerPixel * metersPerPixel;
}

/**
 * @param {number} dxNorm
 * @param {number} dyNorm
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @param {number} metersPerPixel
 */
export function normDeltaToMeters(dxNorm, dyNorm, naturalWidth, naturalHeight, metersPerPixel) {
  var dpx = Math.hypot(dxNorm * naturalWidth, dyNorm * naturalHeight);
  return dpx * metersPerPixel;
}

/**
 * @param {number} meters
 * @returns {string}
 */
export function formatDistanceMeters(meters) {
  if (meters == null || !isFinite(meters)) return "";
  if (meters >= 1) return meters.toFixed(2) + " m";
  return (meters * 1000).toFixed(0) + " mm";
}
