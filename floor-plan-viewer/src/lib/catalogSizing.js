import { snapFurnitureFromWalls } from "./wallSnap.js";
import { parseSofaColor, sofaColorLabel } from "./sofaColors.js";

/** Legacy fallback when plan size unknown (avoid tiny icons) */
export var DEFAULT_MM_PER_PX = 1 / 3.78;

/**
 * When JSON has no calibration, assume the plan bitmap spans ~12 m across its long edge.
 * @param {number} planWidthPx
 * @param {number} planHeightPx
 */
export function fallbackMmPerPixel(planWidthPx, planHeightPx) {
  var spanPx = Math.max(planWidthPx || 0, planHeightPx || 0);
  if (spanPx < 1) return DEFAULT_MM_PER_PX;
  var assumedPlanSpanMm = 12000;
  return assumedPlanSpanMm / spanPx;
}

export function effectiveMmPerPixel(ctx) {
  if (ctx && ctx.mmPerPixel != null && ctx.mmPerPixel > 0) return ctx.mmPerPixel;
  var w = ctx && ctx.planWidthPx > 0 ? ctx.planWidthPx : 1000;
  var h = ctx && ctx.planHeightPx > 0 ? ctx.planHeightPx : 1000;
  return fallbackMmPerPixel(w, h);
}

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
  if (c.indexOf("chair") >= 0 || c.indexOf("stool") >= 0 || c.indexOf("arm") >= 0) return "chair";
  if (c.indexOf("sofa") >= 0 || c.indexOf("lounge") >= 0) return "sofa";
  if (c.indexOf("table") >= 0 || c.indexOf("dining") >= 0) return "table";
  return "chair";
}

export function isSofaCatalogRow(row) {
  if (!row) return false;
  var ri = String(row.rich_icon || row.richIcon || "").toLowerCase();
  if (ri.indexOf("sofa") >= 0) return true;
  return shapeFromCategory(row.category) === "sofa";
}

export function isChairCatalogRow(row) {
  if (!row || isSofaCatalogRow(row)) return false;
  var ri = String(row.rich_icon || row.richIcon || "").toLowerCase();
  if (ri.indexOf("chair") >= 0) return true;
  if (shapeFromCategory(row.category) === "chair") return true;
  var k = String(row.keywords || row.product_name || row.name || "").toLowerCase();
  return (
    k.indexOf("chair") >= 0 ||
    k.indexOf("stool") >= 0 ||
    k.indexOf("armchair") >= 0 ||
    k.indexOf("dining chair") >= 0
  );
}

/** Shearling sofas, armchairs, stools, dining chairs, etc. */
export function isSeatingCatalogRow(row) {
  return isSofaCatalogRow(row) || isChairCatalogRow(row);
}

export function filterSeatingCatalog(catalog) {
  return (catalog || []).filter(isSeatingCatalogRow);
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
  var sid = String(id);
  for (var i = 0; i < catalog.length; i++) {
    var row = catalog[i];
    if (String(row.id) === sid) return row;
    if (row.product_code && String(row.product_code) === sid) return row;
  }
  return null;
}

/**
 * Match furniture to a Shearling row (product_code). LLM ids are ignored unless they match DB.
 * @param {object} item
 * @param {Array<object>} catalog
 * @param {{ autoTypeDefault?: boolean }} opts
 */
export function resolveCatalogRowForItem(item, catalog, opts) {
  if (!item || !catalog || !catalog.length) return null;
  opts = opts || {};
  var row = catalogById(catalog, item.catalogId);
  if (row) return row;
  if (!opts.autoTypeDefault) return null;
  var t = String(item.type || item.shape || "").toLowerCase();
  if (t.indexOf("sofa") >= 0 || t.indexOf("couch") >= 0 || t.indexOf("lounge") >= 0) {
    return findSofaCatalogRow(catalog, null);
  }
  return null;
}

/**
 * Normalized width/height from catalog mm only (never LLM width/height/scale).
 * @returns {{ wNorm: number, hNorm: number }|null}
 */
