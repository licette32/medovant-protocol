# Medovant — Operational Runbook

## 1. Purpose

Operational procedures for diagnosing and resolving common issues in Medovant (frontend + Solana/Anchor interactions).

## 2. Quick Contacts

- On-call engineer:
- Backup engineer:
- Product owner:

## 3. System Health Signals

- Frontend availability (`npm run dev` in development)
- RPC responsiveness
- Transaction confirmation times
- Error toast volume in UI

## 4. Common Incidents

### 4.1 `insufficient lamports`

Symptoms:
- Transaction simulation fails
- Error in toast/logs mentions insufficient lamports

Actions:
1. Identify payer pubkey
2. Airdrop in Devnet:
   ```bash
   solana airdrop 1 <PUBKEY> --url devnet
   ```
3. Retry transaction

### 4.2 Explorer link failures

Symptoms:
- Explorer button opens invalid URL or nothing

Actions:
1. Verify transaction signature is normalized
2. Check URL encoding
3. Check browser popup blockers

### 4.3 Missing asset in table/KPIs

Symptoms:
- Asset exists on-chain but does not show

Actions:
1. Verify expected asset ID range scan
2. Trigger table refresh
3. Check wallet context (hospital pubkey must match)
4. Verify account exists via explorer

## 5. Incident Triage Template

- Time detected:
- Cluster:
- Impact:
- Scope:
- Suspected root cause:
- Mitigation applied:
- Follow-up task:

## 6. Escalation Rules

- Escalate immediately if:
  - Funds movement appears incorrect
  - Program ID mismatch is detected
  - Reproducible signer/authorization anomalies appear

## 7. Recovery Verification

- [ ] Core flows run end-to-end
- [ ] No blocking UI errors
- [ ] Explorer links are valid
- [ ] Team informed with status update

