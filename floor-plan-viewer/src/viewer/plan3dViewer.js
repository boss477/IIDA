import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resolveCalibration } from "../lib/calibration.js";
import { catalogById } from "../lib/catalogSizing.js";
import { pointInPolygon, polygonArea } from "../lib/geometry.js";
import {
  createFabricMaterial,
  createFloorMaterial,
  createGlassMaterial,
  createTableTopMaterial,
  createWallMaterial,
  createWindowFrameMaterial,
  createWoodLegMaterial,
  disposeMaterials,
} from "./plan3dMaterials.js";
import { addSceneLighting, disposeLighting } from "./plan3dLighting.js";
import {
  computeSceneBounds,
  computeRoomBounds,
  flyToView,
  flyToSideView,
  getRoomSideViews,
  frameCamera,
  updateCameraTransition,
  cancelCameraTransition,
} from "./plan3dCamera.js";
import { createPlan3DInteraction } from "./plan3dInteraction.js";
import {
  createDefaultSofaInstance,
  isSofaTypeStr,
  preloadDefaultSofaGlb,
} from "./plan3dGlb.js";
import { normToWorld } from "./plan3dMove.js";
import { getRoomMeasurementDisplay } from "./planTools.js";
import {
  catalogRowForItem,
  getFurnitureMeasurementLines,
} from "./plan3dMeasure.js";
import { createPlan3DMeasureOverlay } from "./plan3dMeasureOverlay.js";
import { hideTooltip, showMeasureTooltip, showRoomTooltip } from "./tooltip.js";

var scene, camera, renderer, controls;
var animFrameId;
var containerEl;
var activePlanData;
var activePlanImage;
var sceneBounds = null;
var viewMode = "dollhouse";
var sceneContent = null;
var planToWorld = null;
var sceneMetrics = { wReal: 10, hReal: 10 };
var furnitureGroups = [];
var roomFloorMeshes = [];
var interaction = null;
var measureOverlay = null;
var onFurnitureMovedCb = null;
var selectedSideRoom = null;
var hoveredSideRoom = null;
var selectedRoomBounds = null;
var activeSideIndex = -1;
var calibrationState3d = null;
var planImageSize3d = { width: 1000, height: 1000 };

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

  var lightingStats = null;
  buildSceneGeometry();
  preloadDefaultSofaGlb()
    .then(function () {
      refreshSofaGlbMeshes();
      if (measureOverlay && interaction && interaction.getSelected()) {
        measureOverlay.updateForGroup(interaction.getSelected());
      }
    })
    .catch(function (err) {
      console.warn("Default sofa GLB:", err && err.message ? err.message : err);
    });
  if (sceneBounds && planToWorld) {
    lightingStats = addSceneLighting(
      scene,
      sceneBounds,
      activePlanData.rooms || [],
      planToWorld
    );
    frameCamera(camera, controls, sceneBounds, viewMode);
  }

  interaction = createPlan3DInteraction({
    renderer: renderer,
    camera: camera,
    controls: controls,
    scene: scene,
    getFurnitureGroups: function () {
      return furnitureGroups;
    },
    getRoomFloorMeshes: function () {
      return roomFloorMeshes;
    },
    findRoomAtWorld: findRoomAtWorld,
    bounds: sceneBounds,
    wReal: sceneMetrics.wReal,
    hReal: sceneMetrics.hReal,
    rooms: activePlanData.rooms || [],
    onRoomSelected: selectSideRoom,
    onRoomHover: onSideRoomHover,
    onRoomHoverEnd: onSideRoomHoverEnd,
    onRoomHoverGeneral: onRoomHoverGeneral,
    onRoomHoverGeneralEnd: onRoomHoverGeneralEnd,
    onFurnitureHover: onFurnitureHover3D,
    onFurnitureHoverEnd: onFurnitureHoverEnd3D,
    onFurnitureSelect: onFurnitureSelect3D,
    onFurnitureDeselect: onFurnitureDeselect3D,
    isSidePanelOpen: is3DSidePanelOpen,
    isSideRoomPickActive: isSideRoomPickActive,
    onFurnitureMoved: function (item) {
      if (onFurnitureMovedCb) onFurnitureMovedCb(item);
    },
  });

  measureOverlay = createPlan3DMeasureOverlay({
    scene: scene,
    camera: camera,
    container: container,
    findRoomAtWorld: findRoomAtWorld,
    planToWorld: planToWorld,
  });

  set3dHint(default3dHintText());
  syncChromeActive(viewMode);

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    var transitioning = updateCameraTransition(camera);
    if (!transitioning && (!interaction || !interaction.isMoveMode())) controls.update();
    if (interaction) interaction.updateHelper();
    renderer.render(scene, camera);
    if (measureOverlay) measureOverlay.render();
  }
  animate();
}

