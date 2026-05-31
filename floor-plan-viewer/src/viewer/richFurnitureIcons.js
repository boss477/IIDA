/**
 * Drafted-style rich SVG furniture icons (unit box centered at 0,0; w×h pixels).
 */
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  var node = document.createElementNS(NS, tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] != null) node.setAttribute(k, String(attrs[k]));
    });
  }
  return node;
}

function woodPatternId() {
  return "rich-wood-grain";
}

export function ensureRichFurnitureDefs(defs) {
  if (!defs) return;

  if (!defs.querySelector("#" + woodPatternId())) {
    var pat = el("pattern", {
      id: woodPatternId(),
      patternUnits: "userSpaceOnUse",
      width: "24",
      height: "24",
    });
    pat.appendChild(el("rect", { width: "24", height: "24", fill: "#c4a070" }));
    var plankW = 5;
    for (var px = 0; px < 24; px += plankW) {
      var tone = px % 10 === 0 ? "#b89258" : px % 5 === 0 ? "#c9a878" : "#ccb088";
      pat.appendChild(el("rect", { x: String(px), y: "0", width: String(plankW - 0.6), height: "24", fill: tone }));
      pat.appendChild(el("line", {
        x1: String(px + 0.4),
        y1: "0",
        x2: String(px + 0.4),
        y2: "24",
        stroke: "#7a5838",
        "stroke-width": "0.4",
        opacity: "0.55",
      }));
    }
    for (var gy = 0; gy < 24; gy += 1.5) {
      pat.appendChild(el("line", {
        x1: "0",
        y1: String(gy),
        x2: "24",
        y2: String(gy + Math.sin(gy * 0.35) * 0.55),
        stroke: "#8a6848",
        "stroke-width": "0.22",
        opacity: "0.32",
      }));
    }
    defs.appendChild(pat);
  }

  if (!defs.querySelector("#rich-wood-grain-h")) {
    var patH = el("pattern", {
      id: "rich-wood-grain-h",
      patternUnits: "userSpaceOnUse",
      width: "24",
      height: "8",
    });
    patH.appendChild(el("rect", { width: "24", height: "8", fill: "#b89258" }));
    for (var hy = 0; hy < 8; hy += 2) {
      patH.appendChild(el("line", {
        x1: "0",
        y1: String(hy + 0.5),
        x2: "24",
        y2: String(hy + 0.5),
        stroke: hy % 4 === 0 ? "#8a6848" : "#9a7858",
        "stroke-width": "0.45",
        opacity: "0.5",
      }));
    }
    defs.appendChild(patH);
  }

  if (!defs.querySelector("#rich-bedding")) {
    var bedGrad = el("radialGradient", { id: "rich-bedding", cx: "50%", cy: "38%", r: "68%" });
    bedGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#ffffff" }));
    bedGrad.appendChild(el("stop", { offset: "72%", "stop-color": "#fafaf8" }));
    bedGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#f0efec" }));
    defs.appendChild(bedGrad);
  }

  if (!defs.querySelector("#rich-frame")) {
    var frameGrad = el("linearGradient", { id: "rich-frame", x1: "0", y1: "0", x2: "0", y2: "1" });
    frameGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#ebe0d0" }));
    frameGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#ddd0bc" }));
    defs.appendChild(frameGrad);
  }

  if (!defs.querySelector("#rich-rug-flat")) {
    var rugGrad = el("linearGradient", { id: "rich-rug-flat", x1: "0", y1: "0", x2: "1", y2: "1" });
    rugGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#dcc8a8" }));
    rugGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#d4bc98" }));
    defs.appendChild(rugGrad);
  }

  if (!defs.querySelector("#rich-sofa-fabric")) {
    var sofaGrad = el("radialGradient", {
      id: "rich-sofa-fabric",
      cx: "50%",
      cy: "26%",
      r: "68%",
      fx: "50%",
      fy: "12%",
    });
    sofaGrad.appendChild(el("stop", { offset: "0%", "stop-color": "#eee6d8" }));
    sofaGrad.appendChild(el("stop", { offset: "60%", "stop-color": "#d8cfc0" }));
    sofaGrad.appendChild(el("stop", { offset: "100%", "stop-color": "#c0b6a6" }));
    defs.appendChild(sofaGrad);
  }

  if (!defs.querySelector("#rich-wood-linear")) {
    var woodLin = el("linearGradient", { id: "rich-wood-linear", x1: "0", y1: "0", x2: "1", y2: "0" });
    woodLin.appendChild(el("stop", { offset: "0%", "stop-color": "#9a7248" }));
    woodLin.appendChild(el("stop", { offset: "18%", "stop-color": "#b8895c" }));
    woodLin.appendChild(el("stop", { offset: "32%", "stop-color": "#c49868" }));
    woodLin.appendChild(el("stop", { offset: "55%", "stop-color": "#b88758" }));
    woodLin.appendChild(el("stop", { offset: "100%", "stop-color": "#9a7248" }));
    defs.appendChild(woodLin);
  }

  if (!defs.querySelector("#rich-fabric-filter")) {
    var fabricF = el("filter", {
      id: "rich-fabric-filter",
      x: "0%",
      y: "0%",
      width: "100%",
      height: "100%",
    });
    fabricF.appendChild(
      el("feTurbulence", {
        type: "fractalNoise",
        baseFrequency: "0.75",
        numOctaves: "4",
        stitchTiles: "stitch",
        seed: "9",
        result: "noise",
      })
    );
    fabricF.appendChild(
      el("feColorMatrix", { in: "noise", type: "saturate", values: "0", result: "gray" })
    );
    fabricF.appendChild(el("feBlend", { in: "SourceGraphic", in2: "gray", mode: "multiply" }));
    defs.appendChild(fabricF);
  }

  if (!defs.querySelector("#rich-leaf-a")) {
    var lg = el("radialGradient", { id: "rich-leaf-a", cx: "40%", cy: "40%", r: "65%" });
    lg.appendChild(el("stop", { offset: "0%", "stop-color": "#6fa848" }));
    lg.appendChild(el("stop", { offset: "100%", "stop-color": "#4a8030" }));
    defs.appendChild(lg);
  }

  if (!defs.querySelector("#rich-area-rug")) {
    var rugPat = el("pattern", {
      id: "rich-area-rug",
      patternUnits: "userSpaceOnUse",
      width: "10",
      height: "10",
    });
    rugPat.appendChild(el("rect", { width: "10", height: "10", fill: "#f0ece4" }));
    for (var ry = 1; ry < 10; ry += 2) {
      for (var rx = 1; rx < 10; rx += 2) {
        rugPat.appendChild(el("circle", {
          cx: String(rx + (ry % 4 === 0 ? 0.5 : 0)),
          cy: String(ry),
          r: "0.85",
          fill: "#ddd8ce",
          opacity: "0.85",
        }));
      }
    }
    defs.appendChild(rugPat);
  }

  if (!defs.querySelector("#furniture-rich-shadow")) {
    var f = el("filter", {
      id: "furniture-rich-shadow",
      x: "-60%",
      y: "-60%",
      width: "220%",
      height: "220%",
    });
    f.appendChild(el("feDropShadow", {
      dx: "0",
      dy: "4",
      stdDeviation: "3",
      "flood-color": "#7a6050",
      "flood-opacity": "0.2",
    }));
    defs.appendChild(f);
  }

  if (!defs.querySelector("#furniture-shadow-soft")) {
    var fs = el("filter", {
      id: "furniture-shadow-soft",
      x: "-50%",
      y: "-50%",
      width: "200%",
      height: "200%",
    });
    fs.appendChild(el("feDropShadow", {
      dx: "0",
      dy: "3",
      stdDeviation: "2",
      "flood-color": "#7a6050",
      "flood-opacity": "0.14",
    }));
    defs.appendChild(fs);
  }
}

