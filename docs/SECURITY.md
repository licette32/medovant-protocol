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

### 4.4 Off-chain metadata limitations

- Asset names/locations in localStorage can be lost or manipulated client-side

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

