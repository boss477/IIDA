// svgRenderer.js — Premium Polished Floor Plan Renderer
import { polygonBBox } from "../lib/geometry.js";
import { layoutRoomLabel } from "../lib/labelLayout.js";

const NS = "http://www.w3.org/2000/svg";

function createDefs(svg) {
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS(NS, "defs"); svg.appendChild(defs); }

  // Wood floor
  const wood = document.createElementNS(NS, "pattern");
  wood.setAttribute("id", "wood-floor");
  wood.setAttribute("patternUnits", "userSpaceOnUse");
  wood.setAttribute("width", "40"); wood.setAttribute("height", "14");
  const wb = document.createElementNS(NS, "rect");
  wb.setAttribute("width", "40"); wb.setAttribute("height", "14"); wb.setAttribute("fill", "#f3e8d8");
  wood.appendChild(wb);
  for (let i = 1; i < 5; i++) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", i * 10); line.setAttribute("y1", "0");
    line.setAttribute("x2", i * 10); line.setAttribute("y2", "14");
    line.setAttribute("stroke", "#e5d4c0"); line.setAttribute("stroke-width", "0.6");
    wood.appendChild(line);
  }
  defs.appendChild(wood);

  // Bathroom small tile
  const tile = document.createElementNS(NS, "pattern");
  tile.setAttribute("id", "tile-floor");
  tile.setAttribute("patternUnits", "userSpaceOnUse");
  tile.setAttribute("width", "12"); tile.setAttribute("height", "12");
  const tb = document.createElementNS(NS, "rect");
  tb.setAttribute("width", "12"); tb.setAttribute("height", "12"); tb.setAttribute("fill", "#f5f5f5");
  tile.appendChild(tb);
  const tg = document.createElementNS(NS, "path");
  tg.setAttribute("d", "M0 0 L0 12 M0 0 L12 0");
  tg.setAttribute("stroke", "#d8d8d8"); tg.setAttribute("stroke-width", "0.8");
  tile.appendChild(tg);
  defs.appendChild(tile);

  // Balcony grid tile
  const balconyTile = document.createElementNS(NS, "pattern");
  balconyTile.setAttribute("id", "balcony-floor");
  balconyTile.setAttribute("patternUnits", "userSpaceOnUse");
  balconyTile.setAttribute("width", "10"); balconyTile.setAttribute("height", "10");
  const bb = document.createElementNS(NS, "rect");
  bb.setAttribute("width", "10"); bb.setAttribute("height", "10"); bb.setAttribute("fill", "#fafafa");
  balconyTile.appendChild(bb);
  const bg = document.createElementNS(NS, "path");
  bg.setAttribute("d", "M0 0 L0 10 M0 0 L10 0");
  bg.setAttribute("stroke", "#e0e0e0"); bg.setAttribute("stroke-width", "0.8");
  balconyTile.appendChild(bg);
  defs.appendChild(balconyTile);

  // Kitchen warm tile
  const kit = document.createElementNS(NS, "pattern");
  kit.setAttribute("id", "kitchen-floor");
  kit.setAttribute("patternUnits", "userSpaceOnUse");
  kit.setAttribute("width", "30"); kit.setAttribute("height", "30");
  const kb = document.createElementNS(NS, "rect");
  kb.setAttribute("width", "30"); kb.setAttribute("height", "30"); kb.setAttribute("fill", "#fff8e1");
  kit.appendChild(kb);
  const kg = document.createElementNS(NS, "path");
  kg.setAttribute("d", "M0 0 L0 30 M0 0 L30 0");
  kg.setAttribute("stroke", "#f0e0c0"); kg.setAttribute("stroke-width", "0.8");
  kit.appendChild(kg);
  defs.appendChild(kit);

  // Carpet for rugs
  const carpet = document.createElementNS(NS, "pattern");
  carpet.setAttribute("id", "carpet");
  carpet.setAttribute("patternUnits", "userSpaceOnUse");
  carpet.setAttribute("width", "10"); carpet.setAttribute("height", "10");
  const cb = document.createElementNS(NS, "rect");
  cb.setAttribute("width", "10"); cb.setAttribute("height", "10"); cb.setAttribute("fill", "#f0e8dc");
  carpet.appendChild(cb);
  const cw1 = document.createElementNS(NS, "line");
  cw1.setAttribute("x1", "5"); cw1.setAttribute("y1", "0");
  cw1.setAttribute("x2", "5"); cw1.setAttribute("y2", "10");
  cw1.setAttribute("stroke", "#e5ddd0"); cw1.setAttribute("stroke-width", "0.5");
  carpet.appendChild(cw1);
  const cw2 = document.createElementNS(NS, "line");
  cw2.setAttribute("x1", "0"); cw2.setAttribute("y1", "5");
  cw2.setAttribute("x2", "10"); cw2.setAttribute("y2", "5");
  cw2.setAttribute("stroke", "#e5ddd0"); cw2.setAttribute("stroke-width", "0.5");
  carpet.appendChild(cw2);
  defs.appendChild(carpet);

  // Wall shadow
  const wallFilter = document.createElementNS(NS, "filter");
  wallFilter.setAttribute("id", "soft-wall-shadow");
  wallFilter.setAttribute("x", "-10%"); wallFilter.setAttribute("y", "-10%");
  wallFilter.setAttribute("width", "120%"); wallFilter.setAttribute("height", "120%");
  const fe1 = document.createElementNS(NS, "feDropShadow");
  fe1.setAttribute("dx", "1.4"); fe1.setAttribute("dy", "2");
  fe1.setAttribute("stdDeviation", "1.8");
  fe1.setAttribute("flood-color", "#000000");
  fe1.setAttribute("flood-opacity", "0.18");
  wallFilter.appendChild(fe1);
  defs.appendChild(wallFilter);

  // Soft furniture shadow
  const furnFilter = document.createElementNS(NS, "filter");
  furnFilter.setAttribute("id", "soft-furniture-shadow");
  furnFilter.setAttribute("x", "-15%"); furnFilter.setAttribute("y", "-15%");
  furnFilter.setAttribute("width", "130%"); furnFilter.setAttribute("height", "130%");
  const fe2 = document.createElementNS(NS, "feDropShadow");
  fe2.setAttribute("dx", "1.5"); fe2.setAttribute("dy", "2.5");
  fe2.setAttribute("stdDeviation", "2");
  fe2.setAttribute("flood-color", "#000000");
  fe2.setAttribute("flood-opacity", "0.12");
  furnFilter.appendChild(fe2);
  defs.appendChild(furnFilter);

  // Label background filter
  const labelFilter = document.createElementNS(NS, "filter");
  labelFilter.setAttribute("id", "label-glow");
  const fe3 = document.createElementNS(NS, "feGaussianBlur");
  fe3.setAttribute("stdDeviation", "2");
  fe3.setAttribute("result", "blur");
  labelFilter.appendChild(fe3);
  const fe4 = document.createElementNS(NS, "feFlood");
  fe4.setAttribute("flood-color", "#ffffff");
  fe4.setAttribute("flood-opacity", "0.85");
  fe4.setAttribute("result", "flood");
  labelFilter.appendChild(fe4);
  const fe5 = document.createElementNS(NS, "feComposite");
  fe5.setAttribute("in", "flood"); fe5.setAttribute("in2", "blur");
  fe5.setAttribute("operator", "in"); fe5.setAttribute("result", "mask");
  labelFilter.appendChild(fe5);
  const fe6 = document.createElementNS(NS, "feMerge");
  const m1 = document.createElementNS(NS, "feMergeNode"); m1.setAttribute("in", "mask");
  const m2 = document.createElementNS(NS, "feMergeNode"); m2.setAttribute("in", "SourceGraphic");
  fe6.appendChild(m1); fe6.appendChild(m2);
  labelFilter.appendChild(fe6);
  defs.appendChild(labelFilter);

  return defs;
}

