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
import { validateAnalysis } from "../lib/analysisValidation.js";
import { createUndoStack } from "../lib/undoStack.js";
import { renderPlan } from "./svgRenderer.js";
import { updateRoomHighlight } from "./roomOverlay.js";
import { hideTooltip, showRoomTooltip } from "./tooltip.js";
import { mountToolbar, setToolButtonActive } from "./toolbar.js";
import {
  clampNorm,
  computeMeasure,
  createRoomFromPreset,
  findEdgeInsertIndex,
  formatAreaLabel,
  formatRoomDimensions,
  isNearPoint,
  upsertCalibrationSegment,
} from "./planTools.js";
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
  var geometryOnly = false;
  var toolMode = "view";
  var vertexDrag = null;
  var selectedRoomId = null;
  var scaleDraft = null;
  var measureDraft = null;
  var measureResult = null;
  var drawRoomPoints = null;
  var drawRoomCursor = null;
  var selectedVertex = null;
  var undoStack = createUndoStack(50);

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
      : "fireworks";
  llmStatus.textContent = isVisionConfigured()
    ? serverModel
      ? "LLM: " + serverProvider + " / " + serverModel + " (after Open image)"
      : "LLM: Fireworks vision (after Open image)"
    : "LLM: run npm start (Fireworks via /api/analyze)";

  function setLlmStatus(msg) {
    llmStatus.textContent = msg;
  }

  var replaceSel = document.createElement("select");
  replaceSel.setAttribute("aria-label", "Replace selected furniture");
  replaceSel.disabled = true;

  var hint = document.createElement("span");
  hint.className = "toolbar-hint";
  hint.textContent =
    "Click room to pick floor · Set scale / Measure tools · Edit vertices · Esc exits tools";

  var scaleEl = document.createElement("span");
  scaleEl.className = "calibration-scale";
  scaleEl.textContent = "Scale: load plan + JSON calibration";

  var wallWarnEl = document.createElement("span");
  wallWarnEl.className = "wall-warning";
  wallWarnEl.setAttribute("aria-live", "polite");

  function updateWallWarning() {
    if (!data.walls || !data.walls.length) {
      wallWarnEl.textContent =
        "Warning: walls[] is empty — wall layer not drawn. Re-analyze or add walls in JSON.";
    } else {
      wallWarnEl.textContent = "";
    }
  }

  function applyGeometryOnlyClass() {
    if (geometryOnly) planWrap.classList.add("geometry-only");
    else planWrap.classList.remove("geometry-only");
  }

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
    syncRoomMeasureReadout();
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
    overlay.style.width = PLAN_SIZE.width + "px";
    overlay.style.height = PLAN_SIZE.height + "px";
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
    planWrap.style.width = PLAN_SIZE.width + "px";
    planWrap.style.height = PLAN_SIZE.height + "px";
    plan.style.width = PLAN_SIZE.width + "px";
    plan.style.height = PLAN_SIZE.height + "px";
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

  function syncRoomMeasureReadout() {
    if (!selectedRoomId) {
      tb.roomMeasureReadout.textContent = "Room: click a room for area";
      return;
    }
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    if (!room || !room.polygon) {
      tb.roomMeasureReadout.textContent = "Room: —";
      return;
    }
    var area = formatAreaLabel(
      room.polygon,
      plan.naturalWidth,
      plan.naturalHeight,
      calibrationState
    );
    var dims = formatRoomDimensions(
      room.polygon,
      plan.naturalWidth,
      plan.naturalHeight,
      calibrationState
    );
    var label = room.name || room.id || "Room";
    tb.roomMeasureReadout.textContent = label + ": " + area + (dims ? " · " + dims : "");
    if (calibrationState && dims) {
      room.dimensionsText = dims;
    }
  }

  function getRoomMeasureBadge() {
    if (!selectedRoomId) return null;
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    if (!room || !room.polygon) return null;
    return {
      room: room,
      areaLabel: formatAreaLabel(
        room.polygon,
        plan.naturalWidth,
        plan.naturalHeight,
        calibrationState
      ),
      dimLabel: formatRoomDimensions(
        room.polygon,
        plan.naturalWidth,
        plan.naturalHeight,
        calibrationState
      ),
    };
  }

  function syncToolUi() {
    setToolButtonActive(tb.btnSetScale, toolMode === "setScale");
    setToolButtonActive(tb.btnMeasure, toolMode === "measure");
    setToolButtonActive(tb.btnVertexEdit, toolMode === "vertexEdit");
    setToolButtonActive(tb.btnDrawRoom, toolMode === "drawRoom");
    tb.finishRoomBtn.hidden = toolMode !== "drawRoom";
    tb.deleteVertexBtn.hidden = toolMode !== "vertexEdit" || !selectedVertex;
    if (toolMode === "setScale" || toolMode === "measure" || toolMode === "drawRoom") {
      planWrap.classList.add("tool-crosshair");
    } else {
      planWrap.classList.remove("tool-crosshair");
    }
    if (toolMode === "setScale" && scaleDraft && scaleDraft.from && scaleDraft.to) {
      tb.scaleLengthWrap.hidden = false;
    } else if (toolMode !== "setScale") {
      tb.scaleLengthWrap.hidden = true;
    }
    if (toolMode === "setScale") {
      hint.textContent =
        "Set scale: click two points on a known dimension, enter length (m), then Apply.";
    } else if (toolMode === "measure") {
      hint.textContent = "Measure: click start point, then end point.";
    } else if (toolMode === "vertexEdit") {
      hint.textContent =
        "Drag handles · click edge to add vertex · select handle + Delete to remove · measurements update live.";
    } else if (toolMode === "drawRoom") {
      hint.textContent =
        "Add room: click corners · click first point or Finish room (≥3 pts) · area shown live · set scale for m².";
    } else {
      hint.textContent =
        "Set scale first for m² · Add room / Measure / Edit vertices · Undo (Ctrl+Z) for add room & delete vertex";
    }
  }

  function setToolMode(mode) {
    var prev = toolMode;
    toolMode = mode;
    scaleDraft = null;
    measureDraft = null;
    drawRoomPoints = null;
    drawRoomCursor = null;
    selectedVertex = null;
    if (prev === "measure" && mode !== "measure") {
      measureResult = null;
      updateMeasureReadout("—");
    }
    if (mode !== "setScale") tb.scaleLengthWrap.hidden = true;
    syncToolUi();
    render();
  }

  function toggleTool(mode) {
    if (toolMode === mode) setToolMode("view");
    else {
      if (mode !== "measure") {
        measureResult = null;
        updateMeasureReadout("—");
      }
      toolMode = mode;
      scaleDraft = null;
      measureDraft = null;
      drawRoomPoints = mode === "drawRoom" ? [] : null;
      drawRoomCursor = null;
      selectedVertex = null;
      selectedFurnitureId = null;
      syncReplaceSelect();
      syncToolUi();
      render();
    }
  }

  function syncFloorSelect() {
    if (!selectedRoomId) {
      tb.floorSelect.disabled = true;
      tb.floorSelect.value = "";
      return;
    }
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    tb.floorSelect.disabled = !room;
    if (room) {
      tb.floorSelect.value = room.flooring || "wood";
    }
  }

  function selectRoom(room) {
    selectedRoomId = room ? room.id || room.name || null : null;
    selectedVertex = null;
    syncFloorSelect();
    syncRoomMeasureReadout();
    render();
  }

  function captureUndoState() {
    return {
      rooms: JSON.parse(JSON.stringify(data.rooms || [])),
      selectedRoomId: selectedRoomId,
      selectedVertex: selectedVertex
        ? { roomId: selectedVertex.roomId, index: selectedVertex.index }
        : null,
    };
  }

  function syncUndoButton() {
    if (tb.btnUndo) tb.btnUndo.disabled = !undoStack.canUndo();
  }

  function pushUndo(action) {
    undoStack.push({ action: action, state: captureUndoState() });
    syncUndoButton();
  }

  function performUndo() {
    if (!undoStack.canUndo()) return;
    var entry = undoStack.pop();
    data.rooms = entry.state.rooms;
    selectedRoomId = entry.state.selectedRoomId;
    selectedVertex = entry.state.selectedVertex;
    syncFloorSelect();
    syncRoomMeasureReadout();
    syncUndoButton();
    render();
    var label =
      entry.action === "addRoom"
        ? "Undid add room"
        : entry.action === "deleteVertex"
          ? "Undid delete vertex"
          : "Undid change";
    tb.roomMeasureReadout.textContent = label;
  }

  function finishDrawRoom() {
    if (!drawRoomPoints || drawRoomPoints.length < 3) {
      alert("Add at least 3 corners, then Finish room.");
      return;
    }
    var presetId = tb.roomPresetSelect.value || "other";
    var room = createRoomFromPreset(data.rooms, presetId, drawRoomPoints);
    var area = formatAreaLabel(
      room.polygon,
      plan.naturalWidth,
      plan.naturalHeight,
      calibrationState
    );
    var dims = formatRoomDimensions(
      room.polygon,
      plan.naturalWidth,
      plan.naturalHeight,
      calibrationState
    );
    if (dims) room.dimensionsText = dims;
    pushUndo("addRoom");
    data.rooms.push(room);
    drawRoomPoints = null;
    drawRoomCursor = null;
    toolMode = "view";
    selectRoom(room);
    tb.roomMeasureReadout.textContent =
      (room.name || room.id) + ": " + area + (dims ? " · " + dims : "") + " (added)";
    syncToolUi();
    render();
  }

  function deleteSelectedVertex() {
    if (!selectedVertex) return;
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedVertex.roomId;
    });
    if (!room || !room.polygon || room.polygon.length <= 3) {
      alert("A room needs at least 3 corners.");
      return;
    }
    pushUndo("deleteVertex");
    room.polygon.splice(selectedVertex.index, 1);
    selectedVertex = null;
    syncRoomMeasureReadout();
    render();
  }

  function updateMeasureReadout(text) {
    tb.measureReadout.textContent = "Measure: " + (text || "—");
  }

  function applyScaleFromInput() {
    if (!scaleDraft || !scaleDraft.from || !scaleDraft.to) {
      alert("Click two points on the plan first.");
      return;
    }
    var lengthM = parseFloat(tb.scaleLengthInput.value, 10);
    if (!isFinite(lengthM) || lengthM <= 0) {
      alert("Enter a valid length in meters.");
      return;
    }
    upsertCalibrationSegment(data, scaleDraft.from, scaleDraft.to, lengthM);
    scaleDraft = null;
    tb.scaleLengthWrap.hidden = true;
    tb.scaleLengthInput.value = "";
    refreshCalibration();
    render();
  }

  function handlePlanToolClick(n) {
    var pt = clampNorm(n.x, n.y);
    if (toolMode === "setScale") {
      if (!scaleDraft || !scaleDraft.from) {
        scaleDraft = { from: pt, to: null };
      } else if (!scaleDraft.to) {
        scaleDraft.to = pt;
        tb.scaleLengthWrap.hidden = false;
        tb.scaleLengthInput.focus();
      } else {
        scaleDraft = { from: pt, to: null };
        tb.scaleLengthWrap.hidden = true;
      }
      render();
      return;
    }
    if (toolMode === "measure") {
      if (!measureDraft || !measureDraft.from) {
        measureDraft = { from: pt, to: null };
      } else {
        measureDraft.to = pt;
        var result = computeMeasure(
          measureDraft.from,
          measureDraft.to,
          plan.naturalWidth,
          plan.naturalHeight,
          calibrationState
        );
        measureResult = {
          from: measureDraft.from,
          to: measureDraft.to,
          label: result.label,
        };
        updateMeasureReadout(result.label);
        measureDraft = null;
      }
      render();
      return;
    }
    if (toolMode === "drawRoom") {
      if (!drawRoomPoints) drawRoomPoints = [];
      if (
        drawRoomPoints.length >= 3 &&
        isNearPoint(pt, drawRoomPoints[0], 0.02)
      ) {
        finishDrawRoom();
        return;
      }
      drawRoomPoints.push(pt);
      render();
      return;
    }
    if (toolMode === "view") {
      var room = pickRoomAtNorm(pt.x, pt.y);
      selectRoom(room);
    }
  }

  function handleVertexEditClick(pt, handle) {
    if (handle) {
      var roomId = handle.getAttribute("data-room-id");
      var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
      selectedVertex = { roomId: roomId, index: vi };
      if (!selectedRoomId) selectedRoomId = roomId;
      syncFloorSelect();
      syncRoomMeasureReadout();
      render();
      return;
    }
    var room = selectedRoomId
      ? data.rooms.find(function (r) {
          return (r.id || r.name || "") === selectedRoomId;
        })
      : pickRoomAtNorm(pt.x, pt.y);
    if (!room || !room.polygon) return;
    selectedRoomId = room.id || room.name || null;
    var insertAt = findEdgeInsertIndex(pt, room.polygon, 0.025);
    if (insertAt != null) {
      room.polygon.splice(insertAt, 0, { x: pt.x, y: pt.y });
      selectedVertex = { roomId: selectedRoomId, index: insertAt };
      syncRoomMeasureReadout();
      render();
    }
  }

  function render() {
    layoutOverlay();
    var drawLabel = "";
    if (drawRoomPoints && drawRoomPoints.length >= 2) {
      var preview = drawRoomPoints.slice();
      if (drawRoomCursor) preview.push(drawRoomCursor);
      drawLabel = formatAreaLabel(
        preview,
        plan.naturalWidth,
        plan.naturalHeight,
        calibrationState
      );
    }
    renderPlan(overlay, data, activeRoomId, selectedFurnitureId, imageSize(), {
      vertexEditMode: toolMode === "vertexEdit",
      selectedRoomId: selectedRoomId,
      scaleDraft: scaleDraft,
      measureResult: measureResult,
      measureDraft: measureDraft,
      drawRoomPoints: drawRoomPoints,
      drawRoomCursor: toolMode === "drawRoom" ? drawRoomCursor : null,
      drawRoomAreaLabel: drawLabel,
      roomMeasureBadge: getRoomMeasureBadge(),
      selectedVertex: selectedVertex,
    });
    updateWallWarning();
    syncToolUi();
  }

  function onPlanLoaded() {
    if (plan.naturalWidth && plan.naturalHeight) {
      PLAN_SIZE = { width: plan.naturalWidth, height: plan.naturalHeight };
    }
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

  function applyAnalysisFromObject(nextData, options) {
    options = options || {};
    var validationWarnings = nextData._validationWarnings;
    if (validationWarnings) {
      delete nextData._validationWarnings;
    }
    if (options.validate && plan.naturalWidth && plan.naturalHeight) {
      var validation = validateAnalysis(
        nextData,
        plan.naturalWidth,
        plan.naturalHeight
      );
      if (validation.blocking) {
        throw new Error(validation.blocking);
      }
      if (validation.warnings && validation.warnings.length) {
        validationWarnings = (validationWarnings || []).concat(validation.warnings);
      }
    }
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
    selectedRoomId = null;
    selectedVertex = null;
    scaleDraft = null;
    measureDraft = null;
    drawRoomPoints = null;
    drawRoomCursor = null;
    undoStack.clear();
    syncUndoButton();
    syncReplaceSelect();
    syncFloorSelect();
    syncRoomMeasureReadout();
    refreshCalibration();
    if (validationWarnings && validationWarnings.length) {
      wallWarnEl.textContent = validationWarnings.join(" ");
    } else {
      wallWarnEl.textContent = "";
    }
    render();
  }

  function runVisionOnFile(file) {
    setLlmStatus("LLM: reading image...");
    fileToImageBase64(file)
      .then(function (img) {
        setLlmStatus("LLM: analyzing with Fireworks (may take several minutes)...");
        return analyzeFloorPlan(img.imageBase64, img.mimeType);
      })
      .then(function (analysis) {
        applyAnalysisFromObject(analysis, { validate: true });
        var warn = wallWarnEl.textContent
          ? " (warnings — see yellow banner; use Edit vertices)"
          : "";
        setLlmStatus("LLM: analysis loaded" + warn);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        setLlmStatus("LLM: error - " + msg);
        alert(msg);
      });
  }

  function slugForFilename(text) {
    var slug = String(text || "floor-plan")
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return slug || "floor-plan";
  }

  function downloadJsonObject(obj, filename) {
    var json = JSON.stringify(obj, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function currentCorrectedFixtureJson() {
    return {
      analysisVersion: data.analysisVersion || "1.0",
      label: data.label || "Corrected fixture",
      calibration: data.calibration || null,
      rooms: data.rooms || [],
      walls: data.walls || [],
      windows: data.windows || [],
    };
  }

  function exportJson() {
    downloadJsonObject(currentAnalysisJson(), "floor-plan-analysis.json");
  }

  function exportCorrectedJson() {
    if (!(data.rooms && data.rooms.length) && !(data.walls && data.walls.length)) {
      alert("No room or wall geometry to export. Analyze or load a plan first.");
      return;
    }
    downloadJsonObject(
      currentCorrectedFixtureJson(),
      slugForFilename(data.label) + "-corrected.json"
    );
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
    exportCorrectedJson: exportCorrectedJson,
    analyzeLlm: function () {
      var f = tb.fileInput.files && tb.fileInput.files[0];
      if (!f) {
        alert("Open an image first (Open image).");
        return;
      }
      runVisionOnFile(f);
    },
    toggleGeometryOnly: function () {
      geometryOnly = !geometryOnly;
      applyGeometryOnlyClass();
    },
    toggleSetScale: function () {
      toggleTool("setScale");
    },
    toggleMeasure: function () {
      toggleTool("measure");
    },
    toggleVertexEdit: function () {
      toggleTool("vertexEdit");
    },
    toggleDrawRoom: function () {
      if (toolMode === "drawRoom") {
        drawRoomPoints = null;
        drawRoomCursor = null;
        setToolMode("view");
      } else {
        toolMode = "drawRoom";
        drawRoomPoints = [];
        drawRoomCursor = null;
        selectedVertex = null;
        selectedFurnitureId = null;
        scaleDraft = null;
        measureDraft = null;
        syncReplaceSelect();
        syncToolUi();
        render();
      }
    },
    finishDrawRoom: finishDrawRoom,
    deleteSelectedVertex: deleteSelectedVertex,
    undo: performUndo,
    applyScale: applyScaleFromInput,
    onFloorChange: function () {
      if (!selectedRoomId) return;
      var room = data.rooms.find(function (r) {
        return (r.id || r.name || "") === selectedRoomId;
      });
      if (!room) return;
      room.flooring = tb.floorSelect.value;
      syncRoomMeasureReadout();
      render();
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
  toolbarEl.appendChild(wallWarnEl);
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
      if (toolMode === "setScale" || toolMode === "measure" || toolMode === "drawRoom") {
        e.stopPropagation();
        stopCameraTween();
        var nTool = clientToPlanNormalized(e.clientX, e.clientY);
        handlePlanToolClick(nTool);
        return;
      }
      if (toolMode === "view" && !e.target.closest("[data-furniture-id]")) {
        var nRoom = clientToPlanNormalized(e.clientX, e.clientY);
        var hitRoom = pickRoomAtNorm(nRoom.x, nRoom.y);
        e.stopPropagation();
        selectRoom(hitRoom);
        return;
      }
      var handle = e.target.closest(".plan-vertex-handle");
      if (toolMode === "vertexEdit") {
        e.stopPropagation();
        stopCameraTween();
        var nVert = clientToPlanNormalized(e.clientX, e.clientY);
        if (handle) {
          var roomId = handle.getAttribute("data-room-id");
          var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
          var room = data.rooms.find(function (r) {
            return (r.id || r.name || "") === roomId;
          });
          if (!room || !room.polygon || isNaN(vi)) return;
          selectedVertex = { roomId: roomId, index: vi };
          selectedRoomId = roomId;
          var pt = room.polygon[vi];
          vertexDrag = {
            roomId: roomId,
            index: vi,
            ox: pt.x,
            oy: pt.y,
            nx: nVert.x,
            ny: nVert.y,
          };
          syncFloorSelect();
          syncRoomMeasureReadout();
          render();
          return;
        }
        handleVertexEditClick(nVert, null);
        return;
      }
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
    if (furnitureDrag || vertexDrag) return;
    if (toolMode === "drawRoom") {
      var nDraw = clientToPlanNormalized(e.clientX, e.clientY);
      drawRoomCursor = clampNorm(nDraw.x, nDraw.y);
      render();
      return;
    }
    if (toolMode === "setScale" || toolMode === "measure") return;
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
    if (toolMode === "setScale" || toolMode === "measure" || toolMode === "drawRoom") return;
    if (e.target.closest("[data-furniture-id]")) return;
    if (e.target.closest(".plan-vertex-handle")) return;
    stopCameraTween();
    drag = { x: e.clientX - tx, y: e.clientY - ty };
  });
  window.addEventListener("mousemove", function (e) {
    if (vertexDrag) {
      var room = data.rooms.find(function (r) {
        return (r.id || r.name || "") === vertexDrag.roomId;
      });
      if (room && room.polygon && room.polygon[vertexDrag.index]) {
        var n = clientToPlanNormalized(e.clientX, e.clientY);
        var pt = room.polygon[vertexDrag.index];
        pt.x = Math.min(1, Math.max(0, vertexDrag.ox + (n.x - vertexDrag.nx)));
        pt.y = Math.min(1, Math.max(0, vertexDrag.oy + (n.y - vertexDrag.ny)));
        syncRoomMeasureReadout();
        render();
      }
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
    if (vertexDrag) {
      vertexDrag = null;
      syncRoomMeasureReadout();
      return;
    }
    if (furnitureDrag) {
      var item = data.furniture.find(function (f) {
        return f.id === furnitureDrag.id;
      });
      var el = furnitureDrag.el || furnitureElementById(furnitureDrag.id);
      if (item && el) {
        el.setAttribute("transform", furnitureTransform(item));
        animateFurnitureDragEnd(el);
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
      toolMode = "view";
      vertexDrag = null;
      scaleDraft = null;
      measureDraft = null;
      drawRoomPoints = null;
      drawRoomCursor = null;
      selectedVertex = null;
      syncReplaceSelect();
      syncToolUi();
      render();
      e.preventDefault();
      return;
    }
    if (toolMode === "setScale" && e.key === "Enter") {
      applyScaleFromInput();
      e.preventDefault();
      return;
    }
    if (toolMode === "drawRoom" && e.key === "Enter") {
      finishDrawRoom();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      performUndo();
      e.preventDefault();
      return;
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      toolMode === "vertexEdit" &&
      selectedVertex
    ) {
      deleteSelectedVertex();
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
  syncToolUi();
  syncFloorSelect();
  syncRoomMeasureReadout();
  syncUndoButton();
}
