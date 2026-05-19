-- 003_relational_scene_graph.sql
-- Create relational tables for floor plan projects, rooms, walls/doors/windows, and placed furniture.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  plan_image_url text,
  calibration jsonb,
  created_at timestamptz default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id text,
  name text,
  type text,
  flooring text,
  polygon jsonb,
  label_point jsonb,
  dimensions_text text,
  area numeric,
  created_at timestamptz default now()
);

create table if not exists public.structural_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id text,
  kind text not null, -- 'wall', 'door', 'window'
  geometry jsonb,
  thickness numeric,
  connects jsonb,
  created_at timestamptz default now()
);

create table if not exists public.placed_furniture (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  client_id text,
  catalog_id text,
  x numeric not null,
  y numeric not null,
  z numeric default 0,
  rotation_deg numeric default 0,
  overrides jsonb,
  created_at timestamptz default now()
);

-- Enable RLS and add basic policies allowing anonymous access for testing.
alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.structural_elements enable row level security;
alter table public.placed_furniture enable row level security;

create policy "Anon access to projects" on public.projects for all using (true) with check (true);
create policy "Anon access to rooms" on public.rooms for all using (true) with check (true);
create policy "Anon access to structural_elements" on public.structural_elements for all using (true) with check (true);
create policy "Anon access to placed_furniture" on public.placed_furniture for all using (true) with check (true);
