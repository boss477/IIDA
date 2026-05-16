const NS = "http://www.w3.org/2000/svg";

function pointsAttr(polygon, imageWidth, imageHeight) {
  return polygon.map(function (p) {
    return p.x * imageWidth + "," + p.y * imageHeight;
  }).join(" ");
}

function isSwingDoor(d) {
  return (
    d &&
    d.x != null &&
    d.radius != null &&
    (d.type == null || d.type === "swing")
  );
}

/**
 * Digitizer format: { type: "door", polygon: [...], connects?: string[], id?: string }
 * Legacy: { x, y, radius, headingDeg, sweepDeg, swing }
 * @param {SVGSVGElement} svg
 * @param {Array<object>} doors
 * @param {{ width:number, height:number }} imageSize
 */
export function renderDoors(svg, doors, imageSize) {
  var w = imageSize && imageSize.width ? imageSize.width : 1;
  var h = imageSize && imageSize.height ? imageSize.height : 1;
  var unit = Math.min(w, h);
  svg.querySelectorAll("[data-door]").forEach(function (n) {
    n.remove();
  });
  (doors || []).forEach(function (d, idx) {
    var g = document.createElementNS(NS, "g");
    g.setAttribute("data-door", d.id || "door-" + idx);
    g.setAttribute("class", "door-mark");

    if (d.type === "door" && d.polygon && d.polygon.length >= 3) {
      var poly = document.createElementNS(NS, "polygon");
      poly.setAttribute("points", pointsAttr(d.polygon, w, h));
      poly.setAttribute("fill", "rgba(61,40,23,0.12)");
      poly.setAttribute("stroke", "#3d2817");
      poly.setAttribute("stroke-width", Math.max(1, unit * 0.0014));
      poly.setAttribute("stroke-linejoin", "miter");
      g.appendChild(poly);
      svg.appendChild(g);
      return;
    }

    if (isSwingDoor(d)) {
      var x = d.x * w;
      var y = d.y * h;
      var r = (d.radius != null ? d.radius : 0.042) * unit;
      var h = ((d.headingDeg != null ? d.headingDeg : 0) * Math.PI) / 180;
      var sweep = ((d.sweepDeg != null ? d.sweepDeg : 78) * Math.PI) / 180;
      var dir = d.swing === "left" ? -1 : 1;

      var x1 = x + r * Math.cos(h);
      var y1 = y + r * Math.sin(h);
      var x2 = x + r * Math.cos(h + sweep * dir);
      var y2 = y + r * Math.sin(h + sweep * dir);

      var large = 0;
      var sweepFlag = dir > 0 ? 1 : 0;
      var dAttr =
        "M " +
        x +
        " " +
        y +
        " L " +
        x1 +
        " " +
        y1 +
        " A " +
        r +
        " " +
        r +
        " 0 " +
        large +
        " " +
        sweepFlag +
        " " +
        x2 +
        " " +
        y2;

      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", dAttr);
      path.setAttribute("fill", "rgba(30,27,24,0.04)");
      path.setAttribute("stroke", "#1e1b18");
      path.setAttribute("stroke-width", Math.max(1, unit * 0.0018));
      path.setAttribute("stroke-linejoin", "round");

      var jamb = document.createElementNS(NS, "line");
      jamb.setAttribute("x1", String(x));
      jamb.setAttribute("y1", String(y));
      jamb.setAttribute("x2", String(x1));
      jamb.setAttribute("y2", String(y1));
      jamb.setAttribute("stroke", "#1e1b18");
      jamb.setAttribute("stroke-width", Math.max(1, unit * 0.0025));
      jamb.setAttribute("stroke-linecap", "square");

      g.appendChild(path);
      g.appendChild(jamb);
    }

    svg.appendChild(g);
  });
}
