import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resolveCalibration } from "../lib/calibration.js";
import { catalogById } from "../lib/catalogSizing.js";
import {
  createFabricMaterial,
  createFloorMaterial,
  createTableTopMaterial,
  createWallMaterial,
  createWoodLegMaterial,
  disposeMaterials,
} from "./plan3dMaterials.js";
import { addSceneLighting, disposeLighting } from "./plan3dLighting.js";
import {
  computeSceneBounds,
  flyToView,
  frameCamera,
  updateCameraTransition,
  cancelCameraTransition,
} from "./plan3dCamera.js";

var scene, camera, renderer, controls;
var animFrameId;
var containerEl;
var activePlanData;
var activePlanImage;
var sceneBounds = null;
var viewMode = "dollhouse";
var sceneContent = null;

function disposeSceneGraph(root) {
  if (!root) return;
  root.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
  });
}

/**
 * Initialize realistic-style 3D view from AI plan JSON.
 * @param {HTMLElement} container
 * @param {object} data
 * @param {HTMLImageElement} planImage
 */
export function init3D(container, data, planImage) {
  dispose3D();
  containerEl = container;
  activePlanData = data;
  activePlanImage = planImage;

  var width = container.clientWidth || 500;
  var height = container.clientHeight || 500;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8c5c0);

  camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 500);
  camera.position.set(0, 15, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.minDistance = 0.5;
  controls.maxDistance = 80;
  controls.screenSpacePanning = true;
  controls.target.set(0, 0.8, 0);

  sceneContent = new THREE.Group();
  scene.add(sceneContent);

  buildSceneGeometry();
  if (sceneBounds) {
    addSceneLighting(scene, sceneBounds);
    frameCamera(camera, controls, sceneBounds, viewMode);
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    var transitioning = updateCameraTransition(camera);
    if (!transitioning) controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

/**
 * @param {"dollhouse"|"top"} mode
 */
export function set3DViewMode(mode) {
  viewMode = mode === "top" ? "top" : "dollhouse";
  if (!camera || !controls || !sceneBounds) return;
  flyToView(camera, controls, sceneBounds, viewMode, 900);
  if (controls) controls.enabled = false;
}

/**
 * Destroy and clean up 3D engine.
 */
export function dispose3D() {
  cancelCameraTransition();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  disposeLighting();
  if (sceneContent) {
    disposeSceneGraph(sceneContent);
    sceneContent = null;
  }
  disposeMaterials();
  if (renderer) {
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  containerEl = null;
  sceneBounds = null;
}

/**
 * Handle resizing of container.
 */
export function resize3D() {
  if (!containerEl || !camera || !renderer) return;
  var w = containerEl.clientWidth;
  var h = containerEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function polygonRepeat(room, wReal, hReal) {
  var minX = 1;
  var maxX = 0;
  var minY = 1;
  var maxY = 0;
  (room.polygon || []).forEach(function (p) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  var rw = Math.max((maxX - minX) * wReal, 1);
  var rh = Math.max((maxY - minY) * hReal, 1);
  return { x: Math.max(rw / 2, 1.5), y: Math.max(rh / 2, 1.5) };
}

function buildSceneGeometry() {
  if (!activePlanData || !sceneContent) return;

  disposeSceneGraph(sceneContent);
  while (sceneContent.children.length) sceneContent.remove(sceneContent.children[0]);

  var imgW = activePlanImage ? activePlanImage.naturalWidth || 1000 : 1000;
  var imgH = activePlanImage ? activePlanImage.naturalHeight || 1000 : 1000;

  var cal = resolveCalibration(activePlanData.calibration, imgW, imgH);
  var mpp = cal ? cal.metersPerPixel : 12 / Math.max(imgW, imgH);

  var wReal = imgW * mpp;
  var hReal = imgH * mpp;

  function toWorld(pt) {
    return {
      x: (pt.x - 0.5) * wReal,
      z: (pt.y - 0.5) * hReal,
    };
  }

  sceneBounds = computeSceneBounds(activePlanData.rooms || [], toWorld);

  var wallMat = createWallMaterial();
  var wallHeight = 2.7;

  (activePlanData.rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;

    var shape = new THREE.Shape();
    var start = toWorld(room.polygon[0]);
    shape.moveTo(start.x, start.z);
    for (var i = 1; i < room.polygon.length; i++) {
      var pt = toWorld(room.polygon[i]);
      shape.lineTo(pt.x, pt.z);
    }
    shape.closePath();

    var rep = polygonRepeat(room, wReal, hReal);
    var floorGeo = new THREE.ShapeGeometry(shape);
    var floorMat = createFloorMaterial(room.flooring, rep);
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.005;
    floorMesh.receiveShadow = true;
    sceneContent.add(floorMesh);
  });

  var walls = (activePlanData.walls || []).slice();
  if (walls.length === 0 && activePlanData.rooms && activePlanData.rooms.length) {
    activePlanData.rooms.forEach(function (r) {
      if (r.polygon && r.polygon.length >= 3) {
        var pts = r.polygon.map(function (p) {
          return { x: p.x, y: p.y };
        });
        pts.push({ x: pts[0].x, y: pts[0].y });
        walls.push({ points: pts, thickness: 0.006 });
      }
    });
  }

  walls.forEach(function (wall) {
    var pts = wall.points;
    if (!pts || pts.length < 2) return;
    var thick = (wall.thickness || 0.006) * Math.max(imgW, imgH) * mpp;

    for (var wi = 0; wi < pts.length - 1; wi++) {
      var w1 = toWorld(pts[wi]);
      var w2 = toWorld(pts[wi + 1]);

      var dx = w2.x - w1.x;
      var dz = w2.z - w1.z;
      var len = Math.hypot(dx, dz);
      if (len < 0.01) continue;

      var wallGeo = new THREE.BoxGeometry(len, wallHeight, thick);
      var wallMesh = new THREE.Mesh(wallGeo, wallMat);
      var midX = (w1.x + w2.x) / 2;
      var midZ = (w1.z + w2.z) / 2;
      wallMesh.position.set(midX, wallHeight / 2, midZ);
      wallMesh.rotation.y = -Math.atan2(dz, dx);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      sceneContent.add(wallMesh);
    }
  });

  (activePlanData.furniture || []).forEach(function (item) {
    if (item.x == null || item.y == null) return;

    var catalog = activePlanData.furniture_catalog || [];
    var catalogRow = catalogById(catalog, item.catalogId);

    var wM = 0.6;
    var dM = 0.6;
    var hM = 0.7;

    if (catalogRow) {
      wM = (catalogRow.width_mm || 600) / 1000;
      dM = (catalogRow.depth_mm || catalogRow.length_mm || 600) / 1000;
      hM = (catalogRow.height_mm || 750) / 1000;
    } else {
      var type = String(item.type || item.shape || "").toLowerCase();
      var normW = item.width != null ? item.width : item.scale != null ? item.scale : 0.06;
      var normD = item.height != null ? item.height : item.depth != null ? item.depth : normW;
      wM = normW * wReal;
      dM = normD * hReal;
      if (type.indexOf("bed") >= 0) hM = 0.6;
      else if (type.indexOf("sofa") >= 0) hM = 0.75;
      else if (type.indexOf("chair") >= 0) hM = 0.85;
      else if (type.indexOf("table") >= 0) hM = 0.75;
      else hM = 0.7;
    }

    var group = new THREE.Group();
    var wPos = toWorld(item);
    group.position.set(wPos.x, item.z || 0, wPos.z);
    group.rotation.y = -(item.rotationDeg || 0) * Math.PI / 180;

    var typeStr = String(item.type || item.shape || catalogRow && catalogRow.shape || "").toLowerCase();
    if (catalogRow && catalogRow.shape) typeStr = catalogRow.shape + " " + typeStr;

    addFurnitureMeshes(group, typeStr, item, wM, dM, hM);
    sceneContent.add(group);
  });
}

function addFurnitureMeshes(group, typeStr, item, wM, dM, hM) {
  if (typeStr.indexOf("sofa") >= 0 || typeStr.indexOf("lounge") >= 0) {
    var sofaColor = 0x253d5b;
    if (item.sofaColorOverride) sofaColor = getSofaHexColor(item.sofaColorOverride);
    else if (item.sofaParams && item.sofaParams.color) sofaColor = getSofaHexColor(item.sofaParams.color);

    var sofaMat = createFabricMaterial(sofaColor, 0.88);
    var cushionMat = createFabricMaterial(lightenHexColor(sofaColor, 0.12), 0.9);
    var woodMat = createWoodLegMaterial();

    var seatMesh = new THREE.Mesh(new THREE.BoxGeometry(wM * 0.9, hM * 0.4, dM * 0.85), cushionMat);
    seatMesh.position.y = hM * 0.3;
    seatMesh.castShadow = seatMesh.receiveShadow = true;
    group.add(seatMesh);

    var backMesh = new THREE.Mesh(new THREE.BoxGeometry(wM * 0.9, hM * 0.5, dM * 0.15), sofaMat);
    backMesh.position.set(0, hM * 0.65, -dM * 0.35);
    backMesh.castShadow = backMesh.receiveShadow = true;
    group.add(backMesh);

    var armW = wM * 0.08;
    var armGeo = new THREE.BoxGeometry(armW, hM * 0.65, dM * 0.85);
    [-1, 1].forEach(function (side) {
      var arm = new THREE.Mesh(armGeo, sofaMat);
      arm.position.set(side * (wM * 0.45 - armW / 2), hM * 0.425, 0);
      arm.castShadow = arm.receiveShadow = true;
      group.add(arm);
    });

    var legGeo = new THREE.CylinderGeometry(0.02, 0.02, hM * 0.1);
    [[-wM * 0.42, -dM * 0.38], [wM * 0.42, -dM * 0.38], [-wM * 0.42, dM * 0.38], [wM * 0.42, dM * 0.38]].forEach(
      function (off) {
        var leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(off[0], hM * 0.05, off[1]);
        leg.castShadow = true;
        group.add(leg);
      }
    );
    return;
  }

  if (typeStr.indexOf("bed") >= 0) {
    var bedWood = createWoodLegMaterial();
    var mattressMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    var blanketMat = createFabricMaterial(0x3b82f6, 0.75);

    var frameMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, hM * 0.25, dM), bedWood);
    frameMesh.position.y = hM * 0.125;
    frameMesh.castShadow = frameMesh.receiveShadow = true;
    group.add(frameMesh);

    var headboardMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, hM * 0.9, dM * 0.08), bedWood);
    headboardMesh.position.set(0, hM * 0.45, -dM * 0.46);
    headboardMesh.castShadow = true;
    group.add(headboardMesh);

    var mattressMesh = new THREE.Mesh(new THREE.BoxGeometry(wM * 0.94, hM * 0.4, dM * 0.9), mattressMat);
    mattressMesh.position.set(0, hM * 0.4, dM * 0.03);
    mattressMesh.castShadow = mattressMesh.receiveShadow = true;
    group.add(mattressMesh);

    var blanketMesh = new THREE.Mesh(new THREE.BoxGeometry(wM * 0.96, hM * 0.42, dM * 0.45), blanketMat);
    blanketMesh.position.set(0, hM * 0.41, dM * 0.24);
    blanketMesh.castShadow = blanketMesh.receiveShadow = true;
    group.add(blanketMesh);
    return;
  }

  if (typeStr.indexOf("table") >= 0 || typeStr.indexOf("desk") >= 0) {
    var tableMat = createTableTopMaterial();
    var legMat = createWoodLegMaterial();
    var topMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, 0.04, dM), tableMat);
    topMesh.position.y = hM - 0.02;
    topMesh.castShadow = topMesh.receiveShadow = true;
    group.add(topMesh);
    var legGeo = new THREE.CylinderGeometry(0.025, 0.015, hM - 0.04);
    [[-wM * 0.44, dM * 0.44], [wM * 0.44, dM * 0.44], [-wM * 0.44, -dM * 0.44], [wM * 0.44, -dM * 0.44]].forEach(
      function (off) {
        var leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(off[0], (hM - 0.04) / 2, off[1]);
        leg.castShadow = true;
        group.add(leg);
      }
    );
    return;
  }

  if (typeStr.indexOf("chair") >= 0 || typeStr.indexOf("stool") >= 0) {
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    var seatMat = createFabricMaterial(0xd97706, 0.75);
    var seatMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, hM * 0.08, dM), seatMat);
    seatMesh.position.y = hM * 0.5;
    seatMesh.castShadow = seatMesh.receiveShadow = true;
    group.add(seatMesh);
    var backMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, hM * 0.45, dM * 0.06), seatMat);
    backMesh.position.set(0, hM * 0.755, -dM * 0.47);
    backMesh.castShadow = true;
    group.add(backMesh);
    var legGeo = new THREE.CylinderGeometry(0.015, 0.01, hM * 0.5);
    [[-wM * 0.43, dM * 0.43], [wM * 0.43, dM * 0.43], [-wM * 0.43, -dM * 0.43], [wM * 0.43, -dM * 0.43]].forEach(
      function (off) {
        var leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(off[0], hM * 0.25, off[1]);
        leg.castShadow = true;
        group.add(leg);
      }
    );
    return;
  }

  if (typeStr.indexOf("plant") >= 0 || typeStr.indexOf("tree") >= 0) {
    var potMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    var potMesh = new THREE.Mesh(new THREE.CylinderGeometry(wM * 0.4, wM * 0.26, hM * 0.4, 16), potMat);
    potMesh.position.y = hM * 0.2;
    potMesh.castShadow = potMesh.receiveShadow = true;
    group.add(potMesh);
    var foliage = new THREE.Group();
    foliage.position.y = hM * 0.65;
    foliage.add(new THREE.Mesh(new THREE.SphereGeometry(wM * 0.45, 8, 8), leafMat));
    group.add(foliage);
    return;
  }

  var boxMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, metalness: 0.1 });
  var boxMesh = new THREE.Mesh(new THREE.BoxGeometry(wM, hM, dM), boxMat);
  boxMesh.position.y = hM / 2;
  boxMesh.castShadow = boxMesh.receiveShadow = true;
  group.add(boxMesh);
}

function getSofaHexColor(colorName) {
  var colors = {
    beige: 0xe6dfd3,
    grey: 0x8a8a8a,
    gray: 0x8a8a8a,
    cream: 0xfdf6e2,
    tan: 0xd2b48c,
    brown: 0x6e473b,
    navy: 0x1d3557,
    blue: 0x3b82f6,
    green: 0x2e7d32,
    red: 0xc62828,
    charcoal: 0x334155,
  };
  return colors[String(colorName).toLowerCase()] || 0x475569;
}

function lightenHexColor(hex, percent) {
  var r = (hex >> 16) & 0xff;
  var g = (hex >> 8) & 0xff;
  var b = hex & 0xff;
  r = Math.min(255, Math.floor(r + (255 - r) * percent));
  g = Math.min(255, Math.floor(g + (255 - g) * percent));
  b = Math.min(255, Math.floor(b + (255 - b) * percent));
  return (r << 16) | (g << 8) | b;
}
