# Scope and limitations

Last reviewed against the code: 2026-10-08.

## Scope

Medovant is a prototype on Solana Devnet: an Anchor program, a web app with hospital and technician modes, and off-chain storage on Supabase for asset
metadata and maintenance evidence.

Working today: asset registration, issue reporting with funds locked in a program-controlled escrow, release on sign-off by both parties, technician
reputation, and evidence upload with SHA-256 integrity check.

## Known limitations

- **Devnet only.** The program is deployed at `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD` on Devnet. There is no Mainnet deployment.
- **Native SOL escrow only.** SPL tokens and stablecoins are not supported.
- **No dispute, expiry or refund.** Once an issue is reported, funds stay locked until `complete_maintenance` runs. There is no cancel instruction.
- **No event indexer.** Assets are discovered by reading on-chain accounts directly.
- **Off-chain parts need configuration.** Metadata and evidence depend on a Supabase project and a manually deployed upload function.
- **Program build is not yet verifiable** against the repository source.

## Open research

Regulatory, legal and market questions are tracked in [docs/research/](research/README.md).