export function furnitureNormDimensions(item, catalogRow, ctx) {
  if (!catalogRow) return null;
  var widthMm = catalogRow.width_mm != null ? catalogRow.width_mm : item.catalogWidthMm;
  var depthMm =
    catalogRow.depth_mm != null
      ? catalogRow.depth_mm
      : catalogRow.length_mm != null
        ? catalogRow.length_mm
        : item.catalogDepthMm;
  if (widthMm == null && depthMm == null) return null;

  var planW = ctx.planWidthPx > 0 ? ctx.planWidthPx : 1000;
  var planH = ctx.planHeightPx > 0 ? ctx.planHeightPx : 1000;
  var mpp = effectiveMmPerPixel(ctx);

  var wNorm = widthMm != null ? mmToNormalized(widthMm, mpp, planW) : null;
  var hNorm = depthMm != null ? mmToNormalized(depthMm, mpp, planH) : null;
  if (wNorm == null && hNorm == null) return null;
  if (wNorm == null) wNorm = hNorm;
  if (hNorm == null) hNorm = wNorm;
  return {
    wNorm: Math.min(0.85, Math.max(0.004, wNorm)),
    hNorm: Math.min(0.85, Math.max(0.004, hNorm)),
  };
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

  var widthMm = catalogRow.width_mm;
  var depthMm =
    catalogRow.depth_mm != null ? catalogRow.depth_mm : catalogRow.length_mm;

  delete item.scale;
  delete item.depth;
  delete item.width;
  delete item.height;

  if (widthMm == null && depthMm == null) {
    console.warn(
      "[catalog] SKU " + (catalogRow.id || catalogRow.product_code) + " has no width_mm/depth_mm"
    );
  } else {
    if (widthMm != null) item.catalogWidthMm = widthMm;
    if (depthMm != null) item.catalogDepthMm = depthMm;
    var dims = furnitureNormDimensions(
      item,
      { width_mm: widthMm, depth_mm: depthMm },
      ctx
    );
    if (dims) {
      item.width = dims.wNorm;
      item.height = dims.hNorm;
    }
  }

  item.catalogId = catalogRow.id || catalogRow.product_code;
  item.type = shapeFromCategory(catalogRow.category);
  item.shape = item.type;
  delete item.scale;

  if (isSofaCatalogRow(catalogRow)) {
    item.sofaParams = parseSofaParams(catalogRow.keywords, catalogRow.product_name);
    if (catalogRow.sofa_seats != null) item.sofaParams.seats = catalogRow.sofa_seats;
    if (item.sofaColorOverride) {
      item.sofaParams.color = item.sofaColorOverride;
    }
  } else {
    delete item.sofaParams;
    delete item.sofaColorOverride;
  }

  var richIcon =
    catalogRow.rich_icon ||
    catalogRow.richIcon ||
    (catalogRow.sofa_seats != null ? "sofa_" + catalogRow.sofa_seats : null);
  if (richIcon) {
    item.richIcon = richIcon;
    item.type = richIcon;
    item.shape = richIcon;
    delete item.useGlbBake;
    delete item.iconSource;
  }
  if (catalogRow.chair_count != null) item.chairCount = catalogRow.chair_count;
  if (catalogRow.sofa_seats != null) item.sofaSeats = catalogRow.sofa_seats;
  if (catalogRow.side_table_plant) item.sideTablePlant = true;
  else if (catalogRow.side_table_plant === false) delete item.sideTablePlant;

  snapFurnitureFromWalls(item, ctx.walls || [], planW, planH, ctx.rooms || []);
  return item;
}

function itemWidthNorm(it) {
  return it.width != null ? it.width : it.scale != null ? it.scale : 0.06;
}

function itemHeightNorm(it) {
  return it.height != null ? it.height : it.depth != null ? it.depth : itemWidthNorm(it);
}

/** Prefer selected SKU when it is seating; otherwise first sofa/chair in catalog. */
export function findSeatingCatalogRow(catalog, preferId) {
  var row = preferId ? catalogById(catalog, preferId) : null;
  if (row && isSeatingCatalogRow(row)) return row;
  for (var i = 0; i < (catalog || []).length; i++) {
    if (isSeatingCatalogRow(catalog[i])) return catalog[i];
  }
  return null;
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