/** @param {(item: object) => void} cb */
export function set3DFurnitureMovedCallback(cb) {
  onFurnitureMovedCb = cb;
}

export function toggle3DMoveMode() {
  if (!interaction) return false;
  if (interaction.isMoveMode()) {
    interaction.exitMoveMode();
    set3dHint(default3dHintText());
    syncChromeActive("dollhouse");
    return false;
  }
  close3DSidePanel();
  interaction.enterMoveMode();
  set3dHint(default3dHintText());
  syncChromeActive("move");
  return true;
}

export function exit3DMoveMode() {
  if (interaction && interaction.isMoveMode()) {
    interaction.exitMoveMode();
    set3dHint(default3dHintText());
  }
}

function set3dHint(text) {
  var el = document.getElementById("view3d-hint");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

function default3dHintText() {
  if (interaction && interaction.isMoveMode()) {
    return "Drag furniture · snaps to walls";
  }
  return "Hover a room or furniture for measurements";
}

function furnitureMeasureLines(grp) {
  if (!grp) return [];
  var item = grp.userData.furnitureItem;
  var catalog = (activePlanData && activePlanData.furniture_catalog) || [];
  var row = catalogRowForItem(catalog, item);
  var box = new THREE.Box3().setFromObject(grp);
  var center = new THREE.Vector3();
  box.getCenter(center);
  var room = findRoomAtWorld(center.x, center.z);
  return getFurnitureMeasurementLines(
    item,
    row,
    grp,
    room,
    planToWorld,
    sceneBounds
  );
}

function showRoomMeasureTooltip(room, e) {
  var tip = document.getElementById("tip");
  if (!tip || !room || !e) return;
  var measure = getRoomMeasurementDisplay(
    room,
    planImageSize3d.width,
    planImageSize3d.height,
    calibrationState3d
  );
  var displayRoom = {
    name: roomLabel(room),
    dimensions: room.dimensions,
    dimensionsText: room.dimensionsText,
    areaSqFt: room.areaSqFt,
  };
  var tipY = e.clientY + 14;
  if (e.clientY > window.innerHeight - 220) tipY = e.clientY - 100;
  showRoomTooltip(
    tip,
    { clientX: e.clientX, clientY: tipY },
    displayRoom,
    {
      dimLine: measure.dimLine,
      areaLine: measure.areaLine,
      scaleSummary: calibrationState3d ? calibrationState3d.summary : null,
    }
  );
}

function onRoomHoverGeneral(room, e) {
  showRoomMeasureTooltip(room, e);
}

function onRoomHoverGeneralEnd() {
  if (interaction && interaction.getSelected()) return;
  var tip = document.getElementById("tip");
  if (tip && !is3DSidePanelOpen()) hideTooltip(tip);
}

function onFurnitureHover3D(grp, e) {
  var lines = furnitureMeasureLines(grp);
  var tip = document.getElementById("tip");
  if (!tip || !lines.length) return;
  showMeasureTooltip(tip, e, lines[0], lines.slice(1));
}

function onFurnitureHoverEnd3D() {
  if (interaction && interaction.getSelected()) return;
  var tip = document.getElementById("tip");
  if (tip) hideTooltip(tip);
}

function onFurnitureSelect3D(grp) {
  if (measureOverlay) measureOverlay.updateForGroup(grp);
  var lines = furnitureMeasureLines(grp);
  set3dHint(lines.length ? lines.join("\n") : default3dHintText());
}

function onFurnitureDeselect3D() {
  if (measureOverlay) measureOverlay.clear();
  set3dHint(default3dHintText());
  var tip = document.getElementById("tip");
  if (tip) hideTooltip(tip);
}

function syncChromeActive(mode) {
  var ids = ["btn3d-dollhouse", "btn3d-top", "btn3d-side", "btn3d-move"];
  var modes = ["dollhouse", "top", "side", "move"];
  ids.forEach(function (id, i) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle("view3d-btn--active", modes[i] === mode);
  });
}

