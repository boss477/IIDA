import * as THREE from "three";
import { constrainFurnitureMove } from "../lib/furnitureBounds.js";

var SNAP_D = 0.18;

/**
 * @param {THREE.Group} group
 * @param {number} rawX
 * @param {number} rawZ
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} bounds
 * @param {THREE.Group[]} furnitureGroups
 */
export function resolvePosition3D(group, rawX, rawZ, bounds, furnitureGroups) {
  var box = new THREE.Box3().setFromObject(group);
  var hw = (box.max.x - box.min.x) / 2;
  var hd = (box.max.z - box.min.z) / 2;
  var offX = group.position.x - (box.min.x + hw);
  var offZ = group.position.z - (box.min.z + hd);
  var cx = rawX;
  var cz = rawZ;

  var wallL = bounds.minX;
  var wallR = bounds.maxX;
  var wallB = bounds.minZ;
  var wallF = bounds.maxZ;

  cx = Math.max(wallL + hw + offX, Math.min(wallR - hw + offX, cx));
  cz = Math.max(wallB + hd + offZ, Math.min(wallF - hd + offZ, cz));

  var minX = cx - offX - hw;
  var maxX = cx - offX + hw;
  var minZ = cz - offZ - hd;
  var maxZ = cz - offZ + hd;

  if (Math.abs(minX - wallL) < SNAP_D) cx += wallL - minX;
  if (Math.abs(maxX - wallR) < SNAP_D) cx += wallR - maxX;
  if (Math.abs(minZ - wallB) < SNAP_D) cz += wallB - minZ;
  if (Math.abs(maxZ - wallF) < SNAP_D) cz += wallF - maxZ;

  (furnitureGroups || []).forEach(function (other) {
    if (other === group) return;
    var ob = new THREE.Box3().setFromObject(other);
    var oX = Math.min(cx - offX + hw, ob.max.x) - Math.max(cx - offX - hw, ob.min.x);
    var oZ = Math.min(cz - offZ + hd, ob.max.z) - Math.max(cz - offZ - hd, ob.min.z);
    if (oX > 0 && oZ > 0) {
      if (oX < oZ) {
        if (cx < (ob.min.x + ob.max.x) / 2) cx -= oX;
        else cx += oX;
      } else {
        if (cz < (ob.min.z + ob.max.z) / 2) cz -= oZ;
        else cz += oZ;
      }
    }
  });

  return { x: cx, z: cz };
}

/**
 * @param {{ x: number, y: number }} normPt
 * @param {number} wReal
 * @param {number} hReal
 */
export function normToWorld(normPt, wReal, hReal) {
  return {
    x: (normPt.x - 0.5) * wReal,
    z: (normPt.y - 0.5) * hReal,
  };
}

/**
 * @param {number} wx
 * @param {number} wz
 * @param {number} wReal
 * @param {number} hReal
 */
export function worldToNorm(wx, wz, wReal, hReal) {
  return {
    x: wx / wReal + 0.5,
    y: wz / hReal + 0.5,
  };
}

/**
 * @param {THREE.Group} group
 * @param {object} item
 * @param {number} wReal
 * @param {number} hReal
 * @param {Array} rooms
 */
export function syncGroupFromItem(group, item, wReal, hReal, rooms) {
  var prevX = item.x;
  var prevY = item.y;
  var w = normToWorld({ x: item.x, y: item.y }, wReal, hReal);
  group.position.set(w.x, item.z || 0, w.z);
  constrainFurnitureMove(item, rooms, prevX, prevY);
  var w2 = normToWorld({ x: item.x, y: item.y }, wReal, hReal);
  group.position.set(w2.x, item.z || 0, w2.z);
}

/**
 * @param {THREE.Group} group
 * @param {object} item
 * @param {number} wx
 * @param {number} wz
 * @param {number} wReal
 * @param {number} hReal
 * @param {Array} rooms
 */
export function applyWorldPositionToItem(group, item, wx, wz, wReal, hReal, rooms) {
  var prevX = item.x;
  var prevY = item.y;
  var norm = worldToNorm(wx, wz, wReal, hReal);
  item.x = norm.x;
  item.y = norm.y;
  if (!constrainFurnitureMove(item, rooms, prevX, prevY)) {
    var w = normToWorld({ x: item.x, y: item.y }, wReal, hReal);
    group.position.set(w.x, item.z || 0, w.z);
    return false;
  }
  return true;
}
