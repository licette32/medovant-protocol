# Medovant — Testing Strategy

## 1. Goals

- Prevent regressions in on-chain lifecycle logic
- Validate frontend behavior with real wallet/program interactions
- Ensure safe escrow flows

## 2. Test Layers

### 2.1 Smart Contract Tests (Anchor)

- Instruction-level behavior
- State transitions validation
- Authorization checks
- Escrow transfer correctness

### 2.2 Frontend Type/Build Checks

- TypeScript typecheck (`npx tsc --noEmit`)
- Lint checks (if configured)

### 2.3 End-to-End Manual Flows

- Connect wallet
- Register asset
- Report issue with reward
- Complete maintenance
- Decommission asset
- Verify KPI updates and activity feed

## 3. Core Test Matrix

| Scenario | Expected Result |
|---|---|
| Register asset | Account created, status Active |
| Report issue from Active | Status Issue Reported, vault funded |
| Complete maintenance with required signers | Escrow transferred, status Active |
| Unauthorized hospital action | Rejected |
| Decommission by owner | Account closed |

## 4. Regression Checklist Before Release

- [ ] `anchor test` passes
- [ ] `anchor build` passes
- [ ] `cd app && npx tsc --noEmit` passes
- [ ] Manual smoke flows completed on Devnet
- [ ] Explorer links verified

## 5. Known Gaps (Current)

- No automated e2e browser suite yet
- No dedicated indexer validation tests yet

## 6. Future Improvements

- Add Playwright/Cypress e2e coverage
- Add deterministic fixtures for wallet/accounts
- Add CI matrix for frontend + program checks

