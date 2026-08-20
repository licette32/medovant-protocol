-- TD-08 (#26): close the open-write hole on maintenance_events and the
-- evidence bucket. Idempotent. Mirrors the current supabase/schema.sql block.
-- Writes go through the `evidence` Edge Function (service role) only, after
-- on-chain tx verification; anon reads are limited to verified rows.

alter table public.maintenance_events enable row level security;

drop policy if exists "maintenance_events_select" on public.maintenance_events;
create policy "maintenance_events_select" on public.maintenance_events
  for select using (tx_signature is not null);

drop policy if exists "maintenance_events_insert" on public.maintenance_events;

drop policy if exists "evidence_storage_read" on storage.objects;
create policy "evidence_storage_read"
  on storage.objects for select
  using (bucket_id = 'evidence');

drop policy if exists "evidence_storage_insert" on storage.objects;
create policy "evidence_storage_insert"
  on storage.objects for insert
  with check (false);