var SHADOW_FILTER = "url(#furniture-rich-shadow)";
var SHADOW_SOFT = "url(#furniture-shadow-soft)";
var INK = "#2a2218";
var INK_MED = "#5c4a38";
var INK_LIGHT = "#8a7868";

var FABRIC = "url(#rich-sofa-fabric)";
var WARM_SHADOW = "#7a6050";

/** Soft floor ambient ellipse — grounds object on the surface. */
function appendFloorAmbient(g, w, h) {
  g.appendChild(
    el("ellipse", {
      cx: "0",
      cy: String(h * 0.48),
      rx: String(w * 0.42),
      ry: String(Math.max(3, h * 0.04)),
      fill: WARM_SHADOW,
      opacity: "0.1",
    })
  );
}

/** Horizontal wood grain lines over a tabletop rect. */
function appendWoodGrainLines(g, x, y, width, height) {
  var n = Math.max(5, Math.floor(height / 5));
  for (var i = 1; i < n; i++) {
    var ly = y + (height * i) / n;
    g.appendChild(
      el("line", {
        x1: String(x),
        y1: String(ly),
        x2: String(x + width),
        y2: String(ly),
        stroke: "#8a6038",
        "stroke-width": "0.3",
        opacity: "0.35",
      })
    );
  }
}

function chairWhite(g, cx, cy, r, rotDeg) {
  var grp = el("g", {
    transform: "translate(" + cx + " " + cy + ") rotate(" + rotDeg + ")",
    filter: SHADOW_FILTER,
  });
  grp.appendChild(
    el("ellipse", {
      cx: "0",
      cy: String(r * 0.22),
      rx: String(r * 0.46),
      ry: String(r * 0.32),
      fill: "#ffffff",
      stroke: INK,
      "stroke-width": "0.7",
    })
  );
  grp.appendChild(
    el("rect", {
      x: String(-r * 0.4),
      y: String(-r * 0.78),
      width: String(r * 0.8),
      height: String(r * 0.42),
      rx: String(r * 0.2),
      fill: "#fafaf8",
      stroke: INK,
      "stroke-width": "0.7",
    })
  );
  g.appendChild(grp);
}

/** Scale table + chairs to fit visual w×h including chair overhang. */
function scaleDiningToFit(visualW, visualH, tw, th, r) {
  var off = r * 0.62;
  var extX = tw / 2 + off + r * 0.46;
  var extY = th / 2 + off + r * 0.46;
  var scale = Math.min(1, visualW / (2 * extX), visualH / (2 * extY));
  return { tw: tw * scale, th: th * scale, r: r * scale };
}

