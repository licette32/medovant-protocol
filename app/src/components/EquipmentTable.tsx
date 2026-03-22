import type { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { useState } from 'react'
import { toast } from 'sonner'
import { useLang } from '@/i18n/LangContext'
import type { TranslationKey } from '@/i18n/translations'
import { getMedicalAssetPDA } from '@/utils/pdas'
import { lamportsToSol, mapAssetStatus } from '@/utils/formatters'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
}

/** Canonical English labels from chain / mock — map to localized UI via t(). */
const MOCK_ROWS = [
  { id: 'EQ-1001', name: 'MRI Scanner A', status: 'Active' as const, hospital: 'Demo Hospital' },
  { id: 'EQ-1002', name: 'Ventilator B', status: 'Issue Reported' as const, hospital: 'Demo Hospital' },
  { id: 'EQ-1003', name: 'Ultrasound C', status: 'Under Maintenance' as const, hospital: 'North Wing' },
]

function statusBadgeClass(status: string) {
  if (status === 'Active')
    return 'border border-[color:var(--green-b)] bg-[var(--green-d)] text-accentg'
  if (status === 'Issue Reported')
    return 'border border-[color:var(--amber-b)] bg-[var(--amber-d)] text-accenta'
  if (status === 'Under Maintenance')
    return 'border border-[color:var(--red-b)] bg-[var(--red-d)] text-accentr'
  if (status === 'Decommissioned')
    return 'border border-med bg-surface3 text-tmuted'
  return 'border border-med bg-surface2 text-tsec'
}

function translateStatus(status: string, t: (key: TranslationKey) => string): string {
  if (status === 'Active') return t('statusActive')
  if (status === 'Issue Reported') return t('statusIssue')
  if (status === 'Under Maintenance') return t('statusMaintenance')
  if (status === 'Decommissioned') return t('statusDecommissioned')
  return status
}

export default function EquipmentTable({ program, publicKey }: Props) {
  const { t } = useLang()
  const [assetIdInput, setAssetIdInput] = useState('1')
  const [fetching, setFetching] = useState(false)
  const [fetched, setFetched] = useState<{
    status: string
    failureCount: number
    maintenanceReward: string
    lastMaintenance: string
  } | null>(null)

  async function handleFetch() {
    if (!program || !publicKey) {
      toast.error('Connect wallet first')
      return
    }
    const id = parseInt(assetIdInput, 10)
    if (Number.isNaN(id) || id < 0) {
      toast.error('Enter a valid asset ID')
      return
    }
    setFetching(true)
    setFetched(null)
    try {
      const pda = getMedicalAssetPDA(publicKey, id)
      const acc = await (program.account as { medicalAsset: { fetch: (a: PublicKey) => Promise<{
        status: Record<string, unknown>
        failureCount: number
        maintenanceReward: { toString: () => string }
        lastMaintenance: { toString: () => string }
      }> } }).medicalAsset.fetch(pda)
      setFetched({
        status: mapAssetStatus(acc.status as Record<string, unknown>),
        failureCount: acc.failureCount,
        maintenanceReward: acc.maintenanceReward.toString(),
        lastMaintenance: acc.lastMaintenance.toString(),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Could not fetch asset', { description: msg })
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[var(--radius)] border border-med bg-surface shadow-med">
        <div className="border-b border-med px-5 py-4">
          <h3 className="text-sm font-semibold text-tpri">{t('equipmentRegistry')}</h3>
          <p className="text-xs text-tsec">{t('onChainAccounts')}</p>
          <p className="mt-1 text-xs text-tmuted">{t('sampleRows')}</p>
        </div>
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-[13px]"
            style={{ tableLayout: 'fixed', width: '100%' }}
          >
            <colgroup>
              <col style={{ width: '80px' }} />
              <col />
              <col style={{ width: '140px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-med bg-surface2 text-[11px] uppercase tracking-[0.05em] text-tsec">
                <th className="px-4 py-3">{t('colAsset')}</th>
                <th className="px-4 py-3">{t('colName')}</th>
                <th className="px-4 py-3">{t('colHospital')}</th>
                <th className="px-4 py-3">{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ROWS.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-med text-tpri transition-colors last:border-0 hover:bg-surface2"
                >
                  <td
                    className="px-4 py-3 font-mono align-top"
                    style={{
                      width: '80px',
                      verticalAlign: 'top',
                      fontSize: '10px',
                      color: 'var(--text3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.id}
                  </td>
                  <td className="px-4 py-3 align-top" style={{ verticalAlign: 'top' }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: '13px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '10px',
                        color: 'var(--text3)',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-tsec align-top" style={{ verticalAlign: 'top' }}>
                    {row.hospital}
                  </td>
                  <td className="px-4 py-3 align-top" style={{ verticalAlign: 'top' }}>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                      {translateStatus(row.status, t)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-med bg-surface2 px-5 py-4">
          <h3 className="text-sm font-semibold text-tpri">{t('fetchAsset')}</h3>
          <p className="mt-1 text-xs text-tsec">{t('fetchDesc')}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-tsec">{t('assetId')}</span>
              <input
                type="number"
                min={0}
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                className="w-40 rounded-sm border border-med bg-surface px-3 py-2 font-mono text-sm text-tpri outline-none focus:border-[color:var(--green-b)] focus:ring-1 focus:ring-[color:var(--green)]/30"
              />
            </label>
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetching}
              className="rounded-sm border border-[color:var(--green-b)] bg-[var(--green-d)] px-4 py-2 text-sm font-medium text-accentg transition hover:bg-[var(--green-b)] disabled:opacity-50"
            >
              {fetching ? t('fetching') : t('fetchButton')}
            </button>
          </div>
          {fetched && (
            <div className="mt-4 rounded-sm border border-med bg-surface p-4 text-sm">
              <p className="font-medium text-tpri">{t('onChainData')}</p>
              <ul className="mt-2 space-y-1 text-tsec">
                <li>
                  {t('statusLabel')}:{' '}
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(fetched.status)}`}>
                    {translateStatus(fetched.status, t)}
                  </span>
                </li>
                <li>
                  {t('failuresReported')}: {Number(fetched.failureCount)}
                </li>
                <li>
                  {t('escrowLamports')}:{' '}
                  <span className="font-mono text-accentg">{fetched.maintenanceReward}</span>
                </li>
                <li>
                  {t('lastMaintenanceUnix')}:{' '}
                  <span className="font-mono text-tsec">{fetched.lastMaintenance}</span>
                </li>
                <li className="text-xs text-tmuted">
                  {t('escrowApprox')}{' '}
                  <span className="font-mono text-accentg">{lamportsToSol(Number(fetched.maintenanceReward))}</span> SOL
                </li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
