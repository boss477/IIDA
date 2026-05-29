/**
 * Supabase: shearling_catalog (DB). Storage upload optional (VITE_SUPABASE_STORAGE=1).
 */
import { createClient } from "@supabase/supabase-js";

var _client = null;

function url() {
  return (
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof window !== "undefined" && window.__SUPABASE_URL__) ||
    ""
  );
}

function key() {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    (typeof window !== "undefined" && window.__SUPABASE_ANON_KEY__) ||
    ""
  );
}

export function getSupabase() {
  var u = url();
  var k = key();
  if (!u || !k) return null;
  if (!_client) _client = createClient(u, k);
  return _client;
}

export async function uploadPlanRaster(file, path) {
  var sb = getSupabase();
  if (!sb) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  var bucket = "floor-plans";
  var up = await sb.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (up.error) throw up.error;
  var pub = sb.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: pub.data.publicUrl };
}

// Note: the current DB table uses spaced column names (e.g. "Product Code").
// We select * and map with fallbacks so the app works with both schemas.
var SHEARLING_SELECT = "*";

function shapeFromCategory(category) {
  var c = String(category || "").toLowerCase();
  if (c.indexOf("sofa") >= 0) return "sofa";
  if (c.indexOf("stool") >= 0 || c.indexOf("chair") >= 0) return "chair";
  if (c.indexOf("table") >= 0 || c.indexOf("dining") >= 0) return "table";
  if (c.indexOf("lounge") >= 0) return "sofa";
  return "chair";
}

/**
 * Public image URL for catalog UI (full URL, Supabase Storage path, or empty).
 * @param {object} row
 */
export function resolveCatalogImageUrl(row) {
  if (!row) return "";
  var raw =
    row.image_url != null
      ? row.image_url
      : row["image_url"] != null
        ? row["image_url"]
        : row["Image URL"];
  raw = String(raw || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) return raw;

  var sb = getSupabase();
  if (!sb) return raw;

  var path = raw.replace(/^\/+/, "");
  var bucket = "catalog-images";
  if (path.indexOf("/") >= 0) {
    var slash = path.indexOf("/");
    bucket = path.slice(0, slash);
    path = path.slice(slash + 1);
  }
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function mapShearlingRow(row) {
  var productCode = row.product_code != null ? row.product_code : row["Product Code"];
  var productName = row.product_name != null ? row.product_name : row["Product Name"];
  var category = row.category != null ? row.category : row["Category"];
  var keywords = row.keywords != null ? row.keywords : row["Keywords"];

  var widthMm = row.width_mm != null ? row.width_mm : row["Width (mm)"];
  var depthMmRaw =
    row.depth_mm != null
      ? row.depth_mm
      : row.length_mm != null
        ? row.length_mm
        : row["Length / Depth (mm)"];
  var heightMm = row.height_mm != null ? row.height_mm : row["Height (mm)"];

  var depthMm = depthMmRaw;
  return {
    id: productCode,
    name: (productName || "") + " · " + (productCode || ""),
    product_name: productName,
    category: category,
    keywords: keywords,
    width_mm: widthMm != null ? Number(widthMm) : null,
    depth_mm: depthMm != null ? Number(depthMm) : null,
    height_mm: heightMm != null ? Number(heightMm) : null,
    seat_height_mm:
      row.seat_height_mm != null ? Number(row.seat_height_mm) : null,
    arm_height_mm: row.arm_height_mm != null ? Number(row.arm_height_mm) : null,
    image_url: resolveCatalogImageUrl(row),
    shape: shapeFromCategory(category),
    product_code: productCode,
  };
}

export async function fetchShearlingCatalog() {
  var sb = getSupabase();
  if (!sb) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  var res = await sb.from("shearling_catalog").select(SHEARLING_SELECT);
  if (res.error) throw res.error;
  var rows = res.data || [];
  rows.sort(function (a, b) {
    var sa = a["S.No"] != null ? Number(a["S.No"]) : 0;
    var sbn = b["S.No"] != null ? Number(b["S.No"]) : 0;
    return sa - sbn;
  });
  return rows.map(mapShearlingRow);
}
