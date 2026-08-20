export function truncatePubkey(pk: string): string {
  return pk.slice(0, 8) + '...' + pk.slice(-4)
}

/** Solana tx signatures are base58 (~87 chars). Coerce unknown wallet/Anchor return values. */
export function normalizeTxSignature(sig: unknown): string | undefined {
  if (sig == null) return undefined
  const s = String(sig).trim()
  // Typical Solana tx sig is ~87 base58 chars; reject garbage / wrong types early
  if (s.length < 64 || s.length > 200) return undefined
  return s
}

export function truncateSig(sig: string): string {
  if (typeof sig !== 'string' || sig.length === 0) return '—'
  if (sig.length <= 12) return sig
  return sig.slice(0, 8) + '...' + sig.slice(-4)
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4)
}

/** Anchor deserializes enum variants as object keys — normalize for UI. */
export function mapAssetStatus(status: Record<string, unknown>): string {
  if ('active' in status) return 'Active'
  if ('issueReported' in status) return 'Issue Reported'
  if ('decommissioned' in status) return 'Decommissioned'
  return 'Unknown'
}
