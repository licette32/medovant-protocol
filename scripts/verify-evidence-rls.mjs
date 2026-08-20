#!/usr/bin/env node
/**
 * Verifies TD-08 (#26): the maintenance_events open-write hole is closed.
 *
 * Run against the live Supabase project AFTER applying schema.sql and
 * deploying the `evidence` Edge Function. Exit code 0 = all three rejections
 * work as expected.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_FUNCTIONS_URL=https://<ref>.functions.supabase.co \
 *   node scripts/verify-evidence-rls.mjs
 *
 * Requires Node >= 18 (global fetch + FormData/File).
 */

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } = process.env
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_FUNCTIONS_URL) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL')
  process.exit(2)
}

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const FAKE_ASSET_PDA = 'FAKEassetPda'.padEnd(44, 'A')
const FAKE_TECHNICIAN = 'FAKEtechnician'.padEnd(44, 'B')
const FAKE_TX = 'FAKEtxSignature'.padEnd(87, 'C')

const AUTH = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

let failures = 0

async function assertRejected(name, doCall, { allowStatus = null } = {}) {
  const res = await doCall()
  const status = res.status
  const body = await res.text()
  const ok = allowStatus === null ? status >= 400 : status === allowStatus
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} [status ${status}] ${body.slice(0, 200)}`)
  if (!ok) failures += 1
}

async function main() {
  // 1) Anon direct insert into maintenance_events must be rejected by RLS.
  await assertRejected(
    'anon INSERT into maintenance_events rejected',
    () =>
      fetch(`${SUPABASE_URL}/rest/v1/maintenance_events`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          asset_pda: FAKE_ASSET_PDA,
          hospital: FAKE_TECHNICIAN,
          technician: FAKE_TECHNICIAN,
        }),
      })
  )

  // 2) Anon file upload to the evidence bucket must be rejected.
  await assertRejected(
    'anon upload to evidence bucket rejected',
    () =>
      fetch(
        `${SUPABASE_URL}/storage/v1/object/evidence/${FAKE_ASSET_PDA}/fake.png`,
        {
          method: 'POST',
          headers: { ...AUTH, 'Content-Type': 'image/png' },
          body: PNG_BYTES,
        }
      )
  )

  // 3) Edge Function must reject a tx_signature that is not a real completed tx.
  const form = new FormData()
  form.append('file', new File([PNG_BYTES], 'fake.png', { type: 'image/png' }))
  form.append('assetPda', FAKE_ASSET_PDA)
  form.append('hospital', FAKE_TECHNICIAN)
  form.append('technician', FAKE_TECHNICIAN)
  form.append('txSignature', FAKE_TX)

  await assertRejected(
    'evidence Edge Function rejects unverified tx_signature',
    () => fetch(`${SUPABASE_FUNCTIONS_URL}/evidence`, { method: 'POST', body: form }),
    { allowStatus: 403 }
  )

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED — the open-write hole is NOT closed.`)
    process.exit(1)
  }
  console.log('\nAll checks passed: anon cannot write evidence rows or files, and the Edge Function rejects unverified txs.')
}

main().catch((e) => {
  console.error('Script error:', e)
  process.exit(1)
})