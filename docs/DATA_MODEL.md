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

## 3. Off-Chain Data (Current UI)

- Asset display name/location
- Stored in browser `localStorage` via `assetNames.ts`
- Key pattern: `<wallet>-<assetId>`

## 4. Retrieval Strategy (Current)

- Hospital dashboard parent fetch scans IDs `1..10`
- EquipmentTable autonomous mode scans IDs `1..5`
- Missing IDs/accounts are skipped

## 5. Current Constraints

- No global index over all assets
- Data discoverability depends on known ID ranges
- localStorage data is device/browser-specific

## 6. Indexing Roadmap

Recommended improvements:

1. Add event ingestion pipeline from Anchor events
2. Build asset registry/index keyed by hospital pubkey
3. Persist off-chain metadata in backend storage
4. Provide query APIs for dashboards and analytics

## 7. Data Ownership and Consistency

- On-chain state is source of truth for protocol transitions and balances
- Off-chain metadata is presentation-only and optional

