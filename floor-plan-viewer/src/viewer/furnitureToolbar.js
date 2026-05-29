/** Floating action bar for selected furniture in 2D plan view. */

var ACTIONS = [
  { id: "rotate", label: "Rotate", title: "Rotate 5° ( ] )" },
  { id: "replace", label: "Replace", title: "Replace primary item (header SKU)" },
  { id: "goesWith", label: "Goes with", title: "Link selected items as a set" },
  { id: "copy", label: "Make copy", title: "Duplicate selection with offset" },
  { id: "remove", label: "Remove", title: "Delete selected items" },
];

export function createFurnitureToolbar(planWrap, callbacks) {
  var root = document.createElement("div");
  root.className = "furniture-floating-toolbar";
  root.hidden = true;
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Furniture actions");

  var hintEl = document.createElement("div");
  hintEl.className = "furniture-floating-toolbar__hint";
  hintEl.hidden = true;

  var btnRow = document.createElement("div");
  btnRow.className = "furniture-floating-toolbar__actions";

  ACTIONS.forEach(function (action) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "furniture-floating-toolbar__btn";
    btn.dataset.action = action.id;
    btn.textContent = action.label;
    btn.title = action.title;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (callbacks && callbacks.onAction) callbacks.onAction(action.id);
    });
    btnRow.appendChild(btn);
  });

  root.appendChild(hintEl);
  root.appendChild(btnRow);
  planWrap.appendChild(root);

  function setHint(text) {
    if (!text) {
      hintEl.hidden = true;
      hintEl.textContent = "";
      return;
    }
    hintEl.hidden = false;
    hintEl.textContent = text;
  }

  function updatePosition(screenRect) {
    if (!screenRect || root.hidden) return;
    var wrap = planWrap.getBoundingClientRect();
    var cx = screenRect.left + screenRect.width / 2 - wrap.left;
    var top = screenRect.top - wrap.top - 8;
    root.style.left = cx + "px";
    root.style.top = top + "px";
    root.style.transform = "translate(-50%, -100%)";
  }

  return {
    el: root,
    show: function (screenRect, opts) {
      opts = opts || {};
      root.hidden = false;
      var goesBtn = root.querySelector('[data-action="goesWith"]');
      if (goesBtn) {
        goesBtn.disabled = !!(opts.goesWithDisabled);
      }
      setHint(opts.hint || "");
      updatePosition(screenRect);
    },
    hide: function () {
      root.hidden = true;
      setHint("");
    },
    reposition: updatePosition,
    setHint: setHint,
  };
}

/** Bounding box of selected furniture groups in screen coordinates. */
export function selectionScreenRect(overlay, selectedIds) {
  if (!overlay || !selectedIds || !selectedIds.length) return null;
  var idSet = {};
  selectedIds.forEach(function (id) {
    idSet[id] = true;
  });
  var nodes = overlay.querySelectorAll("[data-furniture-id]");
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  var found = false;
  nodes.forEach(function (node) {
    var id = node.getAttribute("data-furniture-id");
    if (!idSet[id]) return;
    var box = node.getBoundingClientRect();
    if (!box.width && !box.height) return;
    found = true;
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  });
  if (!found) return null;
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
    right: maxX,
    bottom: maxY,
  };
}