export function close3DSidePanel() {
  var panel = document.getElementById("view3d-side-panel");
  if (panel) panel.hidden = true;
  if (containerEl) containerEl.classList.remove("view3d-room-pick");
  if (interaction) interaction.setSidePickMode(false);
  document.body.classList.remove("view3d-side-pick-mode");
  onSideRoomHoverEnd();
  if (renderer && renderer.domElement) renderer.domElement.style.cursor = "";
}

export function is3DSidePanelOpen() {
  var panel = document.getElementById("view3d-side-panel");
  return !!(panel && !panel.hidden);
}

export function toggle3DSidePanel() {
  var panel = document.getElementById("view3d-side-panel");
  if (!panel || !sceneBounds) return false;
  if (is3DSidePanelOpen()) {
    close3DSidePanel();
    syncChromeActive(viewMode === "top" ? "top" : viewMode === "side" ? "side" : "dollhouse");
    return false;
  }
  exit3DMoveMode();
  panel.hidden = false;
  if (containerEl) containerEl.classList.add("view3d-room-pick");
  syncChromeActive("side");
  if (selectedSideRoom && selectedRoomBounds) {
    buildSideThumbnails(selectedSideRoom);
    if (interaction) interaction.setSidePickMode(false);
    set3dHint(roomLabel(selectedSideRoom) + " — pick a side view");
  } else {
    showSidePanelPrompt();
    if (interaction) interaction.setSidePickMode(true);
    set3dHint("");
  }
  return true;
}

export function flyTo3DSideView(index) {
  if (!camera || !controls || !selectedRoomBounds) return;
  exit3DMoveMode();
  activeSideIndex = index;
  flyToSideView(camera, controls, selectedRoomBounds, index, 800);
  if (controls) controls.enabled = false;
  viewMode = "side";
  syncChromeActive("side");
  var panel = document.getElementById("view3d-side-panel");
  if (panel) {
    panel.querySelectorAll(".view3d-tcard").forEach(function (card, i) {
      card.classList.toggle("view3d-tcard--active", i === index);
    });
  }
  close3DSidePanel();
}

function roomLabel(room) {
  return room.name || room.id || "Room";
}

function findRoomAtWorld(wx, wz) {
  var rooms = (activePlanData && activePlanData.rooms) || [];
  var wReal = sceneMetrics.wReal;
  var hReal = sceneMetrics.hReal;
  var nx = wx / wReal + 0.5;
  var ny = wz / hReal + 0.5;
  var best = null;
  var bestArea = Infinity;
  rooms.forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    if (!pointInPolygon(nx, ny, room.polygon)) return;
    var area = polygonArea(room.polygon);
    if (area < bestArea) {
      bestArea = area;
      best = room;
    }
  });
  return best;
}

function isSideRoomPickActive() {
  if (interaction && interaction.isMoveMode()) return false;
  if (interaction && interaction.isSidePickMode()) return true;
  return is3DSidePanelOpen();
}

function clearSideRoomSelection() {
  selectedSideRoom = null;
  hoveredSideRoom = null;
  selectedRoomBounds = null;
  activeSideIndex = -1;
  updateRoomFloorHighlight(null, null);
  onSideRoomHoverEnd();
  if (interaction) interaction.setSidePickMode(false);
}

function updateRoomFloorHighlight() {
  roomFloorMeshes.forEach(function (mesh) {
    var mat = mesh.material;
    if (!mat || !mat.emissive) return;
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  });
}

function onSideRoomHover(room, e) {
  if (room === hoveredSideRoom) {
    var tip = document.getElementById("tip");
    if (tip && e) {
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 300) + "px";
      tip.style.top = Math.min(e.clientY + 14, window.innerHeight - 120) + "px";
    }
    return;
  }
  hoveredSideRoom = room;
  updateRoomFloorHighlight(hoveredSideRoom, selectedSideRoom);
  showSidePanelHover(room);
  showRoomMeasureTooltip(room, e);
}

function onSideRoomHoverEnd() {
  hoveredSideRoom = null;
  updateRoomFloorHighlight(null, selectedSideRoom);
  if (interaction && interaction.isSidePickMode() && !selectedSideRoom) {
    showSidePanelPrompt();
  }
  var tip = document.getElementById("tip");
  if (tip) hideTooltip(tip);
}

