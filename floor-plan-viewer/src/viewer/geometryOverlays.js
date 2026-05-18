/** SVG overlays for scale, measure, draw-room, and vertex edit tools. */
const NS = "http://www.w3.org/2000/svg";

function svgEl(tag) {
  return document.createElementNS(NS, tag);
}

function setAttrs(el, attrs) {
  Object.keys(attrs).forEach(function (key) {
    var value = attrs[key];
    if (value !== undefined && value !== null) el.setAttribute(key, String(value));
  });
  return el;
}

function normToPx(p, size) {
  return { x: p.x * size.width, y: p.y * size.height };
}

function pointsAttr(poly, w, h) {
  return poly
    .map(function (p) {
      return p.x * w + "," + p.y * h;
    })
    .join(" ");
}

function polygonCentroid(poly) {
  var area = 0;
  var cx = 0;
  var cy = 0;
  for (var i = 0; i < poly.length; i++) {
    var j = (i + 1) % poly.length;
    var cross = poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    area += cross;
    cx += (poly[i].x + poly[j].x) * cross;
    cy += (poly[i].y + poly[j].y) * cross;
  }
  if (Math.abs(area) < 1e-12) {
    var sx = 0;
    var sy = 0;
    poly.forEach(function (p) {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / poly.length, y: sy / poly.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function renderCalibrationOverlays(svg, calibration, size, draftSegment) {
  var g = setAttrs(svgEl("g"), { class: "plan-calibration-layer", "pointer-events": "none" });

  function drawSegment(from, to, dashed) {
    var a = normToPx(from, size);
    var b = normToPx(to, size);
    g.appendChild(
      setAttrs(svgEl("line"), {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "plan-calibration-line",
        "stroke-dasharray": dashed ? "6 4" : undefined,
      })
    );
    [a, b].forEach(function (pt) {
      g.appendChild(
        setAttrs(svgEl("circle"), {
          cx: pt.x,
          cy: pt.y,
          r: 5,
          class: "plan-calibration-dot",
        })
      );
    });
  }

  (calibration && calibration.segments ? calibration.segments : []).forEach(function (seg) {
    var from = seg.from || seg.a;
    var to = seg.to || seg.b;
    if (!from || !to) return;
    drawSegment(from, to, false);
  });

  if (draftSegment && draftSegment.from) {
    if (draftSegment.to) drawSegment(draftSegment.from, draftSegment.to, true);
    else {
      var a = normToPx(draftSegment.from, size);
      g.appendChild(
        setAttrs(svgEl("circle"), {
          cx: a.x,
          cy: a.y,
          r: 6,
          class: "plan-calibration-dot plan-calibration-dot-draft",
        })
      );
    }
  }

  svg.appendChild(g);
}

export function renderMeasureOverlay(svg, measure, size, draftSegment) {
  var g = setAttrs(svgEl("g"), { class: "plan-measure-layer", "pointer-events": "none" });

  function drawSegment(from, to, label, dashed) {
    var a = normToPx(from, size);
    var b = normToPx(to, size);
    g.appendChild(
      setAttrs(svgEl("line"), {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "plan-measure-line",
        "stroke-dasharray": dashed ? "5 4" : undefined,
      })
    );
    [a, b].forEach(function (pt) {
      g.appendChild(
        setAttrs(svgEl("circle"), { cx: pt.x, cy: pt.y, r: 5, class: "plan-measure-dot" })
      );
    });
    if (label) {
      g.appendChild(
        setAttrs(svgEl("text"), {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2 - 8,
          class: "plan-measure-label",
          "text-anchor": "middle",
          textContent: label,
        })
      );
    }
  }

  if (measure && measure.from && measure.to) {
    drawSegment(measure.from, measure.to, measure.label || "", false);
  }
  if (draftSegment && draftSegment.from) {
    if (draftSegment.to) drawSegment(draftSegment.from, draftSegment.to, "", true);
    else {
      var a = normToPx(draftSegment.from, size);
      g.appendChild(
        setAttrs(svgEl("circle"), {
          cx: a.x,
          cy: a.y,
          r: 6,
          class: "plan-measure-dot plan-measure-dot-draft",
        })
      );
    }
  }

  svg.appendChild(g);
}

export function renderDrawRoomOverlay(svg, points, cursor, areaLabel, size) {
  if (!points || !points.length) return;
  var g = setAttrs(svgEl("g"), { class: "plan-draw-room-layer", "pointer-events": "none" });
  var pts = points.map(function (p) {
    return normToPx(p, size);
  });

  if (pts.length >= 2) {
    var openPts = pts
      .map(function (p) {
        return p.x + "," + p.y;
      })
      .join(" ");
    if (cursor) openPts += " " + cursor.x + "," + cursor.y;
    g.appendChild(
      setAttrs(svgEl("polyline"), {
        class: "plan-draw-room-line",
        points: openPts,
        fill: "none",
      })
    );
  }
  if (pts.length >= 3) {
    g.appendChild(
      setAttrs(svgEl("polygon"), {
        class: "plan-draw-room-fill",
        points: pts
          .map(function (p) {
            return p.x + "," + p.y;
          })
          .join(" "),
      })
    );
  }
  pts.forEach(function (p, i) {
    g.appendChild(
      setAttrs(svgEl("circle"), {
        cx: p.x,
        cy: p.y,
        r: i === 0 ? 7 : 5,
        class: "plan-draw-room-dot" + (i === 0 ? " plan-draw-room-dot-first" : ""),
      })
    );
  });
  if (cursor && pts.length) {
    g.appendChild(
      setAttrs(svgEl("circle"), {
        cx: cursor.x,
        cy: cursor.y,
        r: 4,
        class: "plan-draw-room-dot plan-draw-room-dot-cursor",
      })
    );
  }
  if (areaLabel && pts.length >= 2) {
    var anchor = cursor || pts[pts.length - 1];
    g.appendChild(
      setAttrs(svgEl("text"), {
        x: anchor.x + 10,
        y: anchor.y - 10,
        class: "plan-draw-room-area-label",
        textContent: "(" + areaLabel + ")",
      })
    );
  }
  svg.appendChild(g);
}

export function renderRoomMeasurementBadge(svg, room, areaLabel, dimLabel, size) {
  if (!room || !room.polygon || room.polygon.length < 3) return;
  var c = room.labelPoint || polygonCentroid(room.polygon);
  var px = c.x * size.width;
  var py = c.y * size.height;
  var g = setAttrs(svgEl("g"), { class: "plan-room-measure-badge", "pointer-events": "none" });
  var lines = [areaLabel];
  if (dimLabel) lines.push(dimLabel);
  var lineH = 14;
  var padY = 6;
  var w = Math.max(72, Math.max.apply(null, lines.map(function (l) { return l.length * 6.5; })));
  var h = lines.length * lineH + padY * 2;
  g.appendChild(
    setAttrs(svgEl("rect"), {
      x: px - w / 2,
      y: py - h / 2,
      width: w,
      height: h,
      rx: 4,
      class: "plan-room-measure-badge-bg",
    })
  );
  lines.forEach(function (line, i) {
    g.appendChild(
      setAttrs(svgEl("text"), {
        x: px,
        y: py - h / 2 + padY + (i + 0.75) * lineH,
        class: "plan-room-measure-badge-text",
        "text-anchor": "middle",
        textContent: line,
      })
    );
  });
  svg.appendChild(g);
}

export function renderSelectedRoomOutline(svg, rooms, selectedRoomId, size) {
  if (!selectedRoomId) return;
  var room = (rooms || []).find(function (r) {
    return (r.id || r.name || "") === selectedRoomId;
  });
  if (!room || !room.polygon || room.polygon.length < 3) return;
  svg.appendChild(
    setAttrs(svgEl("polygon"), {
      class: "plan-room-selected",
      points: pointsAttr(room.polygon, size.width, size.height),
      fill: "none",
    })
  );
}

export function renderVertexHandles(svg, rooms, size, selectedVertex) {
  (rooms || []).forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var roomId = room.id || room.name || "";
    room.polygon.forEach(function (p, i) {
      var isSel =
        selectedVertex &&
        selectedVertex.roomId === roomId &&
        selectedVertex.index === i;
      svg.appendChild(
        setAttrs(svgEl("circle"), {
          class: "plan-vertex-handle",
          "data-room-id": roomId,
          "data-vertex-index": String(i),
          cx: p.x * size.width,
          cy: p.y * size.height,
          r: isSel ? 8 : 6,
          fill: isSel ? "#e91e63" : "#ff5722",
          stroke: "#ffffff",
          "stroke-width": 2,
        })
      );
    });
  });
}
