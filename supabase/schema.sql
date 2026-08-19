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

-- ---------------------------------------------------------------------------
-- Maintenance evidence (issue #4).
-- Off-chain record linking a completed maintenance to a verifiable attachment
-- (photo/PDF) uploaded to Supabase Storage. evidence_hash is the SHA-256 of the
-- stored file so the hospital can verify integrity before approving. The on-chain
-- MedicalAsset PDA stays the source of truth; this row only ties the escrow
-- release transaction (tx_signature) to the attachment.
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance_events (
  id            uuid primary key default gen_random_uuid(),
  asset_pda     text not null,
  hospital      text not null,
  technician    text not null,
  tx_signature  text,
  evidence_url  text,
  evidence_hash text,
  evidence_mime text,
  created_at    timestamptz not null default now()
);

create index if not exists maintenance_events_asset_idx on public.maintenance_events (asset_pda);
create index if not exists maintenance_events_tech_idx on public.maintenance_events (technician);

alter table public.maintenance_events enable row level security;

drop policy if exists "maintenance_events_select" on public.maintenance_events;
create policy "maintenance_events_select" on public.maintenance_events for select using (true);

drop policy if exists "maintenance_events_insert" on public.maintenance_events;
create policy "maintenance_events_insert" on public.maintenance_events for insert with check (true);

-- Evidence uploads live in a public storage bucket. Public reads allow the
-- hospital to preview the attachment without auth; the hash + tx_signature
-- columns keep the verification trail on the table itself.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

drop policy if exists "evidence_storage_read" on storage.objects;
create policy "evidence_storage_read"
  on storage.objects for select
  using (bucket_id = 'evidence');

drop policy if exists "evidence_storage_insert" on storage.objects;
create policy "evidence_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'evidence');