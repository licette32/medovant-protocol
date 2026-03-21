# Medovant Protocol

> Verifiable maintenance protocol for critical infrastructure on Solana.

Medovant is a Solana program (Anchor + Rust) for managing the lifecycle of medical
equipment in hospitals. Each piece of equipment lives as a PDA on-chain with a
verifiable state machine, immutable event history, and on-chain payment to technicians.

---

## What it does

Hospitals can:

- **Register equipment** — create a PDA account per device
- **Report issues** — mark a device as broken (only from Active state)
- **Complete maintenance** — record the repair and pay the technician in lamports
- **Decommission** — close the account and recover the rent

Each device has a status (`Active`, `IssueReported`, `UnderMaintenance`, `Decommissioned`).
Only valid transitions are allowed. The hospital owns the record; the technician
co-signs when completing maintenance.

---

## Why blockchain

A traditional database can be edited or deleted. On Solana:

- Every state transition is a signed transaction — immutable and auditable
- Payment to the technician happens atomically in the same instruction as the status update
- PDAs give each device a deterministic, verifiable on-chain address
- No intermediary controls the data or the funds

---

## Program accounts

### `MedicalAsset` (PDA)

Seeds: `["equipment", hospital_pubkey, asset_id as u64 LE]`

| Field | Type | Description |
|---|---|---|
| hospital | Pubkey | Owner and authority |
| asset_id | u64 | Equipment identifier |
| status | AssetStatus | Current state |
| last_maintenance | i64 | Unix timestamp of last maintenance |
| bump | u8 | PDA bump seed |

### Asset states

| State | Description |
|---|---|
| Active | Operational — initial state and post-maintenance |
| IssueReported | Failure reported — maintenance required |
| UnderMaintenance | Reserved for future flows |
| Decommissioned | Decommissioned — account closed |

---

## Instructions

| Instruction | Signer(s) | What it does |
|---|---|---|
| `initialize_asset(asset_id)` | hospital | Creates PDA, status = Active |
| `report_issue` | hospital | status = IssueReported |
| `complete_maintenance` | hospital + technician | Pays technician, status = Active |
| `decommission_asset` | hospital | Closes PDA, rent returned |

---

## Stack

| Layer | Technology |
|---|---|
| Blockchain | Solana Devnet |
| Smart contract | Anchor 0.32.1 · Rust |
| Tests | TypeScript · ts-mocha |
| Client | TypeScript · Node.js |

---

## Project structure

```
medovant-protocol/
├── programs/
│   └── medovant/
│       ├── src/lib.rs       ← Anchor program
│       └── Cargo.toml
├── tests/
│   └── medovant.test.ts     ← Full test suite
├── client/
│   └── client.ts            ← Devnet client
├── Anchor.toml
├── Cargo.toml
└── package.json
```

---

## Deployment

| | |
|---|---|
| **Program ID** | `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD` |
| **Network** | Solana Devnet |
| **Upgrade Authority** | `2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76` |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet) |

---

## Running locally

```bash
anchor keys sync
npm install
anchor build
anchor test
```

For the Devnet client:

```bash
# Set env vars: ANCHOR_PROVIDER_URL, ANCHOR_WALLET
yarn client:devnet
```

**Requirements:** Rust, Solana CLI, Anchor CLI 0.32.1, Node.js v18+

---

*Built during Solana LATAM Hackathon 2026 — March 20–23.*