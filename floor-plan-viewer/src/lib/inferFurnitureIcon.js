/**
 * Infer 2D icon type + default mm sizes from catalog name / category.
 */

var BED_MM = {
  king: { w: 1930, d: 2030 },
  queen: { w: 1520, d: 2030 },
  double: { w: 1370, d: 1900 },
  twin: { w: 920, d: 1900 },
  single: { w: 920, d: 1900 },
};

/**
 * @param {object|null} row
 * @param {object|null} item
 * @returns {{ icon: string, seats?: number, chairCount?: number, defaultMm?: { w: number, d: number } }}
 */
export function inferFurnitureIcon(row, item) {
  var text = [
    row && row.product_name,
    row && row.name,
    row && row.keywords,
    row && row.category,
    item && item.type,
    item && item.catalogId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.indexOf("toilet") >= 0 || text.indexOf("wc") >= 0) {
    return { icon: "toilet", defaultMm: { w: 400, d: 650 } };
  }
  if (text.indexOf("tub") >= 0 || text.indexOf("bath") >= 0 && text.indexOf("bathroom") < 0) {
    return { icon: "bathtub", defaultMm: { w: 760, d: 1700 } };
  }
  if (text.indexOf("sink") >= 0 || text.indexOf("basin") >= 0 || text.indexOf("vanity") >= 0) {
    return { icon: "sink", defaultMm: { w: 550, d: 450 } };
  }
  if (text.indexOf("plant") >= 0 || text.indexOf("tree") >= 0 || text.indexOf("pot") >= 0) {
    return { icon: "plant", defaultMm: { w: 550, d: 550 } };
  }
  if (text.indexOf("area rug") >= 0 || text.indexOf("area_rug") >= 0 || text.indexOf("rug") >= 0) {
    return { icon: "area_rug", defaultMm: { w: 2800, d: 2200 } };
  }
  if (text.indexOf("coffee") >= 0 && text.indexOf("table") >= 0) {
    return { icon: "coffee_table", defaultMm: { w: 1200, d: 700 } };
  }
  if (text.indexOf("side table") >= 0 || text.indexOf("side_table") >= 0 || text.indexOf("nightstand") >= 0) {
    return { icon: "side_table", defaultMm: { w: 480, d: 480 } };
  }
  if (text.indexOf("island") >= 0 || text.indexOf("kitchen") >= 0 && text.indexOf("sofa") < 0) {
    return { icon: "kitchen_island", defaultMm: { w: 1200, d: 900 } };
  }
  if (text.indexOf("desk") >= 0 || text.indexOf("office") >= 0) {
    return { icon: "desk", defaultMm: { w: 1400, d: 700 } };
  }

  var chairMatch = text.match(/(\d+)\s*(?:seat|seater|chair)/);
  var chairs = chairMatch ? parseInt(chairMatch[1], 10) : 0;
  if (text.indexOf("dining") >= 0 || (text.indexOf("table") >= 0 && chairs >= 4)) {
    var count = chairs >= 6 ? 8 : chairs >= 4 ? 6 : 4;
    return { icon: "dining_table", chairCount: count, defaultMm: { w: 2200, d: 1400 } };
  }

  if (text.indexOf("bed") >= 0 || text.indexOf("mattress") >= 0) {
    if (text.indexOf("king") >= 0) return { icon: "bed", bedSize: "king", defaultMm: BED_MM.king };
    if (text.indexOf("queen") >= 0) return { icon: "bed", bedSize: "queen", defaultMm: BED_MM.queen };
    if (text.indexOf("twin") >= 0 || text.indexOf("single") >= 0) {
      return { icon: "bed", bedSize: "single", defaultMm: BED_MM.single };
    }
    if (text.indexOf("double") >= 0 || text.indexOf("2 bed") >= 0) {
      return { icon: "bed", bedSize: "double", defaultMm: BED_MM.double };
    }
    return { icon: "bed", bedSize: "queen", defaultMm: BED_MM.queen };
  }

  if (
    text.indexOf("sofa") >= 0 ||
    text.indexOf("lounge") >= 0 ||
    text.indexOf("sectional") >= 0 ||
    text.indexOf("couch") >= 0 ||
    text.indexOf("loveseat") >= 0 ||
    text.indexOf("armchair") >= 0 ||
    text.indexOf("accent chair") >= 0
  ) {
    var seats = 2;
    if (
      text.indexOf("single") >= 0 ||
      text.indexOf("1 seat") >= 0 ||
      text.indexOf("1-seat") >= 0 ||
      text.indexOf("1 seater") >= 0 ||
      text.indexOf("armchair") >= 0 ||
      text.indexOf("accent chair") >= 0
    ) {
      seats = 1;
    } else if (
      text.indexOf("3 seat") >= 0 ||
      text.indexOf("3-seat") >= 0 ||
      text.indexOf("3 seater") >= 0
    ) {
      seats = 3;
    } else if (
      text.indexOf("2 seat") >= 0 ||
      text.indexOf("2-seat") >= 0 ||
      text.indexOf("2 seater") >= 0 ||
      text.indexOf("loveseat") >= 0 ||
      text.indexOf("love seat") >= 0
    ) {
      seats = 2;
    } else if (text.indexOf("4 seat") >= 0) {
      seats = 3;
    }
    return {
      icon: "sofa",
      seats: seats,
      defaultMm: { w: 600 + seats * 550, d: 950 },
    };
  }

  if (text.indexOf("chair") >= 0) {
    return { icon: "chair", defaultMm: { w: 550, d: 550 } };
  }
  if (text.indexOf("table") >= 0) {
    return { icon: "dining_table", chairCount: 4, defaultMm: { w: 1200, d: 800 } };
  }

  return { icon: "generic", defaultMm: { w: 800, d: 800 } };
}

export function pickPlantVariant(seed) {
  var n = Math.abs(Number(seed) || 0) % 4;
  return "plant_" + n;
}
