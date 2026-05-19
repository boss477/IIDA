import { createUndoStack } from "../lib/undoStack.js";
import { setToolButtonActive } from "./toolbar.js";
import {
  clampNorm,
  computeMeasure,
  createRoomFromPreset,
  createWallFromPoints,
  ensureEditableWalls,
  findEdgeInsertIndex,
  findWallEdgeInsertIndex,
  formatAreaLabel,
  formatRoomDimensions,
  isNearPoint,
  pickWallAtNorm,
  upsertCalibrationSegment,
} from "./planTools.js";

/**
 * Geometry tools: setScale | measure | drawRoom | vertexEdit | editWalls | drawWall | view.
 */
export function createGeometryEditor(deps) {
  var data = deps.data;
  var plan = deps.plan;
  var geoTb = deps.geoTb;
  var planWrap = deps.planWrap;
  var hintEl = deps.hintEl;
  var getCalibrationState = deps.getCalibrationState;
  var refreshCalibration = deps.refreshCalibration;
  var pickRoomAtNorm = deps.pickRoomAtNorm;
  var requestRender = deps.requestRender;
  var onToolModeChange = deps.onToolModeChange || function () {};
  var onSelectRoom = deps.onSelectRoom || function () {};

  var toolMode = "view";
  var vertexDrag = null;
  var selectedRoomId = null;
  var scaleDraft = null;
  var measureDraft = null;
  var measureResult = null;
  var drawRoomPoints = null;
  var drawRoomCursor = null;
  var drawWallPoints = null;
  var drawWallCursor = null;
  var selectedVertex = null;
  var selectedWallId = null;
  var selectedWallVertex = null;
  var undoStack = createUndoStack(50);

  function getToolMode() {
    return toolMode;
  }

  function isGeometryClickMode() {
    return (
      toolMode === "setScale" ||
      toolMode === "measure" ||
      toolMode === "drawRoom" ||
      toolMode === "drawWall"
    );
  }

  function blocksFurnitureInteraction() {
    return toolMode !== "view";
  }

  function syncToolUi() {
    setToolButtonActive(geoTb.btnSetScale, toolMode === "setScale");
    setToolButtonActive(geoTb.btnMeasure, toolMode === "measure");
    setToolButtonActive(geoTb.btnVertexEdit, toolMode === "vertexEdit");
    setToolButtonActive(geoTb.btnDrawRoom, toolMode === "drawRoom");
    setToolButtonActive(geoTb.btnEditWalls, toolMode === "editWalls");
    setToolButtonActive(geoTb.btnAddWall, toolMode === "drawWall");
    geoTb.finishRoomBtn.hidden = toolMode !== "drawRoom";
    if (geoTb.finishWallBtn) geoTb.finishWallBtn.hidden = toolMode !== "drawWall";
    geoTb.deleteVertexBtn.hidden =
      (toolMode !== "vertexEdit" || !selectedVertex) &&
      (toolMode !== "editWalls" || !selectedWallVertex);
    if (geoTb.deleteWallBtn) {
      geoTb.deleteWallBtn.hidden = toolMode !== "editWalls" || !selectedWallId;
    }
    if (
      toolMode === "setScale" ||
      toolMode === "measure" ||
      toolMode === "drawRoom" ||
      toolMode === "drawWall"
    ) {
      planWrap.classList.add("tool-crosshair");
    } else {
      planWrap.classList.remove("tool-crosshair");
    }
    if (toolMode === "setScale" && scaleDraft && scaleDraft.from && scaleDraft.to) {
      geoTb.scaleLengthWrap.hidden = false;
    } else if (toolMode !== "setScale") {
      geoTb.scaleLengthWrap.hidden = true;
    }
    if (hintEl) {
      if (toolMode === "setScale") {
        hintEl.textContent =
          "Set scale: click two points, enter length (m), Apply — updates Scale bar.";
      } else if (toolMode === "measure") {
        hintEl.textContent = "Measure: click start, then end.";
      } else if (toolMode === "vertexEdit") {
        hintEl.textContent =
          "Drag handles · click edge to add vertex · Delete vertex removes corner.";
      } else if (toolMode === "drawRoom") {
        hintEl.textContent =
          "Add room: click corners · Finish room or click first point (≥3) · set scale for m².";
      } else if (toolMode === "editWalls") {
        hintEl.textContent =
          "Edit walls: click a wall · drag blue handles · click edge to add point · Remove wall deletes selection.";
      } else if (toolMode === "drawWall") {
        hintEl.textContent =
          "Add wall: click points along the wall run (≥2) · Finish wall when done.";
      } else {
        hintEl.textContent =
          "Geometry tools above · Furniture row below · one tool active at a time.";
      }
    }
    syncUndoButton();
  }

  function setToolMode(mode) {
    toolMode = mode;
    scaleDraft = null;
    measureDraft = null;
    drawRoomPoints = null;
    drawRoomCursor = null;
    drawWallPoints = null;
    drawWallCursor = null;
    selectedVertex = null;
    selectedWallId = null;
    selectedWallVertex = null;
    if (mode !== "measure") {
      measureResult = null;
      updateMeasureReadout("—");
    }
    if (mode !== "setScale") geoTb.scaleLengthWrap.hidden = true;
    syncToolUi();
    onToolModeChange(mode);
    requestRender();
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
      drawWallPoints = mode === "drawWall" ? [] : null;
      drawWallCursor = null;
      selectedVertex = null;
      if (mode === "editWalls" || mode === "drawWall") {
        ensureEditableWalls(data);
      }
      if (mode !== "editWalls") {
        selectedWallId = null;
        selectedWallVertex = null;
      }
      syncToolUi();
      onToolModeChange(mode);
      requestRender();
    }
  }

  function syncFloorSelect() {
    if (!selectedRoomId) {
      geoTb.floorSelect.disabled = true;
      geoTb.floorSelect.value = "";
      return;
    }
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    geoTb.floorSelect.disabled = !room;
    if (room) geoTb.floorSelect.value = room.flooring || "wood";
  }

  function syncRoomMeasureReadout() {
    if (!selectedRoomId) {
      geoTb.roomMeasureReadout.textContent = "Room: —";
      return;
    }
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    if (!room || !room.polygon) {
      geoTb.roomMeasureReadout.textContent = "Room: —";
      return;
    }
    var cal = getCalibrationState();
    var area = formatAreaLabel(room.polygon, plan.naturalWidth, plan.naturalHeight, cal);
    var dims = formatRoomDimensions(room.polygon, plan.naturalWidth, plan.naturalHeight, cal);
    geoTb.roomMeasureReadout.textContent =
      (room.name || room.id) + ": " + area + (dims ? " · " + dims : "");
    if (cal && dims) room.dimensionsText = dims;
  }

  function getRoomMeasureBadge() {
    if (!selectedRoomId) return null;
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === selectedRoomId;
    });
    if (!room || !room.polygon) return null;
    var cal = getCalibrationState();
    return {
      room: room,
      areaLabel: formatAreaLabel(room.polygon, plan.naturalWidth, plan.naturalHeight, cal),
      dimLabel: formatRoomDimensions(room.polygon, plan.naturalWidth, plan.naturalHeight, cal),
    };
  }

  function captureUndoState() {
    return {
      rooms: JSON.parse(JSON.stringify(data.rooms || [])),
      walls: JSON.parse(JSON.stringify(data.walls || [])),
      selectedRoomId: selectedRoomId,
      selectedWallId: selectedWallId,
      selectedVertex: selectedVertex
        ? { roomId: selectedVertex.roomId, index: selectedVertex.index }
        : null,
      selectedWallVertex: selectedWallVertex
        ? { wallId: selectedWallVertex.wallId, index: selectedWallVertex.index }
        : null,
    };
  }

  function syncUndoButton() {
    geoTb.btnUndo.disabled = !undoStack.canUndo();
  }

  function pushUndo(action) {
    undoStack.push({ action: action, state: captureUndoState() });
    syncUndoButton();
  }

  function performUndo() {
    if (!undoStack.canUndo()) return;
    var entry = undoStack.pop();
    data.rooms = entry.state.rooms;
    data.walls = entry.state.walls || [];
    selectedRoomId = entry.state.selectedRoomId;
    selectedWallId = entry.state.selectedWallId || null;
    selectedVertex = entry.state.selectedVertex;
    selectedWallVertex = entry.state.selectedWallVertex || null;
    syncFloorSelect();
    syncRoomMeasureReadout();
    syncUndoButton();
    requestRender();
  }

  function updateMeasureReadout(text) {
    geoTb.measureReadout.textContent = "Measure: " + (text || "—");
  }

  function selectRoom(room) {
    selectedRoomId = room ? room.id || room.name || null : null;
    selectedVertex = null;
    syncFloorSelect();
    syncRoomMeasureReadout();
    onSelectRoom(selectedRoomId);
    requestRender();
  }

  function finishDrawRoom() {
    if (!drawRoomPoints || drawRoomPoints.length < 3) {
      alert("Add at least 3 corners, then Finish room.");
      return;
    }
    var presetId = geoTb.roomPresetSelect.value || "other";
    var room = createRoomFromPreset(data.rooms, presetId, drawRoomPoints);
    var cal = getCalibrationState();
    var area = formatAreaLabel(room.polygon, plan.naturalWidth, plan.naturalHeight, cal);
    var dims = formatRoomDimensions(room.polygon, plan.naturalWidth, plan.naturalHeight, cal);
    if (dims) room.dimensionsText = dims;
    pushUndo("addRoom");
    data.rooms.push(room);
    if (data.walls && data.walls.length) {
      data.walls.push({
        id: "wall-" + room.id,
        points: room.polygon.concat([room.polygon[0]]),
        thickness: 0.006,
      });
    }
    drawRoomPoints = null;
    drawRoomCursor = null;
    toolMode = "view";
    selectRoom(room);
    geoTb.roomMeasureReadout.textContent =
      (room.name || room.id) + ": " + area + (dims ? " · " + dims : "") + " (added)";
    syncToolUi();
    onToolModeChange("view");
    requestRender();
  }

  function deleteSelectedVertex() {
    if (toolMode === "editWalls" && selectedWallVertex) {
      deleteSelectedWallVertex();
      return;
    }
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
    requestRender();
  }

  function selectWall(wall) {
    selectedWallId = wall ? wall.id || null : null;
    selectedWallVertex = null;
    syncToolUi();
    requestRender();
  }

  function deleteSelectedWall() {
    if (!selectedWallId) return;
    var idx = (data.walls || []).findIndex(function (w) {
      return (w.id || "") === selectedWallId;
    });
    if (idx < 0) return;
    pushUndo("deleteWall");
    var removedId = selectedWallId;
    data.walls.splice(idx, 1);
    selectedWallId = null;
    selectedWallVertex = null;
    syncToolUi();
    requestRender();
  }

  function deleteSelectedWallVertex() {
    if (!selectedWallVertex) return;
    var wall = (data.walls || []).find(function (w) {
      return (w.id || "") === selectedWallVertex.wallId;
    });
    if (!wall || !wall.points || wall.points.length <= 2) {
      alert("A wall needs at least 2 points.");
      return;
    }
    pushUndo("deleteWallVertex");
    wall.points.splice(selectedWallVertex.index, 1);
    selectedWallVertex = null;
    syncToolUi();
    requestRender();
  }

  function finishDrawWall() {
    if (!drawWallPoints || drawWallPoints.length < 2) {
      alert("Add at least 2 points, then Finish wall.");
      return;
    }
    if (!data.walls) data.walls = [];
    pushUndo("addWall");
    var wall = createWallFromPoints(data.walls, drawWallPoints);
    data.walls.push(wall);
    drawWallPoints = null;
    drawWallCursor = null;
    toolMode = "editWalls";
    selectWall(wall);
    syncToolUi();
    onToolModeChange("editWalls");
    requestRender();
  }

  function applyScaleFromInput() {
    if (!scaleDraft || !scaleDraft.from || !scaleDraft.to) {
      alert("Click two points on the plan first.");
      return;
    }
    var lengthM = parseFloat(geoTb.scaleLengthInput.value, 10);
    if (!isFinite(lengthM) || lengthM <= 0) {
      alert("Enter a valid length in meters.");
      return;
    }
    upsertCalibrationSegment(data, scaleDraft.from, scaleDraft.to, lengthM);
    scaleDraft = null;
    geoTb.scaleLengthWrap.hidden = true;
    geoTb.scaleLengthInput.value = "";
    refreshCalibration();
    requestRender();
  }

  function handlePlanClick(n) {
    var pt = clampNorm(n.x, n.y);
    if (toolMode === "setScale") {
      if (!scaleDraft || !scaleDraft.from) {
        scaleDraft = { from: pt, to: null };
      } else if (!scaleDraft.to) {
        scaleDraft.to = pt;
        geoTb.scaleLengthWrap.hidden = false;
        geoTb.scaleLengthInput.focus();
      } else {
        scaleDraft = { from: pt, to: null };
        geoTb.scaleLengthWrap.hidden = true;
      }
      requestRender();
      return true;
    }
    if (toolMode === "measure") {
      var cal = getCalibrationState();
      if (!measureDraft || !measureDraft.from) {
        measureDraft = { from: pt, to: null };
      } else {
        measureDraft.to = pt;
        var result = computeMeasure(
          measureDraft.from,
          measureDraft.to,
          plan.naturalWidth,
          plan.naturalHeight,
          cal
        );
        measureResult = {
          from: measureDraft.from,
          to: measureDraft.to,
          label: result.label,
        };
        updateMeasureReadout(result.label);
        measureDraft = null;
      }
      requestRender();
      return true;
    }
    if (toolMode === "drawRoom") {
      if (!drawRoomPoints) drawRoomPoints = [];
      if (drawRoomPoints.length >= 3 && isNearPoint(pt, drawRoomPoints[0], 0.02)) {
        finishDrawRoom();
        return true;
      }
      drawRoomPoints.push(pt);
      requestRender();
      return true;
    }
    if (toolMode === "drawWall") {
      if (!drawWallPoints) drawWallPoints = [];
      drawWallPoints.push(pt);
      requestRender();
      return true;
    }
    if (toolMode === "view") {
      selectRoom(pickRoomAtNorm(pt.x, pt.y));
      return true;
    }
    return false;
  }

  function handleWallEditClick(pt, handle) {
    if (handle) {
      var wallId = handle.getAttribute("data-wall-id");
      var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
      selectedWallId = wallId;
      selectedWallVertex = { wallId: wallId, index: vi };
      syncToolUi();
      requestRender();
      return true;
    }
    var wall = selectedWallId
      ? (data.walls || []).find(function (w) {
          return (w.id || "") === selectedWallId;
        })
      : pickWallAtNorm(pt.x, pt.y, data.walls, 0.03);
    if (!wall || !wall.points) {
      selectWall(null);
      return true;
    }
    selectedWallId = wall.id || null;
    var insertAt = findWallEdgeInsertIndex(pt, wall.points, 0.025);
    if (insertAt != null) {
      pushUndo("addWallVertex");
      wall.points.splice(insertAt, 0, { x: pt.x, y: pt.y });
      selectedWallVertex = { wallId: selectedWallId, index: insertAt };
      syncToolUi();
      requestRender();
      return true;
    }
    selectWall(wall);
    return true;
  }

  function handleWallMousedown(n, handle) {
    if (handle) {
      var wallId = handle.getAttribute("data-wall-id");
      var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
      var wall = (data.walls || []).find(function (w) {
        return (w.id || "") === wallId;
      });
      if (!wall || !wall.points || isNaN(vi)) return false;
      selectedWallId = wallId;
      selectedWallVertex = { wallId: wallId, index: vi };
      var pt = wall.points[vi];
      vertexDrag = {
        kind: "wall",
        wallId: wallId,
        index: vi,
        ox: pt.x,
        oy: pt.y,
        nx: n.x,
        ny: n.y,
      };
      syncToolUi();
      requestRender();
      return true;
    }
    return handleWallEditClick(n, null);
  }

  function handleVertexEditClick(pt, handle) {
    if (handle) {
      var roomId = handle.getAttribute("data-room-id");
      var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
      selectedVertex = { roomId: roomId, index: vi };
      if (!selectedRoomId) selectedRoomId = roomId;
      syncFloorSelect();
      syncRoomMeasureReadout();
      requestRender();
      return true;
    }
    var room = selectedRoomId
      ? data.rooms.find(function (r) {
          return (r.id || r.name || "") === selectedRoomId;
        })
      : pickRoomAtNorm(pt.x, pt.y);
    if (!room || !room.polygon) return false;
    selectedRoomId = room.id || room.name || null;
    var insertAt = findEdgeInsertIndex(pt, room.polygon, 0.025);
    if (insertAt != null) {
      room.polygon.splice(insertAt, 0, { x: pt.x, y: pt.y });
      selectedVertex = { roomId: selectedRoomId, index: insertAt };
      syncRoomMeasureReadout();
      requestRender();
      return true;
    }
    return false;
  }

  function handleVertexMousedown(n, handle) {
    if (handle) {
      var roomId = handle.getAttribute("data-room-id");
      var vi = parseInt(handle.getAttribute("data-vertex-index"), 10);
      var room = data.rooms.find(function (r) {
        return (r.id || r.name || "") === roomId;
      });
      if (!room || !room.polygon || isNaN(vi)) return false;
      selectedVertex = { roomId: roomId, index: vi };
      selectedRoomId = roomId;
      var pt = room.polygon[vi];
      vertexDrag = {
        kind: "room",
        roomId: roomId,
        index: vi,
        ox: pt.x,
        oy: pt.y,
        nx: n.x,
        ny: n.y,
      };
      syncFloorSelect();
      syncRoomMeasureReadout();
      requestRender();
      return true;
    }
    return handleVertexEditClick(n, null);
  }

  function handleMousemove(n) {
    if (toolMode === "drawRoom") {
      drawRoomCursor = clampNorm(n.x, n.y);
      requestRender();
      return true;
    }
    if (toolMode === "drawWall") {
      drawWallCursor = clampNorm(n.x, n.y);
      requestRender();
      return true;
    }
    return false;
  }

  function handleVertexDragMove(n) {
    if (!vertexDrag) return false;
    if (vertexDrag.kind === "wall") {
      var wall = (data.walls || []).find(function (w) {
        return (w.id || "") === vertexDrag.wallId;
      });
      if (wall && wall.points && wall.points[vertexDrag.index]) {
        var wpt = wall.points[vertexDrag.index];
        wpt.x = Math.min(1, Math.max(0, vertexDrag.ox + (n.x - vertexDrag.nx)));
        wpt.y = Math.min(1, Math.max(0, vertexDrag.oy + (n.y - vertexDrag.ny)));
        requestRender();
      }
      return true;
    }
    var room = data.rooms.find(function (r) {
      return (r.id || r.name || "") === vertexDrag.roomId;
    });
    if (room && room.polygon && room.polygon[vertexDrag.index]) {
      var pt = room.polygon[vertexDrag.index];
      pt.x = Math.min(1, Math.max(0, vertexDrag.ox + (n.x - vertexDrag.nx)));
      pt.y = Math.min(1, Math.max(0, vertexDrag.oy + (n.y - vertexDrag.ny)));
      syncRoomMeasureReadout();
      requestRender();
    }
    return true;
  }

  function clearVertexDrag() {
    if (vertexDrag) {
      vertexDrag = null;
      syncRoomMeasureReadout();
      return true;
    }
    return false;
  }

  function getRenderOptions() {
    var cal = getCalibrationState();
    var drawLabel = "";
    if (drawRoomPoints && drawRoomPoints.length >= 2) {
      var preview = drawRoomPoints.slice();
      if (drawRoomCursor) preview.push(drawRoomCursor);
      drawLabel = formatAreaLabel(preview, plan.naturalWidth, plan.naturalHeight, cal);
    }
    return {
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
      wallEditMode: toolMode === "editWalls",
      selectedWallId: selectedWallId,
      selectedWallVertex: selectedWallVertex,
      drawWallPoints: drawWallPoints,
      drawWallCursor: toolMode === "drawWall" ? drawWallCursor : null,
    };
  }

  function handleEscape() {
    var wasActive =
      toolMode !== "view" ||
      selectedVertex ||
      selectedWallVertex ||
      selectedWallId ||
      scaleDraft ||
      measureDraft ||
      drawRoomPoints ||
      drawWallPoints;
    toolMode = "view";
    vertexDrag = null;
    scaleDraft = null;
    measureDraft = null;
    drawRoomPoints = null;
    drawRoomCursor = null;
    drawWallPoints = null;
    drawWallCursor = null;
    selectedVertex = null;
    selectedWallId = null;
    selectedWallVertex = null;
    measureResult = null;
    updateMeasureReadout("—");
    geoTb.scaleLengthWrap.hidden = true;
    syncToolUi();
    onToolModeChange("view");
    return wasActive;
  }

  function handleKeydown(e) {
    if (toolMode === "setScale" && e.key === "Enter") {
      applyScaleFromInput();
      return true;
    }
    if (toolMode === "drawRoom" && e.key === "Enter") {
      finishDrawRoom();
      return true;
    }
    if (toolMode === "drawWall" && e.key === "Enter") {
      finishDrawWall();
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      performUndo();
      return true;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (toolMode === "editWalls" && selectedWallVertex) {
        deleteSelectedWallVertex();
        return true;
      }
      if (toolMode === "editWalls" && selectedWallId) {
        deleteSelectedWall();
        return true;
      }
      if (toolMode === "vertexEdit" && selectedVertex) {
        deleteSelectedVertex();
        return true;
      }
    }
    return false;
  }

  function init() {
    syncToolUi();
    syncFloorSelect();
    syncRoomMeasureReadout();
  }

  return {
    init: init,
    getToolMode: getToolMode,
    isGeometryClickMode: isGeometryClickMode,
    blocksFurnitureInteraction: blocksFurnitureInteraction,
    getRenderOptions: getRenderOptions,
    handlePlanClick: handlePlanClick,
    handleVertexMousedown: handleVertexMousedown,
    handleWallMousedown: handleWallMousedown,
    handleMousemove: handleMousemove,
    handleVertexDragMove: handleVertexDragMove,
    clearVertexDrag: clearVertexDrag,
    handleEscape: handleEscape,
    handleKeydown: handleKeydown,
    toggleTool: toggleTool,
    finishDrawRoom: finishDrawRoom,
    finishDrawWall: finishDrawWall,
    deleteSelectedVertex: deleteSelectedVertex,
    deleteSelectedWall: deleteSelectedWall,
    performUndo: performUndo,
    applyScaleFromInput: applyScaleFromInput,
    onFloorChange: function () {
      if (!selectedRoomId) return;
      var room = data.rooms.find(function (r) {
        return (r.id || r.name || "") === selectedRoomId;
      });
      if (!room) return;
      room.flooring = geoTb.floorSelect.value;
      syncRoomMeasureReadout();
      requestRender();
    },
    syncRoomMeasureReadout: syncRoomMeasureReadout,
    selectRoom: selectRoom,
  };
}
