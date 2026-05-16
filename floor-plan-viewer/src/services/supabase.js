/**
 * Supabase Storage: 2D plans now, .glb in Storage later. Optional Cloudinary for transforms only.
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

/** @returns {object | null} */
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
