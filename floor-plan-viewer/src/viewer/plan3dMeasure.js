import * as THREE from "three";
import { catalogById, formatCatalogDimensionsLabel } from "../lib/catalogSizing.js";

var USE_IMPERIAL = true;

/**
 * @param {boolean} imperial
 */
export function setMeasureUnitsImperial(imperial) {
  USE_IMPERIAL = !!imperial;
}

export function formatLengthImperial(meters) {
  if (meters == null || !isFinite(meters)) return "—";
  var totalIn = Math.max(0, meters * 39.3700787);
  var feet = Math.floor(totalIn / 12);
  var inches = Math.round(totalIn - feet * 12);
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return feet + "' " + inches + '"';
}

export function formatLengthMetric(meters) {
  if (meters == null || !isFinite(meters)) return "—";
  if (meters >= 10) return meters.toFixed(1) + " m";
  if (meters >= 1) return meters.toFixed(2) + " m";
  return (Math.round(meters * 100) / 100).toFixed(2) + " m";
}

export function formatLength(meters) {
  return USE_IMPERIAL ? formatLengthImperial(meters) : formatLengthMetric(meters);
}

/**
 * @param {object} room
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 */
export function roomWorldBounds(room, toWorld) {
  if (!room || !room.polygon || room.polygon.length < 3 || !toWorld) return null;
  var minX = Infinity;
  var maxX = -Infinity;
  var minZ = Infinity;
  var maxZ = -Infinity;
  room.polygon.forEach(function (p) {
    var w = toWorld(p);
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minZ = Math.min(minZ, w.z);
    maxZ = Math.max(maxZ, w.z);
  });
  return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
}

/**
 * Clearances from furniture AABB to room polygon bounds (world metres).
 */
export function wallClearancesToRoom(box, room, toWorld) {
  var rb = roomWorldBounds(room, toWorld);
  if (!box || !rb) return null;
  return {
    left: Math.max(0, box.min.x - rb.minX),
    right: Math.max(0, rb.maxX - box.max.x),
    back: Math.max(0, box.min.z - rb.minZ),
    front: Math.max(0, rb.maxZ - box.max.z),
    roomBounds: rb,
  };
}

/** @deprecated use wallClearancesToRoom */
export function wallClearancesFromBox(box, bounds) {
  if (!box || !bounds) return null;
  return {
    left: Math.max(0, box.min.x - bounds.minX),
    right: Math.max(0, bounds.maxX - box.max.x),
    back: Math.max(0, box.min.z - bounds.minZ),
    front: Math.max(0, bounds.maxZ - box.max.z),
  };
}

/**
 * @param {{ left: number, right: number, back: number, front: number }} c
 */
export function formatWallClearances(c) {
  if (!c) return "";
  return (
    "Walls: L " +
    formatLength(c.left) +
    " · R " +
    formatLength(c.right) +
    " · B " +
    formatLength(c.back) +
    " · F " +
    formatLength(c.front)
  );
}

/**
 * @param {object} item
 * @param {object|null} catalogRow
 * @param {THREE.Group} group
 * @param {object|null} room
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 * @param {{ minX,maxX,minZ,maxZ }|null} planBounds fallback
 */
export function getFurnitureMeasurementLines(item, catalogRow, group, room, toWorld, planBounds) {
  var title = catalogRow
    ? formatCatalogDimensionsLabel(catalogRow, item)
    : item && item.catalogId
      ? String(item.catalogId)
      : item && item.id
        ? String(item.id)
        : "Furniture";

  var lines = [title];
  if (group) {
    var box = new THREE.Box3().setFromObject(group);
    var clear = room && toWorld ? wallClearancesToRoom(box, room, toWorld) : null;
    if (!clear && planBounds) clear = wallClearancesFromBox(box, planBounds);
    var wallLine = formatWallClearances(clear);
    if (wallLine) lines.push(wallLine);
    var size = new THREE.Vector3();
    box.getSize(size);
    lines.push(
      "Size: W " +
        formatLength(size.x) +
        " × D " +
        formatLength(size.z) +
        " × H " +
        formatLength(size.y)
    );
  }
  if (item && item.rotationDeg != null) {
    lines.push("Rotation: " + Math.round(item.rotationDeg) + "°");
  }
  return lines;
}

export function catalogRowForItem(catalog, item) {
  if (!item) return null;
  return catalogById(catalog || [], item.catalogId);
}
