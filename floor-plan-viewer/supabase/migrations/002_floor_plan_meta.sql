-- Optional Cloudinary pointer if you still deliver transformed bitmaps from there.
alter table public.floor_plans
  add column if not exists cloudinary_public_id text;

comment on column public.floor_plans.cloudinary_public_id is 'Optional; Supabase Storage remains primary for source assets.';
