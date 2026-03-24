import type { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import type { OnChainAsset, OnTxSuccess } from '@/components/EquipmentTable'
import ActivityFeed from '@/components/ActivityFeed'
import type { ActivityItem } from '@/components/ActivityFeed'
import BlockchainPanel from '@/components/BlockchainPanel'
import EquipmentTable from '@/components/EquipmentTable'
import { getAssetMeta } from '@/utils/assetNames'
import { mapAssetStatus } from '@/utils/formatters'
import { getMedicalAssetPDA } from '@/utils/pdas'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
  activity: ActivityItem[]
  lastTxSig?: string
}

function lamportsToNum(v: { toNumber?: () => number; toString?: () => string } | number): number {
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v.toString?.() ?? '0')
}

/** Hospital-facing layout: protocol narrative, KPIs, equipment + actions + chain info. */
export default function HospitalDashboard({
  program,
  publicKey,
  onTxSuccess,
  activity,
  lastTxSig,
}: Props) {
  const { t, lang } = useLang()
  const [assets, setAssets] = useState<OnChainAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  const fetchAssets = useCallback(async () => {
    if (!program || !publicKey) return
    setAssetsLoading(true)
    const found: OnChainAsset[] = []
    for (let id = 1; id <= 10; id++) {
      try {
        const pda = getMedicalAssetPDA(publicKey, id)
        const data = await (
          program.account as {
            medicalAsset: {
              fetch: (a: PublicKey) => Promise<{
                status: Record<string, unknown>
                maintenanceReward: { toNumber?: () => number; toString?: () => string }
                failureCount: number
                lastMaintenance: { toNumber?: () => number; toString?: () => string }
              }>
            }
          }
        ).medicalAsset.fetch(pda)
        const meta = getAssetMeta(publicKey.toBase58(), id)
        found.push({
          id,
          pda,
          name: meta?.name ?? `Asset #${id}`,
          location: meta?.location,
          status: mapAssetStatus(data.status as Record<string, unknown>),
          maintenanceReward: lamportsToNum(data.maintenanceReward),
          failureCount: data.failureCount,
          lastMaintenance: lamportsToNum(data.lastMaintenance),
        })
      } catch {
        /* account missing — skip */
      }
    }
    setAssets(found)
    setAssetsLoading(false)
  }, [program, publicKey])

  useEffect(() => {
    if (program && publicKey) void fetchAssets()
  }, [program, publicKey, fetchAssets])

  const kpiActive = useMemo(() => assets.filter((a) => a.status === 'Active').length, [assets])
  const kpiIssues = useMemo(() => assets.filter((a) => a.status === 'Issue Reported').length, [assets])
  const kpiMaintenance = useMemo(() => assets.filter((a) => a.status === 'Under Maintenance').length, [assets])
  const kpiDecommissioned = useMemo(() => assets.filter((a) => a.status === 'Decommissioned').length, [assets])
  const kpiEscrowSOL = useMemo(
    () => assets.reduce((sum, a) => sum + a.maintenanceReward, 0) / 1e9,
    [assets]
  )

  const issuesSub =
    kpiEscrowSOL > 0
      ? `${kpiEscrowSOL.toFixed(4)} SOL ${lang === 'es' ? 'bloqueado' : 'locked'}`
      : t('kpiIssuesSub')

  const node = (
    iconBg: string,
    emoji: string,
    title: string,
    sub: string,
    actions: string
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px', flex: '1 1 120px' }}>
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        }}
      >
        {emoji}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{sub}</div>
      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>{actions}</div>
    </div>
  )

  const arrow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: 'var(--text3)',
        margin: '0 16px',
        paddingBottom: '20px',
        fontSize: '20px',
      }}
    >
      <ChevronRight size={20} strokeWidth={1.75} />
    </div>
  )

  const kpi = (
    borderColor: string,
    valueColor: string,
    label: string,
    sub: string,
    value: string | number
  ) => (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: '140px',
        minHeight: '90px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '10px',
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          color: 'var(--text2)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '32px',
          fontWeight: 700,
          lineHeight: 1,
          color: valueColor,
          marginTop: '4px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: '10px',
          padding: '20px 24px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginBottom: '14px' }}>
          {t('protocolFlow')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '8px' }}>
          {node('var(--green-d)', '🏥', t('nodeHospital'), t('nodeHospitalSub'), t('nodeHospitalActs'))}
          {arrow}
          {node('var(--amber-d)', '◎', t('nodeVault'), t('nodeVaultSub'), t('nodeVaultActs'))}
          {arrow}
          {node('var(--cyan-d)', '🔧', t('nodeTech'), t('nodeTechSub'), t('nodeTechActs'))}
          <div
            style={{
              marginLeft: 'auto',
              alignSelf: 'center',
              maxWidth: '180px',
              textAlign: 'center',
              background: 'var(--purple-d)',
              border: '1px solid var(--purple-b)',
              color: 'var(--purple)',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: '8px',
              lineHeight: 1.4,
            }}
          >
            {t('escrowSecured')}
          </div>
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
        {kpi('var(--text2)', 'var(--text)', t('totalEquipment'), t('kpiActiveSub'), assets.length)}
        {kpi('var(--green)', 'var(--green)', t('kpiActiveAssets'), t('kpiActiveSub'), kpiActive)}
        {kpi('var(--amber)', 'var(--amber)', t('kpiIssuesReported'), issuesSub, kpiIssues)}
        {kpi('var(--cyan)', 'var(--cyan)', t('kpiInMaintenanceLabel'), t('kpiInMaintenanceSub'), kpiMaintenance)}
        {kpi('var(--red)', 'var(--red)', t('kpiDecommissionedLabel'), t('kpiDecommissionedSub'), kpiDecommissioned)}
      </div>

      <EquipmentTable
        program={program}
        publicKey={publicKey}
        onTxSuccess={onTxSuccess}
        assets={assets}
        assetsLoading={assetsLoading}
        onAssetsChange={fetchAssets}
      />

      <ActivityFeed items={activity} />

      <BlockchainPanel lastTxSig={lastTxSig} />
    </div>
  )
}
