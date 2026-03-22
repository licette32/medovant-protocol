import type { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useLang } from '@/i18n/LangContext'
import { getEscrowVaultPDA, getMedicalAssetPDA, getTechnicianProfilePDA } from '@/utils/pdas'
import { loadOrCreateTechnicianKeypair } from '@/utils/technicianKeypair'
import { showTxToast } from '@/components/Toast'
import type { ActivityItem } from '@/components/ActivityFeed'

export type OnTxSuccess = (sig: string, message: string, type: ActivityItem['type']) => void

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
}

type ModalKey = 'register' | 'report' | 'complete' | 'decommission' | null

export default function ActionsPanel({ program, publicKey, onTxSuccess }: Props) {
  const { t } = useLang()
  const [modal, setModal] = useState<ModalKey>(null)
  const [loading, setLoading] = useState(false)
  const [assetId, setAssetId] = useState('1')
  const [rewardSol, setRewardSol] = useState('0.0005')

  const actionTiles = useMemo(
    () =>
      [
        { modal: 'register' as const, title: t('registerAsset'), desc: t('registerDesc'), warnHover: false },
        { modal: 'report' as const, title: t('reportIssue'), desc: t('reportDesc'), warnHover: false },
        { modal: 'complete' as const, title: t('completeMaintenance'), desc: t('completeDesc'), warnHover: false },
        { modal: 'decommission' as const, title: t('decommission'), desc: t('decommissionDesc'), warnHover: true },
      ] as const,
    [t]
  )

  function guardWallet() {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return false
    }
    return true
  }

  async function submitRegister() {
    if (!guardWallet()) return
    const id = parseInt(assetId, 10)
    if (Number.isNaN(id) || id < 0) {
      toast.error('Invalid asset ID')
      return
    }
    setLoading(true)
    try {
      const pda = getMedicalAssetPDA(publicKey!, id)
      const sig = await program!
        .methods.initializeAsset(new BN(id))
        .accounts({
          hospital: publicKey!,
          medicalAsset: pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(sig)
      onTxSuccess(sig, `Registered asset #${id}`, 'tx')
      setModal(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function submitReport() {
    if (!guardWallet()) return
    const id = parseInt(assetId, 10)
    const lamports = new BN(Math.floor(parseFloat(rewardSol) * 1e9))
    if (Number.isNaN(id) || id < 0) {
      toast.error('Invalid asset ID')
      return
    }
    if (lamports.lten(0)) {
      toast.error('Reward must be > 0')
      return
    }
    setLoading(true)
    try {
      const pda = getMedicalAssetPDA(publicKey!, id)
      const vault = getEscrowVaultPDA(pda)
      const sig = await program!
        .methods.reportIssue(lamports)
        .accounts({
          hospital: publicKey!,
          medicalAsset: pda,
          escrowVault: vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      showTxToast(sig)
      onTxSuccess(sig, `Reported issue on asset #${id}`, 'warn')
      setModal(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function submitComplete() {
    if (!guardWallet()) return
    const id = parseInt(assetId, 10)
    if (Number.isNaN(id) || id < 0) {
      toast.error('Invalid asset ID')
      return
    }
    setLoading(true)
    try {
      const techKp = loadOrCreateTechnicianKeypair()
      const pda = getMedicalAssetPDA(publicKey!, id)
      const vault = getEscrowVaultPDA(pda)
      const techProfile = getTechnicianProfilePDA(techKp.publicKey)
      try {
        await (program!.account as { technicianProfile: { fetch: (a: PublicKey) => Promise<unknown> } }).technicianProfile.fetch(
          techProfile
        )
      } catch {
        const regSig = await program!
          .methods.registerTechnician()
          .accounts({
            technician: techKp.publicKey,
            technicianProfile: techProfile,
            systemProgram: SystemProgram.programId,
          })
          .signers([techKp])
          .rpc()
        showTxToast(regSig)
        onTxSuccess(regSig, 'Technician profile registered', 'ok')
      }
      const sig = await program!
        .methods.completeMaintenance()
        .accounts({
          hospital: publicKey!,
          technician: techKp.publicKey,
          medicalAsset: pda,
          escrowVault: vault,
          technicianProfile: techProfile,
          systemProgram: SystemProgram.programId,
        })
        .signers([techKp])
        .rpc()
      showTxToast(sig)
      onTxSuccess(sig, `Completed maintenance for asset #${id}`, 'fix')
      setModal(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function submitDecommission() {
    if (!guardWallet()) return
    const id = parseInt(assetId, 10)
    if (Number.isNaN(id) || id < 0) {
      toast.error('Invalid asset ID')
      return
    }
    setLoading(true)
    try {
      const pda = getMedicalAssetPDA(publicKey!, id)
      const sig = await program!
        .methods.decommissionAsset()
        .accounts({
          hospital: publicKey!,
          medicalAsset: pda,
        })
        .rpc()
      showTxToast(sig)
      onTxSuccess(sig, `Decommissioned asset #${id}`, 'warn')
      setModal(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="rounded-[var(--radius)] border border-med bg-surface p-5 shadow-med">
        <h3 className="text-sm font-semibold text-tpri">{t('actions')}</h3>
        <p className="mt-1 text-xs text-tsec">{t('actionsDesc')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {actionTiles.map(({ modal: m, title, desc, warnHover }) => (
            <button
              key={m}
              type="button"
              onClick={() => setModal(m)}
              className={`rounded-sm border border-med bg-surface2 p-3 text-left transition hover:border-[color:var(--green-b)] hover:bg-[var(--green-d)] ${
                warnHover ? 'hover:border-[color:var(--red-b)] hover:bg-[var(--red-d)]' : ''
              }`}
            >
              <span className="block text-xs font-medium text-tpri">{title}</span>
              <span className="mt-1 block text-[10px] leading-snug text-tmuted">{desc}</span>
            </button>
          ))}
        </div>
      </section>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !loading && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[var(--radius)] border border-med bg-surface p-6 shadow-med"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-tpri">
              {modal === 'register' && t('registerAsset')}
              {modal === 'report' && t('reportIssue')}
              {modal === 'complete' && t('completeMaintenance')}
              {modal === 'decommission' && t('decommissionModalTitle')}
            </h4>
            {modal === 'decommission' && (
              <p className="mt-2 text-sm text-accenta">{t('warningDecommission')}</p>
            )}
            {modal === 'complete' && (
              <div className="mt-2 space-y-2 text-xs text-tsec">
                <p className="font-medium text-tpri">{t('demoTechnician')}</p>
                <p>{t('technicianKeypairBody')}</p>
              </div>
            )}
            <label className="mt-4 block text-xs font-medium text-tsec">
              {t('assetId')}
              <input
                type="number"
                min={0}
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 w-full rounded-sm border border-med bg-surface2 px-3 py-2 font-mono text-sm text-tpri outline-none focus:border-[color:var(--green-b)] focus:ring-1 focus:ring-[color:var(--green)]/30"
              />
            </label>
            {modal === 'report' && (
              <label className="mt-3 block text-xs font-medium text-tsec">
                {t('rewardSol')}
                <input
                  type="text"
                  inputMode="decimal"
                  value={rewardSol}
                  onChange={(e) => setRewardSol(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-med bg-surface2 px-3 py-2 font-mono text-sm text-tpri outline-none focus:border-[color:var(--green-b)] focus:ring-1 focus:ring-[color:var(--green)]/30"
                />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setModal(null)}
                className="rounded-sm border border-med bg-transparent px-4 py-2 text-sm text-tsec transition hover:bg-surface2"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (modal === 'register') void submitRegister()
                  if (modal === 'report') void submitReport()
                  if (modal === 'complete') void submitComplete()
                  if (modal === 'decommission') void submitDecommission()
                }}
                className="rounded-sm border border-[color:var(--green-b)] bg-[var(--green-d)] px-4 py-2 text-sm font-medium text-accentg transition hover:bg-[var(--green-b)] disabled:opacity-50"
              >
                {loading ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