/** Fit a horizontal table (long axis X) inside visual w×h with chair clearance. */
function diningTableDims(visualW, visualH, r) {
  var chairPad = r * 2.5;
  var availW = Math.max(visualW - chairPad * 2, visualW * 0.5);
  var availH = Math.max(visualH - chairPad * 2, visualH * 0.5);
  var aspect = 1.75;
  var vTw;
  var vTh;
  if (availW / availH >= aspect) {
    vTh = availH * 0.72;
    vTw = Math.min(availW * 0.85, vTh * aspect);
  } else {
    vTw = availW * 0.85;
    vTh = vTw / aspect;
  }
  return { vTw: vTw, vTh: vTh };
}

/** Place chairs on long sides (3 each) + short sides (1 each) for 8-seat layout. */
function placeDiningChairs8(g, tw, th, r, tableVertical) {
  var off = r * 0.62;
  if (tableVertical) {
    chairWhite(g, -tw / 2 - off, -th * 0.22, r, -90);
    chairWhite(g, -tw / 2 - off, 0, r, -90);
    chairWhite(g, -tw / 2 - off, th * 0.22, r, -90);
    chairWhite(g, tw / 2 + off, -th * 0.22, r, 90);
    chairWhite(g, tw / 2 + off, 0, r, 90);
    chairWhite(g, tw / 2 + off, th * 0.22, r, 90);
    chairWhite(g, 0, -th / 2 - off, r, 0);
    chairWhite(g, 0, th / 2 + off, r, 180);
  } else {
    chairWhite(g, -tw * 0.22, -th / 2 - off, r, 0);
    chairWhite(g, 0, -th / 2 - off, r, 0);
    chairWhite(g, tw * 0.22, -th / 2 - off, r, 0);
    chairWhite(g, -tw * 0.22, th / 2 + off, r, 180);
    chairWhite(g, 0, th / 2 + off, r, 180);
    chairWhite(g, tw * 0.22, th / 2 + off, r, 180);
    chairWhite(g, -tw / 2 - off, 0, r, -90);
    chairWhite(g, tw / 2 + off, 0, r, 90);
  }
}

function placeDiningChairs6(g, tw, th, r, tableVertical) {
  var off = r * 0.62;
  if (tableVertical) {
    chairWhite(g, -tw / 2 - off, -th * 0.25, r, -90);
    chairWhite(g, -tw / 2 - off, th * 0.25, r, -90);
    chairWhite(g, tw / 2 + off, -th * 0.25, r, 90);
    chairWhite(g, tw / 2 + off, th * 0.25, r, 90);
    chairWhite(g, 0, -th / 2 - off, r, 0);
    chairWhite(g, 0, th / 2 + off, r, 180);
  } else {
    chairWhite(g, -tw * 0.25, -th / 2 - off, r, 0);
    chairWhite(g, tw * 0.25, -th / 2 - off, r, 0);
    chairWhite(g, -tw * 0.25, th / 2 + off, r, 180);
    chairWhite(g, tw * 0.25, th / 2 + off, r, 180);
    chairWhite(g, -tw / 2 - off, 0, r, -90);
    chairWhite(g, tw / 2 + off, 0, r, 90);
  }
}

function placeDiningChairs4(g, tw, th, r, tableVertical) {
  var off = r * 0.62;
  if (tableVertical) {
    chairWhite(g, -tw / 2 - off, 0, r, -90);
    chairWhite(g, tw / 2 + off, 0, r, 90);
    chairWhite(g, 0, -th / 2 - off, r, 0);
    chairWhite(g, 0, th / 2 + off, r, 180);
  } else {
    chairWhite(g, 0, -th / 2 - off, r, 0);
    chairWhite(g, 0, th / 2 + off, r, 180);
    chairWhite(g, -tw / 2 - off, 0, r, -90);
    chairWhite(g, tw / 2 + off, 0, r, 90);
  }
}

/** 6 or 8 chair dining — wood table like Drafted reference. */
export function appendRichDiningTable(g, w, h, chairCount, rotationDeg) {
  var rot = ((rotationDeg || 0) % 360 + 360) % 360;
  var tableVertical = rot === 90 || rot === 270;
  var visualW = tableVertical ? h : w;
  var visualH = tableVertical ? w : h;
  var r = Math.min(visualW, visualH) * 0.07;
  var sized = diningTableDims(visualW, visualH, r);
  var tw = tableVertical ? sized.vTh : sized.vTw;
  var th = tableVertical ? sized.vTw : sized.vTh;
  var scaled = scaleDiningToFit(visualW, visualH, tw, th, r);
  tw = scaled.tw;
  th = scaled.th;
  r = scaled.r;

  var count = chairCount >= 8 ? 8 : chairCount >= 6 ? 6 : 4;
  if (count >= 8) placeDiningChairs8(g, tw, th, r, tableVertical);
  else if (count >= 6) placeDiningChairs6(g, tw, th, r, tableVertical);
  else placeDiningChairs4(g, tw, th, r, tableVertical);

  g.appendChild(
    el("rect", {
      x: String(-tw / 2),
      y: String(-th / 2),
      width: String(tw),
      height: String(th),
      rx: "4",
      fill: "url(#rich-wood-grain)",
      stroke: INK_MED,
      "stroke-width": "1",
      filter: SHADOW_FILTER,
    })
  );
  g.appendChild(
    el("rect", {
      x: String(-tw / 2),
      y: String(-th / 2),
      width: String(tw),
      height: String(Math.max(2, th * 0.06)),
      rx: "2",
      fill: "rgba(0,0,0,0.06)",
      stroke: "none",
    })
  );
  g.appendChild(
    el("rect", {
      x: String(-tw / 2 + 2),
      y: String(-th / 2 + 2),
      width: String(tw - 4),
      height: String(th - 4),
      rx: "3",
      fill: "none",
      stroke: "rgba(255,255,255,0.14)",
      "stroke-width": "0.6",
    })
  );
}

