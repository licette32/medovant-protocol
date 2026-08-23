// Evidence: single writer for maintenance_events (TD-08 / #26).
// No external dependencies: talks to the Solana RPC and the Supabase REST +
// Storage APIs with plain fetch, so there is nothing to bundle. Verifies the
// complete_maintenance tx on-chain (program invoked, asset PDA touched,
// technician signer) before persisting anything.

const MEDOVANT_PROGRAM_ID = '5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD'
const DEVNET_RPC = 'https://api.devnet.solana.com'
const EVIDENCE_BUCKET = 'evidence'
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(DEVNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`RPC ${method} failed: HTTP ${res.status}`)
  const body = await res.json() as { error?: { message?: string }; result?: unknown }
  if (body.error) throw new Error(`RPC ${method} failed: ${body.error.message ?? 'unknown error'}`)
  return body.result
}

type ConfirmedTx = {
  meta?: { err?: unknown; logMessages?: string[] }
  transaction?: { message?: { accountKeys?: unknown; header?: { numRequiredSignatures?: number } } }
}

// A freshly-confirmed tx can take a few seconds to become readable through
// the RPC the function queries; one lookup is not enough to conclude failure.
const TX_LOOKUP_ATTEMPTS = 5
const TX_LOOKUP_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchConfirmedTx(sig: string): Promise<ConfirmedTx | null> {
  for (let attempt = 0; attempt < TX_LOOKUP_ATTEMPTS; attempt++) {
    const tx = (await rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }])) as ConfirmedTx | null
    if (tx) return tx
    if (attempt < TX_LOOKUP_ATTEMPTS - 1) await sleep(TX_LOOKUP_DELAY_MS)
  }
  return null
}

async function verifyMaintenanceTx(params: {
  txSignature: string
  assetPda: string
  technician: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sig = params.txSignature.trim()
  if (!BASE58_RE.test(sig)) {
    return { ok: false, error: 'Invalid transaction signature' }
  }

  let tx: ConfirmedTx
  try {
    tx = await fetchConfirmedTx(sig)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Transaction lookup failed' }
  }
  if (!tx) {
    return { ok: false, error: 'Transaction is still confirming — wait a few seconds and attach the evidence again' }
  }
  if (tx.meta?.err) return { ok: false, error: 'Transaction failed on-chain' }

  const logs: string[] = Array.isArray(tx.meta?.logMessages) ? tx.meta.logMessages : []
  if (!logs.some((l) => l.includes(`Program ${MEDOVANT_PROGRAM_ID} invoke`))) {
    return { ok: false, error: 'Transaction did not invoke the Medovant program' }
  }

  const rawKeys: unknown[] = Array.isArray(tx.transaction?.message?.accountKeys)
    ? tx.transaction.message.accountKeys
    : []
  const keys = rawKeys.map((k) => (typeof k === 'string' ? k : (k as { pubkey: string }).pubkey))
  if (!keys.some((k) => k === params.assetPda)) {
    return { ok: false, error: 'Transaction did not touch the claimed medical asset' }
  }

  let signers: string[]
  if (typeof rawKeys[0] === 'string') {
    const required = Number(tx.transaction?.message?.header?.numRequiredSignatures) || rawKeys.length
    signers = keys.slice(0, required)
  } else {
    signers = rawKeys
      .filter((k) => (k as { signer?: boolean }).signer)
      .map((k) => (k as { pubkey: string }).pubkey)
  }
  if (!signers.some((k) => k === params.technician)) {
    return { ok: false, error: 'Claimed technician did not sign the transaction' }
  }

  return { ok: true }
}

async function uploadFileToStorage(baseUrl: string, key: string, storagePath: string, file: File): Promise<string> {
  const res = await fetch(`${baseUrl}/storage/v1/object/${EVIDENCE_BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Storage upload failed: ${res.status} ${body.slice(0, 160)}`)
  }
  return `${baseUrl}/storage/v1/object/public/${EVIDENCE_BUCKET}/${storagePath}`
}

async function insertRow(baseUrl: string, key: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/rest/v1/maintenance_events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Insert failed: ${res.status} ${body.slice(0, 160)}`)
  }
  const rows = (await res.json()) as Record<string, unknown>[]
  return rows[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError('Server not configured', 500)
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    const assetPda = String(form.get('assetPda') ?? '')
    const hospital = String(form.get('hospital') ?? '')
    const technician = String(form.get('technician') ?? '')
    const txSignature = String(form.get('txSignature') ?? '')

    if (!(file instanceof File) || file.size === 0) {
      return jsonError('Missing evidence file', 400)
    }
    if (!assetPda || !hospital || !technician || !txSignature) {
      return jsonError('Missing required fields', 400)
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      return jsonError('Evidence file exceeds the 5 MB limit', 400)
    }

    const verification = await verifyMaintenanceTx({ txSignature, assetPda, technician })
    if (!verification.ok) {
      return jsonError(verification.error, 403)
    }

    const hash = await sha256Hex(new Uint8Array(await file.arrayBuffer()))
    const storagePath = `${assetPda}/${hash}.${fileExtension(file.name)}`
    const publicUrl = await uploadFileToStorage(supabaseUrl, serviceRoleKey, storagePath, file)

    const row = await insertRow(supabaseUrl, serviceRoleKey, {
      asset_pda: assetPda,
      hospital,
      technician,
      tx_signature: txSignature,
      evidence_url: publicUrl,
      evidence_hash: hash,
      evidence_mime: file.type,
    })

    return new Response(JSON.stringify(row), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('evidence function error', e)
    return jsonError('Internal error', 500)
  }
})