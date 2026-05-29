// Premium architectural SVG renderer.
// Renders the analyzed floor plan as vector geometry: textured floors, walls,
// doors, furniture, labels, and hover-compatible room overlays.

import { parseSofaParams, furnitureNormDimensions } from "../lib/catalogSizing.js";
import { getRoomMeasurementDisplay, wallSourceFromRooms } from "./planTools.js";
import {
  renderCalibrationOverlays,
  renderDrawRoomOverlay,
  renderMeasureOverlay,
  renderRoomMeasurementBadge,
  renderSelectedRoomOutline,
  renderSelectedWallHighlight,
  renderVertexHandles,
  renderWallVertexHandles,
} from "./geometryOverlays.js";
import { getSofaPalette } from "../lib/sofaColors.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag) {
  return document.createElementNS(NS, tag);
}

function setAttrs(el, attrs) {
  Object.keys(attrs).forEach(function (key) {
    var value = attrs[key];
    if (value !== undefined && value !== null) {
      if (key === "textContent") {
        el.textContent = String(value);
      } else {
        el.setAttribute(key, String(value));
      }
    }
  });
  return el;
}

function createDefs(svg) {
  var defs = svg.querySelector("defs");
  if (!defs) {
    defs = svgEl("defs");
    svg.appendChild(defs);
  }

  var wood = setAttrs(svgEl("pattern"), {
    id: "wood-floor",
    patternUnits: "userSpaceOnUse",
    width: 60,
    height: 18,
  });
  wood.appendChild(setAttrs(svgEl("rect"), { width: 60, height: 18, fill: "#f0e6d8" }));
  for (var i = 1; i < 6; i++) {
    wood.appendChild(
      setAttrs(svgEl("line"), {
        x1: i * 10,
        y1: 0,
        x2: i * 10,
        y2: 18,
        stroke: "#e0d0c0",
        "stroke-width": 0.8,
      })
    );
  }
  wood.appendChild(setAttrs(svgEl("line"), { x1: 0, y1: 0, x2: 60, y2: 0, stroke: "#e0d0c0", "stroke-width": 0.8 }));
  wood.appendChild(setAttrs(svgEl("line"), { x1: 0, y1: 18, x2: 60, y2: 18, stroke: "#e0d0c0", "stroke-width": 0.8 }));
  for (var g = 0; g < 4; g++) {
    wood.appendChild(
      setAttrs(svgEl("path"), {
        d: "M " + (5 + g * 15) + " 2 Q " + (8 + g * 15) + " 9 " + (5 + g * 15) + " 16",
        stroke: "#e8d8c8",
        "stroke-width": 0.5,
        fill: "none",
      })
    );
  }
  defs.appendChild(wood);

  var tile = setAttrs(svgEl("pattern"), {
    id: "tile-floor",
    patternUnits: "userSpaceOnUse",
    width: 24,
    height: 24,
  });
  tile.appendChild(setAttrs(svgEl("rect"), { width: 24, height: 24, fill: "#f5f8fa" }));
  tile.appendChild(setAttrs(svgEl("path"), { d: "M0 0 L0 24 M0 0 L24 0", stroke: "#c8d8e4", "stroke-width": 1 }));
  tile.appendChild(setAttrs(svgEl("rect"), { x: 1, y: 1, width: 22, height: 22, fill: "none", stroke: "#ffffff", "stroke-width": 0.5, opacity: 0.5 }));
  defs.appendChild(tile);

  var kitchen = setAttrs(svgEl("pattern"), {
    id: "kitchen-floor",
    patternUnits: "userSpaceOnUse",
    width: 32,
    height: 32,
  });
  kitchen.appendChild(setAttrs(svgEl("rect"), { width: 32, height: 32, fill: "#fef8e0" }));
  kitchen.appendChild(setAttrs(svgEl("path"), { d: "M0 0 L0 32 M0 0 L32 0", stroke: "#f0e0b0", "stroke-width": 1 }));
  kitchen.appendChild(setAttrs(svgEl("rect"), { x: 1, y: 1, width: 30, height: 30, fill: "none", stroke: "#ffffff", "stroke-width": 0.5, opacity: 0.4 }));
  defs.appendChild(kitchen);

  var stone = setAttrs(svgEl("pattern"), {
    id: "stone-floor",
    patternUnits: "userSpaceOnUse",
    width: 40,
    height: 20,
  });
  stone.appendChild(setAttrs(svgEl("rect"), { width: 40, height: 20, fill: "#e8e8e8" }));
  [
    { x: 1, y: 1, width: 17, height: 8 },
    { x: 21, y: 1, width: 18, height: 8 },
    { x: 1, y: 11, width: 18, height: 8 },
    { x: 21, y: 11, width: 17, height: 8 },
  ].forEach(function (r) {
    stone.appendChild(
      setAttrs(svgEl("rect"), {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        fill: "#f2f2f2",
        stroke: "#d0d0d0",
        "stroke-width": 0.8,
      })
    );
  });
  defs.appendChild(stone);

  var carpet = setAttrs(svgEl("pattern"), {
    id: "carpet",
    patternUnits: "userSpaceOnUse",
    width: 12,
    height: 12,
  });
  carpet.appendChild(setAttrs(svgEl("rect"), { width: 12, height: 12, fill: "#f5f0e8" }));
  carpet.appendChild(setAttrs(svgEl("circle"), { cx: 3, cy: 3, r: 0.8, fill: "#e0d8cc" }));
  carpet.appendChild(setAttrs(svgEl("circle"), { cx: 9, cy: 9, r: 0.8, fill: "#e0d8cc" }));
  defs.appendChild(carpet);
}

