import type { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { toast } from 'sonner'
import type { ActivityItem } from '@/components/ActivityFeed'
import { useLang } from '@/i18n/LangContext'
import type { Lang, TranslationKey } from '@/i18n/translations'
import { getAssetDisplayName, upsertAssetMeta } from '@/utils/assetMetadata'
import { truncatePubkey } from '@/utils/formatters'
import { getEscrowVaultPDA, getMedicalAssetPDA, getTechnicianProfilePDA } from '@/utils/pdas'
import { showTxToast } from '@/components/Toast'
import { toastAnchorTxError } from '@/utils/solanaTxError'
import { fetchHospitalAssets } from '@/utils/assetDiscovery'
import PstPanel from '@/components/PstPanel'
import EvidenceList from '@/components/EvidenceList'

export type OnTxSuccess = (sig: string, message: string, type: ActivityItem['type']) => void

/** Normalized status from chain (mapAssetStatus strings). */
export interface OnChainAsset {
  id: number
  pda: PublicKey
  name: string
  location?: string
  status: string
  maintenanceReward: number
  failureCount: number
  lastMaintenance: number
  /** Owner hospital wallet (base58). Set by assetDiscovery fetchers. */
  hospital?: string
}

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
  /** When set, table uses this data instead of fetching internally. */
  assets?: OnChainAsset[]
  /** Called after successful txs and when user clicks Refresh (parent refetches for KPIs). */
  onAssetsChange?: () => void | Promise<void>
  /** Loading state when `assets` is controlled by parent. */
  assetsLoading?: boolean
  /** Fetch failed (RPC timeout etc.) — show error state instead of empty/demo rows. */
  assetsError?: boolean
}

function activityAfterRegister(lang: Lang, name: string, id: number): string {
  return lang === 'es' ? `${name} registrado on-chain (#${id})` : `${name} registered on-chain (#${id})`
}

function activityAfterReport(lang: Lang, name: string, reward: string): string {
  return lang === 'es'
    ? `Problema reportado en ${name} — ${reward} SOL bloqueado`
    : `Issue reported on ${name} — ${reward} SOL locked`
}

function activityAfterComplete(lang: Lang, name: string): string {
  return lang === 'es' ? `Mantenimiento completado — ${name}` : `Maintenance completed — ${name}`
}

type ModalType = 'register' | 'report' | 'complete' | 'decommission'

interface ModalState {
  type: ModalType
  assetId?: number
  /** Lamports escrow for complete modal display */
  maintenanceReward?: number
}

const DEMO_STATUSES = ['Active', 'Issue Reported'] as const

function statusBadgeClass(status: string): string {
  if (status === 'Active')
    return 'border border-[color:var(--green-b)] bg-[var(--green-d)] text-[color:var(--green)]'
  if (status === 'Issue Reported')
    return 'border border-[color:var(--amber-b)] bg-[var(--amber-d)] text-[color:var(--amber)]'
  if (status === 'Decommissioned')
    return 'border border-med bg-surface3 text-tmuted'
  return 'border border-med bg-surface2 text-tsec'
}

function translateStatus(status: string, t: (key: TranslationKey) => string): string {
  if (status === 'Active') return t('statusActive')
  if (status === 'Issue Reported') return t('statusIssue')
  if (status === 'Decommissioned') return t('statusDecommissioned')
  return status
}

const inputStyle: CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '8px 12px',
  color: 'var(--text)',
  fontFamily: '"DM Mono", monospace',
  width: '100%',
  outline: 'none',
}

const textFieldStyle: CSSProperties = {
  ...inputStyle,
  fontFamily: 'Inter, system-ui, sans-serif',
}

const textareaStyle: CSSProperties = {
  ...textFieldStyle,
  minHeight: '72px',
  resize: 'vertical',
}