/** Drafted-style top-down sofa / armchair (1–3 seats). */
export function appendRichSofa(g, w, h, seats, rotationDeg) {
  seats = Math.max(1, Math.min(3, seats || 2));
  var rot = ((rotationDeg || 0) % 360 + 360) % 360;
  var longVertical = rot === 90 || rot === 270 ? w >= h : h > w * 1.08;
  if (rot === 90 || rot === 270) longVertical = !longVertical;

  var bodyW = longVertical ? w * 0.72 : w * 0.94;
  var bodyH = longVertical ? h * 0.94 : h * 0.72;
  var armW = (longVertical ? bodyW : bodyW) * (seats === 1 ? 0.16 : 0.11);
  var backD = (longVertical ? bodyH : bodyH) * 0.22;
  var bx = -bodyW / 2;
  var by = -bodyH / 2;

  appendFloorAmbient(g, w, h);

  g.appendChild(
    el("rect", {
      x: String(bx),
      y: String(by),
      width: String(bodyW),
      height: String(bodyH),
      rx: String(Math.min(bodyW, bodyH) * 0.06),
      fill: FABRIC,
      stroke: INK,
      "stroke-width": "0.85",
      filter: SHADOW_FILTER,
    })
  );

  if (longVertical) {
    g.appendChild(
      el("rect", {
        x: String(bx + bodyW - backD),
        y: String(by + 2),
        width: String(backD - 2),
        height: String(bodyH - 4),
        rx: "2",
        fill: "#f0efeb",
        stroke: INK,
        "stroke-width": "0.55",
      })
    );
    var seatH = (bodyH - 8) / seats;
    for (var vi = 0; vi < seats; vi++) {
      g.appendChild(
        el("rect", {
          x: String(bx + 4),
          y: String(by + 4 + vi * seatH),
          width: String(bodyW - backD - 8),
          height: String(seatH - 3),
          rx: "2",
          fill: FABRIC,
          stroke: INK,
          "stroke-width": "0.45",
        })
      );
    }
    g.appendChild(
      el("rect", {
        x: String(bx + 2),
        y: String(by + 2),
        width: String(bodyW * 0.12),
        height: String(bodyH - 4),
        rx: "2",
        fill: "#f0efeb",
        stroke: INK,
        "stroke-width": "0.55",
      })
    );
    g.appendChild(
      el("rect", {
        x: String(bx + 2),
        y: String(by + bodyH - bodyH * 0.12 - 2),
        width: String(bodyW * 0.12),
        height: String(bodyH * 0.12),
        rx: "2",
        fill: "#f0efeb",
        stroke: INK,
        "stroke-width": "0.55",
      })
    );
  } else {
    g.appendChild(
      el("rect", {
        x: String(bx + 2),
        y: String(by + 2),
        width: String(bodyW - 4),
        height: String(backD - 2),
        rx: "2",
        fill: "#f0efeb",
        stroke: INK,
        "stroke-width": "0.55",
      })
    );
    var seatW = (bodyW - 8) / seats;
    for (var hi = 0; hi < seats; hi++) {
      if (seats === 1) continue;
      g.appendChild(
        el("rect", {
          x: String(bx + 4 + hi * seatW),
          y: String(by + backD + 2),
          width: String(seatW - 3),
          height: String(bodyH - backD - 6),
          rx: "2",
          fill: FABRIC,
          stroke: INK,
          "stroke-width": "0.45",
        })
      );
    }
    if (seats === 1) {
      g.appendChild(
        el("rect", {
          x: String(bx + 2),
          y: String(by + backD),
          width: String(armW),
          height: String(bodyH - backD - 4),
          rx: "2",
          fill: "#f0efeb",
          stroke: INK,
          "stroke-width": "0.55",
        })
      );
      g.appendChild(
        el("rect", {
          x: String(bx + bodyW - armW - 2),
          y: String(by + backD),
          width: String(armW),
          height: String(bodyH - backD - 4),
          rx: "2",
          fill: "#f0efeb",
          stroke: INK,
          "stroke-width": "0.55",
        })
      );
      var scx = bx + bodyW / 2;
      var scy = by + backD + (bodyH - backD) * 0.55;
      var sw = bodyW - armW * 2 - 10;
      var sh = bodyH - backD - 8;
      g.appendChild(
        el("rect", {
          x: String(bx + armW + 4),
          y: String(by + backD + 3),
          width: String(sw),
          height: String(sh * 0.85),
          rx: String(Math.min(sw, sh) * 0.08),
          fill: FABRIC,
          stroke: INK,
          "stroke-width": "0.45",
        })
      );
      g.appendChild(
        el("path", {
          d:
            "M " +
            (scx - sw / 2) +
            " " +
            (scy + sh * 0.2) +
            " Q " +
            scx +
            " " +
            (scy + sh * 0.55) +
            " " +
            (scx + sw / 2) +
            " " +
            (scy + sh * 0.2),
          fill: "none",
          stroke: INK_LIGHT,
          "stroke-width": "0.4",
        })
      );
    } else {
      g.appendChild(
        el("rect", {
          x: String(bx + 2),
          y: String(by + bodyH - armW * 0.85),
          width: String(bodyW * 0.11),
          height: String(armW * 0.85),
          rx: "2",
          fill: "#f0efeb",
          stroke: INK,
          "stroke-width": "0.55",
        })
      );
      g.appendChild(
        el("rect", {
          x: String(bx + bodyW - bodyW * 0.11 - 2),
          y: String(by + bodyH - armW * 0.85),
          width: String(bodyW * 0.11),
          height: String(armW * 0.85),
          rx: "2",
          fill: "#f0efeb",
          stroke: INK,
          "stroke-width": "0.55",
        })
      );
    }
  }

  function throwPillow(px, py, pw, ph, angle) {
    var pg = el("g", {
      transform: "translate(" + px + " " + py + ") rotate(" + angle + ")",
      filter: SHADOW_SOFT,
    });
    pg.appendChild(
      el("rect", {
        x: String(-pw / 2),
        y: String(-ph / 2),
        width: String(pw),
        height: String(ph),
        rx: String(ph * 0.35),
        fill: FABRIC,
        stroke: INK,
        "stroke-width": "0.55",
      })
    );
    g.appendChild(pg);
  }

  var pw = Math.min(bodyW, bodyH) * 0.14;
  var ph = pw * 0.55;
  if (longVertical) {
    throwPillow(bx + bodyW * 0.22, by + bodyH * 0.1, pw, ph, -22);
    throwPillow(bx + bodyW * 0.22, by + bodyH * 0.9, pw, ph, 22);
    if (seats >= 3) {
      throwPillow(bx + bodyW * 0.22, by + bodyH * 0.5, pw * 0.85, ph * 0.9, 0);
    }
  } else if (seats === 1) {
    throwPillow(bx + bodyW * 0.5, by + backD + (bodyH - backD) * 0.35, pw * 0.9, ph, 0);
  } else {
    throwPillow(bx + bodyW * 0.12, by + backD + 4, pw, ph, -28);
    throwPillow(bx + bodyW * 0.88, by + backD + 4, pw, ph, 28);
  }
}