function patternForRoom(room) {
  var flooring = String(room.flooring || "").toLowerCase();
  var name = String(room.type || room.name || "").toLowerCase();
  if (flooring === "wood" || name.indexOf("bed") >= 0 || name.indexOf("living") >= 0 || name.indexOf("dining") >= 0 || name.indexOf("hall") >= 0) return "url(#wood-floor)";
  if (flooring === "tile" || name.indexOf("bath") >= 0) return "url(#tile-floor)";
  if (name.indexOf("kitchen") >= 0) return "url(#kitchen-floor)";
  if (flooring === "stone" || name.indexOf("balcon") >= 0 || name.indexOf("patio") >= 0 || name.indexOf("outdoor") >= 0 || name.indexOf("terrace") >= 0) return "url(#stone-floor)";
  return "#fafafa";
}

function baseColorForRoom(room) {
  var flooring = String(room.flooring || "").toLowerCase();
  var name = String(room.type || room.name || "").toLowerCase();
  if (room.color) return room.color;
  if (name.indexOf("kitchen") >= 0) return "#fef8e0";
  if (name.indexOf("bath") >= 0 || flooring === "tile") return "#eaf4f8";
  if (name.indexOf("bed") >= 0) return "#fdfcf8";
  if (name.indexOf("living") >= 0 || name.indexOf("dining") >= 0) return "#faf5f0";
  if (name.indexOf("balcon") >= 0 || name.indexOf("patio") >= 0 || flooring === "stone") return "#f0f0f0";
  return "#fafafa";
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

function catalogById(catalog, id) {
  if (!catalog || !id) return null;
  for (var i = 0; i < catalog.length; i++) {
    if (String(catalog[i].id) === String(id)) return catalog[i];
  }
  return null;
}

function renderBackground(svg, size, planImageSrc) {
  var bgGroup = svgEl("g");
  bgGroup.setAttribute("class", "plan-bg-group");
  svg.appendChild(bgGroup);

  bgGroup.appendChild(
    setAttrs(svgEl("rect"), {
      class: "plan-bg",
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      fill: "#ffffff",
    })
  );

  if (planImageSrc) {
    bgGroup.appendChild(
      setAttrs(svgEl("image"), {
        href: planImageSrc,
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        preserveAspectRatio: "none",
        opacity: "0.5"
      })
    );
  }
}

function renderTexturedFills(svg, rooms, activeRoomId, size) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var pts = pointsAttr(room.polygon, size.width, size.height);

    svg.appendChild(setAttrs(svgEl("polygon"), { class: "plan-room-bg", points: pts, fill: baseColorForRoom(room), stroke: "none" }));
    svg.appendChild(
      setAttrs(svgEl("polygon"), {
        class: "plan-room-fill",
        "data-room-fill": room.id || room.name || "",
        "data-active": activeRoomId === room.id || activeRoomId === room.name ? "1" : "0",
        points: pts,
        fill: patternForRoom(room),
        stroke: "rgba(30, 27, 24, 0.18)",
        "stroke-width": 1,
      })
    );
  });
}

