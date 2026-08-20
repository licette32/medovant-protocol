import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import { fetchEvidenceForAsset, verifyEvidenceIntegrity, type MaintenanceEvidence } from '@/utils/evidence'

type Props = {
  assetPda: string
  /** Refresh the list after a tx completes. */
  refreshKey?: number
}

type VerifyState = 'checking' | 'verified' | 'mismatch' | 'error'

function isImage(mime?: string): boolean {
  return Boolean(mime && mime.startsWith('image/'))
}

function formatTimestamp(iso: string, lang: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(lang === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Read-only evidence list for the hospital to review before approving a
 * maintenance release (#4, SEC-03). Shows the attachment, its SHA-256 and who
 * uploaded it, and recomputes the hash client-side to mark each file as
 * verified (✓) or tampered (✗) before the hospital signs. Hides entirely when
 * Supabase is not configured.
 */
export default function EvidenceList({ assetPda, refreshKey }: Props) {
  const { t, lang } = useLang()
  const [items, setItems] = useState<MaintenanceEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [verify, setVerify] = useState<Record<string, VerifyState>>({})
  const verifiedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchEvidenceForAsset(assetPda).then((rows) => {
      if (cancelled) return
      setItems(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [assetPda, refreshKey])

  const runVerify = useCallback((item: MaintenanceEvidence) => {
    if (!item.evidenceUrl || !item.evidenceHash) return
    setVerify((v) => ({ ...v, [item.id]: 'checking' }))
    void verifyEvidenceIntegrity(item)
      .then((result) => setVerify((v) => ({ ...v, [item.id]: result })))
      .catch(() => setVerify((v) => ({ ...v, [item.id]: 'error' })))
  }, [])

  useEffect(() => {
    for (const item of items) {
      if (item.evidenceUrl && item.evidenceHash && !verifiedIds.current.has(item.id)) {
        verifiedIds.current.add(item.id)
        runVerify(item)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  if (loading) {
    return (
      <div style={{ fontSize: '13px', color: 'var(--text2)', padding: '4px 0' }}>{t('evidenceLoading')}</div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed var(--border)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          color: 'var(--text3)',
          background: 'var(--surface2)',
        }}
      >
        {t('evidenceNone')}
      </div>
    )
  }

  const states = items.map((i) => verify[i.id]).filter(Boolean) as VerifyState[]
  const anyMismatch = states.includes('mismatch')
  const allVerified = items.length > 0 && items.every((i) => verify[i.id] === 'verified')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {anyMismatch && (
        <div
          style={{
            border: '1px solid var(--red)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--red)',
            background: 'var(--surface2)',
          }}
        >
          ✗ {t('evidenceBannerBad')}
        </div>
      )}
      {!anyMismatch && allVerified && (
        <div
          style={{
            border: '1px solid var(--green)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--green)',
            background: 'var(--surface2)',
          }}
        >
          ✓ {t('evidenceBannerOk')}
        </div>
      )}
      {items.map((item) => {
        const state = verify[item.id]
        return (
          <div
            key={item.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 14px',
              background: 'var(--surface2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              {item.evidenceUrl && (
                <a
                  href={item.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cyan)' }}
                >
                  {isImage(item.evidenceMime) ? '🖼' : '📄'} {t('evidenceView')} ↗
                </a>
              )}
              {state === 'checking' && (
                <span style={{ fontSize: '12px', color: 'var(--text3)' }}>… {t('evidenceVerifying')}</span>
              )}
              {state === 'verified' && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>
                  ✓ {t('evidenceVerified')}
                </span>
              )}
              {state === 'mismatch' && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)' }}>
                  ✗ {t('evidenceMismatch')}
                </span>
              )}
              {state === 'error' && (
                <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  {t('evidenceVerifyError')}{' '}
                  <button
                    type="button"
                    onClick={() => runVerify(item)}
                    style={{
                      background: 'var(--surface3)',
                      border: '1px solid var(--border)',
                      color: 'var(--text2)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('evidenceRetry')}
                  </button>
                </span>
              )}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>
              SHA-256: {item.evidenceHash ? item.evidenceHash.slice(0, 20) : '—'}…
            </div>
            <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--text3)' }}>
              {item.technician.slice(0, 10)}… · {formatTimestamp(item.createdAt, lang)}
            </div>
          </div>
        )
      })}
    </div>
  )
}