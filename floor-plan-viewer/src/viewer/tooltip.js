/**
 * @param {HTMLElement} tipEl
 * @param {MouseEvent} e
 * @param {{ name: string, dimensions?: string, dimensionsText?: string, areaSqFt?: number|null, type?: string }} room
 * @param {{ areaSqM?: number|null, scaleSummary?: string|null }} [opts]
 */
export function showRoomTooltip(tipEl, e, room, opts) {
  opts = opts || {};
  var dimStr = opts.dimLine || room.dimensions || room.dimensionsText;
  var dim = dimStr ? " — " + dimStr : "";
  var area = "";
  if (opts.areaLine) {
    area += "<br/>Area: " + opts.areaLine;
  } else if (room.areaSqFt != null) {
    area += "<br/>Area: ~" + room.areaSqFt + " sq ft";
  }
  if (opts.scaleSummary) {
    area += "<br/><span class=\"tip-cal-sub\">" + opts.scaleSummary + "</span>";
  }
  tipEl.innerHTML = "<strong>" + room.name + dim + "</strong>" + area;
  tipEl.hidden = false;
  tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 300) + "px";
  tipEl.style.top = Math.min(e.clientY + 14, window.innerHeight - 120) + "px";
}

/** @param {HTMLElement} tipEl */
export function hideTooltip(tipEl) {
  tipEl.hidden = true;
}

/** @param {HTMLElement} tipEl
 * @param {{ clientX: number, clientY: number }} e
 * @param {string} label
 */
export function showFurnitureTooltip(tipEl, e, label) {
  if (!label) {
    hideTooltip(tipEl);
    return;
  }
  tipEl.innerHTML = "<strong>" + label + "</strong>";
  tipEl.hidden = false;
  tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 360) + "px";
  tipEl.style.top = Math.min(e.clientY + 14, window.innerHeight - 80) + "px";
}

/**
 * Multi-line measurement tooltip (3D furniture / room).
 * @param {HTMLElement} tipEl
 * @param {{ clientX: number, clientY: number }} e
 * @param {string} title
 * @param {string[]} [detailLines]
 */
export function showMeasureTooltip(tipEl, e, title, detailLines) {
  if (!title) {
    hideTooltip(tipEl);
    return;
  }
  var html = "<strong>" + title + "</strong>";
  (detailLines || []).forEach(function (line) {
    if (line) html += "<br/><span class=\"tip-dim\">" + line + "</span>";
  });
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 360) + "px";
  var tipY = e.clientY + 14;
  if (e.clientY > window.innerHeight - 220) tipY = e.clientY - 100;
  tipEl.style.top = Math.min(tipY, window.innerHeight - 80) + "px";
}
