import type { AnchorProvider, Program } from '@coral-xyz/anchor'
import type { Connection } from '@solana/web3.js'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLang } from '@/i18n/LangContext'
import { showTxToast } from '@/components/Toast'
import type { OnTxSuccess } from '@/components/EquipmentTable'
import { getTechnicianProfilePDA } from '@/utils/pdas'
import { toastAnchorTxError } from '@/utils/solanaTxError'
import { truncatePubkey } from '@/utils/formatters'
import { isEvidenceConfigured } from '@/utils/evidence'
import EvidenceUploader from '@/components/EvidenceUploader'
import {
  buildPartialTransaction,
  formatPstExpiry,
  parsePayload,
  payloadToJson,
  signAndSendPst,
  slotsRemaining,
  verifyPstPayload,
  type PstPayload,
  type PstVerification,
} from '@/utils/pst'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  mode: 'hospital' | 'technician'
  /** hospital mode: the issue-reported asset being handed off */
  asset?: { id: number; name: string; maintenanceReward: number }
  onTxSuccess: OnTxSuccess
  onDone?: () => void | Promise<void>
}

type BusyState = 'idle' | 'building' | 'verifying' | 'submitting'

function usePstCountdown(payload: PstPayload | null, connection: Connection | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (!payload || !connection) {
      setSeconds(null)
      return
    }
    let cancelled = false
    let timer: number | undefined
    ;(async () => {
      try {
        const latest = await connection.getLatestBlockhash('confirmed')
        const slots = slotsRemaining(payload, latest.lastValidBlockHeight)
        const initial = Math.max(0, Math.round(slots * 0.4))
        if (cancelled) return
        setSeconds(initial)
        timer = window.setInterval(() => {
          setSeconds((s) => (s === null || s <= 0 ? 0 : Math.max(0, s - 1)))
        }, 1000)
      } catch {
        if (!cancelled) setSeconds(null)
      }
    })()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [payload, connection])

  return seconds
}

/**
 * Partially-signed transaction hand-off (#14 / TD-03b).
 * - hospital mode: builds complete_maintenance with the hospital as fee payer,
 *   signs it, and exposes the serialized payload to copy to the technician.
 * - technician mode: pastes the payload, verifies every PDA + the partial
 *   signature, shows a decoded summary, then signs and submits.
 */
