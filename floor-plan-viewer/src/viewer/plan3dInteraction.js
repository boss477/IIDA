import * as THREE from "three";
import { resolvePosition3D, applyWorldPositionToItem } from "./plan3dMove.js";

var FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var _dragPt = new THREE.Vector3();

/**
 * @param {object} opts
 * @param {THREE.WebGLRenderer} opts.renderer
 * @param {THREE.PerspectiveCamera} opts.camera
 * @param {import("three/examples/jsm/controls/OrbitControls.js").OrbitControls} opts.controls
 * @param {THREE.Scene} opts.scene
 * @param {() => THREE.Group[]} opts.getFurnitureGroups
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} opts.bounds
 * @param {number} opts.wReal
 * @param {number} opts.hReal
 * @param {Array} opts.rooms
 * @param {() => THREE.Mesh[]} opts.getRoomFloorMeshes
 * @param {(wx: number, wz: number) => object | null} opts.findRoomAtWorld
 * @param {(room: object) => void} [opts.onRoomSelected]
 * @param {(room: object, e: MouseEvent) => void} [opts.onRoomHover]
 * @param {() => void} [opts.onRoomHoverEnd]
 * @param {(room: object, e: MouseEvent) => void} [opts.onRoomHoverGeneral]
 * @param {() => void} [opts.onRoomHoverGeneralEnd]
 * @param {(group: THREE.Group, e: MouseEvent) => void} [opts.onFurnitureHover]
 * @param {() => void} [opts.onFurnitureHoverEnd]
 * @param {(group: THREE.Group) => void} [opts.onFurnitureSelect]
 * @param {() => void} [opts.onFurnitureDeselect]
 * @param {() => THREE.Mesh[]} [opts.getWallMeshes]
 * @param {(mesh: THREE.Mesh) => void} [opts.onWallSelect]
 * @param {() => void} [opts.onWallDeselect]
 * @param {() => boolean} [opts.isSidePanelOpen]
 * @param {() => boolean} [opts.isSideRoomPickActive]
 * @param {(item: object) => void} [opts.onFurnitureMoved]
 */
