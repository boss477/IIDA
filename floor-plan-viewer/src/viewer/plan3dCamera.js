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
 * @param {{ polygon?: Array<{x:number,y:number}> }} room
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 */
export function computeRoomBounds(room, toWorld) {
  var minX = Infinity;
  var maxX = -Infinity;
  var minZ = Infinity;
  var maxZ = -Infinity;
  var poly = room && room.polygon;
  if (!poly || poly.length < 3) {
    return {
      minX: -2,
      maxX: 2,
      minZ: -2,
      maxZ: 2,
      centerX: 0,
      centerZ: 0,
      span: 4,
    };
  }
  poly.forEach(function (pt) {
    var w = toWorld(pt);
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minZ = Math.min(minZ, w.z);
    maxZ = Math.max(maxZ, w.z);
  });
  var centerX = (minX + maxX) / 2;
  var centerZ = (minZ + maxZ) / 2;
  var span = Math.max(maxX - minX, maxZ - minZ, 1.5);
  return {
    minX: minX,
    maxX: maxX,
    minZ: minZ,
    maxZ: maxZ,
    centerX: centerX,
    centerZ: centerZ,
    span: span,
  };
}

/**
 * Three elevation thumbnails per room (walls aligned to room AABB).
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, centerX: number, centerZ: number, span: number }} bounds
 * @returns {Array<{ pos: number[], look: number[], label: string }>}
 */
export function getRoomSideViews(bounds) {
  var cx = bounds.centerX;
  var cz = bounds.centerZ;
  var d = Math.max(bounds.span * 0.65, 1.6);
  var eyeY = 1.55;
  var lookY = 1.35;
  return [
    {
      label: "Side A",
      pos: [bounds.minX - d, eyeY, cz],
      look: [cx, lookY, cz],
    },
    {
      label: "Side B",
      pos: [bounds.maxX + d, eyeY, cz],
      look: [cx, lookY, cz],
    },
    {
      label: "Side C",
      pos: [cx, eyeY, bounds.minZ - d],
      look: [cx, lookY, cz],
    },
  ];
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

  flyToPosition(camera, controls, toPos, toLook, durationMs);
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} controls
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, centerX: number, centerZ: number, span: number }} bounds
 * @param {number} sideIndex
 * @param {number} [durationMs]
 */
export function flyToSideView(camera, controls, bounds, sideIndex, durationMs) {
  var views = getRoomSideViews(bounds);
  var sv = views[sideIndex];
  if (!sv) return;
  flyToPosition(
    camera,
    controls,
    new THREE.Vector3(sv.pos[0], sv.pos[1], sv.pos[2]),
    new THREE.Vector3(sv.look[0], sv.look[1], sv.look[2]),
    durationMs != null ? durationMs : 800
  );
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} controls
 * @param {THREE.Vector3} toPos
 * @param {THREE.Vector3} toLook
 * @param {number} [durationMs]
 */
export function flyToPosition(camera, controls, toPos, toLook, durationMs) {
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