function patternForRoom(room) {
  const name = String(room.type || room.name || "").toLowerCase();
  const flooring = String(room.flooring || "").toLowerCase();
  if (flooring.includes("wood")) return "url(#wood-floor)";
  if (flooring.includes("tile")) return "url(#tile-floor)";
  if (flooring.includes("balcony") || flooring.includes("grid")) return "url(#balcony-floor)";
  if (flooring.includes("kitchen") || flooring.includes("warm")) return "url(#kitchen-floor)";
  if (name.includes("kitchen")) return "url(#kitchen-floor)";
  if (name.includes("bath")) return "url(#tile-floor)";
  if (name.includes("bed")) return "url(#wood-floor)";
  if (name.includes("living")) return "url(#wood-floor)";
  if (name.includes("dining")) return "url(#wood-floor)";
  if (name.includes("balcon") || name.includes("patio")) return "url(#balcony-floor)";
  if (name.includes("passage") || name.includes("hall") || name.includes("utility")) return "url(#wood-floor)";
  if (name.includes("closet") || name.includes("laundry")) return "url(#kitchen-floor)";
  return "url(#wood-floor)";
}

function baseColorForRoom(room) {
  const name = String(room.type || room.name || "").toLowerCase();
  if (name.includes("kitchen")) return "#ffe082";
  if (name.includes("bath")) return "#90caf9";
  if (name.includes("bed")) return "#bcaaa4";
  if (name.includes("living")) return "#a1887f";
  if (name.includes("dining")) return "#b39ddb";
  if (name.includes("balcon") || name.includes("patio")) return "#cfd8dc";
  if (name.includes("passage") || name.includes("hall") || name.includes("utility")) return "#d7ccc8";
  if (name.includes("closet") || name.includes("laundry")) return "#fff9c4";
  return "#e0d4c8";
}

function pointsAttr(points, imageWidth, imageHeight) {
  return (points || [])
    .map(function (p) { return (p.x * imageWidth) + "," + (p.y * imageHeight); })
    .join(" ");
}