function renderRugs(svg, rooms, size) {
  (rooms || []).forEach(function (room) {
    var name = String(room.type || room.name || "").toLowerCase();
    if (name.indexOf("living") < 0 && name.indexOf("bed") < 0) return;
    if (!room.polygon || room.polygon.length < 3) return;

    var minX = 1;
    var minY = 1;
    var maxX = 0;
    var maxY = 0;
    room.polygon.forEach(function (p) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    var pad = 0.06;
    var rw = (maxX - minX - pad * 2) * size.width;
    var rh = (maxY - minY - pad * 2) * size.height;
    if (rw <= 0 || rh <= 0) return;

    svg.appendChild(
      setAttrs(svgEl("rect"), {
        x: (minX + pad) * size.width,
        y: (minY + pad) * size.height,
        width: rw,
        height: rh,
        fill: "url(#carpet)",
        stroke: "#e0d8cc",
        "stroke-width": 1,
        rx: 6,
        opacity: 0.78,
      })
    );
  });
}

function renderWindows(svg, windows, size) {
  (windows || []).forEach(function (win) {
    if (!win.position || win.width == null) return;
    var wx = win.position.x * size.width;
    var wy = win.position.y * size.height;
    var ww = win.width * size.width;
    var wh = (win.height || 0.008) * Math.min(size.width, size.height);

    svg.appendChild(
      setAttrs(svgEl("rect"), {
        class: "window-mark",
        x: wx - ww / 2,
        y: wy - wh / 2,
        width: ww,
        height: wh,
        fill: "#c8e0f0",
        stroke: "#ffffff",
        "stroke-width": 2,
        opacity: 0.85,
      })
    );

    svg.appendChild(
      setAttrs(svgEl("line"), {
        class: "window-mullion",
        x1: wx - ww / 2,
        y1: wy,
        x2: wx + ww / 2,
        y2: wy,
        stroke: "#ffffff",
        "stroke-width": 1.5,
      })
    );

    if (ww > 40) {
      [0.33, 0.67].forEach(function (frac) {
        var mx = wx - ww / 2 + ww * frac;
        svg.appendChild(
          setAttrs(svgEl("line"), {
            class: "window-mullion",
            x1: mx,
            y1: wy - wh / 2,
            x2: mx,
            y2: wy + wh / 2,
            stroke: "#ffffff",
            "stroke-width": 1.5,
          })
        );
      });
    } else if (ww > 20) {
      svg.appendChild(
        setAttrs(svgEl("line"), {
          class: "window-mullion",
          x1: wx,
          y1: wy - wh / 2,
          x2: wx,
          y2: wy + wh / 2,
          stroke: "#ffffff",
          "stroke-width": 1.5,
        })
      );
    }
  });
}

function renderDoorPolygon(svg, door, idx, size) {
  if (!door.polygon || door.polygon.length < 3) return false;
  var unit = Math.min(size.width, size.height);
  var g = setAttrs(svgEl("g"), { "data-door": door.id || "door-" + idx, class: "door-mark" });
  g.appendChild(
    setAttrs(svgEl("polygon"), {
      points: pointsAttr(door.polygon, size.width, size.height),
      fill: "rgba(61,40,23,0.12)",
      stroke: "#3d2817",
      "stroke-width": Math.max(1, unit * 0.0014),
      "stroke-linejoin": "miter",
    })
  );
  svg.appendChild(g);
  return true;
}

function renderDoorArcs(svg, doors, size) {
  (doors || []).forEach(function (door, idx) {
    if (!door.position && door.x == null) {
      renderDoorPolygon(svg, door, idx, size);
      return;
    }

    var unit = Math.min(size.width, size.height);
    var x = (door.position ? door.position.x : door.x) * size.width;
    var y = (door.position ? door.position.y : door.y) * size.height;
    var radius = (door.width || door.radius || 0.035) * unit;
    var swing = door.swing || "right";
    var d = "";

    if (swing === "left" || swing === 1) {
      d = "M " + x + " " + y + " L " + (x - radius) + " " + y + " A " + radius + " " + radius + " 0 0 1 " + x + " " + (y + radius);
    } else if (swing === "up" || swing === 2) {
      d = "M " + x + " " + y + " L " + x + " " + (y - radius) + " A " + radius + " " + radius + " 0 0 1 " + (x - radius) + " " + y;
    } else if (swing === "down" || swing === 3) {
      d = "M " + x + " " + y + " L " + x + " " + (y + radius) + " A " + radius + " " + radius + " 0 0 1 " + (x + radius) + " " + y;
    } else {
      d = "M " + x + " " + y + " L " + (x + radius) + " " + y + " A " + radius + " " + radius + " 0 0 1 " + x + " " + (y + radius);
    }

    var g = setAttrs(svgEl("g"), { "data-door": door.id || "door-" + idx, class: "door-mark" });
    g.appendChild(setAttrs(svgEl("path"), { d: d, fill: "none", stroke: "#999999", "stroke-width": 1.2, "stroke-dasharray": "3,2" }));

    var angle = Math.PI / 4;
    if (swing === "left" || swing === 1) angle = Math.PI - Math.PI / 4;
    else if (swing === "up" || swing === 2) angle = -Math.PI / 4;
    else if (swing === "down" || swing === 3) angle = Math.PI / 4 + Math.PI / 2;

    g.appendChild(
      setAttrs(svgEl("line"), {
        x1: x,
        y1: y,
        x2: x + Math.cos(angle) * radius * 0.92,
        y2: y + Math.sin(angle) * radius * 0.92,
        stroke: "#666666",
        "stroke-width": 1.5,
      })
    );
    svg.appendChild(g);
  });
}

function renderWalls(svg, walls, rooms, size) {
  var fromRooms = wallSourceFromRooms(rooms);
  var source = (walls && walls.length) ? walls : fromRooms;
  var unit = Math.min(size.width, size.height);
  source.forEach(function (wall, idx) {
    if (!wall.points || wall.points.length < 2) return;
    var pts = pointsAttr(wall.points, size.width, size.height);
    var tNorm = wall.thickness != null ? wall.thickness : 0.007;
    if (!isFinite(tNorm)) tNorm = 0.007;
    tNorm = Math.min(0.05, Math.max(0.001, tNorm));
    var thickness = Math.max(5, tNorm * unit);

    svg.appendChild(
      setAttrs(svgEl("polyline"), {
        points: pts,
        stroke: "rgba(0,0,0,0.08)",
        "stroke-width": thickness + 3,
        "stroke-linejoin": "round",
        "stroke-linecap": "butt",
        fill: "none",
        transform: "translate(1.5 1.5)",
      })
    );
    svg.appendChild(
      setAttrs(svgEl("polyline"), {
        class: "plan-wall",
        "data-wall": wall.id || "wall-" + idx,
        points: pts,
        stroke: "#1a1a1a",
        "stroke-width": thickness,
        "stroke-linejoin": "round",
        "stroke-linecap": "butt",
        fill: "none",
      })
    );
  });
}

function furnitureType(item, catalog) {
  var row = catalogById(catalog, item.catalogId);
  return String(item.type || item.shape || item.catalogId || (row && (row.shape || row.name)) || "").toLowerCase();
}

function furnitureRotation(item) {
  return item.rotationDeg != null ? item.rotationDeg : item.rotation || 0;
}

function furnitureSize(item, size, renderCtx) {
  renderCtx = renderCtx || {};
  var catalog = renderCtx.furnitureCatalog || [];
  var row = catalogById(catalog, item.catalogId);
  var ctx = {
    mmPerPixel: renderCtx.mmPerPixel,
    planWidthPx: renderCtx.planWidthPx != null ? renderCtx.planWidthPx : size.width,
    planHeightPx: renderCtx.planHeightPx != null ? renderCtx.planHeightPx : size.height,
  };
  var dims = furnitureNormDimensions(item, row, ctx);
  if (!dims && (item.catalogWidthMm != null || item.catalogDepthMm != null)) {
    dims = furnitureNormDimensions(
      item,
      { width_mm: item.catalogWidthMm, depth_mm: item.catalogDepthMm },
      ctx
    );
  }
  if (dims) {
    return { w: dims.wNorm * size.width, h: dims.hNorm * size.height };
  }
  var placeholder = 0.035;
  return { w: placeholder * size.width, h: placeholder * size.height };
}

function isSelectedFurniture(itemId, selectedIds, primaryId) {
  if (!selectedIds || !itemId) return false;
  if (selectedIds instanceof Set) return selectedIds.has(itemId);
  if (Array.isArray(selectedIds)) return selectedIds.indexOf(itemId) >= 0;
  return selectedIds === itemId;
}

function renderGroupConnectors(svg, furniture, size, renderCtx) {
  var groups = {};
  (furniture || []).forEach(function (item) {
    if (!item.groupId || item.x == null || item.y == null) return;
    if (!groups[item.groupId]) groups[item.groupId] = [];
    groups[item.groupId].push(item);
  });
  Object.keys(groups).forEach(function (gid) {
    var members = groups[gid];
    if (members.length < 2) return;
    for (var i = 0; i < members.length; i++) {
      for (var j = i + 1; j < members.length; j++) {
        var a = members[i];
        var b = members[j];
        svg.appendChild(
          setAttrs(svgEl("line"), {
            class: "furniture-group-connector",
            x1: a.x * size.width,
            y1: a.y * size.height,
            x2: b.x * size.width,
            y2: b.y * size.height,
          })
        );
      }
    }
  });
}

function renderDetailedFurniture(svg, furniture, catalog, selectedIds, primaryId, size, renderCtx) {
  renderGroupConnectors(svg, furniture, size, renderCtx);
  (furniture || [])
    .slice()
    .sort(function (a, b) {
      return (a.zIndex || 0) - (b.zIndex || 0);
    })
    .forEach(function (item, idx) {
      if (item.x == null || item.y == null) return;
      var cx = item.x * size.width;
      var cy = item.y * size.height;
      var box = furnitureSize(item, size, renderCtx);
      var catalogRow = catalogById(catalog || [], item.catalogId);
      var type = furnitureType(item, catalog || []);
      var selected = isSelectedFurniture(item.id, selectedIds, primaryId);
      var isPrimary = primaryId && item.id === primaryId;
      var g = setAttrs(svgEl("g"), {
        "data-furniture-id": item.id || "f-" + idx,
        class:
          "furniture-g" +
          (selected ? " furniture-g--selected" : "") +
          (isPrimary ? " furniture-g--primary" : "") +
          (item.groupId ? " furniture-g--grouped" : ""),
        "data-group-id": item.groupId || "",
        transform: "translate(" + cx + " " + cy + ") rotate(" + furnitureRotation(item) + ")",
      });

      if (type.indexOf("bed") >= 0) renderBed(g, box.w, box.h);
      else if (type.indexOf("sofa") >= 0 || type.indexOf("lounge") >= 0 || type.indexOf("sectional") >= 0) {
        var sofaOpts = item.sofaParams;
        if (!sofaOpts) {
          sofaOpts = parseSofaParams(
            (catalogRow && catalogRow.keywords) || item.keywords,
            (catalogRow && catalogRow.product_name) || item.product_name
          );
        }
        if (type.indexOf("sectional") >= 0 && !sofaOpts.hasLounge) sofaOpts.hasLounge = true;
        renderSofa(g, box.w, box.h, sofaOpts);
      }
      else if (type.indexOf("dining") >= 0 || type.indexOf("table") >= 0) renderTable(g, box.w, box.h, item.chairs || 4);
      else if (type.indexOf("chair") >= 0) renderChair(g, box.w, box.h);
      else if (type.indexOf("kitchen") >= 0 || type.indexOf("island") >= 0 || type.indexOf("counter") >= 0) renderKitchenIsland(g, box.w, box.h);
      else if (type.indexOf("tub") >= 0 || type.indexOf("bathtub") >= 0) renderBathtub(g, box.w, box.h);
      else if (type.indexOf("toilet") >= 0 || type.indexOf("wc") >= 0) renderToilet(g, box.w, box.h);
      else if (type.indexOf("sink") >= 0 || type.indexOf("basin") >= 0) renderSink(g, box.w, box.h);
      else if (type.indexOf("desk") >= 0 || type.indexOf("office") >= 0) renderDesk(g, box.w, box.h);
      else if (type.indexOf("plant") >= 0 || type.indexOf("tree") >= 0) renderPlant(g, box.w, box.h);
      else if (type.indexOf("rug") >= 0) renderRugItem(g, box.w, box.h);
      else g.appendChild(setAttrs(svgEl("rect"), { x: -box.w / 2, y: -box.h / 2, width: box.w, height: box.h, fill: "#dddddd", stroke: "#999999", rx: 2 }));

      if (selected) {
        g.appendChild(
          setAttrs(svgEl("rect"), {
            class: "furniture-select-ring" + (isPrimary ? " furniture-select-ring--primary" : ""),
            x: -box.w / 2 - 4,
            y: -box.h / 2 - 4,
            width: box.w + 8,
            height: box.h + 8,
            fill: "none",
            stroke: isPrimary ? "#1d4ed8" : "#2563eb",
            "stroke-width": isPrimary ? 2.5 : 2,
            rx: 4,
          })
        );
      }

      if (item.groupId) {
        g.appendChild(
          setAttrs(svgEl("circle"), {
            class: "furniture-group-badge",
            cx: box.w / 2 - 6,
            cy: -box.h / 2 + 6,
            r: 5,
          })
        );
      }

      svg.appendChild(g);
    });
}

function renderBed(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h * 0.18, fill: "#c4a882", stroke: "#a08060", rx: 3 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2 + 2, y: -h / 2 + h * 0.18, width: w - 4, height: h * 0.82 - 2, fill: "#ffffff", stroke: "#e8e8e8", rx: 3 }));
  var pw = w * 0.32;
  var ph = h * 0.14;
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2 + 5, y: -h / 2 + h * 0.2, width: pw, height: ph, fill: "#f8f8f8", stroke: "#dddddd", rx: 4 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: w / 2 - 5 - pw, y: -h / 2 + h * 0.2, width: pw, height: ph, fill: "#f8f8f8", stroke: "#dddddd", rx: 4 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2 + 2, y: h / 2 - h * 0.34, width: w - 4, height: h * 0.32, fill: "#b8d4e8", stroke: "#98c0d8", rx: 3 }));
}