/** Area rug body: fabric fill, border, diamond, corner dots, fringe. */
function appendAreaRugGraphic(g, x, y, w, h) {
  var deco = el("g", { filter: SHADOW_FILTER });
  var rx = 3;

  deco.appendChild(
    el("rect", {
      x: String(x),
      y: String(y),
      width: String(w),
      height: String(h),
      rx: String(rx),
      fill: "url(#rich-rug-flat)",
      filter: "url(#rich-fabric-filter)",
    })
  );

  var inset = Math.min(w, h) * 0.08;
  var ix = x + inset;
  var iy = y + inset;
  var iw = w - inset * 2;
  var ih = h - inset * 2;

  deco.appendChild(
    el("rect", {
      x: String(ix),
      y: String(iy),
      width: String(iw),
      height: String(ih),
      rx: "2",
      fill: "none",
      stroke: INK_MED,
      "stroke-width": "1.1",
    })
  );

  var cx = x + w / 2;
  var cy = y + h / 2;
  var dw = w * 0.44;
  var dh = h * 0.4;
  deco.appendChild(
    el("path", {
      d:
        "M " +
        cx +
        " " +
        (cy - dh / 2) +
        " L " +
        (cx + dw / 2) +
        " " +
        cy +
        " L " +
        cx +
        " " +
        (cy + dh / 2) +
        " L " +
        (cx - dw / 2) +
        " " +
        cy +
        " Z",
      fill: "none",
      stroke: INK_MED,
      "stroke-width": "0.65",
    })
  );

  var dotR = Math.min(w, h) * 0.022;
  var pad = inset * 1.65;
  [
    [x + pad, y + pad],
    [x + w - pad, y + pad],
    [x + pad, y + h - pad],
    [x + w - pad, y + h - pad],
  ].forEach(function (pt) {
    deco.appendChild(
      el("circle", {
        cx: String(pt[0]),
        cy: String(pt[1]),
        r: String(dotR),
        fill: "none",
        stroke: INK_MED,
        "stroke-width": "0.55",
      })
    );
  });

  var fringeLen = Math.min(w, h) * 0.035;
  var fringeStep = Math.max(4, w / 14);
  for (var fx = x + fringeStep * 0.5; fx < x + w - fringeStep * 0.25; fx += fringeStep) {
    deco.appendChild(
      el("line", {
        x1: String(fx),
        y1: String(y),
        x2: String(fx),
        y2: String(y + fringeLen),
        stroke: INK_MED,
        "stroke-width": "0.45",
        opacity: "0.7",
      })
    );
    deco.appendChild(
      el("line", {
        x1: String(fx),
        y1: String(y + h - fringeLen),
        x2: String(fx),
        y2: String(y + h),
        stroke: INK_MED,
        "stroke-width": "0.45",
        opacity: "0.7",
      })
    );
  }

  deco.appendChild(
    el("rect", {
      x: String(x),
      y: String(y),
      width: String(w),
      height: String(h),
      rx: String(rx),
      fill: "none",
      stroke: INK_MED,
      "stroke-width": "0.85",
    })
  );

  g.appendChild(deco);
}