export default function PstPanel({ program, publicKey, mode, asset, onTxSuccess, onDone }: Props) {
  const { t } = useLang()
  const connection = program ? ((program.provider as AnchorProvider).connection ?? null) : null

  const [technicianInput, setTechnicianInput] = useState('')
  const [generatedPayload, setGeneratedPayload] = useState<PstPayload | null>(null)
  const [busy, setBusy] = useState<BusyState>('idle')

  const [paste, setPaste] = useState('')
  const [verified, setVerified] = useState<PstVerification | null>(null)
  const [verifiedPayload, setVerifiedPayload] = useState<PstPayload | null>(null)
  const [escrowLamports, setEscrowLamports] = useState(0)
  const [completeSig, setCompleteSig] = useState<string | null>(null)

  const evidenceConfigured = isEvidenceConfigured()

  const countdown = usePstCountdown(
    mode === 'hospital' ? generatedPayload : verifiedPayload,
    connection
  )

  useEffect(() => {
    if (mode === 'hospital' && publicKey && technicianInput === '') {
      setTechnicianInput(publicKey.toBase58())
    }
  }, [mode, publicKey, technicianInput])

  const copyPayload = async () => {
    if (!generatedPayload) return
    try {
      await navigator.clipboard.writeText(payloadToJson(generatedPayload))
      toast.success(t('pstCopied'))
    } catch {
      toast.error(t('pstCopyFailed'))
    }
  }

  const handleGenerate = async () => {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return
    }
    let technician: PublicKey
    try {
      technician = new PublicKey(technicianInput.trim())
    } catch {
      toast.error(t('pstInvalidTechnician'))
      return
    }
    if (!asset) return
    setBusy('building')
    try {
      const { payload } = await buildPartialTransaction(program, {
        hospital: publicKey,
        technician,
        assetId: asset.id,
      })
      setGeneratedPayload(payload)
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setBusy('idle')
    }
  }

  const handleVerify = async () => {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return
    }
    setBusy('verifying')
    try {
      const parsed = parsePayload(paste)
      const result = verifyPstPayload(parsed, publicKey)
      setVerified(result)
      setVerifiedPayload(parsed)
      setCompleteSig(null)
      try {
        const acc = await (
          program.account as {
            medicalAsset: {
              fetch: (a: PublicKey) => Promise<{ maintenanceReward: { toString: () => string } }>
            }
          }
        ).medicalAsset.fetch(result.assetPda)
        setEscrowLamports(Number(acc.maintenanceReward.toString()))
      } catch {
        setEscrowLamports(0)
      }
      if (!result.ok) {
        toast.error(t('pstVerificationFailed'))
      } else {
        toast.success(t('pstVerified'))
      }
    } catch (e: unknown) {
      setVerified(null)
      setVerifiedPayload(null)
      setEscrowLamports(0)
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`${t('pstInvalidPayload')} (${msg})`)
    } finally {
      setBusy('idle')
    }
  }

  const handleSubmit = async () => {
    if (!program || !publicKey || !verifiedPayload || !verified) return
    if (countdown === 0) {
      toast.error(t('pstExpired'))
      return
    }
    setBusy('submitting')
    try {
      const techProfile = getTechnicianProfilePDA(publicKey)
      try {
        await (
          program.account as { technicianProfile: { fetch: (a: PublicKey) => Promise<unknown> } }
        ).technicianProfile.fetch(techProfile)
      } catch {
        const regSig = await program
          .methods.registerTechnician()
          .accounts({
            technician: publicKey,
            technicianProfile: techProfile,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        showTxToast(regSig)
        onTxSuccess(regSig, 'Technician profile registered', 'ok')
      }
      const sig = await signAndSendPst(program, verifiedPayload, verified)
      showTxToast(sig)
      setCompleteSig(sig)
      onTxSuccess(sig, t('pstSignedToast'), 'fix')
      setVerified(null)
      setVerifiedPayload(null)
      setPaste('')
      if (onDone) await Promise.resolve(onDone())
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setBusy('idle')
    }
  }

  const expired = countdown !== null && countdown <= 0

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--surface2)',
        padding: '14px 16px',
        marginTop: '14px',
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>
        {t(mode === 'hospital' ? 'pstTitle' : 'pstTechTitle')}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', lineHeight: 1.5, color: 'var(--text2)' }}>
        {t(mode === 'hospital' ? 'pstHospitalDesc' : 'pstTechDesc')}
      </p>

      {mode === 'hospital' ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '420px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{t('pstTechnicianWallet')}</span>
            <input
              type="text"
              value={technicianInput}
              onChange={(e) => setTechnicianInput(e.target.value)}
              placeholder={publicKey ? publicKey.toBase58() : '…'}
              disabled={busy !== 'idle'}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
              }}
            />
          </label>
          <button
            type="button"
            disabled={!program || !publicKey || busy !== 'idle'}
            onClick={() => void handleGenerate()}
            className="btn-complete"
            style={{
              marginTop: '10px',
              background: 'var(--cyan-d)',
              border: '1px solid var(--cyan-b)',
              color: 'var(--cyan)',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy === 'building' ? 'wait' : 'pointer',
              opacity: busy === 'building' ? 0.7 : 1,
            }}
          >
            {busy === 'building' ? t('fetching') : t('pstGenerate')}
          </button>
          {generatedPayload && (
            <>
              <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--text2)' }}>
                {t('pstPayloadHeader')}
              </div>
              <textarea
                readOnly
                value={payloadToJson(generatedPayload)}
                rows={6}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text2)',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => void copyPayload()}
                  className="btn-complete"
                  style={{
                    background: 'var(--surface3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('pstCopy')}
                </button>
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'DM Mono, monospace',
                    color: expired ? 'var(--red)' : 'var(--text2)',
                  }}
                >
                  {t('pstExpiresIn')}: {countdown === null ? '—' : formatPstExpiry(countdown)}
                  {expired ? ` · ${t('pstExpired')}` : ''}
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{t('pstPaste')}</span>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={t('pstPastePlaceholder')}
              rows={5}
              disabled={busy !== 'idle'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 10px',
                color: 'var(--text)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                resize: 'vertical',
              }}
            />
          </label>
          <button
            type="button"
            disabled={!program || !publicKey || busy !== 'idle' || paste.trim().length === 0}
            onClick={() => void handleVerify()}
            style={{
              marginTop: '10px',
              background: 'var(--cyan-d)',
              border: '1px solid var(--cyan-b)',
              color: 'var(--cyan)',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy === 'verifying' ? 'wait' : 'pointer',
              opacity: busy === 'verifying' || !paste.trim() ? 0.6 : 1,
            }}
          >
            {busy === 'verifying' ? t('fetching') : t('pstVerify')}
          </button>

          {verifiedPayload && verified && (
            <>
              <div
                style={{
                  marginTop: '12px',
                  border: '1px solid ' + (verified.ok ? 'var(--green-b)' : 'var(--red-b)'),
                  background: verified.ok ? 'var(--green-d)' : 'var(--red-d)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '12px', color: verified.ok ? 'var(--green)' : 'var(--red)' }}>
                  {verified.ok ? t('pstVerified') : t('pstVerificationFailed')}
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {t('pstSummaryAsset')}: <b style={{ color: 'var(--text)' }}>#{verifiedPayload.assetId}</b>
                  </span>
                  <span style={{ color: 'var(--text2)' }}>
                    {t('pstSummaryHospital')}:{' '}
                    <b style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>
                      {truncatePubkey(verifiedPayload.hospital)}
                    </b>
                  </span>
                  <span style={{ color: 'var(--text2)' }}>
                    {t('pstSummaryEscrow')}:{' '}
                    <b style={{ color: 'var(--amber)', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>
                      {(escrowLamports / 1e9).toFixed(4)} SOL
                    </b>
                  </span>
                  <span
                    style={{
                      color: expired ? 'var(--red)' : 'var(--text2)',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                    }}
                  >
                    {t('pstExpiresIn')}: {countdown === null ? '—' : formatPstExpiry(countdown)}
                    {expired ? ` · ${t('pstExpired')}` : ''}
                  </span>
                </div>
                {!verified.ok && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: '16px', color: 'var(--red)', fontSize: '12px' }}>
                    {verified.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              {evidenceConfigured && verifiedPayload && verified && (
                <div style={{ marginTop: '10px' }}>
                  <EvidenceUploader
                    assetPda={verified.assetPda.toBase58()}
                    hospital={verifiedPayload.hospital}
                    technician={publicKey ? publicKey.toBase58() : ''}
                    disabled={busy !== 'idle'}
                    txSignature={completeSig}
                    onUploaded={() => toast.success(t('evidenceUploaded'))}
                  />
                </div>
              )}
              <button
                type="button"
                disabled={!verified.ok || expired || busy !== 'idle'}
                onClick={() => void handleSubmit()}
                style={{
                  marginTop: '10px',
                  background: 'var(--green-d)',
                  border: '1px solid var(--green-b)',
                  color: 'var(--green)',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: busy === 'submitting' ? 'wait' : 'pointer',
                  opacity: !verified.ok || expired || busy !== 'idle' ? 0.6 : 1,
                }}
              >
                {busy === 'submitting' ? t('submitting') : t('pstSignSubmit')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}