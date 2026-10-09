# Starting point — contest period

> **Note:** this record was reconstructed from git history after the fact.
> Every item below is verifiable at the cutoff commit using the commands in
> [How to verify](#how-to-verify).

## Cutoff

- Contest period starts: **2026-09-14 06:00 PT** (10:00 ART, UTC-3).
- Last commit before that date:

| Field | Value |
|-------|-------|
| Hash | `253a96da80dfac2a89bdb9d3a1d2d8706a0649f3` |
| Date | 2026-08-31 22:45:39 -0300 |
| Message | `docs: actualizar estado de incubación en README` |

- Reconstructed with: `git log --until="2026-09-14 10:00 -0300"`.
- No commits exist between that commit and the contest start date.

## Background (one line)

The project graduated from the Solana Latam Labs / WayLearn incubation (June–August 2026), with Demo Day completed on 2026-08-31.

## What existed at the cutoff commit

### Anchor program (Solana Devnet)

| Field | Value |
|-------|-------|
| Program ID | `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD` |
| Network | Devnet (not Mainnet) |
| Framework | Anchor 0.32.1 |
| Source | `programs/medovant/src/lib.rs` (369 lines) |
| Upgrade authority | `2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76` |

Instructions: `register_technician`, `initialize_asset`, `report_issue`,
`complete_maintenance`, `decommission_asset`. Maintenance payments are held in
a program-controlled vault PDA (escrow) and released on verified completion;
technician reputation is tracked in an on-chain profile PDA.

### Tests

- `tests/medovant.test.ts` — **15 tests passing** (`anchor test`).
- Suites: full asset lifecycle (`initialize_asset` → `report_issue` →
  `complete_maintenance` → `decommission_asset`), edge cases (double
  registration, unregistered technician, wrong-signer technician, decommission
  with active escrow), and `complete_maintenance` replay protection.

### Frontend (`app/`)

- Stack: React 18 + Vite + TypeScript + Tailwind CSS, Phantom wallet adapter.
- Hospital dashboard (asset registry, issue reporting, maintenance approval),
  Technician dashboard (available jobs, one-click complete & get paid),
  read-only admin panel, PST (partially-signed transaction) hand-off flow.
- Off-chain metadata and evidence via Supabase (`assets` and
  `maintenance_events` tables, `evidence` storage bucket with SHA-256 hash
  verification); value-first landing, role selection, bilingual EN/ES,
  light/dark mode.

### Docs (`docs/`)

11 files: `ARCHITECTURE.md`, `DATA_MODEL.md`, `DEPLOYMENT.md`,
`DOCUMENTACION_TECNICA.md`, `INTEGRATION_GUIDE.md`, `PST_HANDOFF.md`,
`RUNBOOK.md`, `SECURITY.md`, `TECHNICAL_DEBT.md`, `TECHNICAL_DOCUMENTATION.md`,
`TESTING.md`. CI ran Anchor tests plus the frontend typecheck
(`.github/workflows/ci.yml`).

### Off-chain (`supabase/`)

`supabase/schema.sql` (tables, `evidence` bucket, RLS policies), one applied
migration (`20260820000000_td08_close_open_writes.sql`), and the evidence edge
function (`supabase/functions/evidence/index.ts`).

## Users, revenue and funding as of the contest start date

| Metric | State |
|--------|-------|
| Users | No production users — Devnet demo only |
| Revenue | None recorded in the repository |
| Funding | No external funding recorded in the repository; built through a hackathon MVP plus the incubation program above |

## How to verify

```bash
git show 253a96da80dfac2a89bdb9d3a1d2d8706a0649f3 --stat
git ls-tree -r --name-only 253a96da80dfac2a89bdb9d3a1d2d8706a0649f3 docs/
git show 253a96da80dfac2a89bdb9d3a1d2d8706a0649f3:README.md
git show 253a96da80dfac2a89bdb9d3a1d2d8706a0649f3:programs/medovant/src/lib.rs
```