/** Top-down catalog sofa — parametric seats / lounge / arms / color from keywords. */
function renderSofa(g, w, h, opts) {
  var seats = (opts && opts.seats) || 2;
  var hasLounge = opts && opts.hasLounge;
  var hasArm = !opts || opts.hasArm !== false;
  var pal = getSofaPalette(opts && opts.color);
  g.setAttribute("class", (g.getAttribute("class") || "") + " furniture-icon--shearling-sofa");
  if (opts && opts.color) g.setAttribute("data-sofa-color", opts.color);
  var bodyW = hasLounge ? w / 1.35 : w;
  var loungeW = hasLounge ? w - bodyW : 0;
  var backH = h * 0.25;
  var seatH = h - backH;
  var armW = hasArm ? w * 0.06 : 0;
  var innerW = bodyW - armW * 2;
  var seatCount = Math.max(1, Math.min(6, seats));
  var cushionW = innerW / seatCount;

  g.appendChild(
    setAttrs(svgEl("rect"), {
      x: -bodyW / 2,
      y: -h / 2,
      width: bodyW,
      height: backH,
      fill: pal.back,
      stroke: pal.stroke,
      rx: 3,
    })
  );
  if (hasArm) {
    g.appendChild(
      setAttrs(svgEl("rect"), {
        x: -bodyW / 2,
        y: -h / 2 + backH,
        width: armW,
        height: seatH,
        fill: pal.arm,
        stroke: pal.stroke,
        rx: 2,
      })
    );
    g.appendChild(
      setAttrs(svgEl("rect"), {
        x: bodyW / 2 - armW,
        y: -h / 2 + backH,
        width: armW,
        height: seatH,
        fill: pal.arm,
        stroke: pal.stroke,
        rx: 2,
      })
    );
  }
  for (var i = 0; i < seatCount; i++) {
    g.appendChild(
      setAttrs(svgEl("rect"), {
        x: -bodyW / 2 + armW + cushionW * i + 1,
        y: -h / 2 + backH + 1,
        width: cushionW - 2,
        height: seatH - 2,
        fill: pal.cushion,
        stroke: pal.stroke,
        rx: 2,
      })
    );
  }
  if (hasLounge && loungeW > 0) {
    g.appendChild(
      setAttrs(svgEl("rect"), {
        x: bodyW / 2,
        y: -h / 2,
        width: loungeW,
        height: h,
        fill: pal.lounge,
        stroke: pal.stroke,
        rx: 3,
      })
    );
  }
}

