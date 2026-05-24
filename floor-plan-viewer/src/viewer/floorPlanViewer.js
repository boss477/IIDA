import {
  polygonAreaSqMFromNorm,
  resolveCalibration,
} from "../lib/calibration.js";
import { constrainFurnitureMove } from "../lib/furnitureBounds.js";
import { pointInPolygon, polygonArea } from "../lib/geometry.js";
import {
  analyzeFloorPlan,
  fileToImageBase64,
  isVisionConfigured,
  visionAnalyzingMessage,
  visionProviderLabel,
} from "../services/vision.js";
import {
  applyCatalogSkuToItem,
  resolveCatalogRowForItem,
  catalogById,
  createFurnitureNearItem,
  findSofaCatalogRow,
  formatCatalogDimensionsLabel,
  isSofaCatalogRow,
  parseSofaParams,
} from "../lib/catalogSizing.js";
import {
  getAvailableSofaColors,
  sofaColorLabel,
  SOFA_COLOR_OPTIONS,
} from "../lib/sofaColors.js";
import { fetchShearlingCatalog, uploadPlanRaster } from "../services/supabase.js";
import { bindPlanFileInput } from "../upload/uploadDropzone.js";
import { renderPlan } from "./svgRenderer.js";
import { updateRoomHighlight } from "./roomOverlay.js";
import { hideTooltip, showFurnitureTooltip, showRoomTooltip } from "./tooltip.js";
import { createGeometryEditor } from "./geometryEditor.js";
import { mountFileToolbar, mountGeometryToolbar } from "./toolbar.js";
import { getRoomMeasurementDisplay } from "./planTools.js";
import { syncOverlayToImage } from "../lib/coordinates.js";
import { init3D, dispose3D, resize3D, set3DViewMode } from "./plan3dViewer.js";

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
  var activeRoomId = null;
  var selectedFurnitureId = null;
  var lastOpenedFile = null;
  var shearlingCatalog = null;
  var lastFurniturePointer = { clientX: 0, clientY: 0 };
  var vertexDrag = null;
  var geo = null;
  var activeMode = "2D";
  var fileTb = null;
  var geoTb = null;
  var furnitureRow = null;

  var llmStatus = document.createElement("span");
  llmStatus.className = "llm-status";
  llmStatus.setAttribute("aria-live", "polite");
  var serverLabel =
    typeof window !== "undefined" && window.__SERVER_KIMI_MODEL__
      ? "Kimi " + String(window.__SERVER_KIMI_MODEL__)
      : typeof window !== "undefined" && window.__SERVER_GEMINI_MODEL__
        ? "Gemini " + String(window.__SERVER_GEMINI_MODEL__)
        : typeof window !== "undefined" && window.__SERVER_LM_MODEL__
          ? "LM Studio " + String(window.__SERVER_LM_MODEL__)
          : "";
  llmStatus.textContent = isVisionConfigured()
    ? "LLM: " + (serverLabel || visionProviderLabel()) + " (after Open image)"
    : "LLM: set VITE_GEMINI_API_KEY, LM Studio, or VITE_ANALYZE_API in .env";

  function setLlmStatus(msg) {
    llmStatus.textContent = msg;
  }

  var replaceSel = document.createElement("select");
  replaceSel.setAttribute("aria-label", "Replace selected furniture");
  replaceSel.disabled = true;

  var sofaColorSel = document.createElement("select");
  sofaColorSel.setAttribute("aria-label", "Sofa color");
  sofaColorSel.disabled = true;
  sofaColorSel.title = "Switch sofa upholstery color";

  var addSofaNearBtn = document.createElement("button");
  addSofaNearBtn.type = "button";
  addSofaNearBtn.className = "btn";
  addSofaNearBtn.textContent = "+ Sofa near";
  addSofaNearBtn.disabled = true;
  addSofaNearBtn.title =
    "Place a new sofa beside the selection (SKU from Replace with, or first sofa in catalog)";

  var hint = document.createElement("span");
  hint.className = "toolbar-hint";
  hint.textContent =
    "Select · Replace / Color / + Sofa near · drag · [ ] rotate · arrows · Esc deselect";

  var scaleEl = document.createElement("span");
  scaleEl.className = "calibration-scale";
  scaleEl.textContent = "Scale: load plan + JSON calibration";

  var furnitureInfoEl = document.createElement("span");
  furnitureInfoEl.className = "furniture-info";
  furnitureInfoEl.setAttribute("aria-live", "polite");
  furnitureInfoEl.textContent = "Furniture: click a piece, then pick a Shearling SKU";

  function getCatalogContext() {
    return {
      mmPerPixel: calibrationState ? calibrationState.mmPerPixel : null,
      planWidthPx: plan.naturalWidth || PLAN_SIZE.width,
      planHeightPx: plan.naturalHeight || PLAN_SIZE.height,
      walls: data.walls || [],
      rooms: data.rooms || [],
    };
  }

  function applyCatalogToAllFurniture() {
    var catalog = data.furniture_catalog || [];
    if (!catalog.length) return;
    (data.furniture || []).forEach(function (f) {
      if (!f.catalogId) return;
      var row = catalogById(catalog, f.catalogId);
      if (row) applyCatalogSkuToItem(f, row, getCatalogContext());
    });
  }

  function updateFurnitureSelectionUi(pointerEvent) {
    if (pointerEvent) {
      lastFurniturePointer.clientX = pointerEvent.clientX;
      lastFurniturePointer.clientY = pointerEvent.clientY;
    }
    if (!selectedFurnitureId) {
      furnitureInfoEl.textContent = "Furniture: click a piece, then pick a Shearling SKU";
      return;
    }
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item) {
      furnitureInfoEl.textContent = "Furniture: (selection lost)";
      return;
    }
    var row = catalogById(data.furniture_catalog || [], item.catalogId);
    if (row) {
      var label = formatCatalogDimensionsLabel(row, item);
      furnitureInfoEl.textContent = label;
      showFurnitureTooltip(tip, lastFurniturePointer, label);
    } else if (item.catalogId) {
      furnitureInfoEl.textContent =
        item.catalogId + " — use Replace with to pick a Shearling SKU";
    } else {
      furnitureInfoEl.textContent = "Selected — use Replace with for DB size + icon";
    }
  }

  function refreshCalibration() {
    if (!plan.naturalWidth || !plan.naturalHeight || !data.calibration) {
      calibrationState = null;
      scaleEl.textContent = "Scale: no calibration in JSON or image not loaded";
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
    if (calibrationState) applyCatalogToAllFurniture();
  }

  function isItemSofa(item) {
    if (!item) return false;
    var t = String(item.type || item.shape || "").toLowerCase();
    if (t.indexOf("sofa") >= 0 || t.indexOf("lounge") >= 0 || t.indexOf("sectional") >= 0) return true;
    var row = catalogById(data.furniture_catalog || [], item.catalogId);
    return row ? isSofaCatalogRow(row) : false;
  }

  function activeSofaColorId(item, catalogRow) {
    if (!item) return "";
    if (item.sofaColorOverride) return item.sofaColorOverride;
    if (item.sofaParams && item.sofaParams.color) return item.sofaParams.color;
    if (catalogRow) {
      var parsed = parseSofaParams(catalogRow.keywords, catalogRow.product_name);
      return parsed.color || "";
    }
    return "";
  }

  function syncSofaColorSelect() {
    sofaColorSel.innerHTML = "";
    if (!selectedFurnitureId) {
      sofaColorSel.disabled = true;
      return;
    }
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item || !isItemSofa(item)) {
      sofaColorSel.disabled = true;
      return;
    }
    var catalog = data.furniture_catalog || [];
    var row = catalogById(catalog, item.catalogId);
    var available = getAvailableSofaColors(row, catalog);
    var availableSet = {};
    available.forEach(function (id) {
      availableSet[id] = true;
    });

    var autoOpt = document.createElement("option");
    autoOpt.value = "";
    autoOpt.textContent = "Auto (from catalog)";
    sofaColorSel.appendChild(autoOpt);

    var grpAvail = document.createElement("optgroup");
    grpAvail.label = available.length ? "Available for this line" : "Popular";
    available.forEach(function (id) {
      var o = document.createElement("option");
      o.value = id;
      o.textContent = sofaColorLabel(id);
      grpAvail.appendChild(o);
    });
    sofaColorSel.appendChild(grpAvail);

    var grpAll = document.createElement("optgroup");
    grpAll.label = "All colors";
    SOFA_COLOR_OPTIONS.forEach(function (opt) {
      if (availableSet[opt.id]) return;
      var o = document.createElement("option");
      o.value = opt.id;
      o.textContent = opt.label;
      grpAll.appendChild(o);
    });
    if (grpAll.children.length) sofaColorSel.appendChild(grpAll);

    var current = activeSofaColorId(item, row);
    sofaColorSel.value = item.sofaColorOverride ? item.sofaColorOverride : current || "";
    if (!sofaColorSel.value && item.sofaColorOverride !== undefined) sofaColorSel.value = "";
    sofaColorSel.disabled = false;
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
      addSofaNearBtn.disabled = false;
    } else {
      replaceSel.disabled = true;
      addSofaNearBtn.disabled = true;
    }
    syncSofaColorSelect();
  }

  function applySofaColorToItem(item, colorId) {
    if (!item || !isItemSofa(item)) return;
    var row = catalogById(data.furniture_catalog || [], item.catalogId);
    if (!item.sofaParams) {
      item.sofaParams = row
        ? parseSofaParams(row.keywords, row.product_name)
        : { seats: 2, hasLounge: false, hasArm: true };
    }
    if (!colorId) {
      delete item.sofaColorOverride;
      if (row) {
        var parsed = parseSofaParams(row.keywords, row.product_name);
        if (parsed.color) item.sofaParams.color = parsed.color;
        else delete item.sofaParams.color;
      } else {
        delete item.sofaParams.color;
      }
    } else {
      item.sofaColorOverride = colorId;
      item.sofaParams.color = colorId;
    }
  }

  function addSofaNearSelected() {
    if (!selectedFurnitureId) return;
    var anchor = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!anchor) return;
    var catalog = data.furniture_catalog || [];
    var row = findSofaCatalogRow(catalog, replaceSel.value);
    if (!row) {
      alert("No sofa SKU found. Load the Shearling catalog or pick a sofa in Replace with.");
      return;
    }
    var newItem = createFurnitureNearItem(anchor, row, getCatalogContext());
    if (!newItem) return;
    if (!data.furniture) data.furniture = [];
    data.furniture.push(newItem);
    selectedFurnitureId = newItem.id;
    syncReplaceSelect();
    updateFurnitureSelectionUi();
    render();
  }

  function applyTransform() {
    content.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
  }

  function layoutOverlay() {
    overlay.setAttribute("viewBox", "0 0 " + PLAN_SIZE.width + " " + PLAN_SIZE.height);
    overlay.setAttribute("preserveAspectRatio", "none");
    syncOverlayToImage(plan, overlay);
  }

  function imageSize() {
    return PLAN_SIZE;
  }

  function clientToPlanNormalized(clientX, clientY) {
    var ctm = overlay.getScreenCTM && overlay.getScreenCTM();
    if (ctm && overlay.createSVGPoint) {
      var pt = overlay.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      var svgPt = pt.matrixTransform(ctm.inverse());
      return {
        x: svgPt.x / PLAN_SIZE.width,
        y: svgPt.y / PLAN_SIZE.height,
      };
    }
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
    var id = r ? r.id || r.name || null : null;
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
      var measure = getRoomMeasurementDisplay(
        r,
        plan.naturalWidth,
        plan.naturalHeight,
        calibrationState
      );
      showRoomTooltip(tip, e, r, {
        areaSqM: areaSqM,
        dimLine: measure.dimLine,
        areaLine: measure.areaLine,
        scaleSummary: calibrationState ? calibrationState.summary : null,
      });
    } else hideTooltip(tip);
  }

  function render() {
    layoutOverlay();
    var geoOpts = geo ? geo.getRenderOptions() : {};
    var size = imageSize();
    geoOpts.calibrationState = calibrationState;
    geoOpts.planImageSrc = plan.src && plan.src.indexOf("sample-floor.svg") === -1 ? plan.src : null;
    geoOpts.furnitureRenderCtx = {
      mmPerPixel: calibrationState ? calibrationState.mmPerPixel : null,
      planWidthPx: plan.naturalWidth || size.width,
      planHeightPx: plan.naturalHeight || size.height,
      furnitureCatalog: data.furniture_catalog || [],
    };
    renderPlan(overlay, data, activeRoomId, selectedFurnitureId, size, geoOpts);
  }

  function onPlanLoaded() {
    activeRoomId = null;
    refreshCalibration();
    render();
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
    var normalized = Object.assign(
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
    Object.keys(data).forEach(function (key) {
      delete data[key];
    });
    Object.assign(data, normalized);
    data.rooms = Array.isArray(data.rooms) ? data.rooms : [];
    data.walls = Array.isArray(data.walls) ? data.walls : [];
    data.furniture = Array.isArray(data.furniture) ? data.furniture : [];
    data.furniture_catalog =
      shearlingCatalog && shearlingCatalog.length
        ? shearlingCatalog
        : Array.isArray(data.furniture_catalog)
          ? data.furniture_catalog
          : [];
    data.doors = Array.isArray(data.doors) ? data.doors : [];
    data.windows = Array.isArray(data.windows) ? data.windows : [];
    normalizeFurnitureIds();
    data.furniture.forEach(function (f) {
      delete f.width;
      delete f.height;
      delete f.depth;
      delete f.scale;
    });
    selectedFurnitureId = null;
    activeRoomId = null;
    if (geo && geo.resetForNewData) geo.resetForNewData();
    syncReplaceSelect();
    refreshCalibration();
    applyCatalogToAllFurniture();
    render();
  }

  function runVisionOnFile(file) {
    setLlmStatus("LLM: reading image...");
    fileToImageBase64(file)
      .then(function (img) {
        setLlmStatus(visionAnalyzingMessage());
        return analyzeFloorPlan(img.imageBase64, img.mimeType);
      })
      .then(function (analysis) {
        var apply = function () {
          applyAnalysisFromObject(analysis);
          setLlmStatus("LLM: analysis loaded");
        };
        if (hasSb && (!shearlingCatalog || !shearlingCatalog.length)) {
          return fetchShearlingCatalog()
            .then(function (catalog) {
              shearlingCatalog = catalog;
              data.furniture_catalog = catalog;
              apply();
            })
            .catch(function (err) {
              apply();
              throw err;
            });
        }
        apply();
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
  var hasSbStorage = hasSb && import.meta.env.VITE_SUPABASE_STORAGE === "1";

  var viewport2D = document.getElementById("viewport");
  var viewport3D = document.getElementById("viewport3d");
  var view3dChrome = document.getElementById("view3d-chrome");
  var btn3dDollhouse = document.getElementById("btn3d-dollhouse");
  var btn3dTop = document.getElementById("btn3d-top");

  function set3dChromeActive(mode) {
    if (!btn3dDollhouse || !btn3dTop) return;
    btn3dDollhouse.classList.toggle("view3d-btn--active", mode === "dollhouse");
    btn3dTop.classList.toggle("view3d-btn--active", mode === "top");
  }

  if (btn3dDollhouse) {
    btn3dDollhouse.addEventListener("click", function () {
      set3DViewMode("dollhouse");
      set3dChromeActive("dollhouse");
    });
  }
  if (btn3dTop) {
    btn3dTop.addEventListener("click", function () {
      set3DViewMode("top");
      set3dChromeActive("top");
    });
  }

  function show2D() {
    if (activeMode === "2D") return;
    activeMode = "2D";
    dispose3D();
    viewport3D.style.display = "none";
    if (view3dChrome) view3dChrome.hidden = true;
    viewport2D.style.display = "";
    if (geoTb && geoTb.row) geoTb.row.style.display = "";
    if (furnitureRow) furnitureRow.style.display = "";
    if (fileTb && fileTb.btn2D) fileTb.btn2D.classList.add("tool-active");
    if (fileTb && fileTb.btn3D) fileTb.btn3D.classList.remove("tool-active");
    render();
  }

  function show3D() {
    if (activeMode === "3D") return;
    activeMode = "3D";
    selectedFurnitureId = null;
    syncReplaceSelect();
    updateFurnitureSelectionUi();
    hideTooltip(tip);

    viewport2D.style.display = "none";
    viewport3D.style.display = "block";
    if (view3dChrome) view3dChrome.hidden = false;
    set3dChromeActive("dollhouse");
    if (geoTb && geoTb.row) geoTb.row.style.display = "none";
    if (furnitureRow) furnitureRow.style.display = "none";
    if (fileTb && fileTb.btn2D) fileTb.btn2D.classList.remove("tool-active");
    if (fileTb && fileTb.btn3D) fileTb.btn3D.classList.add("tool-active");
    init3D(viewport3D, data, plan);
  }

  function saveToDb() {
    var defaultId = window.location.hash.replace("#", "") || (crypto && crypto.randomUUID ? crypto.randomUUID() : "project-12345");
    var pid = prompt("Save Project under ID (UUID):", defaultId);
    if (!pid) return;
    fetch("/api/projects/" + pid, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentAnalysisJson()),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (res.success) {
          window.location.hash = pid;
          alert("Project saved successfully to Supabase relational tables!");
        } else {
          alert("Save failed: " + (res.error || "Unknown error"));
        }
      })
      .catch(function (err) {
        alert("Save failed: " + err.message);
      });
  }

  function loadFromDb() {
    var pid = prompt("Enter Project UUID to load from Supabase:");
    if (!pid) return;
    fetch("/api/projects/" + pid)
      .then(function (r) {
        if (!r.ok) throw new Error("Server returned status " + r.status);
        return r.json();
      })
      .then(function (data) {
        window.location.hash = pid;
        applyAnalysisFromObject(data);
        alert("Project loaded successfully from Supabase!");
      })
      .catch(function (err) {
        alert("Load failed: " + err.message);
      });
  }

  toolbarEl.classList.add("bar--stacked");

  fileTb = mountFileToolbar(toolbarEl, {
    loadFixture: loadFixture,
    uploadSupabase: hasSbStorage
      ? function () {
          var inp = fileTb.fileInput;
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
      s *= 1.15;
      applyTransform();
    },
    zoomOut: function () {
      s /= 1.15;
      applyTransform();
    },
    reset: function () {
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
      var f = fileTb.fileInput.files && fileTb.fileInput.files[0];
      if (!f) {
        alert("Open an image first (Open image).");
        return;
      }
      runVisionOnFile(f);
    },
    show2D: show2D,
    show3D: show3D,
    saveToDb: saveToDb,
    loadFromDb: loadFromDb,
  });

  geoTb = mountGeometryToolbar(toolbarEl, {
    toggleSetScale: function () {
      geo.toggleTool("setScale");
    },
    toggleMeasure: function () {
      geo.toggleTool("measure");
    },
    toggleVertexEdit: function () {
      geo.toggleTool("vertexEdit");
    },
    toggleDrawRoom: function () {
      if (geo.getToolMode() === "drawRoom") {
        geo.toggleTool("view");
      } else {
        geo.toggleTool("drawRoom");
      }
    },
    toggleEditWalls: function () {
      geo.toggleTool(geo.getToolMode() === "editWalls" ? "view" : "editWalls");
    },
    toggleAddWall: function () {
      if (geo.getToolMode() === "drawWall") {
        geo.toggleTool("editWalls");
      } else {
        geo.toggleTool("drawWall");
      }
    },
    finishDrawRoom: function () {
      geo.finishDrawRoom();
    },
    finishDrawWall: function () {
      geo.finishDrawWall();
    },
    deleteSelectedVertex: function () {
      geo.deleteSelectedVertex();
    },
    deleteSelectedWall: function () {
      geo.deleteSelectedWall();
    },
    undo: function () {
      geo.performUndo();
    },
    applyScale: function () {
      geo.applyScaleFromInput();
    },
    onFloorChange: function () {
      geo.onFloorChange();
    },
  });
  geo = createGeometryEditor({
    data: data,
    plan: plan,
    planWrap: planWrap,
    hintEl: hint,
    geoTb: geoTb,
    getCalibrationState: function () {
      return calibrationState;
    },
    refreshCalibration: refreshCalibration,
    pickRoomAtNorm: pickRoomAtNorm,
    requestRender: render,
    onToolModeChange: function (mode) {
      if (mode !== "view") {
        selectedFurnitureId = null;
        furnitureDrag = null;
        syncReplaceSelect();
        updateFurnitureSelectionUi();
        hideTooltip(tip);
      }
    },
    onSelectRoom: function () {},
  });
  geo.init();

  furnitureRow = document.createElement("div");
  furnitureRow.className = "toolbar-row toolbar-row--furniture";
  var furnLab = document.createElement("span");
  furnLab.className = "toolbar-group-label";
  furnLab.textContent = "Furniture";
  furnitureRow.appendChild(furnLab);

  var replaceLab = document.createElement("label");
  replaceLab.textContent = "Replace with ";
  replaceLab.style.display = "inline-flex";
  replaceLab.style.alignItems = "center";
  replaceLab.style.gap = "6px";
  replaceLab.appendChild(replaceSel);

  var colorLab = document.createElement("label");
  colorLab.textContent = "Color ";
  colorLab.style.display = "inline-flex";
  colorLab.style.alignItems = "center";
  colorLab.style.gap = "6px";
  colorLab.appendChild(sofaColorSel);

  replaceLab.appendChild(colorLab);
  replaceLab.appendChild(addSofaNearBtn);
  furnitureRow.appendChild(replaceLab);
  toolbarEl.appendChild(furnitureRow);

  sofaColorSel.addEventListener("change", function () {
    if (!selectedFurnitureId) return;
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item) return;
    applySofaColorToItem(item, sofaColorSel.value);
    updateFurnitureSelectionUi();
    render();
  });

  addSofaNearBtn.addEventListener("click", function () {
    addSofaNearSelected();
  });
  toolbarEl.appendChild(furnitureInfoEl);
  toolbarEl.appendChild(llmStatus);
  toolbarEl.appendChild(scaleEl);
  toolbarEl.appendChild(hint);

  replaceSel.addEventListener("change", function () {
    if (!selectedFurnitureId) return;
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item) return;
    var row = catalogById(data.furniture_catalog || [], replaceSel.value);
    if (row) {
      var prevColor = item.sofaColorOverride;
      applyCatalogSkuToItem(item, row, getCatalogContext());
      if (prevColor) {
        item.sofaColorOverride = prevColor;
        if (item.sofaParams) item.sofaParams.color = prevColor;
      }
    } else {
      item.catalogId = replaceSel.value;
    }
    syncSofaColorSelect();
    updateFurnitureSelectionUi();
    render();
  });

  bindPlanFileInput(
    fileTb.fileInput,
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
      var n = clientToPlanNormalized(e.clientX, e.clientY);

      if (geo.isGeometryClickMode()) {
        e.stopPropagation();
        geo.handlePlanClick(n);
        return;
      }

      var wallHandle = e.target.closest(".plan-wall-vertex-handle");
      if (geo.getToolMode() === "editWalls") {
        e.stopPropagation();
        e.preventDefault();
        geo.handleWallMousedown(n, wallHandle);
        vertexDrag = geo.hasActiveVertexDrag();
        return;
      }

      var handle = e.target.closest(".plan-vertex-handle");
      if (geo.getToolMode() === "vertexEdit") {
        e.stopPropagation();
        e.preventDefault();
        geo.handleVertexMousedown(n, handle);
        vertexDrag = geo.hasActiveVertexDrag();
        return;
      }

      if (geo.blocksFurnitureInteraction()) return;

      var g = e.target.closest("[data-furniture-id]");
      if (g) {
        e.stopPropagation();
        var id = g.getAttribute("data-furniture-id");
        var item = data.furniture.find(function (f) {
          return f.id === id;
        });
        if (!item) return;
        selectedFurnitureId = id;
        activeRoomId = null;
        updateRoomHighlight(overlay, null);
        syncReplaceSelect();
        updateFurnitureSelectionUi(e);
        render();
        furnitureDrag = {
          id: id,
          nx: n.x,
          ny: n.y,
          ox: item.x,
          oy: item.y,
          lastValidX: item.x,
          lastValidY: item.y,
        };
        return;
      }

      if (geo.getToolMode() === "view") {
        e.stopPropagation();
        geo.handlePlanClick(n);
      }
    },
    false
  );

  planWrap.addEventListener("mousemove", function (e) {
    if (furnitureDrag || vertexDrag) return;
    var n = clientToPlanNormalized(e.clientX, e.clientY);
    if (geo.handleMousemove(n)) return;
    if (geo.getToolMode() !== "view") return;
    if (selectedFurnitureId) return;
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
      s *= e.deltaY < 0 ? 1.08 : 0.93;
      s = Math.min(6, Math.max(0.3, s));
      applyTransform();
    },
    { passive: false }
  );

  viewport.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (geo.isGeometryClickMode()) return;
    if (e.target.closest(".plan-wall-vertex-handle")) return;
    if (e.target.closest(".plan-vertex-handle")) return;
    if (e.target.closest("[data-furniture-id]")) return;
    drag = { x: e.clientX - tx, y: e.clientY - ty };
  });
  window.addEventListener("mousemove", function (e) {
    if (vertexDrag) {
      var nVert = clientToPlanNormalized(e.clientX, e.clientY);
      geo.handleVertexDragMove(nVert);
      return;
    }
    if (furnitureDrag) {
      var item = data.furniture.find(function (f) {
        return f.id === furnitureDrag.id;
      });
      if (item) {
        var n = clientToPlanNormalized(e.clientX, e.clientY);
        var dx = n.x - furnitureDrag.nx;
        var dy = n.y - furnitureDrag.ny;
        var tryX = furnitureDrag.ox + dx;
        var tryY = furnitureDrag.oy + dy;
        item.x = tryX;
        item.y = tryY;
        if (
          constrainFurnitureMove(
            item,
            data.rooms,
            furnitureDrag.lastValidX,
            furnitureDrag.lastValidY
          )
        ) {
          furnitureDrag.lastValidX = item.x;
          furnitureDrag.lastValidY = item.y;
        }
        render();
      }
      return;
    }
    if (!drag) return;
    tx = e.clientX - drag.x;
    ty = e.clientY - drag.y;
    applyTransform();
  });
  window.addEventListener("mouseup", function () {
    if (vertexDrag) {
      vertexDrag = null;
      geo.clearVertexDrag();
    }
    drag = null;
    furnitureDrag = null;
  });

  window.addEventListener("keydown", function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "Escape") {
      var geoHandled = geo.handleEscape();
      if (geoHandled) {
        render();
        e.preventDefault();
        return;
      }
      selectedFurnitureId = null;
      syncReplaceSelect();
      updateFurnitureSelectionUi();
      hideTooltip(tip);
      render();
      e.preventDefault();
      return;
    }
    if (geo.handleKeydown(e)) {
      e.preventDefault();
      return;
    }
    if (geo.blocksFurnitureInteraction()) return;
    if (!selectedFurnitureId) return;
    var item = data.furniture.find(function (f) {
      return f.id === selectedFurnitureId;
    });
    if (!item) return;
    var step = e.shiftKey ? 0.022 : 0.009;
    var prevX = item.x;
    var prevY = item.y;
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
      if (e.key.indexOf("Arrow") === 0) {
        constrainFurnitureMove(item, data.rooms, prevX, prevY);
      }
      render();
      e.preventDefault();
    }
  });

  new ResizeObserver(function () {
    layoutOverlay();
    render();
    if (activeMode === "3D") resize3D();
  }).observe(planWrap);

  window.addEventListener("resize", function () {
    if (activeMode === "3D") resize3D();
  });

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

  function boot() {
    loadFixture();
  }

  if (hasSb) {
    fetchShearlingCatalog()
      .then(function (catalog) {
        shearlingCatalog = catalog;
        data.furniture_catalog = catalog;
        setLlmStatus("Catalog: " + catalog.length + " Shearling SKUs loaded");
        boot();
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        setLlmStatus("Catalog error: " + msg);
        boot();
      });
  } else {
    boot();
  }
}
