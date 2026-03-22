import type { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useState } from 'react'
import { toast } from 'sonner'
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
  const [modal, setModal] = useState<ModalKey>(null)
  const [loading, setLoading] = useState(false)
  const [assetId, setAssetId] = useState('1')
  const [rewardSol, setRewardSol] = useState('0.0005')

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
      <section className="rounded-xl border border-stone-100 bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-navy">Actions</h3>
        <p className="mt-1 text-xs text-stone-500">Hospital wallet must be connected for these instructions.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setModal('register')}
            className="rounded-xl border border-stone-200 bg-surface2 py-3 text-sm font-medium text-navy transition hover:border-lavender hover:bg-lavender-light/40"
          >
            Register asset
          </button>
          <button
            type="button"
            onClick={() => setModal('report')}
            className="rounded-xl border border-stone-200 bg-surface2 py-3 text-sm font-medium text-navy transition hover:border-lavender hover:bg-lavender-light/40"
          >
            Report issue
          </button>
          <button
            type="button"
            onClick={() => setModal('complete')}
            className="rounded-xl border border-stone-200 bg-surface2 py-3 text-sm font-medium text-navy transition hover:border-lavender hover:bg-lavender-light/40"
          >
            Complete maintenance
          </button>
          <button
            type="button"
            onClick={() => setModal('decommission')}
            className="rounded-xl border border-stone-200 bg-surface2 py-3 text-sm font-medium text-navy transition hover:border-red-200 hover:bg-red-50"
          >
            Decommission
          </button>
        </div>
      </section>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !loading && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[14px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-navy">
              {modal === 'register' && 'Register asset'}
              {modal === 'report' && 'Report issue'}
              {modal === 'complete' && 'Complete maintenance'}
              {modal === 'decommission' && 'Decommission asset'}
            </h4>
            {modal === 'decommission' && (
              <p className="mt-2 text-sm text-amber-800">
                This closes the equipment account and returns rent. This cannot be undone from the UI.
              </p>
            )}
            {modal === 'complete' && (
              <p className="mt-2 text-xs text-stone-500">
                A devnet technician keypair is stored in this browser (localStorage) to sign the technician role.
                Fund it with a little SOL on devnet if registration fails.
              </p>
            )}
            <label className="mt-4 block text-xs font-medium text-stone-600">
              Asset ID
              <input
                type="number"
                min={0}
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/30"
              />
            </label>
            {modal === 'report' && (
              <label className="mt-3 block text-xs font-medium text-stone-600">
                Reward (SOL)
                <input
                  type="text"
                  inputMode="decimal"
                  value={rewardSol}
                  onChange={(e) => setRewardSol(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/30"
                />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setModal(null)}
                className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
              >
                Cancel
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
                className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-[#9061f9] disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
