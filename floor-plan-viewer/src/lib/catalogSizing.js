import { snapFurnitureFromWalls } from "./wallSnap.js";
import { parseSofaColor, sofaColorLabel } from "./sofaColors.js";

/** ~96 DPI at 1:100 when calibration JSON is missing */
export var DEFAULT_MM_PER_PX = 1 / 3.78;

export function mmToPx(mm, mmPerPixel) {
  if (mm == null || !isFinite(mm)) return null;
  var mpp = mmPerPixel != null && mmPerPixel > 0 ? mmPerPixel : DEFAULT_MM_PER_PX;
  return mm / mpp;
}

export function mmToNormalized(mm, mmPerPixel, planDimPx) {
  if (planDimPx == null || planDimPx < 1) return null;
  var px = mmToPx(mm, mmPerPixel);
  if (px == null) return null;
  return px / planDimPx;
}

function shapeFromCategory(category) {
  var c = String(category || "").toLowerCase();
  if (c.indexOf("sofa") >= 0 || c.indexOf("lounge") >= 0) return "sofa";
  if (c.indexOf("stool") >= 0 || c.indexOf("chair") >= 0 || c.indexOf("arm") >= 0) return "chair";
  if (c.indexOf("table") >= 0 || c.indexOf("dining") >= 0) return "table";
  return "chair";
}

export function isSofaCatalogRow(row) {
  if (!row) return false;
  return shapeFromCategory(row.category) === "sofa";
}

export function parseSofaParams(keywords, productName) {
  var k = String(keywords || "").toLowerCase();
  var seats = 2;
  if (k.indexOf("single") >= 0) seats = 1;
  else if (k.indexOf("double") >= 0) seats = 2;
  else {
    var seatMatch = k.match(/(\d+)\s*seater/);
    if (seatMatch) seats = parseInt(seatMatch[1], 10) || 2;
  }
  seats = Math.max(1, Math.min(6, seats));
  var hasLounge = k.indexOf("lounge") >= 0 || k.indexOf("chaise") >= 0 || k.indexOf("sectional") >= 0;
  var hasArm = k.indexOf("no arm") < 0 && k.indexOf("armless") < 0;
  var params = { seats: seats, hasLounge: hasLounge, hasArm: hasArm };
  var color = parseSofaColor(keywords, productName);
  if (color) params.color = color;
  return params;
}

export function catalogById(catalog, id) {
  if (!catalog || !id) return null;
  for (var i = 0; i < catalog.length; i++) {
    if (String(catalog[i].id) === String(id)) return catalog[i];
  }
  return null;
}

export function formatCatalogDimensionsLabel(row, item) {
  if (!row) return "";
  var name =
    row.name ||
    (row.product_name && row.product_code
      ? row.product_name + " · " + row.product_code
      : String(row.id || row.product_code || "SKU"));
  var w = row.width_mm;
  var d = row.depth_mm;
  var colorNote = "";
  if (isSofaCatalogRow(row)) {
    var colorId =
      (item && item.sofaColorOverride) ||
      (item && item.sofaParams && item.sofaParams.color) ||
      parseSofaColor(row.keywords, row.product_name);
    if (colorId) colorNote = " · " + sofaColorLabel(colorId);
  }
  if (w != null && d != null) return name + " — " + Math.round(w) + " × " + Math.round(d) + " mm" + colorNote;
  if (w != null) return name + " — W " + Math.round(w) + " mm" + colorNote;
  if (d != null) return name + " — D " + Math.round(d) + " mm" + colorNote;
  return name + " — dimensions N/A" + colorNote;
}

/**
 * Apply DB SKU to selected furniture: real mm size, type/icon, wall snap.
 */
