# Medovant — PST Hand-Off (Dual-Wallet `complete_maintenance`)

## 1. Purpose

The **Partially Signed Transaction (PST) hand-off** enables `complete_maintenance` to be executed with **two distinct wallets**:

- **Hospital** (fee payer): builds the transaction, signs it partially, pays fees.
- **Technician**: verifies the payload, adds their signature, submits to the network.

This separates fee payment from execution authority — the hospital never exposes their private key to the technician, and the technician never pays fees.

---

## 2. Payload Format (`PstPayload` v1)

Defined in `app/src/utils/pst.ts:13-21`.

```typescript
interface PstPayload {
  readonly v: 1                      // version
  readonly tx: string                // base64-encoded Transaction (hospital-signed)
  readonly hospital: string          // hospital wallet pubkey (base58)
  readonly assetId: number           // u64 asset identifier
  readonly blockhash: string         // recent blockhash used to build tx
  readonly lastValidBlockHeight: number  // block height when blockhash expires
  readonly createdAt: number         // epoch ms when payload was created
}
```

**Serialization:** JSON (`payloadToJson` / `parsePayload`). Transport-agnostic — can be shared via chat, email, QR, clipboard.

**Transaction encoding:** base64 of `Transaction.serialize({ requireAllSignatures: false })` (partial sig allowed).

---

## 3. Complete Flow

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│     HOSPITAL        │       │     TECHNICIAN      │       │     SOLANA RPC      │
│  (fee payer)        │       │  (signs & submits)  │       │   (Devnet/Mainnet)  │
└──────────┬──────────┘       └──────────┬──────────┘       └──────────┬──────────┘
           │                             │                             │
           │ 1. buildPartialTransaction  │                             │
           │    - derives PDAs           │                             │
           │    - fetches latest         │                             │
           │      blockhash              │                             │
           │    - builds complete_       │                             │
           │      maintenance ix         │                             │
           │    - sets feePayer =        │                             │
           │      hospital               │                             │
           │    - signs with hospital    │                             │
           │      wallet (partial)       │                             │
           │    - returns PstPayload     │                             │
           │                             │                             │
           ├──────── PstPayload ────────►│                             │
           │    (JSON string)            │                             │
           │                             │                             │
           │                        2. verifyPstPayload               │
           │                             │    - re-derives all PDAs    │
           │                             │      from hospital+assetId  │
           │                             │    - checks instruction     │
           │                             │      accounts match PDAs    │
           │                             │    - asserts exactly one    │
           │                             │      partial sig from       │
           │                             │      hospital               │
           │                             │    - verifies sig is valid  │
           │                             │    - returns PstVerification│
           │                             │                             │
           │                        3. signAndSendPst                 │
           │                             │    - signs with technician  │
           │                             │      wallet                 │
           │                             │    - sends raw tx           │
           │                             │    - confirms w/ blockhash  │
           │                             │      & lastValidBlockHeight │
           │                             │                             │
           │                             ├────────────────────────────►│
           │                             │                             │
           │                             │                         tx confirmed
           │                             │                             │
           ▼                             ▼                             ▼
```

---

## 4. Security Invariants (enforced in `verifyPstPayload`)

| Check | Code | Rationale |
|-------|------|-----------|
| **PDA re-derivation** | `getMedicalAssetPDA(hospital, assetId)`, `getEscrowVaultPDA(assetPda)`, `getTechnicianProfilePDA(technician)` | Technician verifies PDAs from *trusted* fields (`hospital`, `assetId`), not from the transaction itself. Prevents PDA substitution. |
| **Instruction accounts match** | `instruction.keys.some(k => k.pubkey.equals(pda))` for each PDA + `SystemProgram` | Ensures the tx actually targets the correct on-chain accounts. |
| **Fee payer = hospital** | `tx.feePayer.equals(hospital)` | Hospital pays fees; technician cannot be tricked into paying. |
| **Exactly one partial signature** | `signatures.length === 1` | Guarantees hospital signed *once*; no extra signatures injected. |
| **Partial signature from hospital** | `signatures[0].publicKey.equals(hospital)` | Confirms the signer is the claimed hospital. |
| **Signature validity** | `tx.verifySignatures(false)` | Cryptographic verification of the hospital's partial signature. |
| **Blockhash freshness** | `tx.recentBlockhash === payload.blockhash` + `lastValidBlockHeight` check at submit | Prevents replay with stale blockhash; tx expires after ~150 slots (~1–2 min). |

---

## 5. Expiration & Blockhash

- Built against `latestBlockhash` from RPC (`confirmed` commitment).
- `lastValidBlockHeight` defines hard expiry: tx **must** land before this height.
- Helper: `slotsRemaining(payload, currentBlockHeight)` → remaining slots.
- UI shows countdown (`formatPstExpiry`) in `PstPanel`.
- If expired: payload is invalid; hospital must rebuild (new blockhash).

---

## 6. Error Handling

`parsePayload` throws on structural errors:
- `INVALID_JSON` — not valid JSON
- `UNSUPPORTED_PAYLOAD_VERSION` — `v !== 1`
- `MISSING_TX` / `MISSING_ASSET_ID` / `MISSING_BLOCKHASH` / `MISSING_BLOCK_HEIGHT` / `MISSING_CREATED_AT` / `INVALID_HOSPITAL` — field validation

`verifyPstPayload` returns `PstVerification` with `ok: false` + `reasons[]` for semantic failures (wrong PDA, missing accounts, bad signature, etc.).

`signAndSendPst` throws `UNVERIFIED_PAYLOAD` if verification wasn't run first, or `STALE_BLOCKHASH` if blockhash changed.

---

## 7. Usage in Frontend (`PstPanel.tsx`)

1. **Hospital clicks "Completar"** → `buildPartialTransaction` → renders `PstPayload` JSON in textarea + copy button.
2. **Technician pastes JSON** → `parsePayload` → `verifyPstPayload` → shows green/red checks per invariant.
3. **If all green** → "Firmar y enviar" enabled → `signAndSendPst` → toast with tx signature.
4. **Expiry countdown** visible; auto-disables when `slotsRemaining === 0`.

---

## 8. References

- Implementation: `app/src/utils/pst.ts`
- PDA derivation: `app/src/utils/pdas.ts`
- UI: `app/src/components/PstPanel.tsx`
- Technical debt note: `docs/TECHNICAL_DEBT.md#td-03b--transacci%C3%B3n-parcialmente-firmada-pst`
- Related issue: #14 (feat: dual-wallet complete_maintenance via PST hand-off)