function showSidePanelPrompt() {
  var panel = document.getElementById("view3d-side-panel");
  if (!panel) return;
  panel.innerHTML =
    '<p class="view3d-side-prompt">Click a room floor in the view</p>';
}

function showSidePanelHover(room) {
  var panel = document.getElementById("view3d-side-panel");
  if (!panel || !room || selectedSideRoom) return;
  panel.innerHTML =
    '<p class="view3d-side-prompt view3d-side-prompt--hover"><strong>' +
    roomLabel(room) +
    "</strong><br>Click to select this room</p>";
}

function selectSideRoom(room) {
  if (!room || !planToWorld) return;
  selectedSideRoom = room;
  hoveredSideRoom = null;
  selectedRoomBounds = computeRoomBounds(room, planToWorld);
  activeSideIndex = -1;
  updateRoomFloorHighlight(null, selectedSideRoom);
  onSideRoomHoverEnd();
  buildSideThumbnails(room);
  if (interaction) interaction.setSidePickMode(false);
  set3dHint(roomLabel(room) + " — pick a side view");
  var panel = document.getElementById("view3d-side-panel");
  if (panel) panel.hidden = false;
  syncChromeActive("side");
}

function buildSideThumbnails(room) {
  var panel = document.getElementById("view3d-side-panel");
  if (!panel || !renderer || !camera || !scene || !room || !planToWorld) return;
  var bounds = computeRoomBounds(room, planToWorld);
  selectedRoomBounds = bounds;
  var views = getRoomSideViews(bounds);
  var sW = renderer.domElement.width;
  var sH = renderer.domElement.height;
  var sP = camera.position.clone();
  var sT = controls.target.clone();
  var sA = camera.aspect;
  var TW = 185;
  var TH = 115;

  panel.innerHTML = "";
  var header = document.createElement("div");
  header.className = "view3d-side-header";
  header.textContent = roomLabel(room);
  panel.appendChild(header);

  var thumbs = document.createElement("div");
  thumbs.className = "view3d-side-thumbs";
  panel.appendChild(thumbs);

  views.forEach(function (sv, idx) {
    renderer.setSize(TW, TH, false);
    camera.position.set(sv.pos[0], sv.pos[1], sv.pos[2]);
    camera.aspect = TW / TH;
    var lt = new THREE.Vector3(sv.look[0], sv.look[1], sv.look[2]);
    camera.lookAt(lt);
    controls.target.copy(lt);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    var url = renderer.domElement.toDataURL("image/jpeg", 0.88);
    var card = document.createElement("button");
    card.type = "button";
    card.className = "view3d-tcard" + (idx === activeSideIndex ? " view3d-tcard--active" : "");
    card.title = sv.label;
    card.innerHTML = '<img src="' + url + '" alt="' + sv.label + ' elevation">';
    card.addEventListener("click", function () {
      flyTo3DSideView(idx);
    });
    thumbs.appendChild(card);
  });

  renderer.setSize(sW, sH, false);
  camera.position.copy(sP);
  camera.aspect = sA;
  controls.target.copy(sT);
  camera.updateProjectionMatrix();
  if (containerEl) resize3D();
}

/**
 * @param {"dollhouse"|"top"} mode
 */
export function set3DViewMode(mode) {
  close3DSidePanel();
  clearSideRoomSelection();
  exit3DMoveMode();
  viewMode = mode === "top" ? "top" : "dollhouse";
  syncChromeActive(viewMode);
  if (!camera || !controls || !sceneBounds) return;
  flyToView(camera, controls, sceneBounds, viewMode, 900);
  if (controls) controls.enabled = false;
}

/**
 * Destroy and clean up 3D engine.
 */
