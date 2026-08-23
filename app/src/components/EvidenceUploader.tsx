import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import { submitEvidence, validateEvidenceFile, type MaintenanceEvidence } from '@/utils/evidence'

type Props = {
  assetPda: string
  hospital: string
  technician: string
  disabled?: boolean
  /** Set once the complete_maintenance tx lands; triggers the evidence upload. */
  txSignature?: string | null
  onUploaded: (evidence: MaintenanceEvidence) => void
}

/**
 * Technician-side attachment uploader (#4 / TD-08). Validates the file
 * (image/PDF, <= 5MB), keeps it selected for preview and only submits it to
 * the `evidence` Edge Function once the maintenance tx signature arrives.
 * The server verifies the tx on-chain before persisting anything, so no row
 * can exist without a real, verified transaction.
 */
export default function EvidenceUploader({
  assetPda,
  hospital,
  technician,
  disabled,
  txSignature,
  onUploaded,
}: Props) {
  const { t } = useLang()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)
  const submittedTx = useRef<string | null>(null)

  useEffect(() => {
    setFile(null)
    setPreview(null)
    setError(null)
    setUploading(false)
    submittedTx.current = null
    if (inputRef.current) inputRef.current.value = ''
  }, [assetPda])

  useEffect(() => {
    if (!txSignature || !file || uploading || submittedTx.current === txSignature) return
    submittedTx.current = txSignature
    setUploading(true)
    setError(null)
    void (async () => {
      try {
        const evidence = await submitEvidence({ file, assetPda, hospital, technician, txSignature })
        onUploaded(evidence)
        setFile(null)
        setPreview(null)
        if (inputRef.current) inputRef.current.value = ''
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSignature, file, assetPda, hospital, technician])

  function handleFile(selected: File | null) {
    setError(null)
    setPreview(null)
    if (!selected) return
    const invalid = validateEvidenceFile(selected)
    if (invalid) {
      setError(t(invalid as 'evidenceTooLarge' | 'evidenceInvalidType'))
      return
    }
    setFile(selected)
    if (selected.type.startsWith('image/')) {
      setPreview({ name: selected.name, url: URL.createObjectURL(selected) })
    }
  }

  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        borderRadius: '8px',
        padding: '12px 14px',
        background: 'var(--surface2)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        {file ? (
          <>
            {preview ? (
              <img
                src={preview.url}
                alt={preview.name}
                style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface3)',
                  fontSize: '18px',
                }}
              >
                📄
              </div>
            )}
            <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{file.name}</span>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setFile(null)
                setPreview(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              style={{
                background: 'var(--surface3)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {t('evidenceRemove')}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{t('evidenceDeferred')}</span>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              style={{
                background: 'var(--cyan-d)',
                border: '1px solid var(--cyan-b)',
                color: 'var(--cyan)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: disabled || uploading ? 'wait' : 'pointer',
                opacity: disabled || uploading ? 0.7 : 1,
              }}
            >
              {uploading ? t('evidenceUploading') : t('attachEvidence')}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{t('evidenceHint')}</span>
          </>
        )}
      </div>
      {error && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--red)' }}>{error}</div>}
    </div>
  )
}