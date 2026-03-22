export function truncatePubkey(pk: string): string {
  return pk.slice(0, 8) + '...' + pk.slice(-4)
}

export function truncateSig(sig: string): string {
  return sig.slice(0, 8) + '...' + sig.slice(-4)
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4)
}

/** Anchor deserializes enum variants as object keys — normalize for UI. */
export function mapAssetStatus(status: Record<string, unknown>): string {
  if ('active' in status) return 'Active'
  if ('issueReported' in status) return 'Issue Reported'
  if ('underMaintenance' in status) return 'Under Maintenance'
  if ('decommissioned' in status) return 'Decommissioned'
  return 'Unknown'
}
