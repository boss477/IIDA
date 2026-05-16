import { animateRoomHighlight } from "./planAnimations.js";

const NS = "http://www.w3.org/2000/svg";

function pointsAttr(polygon, imageWidth, imageHeight) {
  return polygon.map(function (p) {
    return p.x * imageWidth + "," + p.y * imageHeight;
  }).join(" ");
}

/**
 * @param {SVGSVGElement} svg
 * @param {Array<{id:string,polygon:Array}>} rooms
 * @param {string|null} activeId
 * @param {{ width:number, height:number }} imageSize
 */
export function renderRooms(svg, rooms, activeId, imageSize) {
  var w = imageSize && imageSize.width ? imageSize.width : 1;
  var h = imageSize && imageSize.height ? imageSize.height : 1;
  svg.querySelectorAll("[data-room]").forEach(function (n) {
    n.remove();
  });
  rooms.forEach(function (r) {
    if (!r.polygon || r.polygon.length < 3) return;
    var poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("class", "hi");
    poly.setAttribute("data-room", r.id);
    poly.setAttribute("points", pointsAttr(r.polygon, w, h));
    poly.setAttribute("opacity", activeId === r.id ? "1" : "0");
    svg.appendChild(poly);
  });
}

/**
 * @param {SVGSVGElement} svg
 * @param {Array<{id:string,polygon:Array}>} rooms
 * @param {string|null} activeId
 * @param {{ width:number, height:number }} imageSize
 * @param {(room: object) => string} colorForRoom
 */
export function renderRoomFills(svg, rooms, activeId, imageSize, colorForRoom) {
  var w = imageSize && imageSize.width ? imageSize.width : 1;
  var h = imageSize && imageSize.height ? imageSize.height : 1;
  svg.querySelectorAll("[data-room-fill]").forEach(function (n) {
    n.remove();
  });
  rooms.forEach(function (r) {
    if (!r.polygon || r.polygon.length < 3) return;
    var poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("class", "plan-room-fill");
    poly.setAttribute("data-room-fill", r.id);
    poly.setAttribute("points", pointsAttr(r.polygon, w, h));
    poly.setAttribute("fill", colorForRoom ? colorForRoom(r) : "#fafafa");
    poly.setAttribute("data-active", activeId === r.id ? "1" : "0");
    svg.appendChild(poly);
  });
}

/**
 * @param {SVGSVGElement} svg
 * @param {string|null} activeId
 */
export function updateRoomHighlight(svg, activeId) {
  animateRoomHighlight(svg, activeId, { duration: 0.22 });
}
