export interface AssetMeta {
  name: string
  description?: string
  location?: string
  registeredAt: number
}

const STORAGE_KEY = 'medovant_asset_names'

/** Get stored metadata for a wallet + asset id (local only — not on-chain). */
export function getAssetMeta(walletPubkey: string, assetId: number): AssetMeta | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const all = JSON.parse(stored) as Record<string, AssetMeta>
    return all[`${walletPubkey}-${assetId}`] ?? null
  } catch {
    return null
  }
}

/** Persist equipment label for dashboard table (localStorage). */
export function saveAssetMeta(
  walletPubkey: string,
  assetId: number,
  meta: Omit<AssetMeta, 'registeredAt'>
): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const all: Record<string, AssetMeta> = stored ? JSON.parse(stored) : {}
    all[`${walletPubkey}-${assetId}`] = {
      ...meta,
      registeredAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    console.error('Failed to save asset metadata')
  }
}

/** Display label for table/modals — falls back when nothing stored locally. */
export function getAssetDisplayName(walletPubkey: string, assetId: number): string {
  const m = getAssetMeta(walletPubkey, assetId)
  return m?.name ?? `Asset #${assetId}`
}
