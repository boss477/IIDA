import * as THREE from "three";

var _lights = [];
var _lightMeshes = [];
var _discMaterial = null;

/** Area thresholds in m² */
var AREA_SMALL = 9;
var AREA_MEDIUM = 20;
var MAX_TOTAL_SPOTS = 48;

/**
 * @param {THREE.Object3D} obj
 */
function track(obj) {
  _lights.push(obj);
  return obj;
}

function trackMesh(mesh) {
  _lightMeshes.push(mesh);
  return mesh;
}

export function disposeLighting() {
  _lights.forEach(function (l) {
    if (l.parent) l.parent.remove(l);
    if (l.dispose) l.dispose();
  });
  _lights.length = 0;
  _lightMeshes.forEach(function (m) {
    if (m.parent) m.parent.remove(m);
    if (m.geometry) m.geometry.dispose();
  });
  _lightMeshes.length = 0;
  if (_discMaterial) {
    _discMaterial.dispose();
    _discMaterial = null;
  }
}

/**
 * Shoelace area in XZ plane (m²).
 * @param {Array<{x:number,y:number}>} polygon
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 */
export function polygonAreaM2(polygon, toWorld) {
  if (!polygon || polygon.length < 3) return 0;
  var pts = polygon.map(toWorld);
  var sum = 0;
  for (var i = 0; i < pts.length; i++) {
    var j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return Math.abs(sum) * 0.5;
}

/**
 * @param {number} areaM2
 * @returns {1|2|4}
 */
export function lightCountForArea(areaM2) {
  if (areaM2 < AREA_SMALL) return 1;
  if (areaM2 < AREA_MEDIUM) return 2;
  return 4;
}

/**
 * @param {Array<{x:number,y:number}>} polygon
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 * @param {1|2|4} count
 * @returns {Array<{x:number,z:number}>}
 */
export function spotPositionsForRoom(polygon, toWorld, count) {
  var minX = Infinity;
  var maxX = -Infinity;
  var minZ = Infinity;
  var maxZ = -Infinity;

  polygon.forEach(function (pt) {
    var w = toWorld(pt);
    minX = Math.min(minX, w.x);
    maxX = Math.max(maxX, w.x);
    minZ = Math.min(minZ, w.z);
    maxZ = Math.max(maxZ, w.z);
  });

  var cx = (minX + maxX) / 2;
  var cz = (minZ + maxZ) / 2;
  var w = Math.max(maxX - minX, 0.5);
  var d = Math.max(maxZ - minZ, 0.5);
  var insetX = w * 0.25;
  var insetZ = d * 0.25;

  if (count === 1) return [{ x: cx, z: cz }];

  if (count === 2) {
    if (w >= d) {
      return [
        { x: cx - insetX, z: cz },
        { x: cx + insetX, z: cz },
      ];
    }
    return [
      { x: cx, z: cz - insetZ },
      { x: cx, z: cz + insetZ },
    ];
  }

  return [
    { x: cx - insetX, z: cz - insetZ },
    { x: cx + insetX, z: cz - insetZ },
    { x: cx - insetX, z: cz + insetZ },
    { x: cx + insetX, z: cz + insetZ },
  ];
}

function addSpot(scene, x, z, ceilingY, span, spotIndex) {
  var pl = track(
    new THREE.SpotLight(0xfff5e0, 1.8, Math.max(span * 0.85, 6), Math.PI * 0.28, 0.35, 1.6)
  );
  pl.position.set(x, ceilingY, z);
  pl.target.position.set(x, 0, z);
  pl.castShadow = spotIndex < 4;
  if (pl.castShadow) {
    pl.shadow.mapSize.set(512, 512);
    pl.shadow.bias = -0.002;
  }
  scene.add(pl);
  scene.add(track(pl.target));

  if (!_discMaterial) {
    _discMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8cc,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    });
  }
  var disc = trackMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24), _discMaterial)
  );
  disc.position.set(x, ceilingY + 0.125, z);
  scene.add(disc);
}

/**
 * @param {THREE.Scene} scene
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, centerX: number, centerZ: number, span: number }} bounds
 * @param {Array<{ polygon?: Array<{x:number,y:number}>, id?: string, name?: string }>} rooms
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} toWorld
 */
export function addSceneLighting(scene, bounds, rooms, toWorld) {
  disposeLighting();

  var cx = bounds.centerX;
  var cz = bounds.centerZ;
  var span = bounds.span || 12;
  var shadowExt = Math.max(span * 0.75, 8);
  var ceilingY = 2.85;

  scene.add(track(new THREE.HemisphereLight(0xfff4e0, 0xc8d8e8, 0.55)));

  var sun = track(new THREE.DirectionalLight(0xfff0d0, 0.95));
  sun.position.set(cx - span * 0.4, span * 0.85, cz + span * 0.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowExt;
  sun.shadow.camera.right = sun.shadow.camera.top = shadowExt;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = span * 3;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  var fill = track(new THREE.DirectionalLight(0xd0e8ff, 0.42));
  fill.position.set(cx - span * 0.15, span * 0.35, cz - span * 0.55);
  scene.add(fill);

  var warm = track(new THREE.DirectionalLight(0xffe8cc, 0.18));
  warm.position.set(cx + span * 0.35, span * 0.12, cz + span * 0.25);
  scene.add(warm);

  var spotIndex = 0;
  var roomStats = [];
  var rooms1 = 0;
  var rooms2 = 0;
  var rooms4 = 0;

  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    if (spotIndex >= MAX_TOTAL_SPOTS) return;

    var area = polygonAreaM2(room.polygon, toWorld);
    var count = lightCountForArea(area);
    if (count === 1) rooms1++;
    else if (count === 2) rooms2++;
    else rooms4++;

    var positions = spotPositionsForRoom(room.polygon, toWorld, count);
    positions.forEach(function (p) {
      if (spotIndex >= MAX_TOTAL_SPOTS) return;
      addSpot(scene, p.x, p.z, ceilingY, span, spotIndex);
      spotIndex++;
    });

    roomStats.push({
      id: room.id || room.name,
      areaM2: Math.round(area * 100) / 100,
      lights: count,
    });
  });

  return {
    spotCount: spotIndex,
    discCount: spotIndex,
    perRoom: true,
    rooms1: rooms1,
    rooms2: rooms2,
    rooms4: rooms4,
    roomStats: roomStats,
  };
}
