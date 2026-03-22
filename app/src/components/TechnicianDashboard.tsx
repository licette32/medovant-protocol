import type { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useLang } from '@/i18n/LangContext'
import { showTxToast } from '@/components/Toast'
import type { ActivityItem } from '@/components/ActivityFeed'
import type { OnTxSuccess } from '@/components/EquipmentTable'
import ActivityFeed from '@/components/ActivityFeed'
import { getEscrowVaultPDA, getMedicalAssetPDA, getTechnicianProfilePDA } from '@/utils/pdas'
import { loadOrCreateTechnicianKeypair } from '@/utils/technicianKeypair'
import { toastAnchorTxError } from '@/utils/solanaTxError'
import { getAssetDisplayName } from '@/utils/assetNames'
import { truncatePubkey } from '@/utils/formatters'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
  activity: ActivityItem[]
}

function lamportsToSolString(lamports: BN | number | string): string {
  const n = typeof lamports === 'object' && lamports !== null && 'toString' in lamports ? lamports.toString() : String(lamports)
  const v = Number(n) / 1e9
  if (!Number.isFinite(v)) return '0.0000'
  return v.toFixed(4)
}

/** Technician-facing layout: stats from on-chain profile, demo jobs, same completeMaintenance flow as ActionsPanel. */
export default function TechnicianDashboard({ program, publicKey, onTxSuccess, activity }: Props) {
  const { t, lang } = useLang()
  const techKp = useMemo(() => loadOrCreateTechnicianKeypair(), [])
  const [jobsCompleted, setJobsCompleted] = useState(0)
  const [totalEarnedLamports, setTotalEarnedLamports] = useState<string>('0')
  const [assetIdInput, setAssetIdInput] = useState('1')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!program) {
      setJobsCompleted(0)
      setTotalEarnedLamports('0')
      return
    }
    let cancelled = false
    const profilePk = getTechnicianProfilePDA(techKp.publicKey)
    ;(async () => {
      try {
        const prof = await (
          program.account as {
            technicianProfile: {
              fetch: (a: PublicKey) => Promise<{ jobsCompleted: number; totalEarned: BN }>
            }
          }
        ).technicianProfile.fetch(profilePk)
        if (!cancelled) {
          setJobsCompleted(prof.jobsCompleted)
          setTotalEarnedLamports(prof.totalEarned.toString())
        }
      } catch {
        if (!cancelled) {
          setJobsCompleted(0)
          setTotalEarnedLamports('0')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [program, techKp.publicKey])

  const runCompleteMaintenance = useCallback(async () => {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return
    }
    const id = parseInt(assetIdInput, 10)
    if (Number.isNaN(id) || id < 0) {
      toast.error('Invalid asset ID')
      return
    }
    setLoading(true)
    try {
      const pda = getMedicalAssetPDA(publicKey, id)
      const vault = getEscrowVaultPDA(pda)
      const techProfile = getTechnicianProfilePDA(techKp.publicKey)
      try {
        await (
          program.account as { technicianProfile: { fetch: (a: PublicKey) => Promise<unknown> } }
        ).technicianProfile.fetch(techProfile)
      } catch {
        const regSig = await program
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
      const sig = await program
        .methods.completeMaintenance()
        .accounts({
          hospital: publicKey,
          technician: techKp.publicKey,
          medicalAsset: pda,
          escrowVault: vault,
          technicianProfile: techProfile,
          systemProgram: SystemProgram.programId,
        })
        .signers([techKp])
        .rpc()
      showTxToast(sig)
      const doneLabel = getAssetDisplayName(publicKey.toBase58(), id)
      onTxSuccess(
        sig,
        lang === 'es' ? `Mantenimiento completado — ${doneLabel}` : `Maintenance completed — ${doneLabel}`,
        'fix'
      )
      try {
        const prof = await (
          program.account as {
            technicianProfile: {
              fetch: (a: PublicKey) => Promise<{ jobsCompleted: number; totalEarned: BN }>
            }
          }
        ).technicianProfile.fetch(techProfile)
        setJobsCompleted(prof.jobsCompleted)
        setTotalEarnedLamports(prof.totalEarned.toString())
      } catch {
        /* profile refetch optional */
      }
    } catch (e: unknown) {
      await toastAnchorTxError(program, e)
    } finally {
      setLoading(false)
    }
  }, [program, publicKey, assetIdInput, techKp, onTxSuccess, lang])

  const earningsItems = activity.filter((a) => a.type === 'fix' || a.type === 'tx')
  const progressPct = Math.min(100, (jobsCompleted / 10) * 100)

  const demoRows = useMemo(
    () => [
      { asset: t('demoJobAsset1'), hospital: 'Hospital Central', reward: '0.5 SOL', id: '2' },
      { asset: t('demoJobAsset2'), hospital: 'Clínica Norte', reward: '0.8 SOL', id: '5' },
    ],
    [t]
  )

  return (
    <div>
      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--cyan-d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            🔧
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--cyan)' }}>{t('techDashboard')}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text2)' }}>{t('techSubtitle')}</p>
          </div>
        </div>
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            color: 'var(--text2)',
          }}
        >
          {t('demoTechPrefix')}: {truncatePubkey(techKp.publicKey.toBase58())}
        </div>
      </section>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            flex: '1 1 180px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{t('totalEarned')}</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--green)', fontFamily: 'DM Mono, monospace' }}>
            {lamportsToSolString(totalEarnedLamports)} SOL
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '6px' }}>{t('acrossAllJobs')}</div>
        </div>
        <div
          style={{
            flex: '1 1 180px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{t('jobsCompleted')}</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--cyan)' }}>{jobsCompleted}</div>
          <div style={{ marginTop: '8px', height: '4px', background: 'var(--surface3)', borderRadius: '2px' }}>
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: 'var(--cyan)',
                borderRadius: '2px',
                transition: 'width 0.2s',
              }}
            />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '6px' }}>{t('onChainReputation')}</div>
        </div>
        <div
          style={{
            flex: '1 1 180px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{t('nextRewardLabel')}</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)' }}>—</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '6px' }}>{t('nextRewardSub')}</div>
        </div>
      </div>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          marginBottom: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{t('availableJobs')}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text2)' }}>{t('availableJobsSub')}</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: '11px' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  {t('colAsset')}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  {t('colHospital')}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  {t('colReward')}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  {t('colStatus')}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  {t('colAction')}
                </th>
              </tr>
            </thead>
            <tbody>
              {demoRows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                  <td style={{ padding: '12px 16px' }}>{row.asset}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{row.hospital}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
                    {row.reward}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: 'var(--amber-d)',
                        border: '1px solid var(--amber-b)',
                        color: 'var(--amber)',
                      }}
                    >
                      {t('statusIssue')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      type="button"
                      onClick={() => setAssetIdInput(row.id)}
                      style={{
                        background: 'var(--cyan-d)',
                        border: '1px solid var(--cyan-b)',
                        color: 'var(--cyan)',
                        borderRadius: '6px',
                        padding: '4px 14px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {t('btnComplete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, padding: '12px 20px', fontSize: '11px', fontStyle: 'italic', color: 'var(--text3)' }}>
          {t('sampleDataNote')}
        </p>
      </section>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--cyan-b)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{t('completeMaintenance')}</h3>
        <p style={{ margin: '6px 0 8px', fontSize: '12px', color: 'var(--text2)' }}>{t('techCompleteDesc')}</p>
        <p style={{ margin: '0 0 14px', fontSize: '11px', color: 'var(--text3)' }}>{t('techAssetIdRepairHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{t('techAssetIdRepair')}</span>
            <input
              id="tech-asset-input"
              type="number"
              min={0}
              value={assetIdInput}
              onChange={(e) => setAssetIdInput(e.target.value)}
              placeholder={t('techAssetIdRepairPlaceholder')}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '13px',
                width: '160px',
              }}
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runCompleteMaintenance()}
            style={{
              background: 'var(--cyan-d)',
              border: '1px solid var(--cyan-b)',
              color: 'var(--cyan)',
              borderRadius: '6px',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t('submitting') : t('completeAndEarn')}
          </button>
        </div>
      </section>

      <ActivityFeed items={earningsItems} headerTitle={t('earningsHistory')} headerDesc={null} />
    </div>
  )
}