/** Living-room woven area rug. */
export function appendRichAreaRug(g, w, h) {
  appendFloorAmbient(g, w, h);
  appendAreaRugGraphic(g, -w / 2, -h / 2, w, h);
}

/** Coffee table with book stack — Drafted living room. */
export function appendRichCoffeeTable(g, w, h) {
  var tw = w * 0.88;
  var th = h * 0.78;
  var tx = -tw / 2;
  var ty = -th / 2;

  appendFloorAmbient(g, w, h);

  g.appendChild(
    el("rect", {
      x: String(tx),
      y: String(ty),
      width: String(tw),
      height: String(th),
      rx: "3",
      fill: "url(#rich-wood-linear)",
      stroke: INK_MED,
      "stroke-width": "0.85",
      filter: SHADOW_FILTER,
    })
  );
  appendWoodGrainLines(g, tx, ty, tw, th);
  var bx = -tw * 0.12;
  var by = -th * 0.14;
  var bw = tw * 0.24;
  var bh = th * 0.22;
  var books = [
    { dy: 0, fill: "#d946a8", h: 1 },
    { dy: 0.28, fill: "#14b8a6", h: 0.85 },
    { dy: 0.52, fill: "#22c55e", h: 0.7 },
  ];
  books.forEach(function (bk) {
    var bhBk = bh * bk.h;
    g.appendChild(
      el("rect", {
        x: String(bx),
        y: String(by + bh * bk.dy),
        width: String(bw),
        height: String(bhBk),
        rx: "1",
        fill: bk.fill,
        stroke: INK,
        "stroke-width": "0.45",
        filter: SHADOW_SOFT,
      })
    );
  });
}

/** Square side table; optional top plant. */
export function appendRichSideTable(g, w, h, withPlant) {
  var s = Math.min(w, h) * 0.82;
  g.appendChild(
    el("rect", {
      x: String(-s / 2),
      y: String(-s / 2),
      width: String(s),
      height: String(s),
      rx: "2",
      fill: "url(#rich-wood-grain)",
      stroke: INK_MED,
      "stroke-width": "0.75",
      filter: SHADOW_FILTER,
    })
  );
  if (withPlant) {
    var potR = s * 0.22;
    g.appendChild(
      el("ellipse", {
        cx: "0",
        cy: String(potR * 0.15),
        rx: String(potR * 0.9),
        ry: String(potR * 0.45),
        fill: "#b87848",
        stroke: INK_MED,
        "stroke-width": "0.55",
      })
    );
    g.appendChild(
      el("ellipse", {
        cx: "0",
        cy: String(-potR * 0.35),
        rx: String(potR * 1.1),
        ry: String(potR * 0.75),
        fill: "url(#rich-leaf-a)",
        stroke: "#3a6028",
        "stroke-width": "0.45",
        filter: SHADOW_SOFT,
      })
    );
  }
}

