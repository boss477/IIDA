import { WALL_COLOR_HEX, WALL_COLOR_OPTIONS } from "./planTools.js";

/**
 * Wall paint button + swatch palette for the 3D chrome bar.
 * @param {{ onTogglePaint: () => void, onPickColor: (presetId: string) => void, getActiveColor: () => string }} opts
 */
export function mountWallPaintUi(opts) {
  opts = opts || {};
  var bar = document.getElementById("view3d-bar");
  if (!bar) return null;

  var wrap = document.createElement("div");
  wrap.className = "view3d-wall-paint";
  wrap.id = "view3d-wall-paint";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "view3d-btn";
  btn.id = "btn3d-paint";
  btn.setAttribute("data-mode", "paint");
  btn.textContent = "Paint";

  var palette = document.createElement("div");
  palette.className = "view3d-wall-palette";
  palette.id = "view3d-wall-palette";
  palette.hidden = true;

  var toggleSwatch = document.createElement("button");
  toggleSwatch.type = "button";
  toggleSwatch.className = "wall-swatch wall-swatch--toggle";
  toggleSwatch.disabled = true;
  toggleSwatch.title = "Active color";
  toggleSwatch.style.background = WALL_COLOR_HEX["warm-white"];
  palette.appendChild(toggleSwatch);

  WALL_COLOR_OPTIONS.forEach(function (opt) {
    var sw = document.createElement("button");
    sw.type = "button";
    sw.className = "wall-swatch";
    sw.setAttribute("data-preset", opt.value);
    sw.title = opt.label;
    sw.style.background = WALL_COLOR_HEX[opt.value] || "#f5f2ec";
    sw.addEventListener("click", function (e) {
      e.stopPropagation();
      if (opts.onPickColor) opts.onPickColor(opt.value);
      setActiveSwatch(opt.value);
    });
    palette.appendChild(sw);
  });

  function setActiveSwatch(presetId) {
    var hex = WALL_COLOR_HEX[presetId] || WALL_COLOR_HEX["warm-white"];
    toggleSwatch.style.background = hex;
    palette.querySelectorAll(".wall-swatch[data-preset]").forEach(function (el) {
      el.classList.toggle("wall-swatch--active", el.getAttribute("data-preset") === presetId);
    });
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (opts.onTogglePaint) opts.onTogglePaint();
  });

  document.addEventListener("click", function () {
    if (palette.hidden) return;
    palette.hidden = true;
    wrap.classList.remove("view3d-wall-paint--open");
  });

  palette.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  wrap.appendChild(btn);
  wrap.appendChild(palette);

  var sep = document.createElement("span");
  sep.className = "view3d-sep";
  bar.appendChild(sep);
  bar.appendChild(wrap);

  setActiveSwatch(opts.getActiveColor ? opts.getActiveColor() : "warm-white");

  return {
    setActiveColor: setActiveSwatch,
    setPaintActive: function (active) {
      btn.classList.toggle("view3d-btn--active", !!active);
    },
    openPalette: function () {
      palette.hidden = false;
      wrap.classList.add("view3d-wall-paint--open");
    },
    closePalette: function () {
      palette.hidden = true;
      wrap.classList.remove("view3d-wall-paint--open");
    },
  };
}
