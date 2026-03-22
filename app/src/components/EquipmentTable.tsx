import type { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { useState } from 'react'
import { toast } from 'sonner'
import { getMedicalAssetPDA } from '@/utils/pdas'
import { lamportsToSol, mapAssetStatus } from '@/utils/formatters'

type Props = {
  program: Program | null
  publicKey: PublicKey | null
}

const MOCK_ROWS = [
  { id: 'EQ-1001', name: 'MRI Scanner A', status: 'Active' as const, hospital: 'Demo Hospital' },
  { id: 'EQ-1002', name: 'Ventilator B', status: 'Issue Reported' as const, hospital: 'Demo Hospital' },
  { id: 'EQ-1003', name: 'Ultrasound C', status: 'Under Maintenance' as const, hospital: 'North Wing' },
]

function statusBadgeClass(status: string) {
  if (status === 'Active') return 'bg-green-light text-emerald-900'
  if (status === 'Issue Reported') return 'bg-red-100 text-red-900'
  if (status === 'Under Maintenance') return 'bg-amber-100 text-amber-900'
  if (status === 'Decommissioned') return 'bg-stone-200 text-stone-700'
  return 'bg-stone-100 text-stone-700'
}

export default function EquipmentTable({ program, publicKey }: Props) {
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
      <section className="overflow-hidden rounded-xl border border-stone-100 bg-surface shadow-sm">
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-navy">Equipment (sample)</h3>
          <p className="text-xs text-stone-500">Sample rows — connect wallet and fetch real data.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-surface2/50 text-xs uppercase tracking-wide text-stone-500">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Hospital</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-stone-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs">{row.id}</td>
                  <td className="px-5 py-3">{row.name}</td>
                  <td className="px-5 py-3 text-stone-600">{row.hospital}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-stone-100 bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-navy">Fetch on-chain asset</h3>
        <p className="mt-1 text-xs text-stone-500">Fetches the equipment PDA for your wallet and asset ID.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-stone-600">Asset ID</span>
            <input
              type="number"
              min={0}
              value={assetIdInput}
              onChange={(e) => setAssetIdInput(e.target.value)}
              className="w-40 rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm outline-none ring-lavender focus:border-lavender focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching}
            className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white transition hover:bg-[#9061f9] disabled:opacity-50"
          >
            {fetching ? 'Fetching…' : 'Fetch asset'}
          </button>
        </div>
        {fetched && (
          <div className="mt-4 rounded-lg border border-lavender-light bg-lavender-light/30 p-4 text-sm">
            <p className="font-medium text-navy">On-chain data</p>
            <ul className="mt-2 space-y-1 text-stone-700">
              <li>
                Status:{' '}
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(fetched.status)}`}>
                  {fetched.status}
                </span>
              </li>
              <li>Failures reported: {Number(fetched.failureCount)}</li>
              <li>Escrow (lamports): {fetched.maintenanceReward}</li>
              <li>Last maintenance (unix): {fetched.lastMaintenance}</li>
              <li className="text-xs text-stone-500">Escrow ≈ {lamportsToSol(Number(fetched.maintenanceReward))} SOL</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
