# Medovant — Technical Documentation (Current Project State)

Reference document for **Medovant**: a maintenance escrow protocol on **Solana Devnet**, built with an **Anchor (Rust)** program and a **React + TypeScript (Vite)** web app in **`app/`**.

**Last updated:** August 2026  
**Program ID (Devnet):** `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`

---

## 1. Executive Summary

Medovant models medical equipment as **PDA** accounts with a state machine and a per-asset **vault PDA** that holds **SOL** until maintenance is completed. The hospital signs with the connected wallet (Phantom/Solflare); in the demo the same connected wallet also signs as the technician (dual signature on `complete_maintenance`), with no key material stored in the browser.

The SPA (`app/`) includes:

- **Home:** wallet connect, dark/light theme, EN/ES language toggle, visual identity (logos, grid, styled wallet button).
- **Hospital dashboard:** protocol flow, **on-chain KPI cards**, equipment table with contextual actions and modals, activity feed, blockchain panel.
- **Technician dashboard:** on-chain technician profile metrics, demo jobs, and completion form.

Equipment **names and locations** are **not** stored on-chain; they are saved in **Supabase** (`assets` table) and synced via `utils/assetMetadata.ts`, with a `localStorage` fallback for the demo when env vars are not configured.

> **Root README note:** it still documents a `client/` Node client; the main product frontend is under **`app/`** (Vite + React).

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — React SPA (app/)                                  │
│  Wallet Adapter + Anchor (static IDL JSON)                   │
│  Contexts: Theme, Lang, Role (hospital | technician UI only) │
└────────────────────────────┬────────────────────────────────┘
                             │ Devnet JSON-RPC
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Solana Devnet — Medovant Program                            │
│  MedicalAsset, Escrow Vault (PDA), TechnicianProfile         │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|------|------------|
| Blockchain | Solana **Devnet** |
| Smart contract | **Anchor** (~0.32), Rust |
| Web client | **React 18**, **Vite 5**, **TypeScript** |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| Styling | **Tailwind CSS** + CSS variables in **`app/src/index.css`** |
| Toasts | **Sonner** |
| Routing | **React Router** (`/`, `/dashboard`) |

---

## 3. On-chain Program (Anchor)

**Path:** `programs/medovant/src/lib.rs`

### 3.1 Main Accounts

- **`MedicalAsset` (PDA)** — seeds: `["equipment", hospital, asset_id u64 LE]`  
  Relevant fields: `hospital`, `asset_id`, `status`, `last_maintenance`, `bump`, `maintenance_reward` (lamports in escrow), `failure_count`.

- **Escrow vault (PDA)** — seeds: `["vault", medical_asset_pubkey]`; lazily created in `report_issue` via signed CPI.

- **`TechnicianProfile` (PDA)** — seeds: `["technician", technician_pubkey]`; on-chain reputation and totals.

### 3.2 Asset States (`AssetStatus`)

`Active` → `IssueReported` → (UI flow) → `Active` after `complete_maintenance`; `UnderMaintenance` exists in enum; `Decommissioned` closes the account.

### 3.3 Instructions (Summary)

| Instruction | Main signers | Effect |
|-------------|--------------|--------|
| `register_technician` | Technician | Creates technician profile |
| `initialize_asset` | Hospital | Creates asset in `Active` |
| `report_issue` | Hospital | Locks escrow + sets `IssueReported` |
| `complete_maintenance` | Hospital + technician | Releases escrow to technician, back to `Active` |
| `decommission_asset` | Hospital | Decommissions and closes asset PDA |

### 3.4 Errors and Events

`MedovantError` handles authorization, invalid states, reward constraints, and technician profile checks. Anchor events (`AssetInitialized`, `IssueReported`, etc.) support traceability.

---

## 4. Client PDA Derivation

**File:** `app/src/utils/pdas.ts` — must match the program exactly:

- `getMedicalAssetPDA(hospital, assetId)`
- `getEscrowVaultPDA(medicalAssetPDA)`
- `getTechnicianProfilePDA(technician)`

Client **Program ID** is aligned with `declare_id!` and IDL in `app/src/idl/medovant.json`.

After `anchor build`, sync IDL:

```bash
cp target/idl/medovant.json app/src/idl/medovant.json
```

*(On Windows PowerShell, use the equivalent `Copy-Item` command.)*

---

## 5. Frontend (`app/`)

### 5.1 Entry and Providers

- **`main.tsx`:** `SolanaWalletProvider` (Devnet) → `ThemeProvider` (`data-theme` on `document.documentElement`) → `RoleProvider` → `LangProvider`.
- **`App.tsx`:** `/` → `Home`; `/dashboard` → wallet-protected route.

### 5.2 Anchor Program Hook

**`hooks/useProgram.ts`:** loads IDL from `app/src/idl/medovant.json` with `commitment: 'confirmed'`.

### 5.3 Hospital Dashboard — Shared State and KPIs

**`HospitalDashboard.tsx`**

- Owns **`assets`** and **`assetsLoading`**.
- **`fetchAssets`:** scans IDs **1–10** for connected hospital wallet and builds **`OnChainAsset`** entries (`mapAssetStatus`, `getAssetMeta`, lamports normalization).
- **Real-time KPI cards** (status counts + total):
  - Total on-chain assets (`assets.length`).
  - Active, issues, in maintenance, decommissioned (status strings: `Active`, `Issue Reported`, `Under Maintenance`, `Decommissioned`).
  - Issues card subtitle shows **locked SOL** when `kpiEscrowSOL > 0`; otherwise falls back to i18n (`kpiIssuesSub`).
