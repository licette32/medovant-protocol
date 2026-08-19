import { getSupabase, isSupabaseConfigured } from '@/utils/supabase'

const EVIDENCE_BUCKET = 'evidence'
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

export interface MaintenanceEvidence {
  readonly id: string
  readonly assetPda: string
  readonly hospital: string
  readonly technician: string
  readonly txSignature?: string
  readonly evidenceUrl?: string
  readonly evidenceHash?: string
  readonly evidenceMime?: string
  readonly createdAt: string
}

type EvidenceRow = {
  readonly id: string
  readonly asset_pda: string
  readonly hospital: string
  readonly technician: string
  readonly tx_signature: string | null
  readonly evidence_url: string | null
  readonly evidence_hash: string | null
  readonly evidence_mime: string | null
  readonly created_at: string
}

export function isEvidenceConfigured(): boolean {
  return isSupabaseConfigured()
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function rowToEvidence(row: EvidenceRow): MaintenanceEvidence {
  return {
    id: row.id,
    assetPda: row.asset_pda,
    hospital: row.hospital,
    technician: row.technician,
    txSignature: row.tx_signature ?? undefined,
    evidenceUrl: row.evidence_url ?? undefined,
    evidenceHash: row.evidence_hash ?? undefined,
    evidenceMime: row.evidence_mime ?? undefined,
    createdAt: row.created_at,
  }
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

/**
 * Uploads an evidence file to Supabase Storage and records the event row.
 * The SHA-256 of the uploaded bytes is stored so the hospital can verify the
 * attachment was not modified after the technician completed the job.
 */
export async function uploadEvidence(params: {
  file: File
  assetPda: string
  hospital: string
  technician: string
  txSignature?: string
}): Promise<MaintenanceEvidence> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const hash = await sha256Hex(params.file)
  const ext = fileExtension(params.file.name)
  const storagePath = `${params.assetPda}/${hash}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, params.file, { contentType: params.file.type, upsert: true })
  if (uploadError) throw new Error(uploadError.message)

  const { data: publicUrlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('maintenance_events')
    .insert({
      asset_pda: params.assetPda,
      hospital: params.hospital,
      technician: params.technician,
      tx_signature: params.txSignature ?? null,
      evidence_url: publicUrlData.publicUrl,
      evidence_hash: hash,
      evidence_mime: params.file.type,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToEvidence(data as EvidenceRow)
}

export async function fetchEvidenceForAsset(assetPda: string): Promise<MaintenanceEvidence[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('maintenance_events')
    .select('*')
    .eq('asset_pda', assetPda)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Medovant] Failed to load maintenance evidence:', error.message)
    return []
  }
  return (data ?? []).map((row) => rowToEvidence(row as EvidenceRow))
}

/** Links an evidence row to the escrow-release transaction once it lands. */
export async function attachEvidenceTxSignature(id: string, txSignature: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase
    .from('maintenance_events')
    .update({ tx_signature: txSignature })
    .eq('id', id)
  if (error) {
    console.error('[Medovant] Failed to link evidence to transaction:', error.message)
  }
}

export function validateEvidenceFile(file: File): string | null {
  if (file.size > MAX_EVIDENCE_BYTES) return 'evidenceTooLarge'
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  return allowed.includes(file.type) ? null : 'evidenceInvalidType'
}