function renderSectional(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h * 0.45, fill: "#dcdcdc", stroke: "#bbbbbb", rx: 4 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: w / 2 - w * 0.32, y: -h / 2, width: w * 0.32, height: h, fill: "#dcdcdc", stroke: "#bbbbbb", rx: 4 }));
}

function renderTable(g, w, h, chairs) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "#c9a87c", stroke: "#a08060", rx: 4 }));
  var chW = Math.min(w, h) * 0.22;
  var chH = Math.min(w, h) * 0.22;
  [
    { x: 0, y: -h / 2 - chH * 0.5 },
    { x: 0, y: h / 2 + chH * 0.5 },
    { x: -w / 2 - chW * 0.5, y: 0 },
    { x: w / 2 + chW * 0.5, y: 0 },
  ].slice(0, Math.min(chairs || 4, 4)).forEach(function (pos) {
    g.appendChild(setAttrs(svgEl("rect"), { x: pos.x - chW / 2, y: pos.y - chH / 2, width: chW, height: chH, fill: "#f5f5f5", stroke: "#cccccc", rx: 3 }));
  });
}

function renderChair(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h * 0.28, fill: "#d5d5d5", stroke: "#bbbbbb", rx: 3 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2 + h * 0.22, width: w, height: h * 0.55, fill: "#e8e8e8", stroke: "#bbbbbb", rx: 3 }));
}

