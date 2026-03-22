import type { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { ChevronRight } from 'lucide-react'
import { useLang } from '@/i18n/LangContext'
import ActionsPanel from '@/components/ActionsPanel'
import type { OnTxSuccess } from '@/components/ActionsPanel'
import ActivityFeed from '@/components/ActivityFeed'
import type { ActivityItem } from '@/components/ActivityFeed'
import BlockchainPanel from '@/components/BlockchainPanel'
import EquipmentTable from '@/components/EquipmentTable'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
  onTxSuccess: OnTxSuccess
  activity: ActivityItem[]
  lastTxSig?: string
}

/** Hospital-facing layout: protocol narrative, KPIs, equipment + actions + chain info. */
export default function HospitalDashboard({
  program,
  publicKey,
  onTxSuccess,
  activity,
  lastTxSig,
}: Props) {
  const { t } = useLang()

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
      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{sub}</div>
      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '6px' }}>{actions}</div>
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
          fontSize: '11px',
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
      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>{sub}</div>
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
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', marginBottom: '14px' }}>
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
              fontSize: '10px',
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
        {kpi('var(--green)', 'var(--green)', t('kpiActiveAssets'), t('kpiActiveSub'), 0)}
        {kpi('var(--amber)', 'var(--amber)', t('kpiIssuesReported'), t('kpiIssuesSub'), 0)}
        {kpi('var(--cyan)', 'var(--cyan)', t('kpiInMaintenanceLabel'), t('kpiInMaintenanceSub'), 0)}
        {kpi('var(--red)', 'var(--red)', t('kpiDecommissionedLabel'), t('kpiDecommissionedSub'), 0)}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
          <EquipmentTable program={program} publicKey={publicKey} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '0 0 280px', minWidth: '260px' }}>
          <ActionsPanel program={program} publicKey={publicKey} onTxSuccess={onTxSuccess} />
          <ActivityFeed items={activity} />
        </div>
      </div>

      <BlockchainPanel lastTxSig={lastTxSig} />
    </div>
  )
}
