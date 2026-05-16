const NS = "http://www.w3.org/2000/svg";

/** Palette matched to the apartment plan (tan zones, brown walls/wood, white beds, grey living). */
var APT = {
  wall: "#3d2817",
  wood: "#8d6e53",
  woodDeep: "#6d4c41",
  white: "#faf9f6",
  pillow: "#eae8e4",
  greyLight: "#c5c5c5",
  sofa: "#3a3a3a",
  media: "#4f4f4f",
  counter: "#e8e8e6",
  burner: "#2a2a2a",
  bathBlue: "#9ec9ea",
  toilet: "#ffffff",
  stroke: "#2c241c",
};

function addKnobs(g, x0, y0, w, h, count) {
  var step = w / (count + 1);
  for (var i = 1; i <= count; i++) {
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", String(x0 + step * i));
    c.setAttribute("cy", String(y0 + h / 2));
    c.setAttribute("r", "0.022");
    c.setAttribute("fill", "#8a8a8a");
    c.setAttribute("stroke", APT.stroke);
    c.setAttribute("stroke-width", "0.004");
    g.appendChild(c);
  }
}

function appendApartmentBedroomSuite(g) {
  var head = document.createElementNS(NS, "rect");
  head.setAttribute("x", "-0.38");
  head.setAttribute("y", "-0.32");
  head.setAttribute("width", "0.76");
  head.setAttribute("height", "0.1");
  head.setAttribute("rx", "0.02");
  head.setAttribute("fill", APT.woodDeep);
  head.setAttribute("stroke", APT.stroke);
  head.setAttribute("stroke-width", "0.006");
  g.appendChild(head);

  var nsL = document.createElementNS(NS, "rect");
  nsL.setAttribute("x", "-0.46");
  nsL.setAttribute("y", "-0.22");
  nsL.setAttribute("width", "0.1");
  nsL.setAttribute("height", "0.12");
  nsL.setAttribute("rx", "0.02");
  nsL.setAttribute("fill", APT.wood);
  nsL.setAttribute("stroke", APT.stroke);
  nsL.setAttribute("stroke-width", "0.005");
  g.appendChild(nsL);

  var nsR = document.createElementNS(NS, "rect");
  nsR.setAttribute("x", "0.36");
  nsR.setAttribute("y", "-0.22");
  nsR.setAttribute("width", "0.1");
  nsR.setAttribute("height", "0.12");
  nsR.setAttribute("rx", "0.02");
  nsR.setAttribute("fill", APT.wood);
  nsR.setAttribute("stroke", APT.stroke);
  nsR.setAttribute("stroke-width", "0.005");
  g.appendChild(nsR);

  var mattress = document.createElementNS(NS, "rect");
  mattress.setAttribute("x", "-0.34");
  mattress.setAttribute("y", "-0.2");
  mattress.setAttribute("width", "0.68");
  mattress.setAttribute("height", "0.36");
  mattress.setAttribute("rx", "0.04");
  mattress.setAttribute("fill", APT.white);
  mattress.setAttribute("stroke", APT.stroke);
  mattress.setAttribute("stroke-width", "0.007");
  g.appendChild(mattress);

  var p1 = document.createElementNS(NS, "ellipse");
  p1.setAttribute("cx", "-0.12");
  p1.setAttribute("cy", "-0.08");
  p1.setAttribute("rx", "0.1");
  p1.setAttribute("ry", "0.07");
  p1.setAttribute("fill", APT.pillow);
  p1.setAttribute("stroke", APT.stroke);
  p1.setAttribute("stroke-width", "0.004");
  g.appendChild(p1);

  var p2 = document.createElementNS(NS, "ellipse");
  p2.setAttribute("cx", "0.12");
  p2.setAttribute("cy", "-0.08");
  p2.setAttribute("rx", "0.1");
  p2.setAttribute("ry", "0.07");
  p2.setAttribute("fill", APT.pillow);
  p2.setAttribute("stroke", APT.stroke);
  p2.setAttribute("stroke-width", "0.004");
  g.appendChild(p2);

  var dresser = document.createElementNS(NS, "rect");
  dresser.setAttribute("x", "-0.36");
  dresser.setAttribute("y", "0.22");
  dresser.setAttribute("width", "0.72");
  dresser.setAttribute("height", "0.14");
  dresser.setAttribute("rx", "0.02");
  dresser.setAttribute("fill", APT.greyLight);
  dresser.setAttribute("stroke", APT.stroke);
  dresser.setAttribute("stroke-width", "0.006");
  g.appendChild(dresser);
  addKnobs(g, -0.36, 0.22, 0.72, 0.14, 6);
}

function appendChairBrown(g, cx, cy, angDeg) {
  var gr = document.createElementNS(NS, "g");
  gr.setAttribute("transform", "translate(" + cx + " " + cy + ") rotate(" + angDeg + ")");
  var seat = document.createElementNS(NS, "rect");
  seat.setAttribute("x", "-0.07");
  seat.setAttribute("y", "-0.07");
  seat.setAttribute("width", "0.14");
  seat.setAttribute("height", "0.14");
  seat.setAttribute("rx", "0.04");
  seat.setAttribute("fill", APT.wood);
  seat.setAttribute("stroke", APT.stroke);
  seat.setAttribute("stroke-width", "0.005");
  gr.appendChild(seat);
  g.appendChild(gr);
}

