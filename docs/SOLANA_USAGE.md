# Solana usage — verifiable build and security.txt (SOL-01)

Program ID (Devnet, unchanged): `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`

## What changed

- Embedded `security.txt` via the `solana-security-txt` crate (resolved to
  v1.1.3): `programs/medovant/Cargo.toml` gains the dependency and
  `programs/medovant/src/lib.rs` gains the `security_txt!` block after
  `declare_id!`.
- Keep-alive static (`__MEDOVANT_SECURITY_TXT_KEEP`, `#[used]`): the crate
  only sets `link_section = ".security.txt"` for `target_arch = "bpf"`, but
  current toolchains build for `target_arch = "solana"`, and the verifiable
  image's linker garbage-collects the unreferenced static (verified: the
  first verifiable build had zero `security` strings). The `#[used]`
  reference keeps the markers in the binary on every toolchain, with no
  runtime cost and no logic change.
- Contact is project-only, no personal data: the GitHub issues URL
  (`link:https://github.com/licette32/medovant-protocol/issues`), policy
  pointing at `docs/SECURITY.md`.
- No program logic changed; `declare_id!` and all instructions are untouched,
  so the Program ID in README, docs, and frontend stays valid as-is.

## State of the deployed program (2026-10-09, read-only checks)

- On-chain Devnet binary sha256:
  `4c3f1c166005beef03715b1bfd7fec0a8258fd4effe89eddd23880ba236ec05b`
- The deployed binary contains **no** `security.txt` section — it predates
  this change and cannot match the new build until redeployed.

## Local build (exact commands and result)

Toolchain (WSL Ubuntu): `rustc 1.94.0`, `cargo 1.94.0`,
`solana-cli 3.1.10 (Agave)`, `anchor-cli 0.32.1`.

```bash
anchor build
sha256sum target/deploy/medovant.so
# ff76bf68f6c69e5e109241aa04d51cd0c5a9b515ab2e3a6e8bfb44f402d15743

# Confirm security.txt is embedded (markers + all fields):
strings target/deploy/medovant.so | grep 'SECURITY.TXT V1'
strings target/deploy/medovant.so | grep -E 'Medovant|licette32'

# Read-only comparison with the deployed binary:
solana program dump --url devnet \
  5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD /tmp/onchain-medovant.so
sha256sum /tmp/onchain-medovant.so
strings /tmp/onchain-medovant.so | grep -i 'security' || echo 'NO security.txt on-chain'
```

(The pre-keep-alive local hash `030d0bfe...` is superseded; it lacked the
`#[used]` static.)

## Deterministic verification (2026-10-10, Docker via Docker Desktop + WSL)

Repo's verifiable path is `anchor build --verifiable` (image
`solanafoundation/anchor:v0.32.1`, bundles `solana-cli 2.3.0` /
`rustc 1.90.0`):

```bash
anchor build --verifiable
sha256sum target/deploy/medovant.so
# ff76bf68f6c69e5e109241aa04d51cd0c5a9b515ab2e3a6e8bfb44f402d15743
solana-verify get-executable-hash target/deploy/medovant.so
# 6a2466c12c99f29d479dd7ae5e3d8c9b48aa804d4c2b1e27e4fb2d86e9ad7c52
strings target/deploy/medovant.so | grep -E 'Medovant|licette32'
# all security.txt fields present (name, project_url, contacts, policy)
```

Reproducibility checks (all byte-for-byte):
- Two consecutive `anchor build --verifiable` runs → identical sha256
  (`cmp` clean).
- Verifiable output == local `anchor build` output (`ff76...` both).
- Pre-fix verifiable output (`335b883b...`) had NO security strings —
  that build is discarded, do not deploy it.

Known limitation (not used): `solana-verify build` (Foundation images)
fails on this lockfile — its container platform rustc (1.79.0-dev) is
older than the MSRV of pinned deps (`indexmap@2.13.0` / `proc-macro-crate`
need rustc ≥ 1.82). Re-evaluate if the lockfile's Solana major changes.

## Owner redeploy checklist (manual, upgrade authority never shared/committed)

1. Check out the merged commit of this change; confirm the Program ID above.
2. `anchor build` and confirm `security.txt` is embedded (command above).
3. Deploy to Devnet with the upgrade authority keypair kept **outside** the
   repo; confirm the deployment targets the Program ID above before signing.
4. After deploy, confirm the match (run against the merged commit):

```bash
solana program dump --url devnet \
  5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD /tmp/onchain-new.so
sha256sum /tmp/onchain-new.so
# must equal ff76bf68... (sha256 of the full .so dumped from devnet)
```

5. Confirm readability on-chain:

```bash
strings /tmp/onchain-new.so | grep -A3 'BEGIN SECURITY.TXT'
```
