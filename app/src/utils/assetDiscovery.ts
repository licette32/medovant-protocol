import type { Program } from '@coral-xyz/anchor'
import type { PublicKey } from '@solana/web3.js'
import type { OnChainAsset } from '@/components/EquipmentTable'
import { getAssetMeta, hydrateAssetMetadata } from '@/utils/assetMetadata'
import { mapAssetStatus } from '@/utils/formatters'

type LamportsLike = { toNumber?: () => number; toString?: () => string } | number

function lamportsToNum(v: LamportsLike): number {
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v.toString?.() ?? '0')
}

type RawMedicalAsset = {
  hospital: PublicKey
  assetId: { toString: () => string }
  status: Record<string, unknown>
  maintenanceReward: LamportsLike
  failureCount: number
  lastMaintenance: LamportsLike
}

function mapRawAsset(pda: PublicKey, account: RawMedicalAsset): OnChainAsset {
  const id = Number(account.assetId.toString())
  const hospital = account.hospital.toBase58()
  const meta = getAssetMeta(hospital, id)
  return {
    id,
    pda,
    name: meta?.name ?? `Asset #${id}`,
    location: meta?.location,
    status: mapAssetStatus(account.status),
    maintenanceReward: lamportsToNum(account.maintenanceReward),
    failureCount: account.failureCount,
    lastMaintenance: lamportsToNum(account.lastMaintenance),
    hospital,
  }
}

/**
 * Discovers every MedicalAsset PDA owned by this hospital wallet via
 * getProgramAccounts, filtered by the `hospital` field (offset 8, right
 * after the 8-byte Anchor discriminator). Replaces the old fixed-range
 * ID loops (#10, #2).
 */
export async function fetchHospitalAssets(
  program: Program,
  hospitalPubkey: PublicKey
): Promise<OnChainAsset[]> {
  const accounts = await (
    program.account as unknown as {
      medicalAsset: {
        all: (
          filters: { memcmp: { offset: number; bytes: string } }[]
        ) => Promise<{ publicKey: PublicKey; account: RawMedicalAsset }[]>
      }
    }
  ).medicalAsset.all([{ memcmp: { offset: 8, bytes: hospitalPubkey.toBase58() } }])

  await hydrateAssetMetadata([hospitalPubkey.toBase58()])

  return accounts
    .map(({ publicKey: pda, account }) => mapRawAsset(pda, account))
    .sort((a, b) => a.id - b.id)
}

/**
 * Discovers every MedicalAsset PDA across all hospitals (no owner filter),
 * used by the technician flow so jobs from any hospital surface. Callers
 * filter by status themselves since no status memcmp exists in the IDL.
 *
 * Uses a raw getProgramAccounts + per-account decode instead of
 * `program.account.medicalAsset.all()`: the typed namespace decodes inside
 * its own resp.map, so one malformed account poisons the whole batch.
 */
export async function fetchAllAssets(program: Program): Promise<OnChainAsset[]> {
  const raw = await program.provider.connection.getProgramAccounts(program.programId, {
    filters: [{ memcmp: program.coder.accounts.memcmp('medicalAsset') }],
  })

  // Accounts minted by an older program build share the same 8-byte
  // discriminator but predate maintenance_reward/failure_count (58 vs 70
  // bytes); decoding them throws RangeError and kills the whole fetch (#52).
  const EXPECTED_SIZE = 70

  const accounts = raw
    .filter(({ account }) => account.data.length === EXPECTED_SIZE)
    .map(({ pubkey: pda, account }) => ({
      publicKey: pda,
      account: program.coder.accounts.decode('medicalAsset', account.data) as RawMedicalAsset,
    }))

  const hospitals = [...new Set(accounts.map((a) => a.account.hospital.toBase58()))]
  await hydrateAssetMetadata(hospitals)

  return accounts
    .map(({ publicKey: pda, account }) => mapRawAsset(pda, account))
    .sort((a, b) => a.id - b.id)
}