function appendApartmentDining4(g) {
  var tbl = document.createElementNS(NS, "rect");
  tbl.setAttribute("x", "-0.16");
  tbl.setAttribute("y", "-0.16");
  tbl.setAttribute("width", "0.32");
  tbl.setAttribute("height", "0.32");
  tbl.setAttribute("rx", "0.03");
  tbl.setAttribute("fill", APT.wood);
  tbl.setAttribute("stroke", APT.stroke);
  tbl.setAttribute("stroke-width", "0.007");
  g.appendChild(tbl);
  appendChairBrown(g, 0, -0.26, 0);
  appendChairBrown(g, 0.26, 0, 90);
  appendChairBrown(g, 0, 0.26, 180);
  appendChairBrown(g, -0.26, 0, -90);
}

function appendKitchenCounterStove(g) {
  var ctr = document.createElementNS(NS, "rect");
  ctr.setAttribute("x", "-0.35");
  ctr.setAttribute("y", "-0.12");
  ctr.setAttribute("width", "0.7");
  ctr.setAttribute("height", "0.22");
  ctr.setAttribute("rx", "0.02");
  ctr.setAttribute("fill", APT.counter);
  ctr.setAttribute("stroke", APT.stroke);
  ctr.setAttribute("stroke-width", "0.006");
  g.appendChild(ctr);
  var b1 = document.createElementNS(NS, "circle");
  b1.setAttribute("cx", "-0.12");
  b1.setAttribute("cy", "-0.02");
  b1.setAttribute("r", "0.045");
  b1.setAttribute("fill", "none");
  b1.setAttribute("stroke", APT.burner);
  b1.setAttribute("stroke-width", "0.012");
  g.appendChild(b1);
  var b2 = document.createElementNS(NS, "circle");
  b2.setAttribute("cx", "0.12");
  b2.setAttribute("cy", "-0.02");
  b2.setAttribute("r", "0.045");
  b2.setAttribute("fill", "none");
  b2.setAttribute("stroke", APT.burner);
  b2.setAttribute("stroke-width", "0.012");
  g.appendChild(b2);
}

function appendKitchenTable2(g) {
  var tbl = document.createElementNS(NS, "rect");
  tbl.setAttribute("x", "-0.1");
  tbl.setAttribute("y", "-0.1");
  tbl.setAttribute("width", "0.2");
  tbl.setAttribute("height", "0.2");
  tbl.setAttribute("rx", "0.03");
  tbl.setAttribute("fill", APT.wood);
  tbl.setAttribute("stroke", APT.stroke);
  tbl.setAttribute("stroke-width", "0.006");
  g.appendChild(tbl);
  appendChairBrown(g, 0, -0.2, 0);
  appendChairBrown(g, 0, 0.2, 180);
}

function appendLivingSofa(g) {
  var body = document.createElementNS(NS, "rect");
  body.setAttribute("x", "-0.4");
  body.setAttribute("y", "-0.12");
  body.setAttribute("width", "0.8");
  body.setAttribute("height", "0.24");
  body.setAttribute("rx", "0.06");
  body.setAttribute("fill", APT.sofa);
  body.setAttribute("stroke", APT.stroke);
  body.setAttribute("stroke-width", "0.007");
  g.appendChild(body);
  var back = document.createElementNS(NS, "rect");
  back.setAttribute("x", "-0.4");
  back.setAttribute("y", "-0.2");
  back.setAttribute("width", "0.8");
  back.setAttribute("height", "0.1");
  back.setAttribute("rx", "0.04");
  back.setAttribute("fill", "#2e2e2e");
  back.setAttribute("stroke", APT.stroke);
  back.setAttribute("stroke-width", "0.005");
  g.appendChild(back);
}

function appendLivingMediaBench(g) {
  var m = document.createElementNS(NS, "rect");
  m.setAttribute("x", "-0.22");
  m.setAttribute("y", "-0.1");
  m.setAttribute("width", "0.44");
  m.setAttribute("height", "0.2");
  m.setAttribute("rx", "0.03");
  m.setAttribute("fill", APT.media);
  m.setAttribute("stroke", APT.stroke);
  m.setAttribute("stroke-width", "0.006");
  g.appendChild(m);
}

function appendApartmentBath(g) {
  var shower = document.createElementNS(NS, "rect");
  shower.setAttribute("x", "-0.18");
  shower.setAttribute("y", "0.02");
  shower.setAttribute("width", "0.36");
  shower.setAttribute("height", "0.28");
  shower.setAttribute("rx", "0.03");
  shower.setAttribute("fill", APT.bathBlue);
  shower.setAttribute("stroke", APT.stroke);
  shower.setAttribute("stroke-width", "0.006");
  g.appendChild(shower);
  var bowl = document.createElementNS(NS, "ellipse");
  bowl.setAttribute("cx", "0");
  bowl.setAttribute("cy", "-0.18");
  bowl.setAttribute("rx", "0.08");
  bowl.setAttribute("ry", "0.1");
  bowl.setAttribute("fill", APT.toilet);
  bowl.setAttribute("stroke", APT.stroke);
  bowl.setAttribute("stroke-width", "0.005");
  g.appendChild(bowl);
}

