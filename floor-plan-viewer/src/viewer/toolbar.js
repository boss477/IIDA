import { FLOORING_OPTIONS, ROOM_PRESETS } from "./planTools.js";

/**
 * Row 1: file, zoom, export, LLM.
 */
export function mountFileToolbar(container, handlers) {
  var row = document.createElement("div");
  row.className = "toolbar-row toolbar-row--file";

  var lab = document.createElement("label");
  lab.className = "btn";
  lab.textContent = "Open image";
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.hidden = true;
  lab.appendChild(inp);
  row.appendChild(lab);

  function addButton(text, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = text;
    b.addEventListener("click", fn);
    row.appendChild(b);
    return b;
  }

  addButton("Load sample JSON", handlers.loadFixture);
  if (handlers.uploadSupabase) addButton("Upload plan (Supabase)", handlers.uploadSupabase);
  addButton("+", handlers.zoomIn);
  addButton("−", handlers.zoomOut);
  addButton("Reset", handlers.reset);
  if (handlers.exportJson) addButton("Export JSON", handlers.exportJson);
  if (handlers.analyzeLlm) addButton("Analyze LLM", handlers.analyzeLlm);
  addButton("Fullscreen", handlers.fullscreen);

  container.appendChild(row);
  return { fileInput: inp, row: row };
}

/**
 * Row 2: geometry tools (single active mode).
 */
export function mountGeometryToolbar(container, handlers) {
  var row = document.createElement("div");
  row.className = "toolbar-row toolbar-row--geometry";

  var groupLab = document.createElement("span");
  groupLab.className = "toolbar-group-label";
  groupLab.textContent = "Geometry";
  row.appendChild(groupLab);

  var buttons = {};

  function addButton(text, fn, key) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = text;
    b.addEventListener("click", fn);
    row.appendChild(b);
    if (key) buttons[key] = b;
    return b;
  }

  buttons.btnSetScale = addButton("Set scale", handlers.toggleSetScale, "btnSetScale");
  buttons.btnMeasure = addButton("Measure", handlers.toggleMeasure, "btnMeasure");
  buttons.btnVertexEdit = addButton("Edit vertices", handlers.toggleVertexEdit, "btnVertexEdit");
  buttons.btnDrawRoom = addButton("Add room", handlers.toggleDrawRoom, "btnDrawRoom");

  var roomPresetSelect = document.createElement("select");
  roomPresetSelect.className = "room-preset-select";
  roomPresetSelect.setAttribute("aria-label", "Room type preset");
  ROOM_PRESETS.forEach(function (p) {
    var o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    roomPresetSelect.appendChild(o);
  });
  row.appendChild(roomPresetSelect);

  var finishRoomBtn = document.createElement("button");
  finishRoomBtn.type = "button";
  finishRoomBtn.textContent = "Finish room";
  finishRoomBtn.className = "btn finish-room-btn";
  finishRoomBtn.hidden = true;
  finishRoomBtn.addEventListener("click", handlers.finishDrawRoom);
  row.appendChild(finishRoomBtn);

  var deleteVertexBtn = document.createElement("button");
  deleteVertexBtn.type = "button";
  deleteVertexBtn.textContent = "Delete vertex";
  deleteVertexBtn.className = "btn delete-vertex-btn";
  deleteVertexBtn.hidden = true;
  deleteVertexBtn.addEventListener("click", handlers.deleteSelectedVertex);
  row.appendChild(deleteVertexBtn);

  var btnUndo = document.createElement("button");
  btnUndo.type = "button";
  btnUndo.textContent = "Undo";
  btnUndo.className = "btn undo-btn";
  btnUndo.disabled = true;
  btnUndo.title = "Undo (Ctrl+Z)";
  btnUndo.addEventListener("click", handlers.undo);
  row.appendChild(btnUndo);

  var scaleLengthWrap = document.createElement("span");
  scaleLengthWrap.className = "scale-length-wrap";
  scaleLengthWrap.hidden = true;
  var scaleLengthLabel = document.createElement("label");
  scaleLengthLabel.textContent = "Length (m) ";
  scaleLengthLabel.className = "scale-length-label";
  var scaleLengthInput = document.createElement("input");
  scaleLengthInput.type = "number";
  scaleLengthInput.min = "0.01";
  scaleLengthInput.step = "0.01";
  scaleLengthInput.className = "scale-length-input";
  scaleLengthInput.setAttribute("aria-label", "Known length in meters");
  var scaleApplyBtn = document.createElement("button");
  scaleApplyBtn.type = "button";
  scaleApplyBtn.textContent = "Apply scale";
  scaleApplyBtn.className = "btn scale-apply-btn";
  scaleApplyBtn.addEventListener("click", handlers.applyScale);
  scaleLengthLabel.appendChild(scaleLengthInput);
  scaleLengthWrap.appendChild(scaleLengthLabel);
  scaleLengthWrap.appendChild(scaleApplyBtn);
  row.appendChild(scaleLengthWrap);

  var measureReadout = document.createElement("span");
  measureReadout.className = "measure-readout";
  measureReadout.textContent = "Measure: —";
  row.appendChild(measureReadout);

  var roomMeasureReadout = document.createElement("span");
  roomMeasureReadout.className = "room-measure-readout";
  roomMeasureReadout.textContent = "Room: —";
  row.appendChild(roomMeasureReadout);

  var floorLab = document.createElement("label");
  floorLab.className = "floor-picker-label";
  floorLab.textContent = "Floor ";
  var floorSelect = document.createElement("select");
  floorSelect.className = "floor-picker-select";
  floorSelect.disabled = true;
  floorSelect.setAttribute("aria-label", "Room floor material");
  var emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select room…";
  floorSelect.appendChild(emptyOpt);
  FLOORING_OPTIONS.forEach(function (opt) {
    var o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    floorSelect.appendChild(o);
  });
  floorSelect.addEventListener("change", handlers.onFloorChange);
  floorLab.appendChild(floorSelect);
  row.appendChild(floorLab);

  container.appendChild(row);

  return {
    row: row,
    btnSetScale: buttons.btnSetScale,
    btnMeasure: buttons.btnMeasure,
    btnVertexEdit: buttons.btnVertexEdit,
    btnDrawRoom: buttons.btnDrawRoom,
    roomPresetSelect: roomPresetSelect,
    finishRoomBtn: finishRoomBtn,
    deleteVertexBtn: deleteVertexBtn,
    btnUndo: btnUndo,
    scaleLengthInput: scaleLengthInput,
    scaleLengthWrap: scaleLengthWrap,
    measureReadout: measureReadout,
    roomMeasureReadout: roomMeasureReadout,
    floorSelect: floorSelect,
  };
}

export function setToolButtonActive(btn, active) {
  if (!btn) return;
  if (active) btn.classList.add("tool-active");
  else btn.classList.remove("tool-active");
}

/** @deprecated use mountFileToolbar */
export function mountToolbar(container, handlers) {
  return mountFileToolbar(container, handlers);
}
