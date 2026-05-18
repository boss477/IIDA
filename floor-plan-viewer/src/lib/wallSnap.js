/**
 * Keep furniture inside rooms (wall boundaries) and nudge away from wall centerlines.
 */
import { clampPlanBounds, isFurnitureInsideRooms, resolveFurniturePosition } from "./furnitureBounds.js";

function halfExtents(item) {
  var w = item.width != null ? item.width : item.scale != null ? item.scale : 0.06;
  var h = item.height != null ? item.height : item.depth != null ? item.depth : w;
  return { hw: w / 2, hd: h / 2 };
}

function wallSegments(walls) {
  var segs = [];
  if (!walls || !walls.length) return segs;
  walls.forEach(function (wall) {
    var pts = wall.points;
    if (!pts || pts.length < 2) return;
    for (var i = 0; i < pts.length - 1; i++) {
      segs.push({ a: pts[i], b: pts[i + 1] });
    }
  });
  return segs;
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function closestPointOnSegment(p, a, b) {
  var ab = sub(b, a);
  var denom = dot(ab, ab);
  if (denom < 1e-12) return { x: a.x, y: a.y };
  var t = dot(sub(p, a), ab) / denom;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function snapFurnitureFromWalls(item, walls, _planW, _planH, rooms) {
  if (item.x == null || item.y == null) return item;
  clampPlanBounds(item);

  if (rooms && rooms.length) {
    if (!isFurnitureInsideRooms(item, rooms)) resolveFurniturePosition(item, rooms);
    return item;
  }

  if (!walls || walls.length === 0) return item;

  var segs = wallSegments(walls);
  if (!segs.length) return item;

  var margin = 0.005;
  for (var iter = 0; iter < 10; iter++) {
    var moved = false;
    var ext = halfExtents(item);
    var required = Math.max(ext.hw, ext.hd) + margin;
    var center = { x: item.x, y: item.y };

    for (var i = 0; i < segs.length; i++) {
      var cp = closestPointOnSegment(center, segs[i].a, segs[i].b);
      var dx = center.x - cp.x;
      var dy = center.y - cp.y;
      var dist = Math.hypot(dx, dy);

      if (dist < required) {
        if (dist > 1e-9) {
          var push = required - dist;
          item.x += (dx / dist) * push;
          item.y += (dy / dist) * push;
        } else {
          var ab = sub(segs[i].b, segs[i].a);
          var abLen = Math.hypot(ab.x, ab.y) || 1;
          item.x += (-ab.y / abLen) * required;
          item.y += (ab.x / abLen) * required;
        }
        moved = true;
      }
    }
    clampPlanBounds(item);
    if (!moved) break;
  }

  if (rooms && rooms.length) resolveFurniturePosition(item, rooms);
  return item;
}
