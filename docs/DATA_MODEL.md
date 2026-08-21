# Medovant — Data Model and Indexing Notes

## 1. Purpose

Describe what data lives on-chain vs off-chain, current retrieval strategy, and indexing roadmap.

## 2. On-Chain Data

### 2.1 `MedicalAsset`

Stores:
- authority (`hospital`)
- identifier (`asset_id`)
- lifecycle (`status`)
- maintenance timestamp (`last_maintenance`)
- escrow amount (`maintenance_reward`)
- reliability signal (`failure_count`)

### 2.2 `TechnicianProfile`

Stores:
- technician pubkey
- aggregate work/payment-related counters (per program definition)

### 2.3 Escrow Vault PDA

Stores lamports reserved for maintenance payouts.

## 3. Off-Chain Data (Supabase)

### 3.1 `assets` table

Stores descriptive metadata for each on-chain `MedicalAsset` PDA, shared across users and devices.

| Column | Type | Description |
|--------|------|-------------|
| `asset_pda` | text (PK) | PDA pubkey of the on-chain MedicalAsset |
| `hospital` | text | Hospital wallet pubkey (authority) |
| `name` | text | Human-readable equipment name |
| `location` | text (nullable) | Physical location / department |
| `asset_type` | text (nullable) | Equipment type / category |
| `created_at` | timestamptz | Row creation timestamp |

**Indexes:** `assets_hospital_idx` on `hospital`

**RLS:** Enabled. Policies:
- `assets_select` — `using (true)` (public read)
- `assets_insert` — `with check (true)` (public insert for demo)
- `assets_update` — `using (true) with check (true)` (public update for demo)

### 3.2 `maintenance_events` table

Off-chain record linking a completed maintenance transaction to a verifiable attachment (photo/PDF) in Supabase Storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `asset_pda` | text | PDA of the MedicalAsset |
| `hospital` | text | Hospital wallet pubkey |
| `technician` | text | Technician wallet pubkey |
| `tx_signature` | text (nullable) | On-chain `complete_maintenance` signature |
| `evidence_url` | text (nullable) | Public Storage URL of the file |
| `evidence_hash` | text (nullable) | SHA-256 of the uploaded file |
| `evidence_mime` | text (nullable) | MIME type (image/jpeg, image/png, image/webp, application/pdf) |
| `created_at` | timestamptz | Row creation timestamp |

**Indexes:** `maintenance_events_asset_idx` on `asset_pda`, `maintenance_events_tech_idx` on `technician`

**RLS:** Enabled. Policies:
- `maintenance_events_select` — `using (tx_signature is not null)` (anon reads only see rows tied to a verified on-chain tx)
- **No anon insert/update policy** — writes only via `evidence` Edge Function with service role after RPC verification (see TD-08)

### 3.3 Storage bucket: `evidence`

- Public bucket for evidence files (photos, PDFs)
- Public read allowed (`evidence_storage_read` policy)
- Anon write denied (`evidence_storage_insert` with `with check (false)`)
- Files uploaded by Edge Function after verifying the on-chain transaction

## 4. Retrieval Strategy (Current)

- Hospital dashboard parent fetch scans IDs `1..10`
- EquipmentTable autonomous mode scans IDs `1..5`
- Missing IDs/accounts are skipped
- Asset metadata loaded via `hydrateAssetMetadata()` (Supabase) with localStorage fallback for demo
- Evidence loaded via `fetchEvidenceForAsset()` (Supabase, filtered by `asset_pda`)

## 5. Current Constraints

- No global index over all assets
- Data discoverability depends on known ID ranges
- Off-chain metadata is presentation-only and optional (on-chain is source of truth)

## 6. Indexing Roadmap

Recommended improvements:

1. Add event ingestion pipeline from Anchor events
2. Build asset registry/index keyed by hospital pubkey
3. Provide query APIs for dashboards and analytics

## 7. Data Ownership and Consistency

- On-chain state is source of truth for protocol transitions and balances
- Off-chain metadata (`assets`) is presentation-only and optional
- Evidence (`maintenance_events` + Storage) is verified against on-chain `tx_signature` before insert