function polygonCentroid(points) {
  if (!points || !points.length) return { x: 0.5, y: 0.5 };
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]; const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross; cx += (a.x + b.x) * cross; cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 0.000001) {
    let sx = 0, sy = 0;
    points.forEach(function (p) { sx += p.x; sy += p.y; });
    return { x: sx / points.length, y: sy / points.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function wallSourceFromRooms(rooms) {
  return (rooms || [])
    .filter(function (r) { return r.polygon && r.polygon.length >= 3; })
    .map(function (r) {
      return {
        id: "wall-from-" + (r.id || r.name || Math.random()),
        points: r.polygon.concat([r.polygon[0]]),
        thickness: 0.006,
      };
    });
}

function renderBackground(svg, size) {
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("x", "0"); rect.setAttribute("y", "0");
  rect.setAttribute("width", String(size.width));
  rect.setAttribute("height", String(size.height));
  rect.setAttribute("fill", "transparent");
  svg.appendChild(rect);
}

function renderTexturedFills(svg, rooms, activeRoomId, size) {
  let renderedRoomFills = 0;
  let renderedRoomHighlights = 0;
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    const pts = pointsAttr(room.polygon, size.width, size.height);
    const isActive = activeRoomId && (room.id === activeRoomId || room.name === activeRoomId);
    const roomId = room.id || room.name || "";

    const base = document.createElementNS(NS, "polygon");
    base.setAttribute("class", "plan-room-fill");
    base.setAttribute("data-room-fill", roomId);
    base.setAttribute("data-active", isActive ? "1" : "0");
    base.setAttribute("points", pts);
    base.setAttribute("fill", baseColorForRoom(room));
    base.setAttribute("stroke", "none");
    if (isActive) { base.setAttribute("fill", "#fffde7"); base.setAttribute("fill-opacity", "0.85"); }
    svg.appendChild(base);
    renderedRoomFills += 1;

    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", patternForRoom(room));
    poly.setAttribute("stroke", "none");
    if (isActive) { poly.setAttribute("fill-opacity", "0.6"); }
    svg.appendChild(poly);

    const hover = document.createElementNS(NS, "polygon");
    hover.setAttribute("class", "hi");
    hover.setAttribute("data-room", roomId);
    hover.setAttribute("points", pts);
    hover.setAttribute("opacity", isActive ? "1" : "0");
    svg.appendChild(hover);
    renderedRoomHighlights += 1;

    if (isActive) {
      const hl = document.createElementNS(NS, "polygon");
      hl.setAttribute("points", pts);
      hl.setAttribute("fill", "none");
      hl.setAttribute("stroke", "#ffc107");
      hl.setAttribute("stroke-width", "2.5");
      hl.setAttribute("opacity", "0.9");
      svg.appendChild(hl);
    }
  });
  // #region agent log
  fetch("http://127.0.0.1:7805/ingest/366268e5-c3c0-405e-8724-98cf4eb84d21", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1a95b9" },
    body: JSON.stringify({
      sessionId: "1a95b9",
      runId: "room-hover-contract",
      hypothesisId: "A",
      location: "src/viewer/svgRenderer.js:renderTexturedFills",
      message: "room hover hooks rendered",
      data: {
        roomCount: rooms ? rooms.length : 0,
        renderedRoomFills,
        renderedRoomHighlights,
        activeRoomId: activeRoomId || null,
      },
      timestamp: Date.now(),
    }),
  }).catch(function () {});
  // #endregion
}

function renderRugs(svg, rooms, size) {
  (rooms || []).forEach(function (room) {
    const name = String(room.type || room.name || "").toLowerCase();
    if (!name.includes("living") && !name.includes("bed")) return;
    if (!room.polygon || room.polygon.length < 3) return;

    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    room.polygon.forEach(function (p) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });

    const pad = 0.05;
    const rw = (maxX - minX - pad * 2) * size.width;
    const rh = (maxY - minY - pad * 2) * size.height;
    if (rw <= 0 || rh <= 0) return;
    const rx = (minX + pad) * size.width;
    const ry = (minY + pad) * size.height;

    const rug = document.createElementNS(NS, "rect");
    rug.setAttribute("x", String(rx)); rug.setAttribute("y", String(ry));
    rug.setAttribute("width", String(rw)); rug.setAttribute("height", String(rh));
    rug.setAttribute("fill", "url(#carpet)");
    rug.setAttribute("stroke", "#e0d8cc");
    rug.setAttribute("stroke-width", "0.8");
    rug.setAttribute("rx", "4");
    svg.appendChild(rug);
  });
}

function renderWindows(svg, windows, size) {
  (windows || []).forEach(function (win) {
    if (!win.position || win.width == null) return;
    const wx = win.position.x * size.width;
    const wy = win.position.y * size.height;
    const ww = Math.max(14, win.width * size.width);
    const wh = Math.max(10, (win.height || 0.014) * Math.min(size.width, size.height));

    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("class", "plan-window");
    rect.setAttribute("x", String(wx - ww / 2));
    rect.setAttribute("y", String(wy - wh / 2));
    rect.setAttribute("width", String(ww));
    rect.setAttribute("height", String(wh));
    rect.setAttribute("fill", "#4fc3f7");
    rect.setAttribute("stroke", "#0d47a1");
    rect.setAttribute("stroke-width", "2.5");
    rect.setAttribute("opacity", "0.95");
    svg.appendChild(rect);

    const cols = Math.max(2, Math.floor(ww / 18));
    const rows = Math.max(2, Math.floor(wh / 18));
    const colW = ww / cols;
    const rowH = wh / rows;

    for (let i = 1; i < cols; i++) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "plan-window");
      line.setAttribute("x1", String(wx - ww / 2 + i * colW));
      line.setAttribute("y1", String(wy - wh / 2));
      line.setAttribute("x2", String(wx - ww / 2 + i * colW));
      line.setAttribute("y2", String(wy + wh / 2));
      line.setAttribute("stroke", "#0d47a1");
      line.setAttribute("stroke-width", "1.5");
      svg.appendChild(line);
    }
    for (let j = 1; j < rows; j++) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "plan-window");
      line.setAttribute("x1", String(wx - ww / 2));
      line.setAttribute("y1", String(wy - wh / 2 + j * rowH));
      line.setAttribute("x2", String(wx + ww / 2));
      line.setAttribute("y2", String(wy - wh / 2 + j * rowH));
      line.setAttribute("stroke", "#0d47a1");
      line.setAttribute("stroke-width", "1.5");
      svg.appendChild(line);
    }
  });
}