- Passes to **`EquipmentTable`:** `assets`, `assetsLoading`, `onAssetsChange={fetchAssets}` so table and KPIs stay in sync after transactions and refresh.

### 5.4 Equipment Table

**`EquipmentTable.tsx`**

- Exports **`OnChainAsset`** and **`OnTxSuccess`**.
- **Controlled mode:** if **`assets`** is defined (`!== undefined`), table skips internal mount fetch and uses parent data + `assetsLoading`.
- **Autonomous mode:** if no `assets` prop is passed, keeps legacy internal scan of IDs **1–5**.
- **`refreshAssets()`:** calls `onAssetsChange` when provided; otherwise runs internal fetch.
- After register/report/complete/decommission: **`refreshAssets()`** updates UI consistently.
- **Modals:** register (persists metadata via `upsertAssetMeta` → Supabase before `initializeAsset`), report issue, complete (registers technician if missing + `completeMaintenance`), decommission.
- Row action buttons include **`btn-issue`**, **`btn-complete`**, **`btn-decomm`** classes for light-mode CSS overrides (no logic changes).
- Demo rows appear when no assets exist and wallet is connected.

### 5.5 Technician Dashboard

**`TechnicianDashboard.tsx`:** on-chain profile reads for the connected wallet, completion by `assetId`, i18n copy for demo jobs.

### 5.6 Key Utilities

| File | Purpose |
|------|---------|
| `utils/formatters.ts` | `mapAssetStatus`, `normalizeTxSignature`, `truncatePubkey` / `truncateSig`, `lamportsToSol` |
| `utils/assetMetadata.ts` | `getAssetMeta`, `getAssetDisplayName`, `upsertAssetMeta`, `hydrateAssetMetadata` (Supabase + localStorage fallback) |
| `utils/evidence.ts` | `submitEvidence`, `fetchEvidenceForAsset`, `verifyEvidenceIntegrity`, `isEvidenceConfigured` |
| `utils/supabase.ts` | `getSupabase`, `isSupabaseConfigured` (singleton Supabase client) |
| `utils/solanaTxError.ts` | `toastAnchorTxError`, `SendTransactionError` logs |
| `components/Toast.tsx` | Tx toasts + Explorer link |
| `ActivityFeed.tsx` | Typed activity items with defensive fallback |
| `BlockchainPanel.tsx` | Safe Explorer links with normalized signature |

### 5.7 Internationalization

**`i18n/translations.ts`:** EN/ES keys; **`LangContext`:** `t(key)`, `toggleLang`.

### 5.8 Theme and Visual Identity (`index.css`)

- **`:root` / `[data-theme='dark']` and `[data-theme='light']`:** semantic tokens (`--bg`, `--surface*`, `--text*`, `--green`, `--amber`, `--red`, etc.).
- **Wallet adapter** and **`.home-wallet-btn`** styles for Home wallet button.
- **Light mode table readability:** `table th` / `td`, row hover colors.
- **Light mode action buttons:** `.btn-issue`, `.btn-complete`, `.btn-decomm` with explicit color overrides (`!important`).
- **Recent typography pass:** global base font slightly increased for readability (including Tailwind size scale tuning).

---

## 6. Flow Summary (No Logic Changes)

1. **Register asset:** metadata via `upsertAssetMeta` (Supabase) → `initializeAsset` → `fetchAssets` / `refreshAssets`.
2. **Report issue:** `reportIssue` sends lamports to vault → status `Issue Reported`.
3. **Complete maintenance:** optional `registerTechnician` + `completeMaintenance` (hospital + technician) → vault release to technician.
4. **Errors:** Anchor toasts + logs; Devnet low-SOL scenarios documented with user-facing hints.

---

## 7. Relevant Folder Structure

```
Medovant-solana/
├── programs/medovant/          # Anchor program
├── tests/
├── app/                        # Main product SPA
│   ├── public/
│   ├── src/
│   │   ├── idl/medovant.json
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── pages/
│   │   ├── providers/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
├── client/                     # Node client (documented in README)
├── target/idl/
├── Anchor.toml
├── README.md
└── docs/
    ├── DOCUMENTACION_TECNICA.md
    └── TECHNICAL_DOCUMENTATION.md
```

---

## 8. Useful Commands

| Goal | Command |
|------|---------|
| Build program | `anchor build` |
| Run tests | `anchor test` |
| Run frontend | `cd app && npm run dev` |
| Frontend typecheck | `cd app && npx tsc --noEmit` |
| Devnet airdrop (technician/hospital) | `solana airdrop 1 <PUBKEY> --url devnet` |

---

## 9. Known Constraints (Demo / Hackathon)

1. **ID scan range:** Hospital dashboard uses **1–10** in parent-level fetch; autonomous table mode keeps **1–5**.
2. **Asset metadata:** **Supabase** (`assets` table) with `localStorage` fallback when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not configured (so the demo works without setup).
3. **Demo technician:** local keypair, not production auth model.
4. **No indexer:** no global off-chain list of all hospital assets.

---

## 10. Security Notes

- Never commit real private keys.
- Demo technician keypair is for **Devnet** only.
- After redeploy, verify **Program ID** and **IDL** consistency.

---

## 11. Links

- **Program Explorer:**  
  https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet  
- **Overview and deployment notes:** root `README.md`.

---

*Medovant — technical documentation aligned with current code in `app/` and `programs/medovant`.*
