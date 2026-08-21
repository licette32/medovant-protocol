# Medovant — Integration Guide (API/IDL)

## 1. Audience

Developers integrating with Medovant program instructions from frontend apps, scripts, or backend services.

## 2. Program Basics

- Network: Solana Devnet (current)
- Program ID: `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`
- IDL path: `app/src/idl/medovant.json`

## 3. PDA Derivation

Use client helpers from `app/src/utils/pdas.ts`:

- `getMedicalAssetPDA(hospital, assetId)`
- `getEscrowVaultPDA(medicalAssetPDA)`
- `getTechnicianProfilePDA(technician)`

Seeds must remain exactly aligned with on-chain program logic.

## 4. Instructions Reference

### 4.1 `initialize_asset(asset_id)`

- Signer: hospital
- Required accounts: hospital, medicalAsset PDA, systemProgram
- Result: asset created with status `Active`

### 4.2 `report_issue(reward_lamports)`

- Signer: hospital
- Required accounts: hospital, medicalAsset PDA, escrowVault PDA, systemProgram
- Result: reward locked in escrow, status `IssueReported`

### 4.3 `register_technician()`

- Signer: technician
- Required accounts: technician, technicianProfile PDA, systemProgram

### 4.4 `complete_maintenance()`

- Signers: hospital + technician
- Required accounts: hospital, technician, medicalAsset, escrowVault, technicianProfile, systemProgram
- Result: escrow released, status returns to `Active`

### 4.5 `decommission_asset()`

- Signer: hospital
- Required accounts: hospital, medicalAsset PDA, escrowVault PDA, systemProgram
- Rejected while an issue is pending (`AssetHasPendingEscrow`): the escrow would be orphaned
- Result: leftover vault lamports drained to the hospital, account closed/decommissioned

## 5. Off-Chain Data (Supabase)

### 5.1 Asset Metadata (`assets` table)

- Stored in Supabase Postgres (table `public.assets`), shared across users/devices.
- Client: `utils/assetMetadata.ts` — `getAssetMeta`, `getAssetDisplayName`, `upsertAssetMeta`, `hydrateAssetMetadata`.
- Fallback: if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not set, uses `localStorage` (demo mode).
- RLS: public read/insert/update (demo); production should restrict to hospital owner.

### 5.2 Maintenance Evidence (`maintenance_events` + Storage)

- Evidence submitted **after** `complete_maintenance` lands on-chain (never before).
- Frontend calls `POST {VITE_SUPABASE_FUNCTIONS_URL}/evidence` with multipart form data:
  `file`, `assetPda`, `hospital`, `technician`, `txSignature`.
- Edge Function (`supabase/functions/evidence`) verifies against devnet RPC:
  1. tx exists and succeeded (`meta.err == null`)
  2. Medovant program (`5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`) invoked
  3. `assetPda` appears in tx accounts
  4. `technician` signed the tx
- If verified: uploads file to `evidence` bucket, inserts `maintenance_events` row with service role, stores SHA-256 as `evidence_hash`.
- RLS: `maintenance_events` — anon `select` only where `tx_signature is not null`; **no** anon insert/update. Bucket `evidence` — public read, anon write denied.
- Client: `utils/evidence.ts` — `submitEvidence`, `fetchEvidenceForAsset`, `verifyEvidenceIntegrity`, `isEvidenceConfigured`.

## 6. Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (for off-chain features) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes (for off-chain features) |
| `VITE_SUPABASE_FUNCTIONS_URL` | Edge Functions base URL (e.g., `https://<ref>.functions.supabase.co`) | For evidence upload |

Without Supabase env vars, the app runs in **demo mode** using `localStorage` for asset metadata and hides evidence features.

## 7. Integration Examples

### 7.1 Frontend hook usage

Use `useProgram` in app code and call methods through Anchor `program.methods...`.

### 7.2 Error handling

Use `toastAnchorTxError` pattern and transaction log extraction when available.

## 8. Compatibility

- Keep IDL in sync after each deploy
- Validate Program ID and account seeds before release

