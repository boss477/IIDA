/** Floating pill toolbar for selected furniture in 3D view (matches #view3d-bar styling). */

import * as THREE from "three";

var ACTIONS = [
  { id: "rotate", label: "Rotate", title: "Rotate 5°" },
  { id: "replace", label: "Replace", title: "Replace with catalog SKU" },
  { id: "goesWith", label: "Goes with", title: "Link selected items as a set" },
  { id: "copy", label: "Make copy", title: "Duplicate selection" },
  { id: "remove", label: "Remove", title: "Delete selected items" },
];

/**
 * @param {HTMLElement} container
 * @param {{ onAction?: (actionId: string) => void }} callbacks
 */
export function createFurnitureToolbar3d(container, callbacks) {
  var root = document.createElement("div");
  root.id = "view3d-furniture-toolbar";
  root.hidden = true;
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Furniture actions");

  var bar = document.createElement("div");
  bar.className = "view3d-furniture-bar";

  ACTIONS.forEach(function (action, index) {
    if (index > 0) {
      var sep = document.createElement("span");
      sep.className = "view3d-sep";
      bar.appendChild(sep);
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "view3d-btn view3d-furniture-btn";
    btn.dataset.action = action.id;
    btn.textContent = action.label;
    btn.title = action.title;
    if (action.id === "remove") btn.classList.add("view3d-furniture-btn--danger");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (callbacks && callbacks.onAction) callbacks.onAction(action.id);
    });
    bar.appendChild(btn);
  });

  root.appendChild(bar);
  container.appendChild(root);

  var activeGroup = null;
  var _vec = new THREE.Vector3();

  return {
    el: root,
    show: function (group, opts) {
      opts = opts || {};
      activeGroup = group;
      root.hidden = false;
      var goesBtn = root.querySelector('[data-action="goesWith"]');
      if (goesBtn) goesBtn.disabled = !!opts.goesWithDisabled;
    },
    hide: function () {
      activeGroup = null;
      root.hidden = true;
    },
    getActiveGroup: function () {
      return activeGroup;
    },
    /** @param {THREE.Group} group @param {THREE.Camera} camera @param {HTMLElement} dom */
    updatePosition: function (group, camera, dom) {
      var target = group || activeGroup;
      if (!target || root.hidden || !camera || !dom) return;
      var box = new THREE.Box3().setFromObject(target);
      _vec.set((box.min.x + box.max.x) / 2, box.max.y + 0.12, (box.min.z + box.max.z) / 2);
      _vec.project(camera);
      if (_vec.z > 1) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      var w = dom.clientWidth;
      var h = dom.clientHeight;
      var x = (_vec.x * 0.5 + 0.5) * w;
      var y = (-_vec.y * 0.5 + 0.5) * h;
      root.style.left = x + "px";
      root.style.top = y + "px";
    },
  };
}