function renderDoorArcs(svg, doors, size) {
  (doors || []).forEach(function (door) {
    if (!door.position) return;
    const x = door.position.x * size.width;
    const y = door.position.y * size.height;
    const radius = (door.width || 0.035) * Math.min(size.width, size.height);
    const swing = door.swing || "right";

    let d = "";
    if (swing === "left" || swing === 1) {
      d = `M ${x} ${y} L ${x - radius} ${y} A ${radius} ${radius} 0 0 1 ${x} ${y + radius}`;
    } else if (swing === "up" || swing === 2) {
      d = `M ${x} ${y} L ${x} ${y - radius} A ${radius} ${radius} 0 0 1 ${x - radius} ${y}`;
    } else if (swing === "down" || swing === 3) {
      d = `M ${x} ${y} L ${x} ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`;
    } else {
      d = `M ${x} ${y} L ${x + radius} ${y} A ${radius} ${radius} 0 0 1 ${x} ${y + radius}`;
    }

    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#a0a0a0");
    path.setAttribute("stroke-width", "1");
    path.setAttribute("stroke-dasharray", "2.5,1.5");
    svg.appendChild(path);

    let angle = Math.PI / 4;
    if (swing === "left" || swing === 1) angle = Math.PI - Math.PI / 4;
    else if (swing === "up" || swing === 2) angle = -Math.PI / 4;
    else if (swing === "down" || swing === 3) angle = Math.PI / 4 + Math.PI / 2;

    const px = x + Math.cos(angle) * radius * 0.92;
    const py = y + Math.sin(angle) * radius * 0.92;
    const panel = document.createElementNS(NS, "line");
    panel.setAttribute("x1", String(x)); panel.setAttribute("y1", String(y));
    panel.setAttribute("x2", String(px)); panel.setAttribute("y2", String(py));
    panel.setAttribute("stroke", "#888888");
    panel.setAttribute("stroke-width", "1.2");
    svg.appendChild(panel);
  });
}

function wallSegmentToPolygon(ax, ay, bx, by, halfW) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len * halfW;
  const ny = dx / len * halfW;
  return [
    (ax + nx) + "," + (ay + ny),
    (bx + nx) + "," + (by + ny),
    (bx - nx) + "," + (by - ny),
    (ax - nx) + "," + (ay - ny),
  ].join(" ");
}

