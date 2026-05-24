import * as THREE from "three";

/**
 * @param {Array<{ polygon?: Array<{x:number,y:number}> }>} rooms
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 */
export function computeSceneBounds(rooms, toWorld) {
  var minX = Infinity;
  var maxX = -Infinity;
  var minZ = Infinity;
  var maxZ = -Infinity;
  var centroids = [];

  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var sx = 0;
    var sz = 0;
    room.polygon.forEach(function (pt) {
      var w = toWorld(pt);
      minX = Math.min(minX, w.x);
      maxX = Math.max(maxX, w.x);
      minZ = Math.min(minZ, w.z);
      maxZ = Math.max(maxZ, w.z);
      sx += w.x;
      sz += w.z;
    });
    centroids.push({
      x: sx / room.polygon.length,
      z: sz / room.polygon.length,
    });
  });

  if (!isFinite(minX)) {
    minX = -4;
    maxX = 4;
    minZ = -4;
    maxZ = 4;
    centroids = [{ x: 0, z: 0 }];
  }

  var centerX = (minX + maxX) / 2;
  var centerZ = (minZ + maxZ) / 2;
  var span = Math.max(maxX - minX, maxZ - minZ, 4);

  return {
    minX: minX,
    maxX: maxX,
    minZ: minZ,
    maxZ: maxZ,
    centerX: centerX,
    centerZ: centerZ,
    centerY: 1.2,
    span: span,
    roomCentroids: centroids,
  };
}

var _transition = null;

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} controls
 * @param {{ centerX: number, centerZ: number, span: number }} bounds
 * @param {"dollhouse"|"top"} mode
 * @param {number} [durationMs]
 */
export function flyToView(camera, controls, bounds, mode, durationMs) {
  var span = bounds.span;
  var cx = bounds.centerX;
  var cz = bounds.centerZ;
  var lookY = 0.85;

  var toPos;
  var toLook;
  if (mode === "top") {
    toPos = new THREE.Vector3(cx, span * 1.85, cz + 0.02);
    toLook = new THREE.Vector3(cx, 0, cz);
  } else {
    var d = span * 1.15;
    toPos = new THREE.Vector3(cx + d, d * 0.95, cz + d);
    toLook = new THREE.Vector3(cx, lookY, cz);
  }

  _transition = {
    active: true,
    fromPos: camera.position.clone(),
    fromLook: controls.target.clone(),
    toPos: toPos,
    toLook: toLook,
    t0: performance.now(),
    dur: durationMs != null ? durationMs : 900,
    controls: controls,
  };
}

/** Call each frame before controls.update(). Returns true if animating. */
export function updateCameraTransition(camera) {
  if (!_transition || !_transition.active) return false;
  var tr = _transition;
  var raw = (performance.now() - tr.t0) / tr.dur;
  var t = Math.min(raw, 1);
  var e = easeInOut(t);
  camera.position.lerpVectors(tr.fromPos, tr.toPos, e);
  tr.controls.target.lerpVectors(tr.fromLook, tr.toLook, e);
  if (t >= 1) {
    tr.active = false;
    tr.controls.enabled = true;
  }
  return tr.active;
}

export function cancelCameraTransition() {
  if (_transition) _transition.active = false;
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} controls
 * @param {{ centerX: number, centerZ: number, span: number }} bounds
 * @param {"dollhouse"|"top"} mode
 */
export function frameCamera(camera, controls, bounds, mode) {
  cancelCameraTransition();
  flyToView(camera, controls, bounds, mode, 0);
  if (_transition) {
    camera.position.copy(_transition.toPos);
    controls.target.copy(_transition.toLook);
    _transition.active = false;
    controls.enabled = true;
  }
  controls.update();
}