function renderKitchenIsland(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "#ffffff", stroke: "#dddddd", rx: 2 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h * 0.25, fill: "#f0f0f0", stroke: "#cccccc", rx: 2 }));
}

function renderBathtub(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "#ffffff", stroke: "#cccccc", rx: 10 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2 + 3, y: -h / 2 + 3, width: w - 6, height: h - 6, fill: "#e8f4f8", rx: 7 }));
}

function renderToilet(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2 + w * 0.15, y: -h / 2, width: w * 0.7, height: h * 0.35, fill: "#ffffff", stroke: "#cccccc", rx: 3 }));
  g.appendChild(setAttrs(svgEl("ellipse"), { cx: 0, cy: h * 0.15, rx: w * 0.3, ry: h * 0.32, fill: "#ffffff", stroke: "#cccccc" }));
}

function renderSink(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "#ffffff", stroke: "#cccccc", rx: 2 }));
  g.appendChild(setAttrs(svgEl("ellipse"), { cx: 0, cy: 0, rx: w * 0.32, ry: h * 0.32, fill: "#f0f5f9", stroke: "#dddddd" }));
}

function renderDesk(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "#c9a87c", stroke: "#a08060", rx: 3 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -w * 0.18, y: h / 2 + 2, width: w * 0.36, height: h * 0.45, fill: "#333333", rx: 3 }));
}