export function appendRichBed(g, w, h) {
  var rugW = w * 1.12;
  var rugH = h * 0.96;
  var rugX = -rugW / 2;
  var rugY = -h / 2 + h * 0.008;

  appendFloorAmbient(g, rugW, rugH);
  appendAreaRugGraphic(g, rugX, rugY, rugW, rugH);

  var headY = -h / 2 + h * 0.042;
  var frameW = w * 0.92;
  var frameH = h * 0.84;
  var frameX = -frameW / 2;
  var frameY = headY + h * 0.028;
  var framePad = Math.min(w, h) * 0.022;

  g.appendChild(
    el("rect", {
      x: String(frameX),
      y: String(frameY),
      width: String(frameW),
      height: String(frameH),
      rx: String(Math.min(frameW, frameH) * 0.04),
      fill: "url(#rich-frame)",
      stroke: INK_MED,
      "stroke-width": "0.85",
      filter: SHADOW_FILTER,
    })
  );

  var mx = frameX + framePad;
  var my = frameY + framePad + h * 0.012;
  var mw = frameW - framePad * 2;
  var mh = frameH - framePad * 2 - h * 0.012;
  var footR = mw * 0.11;

  var nsW = w * 0.125;
  var nsH = h * 0.088;
  var cap = w * 0.028;
  [-1, 1].forEach(function (side) {
    var nx = side < 0 ? mx - nsW + cap : mx + mw - cap;
    g.appendChild(
      el("rect", {
        x: String(nx),
        y: String(headY),
        width: String(nsW),
        height: String(nsH),
        rx: "1.5",
        fill: "url(#rich-wood-grain)",
        stroke: INK_MED,
        "stroke-width": "0.75",
        filter: SHADOW_FILTER,
      })
    );
    g.appendChild(
      el("rect", {
        x: String(side < 0 ? nx - cap * 0.4 : nx + nsW - cap * 0.6),
        y: String(headY - cap * 0.15),
        width: String(cap),
        height: String(nsH + cap * 0.3),
        rx: "1",
        fill: "url(#rich-wood-grain)",
        stroke: INK_MED,
        "stroke-width": "0.7",
        filter: SHADOW_FILTER,
      })
    );
  });

  var hbY = headY - h * 0.018;
  var hbH = h * 0.02;
  g.appendChild(
    el("rect", {
      x: String(mx - cap * 0.2),
      y: String(hbY),
      width: String(mw + cap * 0.4),
      height: String(hbH),
      rx: "1",
      fill: "url(#rich-wood-grain-h)",
      stroke: INK_MED,
      "stroke-width": "0.75",
      filter: SHADOW_FILTER,
    })
  );

  var bedPath =
    "M " +
    mx +
    " " +
    my +
    " L " +
    (mx + mw) +
    " " +
    my +
    " L " +
    (mx + mw) +
    " " +
    (my + mh - footR) +
    " Q " +
    (mx + mw) +
    " " +
    (my + mh) +
    " " +
    (mx + mw - footR) +
    " " +
    (my + mh) +
    " L " +
    (mx + footR) +
    " " +
    (my + mh) +
    " Q " +
    mx +
    " " +
    (my + mh) +
    " " +
    mx +
    " " +
    (my + mh - footR) +
    " Z";

  g.appendChild(
    el("path", {
      d: bedPath,
      fill: "url(#rich-bedding)",
      stroke: INK,
      "stroke-width": "0.85",
      filter: SHADOW_FILTER,
    })
  );

  g.appendChild(
    el("ellipse", {
      cx: String(mx + footR * 0.55),
      cy: String(my + mh),
      rx: String(footR * 0.32),
      ry: String(footR * 0.22),
      fill: "url(#rich-bedding)",
      stroke: INK,
      "stroke-width": "0.6",
    })
  );
  g.appendChild(
    el("ellipse", {
      cx: String(mx + mw - footR * 0.55),
      cy: String(my + mh),
      rx: String(footR * 0.32),
      ry: String(footR * 0.22),
      fill: "url(#rich-bedding)",
      stroke: INK,
      "stroke-width": "0.6",
    })
  );

  var foldY = my + mh * 0.155;
  var foldH = mh * 0.065;
  g.appendChild(
    el("rect", {
      x: String(mx + 3),
      y: String(foldY),
      width: String(mw - 6),
      height: String(foldH),
      fill: "#f6f5f1",
      stroke: INK_LIGHT,
      "stroke-width": "0.45",
      rx: "1",
    })
  );
  g.appendChild(
    el("line", {
      x1: String(mx + 4),
      y1: String(foldY + foldH),
      x2: String(mx + mw - 4),
      y2: String(foldY + foldH),
      stroke: INK_LIGHT,
      "stroke-width": "0.4",
      opacity: "0.65",
    })
  );

  var pw = mw * 0.265;
  var ph = mh * 0.095;
  var py = my + mh * 0.038;
  [-0.265, 0.265].forEach(function (frac) {
    var px = mx + mw * 0.5 + frac * mw - pw / 2;
    g.appendChild(
      el("rect", {
        x: String(px),
        y: String(py),
        width: String(pw),
        height: String(ph),
        rx: String(ph * 0.42),
        fill: "url(#rich-bedding)",
        stroke: INK,
        "stroke-width": "0.7",
        filter: SHADOW_SOFT,
      })
    );
  });
}

export function appendRichToilet(g, w, h) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  var s = Math.min(w, h);
  g.appendChild(el("ellipse", { cx: "0", cy: String(s * 0.08), rx: String(s * 0.38), ry: String(s * 0.32), fill: "#ffffff", stroke: "#999", "stroke-width": "1.2" }));
  g.appendChild(el("rect", { x: String(-s * 0.22), y: String(-s * 0.42), width: String(s * 0.44), height: String(s * 0.28), rx: "3", fill: "#f5f5f5", stroke: "#999", "stroke-width": "1" }));
}

export function appendRichBathtub(g, w, h) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(el("rect", { x: String(-w / 2), y: String(-h / 2), width: String(w), height: String(h), rx: String(Math.min(w, h) * 0.12), fill: "#f8fcff", stroke: "#9bb", "stroke-width": "1.2" }));
  g.appendChild(el("ellipse", { cx: "0", cy: "0", rx: String(w * 0.32), ry: String(h * 0.22), fill: "#e8f4fa", stroke: "#aac", "stroke-width": "0.8" }));
}

export function appendRichSink(g, w, h) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(el("rect", { x: String(-w / 2), y: String(-h / 2), width: String(w), height: String(h), rx: "4", fill: "#f5f5f5", stroke: "#bbb", "stroke-width": "1" }));
  g.appendChild(el("ellipse", { cx: "0", cy: String(h * 0.05), rx: String(w * 0.28), ry: String(h * 0.22), fill: "#ffffff", stroke: "#aaa", "stroke-width": "1" }));
}

export function appendRichDesk(g, w, h) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(el("rect", { x: String(-w / 2), y: String(-h / 2), width: String(w), height: String(h), rx: "3", fill: "url(#rich-wood-grain)", stroke: "#6d4c2e", "stroke-width": "1.2" }));
  g.appendChild(el("rect", { x: String(-w * 0.08), y: String(h / 2 - h * 0.08), width: String(w * 0.16), height: String(h * 0.22), fill: "#8a6848", stroke: "#5c4030", "stroke-width": "0.8" }));
}

