/**
 * Unified 2D furniture icon rendering for svgRenderer.
 */
import { parseSofaParams } from "../lib/catalogSizing.js";
import { inferFurnitureIcon, pickPlantVariant } from "../lib/inferFurnitureIcon.js";
import { getCachedGlbTopDownUrl, DEFAULT_SOFA_GLB_URL } from "./glbTopDownBake.js";
import {
  appendRichAreaRug,
  appendRichCoffeeTable,
  appendRichSideTable,
  appendRichSofa,
  appendRichBed,
  appendRichBathtub,
  appendRichDesk,
  appendRichDiningTable,
  appendRichKitchenIsland,
  appendRichPlant,
  appendRichSink,
  appendRichToilet,
  appendCatalogPhotoIcon,
  appendGlbBakedIcon,
  ensureRichFurnitureDefs,
} from "./richFurnitureIcons.js";
import { getSofaPalette } from "../lib/sofaColors.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag) {
  return document.createElementNS(NS, tag);
}

function setAttrs(el, attrs) {
  Object.keys(attrs).forEach(function (key) {
    if (attrs[key] !== undefined && attrs[key] !== null) el.setAttribute(key, String(attrs[key]));
  });
  return el;
}

function catalogPhotoUrl(row, item) {
  if (item && item.imageUrl) return item.imageUrl;
  if (row && row.image_2d_url) return row.image_2d_url;
  if (row && row.image_url) return row.image_url;
  if (row && row.plan2d_photo_url) return row.plan2d_photo_url;
  return null;
}

function shouldUseCatalogPhoto(row, item, inferred) {
  if (item && item.iconMode === "photo") return true;
  if (item && item.iconMode === "svg") return false;
  if (inferred && inferred.useGlbBake && getCachedGlbTopDownUrl(2.2, 0.95)) return false;
  var cat = row && row.category ? String(row.category).toLowerCase() : "";
  return cat.indexOf("sofa") >= 0 && !!catalogPhotoUrl(row, item);
}

/** Legacy parametric sofa fallback. */
function renderLegacySofa(g, w, h, opts) {
  var seats = (opts && opts.seats) || 2;
  var pal = getSofaPalette(opts && opts.color);
  var backH = h * 0.25;
  var bodyW = w;
  g.appendChild(setAttrs(svgEl("rect"), { x: -bodyW / 2, y: -h / 2, width: bodyW, height: backH, fill: pal.back, stroke: pal.stroke, rx: 3 }));
  g.appendChild(setAttrs(svgEl("rect"), { x: -bodyW / 2 + 4, y: -h / 2 + backH, width: bodyW - 8, height: h - backH - 4, fill: pal.seat, stroke: pal.stroke, rx: 4 }));
  var cushionW = (bodyW - 16) / Math.max(1, seats);
  for (var i = 0; i < seats; i++) {
    g.appendChild(
      setAttrs(svgEl("rect"), {
        x: -bodyW / 2 + 8 + i * cushionW,
        y: -h / 2 + backH + 4,
        width: cushionW - 3,
        height: h - backH - 12,
        fill: pal.cushion,
        stroke: pal.stroke,
        rx: 3,
      })
    );
  }
}

/**
 * @param {SVGGElement} g
 * @param {object} item
 * @param {{ w: number, h: number }} box
 * @param {object|null} catalogRow
 * @param {SVGDefsElement} defs
 */
export function appendFurniture2dIcon(g, item, box, catalogRow, defs) {
  ensureRichFurnitureDefs(defs);
  var w = box.w;
  var h = box.h;
  var inferred = inferFurnitureIcon(catalogRow, item);
  if (item && item.richIcon) inferred.icon = item.richIcon;
  if (item && item.chairCount) inferred.chairCount = item.chairCount;
  if (item && item.sofaSeats) inferred.seats = item.sofaSeats;

  var preferRichSofa =
    inferred.icon === "sofa" &&
    (item.richIcon === "sofa" ||
      item.richIcon === "sofa_1" ||
      item.richIcon === "sofa_2" ||
      item.richIcon === "sofa_3" ||
      item.iconMode === "svg" ||
      !item.useGlbBake);

  var useGlb =
    !preferRichSofa &&
    ((item && item.useGlbBake) ||
      (inferred.useGlbBake && !item.richIcon) ||
      (item && item.iconSource === "glb-sofa"));
  if (useGlb) {
    var wM = (catalogRow && catalogRow.width_mm ? catalogRow.width_mm : inferred.defaultMm.w) / 1000;
    var dM = (catalogRow && catalogRow.depth_mm ? catalogRow.depth_mm : inferred.defaultMm.d) / 1000;
    var baked = getCachedGlbTopDownUrl(Math.max(wM, 1.8), Math.max(dM, 0.85));
    if (baked) {
      appendGlbBakedIcon(g, w, h, baked);
      return;
    }
  }

  if (shouldUseCatalogPhoto(catalogRow, item, inferred)) {
    appendCatalogPhotoIcon(g, w, h, catalogPhotoUrl(catalogRow, item));
    return;
  }

  switch (inferred.icon) {
    case "dining_table":
      appendRichDiningTable(
        g,
        w,
        h,
        inferred.chairCount || item.chairs || 8,
        item.rotationDeg != null ? item.rotationDeg : item.rotation || 0
      );
      break;
    case "bed":
      appendRichBed(g, w, h);
      break;
    case "toilet":
      appendRichToilet(g, w, h);
      break;
    case "bathtub":
      appendRichBathtub(g, w, h);
      break;
    case "plant":
      appendRichPlant(g, w, h, item.plantVariant || pickPlantVariant(item.id || item.x + item.y));
      break;
    case "sink":
      appendRichSink(g, w, h);
      break;
    case "desk":
      appendRichDesk(g, w, h);
      break;
    case "kitchen_island":
      appendRichKitchenIsland(g, w, h);
      break;
    case "area_rug":
      appendRichAreaRug(g, w, h);
      break;
    case "coffee_table":
      appendRichCoffeeTable(g, w, h);
      break;
    case "side_table":
      appendRichSideTable(g, w, h, !!(item && item.sideTablePlant));
      break;
    case "sofa":
    case "sofa_1":
    case "sofa_2":
    case "sofa_3": {
      var seatMap = { sofa_1: 1, sofa_2: 2, sofa_3: 3 };
      var richSeats =
        seatMap[inferred.icon] ||
        item.sofaSeats ||
        inferred.seats ||
        (item.sofaParams && item.sofaParams.seats) ||
        2;
      appendRichSofa(
        g,
        w,
        h,
        richSeats,
        item.rotationDeg != null ? item.rotationDeg : item.rotation || 0
      );
      break;
    }
    default:
      appendRichPlant(g, w, h, "plant_0");
  }
}

export { DEFAULT_SOFA_GLB_URL };
