# Medovant — Security Notes and Threat Model

## 1. Scope

Security considerations for the current Devnet implementation and guidance toward production readiness.

## 2. Assets to Protect

- User funds (lamports in escrow vaults)
- Wallet private keys
- Program upgrade authority
- Integrity of on-chain state transitions

## 3. Current Security Controls

- PDA-based deterministic account ownership model
- Explicit signer constraints in instructions
- Error checks for invalid states and mismatched profiles
- Frontend transaction signature normalization for safer explorer linking

## 4. Threats and Risks

### 4.1 Key management risk

- Demo technician keypair in localStorage is not production-grade

### 4.2 Misconfiguration risk

- Program ID / IDL drift after deploy can cause unsafe behavior

### 4.3 UX-induced risk

- Users may attempt transactions without enough lamports

### 4.4 Off-chain metadata (Supabase)

- Asset metadata in Supabase (`assets` table) is public-read in demo; production should enforce hospital-scoped RLS.
- Evidence integrity relies on SHA-256 hash stored at upload (`evidence_hash`) and verified client-side before approval (SEC-03).
- Edge Function `evidence` is the sole writer; it verifies on-chain tx before insert (TD-08).

### 4.5 Supabase dependency risk

- Off-chain metadata and evidence storage depend on Supabase availability and correct RLS/policies.
- Misconfigured RLS or exposed service role key could allow unauthorized writes/reads.
- Edge Function must be deployed and `VITE_SUPABASE_FUNCTIONS_URL` set; otherwise evidence flow is disabled.
- Supabase project is a centralized dependency — consider failover/backup strategy for production.

## 5. Security Best Practices

- Never commit secrets/private keys
- Use dedicated deployment key management
- Verify program/IDL alignment on each release
- Use explicit environment separation (dev/test/prod)

## 6. Incident Response

- Follow `docs/RUNBOOK.md`
- Capture transaction signatures and logs
- Classify impact scope before remediation

## 7. Production Hardening Roadmap

- Enforce distinct hospital/technician wallets per role (drop single-wallet demo path)
- Add monitoring/alerting for failed tx patterns
- Introduce audit and formal security review before mainnet

