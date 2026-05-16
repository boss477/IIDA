# Supabase Storage

Create two **public** (or signed) buckets:

| Bucket       | Use                    |
|-------------|-------------------------|
| `floor-plans` | PNG/JPEG/WebP 2D plans |
| `models-3d`   | `.glb` (future 3D)     |

Add RLS policies for `storage.objects` so authenticated (or anon) clients can upload/read as needed.

Cloudinary is optional (e.g. on-the-fly image transforms); **source of truth** for binaries is Storage.