function renderPlant(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2 + h * 0.35, width: w, height: h * 0.65, fill: "#c4956a", stroke: "#a07050", rx: 3 }));
  g.appendChild(setAttrs(svgEl("circle"), { cx: 0, cy: -h / 2 + h * 0.25, r: w * 0.45, fill: "#6b8e23", opacity: 0.9 }));
}

function renderRugItem(g, w, h) {
  g.appendChild(setAttrs(svgEl("rect"), { x: -w / 2, y: -h / 2, width: w, height: h, fill: "url(#carpet)", stroke: "#e0d8cc", rx: 6 }));
}

function renderLabels(svg, rooms, size, calibrationState) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var point = room.labelPoint || polygonCentroid(room.polygon);
    var g = setAttrs(svgEl("g"), {
      class: "plan-label",
      transform: "translate(" + point.x * size.width + " " + point.y * size.height + ")",
    });

    var name = setAttrs(svgEl("text"), {
      class: "plan-label-name",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-family": "Arial, Helvetica, sans-serif",
      "font-size": 13,
      "font-weight": 600,
      fill: "#2c2c2c",
    });
    name.textContent = room.name || room.id || "Room";
    g.appendChild(name);

    var measure = getRoomMeasurementDisplay(room, size.width, size.height, calibrationState || null);
    var dimForLabel = measure.dimLine;
    var areaForLabel = measure.areaLine;
    if (dimForLabel && dimForLabel.indexOf(" px") >= 0) dimForLabel = null;
    if (areaForLabel && areaForLabel.indexOf("px²") >= 0) areaForLabel = null;
    var line = 0;
    if (dimForLabel) {
      line++;
      g.appendChild(
        setAttrs(svgEl("text"), {
          class: "plan-label-dims",
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          dy: 1.35 * line + "em",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": 10,
          "font-weight": 500,
          fill: "#444444",
          textContent: dimForLabel,
        })
      );
    }
    if (areaForLabel && areaForLabel !== dimForLabel) {
      line++;
      g.appendChild(
        setAttrs(svgEl("text"), {
          class: "plan-label-area",
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          dy: 1.35 * line + "em",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": 9,
          "font-weight": 400,
          fill: "#666666",
          textContent: areaForLabel,
        })
      );
    }

    svg.appendChild(g);
  });
}

