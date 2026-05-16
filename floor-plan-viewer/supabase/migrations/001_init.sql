-- Primary storage: Supabase Storage buckets `floor-plans` (2D) and `models-3d` (.glb).
-- Create buckets + RLS in the dashboard or via SQL (storage.objects policies).

create table if not exists public.furniture_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  width_mm numeric,
  depth_mm numeric,
  height_mm numeric,
  image_2d_url text,
  model_3d_url text,
  created_at timestamptz default now()
);

create table if not exists public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  storage_path text,
  image_public_url text,
  analysis_json jsonb,
  analysis_version text default '1.0'
);

create index if not exists floor_plans_created_at on public.floor_plans (created_at desc);
