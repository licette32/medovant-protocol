import type { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { getEscrowVaultPDA, getMedicalAssetPDA, getTechnicianProfilePDA } from '@/utils/pdas'

const PROGRAM_ID = new PublicKey('5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD')

/**
 * Versioned hand-off payload (#14 / TD-03b). Transport-agnostic JSON: the
 * partially-signed Transaction (hospital only), the on-chain blockhash it was
 * built against, and the accounts needed to re-verify every PDA before the
 * technician signs.
 */
export interface PstPayload {
  readonly v: 1
  readonly tx: string
  readonly hospital: string
  readonly assetId: number
  readonly blockhash: string
  readonly lastValidBlockHeight: number
  readonly createdAt: number
}

export interface PstBuildResult {
  payload: PstPayload
  tx: Transaction
}

export interface PstVerification {
  ok: boolean
  reasons: string[]
  tx: Transaction
  hospital: PublicKey
  assetPda: PublicKey
  vaultPda: PublicKey
  techProfile: PublicKey
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function tryParsePubkey(value: unknown): PublicKey | null {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) return null
  try {
    return new PublicKey(value)
  } catch {
    return null
  }
}

export function payloadToJson(payload: PstPayload): string {
  return JSON.stringify(payload, null, 2)
}

export function parsePayload(input: string): PstPayload {
  let obj: unknown
  try {
    obj = JSON.parse(input)
  } catch {
    throw new Error('INVALID_JSON')
  }
  if (typeof obj !== 'object' || obj === null) throw new Error('INVALID_JSON')
  const p = obj as Record<string, unknown>
  if (p.v !== 1) throw new Error('UNSUPPORTED_PAYLOAD_VERSION')
  if (typeof p.tx !== 'string' || p.tx.length === 0) throw new Error('MISSING_TX')
  if (typeof p.assetId !== 'number' || !Number.isInteger(p.assetId) || p.assetId < 0) {
    throw new Error('MISSING_ASSET_ID')
  }
  if (typeof p.blockhash !== 'string' || p.blockhash.length === 0) throw new Error('MISSING_BLOCKHASH')
  if (typeof p.lastValidBlockHeight !== 'number') throw new Error('MISSING_BLOCK_HEIGHT')
  if (typeof p.createdAt !== 'number') throw new Error('MISSING_CREATED_AT')
  if (!tryParsePubkey(p.hospital)) throw new Error('INVALID_HOSPITAL')
  return p as unknown as PstPayload
}

export function deserializeTx(payload: PstPayload): Transaction {
  return Transaction.from(base64ToBytes(payload.tx))
}

/**
 * Builds an unsigned complete_maintenance Transaction with the hospital as fee
 * payer, signs it with the hospital wallet (partial signature), and returns the
 * hand-off payload. The technician account is intentionally left unsigned.
 */
export async function buildPartialTransaction(
  program: Program,
  opts: { hospital: PublicKey; technician: PublicKey; assetId: number }
): Promise<PstBuildResult> {
  const provider = program.provider as AnchorProvider
  const { hospital, technician, assetId } = opts
  const assetPda = getMedicalAssetPDA(hospital, assetId)
  const vaultPda = getEscrowVaultPDA(assetPda)
  const techProfile = getTechnicianProfilePDA(technician)

  const latest = await provider.connection.getLatestBlockhash('confirmed')
  const tx = await program.methods
    .completeMaintenance()
    .accounts({
      hospital,
      technician,
      medicalAsset: assetPda,
      escrowVault: vaultPda,
      technicianProfile: techProfile,
      systemProgram: SystemProgram.programId,
    })
    .transaction()

  tx.recentBlockhash = latest.blockhash
  tx.lastValidBlockHeight = latest.lastValidBlockHeight
  tx.feePayer = hospital

  const signed = await provider.wallet.signTransaction(tx)
  const payload: PstPayload = {
    v: 1,
    tx: bytesToBase64(signed.serialize({ requireAllSignatures: false })),
    hospital: hospital.toBase58(),
    assetId,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    createdAt: Date.now(),
  }
  return { payload, tx: signed }
}

/**
 * Parses the hand-off payload, re-derives every PDA from the trusted fields
 * (hospital + assetId) and cross-checks them against the instruction account
 * metas. Also asserts exactly one valid partial signature from the hospital.
 * Throws on structurally broken payloads (INVALID_*).
 */
export function verifyPstPayload(payload: PstPayload, technician: PublicKey): PstVerification {
  const reasons: string[] = []
  let ok = true
  const fail = (reason: string) => {
    ok = false
    reasons.push(reason)
  }

  let tx: Transaction
  try {
    tx = deserializeTx(payload)
  } catch {
    throw new Error('INVALID_TX')
  }

  const hospital = new PublicKey(payload.hospital)
  const assetPda = getMedicalAssetPDA(hospital, payload.assetId)
  const vaultPda = getEscrowVaultPDA(assetPda)
  const techProfile = getTechnicianProfilePDA(technician)
  const result = () => ({ ok, reasons, tx, hospital, assetPda, vaultPda, techProfile })

  if (tx.recentBlockhash !== payload.blockhash) fail('blockhash does not match payload')
  const instruction = tx.instructions.find((ix) => ix.programId.equals(PROGRAM_ID))
  if (!instruction) {
    fail('no medovant instruction found in transaction')
    return result()
  }
  const has = (pk: PublicKey) => instruction.keys.some((k) => k.pubkey.equals(pk))

  if (!has(hospital)) fail('hospital account missing from instruction')
  if (!has(assetPda)) fail('asset PDA does not match hospital + assetId')
  if (!has(vaultPda)) fail('escrow vault PDA does not match asset')
  if (!has(techProfile)) fail('technician profile PDA does not match your wallet')
  if (!has(SystemProgram.programId)) fail('system program missing from instruction')
  if (tx.feePayer && !tx.feePayer.equals(hospital)) fail('fee payer is not the hospital')

  const signatures = tx.signatures.filter((s) => s.signature !== null)
  if (signatures.length !== 1) {
    fail(`expected exactly one partial signature, got ${signatures.length}`)
  } else {
    if (!signatures[0].publicKey.equals(hospital)) fail('partial signature is not from the hospital')
    let valid = false
    try {
      valid = tx.verifySignatures(false)
    } catch {
      valid = false
    }
    if (!valid) fail('partial signature is invalid')
  }

  return result()
}

/**
 * Adds the technician wallet signature to the restored partial transaction and
 * submits it. Fails if a verifier was not run first (defense in depth).
 */
export async function signAndSendPst(
  program: Program,
  payload: PstPayload,
  verification: PstVerification
): Promise<string> {
  if (!verification.ok) throw new Error('UNVERIFIED_PAYLOAD')
  const provider = program.provider as AnchorProvider
  if (verification.tx.recentBlockhash !== payload.blockhash) throw new Error('STALE_BLOCKHASH')
  const signed = await provider.wallet.signTransaction(verification.tx)
  const raw = signed.serialize()
  const signature = await provider.connection.sendRawTransaction(raw, { skipPreflight: false })
  await provider.connection.confirmTransaction({ signature, blockhash: payload.blockhash, lastValidBlockHeight: payload.lastValidBlockHeight })
  return signature
}

/** Remaining number of slots before the blockhash expires, or 0 when expired. */
export function slotsRemaining(payload: PstPayload, currentBlockHeight: number): number {
  return Math.max(0, payload.lastValidBlockHeight - currentBlockHeight)
}

export function formatPstExpiry(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}