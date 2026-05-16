/**
 * Point-in-polygon (ray casting). Coordinates in same space as polygon vertices (normalized 0–1).
 * @param {number} x
 * @param {number} y
 * @param {Array<{x:number,y:number}>} poly
 * @returns {boolean}
 */
export function pointInPolygon(x, y, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i].x;
    var yi = poly[i].y;
    var xj = poly[j].x;
    var yj = poly[j].y;
    if (Math.abs(yj - yi) < 1e-12) continue;
    var intersect =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * @param {Array<{x:number,y:number}>} poly
 * @returns {{ minX:number, minY:number, maxX:number, maxY:number }}
 */
/**
 * @param {Array<{x:number,y:number}>} poly
 * @returns {number}
 */
export function polygonArea(poly) {
  if (!poly || poly.length < 3) return 0;
  var a = 0;
  for (var i = 0, n = poly.length; i < n; i++) {
    var j = (i + 1) % n;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return Math.abs(a) * 0.5;
}

export function polygonBBox(poly) {
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  for (var i = 0; i < poly.length; i++) {
    var p = poly[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