export function appendRichKitchenIsland(g, w, h) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(el("rect", { x: String(-w / 2), y: String(-h / 2), width: String(w), height: String(h), rx: "4", fill: "#e8e4dc", stroke: "#999", "stroke-width": "1.2" }));
  g.appendChild(el("rect", { x: String(-w / 2 + 4), y: String(-h / 2 + 4), width: String(w - 8), height: String(h * 0.35), rx: "2", fill: "#d4cfc4", stroke: "#aaa", "stroke-width": "0.8" }));
  g.appendChild(el("circle", { cx: String(-w * 0.25), cy: String(h * 0.15), r: String(Math.min(w, h) * 0.04), fill: "#888" }));
  g.appendChild(el("circle", { cx: String(w * 0.25), cy: String(h * 0.15), r: String(Math.min(w, h) * 0.04), fill: "#888" }));
}

export function appendRichPlant(g, w, h, variant) {
  var s = Math.min(w, h);
  var potRy = s * 0.14;
  var potRx = s * 0.2;

  g.appendChild(
    el("ellipse", {
      cx: "0",
      cy: String(potRy * 0.55),
      rx: String(potRx),
      ry: String(potRy),
      fill: "#b87848",
      stroke: INK_MED,
      "stroke-width": "0.75",
      filter: SHADOW_FILTER,
    })
  );
  g.appendChild(
    el("ellipse", {
      cx: "0",
      cy: String(potRy * 0.35),
      rx: String(potRx * 0.88),
      ry: String(potRy * 0.55),
      fill: "#a86838",
      stroke: INK_MED,
      "stroke-width": "0.55",
    })
  );

  var leafSets = {
    plant_0: [
      { cx: 0, cy: -s * 0.22, rx: s * 0.28, ry: s * 0.18, rot: 0, fill: "url(#rich-leaf-a)" },
      { cx: -s * 0.2, cy: -s * 0.08, rx: s * 0.2, ry: s * 0.14, rot: -35, fill: "#5a9038" },
      { cx: s * 0.18, cy: -s * 0.1, rx: s * 0.19, ry: s * 0.13, rot: 30, fill: "#62a040" },
    ],
    plant_1: [
      { cx: 0, cy: -s * 0.28, rx: s * 0.16, ry: s * 0.32, rot: 0, fill: "#4a8830" },
      { cx: -s * 0.12, cy: -s * 0.15, rx: s * 0.14, ry: s * 0.28, rot: -18, fill: "#5a9840" },
      { cx: s * 0.1, cy: -s * 0.12, rx: s * 0.13, ry: s * 0.26, rot: 15, fill: "#549038" },
    ],
    plant_2: [
      { cx: 0, cy: -s * 0.2, rx: s * 0.32, ry: s * 0.22, rot: 0, fill: "url(#rich-leaf-a)" },
      { cx: -s * 0.24, cy: -s * 0.02, rx: s * 0.18, ry: s * 0.12, rot: -20, fill: "#588836" },
      { cx: s * 0.22, cy: -s * 0.04, rx: s * 0.17, ry: s * 0.11, rot: 22, fill: "#6aa044" },
      { cx: 0, cy: -s * 0.35, rx: s * 0.12, ry: s * 0.1, rot: 0, fill: "#4a7830" },
    ],
    plant_3: [
      { cx: -s * 0.08, cy: -s * 0.18, rx: s * 0.22, ry: s * 0.16, rot: -10, fill: "#5c9438" },
      { cx: s * 0.12, cy: -s * 0.22, rx: s * 0.2, ry: s * 0.15, rot: 25, fill: "url(#rich-leaf-a)" },
      { cx: -s * 0.18, cy: -s * 0.06, rx: s * 0.15, ry: s * 0.11, rot: -40, fill: "#508030" },
      { cx: s * 0.06, cy: -s * 0.34, rx: s * 0.14, ry: s * 0.1, rot: 5, fill: "#68a042" },
    ],
  };
  var leaves = leafSets[variant] || leafSets.plant_0;
  leaves.forEach(function (lf) {
    var lg = el("g", {
      transform: "translate(" + lf.cx + " " + lf.cy + ") rotate(" + lf.rot + ")",
      filter: SHADOW_SOFT,
    });
    lg.appendChild(
      el("ellipse", {
        cx: "0",
        cy: "0",
        rx: String(lf.rx),
        ry: String(lf.ry),
        fill: lf.fill,
        stroke: "#3a6028",
        "stroke-width": "0.45",
        opacity: "0.94",
      })
    );
    g.appendChild(lg);
  });
}

export function appendCatalogPhotoIcon(g, w, h, href) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(
    el("image", {
      href: href,
      x: String(-w / 2),
      y: String(-h / 2),
      width: String(w),
      height: String(h),
      preserveAspectRatio: "xMidYMid meet",
      opacity: "0.94",
    })
  );
}

export function appendGlbBakedIcon(g, w, h, dataUrl) {
  g.setAttribute("filter", "url(#furniture-rich-shadow)");
  g.appendChild(
    el("image", {
      href: dataUrl,
      x: String(-w / 2),
      y: String(-h / 2),
      width: String(w),
      height: String(h),
      preserveAspectRatio: "xMidYMid meet",
    })
  );
}