export default function EquipmentTable({
  program,
  publicKey,
  onTxSuccess,
  assets: assetsFromParent,
  onAssetsChange,
  assetsLoading: assetsLoadingFromParent,
  assetsError,
}: Props) {
  const { t, lang } = useLang()
  const isControlled = assetsFromParent !== undefined
  const [assetsInternal, setAssetsInternal] = useState<OnChainAsset[]>([])
  const [loadingInternal, setLoadingInternal] = useState(false)
  const assets = isControlled ? assetsFromParent : assetsInternal
  const loading = isControlled ? Boolean(assetsLoadingFromParent) : loadingInternal
  const [activeModal, setActiveModal] = useState<ModalState | null>(null)
  const [modalBusy, setModalBusy] = useState(false)

  const [registerEquipmentName, setRegisterEquipmentName] = useState('')
  const [registerLocation, setRegisterLocation] = useState('')
  const [registerId, setRegisterId] = useState('1')
  const [rewardSol, setRewardSol] = useState('0.05')
  const [issueDescription, setIssueDescription] = useState('')

  const fetchAssets = useCallback(async () => {
    if (!program || !publicKey) return
    setLoadingInternal(true)
    try {
      setAssetsInternal(await fetchHospitalAssets(program, publicKey))
    } finally {
      setLoadingInternal(false)
    }
  }, [program, publicKey])

  async function refreshAssets() {
    if (onAssetsChange) {
      await Promise.resolve(onAssetsChange())
      return
    }
    await fetchAssets()
  }

  useEffect(() => {
    if (isControlled) return
    if (program && publicKey) void fetchAssets()
  }, [program, publicKey, fetchAssets, isControlled])

  function closeModal() {
    if (!modalBusy) setActiveModal(null)
  }

  function dismissModalAfterSuccess() {
    setActiveModal(null)
  }

  async function submitRegister() {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return
    }
    const equipmentName = registerEquipmentName.trim()
    if (!equipmentName) {
      toast.error(t('equipmentNameRequired'))
      return
    }
    const assetId = parseInt(registerId, 10)
    if (Number.isNaN(assetId) || assetId < 1 || assetId > 9999) {
      toast.error('Invalid asset ID (1–9999)')
      return
    }
    setModalBusy(true)
    try {
      const pda = getMedicalAssetPDA(publicKey, assetId)
      const tx = await program.methods
        .initializeAsset(new BN(assetId))
        .accounts({
          hospital: publicKey,
          medicalAsset: pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(tx)
      await upsertAssetMeta(publicKey.toBase58(), assetId, {
        name: equipmentName,
        location: registerLocation.trim() || undefined,
      })
      onTxSuccess(tx, activityAfterRegister(lang, equipmentName, assetId), 'tx')
      setRegisterEquipmentName('')
      setRegisterLocation('')
      await refreshAssets()
      dismissModalAfterSuccess()
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setModalBusy(false)
    }
  }

  async function submitReport(assetId: number) {
    if (!program || !publicKey) return
    const lamports = new BN(Math.floor(parseFloat(rewardSol) * 1e9))
    if (lamports.lten(0)) {
      toast.error('Reward must be > 0')
      return
    }
    setModalBusy(true)
    try {
      const pda = getMedicalAssetPDA(publicKey, assetId)
      const vault = getEscrowVaultPDA(pda)
      const tx = await program.methods
        .reportIssue(lamports)
        .accounts({
          hospital: publicKey,
          medicalAsset: pda,
          escrowVault: vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(tx)
      const displayName = getAssetDisplayName(publicKey.toBase58(), assetId)
      onTxSuccess(tx, activityAfterReport(lang, displayName, rewardSol), 'warn')
      if (issueDescription.trim()) {
        // Local context only — not sent on-chain (program has no issue-text field)
        console.info('[Medovant] Issue note:', issueDescription.trim())
      }
      setIssueDescription('')
      await refreshAssets()
      dismissModalAfterSuccess()
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setModalBusy(false)
    }
  }

  async function submitComplete(assetId: number) {
    if (!program || !publicKey) return
    setModalBusy(true)
    try {
      const pda = getMedicalAssetPDA(publicKey, assetId)
      const vault = getEscrowVaultPDA(pda)
      const techProfile = getTechnicianProfilePDA(publicKey)
      try {
        await (program.account as { technicianProfile: { fetch: (a: PublicKey) => Promise<unknown> } }).technicianProfile.fetch(
          techProfile
        )
      } catch {
        const regSig = await program.methods
          .registerTechnician()
          .accounts({
            technician: publicKey,
            technicianProfile: techProfile,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        showTxToast(regSig)
        onTxSuccess(regSig, 'Technician profile registered', 'ok')
      }
      const sig = await program.methods
        .completeMaintenance()
        .accounts({
          hospital: publicKey,
          technician: publicKey,
          medicalAsset: pda,
          escrowVault: vault,
          technicianProfile: techProfile,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(sig)
      const doneName = publicKey ? getAssetDisplayName(publicKey.toBase58(), assetId) : `Asset #${assetId}`
      onTxSuccess(sig, activityAfterComplete(lang, doneName), 'fix')
      await refreshAssets()
      dismissModalAfterSuccess()
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setModalBusy(false)
    }
  }

  async function submitDecommission(assetId: number) {
    if (!program || !publicKey) return
    setModalBusy(true)
    try {
      const pda = getMedicalAssetPDA(publicKey, assetId)
      const vault = getEscrowVaultPDA(pda)
      const tx = await program.methods
        .decommissionAsset()
        .accounts({
          hospital: publicKey,
          medicalAsset: pda,
          escrowVault: vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(tx)
      const dName = publicKey ? getAssetDisplayName(publicKey.toBase58(), assetId) : `Asset #${assetId}`
      onTxSuccess(
        tx,
        lang === 'es' ? `${dName} dado de baja (#${assetId})` : `${dName} decommissioned (#${assetId})`,
        'warn'
      )
      await refreshAssets()
      dismissModalAfterSuccess()
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setModalBusy(false)
    }
  }

  const cardBase: CSSProperties = {
    background: 'var(--surface)',
    borderRadius: '10px',
    padding: '20px',
    maxWidth: '480px',
  }

  function renderActionCell(asset: OnChainAsset) {
    const s = asset.status
    if (s === 'Active') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-issue rounded-md border border-[color:var(--amber-b)] bg-[var(--amber-d)] px-2 py-1 text-[13px] font-medium text-[color:var(--amber)] transition hover:opacity-90"
            onClick={() => {
              setIssueDescription('')
              setActiveModal({ type: 'report', assetId: asset.id })
            }}
          >
            ⚠ {t('reportProblem')}
          </button>
          <button
            type="button"
            className="btn-decomm rounded-md border border-[color:var(--red-b)] bg-[var(--red-d)] px-2 py-1 text-[13px] font-medium text-[color:var(--red)] transition hover:opacity-90"
            onClick={() => setActiveModal({ type: 'decommission', assetId: asset.id })}
            aria-label={t('decommissionAsset')}
          >
            ✕
          </button>
        </div>
      )
    }
    if (s === 'Issue Reported') {
      return (
        <button
          type="button"
          className="btn-complete rounded-md border border-[color:var(--green-b)] bg-[var(--green-d)] px-2 py-1 text-[13px] font-medium text-[color:var(--green)] transition hover:opacity-90"
          onClick={() =>
            setActiveModal({
              type: 'complete',
              assetId: asset.id,
              maintenanceReward: asset.maintenanceReward,
            })
          }
        >
          ✓ {t('completeMaint')}
        </button>
      )
    }
    if (s === 'Decommissioned') {
      return <span className="text-[13px] text-tmuted">{t('statusDecommissioned')}</span>
    }
    return <span className="text-[13px] text-tmuted">—</span>
  }

  const showDemoRows = publicKey && !loading && !assetsError && assets.length === 0

  const reportAssetId = activeModal?.type === 'report' ? activeModal.assetId : undefined
  const reportAssetRow = reportAssetId != null ? assets.find((a) => a.id === reportAssetId) : undefined
  const reportDisplayName =
    reportAssetId != null && publicKey
      ? (reportAssetRow?.name ?? getAssetDisplayName(publicKey.toBase58(), reportAssetId))
      : ''
  const reportDisplayLocation = reportAssetRow?.location

  const completeAssetId = activeModal?.type === 'complete' ? activeModal.assetId : undefined
  const completeDisplayName =
    completeAssetId != null && publicKey
      ? getAssetDisplayName(publicKey.toBase58(), completeAssetId)
      : completeAssetId != null
        ? `Asset #${completeAssetId}`
        : ''

  const completeAssetPda =
    completeAssetId != null && publicKey ? getMedicalAssetPDA(publicKey, completeAssetId).toBase58() : undefined

  const decommissionAssetId = activeModal?.type === 'decommission' ? activeModal.assetId : undefined
  const decommissionDisplayName =
    decommissionAssetId != null && publicKey
      ? getAssetDisplayName(publicKey.toBase58(), decommissionAssetId)
      : decommissionAssetId != null
        ? `Asset #${decommissionAssetId}`
        : ''

  return (
    <div className="space-y-0">
      <section className="overflow-hidden rounded-[var(--radius)] border border-med bg-surface shadow-med">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-med px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-tpri">{t('equipment')}</h3>
            <p className="mt-0.5 text-xs text-tsec">{t('equipmentTableSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!program || !publicKey || loading}
              onClick={() => void refreshAssets()}
              className="rounded-md border border-med bg-surface2 px-3 py-2 text-xs font-medium text-tsec transition hover:bg-surface3 disabled:opacity-50"
            >
              ↻ {t('refreshAssets')}
            </button>
            <button
              type="button"
              disabled={!program || !publicKey || modalBusy}
              onClick={() => setActiveModal({ type: 'register' })}
              className="rounded-md border border-[color:var(--green-b)] bg-[var(--green-d)] px-3 py-2 text-xs font-medium text-[color:var(--green)] transition hover:opacity-90 disabled:opacity-50"
            >
              + {t('registerNew')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-med bg-surface2 text-[13px] uppercase tracking-[0.05em] text-tsec">
                <th className="px-4 py-3">{t('colAsset')}</th>
                <th className="px-4 py-3">{t('colStatus')}</th>
                <th className="px-4 py-3">{t('colEscrow')}</th>
                <th className="px-4 py-3">{t('colFailures')}</th>
                <th className="px-4 py-3">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {!publicKey && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-tsec">
                    {t('connectWallet')}
                  </td>
                </tr>
              )}
              {publicKey && loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-tsec">
                    {t('fetching')}
                  </td>
                </tr>
              )}
              {publicKey && !loading && assetsError && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[color:var(--red)]">
                    {t('loadAssetsError')}
                  </td>
                </tr>
              )}
              {publicKey && !loading && assets.map((asset) => (
                <tr key={asset.id} className="border-b border-med text-tpri transition-colors last:border-0 hover:bg-surface2">
                  <td className="px-4 py-3 align-top">
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{asset.name}</div>
                    {asset.location && (
                      <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '2px' }}>📍 {asset.location}</div>
                    )}
                    <div
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '13px',
                        color: 'var(--text3)',
                        marginTop: '4px',
                      }}
                    >
                      #{asset.id} · {asset.pda.toBase58().slice(0, 8)}...
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(asset.status)}`}>
                      {translateStatus(asset.status, t)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs">
                    {asset.maintenanceReward > 0 ? (
                      <span className="text-[color:var(--amber)]">{(asset.maintenanceReward / 1e9).toFixed(4)} SOL</span>
                    ) : (
                      <span className="text-tmuted">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 align-top text-sm ${asset.failureCount > 0 ? 'text-[color:var(--amber)]' : 'text-tsec'}`}>
                    {asset.failureCount}
                  </td>
                  <td className="px-4 py-3 align-top">{renderActionCell(asset)}</td>
                </tr>
              ))}
              {showDemoRows && (
                <>
                  {DEMO_STATUSES.map((st, i) => (
                    <tr key={`demo-${i}`} className="border-b border-med opacity-75 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-tpri">
                          Asset #{i + 1} <span className="text-[12px] font-normal text-tmuted">(demo)</span>
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-tmuted">—</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(st)}`}>
                          {translateStatus(st, t)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tmuted">—</td>
                      <td className="px-4 py-3 text-tmuted">—</td>
                      <td className="px-4 py-3 text-[13px] text-tmuted">{t('sampleRow')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-[13px] text-tmuted">
                      {t('noAssetsFound')}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {activeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={closeModal}
          >
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius)] border border-med bg-surface p-6 shadow-med"
              onClick={(e) => e.stopPropagation()}
            >
            {activeModal.type === 'register' && (
              <div
                style={{
                  ...cardBase,
                  border: '1px solid var(--border-accent)',
                }}
              >
                <h4 className="text-base font-semibold text-tpri">+ {t('registerModalTitle')}</h4>
                <p className="mt-1 text-xs text-tsec">{t('registerModalSubtitle')}</p>
                <label className="mt-4 block text-xs font-medium text-tsec">
                  {t('equipmentName')} <span className="text-[color:var(--red)]">*</span>
                  <input
                    type="text"
                    required
                    value={registerEquipmentName}
                    onChange={(e) => setRegisterEquipmentName(e.target.value)}
                    placeholder={t('equipmentNamePlaceholder')}
                    style={{ ...textFieldStyle, marginTop: '6px' }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--green)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border)'
                    }}
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-tsec">
                  {t('locationLabel')}
                  <input
                    type="text"
                    value={registerLocation}
                    onChange={(e) => setRegisterLocation(e.target.value)}
                    placeholder={t('locationPlaceholder')}
                    style={{ ...textFieldStyle, marginTop: '6px' }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--green)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border)'
                    }}
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-tsec">
                  {t('assetId')}
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={registerId}
                    onChange={(e) => setRegisterId(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--green)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border)'
                    }}
                  />
                </label>
                <p className="mt-1 text-[12px] text-tmuted">{t('assetIdUnique')}</p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={closeModal}
                    className="rounded-md border border-med bg-transparent px-4 py-2 text-sm text-tsec"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={() => void submitRegister()}
                    className="rounded-md border border-[color:var(--green-b)] bg-[var(--green-d)] px-4 py-2 text-sm font-medium text-[color:var(--green)] disabled:opacity-50"
                  >
                    {modalBusy ? t('submitting') : t('registerOnChain')}
                  </button>
                </div>
              </div>
            )}

            {activeModal.type === 'report' && activeModal.assetId != null && (
              <div
                style={{
                  ...cardBase,
                  border: '1px solid var(--border-accent)',
                }}
              >
                <h4 className="text-base font-semibold text-tpri">
                  ⚠ {t('reportModalTitle')} — {reportDisplayName}
                </h4>
                <p className="mt-1 text-xs text-tsec">{t('reportModalSubtitle')}</p>
                <div
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    marginTop: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{reportDisplayName}</div>
                  {reportDisplayLocation && (
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
                      📍 {reportDisplayLocation}
                    </div>
                  )}
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
                    #{activeModal.assetId}
                  </div>
                </div>
                <label className="mt-0 block text-xs font-medium text-tsec">
                  {t('rewardSol')}
                  <input
                    type="number"
                    step={0.001}
                    min={0}
                    placeholder="0.05"
                    value={rewardSol}
                    onChange={(e) => setRewardSol(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                  />
                </label>
                <p className="mt-1 text-[12px] text-tmuted">{t('rewardNote')}</p>
                <label className="mt-4 block text-xs font-medium text-tsec">
                  {t('issueDescriptionLabel')}
                  <textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder={t('issueDescriptionPlaceholder')}
                    rows={3}
                    style={{ ...textareaStyle, marginTop: '6px' }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--green)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border)'
                    }}
                  />
                </label>
                <div className="mt-4 rounded-md border border-[color:var(--amber-b)] bg-[var(--amber-d)] px-3 py-2 text-[13px] text-[color:var(--amber)]">
                  ⚠ {t('escrowWarning')}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" disabled={modalBusy} onClick={closeModal} className="rounded-md border border-med px-4 py-2 text-sm text-tsec">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={() => void submitReport(activeModal.assetId!)}
                    className="rounded-md border border-[color:var(--amber-b)] bg-[var(--amber-d)] px-4 py-2 text-sm font-medium text-[color:var(--amber)] disabled:opacity-50"
                  >
                    {modalBusy ? t('submitting') : t('lockAndReport')}
                  </button>
                </div>
              </div>
            )}

            {activeModal.type === 'complete' && activeModal.assetId != null && (
              <div
                style={{
                  ...cardBase,
                  border: '1px solid var(--green-b)',
                }}
              >
                <h4 className="text-base font-semibold text-tpri">
                  ✓ {t('completeModalTitle')} — {completeDisplayName}
                </h4>
                <p className="mt-1 text-xs text-tsec">{t('completeModalSubtitle')}</p>
                <ul className="mt-4 space-y-2 text-xs text-tsec">
                  <li>
                    <span className="text-tmuted">Asset:</span> {completeDisplayName}{' '}
                    <span className="text-tmuted">(#{activeModal.assetId})</span>
                  </li>
                  <li>
                    <span className="text-tmuted">{t('escrowLocked')}:</span>{' '}
                    <span className="text-[color:var(--amber)]">
                      {((activeModal.maintenanceReward ?? 0) / 1e9).toFixed(4)} SOL
                    </span>
                  </li>
                  <li>
                    <span className="text-tmuted">{t('releasedToTech')}:</span>{' '}
                    <span className="font-mono text-tpri">{publicKey ? truncatePubkey(publicKey.toBase58()) : '—'}</span>
                  </li>
                  <li className="text-[color:var(--green)]">{t('bothSign')}</li>
                </ul>
                <div className="mt-3 rounded-md border border-[color:var(--amber-b)] bg-[var(--amber-d)] px-3 py-2 text-[13px] text-[color:var(--amber)]">
                  {t('techNeedsSol')}
                </div>
                {completeAssetPda && (
                  <div className="mt-3">
                    <EvidenceList assetPda={completeAssetPda} />
                  </div>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" disabled={modalBusy} onClick={closeModal} className="rounded-md border border-med px-4 py-2 text-sm text-tsec">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={() => void submitComplete(activeModal.assetId!)}
                    className="rounded-md border border-[color:var(--green-b)] bg-[var(--green-d)] px-4 py-2 text-sm font-medium text-[color:var(--green)] disabled:opacity-50"
                  >
                    {modalBusy ? t('submitting') : t('confirmRelease')}
                  </button>
                </div>
                <PstPanel
                  program={program}
                  publicKey={publicKey}
                  mode="hospital"
                  asset={{
                    id: activeModal.assetId,
                    name: completeDisplayName,
                    maintenanceReward: activeModal.maintenanceReward ?? 0,
                  }}
                  onTxSuccess={onTxSuccess}
                  onDone={refreshAssets}
                />
              </div>
            )}

            {activeModal.type === 'decommission' && activeModal.assetId != null && (
              <div
                style={{
                  ...cardBase,
                  border: '1px solid var(--red-b)',
                }}
              >
                <h4 className="text-base font-semibold text-tpri">
                  {t('decommissionTitle')} — {decommissionDisplayName}
                </h4>
                <div className="mt-4 rounded-md border border-[color:var(--red-b)] bg-[var(--red-d)] px-3 py-2 text-[13px] text-[color:var(--red)]">
                  ⚠ {t('decommissionWarning')}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" disabled={modalBusy} onClick={closeModal} className="rounded-md border border-med bg-surface2 px-4 py-2 text-sm text-tsec">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={modalBusy}
                    onClick={() => void submitDecommission(activeModal.assetId!)}
                    className="rounded-md border border-[color:var(--red-b)] bg-[var(--red-d)] px-4 py-2 text-sm font-medium text-[color:var(--red)] disabled:opacity-50"
                  >
                    {modalBusy ? t('submitting') : t('decommissionAsset')}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
