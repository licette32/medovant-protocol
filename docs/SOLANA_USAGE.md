# Solana usage — verifiable build and security.txt (SOL-01)

Program ID (Devnet, unchanged): `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`

Source commit: `a176e86` (branch `sol/90-verifiable-build-security-txt`)

## What changed

- Embedded `security.txt` via the `solana-security-txt` crate:
  `programs/medovant/Cargo.toml` gains the dependency and
  `programs/medovant/src/lib.rs` gains the `security_txt!` block after
  `declare_id!`, gated behind `#[cfg(not(feature = "no-entrypoint"))]`.
  Fields: `name`, `project_url`, `contacts`, `policy`, `source_code`,
  `preferred_languages: "en"`.
- A `#[used]` static (`__MEDOVANT_SECURITY_TXT_KEEP`) references the `security.txt` data so it stays in the compiled binary. The presence of the fields in the deployed program was confirmed with the `strings` command below.
- Contact is project-only, no personal data: the GitHub issues URL
  (`link:https://github.com/licette32/medovant-protocol/issues`), `policy`
  pointing at `docs/SECURITY.md`, `source_code` pointing at the repo root.
- Dependency pins required by the build image's rustc (recorded in
  `Cargo.lock`, no program logic change): `indexmap 2.13.0 -> 2.9.0` and
  `proc-macro-crate 3.5.0 -> 3.3.0` (`hashbrown 0.16.1 -> 0.15.5` follows).
- No program logic changed; `declare_id!` and all instructions are
  untouched, so the Program ID in README, docs, and frontend stays valid
  as-is.

## Deterministic build

Run from WSL (Docker available):

```bash
solana-verify build --library-name medovant
```

- Docker image Solana v2.2.2, container Rust 1.84.1.
- Executable hash:
  `3289924ba95aec375589299f8dde88f785c728b9a1c46d31ad260764e20a31bc`
- Artifact size: 238120 bytes; ProgramData allocation 259664 bytes
  (no extend needed).

## Deploy (2026-10-10)

```bash
solana program deploy target/deploy/medovant.so --program-id 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD --url devnet
```

- Signature:
  `4Sa1Z3N2VLEL5xaTm2ETe2w2kJYCyafi9Q47MrFx2qDYnFTPkZKStJiRJdZcsF3FsHmP5DgnsFUMfMKTPPTyGCbh`
- Date: 2026-10-10.
- Upgrade authority: `2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76`
  (kept outside the repo, never committed).
- New deploy slot: 509648761.

## Check

```bash
solana-verify get-program-hash 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD --url devnet
# returned 3289924ba95aec375589299f8dde88f785c728b9a1c46d31ad260764e20a31bc
```

The hash of the on-chain program matches the hash of the deterministic build of commit a176e86.

security.txt is readable on-chain:

```bash
solana program dump 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD /tmp/onchain-medovant.so --url devnet
strings -n 2 /tmp/onchain-medovant.so | grep -A14 "BEGIN SECURITY.TXT"
# shows name, project_url, contacts, policy, source_code, preferred_languages
```

Note: `solana-verify verify-from-repo` was not run; it is an optional step
that requires a public repo.

## History (before this deployment)

- On-chain Devnet binary sha256:
  `4c3f1c166005beef03715b1bfd7fec0a8258fd4effe89eddd23880ba236ec05b`
  — it predated this change and contained no `security.txt`.

## Warning

Do not use `anchor deploy` or `anchor keys sync`: the local program
keypair in the build directory does not match the deployed program ID
(OPS-01). Upgrades use `solana program deploy` with `--program-id` and
the upgrade authority, confirming the deployment targets the Program ID
above before signing.

## Reproduce

Build (from WSL, Docker available):

```bash
solana-verify build --library-name medovant
solana-verify get-executable-hash target/deploy/medovant.so
# must equal 3289924ba95aec375589299f8dde88f785c728b9a1c46d31ad260764e20a31bc
strings -n 2 target/deploy/medovant.so | grep -A14 "BEGIN SECURITY.TXT"
```

Check against Devnet:

```bash
solana-verify get-program-hash 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD --url devnet
solana program dump 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD /tmp/onchain-medovant.so --url devnet
strings -n 2 /tmp/onchain-medovant.so | grep -A14 "BEGIN SECURITY.TXT"
```
