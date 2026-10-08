# RES-03 — Personal data and on-chain design

## Metadata

| Field | Value |
|-------|-------|
| ID | RES-03 |
| Title | Personal data and on-chain design |
| Issue | [#83](https://github.com/licette32/medovant-protocol/issues/83) |
| Status | open |
| Date | 2026-10-08 |
| Author | TBD |

## Question

What may go on-chain given Ley 25.326 (authority: AAIP), knowing that a
technician wallet with completed jobs may be personal data and public chains
are immutable?

Background: Ley 25.326 applies to personal data. A technician wallet with
completed jobs may be personal data, and public chains are immutable.
Goal: define what may go on-chain.

## Sources

| # | Source | Type | Date consulted | Notes |
|---|--------|------|----------------|-------|
| 1 | TBD — Ley 25.326 / AAIP guidance | official | TBD | Pending (per #83 requirements) |

## Findings

_TBD — out of scope for RES-00 (#80). To be completed under #83, including the
data-minimization decision._

Data map (pending):

| Data item | Location (on-chain / off-chain) | Could identify a person? | Notes |
|-----------|---------------------------------|--------------------------|-------|
| TBD (e.g. technician wallet + job history) | TBD | TBD | Pending |
| TBD (e.g. evidence hash / CID) | TBD | TBD | Review erasure question |

## Confidence

- [x] **Not assessed** — research not started yet.

Justification: placeholder created under #80; data-minimization decision pending under #83.

## Open questions

- Which stored items (on-chain and off-chain) could identify a person?
- How does the erasure question resolve against immutability?
- Is the evidence design (hash/CID only on-chain) sufficient for minimization?

## Next step

- Owner: TBD — Action: build the on-chain / off-chain / identifying data map and document the minimization decision (per #83) — Due: TBD
