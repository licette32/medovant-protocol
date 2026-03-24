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
- Required accounts: hospital, medicalAsset
- Result: account closed/decommissioned

## 5. Data Model Notes

- On-chain: status, counters, maintenance reward, authority
- Off-chain (UI only): asset name/location in browser localStorage

## 6. Integration Examples

### 6.1 Frontend hook usage

Use `useProgram` in app code and call methods through Anchor `program.methods...`.

### 6.2 Error handling

Use `toastAnchorTxError` pattern and transaction log extraction when available.

## 7. Compatibility

- Keep IDL in sync after each deploy
- Validate Program ID and account seeds before release