export function dispose3D() {
  cancelCameraTransition();
  close3DSidePanel();
  exit3DMoveMode();
  clearSideRoomSelection();
  roomFloorMeshes = [];
  if (measureOverlay) {
    measureOverlay.dispose();
    measureOverlay = null;
  }
  if (interaction) {
    interaction.dispose();
    interaction = null;
  }
  furnitureGroups = [];
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
  planToWorld = null;
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

/**
 * Window on longest room edge (3.html-style frame + glass).
 */
function addRoomWindow(room, toWorld, wallHeight, matFr, matG, parent) {
  var poly = room.polygon;
  if (!poly || poly.length < 3) return;

  var bestLen = 0;
  var bestA = null;
  var bestB = null;
  for (var i = 0; i < poly.length; i++) {
    var a = toWorld(poly[i]);
    var b = toWorld(poly[(i + 1) % poly.length]);
    var len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > bestLen) {
      bestLen = len;
      bestA = a;
      bestB = b;
    }
  }
  if (bestLen < 1.8 || !bestA) return;

  var midX = (bestA.x + bestB.x) / 2;
  var midZ = (bestA.z + bestB.z) / 2;
  var angle = -Math.atan2(bestB.z - bestA.z, bestB.x - bestA.x);
  var wWin = Math.min(bestLen * 0.35, bestLen - 0.4);
  if (wWin < 0.8) return;

  var wy1 = wallHeight * 0.29;
  var wy2 = wallHeight * 0.94;
  var wH = wy2 - wy1;
  var fcy = wy1 + wH / 2;
  var fw = 0.07;
  var wallZ = 0.12;
  var glassZ = 0.19;
  var paneW = (wWin - fw) / 2;
  var paneOff = (paneW + fw) / 4;

  var g = new THREE.Group();
  g.position.set(midX, 0, midZ);
  g.rotation.y = angle;

  function lm(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  lm(new THREE.BoxGeometry(wWin + fw * 2, fw, 0.12), matFr, 0, wy1, wallZ);
  lm(new THREE.BoxGeometry(wWin + fw * 2, fw, 0.12), matFr, 0, wy2, wallZ);
  lm(new THREE.BoxGeometry(fw, wH, 0.12), matFr, -wWin / 2, fcy, wallZ);
  lm(new THREE.BoxGeometry(fw, wH, 0.12), matFr, wWin / 2, fcy, wallZ);
  lm(new THREE.PlaneGeometry(paneW, wH), matG, -paneOff, fcy, glassZ);
  lm(new THREE.PlaneGeometry(paneW, wH), matG, paneOff, fcy, glassZ);

  parent.add(g);
}

function buildSceneGeometry() {
  if (!activePlanData || !sceneContent) return;

  disposeSceneGraph(sceneContent);
  while (sceneContent.children.length) sceneContent.remove(sceneContent.children[0]);

  var imgW = activePlanImage ? activePlanImage.naturalWidth || 1000 : 1000;
  var imgH = activePlanImage ? activePlanImage.naturalHeight || 1000 : 1000;

  var cal = resolveCalibration(activePlanData.calibration, imgW, imgH);
  calibrationState3d = cal;
  planImageSize3d = { width: imgW, height: imgH };
  var mpp = cal ? cal.metersPerPixel : 12 / Math.max(imgW, imgH);

  var wReal = imgW * mpp;
  var hReal = imgH * mpp;

  function toWorld(pt) {
    return {
      x: (pt.x - 0.5) * wReal,
      z: (pt.y - 0.5) * hReal,
    };
  }

  planToWorld = toWorld;
  sceneMetrics = { wReal: wReal, hReal: hReal };
  sceneBounds = computeSceneBounds(activePlanData.rooms || [], toWorld);
  furnitureGroups = [];
  roomFloorMeshes = [];

  var wallMat = createWallMaterial();
  var matFr = createWindowFrameMaterial();
  var matG = createGlassMaterial();
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
    floorMesh.userData.room = room;
    floorMesh.userData.isRoomFloor = true;
    roomFloorMeshes.push(floorMesh);
    sceneContent.add(floorMesh);

    addRoomWindow(room, toWorld, wallHeight, matFr, matG, sceneContent);
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

  var hasSofaOnPlan = false;
  (activePlanData.furniture || []).forEach(function (item) {
    if (item.x == null || item.y == null) return;
    var g = addFurnitureGroup(item, wReal, hReal);
    if (g && g.userData.isSofaFurniture) hasSofaOnPlan = true;
  });

  if (!hasSofaOnPlan) addDefaultLivingRoomSofa(wReal, hReal);
}

function furnitureDimsForItem(item, catalogRow, wReal, hReal) {
  var wM = 0.6;
  var dM = 0.6;
  var hM = 0.7;

  if (catalogRow) {
    wM = (catalogRow.width_mm || 600) / 1000;
    dM = (catalogRow.depth_mm || catalogRow.length_mm || 600) / 1000;
    hM = (catalogRow.height_mm || 750) / 1000;
  } else {
    var type = furnitureTypeStr(item, catalogRow);
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
  return { wM: wM, dM: dM, hM: hM };
}

function furnitureTypeStr(item, catalogRow) {
  var parts = [
    item.type,
    item.shape,
    item.catalogId,
    item.id,
    catalogRow && catalogRow.shape,
    catalogRow && catalogRow.category,
    catalogRow && catalogRow.product_name,
    catalogRow && catalogRow.name,
  ];
  var typeStr = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return typeStr;
}

function addFurnitureGroup(item, wReal, hReal) {
  var catalog = activePlanData.furniture_catalog || [];
  var catalogRow = catalogById(catalog, item.catalogId);
  var dims = furnitureDimsForItem(item, catalogRow, wReal, hReal);
  var typeStr = furnitureTypeStr(item, catalogRow);

  var group = new THREE.Group();
  group.userData.furnitureItem = item;
  group.userData.isFurniture = true;
  group.userData.furnitureTypeStr = typeStr;
  group.userData.furnitureDims = dims;
  group.userData.isSofaFurniture = isSofaTypeStr(typeStr);

  var wPos = normToWorld({ x: item.x, y: item.y }, wReal, hReal);
  group.position.set(wPos.x, item.z || 0, wPos.z);
  group.rotation.y = -(item.rotationDeg || 0) * Math.PI / 180;

  addFurnitureMeshes(group, typeStr, item, dims.wM, dims.dM, dims.hM);
  group.traverse(function (c) {
    if (c.isMesh) c.userData.furnitureGroup = group;
  });
  sceneContent.add(group);
  furnitureGroups.push(group);
  return group;
}

function findLivingRoom(rooms) {
  for (var i = 0; i < rooms.length; i++) {
    var r = rooms[i];
    var id = String(r.id || "").toLowerCase();
    var name = String(r.name || "").toLowerCase();
    var type = String(r.type || "").toLowerCase();
    if (id.indexOf("living") >= 0 || name.indexOf("living") >= 0 || type === "living") return r;
  }
  return null;
}

function polygonCentroidNorm(poly) {
  var cx = 0;
  var cy = 0;
  for (var i = 0; i < poly.length; i++) {
    cx += poly[i].x;
    cy += poly[i].y;
  }
  return { x: cx / poly.length, y: cy / poly.length };
}

/** Place teal mid-century sofa in living room when plan has no sofa. */
function addDefaultLivingRoomSofa(wReal, hReal) {
  var room = findLivingRoom(activePlanData.rooms || []);
  if (!room || !room.polygon || room.polygon.length < 3) return;

  var c = polygonCentroidNorm(room.polygon);
  var placeholder = {
    id: "__default_sofa__",
    catalogId: null,
    type: "sofa",
    shape: "sofa",
    x: c.x,
    y: c.y,
    rotationDeg: 0,
    isDefaultPlaceholder: true,
  };
  addFurnitureGroup(placeholder, wReal, hReal);
}

function clearFurnitureMeshes(group) {
  var kids = group.children.slice();
  kids.forEach(function (child) {
    group.remove(child);
    disposeSceneGraph(child);
  });
  group.userData.usesGlbSofa = false;
}

function refreshSofaGlbMeshes() {
  var upgraded = 0;
  var skipped = 0;
  furnitureGroups.forEach(function (group) {
    var typeStr = group.userData.furnitureTypeStr || "";
    if (!isSofaTypeStr(typeStr) || group.userData.usesGlbSofa) {
      skipped++;
      return;
    }
    var dims = group.userData.furnitureDims;
    if (!dims) {
      skipped++;
      return;
    }
    var glb = createDefaultSofaInstance(dims.wM, dims.dM, dims.hM);
    if (!glb) {
      skipped++;
      return;
    }
    clearFurnitureMeshes(group);
    group.add(glb);
    group.userData.usesGlbSofa = true;
    upgraded++;
    glb.traverse(function (c) {
      if (c.isMesh) c.userData.furnitureGroup = group;
    });
  });
}

function addFurnitureMeshes(group, typeStr, item, wM, dM, hM) {
  if (isSofaTypeStr(typeStr)) {
    var glbSofa = createDefaultSofaInstance(wM, dM, hM);
    if (glbSofa) {
      group.add(glbSofa);
      group.userData.usesGlbSofa = true;
      return;
    }
  }

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
