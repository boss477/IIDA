import {
  polygonAreaSqMFromNorm,
  resolveCalibration,
} from "../lib/calibration.js";
import { pointInPolygon, polygonArea } from "../lib/geometry.js";
import {
  analyzeFloorPlan,
  fileToImageBase64,
  isVisionConfigured,
} from "../services/vision.js";
import { uploadPlanRaster } from "../services/supabase.js";
import { bindPlanFileInput } from "../upload/uploadDropzone.js";
import { renderPlan } from "./svgRenderer.js";
import { updateRoomHighlight } from "./roomOverlay.js";
import { hideTooltip, showRoomTooltip } from "./tooltip.js";
import { mountToolbar } from "./toolbar.js";
import {
  animateFurnitureDragEnd,
  animateFurnitureDragStart,
  animateFurnitureSelect,
  focusRoomCamera,
  killPlanTweens,
} from "./planAnimations.js";

var PLAN_SIZE = { width: 1000, height: 1000 };

export function initFloorPlanViewer() {
  var plan = document.getElementById("plan");
  var overlay = document.getElementById("overlay");
  var viewport = document.getElementById("viewport");
  var content = document.getElementById("content");
  var planWrap = document.getElementById("planWrap");
  var tip = document.getElementById("tip");
  var toolbarEl = document.getElementById("toolbar");

  var data = {
    analysisVersion: "1.0",
    label: "",
    rooms: [],
    walls: [],
    furniture: [],
    furniture_catalog: [],
    doors: [],
    windows: [],
    calibration: null,
  };
  var calibrationState = null;
  var s = 1;
  var tx = 0;
  var ty = 0;
  var drag = null;
  var furnitureDrag = null;
  var cameraTween = null;
  var activeRoomId = null;
  var selectedFurnitureId = null;
  var lastOpenedFile = null;

  var llmStatus = document.createElement("span");
  llmStatus.className = "llm-status";
  llmStatus.setAttribute("aria-live", "polite");
  var serverModel =
    typeof window !== "undefined" && window.__SERVER_VISION_MODEL__
      ? String(window.__SERVER_VISION_MODEL__)
      : "";
  var serverProvider =
    typeof window !== "undefined" && window.__SERVER_VISION_PROVIDER__
      ? String(window.__SERVER_VISION_PROVIDER__)
      : "gemini";
  llmStatus.textContent = isVisionConfigured()
    ? serverModel
      ? "LLM: " + serverProvider + " / " + serverModel + " (after Open image)"
      : "LLM: Gemini vision (after Open image)"
    : "LLM: run npm start (Gemini via /api/analyze)";

  function setLlmStatus(msg) {
    llmStatus.textContent = msg;
  }

  var replaceSel = document.createElement("select");
  replaceSel.setAttribute("aria-label", "Replace selected furniture");
  replaceSel.disabled = true;

  var hint = document.createElement("span");
  hint.className = "toolbar-hint";
  hint.textContent =
    "Click a piece to select · drag to move · double-click room to focus · [ ] rotate · arrows nudge · Esc deselect";

  var scaleEl = document.createElement("span");
  scaleEl.className = "calibration-scale";
  scaleEl.textContent = "Scale: load plan + JSON calibration";

  function refreshCalibration() {
    if (!plan.naturalWidth || !plan.naturalHeight) {
      calibrationState = null;
      scaleEl.textContent = "Scale: load a floor plan image first";
      return;
    }
    if (!data.calibration) {
      calibrationState = null;
      scaleEl.textContent = "Scale: optional (room labels show printed dimensions)";
      return;
    }
    calibrationState = resolveCalibration(
      data.calibration,
      plan.naturalWidth,
      plan.naturalHeight
    );
    scaleEl.textContent = calibrationState
      ? "Scale: " + calibrationState.summary
      : "Scale: calibration segments invalid";
  }

  function syncReplaceSelect() {
    replaceSel.innerHTML = "";
    (data.furniture_catalog || []).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      replaceSel.appendChild(o);
    });
    if (selectedFurnitureId) {
      var item = data.furniture.find(function (f) {
        return f.id === selectedFurnitureId;
      });
      if (item) replaceSel.value = item.catalogId;
      replaceSel.disabled = false;
    } else {
      replaceSel.disabled = true;
    }
  }

  function applyTransform() {
    content.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
  }

  function getTransform() {
    return { s: s, tx: tx, ty: ty };
  }

  function setTransform(next) {
    s = next.s;
    tx = next.tx;
    ty = next.ty;
    applyTransform();
  }

  function furnitureTransform(item) {
    var cx = (item.x || 0) * PLAN_SIZE.width;
    var cy = (item.y || 0) * PLAN_SIZE.height;
    var rotation = item.rotationDeg || item.rotation || 0;
    return "translate(" + cx + " " + cy + ") rotate(" + rotation + ")";
  }

  function furnitureElementById(id) {
    var els = overlay.querySelectorAll("[data-furniture-id]");
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute("data-furniture-id") === id) return els[i];
    }
    return null;
  }

  function stopCameraTween() {
    if (cameraTween) {
      cameraTween.kill();
      cameraTween = null;
    }
  }

  function layoutOverlay() {
    overlay.setAttribute("viewBox", "0 0 " + PLAN_SIZE.width + " " + PLAN_SIZE.height);
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
  }

  function imageSize() {
    return PLAN_SIZE;
  }

  function clientToPlanNormalized(clientX, clientY) {
    var box = overlay.getBoundingClientRect();
    return {
      x: (clientX - box.left) / box.width,
      y: (clientY - box.top) / box.height,
    };
  }

  function pickRoomAtNorm(x, y) {
    var hits = [];
    for (var i = 0; i < data.rooms.length; i++) {
      var poly = data.rooms[i].polygon;
      if (poly && poly.length >= 3 && pointInPolygon(x, y, poly)) {
        hits.push(data.rooms[i]);
      }
    }
    if (!hits.length) return null;
    if (hits.length === 1) return hits[0];
    hits.sort(function (a, b) {
      return polygonArea(a.polygon) - polygonArea(b.polygon);
    });
    return hits[0];
  }

  function setActiveFromNorm(x, y, e) {
    if (furnitureDrag) return;
    var r = pickRoomAtNorm(x, y);
    var id = r ? r.id : null;
    if (id !== activeRoomId) {
      activeRoomId = id;
      updateRoomHighlight(overlay, activeRoomId);
    }
    if (r && e) {
      var areaSqM = null;
      if (calibrationState && r.polygon) {
        areaSqM = polygonAreaSqMFromNorm(
          r.polygon,
          plan.naturalWidth,
          plan.naturalHeight,
          calibrationState.metersPerPixel
        );
      }
      showRoomTooltip(tip, e, r, { areaSqM: areaSqM });
    } else hideTooltip(tip);
  }

  function render() {
    layoutOverlay();
    renderPlan(overlay, data, activeRoomId, selectedFurnitureId, imageSize());
  }

  function onPlanLoaded() {
    activeRoomId = null;
    render();
    refreshCalibration();
  }

  function normalizeFurnitureIds() {
    (data.furniture || []).forEach(function (f, i) {
      if (!f.id) f.id = "f-" + i;
    });
  }

  function currentAnalysisJson() {
    return {
      analysisVersion: data.analysisVersion || "1.0",
      label: data.label || "Edited floor plan",
      calibration: data.calibration || null,
      rooms: data.rooms || [],
      walls: data.walls || [],
      doors: data.doors || [],
      windows: data.windows || [],
      furniture_catalog: data.furniture_catalog || [],
      furniture: data.furniture || [],
    };
  }

  function applyAnalysisFromObject(nextData) {
    data = Object.assign(
      {
        analysisVersion: "1.0",
        label: "",
        rooms: [],
        walls: [],
        furniture: [],
        furniture_catalog: [],
        doors: [],
        windows: [],
        calibration: null,
      },
      nextData || {}
    );
    data.rooms = Array.isArray(data.rooms) ? data.rooms : [];
    data.walls = Array.isArray(data.walls) ? data.walls : [];
    data.furniture = Array.isArray(data.furniture) ? data.furniture : [];
    data.furniture_catalog = Array.isArray(data.furniture_catalog)
      ? data.furniture_catalog
      : [];
    data.doors = Array.isArray(data.doors) ? data.doors : [];
    data.windows = Array.isArray(data.windows) ? data.windows : [];
    normalizeFurnitureIds();
    selectedFurnitureId = null;
    activeRoomId = null;
    syncReplaceSelect();
    refreshCalibration();
    render();
  }

  function runVisionOnFile(file) {
    setLlmStatus("LLM: reading image...");
    fileToImageBase64(file)
      .then(function (img) {
        setLlmStatus("LLM: analyzing with Gemini...");
        return analyzeFloorPlan(img.imageBase64, img.mimeType);
      })
      .then(function (analysis) {
        applyAnalysisFromObject(analysis);
        setLlmStatus("LLM: analysis loaded");
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        setLlmStatus("LLM: error - " + msg);
        alert(msg);
      });
  }

  function exportJson() {
    var json = JSON.stringify(currentAnalysisJson(), null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "floor-plan-analysis.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function loadFixture() {
    fetch("/fixtures/sample-plan.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        applyAnalysisFromObject(j);
        setLlmStatus("LLM: sample JSON (not from model)");
      })
      .catch(function () {
        alert("Could not load /fixtures/sample-plan.json");
      });
  }

  var hasSb =
    !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  var tb = mountToolbar(toolbarEl, {
    loadFixture: loadFixture,
    uploadSupabase: hasSb
      ? function () {
          var inp = tb.fileInput;
          if (!inp.files || !inp.files[0]) {
            alert("Open an image first (Open image).");
            return;
          }
          var f = inp.files[0];
          var path =
            "uploads/" +
            Date.now() +
            "-" +
            f.name.replace(/[^\w.\-]+/g, "_");
          uploadPlanRaster(f, path)
            .then(function (r) {
              plan.crossOrigin = "anonymous";
              plan.src = r.publicUrl;
              plan.onload = onPlanLoaded;
            })
            .catch(function (err) {
              alert(err.message || String(err));
            });
        }
      : undefined,
    zoomIn: function () {
      stopCameraTween();
      killPlanTweens(content);
      s *= 1.15;
      applyTransform();
    },
    zoomOut: function () {
      stopCameraTween();
      killPlanTweens(content);
      s /= 1.15;
      applyTransform();
    },
    reset: function () {
      stopCameraTween();
      killPlanTweens(content);
      s = 1;
      tx = ty = 0;
      applyTransform();
    },
    fullscreen: function () {
      if (!document.fullscreenElement) viewport.requestFullscreen().catch(function () {});
      else document.exitFullscreen();
    },
    exportJson: exportJson,
    analyzeLlm: function () {
      var f = tb.fileInput.files && tb.fileInput.files[0];
      if (!f) {
        alert("Open an image first (Open image).");
        return;
      }
      runVisionOnFile(f);
    },
  });

  var replaceLab = document.createElement("label");
  replaceLab.textContent = "Replace with ";
  replaceLab.style.display = "inline-flex";
  replaceLab.style.alignItems = "center";
  replaceLab.style.gap = "6px";
  replaceLab.appendChild(replaceSel);
  toolbarEl.appendChild(replaceLab);
  toolbarEl.appendChild(llmStatus);
  toolbarEl.appendChild(scaleEl);
  toolbarEl.appendChild(hint);

  replaceSel.addEventListener("change", function () {
    if (!selectedFurnitureId) return;
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (item) item.catalogId = replaceSel.value;
    render();
  });

  bindPlanFileInput(
    tb.fileInput,
    plan,
    function () {
      onPlanLoaded();
      if (isVisionConfigured() && lastOpenedFile) {
        runVisionOnFile(lastOpenedFile);
      }
    },
    function (file) {
      lastOpenedFile = file;
    }
  );

  planWrap.addEventListener(
    "mousedown",
    function (e) {
      if (e.button !== 0) return;
      var g = e.target.closest("[data-furniture-id]");
      if (g) {
        e.stopPropagation();
        stopCameraTween();
        var id = g.getAttribute("data-furniture-id");
        var item = data.furniture.find(function (f) {
          return f.id === id;
        });
        if (!item) return;
        var changedSelection = selectedFurnitureId !== id;
        selectedFurnitureId = id;
        syncReplaceSelect();
        if (changedSelection) render();
        g = furnitureElementById(id) || g;
        animateFurnitureSelect(g);
        animateFurnitureDragStart(g);
        var n = clientToPlanNormalized(e.clientX, e.clientY);
        furnitureDrag = { id: id, nx: n.x, ny: n.y, ox: item.x, oy: item.y, el: g };
      }
    },
    false
  );

  planWrap.addEventListener("dblclick", function (e) {
    if (e.target.closest("[data-furniture-id]")) return;
    var n = clientToPlanNormalized(e.clientX, e.clientY);
    var room = pickRoomAtNorm(n.x, n.y);
    if (!room) return;
    activeRoomId = room.id;
    updateRoomHighlight(overlay, activeRoomId);
    hideTooltip(tip);
    stopCameraTween();
    cameraTween = focusRoomCamera({
      room: room,
      viewportEl: viewport,
      planWrapEl: planWrap,
      getTransform: getTransform,
      setTransform: setTransform,
      padding: 0.12,
    });
  });

  planWrap.addEventListener("mousemove", function (e) {
    if (furnitureDrag) return;
    var n = clientToPlanNormalized(e.clientX, e.clientY);
    if (n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) {
      activeRoomId = null;
      updateRoomHighlight(overlay, null);
      hideTooltip(tip);
      return;
    }
    setActiveFromNorm(n.x, n.y, e);
  });

  planWrap.addEventListener("mouseleave", function () {
    activeRoomId = null;
    updateRoomHighlight(overlay, null);
    hideTooltip(tip);
  });

  viewport.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      stopCameraTween();
      s *= e.deltaY < 0 ? 1.08 : 0.93;
      s = Math.min(6, Math.max(0.3, s));
      applyTransform();
    },
    { passive: false }
  );

  viewport.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (e.target.closest("[data-furniture-id]")) return;
    stopCameraTween();
    drag = { x: e.clientX - tx, y: e.clientY - ty };
  });
  window.addEventListener("mousemove", function (e) {
    if (furnitureDrag) {
      var item = data.furniture.find(function (f) {
        return f.id === furnitureDrag.id;
      });
      if (item) {
        var n = clientToPlanNormalized(e.clientX, e.clientY);
        var dx = n.x - furnitureDrag.nx;
        var dy = n.y - furnitureDrag.ny;
        item.x = furnitureDrag.ox + dx;
        item.y = furnitureDrag.oy + dy;
        item.x = Math.min(1, Math.max(0, item.x));
        item.y = Math.min(1, Math.max(0, item.y));
        var el = furnitureDrag.el || furnitureElementById(furnitureDrag.id);
        if (el) {
          furnitureDrag.el = el;
          el.setAttribute("transform", furnitureTransform(item));
        }
      }
      return;
    }
    if (!drag) return;
    tx = e.clientX - drag.x;
    ty = e.clientY - drag.y;
    applyTransform();
  });
  window.addEventListener("mouseup", function () {
    if (furnitureDrag) {
      var item = data.furniture.find(function (f) {
        return f.id === furnitureDrag.id;
      });
      var el = furnitureDrag.el || furnitureElementById(furnitureDrag.id);
      if (item && el) {
        el.setAttribute("transform", furnitureTransform(item));
        animateFurnitureDragEnd(el);
        // #region agent log
        fetch("http://127.0.0.1:7805/ingest/366268e5-c3c0-405e-8724-98cf4eb84d21", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1a95b9" },
          body: JSON.stringify({
            sessionId: "1a95b9",
            runId: "furniture-drag",
            hypothesisId: "F",
            location: "floorPlanViewer.js:mouseup",
            message: "furniture drag end",
            data: { id: item.id, x: item.x, y: item.y },
            timestamp: Date.now(),
          }),
        }).catch(function () {});
        // #endregion
        render();
      }
    }
    drag = null;
    furnitureDrag = null;
  });

  window.addEventListener("keydown", function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "Escape") {
      stopCameraTween();
      selectedFurnitureId = null;
      syncReplaceSelect();
      render();
      e.preventDefault();
      return;
    }
    if (!selectedFurnitureId) return;
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item) return;
    var step = e.shiftKey ? 0.022 : 0.009;
    var changed = false;
    if (e.key === "ArrowLeft") {
      item.x -= step;
      changed = true;
    } else if (e.key === "ArrowRight") {
      item.x += step;
      changed = true;
    } else if (e.key === "ArrowUp") {
      item.y -= step;
      changed = true;
    } else if (e.key === "ArrowDown") {
      item.y += step;
      changed = true;
    } else if (e.key === "[" || e.key === "{") {
      item.rotationDeg = (item.rotationDeg || 0) - 5;
      changed = true;
    } else if (e.key === "]" || e.key === "}") {
      item.rotationDeg = (item.rotationDeg || 0) + 5;
      changed = true;
    }
    if (changed) {
      item.x = Math.min(1, Math.max(0, item.x));
      item.y = Math.min(1, Math.max(0, item.y));
      render();
      e.preventDefault();
    }
  });

  var resizeTimer = null;
  new ResizeObserver(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layoutOverlay();
      render();
    }, 150);
  }).observe(planWrap);

  plan.addEventListener("load", function () {
    layoutOverlay();
    refreshCalibration();
  });

  applyTransform();
  plan.onload = onPlanLoaded;
  plan.onerror = function () {
    plan.onerror = null;
    plan.src = "/fixtures/sample-floor.svg";
  };
  plan.src = "/fixtures/reference-floor.png";
  loadFixture();
}
