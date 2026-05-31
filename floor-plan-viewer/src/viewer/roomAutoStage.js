/**
 * Auto-stage furniture presets into room polygons (Drafted-style demo layout).
 */
import { polygonBBox } from "../lib/geometry.js";
import { inferFurnitureIcon, pickPlantVariant } from "../lib/inferFurnitureIcon.js";
import { catalogById } from "../lib/catalogSizing.js";

function roomName(room) {
  return String(room.type || room.name || room.id || "").toLowerCase();
}

function centroid(room) {
  if (room.labelPoint) return { x: room.labelPoint.x, y: room.labelPoint.y };
  var poly = room.polygon;
  if (!poly || !poly.length) return { x: 0.5, y: 0.5 };
  var sx = 0;
  var sy = 0;
  poly.forEach(function (p) {
    sx += p.x;
    sy += p.y;
  });
  return { x: sx / poly.length, y: sy / poly.length };
}

function clampInBBox(x, y, bbox, pad) {
  pad = pad || 0.08;
  return {
    x: Math.min(bbox.maxX - pad, Math.max(bbox.minX + pad, x)),
    y: Math.min(bbox.maxY - pad, Math.max(bbox.minY + pad, y)),
  };
}

function newId(prefix, n) {
  return prefix + "-" + n + "-" + Date.now().toString(36);
}

/**
 * @param {object} data plan JSON (mutated)
 * @param {Array} catalog
 * @param {{ replaceAuto?: boolean }} opts
 * @returns {number} items added
 */
