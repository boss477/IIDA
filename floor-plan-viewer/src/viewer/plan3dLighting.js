import * as THREE from "three";

var _lights = [];

/**
 * @param {THREE.Object3D} obj
 */
function track(obj) {
  _lights.push(obj);
  return obj;
}

export function disposeLighting() {
  _lights.forEach(function (l) {
    if (l.parent) l.parent.remove(l);
    if (l.dispose) l.dispose();
  });
  _lights.length = 0;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, centerX: number, centerZ: number, span: number, roomCentroids?: Array<{x:number,z:number}> }} bounds
 */
export function addSceneLighting(scene, bounds) {
  disposeLighting();

  var cx = bounds.centerX;
  var cz = bounds.centerZ;
  var span = bounds.span || 12;
  var shadowExt = Math.max(span * 0.75, 8);

  scene.add(
    track(
      new THREE.HemisphereLight(0xfff4e0, 0xc8d8e8, 0.55)
    )
  );

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

  var centroids = bounds.roomCentroids || [{ x: cx, z: cz }];
  var maxSpots = Math.min(4, centroids.length);
  for (var i = 0; i < maxSpots; i++) {
    var c = centroids[i];
    var pl = track(new THREE.SpotLight(0xfff5e0, 1.2, span * 0.9, Math.PI * 0.32, 0.4, 1.4));
    pl.position.set(c.x, 2.85, c.z);
    pl.target.position.set(c.x, 0, c.z);
    pl.castShadow = i === 0;
    if (pl.castShadow) pl.shadow.mapSize.set(512, 512);
    scene.add(pl);
    scene.add(track(pl.target));
  }
}
