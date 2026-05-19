import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resolveCalibration } from "../lib/calibration.js";
import { catalogById } from "../lib/catalogSizing.js";

var scene, camera, renderer, controls;
var animFrameId;
var containerEl;
var activePlanData;
var activePlanImage;

/**
 * Initialize 3D view.
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

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f4f6); // elegant light grey

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 15, 20);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent going below ground
  controls.minDistance = 2;
  controls.maxDistance = 50;

  // Lights
  var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 40;
  var d = 15;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  var dirLight2 = new THREE.DirectionalLight(0xdbeafe, 0.3); // soft blue fill light
  dirLight2.position.set(-10, 10, -15);
  scene.add(dirLight2);

  // Grid Helper
  var grid = new THREE.GridHelper(60, 60, 0xcbd5e1, 0xe2e8f0);
  grid.position.y = -0.01;
  scene.add(grid);

  // Ground Plane
  var groundGeo = new THREE.PlaneGeometry(100, 100);
  var groundMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.9,
    metalness: 0.1,
  });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  // Build Scene Geometry
  buildSceneGeometry();

  // Animation Loop
  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

/**
 * Destroy and clean up 3D engine.
 */
export function dispose3D() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
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

function buildSceneGeometry() {
  if (!activePlanData) return;

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

  // 1. Rooms (Flooring)
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

    var floorGeo = new THREE.ShapeGeometry(shape);
    var color = 0xf1f5f9; // default
    var roughness = 0.8;

    if (room.flooring === "wood") {
      color = 0x8d6e63; // warm wood brown
      roughness = 0.4;
    } else if (room.flooring === "tile") {
      color = 0xd1e8e2; // light ceramic blue
      roughness = 0.2;
    } else if (room.flooring === "kitchen") {
      color = 0x475569; // dark slate grey
      roughness = 0.6;
    } else if (room.flooring === "stone") {
      color = 0x94a3b8; // stone blue-grey
      roughness = 0.9;
    }

    var floorMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: roughness,
      side: THREE.DoubleSide,
    });
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.005; // tiny offset to lay on ground
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
  });

  // 2. Walls
  var walls = activePlanData.walls || [];
  // Fallback: If no walls are defined, generate them from rooms
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

  var wallHeight = 2.7; // standard 2.7m ceiling
  var wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
  });

  walls.forEach(function (wall) {
    var pts = wall.points;
    if (!pts || pts.length < 2) return;
    var thick = (wall.thickness || 0.006) * Math.max(imgW, imgH) * mpp;

    for (var i = 0; i < pts.length - 1; i++) {
      var w1 = toWorld(pts[i]);
      var w2 = toWorld(pts[i + 1]);

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
      scene.add(wallMesh);
    }
  });

  // 3. Furniture
  (activePlanData.furniture || []).forEach(function (item) {
    if (item.x == null || item.y == null) return;

    var catalog = activePlanData.furniture_catalog || [];
    var catalogRow = catalogById(catalog, item.catalogId);

    // Compute dimensions in meters
    var wM = 0.6;
    var dM = 0.6;
    var hM = 0.7;

    if (catalogRow) {
      wM = (catalogRow.width_mm || 600) / 1000;
      dM = (catalogRow.depth_mm || catalogRow.length_mm || 600) / 1000;
      hM = (catalogRow.height_mm || 750) / 1000;
    } else {
      // Fallback using item properties or type defaults
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

    // Assemble stylized furniture representation
    var typeStr = String(item.type || item.shape || "").toLowerCase();
    
    if (typeStr.indexOf("sofa") >= 0 || typeStr.indexOf("lounge") >= 0) {
      // Sofa model
      var sofaColor = 0x475569; // default slate blue
      if (item.sofaColorOverride) {
        sofaColor = getSofaHexColor(item.sofaColorOverride);
      } else if (item.sofaParams && item.sofaParams.color) {
        sofaColor = getSofaHexColor(item.sofaParams.color);
      }

      var sofaMat = new THREE.MeshStandardMaterial({ color: sofaColor, roughness: 0.6 });
      var cushionMat = new THREE.MeshStandardMaterial({ color: lightenHexColor(sofaColor, 0.15), roughness: 0.5 });
      var woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 });

      // Base seat
      var seatGeo = new THREE.BoxGeometry(wM * 0.9, hM * 0.4, dM * 0.85);
      var seatMesh = new THREE.Mesh(seatGeo, cushionMat);
      seatMesh.position.y = hM * 0.3;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      // Backrest
      var backGeo = new THREE.BoxGeometry(wM * 0.9, hM * 0.5, dM * 0.15);
      var backMesh = new THREE.Mesh(backGeo, sofaMat);
      backMesh.position.set(0, hM * 0.65, -dM * 0.35);
      backMesh.castShadow = true;
      backMesh.receiveShadow = true;
      group.add(backMesh);

      // Armrests (left/right)
      var armW = wM * 0.08;
      var armGeo = new THREE.BoxGeometry(armW, hM * 0.65, dM * 0.85);
      
      var leftArm = new THREE.Mesh(armGeo, sofaMat);
      leftArm.position.set(-wM * 0.45 + armW / 2, hM * 0.425, 0);
      leftArm.castShadow = true;
      leftArm.receiveShadow = true;
      group.add(leftArm);

      var rightArm = new THREE.Mesh(armGeo, sofaMat);
      rightArm.position.set(wM * 0.45 - armW / 2, hM * 0.425, 0);
      rightArm.castShadow = true;
      rightArm.receiveShadow = true;
      group.add(rightArm);

      // Short legs
      var legGeo = new THREE.CylinderGeometry(0.02, 0.02, hM * 0.1);
      var legOffsets = [
        [-wM * 0.42, -dM * 0.38],
        [wM * 0.42, -dM * 0.38],
        [-wM * 0.42, dM * 0.38],
        [wM * 0.42, dM * 0.38]
      ];
      legOffsets.forEach(function (offset) {
        var leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(offset[0], hM * 0.05, offset[1]);
        leg.castShadow = true;
        group.add(leg);
      });

    } else if (typeStr.indexOf("bed") >= 0) {
      // Bed model
      var woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7 });
      var mattressMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      var blanketMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 }); // nice blue blanket

      // Bed frame / Headboard
      var frameGeo = new THREE.BoxGeometry(wM, hM * 0.25, dM);
      var frameMesh = new THREE.Mesh(frameGeo, woodMat);
      frameMesh.position.y = hM * 0.125;
      frameMesh.castShadow = true;
      frameMesh.receiveShadow = true;
      group.add(frameMesh);

      var headboardGeo = new THREE.BoxGeometry(wM, hM * 0.9, dM * 0.08);
      var headboardMesh = new THREE.Mesh(headboardGeo, woodMat);
      headboardMesh.position.set(0, hM * 0.45, -dM * 0.46);
      headboardMesh.castShadow = true;
      group.add(headboardMesh);

      // Mattress
      var mattressGeo = new THREE.BoxGeometry(wM * 0.94, hM * 0.4, dM * 0.9);
      var mattressMesh = new THREE.Mesh(mattressGeo, mattressMat);
      mattressMesh.position.set(0, hM * 0.4, dM * 0.03);
      mattressMesh.castShadow = true;
      mattressMesh.receiveShadow = true;
      group.add(mattressMesh);

      // Blanket folded at bottom
      var blanketGeo = new THREE.BoxGeometry(wM * 0.96, hM * 0.42, dM * 0.45);
      var blanketMesh = new THREE.Mesh(blanketGeo, blanketMat);
      blanketMesh.position.set(0, hM * 0.41, dM * 0.24);
      blanketMesh.castShadow = true;
      blanketMesh.receiveShadow = true;
      group.add(blanketMesh);

      // Pillows
      var pillowGeo = new THREE.BoxGeometry(wM * 0.38, hM * 0.08, dM * 0.16);
      
      var pillow1 = new THREE.Mesh(pillowGeo, mattressMat);
      pillow1.position.set(-wM * 0.2, hM * 0.63, -dM * 0.3);
      pillow1.rotation.x = 0.1;
      group.add(pillow1);

      var pillow2 = new THREE.Mesh(pillowGeo, mattressMat);
      pillow2.position.set(wM * 0.2, hM * 0.63, -dM * 0.3);
      pillow2.rotation.x = 0.1;
      group.add(pillow2);

    } else if (typeStr.indexOf("table") >= 0 || typeStr.indexOf("desk") >= 0) {
      // Table model
      var woodMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.6 }); // rich dark mahogany

      // Tabletop
      var topGeo = new THREE.BoxGeometry(wM, 0.04, dM);
      var topMesh = new THREE.Mesh(topGeo, woodMat);
      topMesh.position.y = hM - 0.02;
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      group.add(topMesh);

      // 4 Legs
      var legGeo = new THREE.CylinderGeometry(0.025, 0.015, hM - 0.04);
      var legOffsets = [
        [-wM * 0.44, dM * 0.44],
        [wM * 0.44, dM * 0.44],
        [-wM * 0.44, -dM * 0.44],
        [wM * 0.44, -dM * 0.44]
      ];
      legOffsets.forEach(function (offset) {
        var leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(offset[0], (hM - 0.04) / 2, offset[1]);
        leg.castShadow = true;
        group.add(leg);
      });

    } else if (typeStr.indexOf("chair") >= 0 || typeStr.indexOf("stool") >= 0) {
      // Chair model
      var frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }); // dark charcoal frame
      var seatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }); // orange upholstery

      // Seat cushion
      var seatGeo = new THREE.BoxGeometry(wM, hM * 0.08, dM);
      var seatMesh = new THREE.Mesh(seatGeo, seatMat);
      seatMesh.position.y = hM * 0.5;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      // Backrest
      var backGeo = new THREE.BoxGeometry(wM, hM * 0.45, dM * 0.06);
      var backMesh = new THREE.Mesh(backGeo, seatMat);
      backMesh.position.set(0, hM * 0.755, -dM * 0.47);
      backMesh.castShadow = true;
      group.add(backMesh);

      // Backrest frame posts
      var postGeo = new THREE.CylinderGeometry(0.012, 0.012, hM * 0.5);
      var post1 = new THREE.Mesh(postGeo, frameMat);
      post1.position.set(-wM * 0.45, hM * 0.7, -dM * 0.47);
      group.add(post1);
      var post2 = new THREE.Mesh(postGeo, frameMat);
      post2.position.set(wM * 0.45, hM * 0.7, -dM * 0.47);
      group.add(post2);

      // Legs
      var legGeo = new THREE.CylinderGeometry(0.015, 0.01, hM * 0.5);
      var legOffsets = [
        [-wM * 0.43, dM * 0.43],
        [wM * 0.43, dM * 0.43],
        [-wM * 0.43, -dM * 0.43],
        [wM * 0.43, -dM * 0.43]
      ];
      legOffsets.forEach(function (offset) {
        var leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(offset[0], hM * 0.25, offset[1]);
        leg.castShadow = true;
        group.add(leg);
      });

    } else if (typeStr.indexOf("plant") >= 0 || typeStr.indexOf("tree") >= 0) {
      // Plant model
      var potMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }); // terracotta pot
      var soilMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }); // green leaves

      // Pot
      var potGeo = new THREE.CylinderGeometry(wM * 0.4, wM * 0.26, hM * 0.4, 16);
      var potMesh = new THREE.Mesh(potGeo, potMat);
      potMesh.position.y = hM * 0.2;
      potMesh.castShadow = true;
      potMesh.receiveShadow = true;
      group.add(potMesh);

      // Soil inside pot
      var soilGeo = new THREE.CylinderGeometry(wM * 0.38, wM * 0.38, 0.02, 16);
      var soilMesh = new THREE.Mesh(soilGeo, soilMat);
      soilMesh.position.y = hM * 0.39;
      group.add(soilMesh);

      // Sphere clusters representing leaves
      var foliage = new THREE.Group();
      foliage.position.y = hM * 0.65;
      
      var f1 = new THREE.Mesh(new THREE.SphereGeometry(wM * 0.45, 8, 8), leafMat);
      f1.castShadow = true;
      foliage.add(f1);

      var f2 = new THREE.Mesh(new THREE.SphereGeometry(wM * 0.35, 8, 8), leafMat);
      f2.position.set(wM * 0.2, wM * 0.25, -wM * 0.1);
      f2.castShadow = true;
      foliage.add(f2);

      var f3 = new THREE.Mesh(new THREE.SphereGeometry(wM * 0.3, 8, 8), leafMat);
      f3.position.set(-wM * 0.22, wM * 0.18, wM * 0.15);
      f3.castShadow = true;
      foliage.add(f3);

      group.add(foliage);

    } else {
      // Generic item box representation
      var boxMat = new THREE.MeshStandardMaterial({
        color: 0xd1d5db, // cool grey
        roughness: 0.7,
        metalness: 0.1,
      });
      var boxGeo = new THREE.BoxGeometry(wM, hM, dM);
      var boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.y = hM / 2;
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      group.add(boxMesh);
    }

    scene.add(group);
  });
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
