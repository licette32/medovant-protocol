import { useEffect, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import { fetchEvidenceForAsset, type MaintenanceEvidence } from '@/utils/evidence'

type Props = {
  assetPda: string
  /** Refresh the list after a tx completes. */
  refreshKey?: number
}

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
 * maintenance release (#4). Shows the attachment, its SHA-256 and who uploaded
 * it. Hides entirely when Supabase is not configured.
 */
export default function EvidenceList({ assetPda, refreshKey }: Props) {
  const { t, lang } = useLang()
  const [items, setItems] = useState<MaintenanceEvidence[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            background: 'var(--surface2)',
          }}
        >
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
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>
            SHA-256: {item.evidenceHash ? item.evidenceHash.slice(0, 20) : '—'}…
          </div>
          <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--text3)' }}>
            {item.technician.slice(0, 10)}… · {formatTimestamp(item.createdAt, lang)}
          </div>
        </div>
      ))}
    </div>
  )
}