/** Legacy / generic shapes */
var PAL = {
  wood: "#c4a882",
  woodSide: "#a68968",
  fabric: "#aeb6b8",
  fabricDeep: "#8f9799",
  island: "#f5e6bc",
  islandTop: "#faf3e0",
  stroke: "#1e1b18",
  cushion: "#d0d4d6",
};

function appendSofa(g) {
  var body = document.createElementNS(NS, "rect");
  body.setAttribute("x", "-0.42");
  body.setAttribute("y", "-0.14");
  body.setAttribute("width", "0.84");
  body.setAttribute("height", "0.28");
  body.setAttribute("rx", "0.05");
  body.setAttribute("fill", PAL.fabric);
  body.setAttribute("stroke", PAL.stroke);
  body.setAttribute("stroke-width", "0.008");
  g.appendChild(body);
  var back = document.createElementNS(NS, "rect");
  back.setAttribute("x", "-0.42");
  back.setAttribute("y", "-0.2");
  back.setAttribute("width", "0.84");
  back.setAttribute("height", "0.08");
  back.setAttribute("rx", "0.03");
  back.setAttribute("fill", PAL.fabricDeep);
  back.setAttribute("stroke", PAL.stroke);
  back.setAttribute("stroke-width", "0.006");
  g.appendChild(back);
}

function appendBed(g) {
  var mattress = document.createElementNS(NS, "rect");
  mattress.setAttribute("x", "-0.35");
  mattress.setAttribute("y", "-0.2");
  mattress.setAttribute("width", "0.7");
  mattress.setAttribute("height", "0.4");
  mattress.setAttribute("rx", "0.04");
  mattress.setAttribute("fill", "#f5f5f0");
  mattress.setAttribute("stroke", PAL.stroke);
  mattress.setAttribute("stroke-width", "0.007");
  g.appendChild(mattress);
  var head = document.createElementNS(NS, "rect");
  head.setAttribute("x", "-0.35");
  head.setAttribute("y", "-0.26");
  head.setAttribute("width", "0.7");
  head.setAttribute("height", "0.08");
  head.setAttribute("rx", "0.02");
  head.setAttribute("fill", PAL.wood);
  head.setAttribute("stroke", PAL.stroke);
  head.setAttribute("stroke-width", "0.006");
  g.appendChild(head);
}

function appendIsland(g) {
  var base = document.createElementNS(NS, "rect");
  base.setAttribute("x", "-0.22");
  base.setAttribute("y", "-0.16");
  base.setAttribute("width", "0.44");
  base.setAttribute("height", "0.32");
  base.setAttribute("rx", "0.03");
  base.setAttribute("fill", PAL.island);
  base.setAttribute("stroke", PAL.stroke);
  base.setAttribute("stroke-width", "0.007");
  g.appendChild(base);
}

function appendTable(g) {
  var top = document.createElementNS(NS, "ellipse");
  top.setAttribute("cx", "0");
  top.setAttribute("cy", "0");
  top.setAttribute("rx", "0.2");
  top.setAttribute("ry", "0.14");
  top.setAttribute("fill", PAL.wood);
  top.setAttribute("stroke", PAL.stroke);
  top.setAttribute("stroke-width", "0.007");
  g.appendChild(top);
}

function appendChair(g) {
  var seat = document.createElementNS(NS, "rect");
  seat.setAttribute("x", "-0.14");
  seat.setAttribute("y", "-0.14");
  seat.setAttribute("width", "0.28");
  seat.setAttribute("height", "0.28");
  seat.setAttribute("rx", "0.08");
  seat.setAttribute("fill", PAL.fabric);
  seat.setAttribute("stroke", PAL.stroke);
  seat.setAttribute("stroke-width", "0.007");
  g.appendChild(seat);
}

/**
 * @param {SVGGElement} g parent group, centered; unit width ~1 before outer scale
 * @param {string} shapeKey
 */
export function appendVectorFurniture(g, shapeKey) {
  var key = shapeKey || "chair";
  if (key === "apartment_bedroom_suite") appendApartmentBedroomSuite(g);
  else if (key === "apartment_dining_4") appendApartmentDining4(g);
  else if (key === "apartment_kitchen_counter") appendKitchenCounterStove(g);
  else if (key === "apartment_kitchen_table2") appendKitchenTable2(g);
  else if (key === "apartment_living_sofa") appendLivingSofa(g);
  else if (key === "apartment_living_media") appendLivingMediaBench(g);
  else if (key === "apartment_bath") appendApartmentBath(g);
  else if (key === "sofa") appendSofa(g);
  else if (key === "bed") appendBed(g);
  else if (key === "island") appendIsland(g);
  else if (key === "table") appendTable(g);
  else appendChair(g);
}
