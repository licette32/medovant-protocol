import { getSupabase, isSupabaseConfigured } from '@/utils/supabase'

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

function evidenceFunctionUrl(): string | null {
  return (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined)?.trim() || null
}

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
  return isSupabaseConfigured() && Boolean(evidenceFunctionUrl())
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

/**
 * Submits evidence to the `evidence` Edge Function AFTER the maintenance tx
 * lands. The function verifies tx_signature against the Solana RPC (program
 * ID, asset PDA, technician signer) before uploading the file and inserting
 * the row with the service role, so the anon key can never write directly.
 * The SHA-256 of the uploaded bytes is stored so the hospital can verify the
 * attachment was not modified after the technician completed the job.
 */
export async function submitEvidence(params: {
  file: File
  assetPda: string
  hospital: string
  technician: string
  txSignature: string
}): Promise<MaintenanceEvidence> {
  const baseUrl = evidenceFunctionUrl()
  if (!baseUrl) throw new Error('Evidence Edge Function not configured')

  const form = new FormData()
  form.append('file', params.file)
  form.append('assetPda', params.assetPda)
  form.append('hospital', params.hospital)
  form.append('technician', params.technician)
  form.append('txSignature', params.txSignature)

  const res = await fetch(`${baseUrl}/evidence`, { method: 'POST', body: form })
  const body: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new Error(message ?? `Evidence submission failed (${res.status})`)
  }
  return rowToEvidence(body as EvidenceRow)
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

export function validateEvidenceFile(file: File): string | null {
  if (file.size > MAX_EVIDENCE_BYTES) return 'evidenceTooLarge'
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  return allowed.includes(file.type) ? null : 'evidenceInvalidType'
}

/**
 * Downloads the evidence attachment and recomputes its SHA-256 to confirm it
 * still matches the hash recorded at upload time (SEC-03). Returns 'verified'
 * when they match, 'mismatch' when the file was modified, and throws when the
 * file cannot be fetched (e.g. CORS/network blocks the download).
 */
export async function verifyEvidenceIntegrity(evidence: MaintenanceEvidence): Promise<'verified' | 'mismatch'> {
  if (!evidence.evidenceUrl || !evidence.evidenceHash) {
    throw new Error('Evidence has no hash to verify')
  }
  const res = await fetch(evidence.evidenceUrl)
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`)
  const digest = await crypto.subtle.digest('SHA-256', await res.arrayBuffer())
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === evidence.evidenceHash ? 'verified' : 'mismatch'
}