-- Drafted-style furniture sets for Replace-with / catalog drawer.

create table if not exists public.plan_catalog_presets (
  id text primary key,
  name text not null,
  category text,
  rich_icon text,
  shape text,
  width_mm numeric,
  depth_mm numeric,
  height_mm numeric,
  chair_count int,
  sofa_seats int,
  side_table_plant boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.plan_catalog_presets enable row level security;

drop policy if exists "Anon read plan_catalog_presets" on public.plan_catalog_presets;
create policy "Anon read plan_catalog_presets"
  on public.plan_catalog_presets for select using (true);

drop policy if exists "Anon write plan_catalog_presets" on public.plan_catalog_presets;
create policy "Anon write plan_catalog_presets"
  on public.plan_catalog_presets for all using (true) with check (true);

insert into public.plan_catalog_presets
  (id, name, category, rich_icon, width_mm, depth_mm, chair_count, sofa_seats, side_table_plant, sort_order)
values
  ('cat-bed-suite', 'Bed + nightstands + dresser', 'bedroom', 'bed', 1520, 2030, null, null, false, 10),
  ('cat-bath', 'Bath (toilet + shower)', 'bathroom', 'bathtub', 760, 1700, null, null, false, 20),
  ('cat-k-counter', 'Kitchen counter + stove', 'kitchen', 'kitchen_island', 1400, 900, null, null, false, 30),
  ('cat-k-table', 'Kitchen table (2 chairs)', 'kitchen', 'dining_table', 1200, 900, 4, null, false, 40),
  ('cat-dining', 'Dining table (4 chairs)', 'dining', 'dining_table', 2200, 1400, 8, null, false, 50),
  ('cat-sofa', 'Living sofa (3-seat)', 'living', 'sofa_3', 2200, 950, null, 3, false, 60),
  ('cat-loveseat', 'Loveseat (2-seat)', 'living', 'sofa_2', 1700, 950, null, 2, false, 70),
  ('cat-armchair', 'Armchair (1-seat)', 'living', 'sofa_1', 1000, 950, null, 1, false, 80),
  ('cat-media', 'TV bench / coffee table', 'living', 'coffee_table', 1100, 650, null, null, false, 90),
  ('cat-rug', 'Area rug (living)', 'living', 'area_rug', 2800, 2200, null, null, false, 100),
  ('cat-side-table', 'Side table + plant', 'living', 'side_table', 480, 480, null, null, true, 110),
  ('cat-plant', 'Floor plant', 'living', 'plant', 550, 550, null, null, false, 120),
  ('cat-desk', 'Office desk', 'office', 'desk', 1400, 700, null, null, false, 130)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  rich_icon = excluded.rich_icon,
  width_mm = excluded.width_mm,
  depth_mm = excluded.depth_mm,
  chair_count = excluded.chair_count,
  sofa_seats = excluded.sofa_seats,
  side_table_plant = excluded.side_table_plant,
  sort_order = excluded.sort_order;