export function createPlan3DInteraction(opts) {
  var raycaster = new THREE.Raycaster();
  var mouse2 = new THREE.Vector2();
  var moveMode = false;
  var sidePickMode = false;
  var isDragging = false;
  var dragTarget = null;
  var dragOX = 0;
  var dragOZ = 0;
  var selected = null;
  var boxHelper = new THREE.BoxHelper(new THREE.Object3D(), 0xffcc00);
  boxHelper.material.linewidth = 2;
  boxHelper.visible = false;
  opts.scene.add(boxHelper);

  var dom = opts.renderer.domElement;

  function getNDC(e) {
    var r = dom.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -(((e.clientY - r.top) / r.height) * 2 - 1),
    };
  }

  function pickFurniture(e) {
    var nd = getNDC(e);
    mouse2.set(nd.x, nd.y);
    raycaster.setFromCamera(mouse2, opts.camera);
    var meshes = [];
    opts.getFurnitureGroups().forEach(function (fg) {
      fg.traverse(function (c) {
        if (c.isMesh) meshes.push(c);
      });
    });
    var hits = raycaster.intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.furnitureGroup : null;
  }

  function floorHit(e) {
    var nd = getNDC(e);
    mouse2.set(nd.x, nd.y);
    raycaster.setFromCamera(mouse2, opts.camera);
    if (!raycaster.ray.intersectPlane(FLOOR_PLANE, _dragPt)) return null;
    return _dragPt;
  }

  function pickRoom(e) {
    var nd = getNDC(e);
    mouse2.set(nd.x, nd.y);
    raycaster.setFromCamera(mouse2, opts.camera);
    var pt = null;
    var floors = opts.getRoomFloorMeshes ? opts.getRoomFloorMeshes() : [];
    if (floors.length) {
      var hits = raycaster.intersectObjects(floors, false);
      if (hits.length) {
        hits.sort(function (a, b) {
          return a.distance - b.distance;
        });
        pt = hits[0].point;
      }
    }
    if (!pt) {
      var fp = floorHit(e);
      if (!fp) return null;
      pt = fp;
    }
    if (!opts.findRoomAtWorld) return null;
    return opts.findRoomAtWorld(pt.x, pt.z);
  }

  function pickWall(e) {
    var nd = getNDC(e);
    mouse2.set(nd.x, nd.y);
    raycaster.setFromCamera(mouse2, opts.camera);
    var walls = opts.getWallMeshes ? opts.getWallMeshes() : [];
    if (!walls.length) return null;
    var hits = raycaster.intersectObjects(walls, false);
    return hits.length ? hits[0].object : null;
  }

  function isRoomPickActive() {
    if (moveMode) return false;
    if (opts.isSideRoomPickActive) return opts.isSideRoomPickActive();
    if (sidePickMode) return true;
    return !!(opts.isSidePanelOpen && opts.isSidePanelOpen());
  }

  function selectGroup(grp) {
    selected = grp;
    boxHelper.setFromObject(grp);
    boxHelper.visible = true;
    document.body.classList.add("view3d-has-selection");
  }

  function deselect() {
    selected = null;
    boxHelper.visible = false;
    document.body.classList.remove("view3d-has-selection");
    if (opts.onFurnitureDeselect) opts.onFurnitureDeselect();
  }

  function onPointerDown(e) {
    if (!moveMode) return;
    var grp = pickFurniture(e);
    if (!grp) return;
    var fp = floorHit(e);
    if (!fp) return;
    dragOX = grp.position.x - fp.x;
    dragOZ = grp.position.z - fp.z;
    dragTarget = grp;
    isDragging = true;
    selectGroup(grp);
    if (opts.onFurnitureSelect) opts.onFurnitureSelect(grp);
    document.body.classList.add("view3d-dragging");
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e) {
    if (moveMode && isDragging && dragTarget) {
      var fp = floorHit(e);
      if (!fp) return;
      var item = dragTarget.userData.furnitureItem;
      if (!item) return;
      var r = resolvePosition3D(
        dragTarget,
        fp.x + dragOX,
        fp.z + dragOZ,
        opts.bounds,
        opts.getFurnitureGroups()
      );
      dragTarget.position.set(r.x, dragTarget.position.y, r.z);
      applyWorldPositionToItem(
        dragTarget,
        item,
        r.x,
        r.z,
        opts.wReal,
        opts.hReal,
        opts.rooms
      );
      boxHelper.update();
      if (opts.onFurnitureMoved) opts.onFurnitureMoved(item);
      if (opts.onFurnitureSelect) opts.onFurnitureSelect(dragTarget);
      return;
    }

    if (isRoomPickActive()) {
      var roomSide = pickRoom(e);
      if (roomSide) {
        dom.style.cursor = "pointer";
        if (opts.onRoomHover) opts.onRoomHover(roomSide, e);
      } else {
        dom.style.cursor = "crosshair";
        if (opts.onRoomHoverEnd) opts.onRoomHoverEnd();
      }
      return;
    }

    var grpHover = pickFurniture(e);
    if (grpHover && opts.onFurnitureHover) {
      dom.style.cursor = moveMode ? "grab" : "pointer";
      opts.onFurnitureHover(grpHover, e);
    } else {
      if (opts.onFurnitureHoverEnd) opts.onFurnitureHoverEnd();
      var wallHover = pickWall(e);
      if (wallHover) {
        dom.style.cursor = "pointer";
      } else {
        var roomGen = pickRoom(e);
        if (roomGen && opts.onRoomHoverGeneral) {
          dom.style.cursor = "pointer";
          opts.onRoomHoverGeneral(roomGen, e);
        } else {
          dom.style.cursor = moveMode ? "grab" : "";
          if (opts.onRoomHoverGeneralEnd) opts.onRoomHoverGeneralEnd();
        }
      }
    }
  }

  function onPointerUp() {
    if (!moveMode || !isDragging) return;
    isDragging = false;
    dragTarget = null;
    document.body.classList.remove("view3d-dragging");
  }

  function onClick(e) {
    if (moveMode) return;
    if (isRoomPickActive()) {
      var room = pickRoom(e);
      if (room && opts.onRoomSelected) {
        opts.onRoomSelected(room);
        return;
      }
      if (sidePickMode) return;
    }
    var grp = pickFurniture(e);
    if (grp) {
      if (opts.onWallDeselect) opts.onWallDeselect();
      selectGroup(grp);
      if (opts.onFurnitureSelect) opts.onFurnitureSelect(grp);
      return;
    }
    var wall = pickWall(e);
    if (wall && opts.onWallSelect) {
      deselect();
      opts.onWallSelect(wall);
      return;
    }
    if (opts.onWallDeselect) opts.onWallDeselect();
    deselect();
  }

  dom.addEventListener("mousedown", onPointerDown);
  dom.addEventListener("mousemove", onPointerMove);
  dom.addEventListener("mouseup", onPointerUp);
  dom.addEventListener("click", onClick);

  opts.controls.addEventListener("start", function () {
    if (moveMode) return;
  });

  return {
    enterMoveMode: function () {
      moveMode = true;
      opts.controls.enabled = false;
      document.body.classList.add("view3d-move-mode");
    },
    exitMoveMode: function () {
      moveMode = false;
      isDragging = false;
      dragTarget = null;
      opts.controls.enabled = true;
      document.body.classList.remove("view3d-move-mode", "view3d-dragging");
    },
    isMoveMode: function () {
      return moveMode;
    },
    setSidePickMode: function (on) {
      sidePickMode = !!on;
      document.body.classList.toggle("view3d-side-pick-mode", sidePickMode);
      if (sidePickMode) deselect();
    },
    isSidePickMode: function () {
      return sidePickMode;
    },
    getSelected: function () {
      return selected;
    },
    select: function (grp) {
      if (!grp) return;
      selectGroup(grp);
      if (opts.onFurnitureSelect) opts.onFurnitureSelect(grp);
    },
    deselect: deselect,
    updateHelper: function () {
      if (selected) boxHelper.update();
    },
    dispose: function () {
      dom.removeEventListener("mousedown", onPointerDown);
      dom.removeEventListener("mousemove", onPointerMove);
      dom.removeEventListener("mouseup", onPointerUp);
      dom.removeEventListener("click", onClick);
      opts.scene.remove(boxHelper);
      boxHelper.geometry.dispose();
      deselect();
      dom.style.cursor = "";
      document.body.classList.remove(
        "view3d-move-mode",
        "view3d-dragging",
        "view3d-has-selection",
        "view3d-side-pick-mode"
      );
    },
  };
}
