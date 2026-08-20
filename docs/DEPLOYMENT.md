# Medovant — Deployment and Release Guide

## 1. Scope

This guide covers how to build, deploy, verify, and release Medovant safely across environments (Devnet first, then production network when applicable).

## 2. Environments

| Environment | Solana Cluster | Purpose |
|---|---|---|
| Local | local validator | Development/testing |
| Devnet | devnet | QA, demos, integration validation |
| Production | TBD | Real users and funds |

## 3. Prerequisites

- Rust toolchain installed
- Solana CLI installed and configured
- Anchor CLI installed (project-compatible version)
- Node.js and npm installed
- Access to deploy keypair and upgrade authority

## 4. Pre-Deployment Checklist

- [ ] `anchor build` succeeds
- [ ] `anchor test` passes
- [ ] Frontend typecheck passes (`cd app && npx tsc --noEmit`)
- [ ] Program ID is correct for target cluster
- [ ] `target/idl/medovant.json` is up to date
- [ ] Frontend IDL synced to `app/src/idl/medovant.json`
- [ ] Wallet keypairs and secrets are not committed
- [ ] Supabase schema applied and `evidence` Edge Function deployed (see 5.5)

## 5. Build and Deploy Steps

### 5.1 Build

```bash
anchor build
```

### 5.2 Deploy

```bash
anchor deploy --provider.cluster devnet
```

### 5.3 Verify Program ID

- Confirm `declare_id!` in `programs/medovant/src/lib.rs`
- Confirm deployed address in Solana Explorer
- Confirm frontend program ID references match

### 5.4 Sync IDL to Frontend

```bash
cp target/idl/medovant.json app/src/idl/medovant.json
```

PowerShell equivalent:

```powershell
Copy-Item target/idl/medovant.json app/src/idl/medovant.json -Force
```

### 5.5 Supabase (off-chain metadata + evidence)

```bash
# 1. Apply RLS hardening (TD-08) — run supabase/schema.sql in the SQL editor
#    or via the Supabase CLI.
supabase link --project-ref <ref>
supabase db push

# 2. Deploy the evidence Edge Function (single writer for maintenance_events).
#    It needs SUPABASE_SERVICE_ROLE_KEY (set automatically at deploy).
supabase functions deploy evidence

# 3. Frontend: set VITE_SUPABASE_FUNCTIONS_URL=https://<ref>.functions.supabase.co
```

Verify the close with `node scripts/verify-evidence-rls.mjs` (see 6).

## 6. Post-Deployment Validation

- [ ] Register asset flow works
- [ ] Report issue locks SOL in vault
- [ ] Complete maintenance releases escrow correctly
- [ ] Decommission closes account
- [ ] Explorer links in UI open correctly
- [ ] KPI values update from on-chain data

## 7. Release Notes Template

## Release <version/tag>

- Date:
- Cluster:
- Program ID:
- IDL version/hash:
- Key changes:
- Known limitations:

## 8. Rollback Plan

- Keep previous build artifact references
- Document previous program/IDL compatibility
- Define frontend rollback artifact
- Define owner approvals before rollback

## 9. Ownership and Approvals

- Deployment owner:
- Security reviewer:
- Product approver:
- QA approver:

