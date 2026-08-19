import { useRef, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import { uploadEvidence, validateEvidenceFile, type MaintenanceEvidence } from '@/utils/evidence'

type Props = {
  assetPda: string
  hospital: string
  technician: string
  disabled?: boolean
  onUploaded: (evidence: MaintenanceEvidence) => void
}

/**
 * Technician-side attachment uploader (#4). Validates the file (image/PDF,
 * <= 5MB), uploads it to Supabase Storage and reports the recorded evidence
 * row. SHA-256 is computed client-side so the hash travels with the payload.
 */
export default function EvidenceUploader({ assetPda, hospital, technician, disabled, onUploaded }: Props) {
  const { t } = useLang()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)

  async function handleFile(file: File | null) {
    setError(null)
    setPreview(null)
    if (!file) return
    const invalid = validateEvidenceFile(file)
    if (invalid) {
      setError(t(invalid as 'evidenceTooLarge' | 'evidenceInvalidType'))
      return
    }
    setUploading(true)
    try {
      const evidence = await uploadEvidence({ file, assetPda, hospital, technician })
      if (file.type.startsWith('image/')) {
        setPreview({ name: file.name, url: URL.createObjectURL(file) })
      }
      onUploaded(evidence)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
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
        {preview ? (
          <>
            <img
              src={preview.url}
              alt={preview.name}
              style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{preview.name}</span>
            <button
              type="button"
              onClick={() => {
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
                cursor: 'pointer',
              }}
            >
              {t('evidenceRemove')}
            </button>
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