export function autoStagePlan(data, catalog, opts) {
  opts = opts || {};
  var rooms = data.rooms || [];
  if (!rooms.length) return 0;

  if (opts.replaceAuto !== false) {
    data.furniture = (data.furniture || []).filter(function (f) {
      return f.stageSource !== "auto";
    });
  }

  var list = data.furniture || [];
  var seq = 0;

  rooms.forEach(function (room) {
    if (!room.polygon || room.polygon.length < 3) return;
    var name = roomName(room);
    var bb = polygonBBox(room.polygon);
    var c = centroid(room);
    var pad = 0.1;
    var bw = bb.maxX - bb.minX;
    var bh = bb.maxY - bb.minY;

    function add(partial) {
      seq++;
      list.push(
        Object.assign(
          {
            id: newId("auto", seq),
            stageSource: "auto",
            rotationDeg: 0,
            zIndex: seq,
          },
          partial
        )
      );
    }

    if (name.indexOf("garage") >= 0) return;

    if (name.indexOf("bath") >= 0) {
      add({ type: "toilet", richIcon: "toilet", x: bb.minX + bw * 0.25, y: bb.minY + bh * 0.3, catalogWidthMm: 400, catalogDepthMm: 650 });
      add({ type: "bathtub", richIcon: "bathtub", x: bb.minX + bw * 0.72, y: c.y, rotationDeg: 90, catalogWidthMm: 760, catalogDepthMm: 1700 });
      add({ type: "sink", richIcon: "sink", x: bb.minX + bw * 0.25, y: bb.minY + bh * 0.72, catalogWidthMm: 550, catalogDepthMm: 450 });
      return;
    }

    if (name.indexOf("kitchen") >= 0) {
      add({ type: "kitchen_island", richIcon: "kitchen_island", x: c.x, y: c.y, catalogWidthMm: 1400, catalogDepthMm: 900 });
      return;
    }

    function addRug(scaleW, scaleH) {
      add({
        type: "area_rug",
        richIcon: "area_rug",
        x: c.x,
        y: c.y,
        width: bw * (scaleW != null ? scaleW : 0.85),
        height: bh * (scaleH != null ? scaleH : 0.75),
        zIndex: 0,
      });
    }

    if (name.indexOf("bed") >= 0 || (name.indexOf("master") >= 0 && name.indexOf("bath") < 0)) {
      var bedSize = name.indexOf("master") >= 0 ? { w: 1930, d: 2030 } : { w: 1520, d: 2030 };
      add({
        type: "bed",
        richIcon: "bed",
        x: c.x,
        y: c.y + bh * 0.05,
        catalogWidthMm: bedSize.w,
        catalogDepthMm: bedSize.d,
      });
    } else if (name.indexOf("living") >= 0 || name.indexOf("great") >= 0 || name.indexOf("family") >= 0) {
      addRug(0.88, 0.78);
      add({
        type: "sofa",
        richIcon: "sofa_3",
        sofaSeats: 3,
        x: c.x + bw * 0.2,
        y: c.y,
        catalogWidthMm: 950,
        catalogDepthMm: 2200,
        rotationDeg: 90,
        zIndex: 10,
      });
      add({
        type: "sofa",
        richIcon: "sofa_2",
        sofaSeats: 2,
        x: c.x,
        y: c.y - bh * 0.22,
        catalogWidthMm: 1700,
        catalogDepthMm: 950,
        zIndex: 11,
      });
      add({
        type: "sofa",
        richIcon: "sofa_1",
        sofaSeats: 1,
        x: c.x - bw * 0.22,
        y: c.y + bh * 0.2,
        catalogWidthMm: 1000,
        catalogDepthMm: 950,
        zIndex: 12,
      });
      add({
        type: "sofa",
        richIcon: "sofa_1",
        sofaSeats: 1,
        x: c.x + bw * 0.06,
        y: c.y + bh * 0.2,
        catalogWidthMm: 1000,
        catalogDepthMm: 950,
        zIndex: 13,
      });
      add({
        type: "coffee_table",
        richIcon: "coffee_table",
        x: c.x - bw * 0.04,
        y: c.y + bh * 0.02,
        catalogWidthMm: 1100,
        catalogDepthMm: 650,
        zIndex: 8,
      });
      add({
        type: "side_table",
        richIcon: "side_table",
        x: c.x + bw * 0.14,
        y: c.y - bh * 0.14,
        catalogWidthMm: 480,
        catalogDepthMm: 480,
        zIndex: 9,
      });
      add({
        type: "side_table",
        richIcon: "side_table",
        sideTablePlant: true,
        x: c.x + bw * 0.18,
        y: c.y + bh * 0.16,
        catalogWidthMm: 480,
        catalogDepthMm: 480,
        zIndex: 9,
      });
    } else if (name.indexOf("dining") >= 0) {
      addRug(0.9, 0.82);
      add({
        type: "dining_table",
        richIcon: "dining_table",
        chairCount: 8,
        x: c.x,
        y: c.y,
        catalogWidthMm: 2200,
        catalogDepthMm: 1400,
        zIndex: 5,
      });
    } else if (name.indexOf("office") >= 0 || name.indexOf("study") >= 0) {
      add({ type: "desk", richIcon: "desk", x: c.x, y: c.y, catalogWidthMm: 1400, catalogDepthMm: 700 });
    }

    var plantCount =
      name.indexOf("living") >= 0 || name.indexOf("great") >= 0 || name.indexOf("family") >= 0
        ? 0
        : name.indexOf("passage") >= 0 || name.indexOf("hall") >= 0
          ? 1
          : 2;
    for (var p = 0; p < plantCount; p++) {
      var px = bb.minX + bw * (0.15 + p * 0.35);
      var py = bb.maxY - pad * 1.2;
      var pt = clampInBBox(px, py, bb, pad);
      add({
        type: "plant",
        richIcon: "plant",
        plantVariant: pickPlantVariant(room.id + "-" + p),
        x: pt.x,
        y: pt.y,
        catalogWidthMm: 550,
        catalogDepthMm: 550,
      });
    }
  });

  data.furniture = list;
  return seq;
}

/**
 * Apply catalog mm to staged items when catalog row exists.
 */
export function enrichStagedFromCatalog(data, catalog) {
  (data.furniture || []).forEach(function (item) {
    if (item.stageSource !== "auto") return;
    var row = catalogById(catalog || [], item.catalogId);
    if (!row) return;
    if (row.width_mm != null) item.catalogWidthMm = row.width_mm;
    if (row.depth_mm != null) item.catalogDepthMm = row.depth_mm;
    var inf = inferFurnitureIcon(row, item);
    if (inf.icon === "sofa" && item.richIcon) delete item.useGlbBake;
  });
}