/** Dashed in-room boundary shown while moving furniture. */
function renderWalkableBoundary(svg, rooms, size, visible) {
  if (!visible) return;
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    svg.appendChild(
      setAttrs(svgEl("polygon"), {
        class: "walkable-boundary",
        points: pointsAttr(room.polygon, size.width, size.height),
        fill: "rgba(37, 99, 235, 0.05)",
        stroke: "#2563eb",
        "stroke-width": 2,
        "stroke-dasharray": "8 5",
        opacity: 0.6,
        "pointer-events": "none",
      })
    );
  });
}

function renderHitHighlights(svg, rooms, activeRoomId, size) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    svg.appendChild(
      setAttrs(svgEl("polygon"), {
        class: "hi",
        "data-room": room.id || room.name || "",
        points: pointsAttr(room.polygon, size.width, size.height),
        opacity: activeRoomId === room.id || activeRoomId === room.name ? 1 : 0,
      })
    );
  });
}

export function renderPlan(svg, data, activeRoomId, selectedFurnitureIds, size, options) {
  var opts = options || {};
  var primaryId = opts.primaryFurnitureId || null;
  svg.innerHTML = "";
  renderBackground(svg, size, opts.planImageSrc);
  createDefs(svg);
  renderTexturedFills(svg, data.rooms || [], activeRoomId, size);
  renderRugs(svg, data.rooms || [], size);
  renderWindows(svg, data.windows || [], size);
  renderDoorArcs(svg, data.doors || [], size);
  renderWalls(svg, data.walls || [], data.rooms || [], size);
  var hasSelection =
    selectedFurnitureIds instanceof Set
      ? selectedFurnitureIds.size > 0
      : Array.isArray(selectedFurnitureIds)
        ? selectedFurnitureIds.length > 0
        : !!selectedFurnitureIds;
  renderWalkableBoundary(
    svg,
    data.rooms || [],
    size,
    hasSelection && !opts.vertexEditMode && !opts.wallEditMode
  );
  renderDetailedFurniture(
    svg,
    data.furniture || [],
    data.furniture_catalog || [],
    selectedFurnitureIds,
    primaryId,
    size,
    opts.furnitureRenderCtx || null
  );
  renderLabels(svg, data.rooms || [], size, opts.calibrationState || null);
  renderSelectedRoomOutline(svg, data.rooms || [], opts.selectedRoomId || null, size);
  if (opts.roomMeasureBadge) {
    renderRoomMeasurementBadge(
      svg,
      opts.roomMeasureBadge.room,
      opts.roomMeasureBadge.areaLabel,
      opts.roomMeasureBadge.dimLabel,
      size
    );
  }
  renderCalibrationOverlays(svg, data.calibration || null, size, opts.scaleDraft || null);
  renderMeasureOverlay(svg, opts.measureResult || null, size, opts.measureDraft || null);
  if (opts.drawRoomPoints && opts.drawRoomPoints.length) {
    renderDrawRoomOverlay(
      svg,
      opts.drawRoomPoints,
      opts.drawRoomCursor || null,
      opts.drawRoomAreaLabel || "",
      size
    );
  }
  if (opts.vertexEditMode) {
    renderVertexHandles(svg, data.rooms || [], size, opts.selectedVertex || null);
  }
  if (opts.wallEditMode && opts.selectedWallId) {
    var selWall = (data.walls || []).find(function (w) {
      return (w.id || "") === opts.selectedWallId;
    });
    if (selWall) {
      renderSelectedWallHighlight(svg, selWall, size);
      renderWallVertexHandles(svg, selWall, size, opts.selectedWallVertex || null);
    }
  }
  if (opts.drawWallPoints && opts.drawWallPoints.length) {
    renderDrawRoomOverlay(
      svg,
      opts.drawWallPoints,
      opts.drawWallCursor || null,
      "",
      size,
      "plan-draw-wall-layer",
      "plan-draw-wall-line",
      "plan-draw-wall-dot"
    );
  }
  renderHitHighlights(svg, data.rooms || [], activeRoomId, size);
}
