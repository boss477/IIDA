import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { formatLength, wallClearancesToRoom } from "./plan3dMeasure.js";

var DIM_COLOR = 0xffcc00;
var WALL_COLOR = 0x2563eb;
var LINE_LIFT = 0.06;
var MIN_WALL_LINE_M = 0.04;

/**
 * In-scene measurement lines + CSS2D labels (Coohom-style).
 * @param {object} opts
 * @param {THREE.Scene} opts.scene
 * @param {THREE.Camera} opts.camera
 * @param {HTMLElement} opts.container
 * @param {(wx: number, wz: number) => object|null} opts.findRoomAtWorld
 * @param {(pt: {x:number,y:number}) => {x:number,z:number}} opts.planToWorld
 */
export function createPlan3DMeasureOverlay(opts) {
  var scene = opts.scene;
  var camera = opts.camera;
  var container = opts.container;
  var findRoomAtWorld = opts.findRoomAtWorld;
  var planToWorld = opts.planToWorld;

  var root = new THREE.Group();
  root.name = "measureOverlay";
  scene.add(root);

  var lineMatDim = new THREE.LineBasicMaterial({ color: DIM_COLOR });
  var lineMatWall = new THREE.LineBasicMaterial({ color: WALL_COLOR });

  var css2d = new CSS2DRenderer();
  css2d.domElement.style.position = "absolute";
  css2d.domElement.style.top = "0";
  css2d.domElement.style.left = "0";
  css2d.domElement.style.pointerEvents = "none";
  css2d.domElement.style.zIndex = "2";
  container.appendChild(css2d.domElement);

  var labelEls = [];

  function clear() {
    while (root.children.length) {
      var child = root.children[0];
      root.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
    labelEls.forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    labelEls = [];
  }

  function addSegment(a, b, mat) {
    var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    root.add(new THREE.Line(geo, mat));
  }

  function addLabel(text, position, kind) {
    var div = document.createElement("div");
    div.className = "measure3d-label measure3d-label--" + kind;
    div.textContent = text;
    labelEls.push(div);
    var obj = new CSS2DObject(div);
    obj.position.copy(position);
    root.add(obj);
  }

  function midpoint(a, b, target) {
    return target.copy(a).add(b).multiplyScalar(0.5);
  }

  function updateForGroup(group) {
    clear();
    if (!group) return;

    var box = new THREE.Box3().setFromObject(group);
    var size = new THREE.Vector3();
    box.getSize(size);
    var center = new THREE.Vector3();
    box.getCenter(center);
    var yBase = box.min.y + LINE_LIFT;
    var yWall = box.min.y + Math.min(size.y * 0.4, 0.5) + LINE_LIFT;
    var midPt = new THREE.Vector3();

    var room = findRoomAtWorld(center.x, center.z);
    var clearances = room && planToWorld ? wallClearancesToRoom(box, room, planToWorld) : null;
    var rb = clearances && clearances.roomBounds;

    if (rb && clearances) {
      var cz = center.z;
      var cx = center.x;
      if (clearances.left >= MIN_WALL_LINE_M) {
        var l0 = new THREE.Vector3(box.min.x, yWall, cz);
        var l1 = new THREE.Vector3(rb.minX, yWall, cz);
        addSegment(l0, l1, lineMatWall);
        addLabel(formatLength(clearances.left), midpoint(l0, l1, midPt), "wall");
      }
      if (clearances.right >= MIN_WALL_LINE_M) {
        var r0 = new THREE.Vector3(box.max.x, yWall, cz);
        var r1 = new THREE.Vector3(rb.maxX, yWall, cz);
        addSegment(r0, r1, lineMatWall);
        addLabel(formatLength(clearances.right), midpoint(r0, r1, midPt), "wall");
      }
      if (clearances.back >= MIN_WALL_LINE_M) {
        var b0 = new THREE.Vector3(cx, yWall, box.min.z);
        var b1 = new THREE.Vector3(cx, yWall, rb.minZ);
        addSegment(b0, b1, lineMatWall);
        addLabel(formatLength(clearances.back), midpoint(b0, b1, midPt), "wall");
      }
      if (clearances.front >= MIN_WALL_LINE_M) {
        var f0 = new THREE.Vector3(cx, yWall, box.max.z);
        var f1 = new THREE.Vector3(cx, yWall, rb.maxZ);
        addSegment(f0, f1, lineMatWall);
        addLabel(formatLength(clearances.front), midpoint(f0, f1, midPt), "wall");
      }
    }

    var w0 = new THREE.Vector3(box.min.x, yBase, box.min.z);
    var w1 = new THREE.Vector3(box.max.x, yBase, box.min.z);
    var d1 = new THREE.Vector3(box.max.x, yBase, box.max.z);
    var h0 = new THREE.Vector3(box.max.x, box.min.y, box.max.z);
    var h1 = new THREE.Vector3(box.max.x, box.max.y, box.max.z);

    addSegment(w0, w1, lineMatDim);
    addLabel("W " + formatLength(size.x), midpoint(w0, w1, midPt), "dim");

    addSegment(w1, d1, lineMatDim);
    addLabel("D " + formatLength(size.z), midpoint(w1, d1, midPt), "dim");

    addSegment(h0, h1, lineMatDim);
    addLabel("H " + formatLength(size.y), midpoint(h0, h1, midPt), "dim");
  }

  function render() {
    if (!container || !camera) return;
    css2d.setSize(container.clientWidth, container.clientHeight);
    css2d.render(scene, camera);
  }

  function dispose() {
    clear();
    scene.remove(root);
    lineMatDim.dispose();
    lineMatWall.dispose();
    if (css2d.domElement.parentNode) {
      css2d.domElement.parentNode.removeChild(css2d.domElement);
    }
  }

  return {
    updateForGroup: updateForGroup,
    clear: clear,
    render: render,
    dispose: dispose,
  };
}
