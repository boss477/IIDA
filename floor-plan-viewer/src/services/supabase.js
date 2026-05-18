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

var SHEARLING_SELECT =
  "product_code,product_name,category,keywords,length_mm,width_mm,height_mm,seat_height_mm,arm_height_mm";

function shapeFromCategory(category) {
  var c = String(category || "").toLowerCase();
  if (c.indexOf("sofa") >= 0) return "sofa";
  if (c.indexOf("stool") >= 0 || c.indexOf("chair") >= 0) return "chair";
  if (c.indexOf("table") >= 0 || c.indexOf("dining") >= 0) return "table";
  if (c.indexOf("lounge") >= 0) return "sofa";
  return "chair";
}

export function mapShearlingRow(row) {
  var depthMm = row.depth_mm != null ? row.depth_mm : row.length_mm;
  return {
    id: row.product_code,
    name: row.product_name + " · " + row.product_code,
    product_name: row.product_name,
    category: row.category,
    keywords: row.keywords,
    width_mm: row.width_mm != null ? Number(row.width_mm) : null,
    depth_mm: depthMm != null ? Number(depthMm) : null,
    height_mm: row.height_mm != null ? Number(row.height_mm) : null,
    seat_height_mm: row.seat_height_mm != null ? Number(row.seat_height_mm) : null,
    arm_height_mm: row.arm_height_mm != null ? Number(row.arm_height_mm) : null,
    shape: shapeFromCategory(row.category),
    product_code: row.product_code,
  };
}

export async function fetchShearlingCatalog() {
  var sb = getSupabase();
  if (!sb) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  var res = await sb
    .from("shearling_catalog")
    .select(SHEARLING_SELECT)
    .order("product_code", { ascending: true });
  if (res.error) throw res.error;
  return (res.data || []).map(mapShearlingRow);
}
