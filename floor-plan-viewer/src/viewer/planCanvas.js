import { renderDoors } from "./doorLayer.js";
import { renderFurniture } from "./furnitureLayer.js";
import { renderRoomFills, renderRooms } from "./roomOverlay.js";

const NS = "http://www.w3.org/2000/svg";

const ROOM_COLORS = {
  kitchen: "#fffde7",
  bedroom: "#e8f0fe",
  bathroom: "#e0f7fa",
  living: "#f3e5f5",
  dining: "#fff3e0",
  passage: "#f5f5f5",
  balcony: "#e8f5e9",
  default: "#fafafa",
};

function colorForRoom(room) {
  if (room.color) return room.color;
  var name = String(room.type || room.name || "").toLowerCase();
  var keys = Object.keys(ROOM_COLORS);
  for (var i = 0; i < keys.length; i++) {
    if (name.indexOf(keys[i]) >= 0) return ROOM_COLORS[keys[i]];
  }
  return ROOM_COLORS.default;
}

function pointsAttr(points, imageWidth, imageHeight) {
  return (points || [])
    .map(function (p) {
      return p.x * imageWidth + "," + p.y * imageHeight;
    })
    .join(" ");
}

function polygonCentroid(points) {
  if (!points || !points.length) return { x: 0.5, y: 0.5 };
  var area = 0;
  var cx = 0;
  var cy = 0;
  for (var i = 0; i < points.length; i++) {
    var a = points[i];
    var b = points[(i + 1) % points.length];
    var cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 0.000001) {
    var sx = 0;
    var sy = 0;
    points.forEach(function (p) {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / points.length, y: sy / points.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function wallSourceFromRooms(rooms) {
  return (rooms || [])
    .filter(function (r) {
      return r.polygon && r.polygon.length >= 3;
    })
    .map(function (r) {
      return {
        id: "wall-from-" + (r.id || r.name || Math.random()),
        points: r.polygon.concat([r.polygon[0]]),
        thickness: 0.006,
      };
    });
}

function renderBackground(svg, size) {
  var rect = document.createElementNS(NS, "rect");
  rect.setAttribute("class", "plan-bg");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", String(size.width));
  rect.setAttribute("height", String(size.height));
  svg.appendChild(rect);
}

function renderWalls(svg, walls, rooms, size) {
  var source = walls && walls.length ? walls : wallSourceFromRooms(rooms);
  var unit = Math.min(size.width, size.height);
  source.forEach(function (wall, idx) {
    if (!wall.points || wall.points.length < 2) return;
    var line = document.createElementNS(NS, "polyline");
    line.setAttribute("class", "plan-wall");
    line.setAttribute("data-wall", wall.id || "wall-" + idx);
    line.setAttribute("points", pointsAttr(wall.points, size.width, size.height));
    line.setAttribute("stroke-width", Math.max(4, (wall.thickness || 0.008) * unit));
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  });
}

function renderLabels(svg, rooms, size) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var point = room.labelPoint || polygonCentroid(room.polygon);
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "plan-label");
    g.setAttribute("transform", "translate(" + point.x * size.width + " " + point.y * size.height + ")");

    var name = document.createElementNS(NS, "text");
    name.setAttribute("class", "plan-label-name");
    name.setAttribute("text-anchor", "middle");
    name.textContent = room.name || room.id || "Room";
    g.appendChild(name);

    if (room.dimensionsText || room.dimensions) {
      var dims = document.createElementNS(NS, "text");
      dims.setAttribute("class", "plan-label-dims");
      dims.setAttribute("text-anchor", "middle");
      dims.setAttribute("dy", "1.25em");
      dims.textContent = room.dimensionsText || String(room.dimensions);
      g.appendChild(dims);
    }

    svg.appendChild(g);
  });
}

export function renderPlan(svg, data, activeRoomId, selectedFurnitureId, size) {
  svg.innerHTML = "";
  renderBackground(svg, size);
  renderRoomFills(svg, data.rooms || [], activeRoomId, size, colorForRoom);
  renderWalls(svg, data.walls || [], data.rooms || [], size);
  renderDoors(svg, data.doors || [], size);
  renderFurniture(
    svg,
    data.furniture || [],
    data.furniture_catalog || [],
    selectedFurnitureId,
    size
  );
  renderLabels(svg, data.rooms || [], size);
  renderRooms(svg, data.rooms || [], activeRoomId, size);
}
