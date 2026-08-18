-- Medovant off-chain asset metadata (issue #1).
-- The on-chain MedicalAsset PDA stays the source of truth for state;
-- this table only adds descriptive metadata shared across users and devices.

create table if not exists public.assets (
  asset_pda   text primary key,
  hospital    text not null,
  name        text not null,
  location    text,
  asset_type  text,
  created_at  timestamptz not null default now()
);

create index if not exists assets_hospital_idx on public.assets (hospital);

alter table public.assets enable row level security;

drop policy if exists "assets_select" on public.assets;
create policy "assets_select" on public.assets for select using (true);

drop policy if exists "assets_insert" on public.assets;
create policy "assets_insert" on public.assets for insert with check (true);

drop policy if exists "assets_update" on public.assets;
create policy "assets_update" on public.assets for update using (true) with check (true);