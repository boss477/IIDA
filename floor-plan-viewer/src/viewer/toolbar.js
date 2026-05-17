import { FLOORING_OPTIONS, ROOM_PRESETS } from "./planTools.js";

/**
 * @param {HTMLElement} container
 * @param {object} handlers
 */
export function mountToolbar(container, handlers) {
  container.innerHTML = "";

  var lab = document.createElement("label");
  lab.className = "btn";
  lab.textContent = "Open image";
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.hidden = true;
  lab.appendChild(inp);
  container.appendChild(lab);

  var buttons = {};

  function addButton(text, fn, key) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", fn);
    container.appendChild(b);
    if (key) buttons[key] = b;
    return b;
  }

  addButton("Load sample JSON", handlers.loadFixture);
  if (handlers.uploadSupabase) {
    addButton("Upload plan (Supabase)", handlers.uploadSupabase);
  }
  addButton("+", handlers.zoomIn);
  addButton("−", handlers.zoomOut);
  addButton("Reset", handlers.reset);
  if (handlers.exportJson) addButton("Export JSON", handlers.exportJson);
  if (handlers.exportCorrectedJson) addButton("Export corrected JSON", handlers.exportCorrectedJson);
  if (handlers.analyzeLlm) addButton("Analyze LLM", handlers.analyzeLlm);
  if (handlers.toggleGeometryOnly) addButton("Geometry only", handlers.toggleGeometryOnly);

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
  container.appendChild(roomPresetSelect);

  var finishRoomBtn = document.createElement("button");
  finishRoomBtn.type = "button";
  finishRoomBtn.textContent = "Finish room";
  finishRoomBtn.className = "finish-room-btn";
  finishRoomBtn.hidden = true;
  finishRoomBtn.addEventListener("click", handlers.finishDrawRoom);
  container.appendChild(finishRoomBtn);

  var deleteVertexBtn = document.createElement("button");
  deleteVertexBtn.type = "button";
  deleteVertexBtn.textContent = "Delete vertex";
  deleteVertexBtn.className = "delete-vertex-btn";
  deleteVertexBtn.hidden = true;
  deleteVertexBtn.addEventListener("click", handlers.deleteSelectedVertex);
  container.appendChild(deleteVertexBtn);

  var btnUndo = document.createElement("button");
  btnUndo.type = "button";
  btnUndo.textContent = "Undo";
  btnUndo.className = "undo-btn";
  btnUndo.disabled = true;
  btnUndo.setAttribute("aria-label", "Undo last room or vertex change");
  btnUndo.title = "Undo (Ctrl+Z)";
  btnUndo.addEventListener("click", handlers.undo);
  container.appendChild(btnUndo);

  addButton("Fullscreen", handlers.fullscreen);

  var scaleLengthWrap = document.createElement("span");
  scaleLengthWrap.className = "scale-length-wrap";
  scaleLengthWrap.hidden = true;
  var scaleLengthLabel = document.createElement("label");
  scaleLengthLabel.textContent = "Length (m)";
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
  scaleApplyBtn.className = "scale-apply-btn";
  scaleApplyBtn.addEventListener("click", handlers.applyScale);
  scaleLengthLabel.appendChild(scaleLengthInput);
  scaleLengthWrap.appendChild(scaleLengthLabel);
  scaleLengthWrap.appendChild(scaleApplyBtn);
  container.appendChild(scaleLengthWrap);

  var measureReadout = document.createElement("span");
  measureReadout.className = "measure-readout";
  measureReadout.textContent = "Measure: —";
  container.appendChild(measureReadout);

  var roomMeasureReadout = document.createElement("span");
  roomMeasureReadout.className = "room-measure-readout";
  roomMeasureReadout.textContent = "Room: —";
  container.appendChild(roomMeasureReadout);

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
  container.appendChild(floorLab);

  return {
    fileInput: inp,
    btnSetScale: buttons.btnSetScale,
    btnMeasure: buttons.btnMeasure,
    btnVertexEdit: buttons.btnVertexEdit,
    btnDrawRoom: buttons.btnDrawRoom,
    roomPresetSelect: roomPresetSelect,
    finishRoomBtn: finishRoomBtn,
    deleteVertexBtn: deleteVertexBtn,
    btnUndo: btnUndo,
    scaleLengthInput: scaleLengthInput,
    scaleApplyBtn: scaleApplyBtn,
    scaleLengthWrap: scaleLengthWrap,
    measureReadout: measureReadout,
    roomMeasureReadout: roomMeasureReadout,
    floorSelect: floorSelect,
  };
}

/**
 * @param {HTMLButtonElement} btn
 * @param {boolean} active
 */
export function setToolButtonActive(btn, active) {
  if (!btn) return;
  if (active) btn.classList.add("tool-active");
  else btn.classList.remove("tool-active");
}
