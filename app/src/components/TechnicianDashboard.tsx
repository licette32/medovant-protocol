import type { Program } from '@coral-xyz/anchor'
import BN from 'bn.js'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLang } from '@/i18n/LangContext'
import { showTxToast } from '@/components/Toast'
import type { ActivityItem } from '@/components/ActivityFeed'
import type { OnTxSuccess } from '@/components/EquipmentTable'
import ActivityFeed from '@/components/ActivityFeed'
import { getEscrowVaultPDA, getMedicalAssetPDA, getTechnicianProfilePDA } from '@/utils/pdas'
import { toastAnchorTxError } from '@/utils/solanaTxError'
import { getAssetDisplayName } from '@/utils/assetMetadata'
import { truncatePubkey } from '@/utils/formatters'
import { fetchAllAssets } from '@/utils/assetDiscovery'
import { isEvidenceConfigured } from '@/utils/evidence'
import type { MaintenanceEvidence } from '@/utils/evidence'
import { attachEvidenceTxSignature } from '@/utils/evidence'
import PstPanel from '@/components/PstPanel'
import EvidenceUploader from '@/components/EvidenceUploader'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
  activity: ActivityItem[]
}

type AvailableJob = {
  id: string
  assetId: number
  asset: string
  /** Owner hospital wallet (full base58) — comes from the on-chain asset, not the connected wallet. */
  hospital: string
  reward: string
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
  const [jobsCompleted, setJobsCompleted] = useState(0)
  const [totalEarnedLamports, setTotalEarnedLamports] = useState<string>('0')
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadedEvidence, setUploadedEvidence] = useState<MaintenanceEvidence | null>(null)

  const selectedJob = availableJobs.find((j) => j.id === selectedJobId) ?? null
  const evidenceConfigured = isEvidenceConfigured()

  const selectedAssetPda = selectedJob
    ? getMedicalAssetPDA(new PublicKey(selectedJob.hospital), selectedJob.assetId).toBase58()
    : null

  const refreshProfile = useCallback(async () => {
    if (!program || !publicKey) {
      setJobsCompleted(0)
      setTotalEarnedLamports('0')
      return
    }
    const profilePk = getTechnicianProfilePDA(publicKey)
    try {
      const prof = await (
        program.account as {
          technicianProfile: {
            fetch: (a: PublicKey) => Promise<{ jobsCompleted: number; totalEarned: BN }>
          }
        }
      ).technicianProfile.fetch(profilePk)
      setJobsCompleted(prof.jobsCompleted)
      setTotalEarnedLamports(prof.totalEarned.toString())
    } catch {
      setJobsCompleted(0)
      setTotalEarnedLamports('0')
    }
  }, [program, publicKey])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const fetchAvailableJobs = useCallback(async () => {
    if (!program || !publicKey) {
      setAvailableJobs([])
      return
    }
    setJobsLoading(true)
    setJobsError(false)
    try {
      const assets = await fetchAllAssets(program)
      setAvailableJobs(
        assets
          .filter((a) => a.status === 'Issue Reported')
          .map((a) => ({
            id: `${a.hospital}-${a.id}`,
            assetId: a.id,
            asset: a.name,
            hospital: a.hospital ?? '',
            reward: `${lamportsToSolString(a.maintenanceReward)} SOL`,
          }))
      )
    } catch {
      setJobsError(true)
    } finally {
      setJobsLoading(false)
    }
  }, [program, publicKey])

  useEffect(() => {
    void fetchAvailableJobs()
  }, [fetchAvailableJobs])

  useEffect(() => {
    if (availableJobs.length > 0 && !availableJobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(availableJobs[0].id)
    }
  }, [availableJobs, selectedJobId])

  useEffect(() => {
    setUploadedEvidence(null)
  }, [selectedJobId])

  const runCompleteMaintenance = useCallback(
    async (job: AvailableJob | null) => {
      if (!program || !publicKey) {
        toast.error('Connect wallet first')
        return
      }
      if (!job) {
        toast.error(t('techSelectJobRequired'))
        return
      }
      setLoading(true)
      try {
        const hospital = new PublicKey(job.hospital)
        const pda = getMedicalAssetPDA(hospital, job.assetId)
        const vault = getEscrowVaultPDA(pda)
        const techProfile = getTechnicianProfilePDA(publicKey)
        if (hospital.toBase58() !== publicKey.toBase58()) {
          toast.error(t('dualSigningPending'))
          return
        }
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
        const sig = await program
          .methods.completeMaintenance()
          .accounts({
            hospital,
            technician: publicKey,
            medicalAsset: pda,
            escrowVault: vault,
            technicianProfile: techProfile,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        showTxToast(sig)
        const doneLabel = getAssetDisplayName(job.hospital, job.assetId)
        onTxSuccess(
          sig,
          lang === 'es' ? `Mantenimiento completado — ${doneLabel}` : `Maintenance completed — ${doneLabel}`,
          'fix'
        )
        if (uploadedEvidence) {
          await attachEvidenceTxSignature(uploadedEvidence.id, sig)
          setUploadedEvidence(null)
        }
        await refreshProfile()
        await fetchAvailableJobs()
      } catch (e: unknown) {
        await toastAnchorTxError(program, e)
      } finally {
        setLoading(false)
      }
    },
    [program, publicKey, onTxSuccess, lang, fetchAvailableJobs, refreshProfile, t, uploadedEvidence]
  )

  const earningsItems = activity.filter((a) => a.type === 'fix')
  const progressPct = Math.min(100, (jobsCompleted / 10) * 100)

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
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>{t('techSubtitle')}</p>
          </div>
        </div>
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '13px',
            color: 'var(--text2)',
          }}
        >
          {t('demoTechPrefix')}: {publicKey ? truncatePubkey(publicKey.toBase58()) : '—'}
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
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{t('totalEarned')}</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--green)', fontFamily: 'DM Mono, monospace' }}>
            {lamportsToSolString(totalEarnedLamports)} SOL
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '6px' }}>{t('acrossAllJobs')}</div>
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
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{t('jobsCompleted')}</div>
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
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '6px' }}>{t('onChainReputation')}</div>
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
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{t('nextRewardLabel')}</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)' }}>—</div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '6px' }}>{t('nextRewardSub')}</div>
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
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>{t('availableJobsSub')}</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: '14px' }}>
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
              {jobsLoading && (
                <tr>
                  <td colSpan={5} style={{ padding: '14px 16px', color: 'var(--text2)' }}>
                    {t('fetching')}
                  </td>
                </tr>
              )}
              {!jobsLoading && jobsError && (
                <tr>
                  <td colSpan={5} style={{ padding: '14px 16px', color: 'var(--red)' }}>
                    {t('loadAssetsError')}
                  </td>
                </tr>
              )}
              {!jobsLoading && !jobsError && availableJobs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '14px 16px', color: 'var(--text2)' }}>
                    {t('noAssetsFound')}
                  </td>
                </tr>
              )}
              {availableJobs.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{row.asset}</div>
                    <div
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '12px',
                        color: 'var(--text3)',
                        marginTop: '4px',
                      }}
                    >
                      #{row.assetId}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                    {row.hospital ? truncatePubkey(row.hospital) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
                    {row.reward}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontSize: '13px',
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
                      disabled={loading}
                      onClick={() => void runCompleteMaintenance(row)}
                      style={{
                        background: 'var(--cyan-d)',
                        border: '1px solid var(--cyan-b)',
                        color: 'var(--cyan)',
                        borderRadius: '6px',
                        padding: '4px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading ? t('submitting') : t('btnComplete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <p style={{ margin: '6px 0 14px', fontSize: '13px', color: 'var(--text2)' }}>{t('techCompleteDesc')}</p>
        {evidenceConfigured && (
          <div style={{ marginBottom: '12px' }}>
            <EvidenceUploader
              assetPda={selectedAssetPda ?? ''}
              hospital={selectedJob?.hospital ?? ''}
              technician={publicKey ? publicKey.toBase58() : ''}
              disabled={!selectedJob || loading}
              onUploaded={(evidence) => setUploadedEvidence(evidence)}
            />
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 260px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{t('techSelectJob')}</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={availableJobs.length === 0 || loading}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                width: '100%',
              }}
            >
              {availableJobs.length === 0 && (
                <option value="">{t('techNoJobs')}</option>
              )}
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  #{job.assetId} — {job.asset} · {job.hospital ? truncatePubkey(job.hospital) : '—'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading || !selectedJob}
            onClick={() => void runCompleteMaintenance(selectedJob)}
            style={{
              background: 'var(--cyan-d)',
              border: '1px solid var(--cyan-b)',
              color: 'var(--cyan)',
              borderRadius: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !selectedJob ? 0.7 : 1,
            }}
          >
            {loading ? t('submitting') : t('completeAndEarn')}
          </button>
        </div>
      </section>

      <PstPanel
        program={program}
        publicKey={publicKey}
        mode="technician"
        onTxSuccess={onTxSuccess}
        onDone={async () => {
          await fetchAvailableJobs()
          await refreshProfile()
        }}
      />

      <ActivityFeed items={earningsItems} headerTitle={t('earningsHistory')} headerDesc={null} />
    </div>
  )
}