export function applyCatalogSkuToItem(item, catalogRow, ctx) {
  if (!item || !catalogRow) return item;

  var planW = ctx.planWidthPx > 0 ? ctx.planWidthPx : 1000;
  var planH = ctx.planHeightPx > 0 ? ctx.planHeightPx : 1000;
  var mpp = ctx.mmPerPixel;

  var widthMm = catalogRow.width_mm;
  var depthMm = catalogRow.depth_mm;

  if (widthMm == null && depthMm == null) {
    console.warn(
      "[catalog] SKU " + (catalogRow.id || catalogRow.product_code) + " has no width_mm/depth_mm"
    );
  } else {
    if (widthMm != null) {
      var wn = mmToNormalized(widthMm, mpp, planW);
      if (wn != null) item.width = wn;
    }
    if (depthMm != null) {
      var hn = mmToNormalized(depthMm, mpp, planH);
      if (hn != null) item.height = hn;
    }
  }

  item.catalogId = catalogRow.id || catalogRow.product_code;
  item.type = shapeFromCategory(catalogRow.category);
  item.shape = item.type;
  delete item.scale;

  if (isSofaCatalogRow(catalogRow)) {
    item.sofaParams = parseSofaParams(catalogRow.keywords, catalogRow.product_name);
    if (item.sofaColorOverride) {
      item.sofaParams.color = item.sofaColorOverride;
    }
  } else {
    delete item.sofaParams;
    delete item.sofaColorOverride;
  }

  snapFurnitureFromWalls(item, ctx.walls || [], planW, planH, ctx.rooms || []);
  return item;
}

function itemWidthNorm(it) {
  return it.width != null ? it.width : it.scale != null ? it.scale : 0.06;
}

function itemHeightNorm(it) {
  return it.height != null ? it.height : it.depth != null ? it.depth : itemWidthNorm(it);
}

/** Prefer selected SKU when it is a sofa; otherwise first sofa in catalog. */
export function findSofaCatalogRow(catalog, preferId) {
  var row = preferId ? catalogById(catalog, preferId) : null;
  if (row && isSofaCatalogRow(row)) return row;
  for (var i = 0; i < (catalog || []).length; i++) {
    if (isSofaCatalogRow(catalog[i])) return catalog[i];
  }
  return null;
}

/**
 * New furniture piece beside anchor (tries right, left, below, above).
 */
export function createFurnitureNearItem(anchor, catalogRow, ctx, opts) {
  if (!anchor || !catalogRow) return null;
  opts = opts || {};
  var planW = ctx.planWidthPx > 0 ? ctx.planWidthPx : 1000;
  var planH = ctx.planHeightPx > 0 ? ctx.planHeightPx : 1000;
  var gap = opts.gap != null ? opts.gap : 0.015;
  var dirs = opts.directions || ["right", "left", "below", "above"];

  var item = {
    id: opts.id || "f-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    x: anchor.x,
    y: anchor.y,
    rotationDeg: anchor.rotationDeg != null ? anchor.rotationDeg : anchor.rotation || 0,
    zIndex: (anchor.zIndex != null ? anchor.zIndex : 0) + 1,
  };
  applyCatalogSkuToItem(item, catalogRow, ctx);

  var aw = itemWidthNorm(anchor);
  var ah = itemHeightNorm(anchor);
  var nw = itemWidthNorm(item);
  var nh = itemHeightNorm(item);

  function offsetFor(dir) {
    if (dir === "right") return { dx: aw / 2 + nw / 2 + gap, dy: 0 };
    if (dir === "left") return { dx: -(aw / 2 + nw / 2 + gap), dy: 0 };
    if (dir === "below") return { dx: 0, dy: ah / 2 + nh / 2 + gap };
    if (dir === "above") return { dx: 0, dy: -(ah / 2 + nh / 2 + gap) };
    return { dx: 0, dy: 0 };
  }

  function inBounds(candidate) {
    var hw = nw / 2;
    var hd = nh / 2;
    return (
      candidate.x >= hw &&
      candidate.x <= 1 - hw &&
      candidate.y >= hd &&
      candidate.y <= 1 - hd
    );
  }

  for (var d = 0; d < dirs.length; d++) {
    var off = offsetFor(dirs[d]);
    var placed = Object.assign({}, item, {
      x: anchor.x + off.dx,
      y: anchor.y + off.dy,
    });
    snapFurnitureFromWalls(placed, ctx.walls || [], planW, planH, ctx.rooms || []);
    if (inBounds(placed)) return placed;
  }

  var fallbackOff = offsetFor("right");
  item.x = anchor.x + fallbackOff.dx;
  item.y = anchor.y + fallbackOff.dy;
  snapFurnitureFromWalls(item, ctx.walls || [], planW, planH, ctx.rooms || []);
  return item;
}