function renderWalls(svg, walls, rooms, size) {
  const hasRealWalls = walls && walls.length > 0;
  const source = hasRealWalls ? walls : wallSourceFromRooms(rooms);
  const unit = Math.min(size.width, size.height);
  const isFallback = !hasRealWalls;

  source.forEach(function (wall, idx) {
    if (!wall.points || wall.points.length < 2) return;
    const role = wall.role || "partition";
    const minHalfPx = role === "exterior" ? 5 : 3;
    const halfW = Math.max(minHalfPx, (wall.thickness || 0.009) * unit / 2);
    const pts = wall.points;

    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x * size.width;
      const ay = pts[i].y * size.height;
      const bx = pts[i + 1].x * size.width;
      const by = pts[i + 1].y * size.height;
      const seg = document.createElementNS(NS, "polygon");
      seg.setAttribute("class", "plan-wall");
      seg.setAttribute("data-wall", (wall.id || "wall-" + idx) + "-" + i);
      seg.setAttribute("points", wallSegmentToPolygon(ax, ay, bx, by, halfW));
      seg.setAttribute("fill", "#111111");
      seg.setAttribute("stroke", "none");
      if (isFallback) seg.setAttribute("fill-opacity", "0.35");
      svg.appendChild(seg);
    }

    if (pts.length >= 3) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.abs(first.x - last.x) < 0.0001 && Math.abs(first.y - last.y) < 0.0001) return;
    }
  });
  // #region agent log
  fetch("http://127.0.0.1:7805/ingest/366268e5-c3c0-405e-8724-98cf4eb84d21", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1a95b9" },
    body: JSON.stringify({
      sessionId: "1a95b9",
      runId: "wall-fills",
      hypothesisId: "A",
      location: "src/viewer/svgRenderer.js:renderWalls",
      message: "wall render metrics",
      data: {
        explicitWallCount: walls ? walls.length : 0,
        isFallback: isFallback,
        renderedSourceCount: source.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(function () {});
  // #endregion
}

function renderDetailedFurniture(svg, furniture, catalog, selectedId, size) {
  (furniture || []).forEach(function (item) {
    const cx = (item.x || 0) * size.width;
    const cy = (item.y || 0) * size.height;
    const w = (item.width || 0.05) * size.width;
    const h = (item.height || 0.05) * size.height;
    const rotation = item.rotationDeg || item.rotation || 0;
    const type = String(item.type || item.catalogId || "").toLowerCase();
    const imgUrl = item.imageUrl || item.svgUrl || null;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("data-furniture-id", item.id || "");
    g.setAttribute("class", "furniture-g" + (selectedId && item.id === selectedId ? " furniture-selected" : ""));
    g.setAttribute("transform", "translate(" + cx + " " + cy + ") rotate(" + rotation + ")");

    if (imgUrl) {
      const img = document.createElementNS(NS, "image");
      img.setAttribute("href", imgUrl);
      img.setAttribute("x", -w / 2); img.setAttribute("y", -h / 2);
      img.setAttribute("width", w); img.setAttribute("height", h);
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      g.appendChild(img);
    } else {
      if (type.includes("bed")) renderBed(g, w, h);
      else if (type.includes("sectional")) renderSectional(g, w, h);
      else if (type.includes("sofa")) renderSofa(g, w, h);
      else if (type.includes("dining") || type.includes("table")) renderTable(g, w, h, item.chairs || 4);
      else if (type.includes("chair")) renderChair(g, w, h);
      else if (type.includes("kitchen") || type.includes("island") || type.includes("counter")) renderKitchenIsland(g, w, h);
      else if (type.includes("tub") || type.includes("bathtub")) renderBathtub(g, w, h);
      else if (type.includes("toilet") || type.includes("wc")) renderToilet(g, w, h);
      else if (type.includes("sink") || type.includes("basin")) renderSink(g, w, h);
      else if (type.includes("desk") || type.includes("office")) renderDesk(g, w, h);
      else if (type.includes("plant") || type.includes("tree")) renderPlant(g, w, h);
      else if (type.includes("rug")) renderRugItem(g, w, h);
      else if (type.includes("wardrobe") || type.includes("closet")) renderWardrobe(g, w, h);
      else if (type.includes("tv") || type.includes("television")) renderTV(g, w, h);
      else if (type.includes("stove") || type.includes("oven")) renderStove(g, w, h);
      else if (type.includes("fridge") || type.includes("refrigerator")) renderFridge(g, w, h);
      else {
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", -w / 2); rect.setAttribute("y", -h / 2);
        rect.setAttribute("width", w); rect.setAttribute("height", h);
        rect.setAttribute("fill", "#dddddd"); rect.setAttribute("stroke", "#bbbbbb");
        rect.setAttribute("rx", "2");
        g.appendChild(rect);
      }
    }

    if (selectedId && item.id === selectedId) {
      const ring = document.createElementNS(NS, "rect");
      ring.setAttribute("class", "furniture-select-ring");
      ring.setAttribute("x", String(-w / 2 - 5));
      ring.setAttribute("y", String(-h / 2 - 5));
      ring.setAttribute("width", String(w + 10));
      ring.setAttribute("height", String(h + 10));
      ring.setAttribute("rx", "6");
      ring.setAttribute("fill", "rgba(37,99,235,0.08)");
      ring.setAttribute("stroke", "#2563eb");
      ring.setAttribute("stroke-width", "2");
      g.appendChild(ring);
    }

    g.setAttribute("filter", "url(#soft-furniture-shadow)");
    svg.appendChild(g);
  });
}

// --- Premium Furniture Primitives ---

function renderBed(g, w, h) {
  const hb = document.createElementNS(NS, "rect");
  hb.setAttribute("x", -w / 2); hb.setAttribute("y", -h / 2);
  hb.setAttribute("width", w); hb.setAttribute("height", h * 0.15);
  hb.setAttribute("fill", "#d4c4a8"); hb.setAttribute("rx", "3");
  g.appendChild(hb);

  const mat = document.createElementNS(NS, "rect");
  mat.setAttribute("x", -w / 2 + 2); mat.setAttribute("y", -h / 2 + h * 0.14);
  mat.setAttribute("width", w - 4); mat.setAttribute("height", h * 0.72);
  mat.setAttribute("fill", "#ffffff"); mat.setAttribute("stroke", "#f0f0f0");
  mat.setAttribute("rx", "2");
  g.appendChild(mat);

  const pw = w * 0.30, ph = h * 0.12;
  const p1 = document.createElementNS(NS, "rect");
  p1.setAttribute("x", -w / 2 + 4); p1.setAttribute("y", -h / 2 + h * 0.17);
  p1.setAttribute("width", pw); p1.setAttribute("height", ph);
  p1.setAttribute("fill", "#fafafa"); p1.setAttribute("stroke", "#eeeeee"); p1.setAttribute("rx", "3");
  g.appendChild(p1);
  const p2 = document.createElementNS(NS, "rect");
  p2.setAttribute("x", w / 2 - 4 - pw); p2.setAttribute("y", -h / 2 + h * 0.17);
  p2.setAttribute("width", pw); p2.setAttribute("height", ph);
  p2.setAttribute("fill", "#fafafa"); p2.setAttribute("stroke", "#eeeeee"); p2.setAttribute("rx", "3");
  g.appendChild(p2);

  const blanket = document.createElementNS(NS, "rect");
  blanket.setAttribute("x", -w / 2 + 2); blanket.setAttribute("y", h / 2 - h * 0.28);
  blanket.setAttribute("width", w - 4); blanket.setAttribute("height", h * 0.26);
  blanket.setAttribute("fill", "#c0d8e8"); blanket.setAttribute("rx", "2");
  g.appendChild(blanket);
}

function renderSectional(g, w, h) {
  const main = document.createElementNS(NS, "rect");
  main.setAttribute("x", -w / 2); main.setAttribute("y", -h / 2);
  main.setAttribute("width", w * 0.70); main.setAttribute("height", h);
  main.setAttribute("fill", "#d8d8d8"); main.setAttribute("rx", "3");
  g.appendChild(main);
  const side = document.createElementNS(NS, "rect");
  side.setAttribute("x", w / 2 - w * 0.30); side.setAttribute("y", -h / 2);
  side.setAttribute("width", w * 0.30); side.setAttribute("height", h * 0.55);
  side.setAttribute("fill", "#d0d0d0"); side.setAttribute("rx", "3");
  g.appendChild(side);

  const c1 = document.createElementNS(NS, "rect");
  c1.setAttribute("x", -w / 2 + 3); c1.setAttribute("y", -h / 2 + 2);
  c1.setAttribute("width", w * 0.64); c1.setAttribute("height", h * 0.22);
  c1.setAttribute("fill", "#e0e0e0"); c1.setAttribute("rx", "2");
  g.appendChild(c1);
  const c2 = document.createElementNS(NS, "rect");
  c2.setAttribute("x", w / 2 - w * 0.28); c2.setAttribute("y", -h / 2 + 2);
  c2.setAttribute("width", w * 0.25); c2.setAttribute("height", h * 0.48);
  c2.setAttribute("fill", "#d8d8d8"); c2.setAttribute("rx", "2");
  g.appendChild(c2);
}

function renderSofa(g, w, h) {
  const back = document.createElementNS(NS, "rect");
  back.setAttribute("x", -w / 2); back.setAttribute("y", -h / 2);
  back.setAttribute("width", w); back.setAttribute("height", h * 0.30);
  back.setAttribute("fill", "#d0d0d0"); back.setAttribute("rx", "3");
  g.appendChild(back);
  const body = document.createElementNS(NS, "rect");
  body.setAttribute("x", -w / 2); body.setAttribute("y", -h / 2 + h * 0.22);
  body.setAttribute("width", w); body.setAttribute("height", h * 0.78);
  body.setAttribute("fill", "#e0e0e0"); body.setAttribute("rx", "3");
  g.appendChild(body);
  const armW = w * 0.08;
  const a1 = document.createElementNS(NS, "rect");
  a1.setAttribute("x", -w / 2); a1.setAttribute("y", -h / 2 + h * 0.12);
  a1.setAttribute("width", armW); a1.setAttribute("height", h * 0.76);
  a1.setAttribute("fill", "#c8c8c8"); a1.setAttribute("rx", "2");
  g.appendChild(a1);
  const a2 = document.createElementNS(NS, "rect");
  a2.setAttribute("x", w / 2 - armW); a2.setAttribute("y", -h / 2 + h * 0.12);
  a2.setAttribute("width", armW); a2.setAttribute("height", h * 0.76);
  a2.setAttribute("fill", "#c8c8c8"); a2.setAttribute("rx", "2");
  g.appendChild(a2);
}

function renderTable(g, w, h, chairs) {
  const top = document.createElementNS(NS, "rect");
  top.setAttribute("x", -w / 2); top.setAttribute("y", -h / 2);
  top.setAttribute("width", w); top.setAttribute("height", h);
  top.setAttribute("fill", "#c4a882"); top.setAttribute("stroke", "#b09870");
  top.setAttribute("rx", "3");
  g.appendChild(top);

  const shine = document.createElementNS(NS, "rect");
  shine.setAttribute("x", -w / 2 + 2); shine.setAttribute("y", -h / 2 + 2);
  shine.setAttribute("width", w - 4); shine.setAttribute("height", h / 3);
  shine.setAttribute("fill", "#ffffff"); shine.setAttribute("opacity", "0.12"); shine.setAttribute("rx", "2");
  g.appendChild(shine);

  const chW = Math.min(w, h) * 0.22, chH = Math.min(w, h) * 0.20;
  const positions = [
    { x: 0, y: -h / 2 - chH * 0.6 },
    { x: 0, y: h / 2 + chH * 0.6 },
    { x: -w / 2 - chW * 0.6, y: 0 },
    { x: w / 2 + chW * 0.6, y: 0 }
  ];
  (positions.slice(0, Math.min(chairs || 4, 6))).forEach(function (pos) {
    const chair = document.createElementNS(NS, "g");
    const seat = document.createElementNS(NS, "rect");
    seat.setAttribute("x", pos.x - chW / 2); seat.setAttribute("y", pos.y - chH / 2);
    seat.setAttribute("width", chW); seat.setAttribute("height", chH);
    seat.setAttribute("fill", "#f5f5f5"); seat.setAttribute("stroke", "#d0d0d0"); seat.setAttribute("rx", "2");
    chair.appendChild(seat);
    const cb = document.createElementNS(NS, "rect");
    cb.setAttribute("x", pos.x - chW / 2); cb.setAttribute("y", pos.y - chH / 2);
    cb.setAttribute("width", chW); cb.setAttribute("height", chH * 0.30);
    cb.setAttribute("fill", "#e8e8e8"); cb.setAttribute("rx", "1");
    chair.appendChild(cb);
    g.appendChild(chair);
  });
}

function renderChair(g, w, h) {
  const back = document.createElementNS(NS, "rect");
  back.setAttribute("x", -w / 2); back.setAttribute("y", -h / 2);
  back.setAttribute("width", w); back.setAttribute("height", h * 0.28);
  back.setAttribute("fill", "#d0d0d0"); back.setAttribute("rx", "2");
  g.appendChild(back);
  const seat = document.createElementNS(NS, "rect");
  seat.setAttribute("x", -w / 2); seat.setAttribute("y", -h / 2 + h * 0.20);
  seat.setAttribute("width", w); seat.setAttribute("height", h * 0.58);
  seat.setAttribute("fill", "#f0f0f0"); seat.setAttribute("stroke", "#d8d8d8"); seat.setAttribute("rx", "2");
  g.appendChild(seat);
}

function renderKitchenIsland(g, w, h) {
  const island = document.createElementNS(NS, "rect");
  island.setAttribute("x", -w / 2); island.setAttribute("y", -h / 2);
  island.setAttribute("width", w); island.setAttribute("height", h);
  island.setAttribute("fill", "#f5f0e8"); island.setAttribute("stroke", "#e0d8c8");
  island.setAttribute("rx", "2");
  g.appendChild(island);

  const counter = document.createElementNS(NS, "rect");
  counter.setAttribute("x", -w / 2); counter.setAttribute("y", -h / 2);
  counter.setAttribute("width", w); counter.setAttribute("height", h * 0.20);
  counter.setAttribute("fill", "#e8ddd0"); counter.setAttribute("stroke", "#d8cdb8");
  g.appendChild(counter);

  for (let i = -1; i <= 1; i++) {
    const stool = document.createElementNS(NS, "rect");
    stool.setAttribute("x", (i * w * 0.28) - 4);
    stool.setAttribute("y", h / 2 + 3);
    stool.setAttribute("width", "8"); stool.setAttribute("height", "6");
    stool.setAttribute("fill", "#555555"); stool.setAttribute("rx", "1");
    g.appendChild(stool);
  }
}

function renderBathtub(g, w, h) {
  const tub = document.createElementNS(NS, "rect");
  tub.setAttribute("x", -w / 2); tub.setAttribute("y", -h / 2);
  tub.setAttribute("width", w); tub.setAttribute("height", h);
  tub.setAttribute("fill", "#ffffff"); tub.setAttribute("stroke", "#d0d0d0");
  tub.setAttribute("rx", "8");
  g.appendChild(tub);
  const water = document.createElementNS(NS, "rect");
  water.setAttribute("x", -w / 2 + 4); water.setAttribute("y", -h / 2 + 4);
  water.setAttribute("width", w - 8); water.setAttribute("height", h - 8);
  water.setAttribute("fill", "#e8f4f8"); water.setAttribute("rx", "5");
  g.appendChild(water);
}

function renderToilet(g, w, h) {
  const tank = document.createElementNS(NS, "rect");
  tank.setAttribute("x", -w / 2 + w * 0.10); tank.setAttribute("y", -h / 2);
  tank.setAttribute("width", w * 0.80); tank.setAttribute("height", h * 0.30);
  tank.setAttribute("fill", "#ffffff"); tank.setAttribute("stroke", "#d0d0d0");
  tank.setAttribute("rx", "2");
  g.appendChild(tank);
  const bowl = document.createElementNS(NS, "ellipse");
  bowl.setAttribute("cx", "0"); bowl.setAttribute("cy", h * 0.10);
  bowl.setAttribute("rx", w * 0.28); bowl.setAttribute("ry", h * 0.28);
  bowl.setAttribute("fill", "#ffffff"); bowl.setAttribute("stroke", "#d0d0d0");
  g.appendChild(bowl);
}

function renderSink(g, w, h) {
  const base = document.createElementNS(NS, "rect");
  base.setAttribute("x", -w / 2); base.setAttribute("y", -h / 2);
  base.setAttribute("width", w); base.setAttribute("height", h);
  base.setAttribute("fill", "#ffffff"); base.setAttribute("stroke", "#d8d8d8");
  g.appendChild(base);
  const basin = document.createElementNS(NS, "ellipse");
  basin.setAttribute("cx", "0"); basin.setAttribute("cy", "0");
  basin.setAttribute("rx", w * 0.32); basin.setAttribute("ry", h * 0.32);
  basin.setAttribute("fill", "#f0f5f9"); basin.setAttribute("stroke", "#d8e0e8");
  g.appendChild(basin);
}

function renderDesk(g, w, h) {
  const top = document.createElementNS(NS, "rect");
  top.setAttribute("x", -w / 2); top.setAttribute("y", -h / 2);
  top.setAttribute("width", w); top.setAttribute("height", h);
  top.setAttribute("fill", "#c4a882"); top.setAttribute("stroke", "#b09870");
  top.setAttribute("rx", "2");
  g.appendChild(top);
  const chair = document.createElementNS(NS, "rect");
  chair.setAttribute("x", -w * 0.15); chair.setAttribute("y", h / 2 + 2);
  chair.setAttribute("width", w * 0.30); chair.setAttribute("height", h * 0.40);
  chair.setAttribute("fill", "#444444"); chair.setAttribute("rx", "2");
  g.appendChild(chair);
  const monitor = document.createElementNS(NS, "rect");
  monitor.setAttribute("x", -w * 0.10); monitor.setAttribute("y", -h / 2 - h * 0.12);
  monitor.setAttribute("width", w * 0.20); monitor.setAttribute("height", h * 0.14);
  monitor.setAttribute("fill", "#2a2a2a"); monitor.setAttribute("rx", "1");
  g.appendChild(monitor);
}

function renderPlant(g, w, h) {
  const pot = document.createElementNS(NS, "rect");
  pot.setAttribute("x", -w / 2); pot.setAttribute("y", -h / 2 + h * 0.35);
  pot.setAttribute("width", w); pot.setAttribute("height", h * 0.65);
  pot.setAttribute("fill", "#c9a07c"); pot.setAttribute("rx", "2");
  g.appendChild(pot);
  const leaf1 = document.createElementNS(NS, "circle");
  leaf1.setAttribute("cx", "0"); leaf1.setAttribute("cy", -h / 2 + h * 0.18);
  leaf1.setAttribute("r", w * 0.40);
  leaf1.setAttribute("fill", "#6b8e23"); leaf1.setAttribute("opacity", "0.85");
  g.appendChild(leaf1);
  const leaf2 = document.createElementNS(NS, "circle");
  leaf2.setAttribute("cx", -w * 0.12); leaf2.setAttribute("cy", -h / 2 + h * 0.25);
  leaf2.setAttribute("r", w * 0.25);
  leaf2.setAttribute("fill", "#7a9e33"); leaf2.setAttribute("opacity", "0.7");
  g.appendChild(leaf2);
  const leaf3 = document.createElementNS(NS, "circle");
  leaf3.setAttribute("cx", w * 0.12); leaf3.setAttribute("cy", -h / 2 + h * 0.25);
  leaf3.setAttribute("r", w * 0.25);
  leaf3.setAttribute("fill", "#5a7e13"); leaf3.setAttribute("opacity", "0.7");
  g.appendChild(leaf3);
}

function renderRugItem(g, w, h) {
  const rug = document.createElementNS(NS, "rect");
  rug.setAttribute("x", -w / 2); rug.setAttribute("y", -h / 2);
  rug.setAttribute("width", w); rug.setAttribute("height", h);
  rug.setAttribute("fill", "url(#carpet)"); rug.setAttribute("stroke", "#d8d0c4");
  rug.setAttribute("rx", "4");
  g.appendChild(rug);
}

function renderWardrobe(g, w, h) {
  const body = document.createElementNS(NS, "rect");
  body.setAttribute("x", -w / 2); body.setAttribute("y", -h / 2);
  body.setAttribute("width", w); body.setAttribute("height", h);
  body.setAttribute("fill", "#f5f5f5"); body.setAttribute("stroke", "#e0e0e0");
  body.setAttribute("rx", "1");
  g.appendChild(body);
  const doorLine = document.createElementNS(NS, "line");
  doorLine.setAttribute("x1", "0"); doorLine.setAttribute("y1", -h / 2);
  doorLine.setAttribute("x2", "0"); doorLine.setAttribute("y2", h / 2);
  doorLine.setAttribute("stroke", "#e0e0e0"); doorLine.setAttribute("stroke-width", "1");
  g.appendChild(doorLine);
}

function renderTV(g, w, h) {
  const stand = document.createElementNS(NS, "rect");
  stand.setAttribute("x", -w / 2); stand.setAttribute("y", -h / 2 + h * 0.25);
  stand.setAttribute("width", w); stand.setAttribute("height", h * 0.75);
  stand.setAttribute("fill", "#2a2a2a"); stand.setAttribute("rx", "2");
  g.appendChild(stand);
  const screen = document.createElementNS(NS, "rect");
  screen.setAttribute("x", -w / 2 + 2); screen.setAttribute("y", -h / 2 + h * 0.28);
  screen.setAttribute("width", w - 4); screen.setAttribute("height", h * 0.50);
  screen.setAttribute("fill", "#1a1a1a"); screen.setAttribute("rx", "1");
  g.appendChild(screen);
}

function renderStove(g, w, h) {
  const body = document.createElementNS(NS, "rect");
  body.setAttribute("x", -w / 2); body.setAttribute("y", -h / 2);
  body.setAttribute("width", w); body.setAttribute("height", h);
  body.setAttribute("fill", "#e8e8e8"); body.setAttribute("stroke", "#d0d0d0");
  g.appendChild(body);
  [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function(pos) {
    const burner = document.createElementNS(NS, "circle");
    burner.setAttribute("cx", w * pos[0]);
    burner.setAttribute("cy", h * pos[1]);
    burner.setAttribute("r", w * 0.10);
    burner.setAttribute("fill", "#333333");
    g.appendChild(burner);
  });
}

function renderFridge(g, w, h) {
  const body = document.createElementNS(NS, "rect");
  body.setAttribute("x", -w / 2); body.setAttribute("y", -h / 2);
  body.setAttribute("width", w); body.setAttribute("height", h);
  body.setAttribute("fill", "#f8f8f8"); body.setAttribute("stroke", "#e0e0e0");
  g.appendChild(body);
  const split = document.createElementNS(NS, "line");
  split.setAttribute("x1", -w / 2); split.setAttribute("y1", "0");
  split.setAttribute("x2", w / 2); split.setAttribute("y2", "0");
  split.setAttribute("stroke", "#e0e0e0"); split.setAttribute("stroke-width", "1");
  g.appendChild(split);
  const handle = document.createElementNS(NS, "rect");
  handle.setAttribute("x", w / 2 - w * 0.06); handle.setAttribute("y", h * 0.15);
  handle.setAttribute("width", w * 0.03); handle.setAttribute("height", h * 0.18);
  handle.setAttribute("fill", "#c0c0c0"); handle.setAttribute("rx", "1");
  g.appendChild(handle);
}

// --- Clean Labels with Background ---
function renderLabels(svg, rooms, size) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    const point = room.labelPoint || polygonCentroid(room.polygon);
    const bbox = polygonBBox(room.polygon);
    const roomWidthPx = Math.max(1, (bbox.maxX - bbox.minX) * size.width);
    const roomHeightPx = Math.max(1, (bbox.maxY - bbox.minY) * size.height);
    const label = layoutRoomLabel({
      name: room.name || room.id || "Room",
      dims: room.dimensionsText || room.dimensions || "",
      maxWidthPx: Math.min(200, Math.max(56, roomWidthPx * 0.88)),
      maxHeightPx: Math.max(24, roomHeightPx * 0.4),
    });
    const tx = point.x * size.width;
    const ty = point.y * size.height;

    const roomId = room.id || room.name || "";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "plan-label");
    g.setAttribute("data-room-label", roomId);
    g.setAttribute("transform", "translate(" + tx + " " + ty + ")");

    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("class", "plan-label-bg");
    bg.setAttribute("x", String(-label.pillWidth / 2));
    bg.setAttribute("y", String(-label.pillHeight / 2));
    bg.setAttribute("width", String(label.pillWidth));
    bg.setAttribute("height", String(label.pillHeight));
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("opacity", "0.55");
    bg.setAttribute("rx", "6");
    g.appendChild(bg);

    let y = -label.pillHeight / 2 + label.paddingY;
    label.lines.forEach(function (line) {
      const text = document.createElementNS(NS, "text");
      text.setAttribute("class", line.kind === "dims" ? "plan-label-dims" : "plan-label-name");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "hanging");
      text.setAttribute("font-family", "'Segoe UI', Arial, sans-serif");
      text.setAttribute("font-size", String(line.kind === "dims" ? label.dimsFontSize : label.nameFontSize));
      text.setAttribute("font-weight", line.kind === "dims" ? "400" : "600");
      text.setAttribute("fill", line.kind === "dims" ? "#777777" : "#2c2c2c");
      text.setAttribute("y", String(y));
      text.textContent = line.text;
      g.appendChild(text);
      y += line.lineHeight;
    });

    svg.appendChild(g);
  });
}

export function renderPlan(svg, data, activeRoomId, selectedFurnitureId, size) {
  svg.innerHTML = "";
  renderBackground(svg, size);
  createDefs(svg);

  renderTexturedFills(svg, data.rooms || [], activeRoomId, size);
  renderRugs(svg, data.rooms || [], size);
  renderWindows(svg, data.windows || [], size);
  renderWalls(svg, data.walls || [], data.rooms || [], size);
  renderDetailedFurniture(svg, data.furniture || [], data.furniture_catalog || [], selectedFurnitureId, size);
  renderLabels(svg, data.rooms || [], size);
}
