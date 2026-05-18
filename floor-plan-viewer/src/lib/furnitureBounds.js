import { pointInPolygon, polygonBBox } from "./geometry.js";

export function furnitureHalfExtents(item) {
  var w = item.width != null ? item.width : item.scale != null ? item.scale : 0.06;
  var h = item.height != null ? item.height : item.depth != null ? item.depth : w;
  return { hw: w / 2, hd: h / 2, w: w, h: h };
}

export function furnitureCorners(item) {
  var ext = furnitureHalfExtents(item);
  var x = item.x;
  var y = item.y;
  return [
    { x: x - ext.hw, y: y - ext.hd },
    { x: x + ext.hw, y: y - ext.hd },
    { x: x + ext.hw, y: y + ext.hd },
    { x: x - ext.hw, y: y + ext.hd },
  ];
}

export function pointInAnyRoom(x, y, rooms) {
  if (!rooms || !rooms.length) return true;
  for (var i = 0; i < rooms.length; i++) {
    var poly = rooms[i].polygon;
    if (poly && poly.length >= 3 && pointInPolygon(x, y, poly)) return true;
  }
  return false;
}

/** All corners of the axis-aligned footprint must lie inside some room polygon. */
export function isFurnitureInsideRooms(item, rooms) {
  if (!item || item.x == null || item.y == null) return false;
  if (!rooms || !rooms.length) return true;
  var corners = furnitureCorners(item);
  for (var c = 0; c < corners.length; c++) {
    if (!pointInAnyRoom(corners[c].x, corners[c].y, rooms)) return false;
  }
  return true;
}

export function clampPlanBounds(item) {
  var ext = furnitureHalfExtents(item);
  item.x = Math.max(ext.hw, Math.min(1 - ext.hw, item.x));
  item.y = Math.max(ext.hd, Math.min(1 - ext.hd, item.y));
}

/**
 * Block illegal moves during drag / nudge. Reverts to prev when crossing a wall.
 * @returns {boolean} true if the new position was accepted
 */
export function constrainFurnitureMove(item, rooms, prevX, prevY) {
  clampPlanBounds(item);
  if (isFurnitureInsideRooms(item, rooms)) return true;
  if (prevX != null && prevY != null) {
    item.x = prevX;
    item.y = prevY;
  }
  return false;
}

function polygonCentroid(poly) {
  var cx = 0;
  var cy = 0;
  var a = 0;
  for (var i = 0; i < poly.length; i++) {
    var j = (i + 1) % poly.length;
    var cross = poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    a += cross;
    cx += (poly[i].x + poly[j].x) * cross;
    cy += (poly[i].y + poly[j].y) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {
    var b = polygonBBox(poly);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function findRoomContainingPoint(x, y, rooms) {
  var best = null;
  var bestArea = Infinity;
  for (var i = 0; i < (rooms || []).length; i++) {
    var poly = rooms[i].polygon;
    if (!poly || poly.length < 3) continue;
    if (!pointInPolygon(x, y, poly)) continue;
    var area = 0;
    for (var k = 0; k < poly.length; k++) {
      var m = (k + 1) % poly.length;
      area += poly[k].x * poly[m].y - poly[m].x * poly[k].y;
    }
    area = Math.abs(area);
    if (area < bestArea) {
      bestArea = area;
      best = rooms[i];
    }
  }
  return best;
}

/** Nudge item into a valid in-room position (after resize / place). */
export function resolveFurniturePosition(item, rooms) {
  if (!item || item.x == null || item.y == null) return item;
  clampPlanBounds(item);
  if (!rooms || !rooms.length || isFurnitureInsideRooms(item, rooms)) return item;

  var ext = furnitureHalfExtents(item);
  var startX = item.x;
  var startY = item.y;

  for (var r = 0; r < 60; r++) {
    for (var a = 0; a < 12; a++) {
      var ang = (a / 12) * Math.PI * 2;
      item.x = startX + Math.cos(ang) * 0.004 * r;
      item.y = startY + Math.sin(ang) * 0.004 * r;
      clampPlanBounds(item);
      if (isFurnitureInsideRooms(item, rooms)) return item;
    }
  }

  var room = findRoomContainingPoint(startX, startY, rooms);
  if (!room) {
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].polygon && rooms[i].polygon.length >= 3) {
        room = rooms[i];
        break;
      }
    }
  }
  if (room && room.polygon) {
    var c = polygonCentroid(room.polygon);
    var box = polygonBBox(room.polygon);
    item.x = Math.max(box.minX + ext.hw, Math.min(box.maxX - ext.hw, c.x));
    item.y = Math.max(box.minY + ext.hd, Math.min(box.maxY - ext.hd, c.y));
    clampPlanBounds(item);
    if (isFurnitureInsideRooms(item, rooms)) return item;
  }

  item.x = startX;
  item.y = startY;
  clampPlanBounds(item);
  return item;
}
