import { PublicKey } from '@solana/web3.js'
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase'
import { getMedicalAssetPDA } from '@/utils/pdas'

export interface AssetMeta {
  readonly name: string
  readonly description?: string
  readonly location?: string
  readonly assetType?: string
  readonly registeredAt: number
}

type AssetRow = {
  readonly asset_pda: string
  readonly hospital: string
  readonly name: string
  readonly location: string | null
  readonly asset_type: string | null
  readonly created_at: string
}

const STORAGE_KEY = 'medovant_asset_names'

// Supabase is the source of truth; the session cache keeps render-time reads
// sync after hydration. Without env config the legacy localStorage store is
// used so the demo keeps working (keyed by `${hospital}-${assetId}`).
const cache = new Map<string, AssetMeta>()
const migratedHospitals = new Set<string>()

function pdaOf(hospital: string, assetId: number): string {
  return getMedicalAssetPDA(new PublicKey(hospital), assetId).toBase58()
}

function legacyKey(hospital: string, assetId: number): string {
  return `${hospital}-${assetId}`
}

function rowToMeta(row: AssetRow): AssetMeta {
  return {
    name: row.name,
    location: row.location ?? undefined,
    assetType: row.asset_type ?? undefined,
    registeredAt: Date.parse(row.created_at) || Date.now(),
  }
}

function localStorageAll(): Record<string, AssetMeta> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Record<string, AssetMeta>) : {}
  } catch {
    return {}
  }
}

function saveLocalStorageAll(all: Record<string, AssetMeta>): void {
  try {
    if (Object.keys(all).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    }
  } catch {
    console.error('Failed to save asset metadata')
  }
}

export function getAssetMeta(walletPubkey: string, assetId: number): AssetMeta | null {
  const hit = cache.get(pdaOf(walletPubkey, assetId))
  if (hit) return hit
  if (!isSupabaseConfigured()) {
    return localStorageAll()[legacyKey(walletPubkey, assetId)] ?? null
  }
  return null
}

export function getAssetDisplayName(walletPubkey: string, assetId: number): string {
  const m = getAssetMeta(walletPubkey, assetId)
  return m?.name ?? `Asset #${assetId}`
}

export async function hydrateAssetMetadata(hospitals: string[]): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const unique = [...new Set(hospitals)]
  if (unique.length === 0) return

  const { data, error } = await supabase
    .from('assets')
    .select('asset_pda, hospital, name, location, asset_type, created_at')
    .in('hospital', unique)

  if (error) {
    console.error('[Medovant] Failed to load asset metadata:', error.message)
    return
  }

  for (const row of data ?? []) {
    cache.set(row.asset_pda, rowToMeta(row))
  }

  await migrateLocalStorageFor(unique)
}

// One-time per-hospital migration so existing localStorage data isn't lost
// when Supabase comes online.
async function migrateLocalStorageFor(hospitals: string[]): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const pending = hospitals.filter((h) => !migratedHospitals.has(h))
  if (pending.length === 0) return

  const all = localStorageAll()
  const hospitalSet = new Set(pending)
  const rows: AssetRow[] = []
  const migratedKeys: string[] = []

  for (const [k, meta] of Object.entries(all)) {
    const sep = k.lastIndexOf('-')
    const hospital = k.slice(0, sep)
    const assetId = Number(k.slice(sep + 1))
    if (!hospitalSet.has(hospital) || !Number.isInteger(assetId)) continue
    const pda = pdaOf(hospital, assetId)
    rows.push({
      asset_pda: pda,
      hospital,
      name: meta.name,
      location: meta.location ?? null,
      asset_type: meta.assetType ?? null,
      created_at: new Date(meta.registeredAt).toISOString(),
    })
    cache.set(pda, meta)
    migratedKeys.push(k)
  }

  if (rows.length === 0) {
    for (const h of pending) migratedHospitals.add(h)
    return
  }

  const { error } = await supabase.from('assets').upsert(rows, { onConflict: 'asset_pda' })
  if (error) {
    console.error('[Medovant] Local metadata migration failed:', error.message)
    return
  }

  for (const h of pending) migratedHospitals.add(h)
  for (const k of migratedKeys) delete all[k]
  saveLocalStorageAll(all)
}

export async function upsertAssetMeta(
  hospital: string,
  assetId: number,
  meta: Omit<AssetMeta, 'registeredAt'>
): Promise<void> {
  const pda = pdaOf(hospital, assetId)
  const now = Date.now()
  const full: AssetMeta = { ...meta, registeredAt: now }

  const supabase = getSupabase()
  if (supabase) {
    const { error } = await supabase
      .from('assets')
      .upsert(
        {
          asset_pda: pda,
          hospital,
          name: full.name,
          location: full.location ?? null,
          asset_type: full.assetType ?? null,
          created_at: new Date(now).toISOString(),
        },
        { onConflict: 'asset_pda' }
      )
    if (error) {
      console.error('[Medovant] Failed to save asset metadata:', error.message)
    }
  } else {
    const all = localStorageAll()
    all[legacyKey(hospital, assetId)] = full
    saveLocalStorageAll(all)
  }

  cache.set(pda, full)
}