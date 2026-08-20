import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import type { PublicKey } from '@solana/web3.js'
import { useProgram } from '@/hooks/useProgram'
import { mapAssetStatus, truncatePubkey } from '@/utils/formatters'

/** Admin wallet. Set VITE_ADMIN_PUBKEY in app/.env to override; defaults to the public deploy/upgrade pubkey. */
const ADMIN_PUBKEY: string =
  (import.meta.env.VITE_ADMIN_PUBKEY as string | undefined)?.trim() ||
  '2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76'

const EXPLORER_BASE = 'https://explorer.solana.com/address'

type RawAsset = {
  hospital: PublicKey
  assetId: { toString: () => string }
  status: Record<string, unknown>
  maintenanceReward: { toNumber: () => number }
  failureCount: number
}

type RawTech = {
  technician: PublicKey
  jobsCompleted: number
  totalEarned: { toNumber: () => number }
}

type AssetEntry = { publicKey: PublicKey; account: RawAsset }
type TechEntry = { publicKey: PublicKey; account: RawTech }

function explorerUrl(pubkey: string): string {
  return `${EXPLORER_BASE}/${pubkey}?cluster=devnet`
}

function statusBadge(status: string): string {
  if (status === 'Active') return 'border border-[color:var(--green-b)] bg-[var(--green-d)] text-[color:var(--green)]'
  if (status === 'Issue Reported')
    return 'border border-[color:var(--amber-b)] bg-[var(--amber-d)] text-[color:var(--amber)]'
  return 'border border-med bg-surface3 text-tmuted'
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px 24px',
  boxShadow: 'var(--shadow)',
}

const backBtn: CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text2)',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const statCard = (accent: string, label: string, value: string | number): JSX.Element => (
  <div
    style={{
      flex: '1 1 180px',
      minWidth: '180px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: '10px',
      padding: '16px 18px',
      boxShadow: 'var(--shadow)',
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
    <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1, color: 'var(--text)', marginTop: '6px' }}>
      {value}
    </div>
  </div>
)

/**
 * Admin panel — read-only on-chain overview (issue #19).
 * Access is gated to the hardcoded ADMIN_PUBKEY wallet.
 */
export default function Admin() {
  const navigate = useNavigate()
  const { connected, publicKey } = useWallet()
  const { setVisible } = useWalletModal()
  const { program } = useProgram()

  const [assets, setAssets] = useState<AssetEntry[]>([])
  const [technicians, setTechnicians] = useState<TechEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const isAdmin = connected && publicKey?.toBase58() === ADMIN_PUBKEY

  useEffect(() => {
    if (!isAdmin || !program) return
    let cancelled = false
    setLoading(true)
    setError(false)
    const assetClient = (
      program.account as unknown as {
        medicalAsset: { all: () => Promise<AssetEntry[]> }
      }
    ).medicalAsset
    const techClient = (
      program.account as unknown as {
        technicianProfile: { all: () => Promise<TechEntry[]> }
      }
    ).technicianProfile
    void Promise.all([assetClient.all(), techClient.all()])
      .then(([assetRows, techRows]) => {
        if (cancelled) return
        setAssets(assetRows)
        setTechnicians(techRows)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const sortedAssets = [...assets].sort(
    (a, b) => Number(a.account.assetId.toString()) - Number(b.account.assetId.toString())
  )
  const openIssues = assets.filter((a) => 'issueReported' in a.account.status).length

  const tableHead: CSSProperties = {
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: '12px',
    color: 'var(--text2)',
    textAlign: 'left',
    padding: '12px 16px',
  }

  const tableCell: CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    fontSize: '13px',
    color: 'var(--text)',
  }

  const mono: CSSProperties = { fontFamily: '"DM Mono", monospace', fontSize: '12px' }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Admin Panel</h1>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text2)' }}>
              Read-only on-chain overview
            </p>
          </div>
          <button type="button" onClick={() => navigate('/')} style={backBtn}>
            ← Home
          </button>
        </div>

        {!connected && (
          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Connect wallet</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
              An authorized admin wallet is required to view the on-chain state.
            </p>
            <button
              type="button"
              className="cta-role"
              onClick={() => setVisible(true)}
              style={{ marginTop: '18px' }}
            >
              Connect Wallet
            </button>
          </div>
        )}

        {connected && !isAdmin && (
          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--red)' }}>Access denied</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
              The connected wallet is not authorized to view this panel.
            </p>
          </div>
        )}

        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {statCard('var(--green)', 'Total assets', loading ? '…' : assets.length)}
              {statCard('var(--cyan)', 'Total technicians', loading ? '…' : technicians.length)}
              {statCard('var(--amber)', 'Open issues', loading ? '…' : openIssues)}
            </div>

            {error && (
              <div style={{ ...cardStyle, borderColor: 'var(--red-b)', color: 'var(--red)', fontSize: '13px' }}>
                Failed to load on-chain data. Check the connection and try again.
              </div>
            )}

            <section style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Assets</h2>
              <p style={{ margin: '4px 0 16px', fontSize: '12px', color: 'var(--text2)' }}>
                All on-chain MedicalAsset PDAs
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHead}>Asset ID</th>
                      <th style={tableHead}>Hospital</th>
                      <th style={tableHead}>Status</th>
                      <th style={tableHead}>Failures</th>
                      <th style={tableHead}>Reward (SOL)</th>
                      <th style={tableHead}>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={6} style={{ ...tableCell, textAlign: 'center', color: 'var(--text2)' }}>
                          Fetching on-chain data…
                        </td>
                      </tr>
                    )}
                    {!loading && sortedAssets.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ ...tableCell, textAlign: 'center', color: 'var(--text2)' }}>
                          No assets found
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      sortedAssets.map(({ publicKey: pda, account }) => {
                        const status = mapAssetStatus(account.status)
                        const reward = account.maintenanceReward.toNumber() / 1e9
                        return (
                          <tr key={pda.toBase58()} style={{ transition: 'background 0.15s' }}>
                            <td style={{ ...tableCell, ...mono }}>#{account.assetId.toString()}</td>
                            <td style={tableCell}>
                              <span style={mono} title={account.hospital.toBase58()}>
                                {truncatePubkey(account.hospital.toBase58())}
                              </span>
                            </td>
                            <td style={tableCell}>
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(status)}`}
                              >
                                {status}
                              </span>
                            </td>
                            <td style={{ ...tableCell, color: account.failureCount > 0 ? 'var(--amber)' : 'var(--text2)' }}>
                              {account.failureCount}
                            </td>
                            <td style={{ ...tableCell, ...mono }}>
                              {reward > 0 ? (
                                <span style={{ color: 'var(--amber)' }}>{reward.toFixed(4)}</span>
                              ) : (
                                <span style={{ color: 'var(--text3)' }}>—</span>
                              )}
                            </td>
                            <td style={tableCell}>
                              <a
                                href={explorerUrl(pda.toBase58())}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--green)', fontSize: '12px' }}
                              >
                                View ↗
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Technicians</h2>
              <p style={{ margin: '4px 0 16px', fontSize: '12px', color: 'var(--text2)' }}>
                All on-chain TechnicianProfile PDAs
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHead}>Pubkey</th>
                      <th style={tableHead}>Jobs completed</th>
                      <th style={tableHead}>Total earned (SOL)</th>
                      <th style={tableHead}>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={4} style={{ ...tableCell, textAlign: 'center', color: 'var(--text2)' }}>
                          Fetching on-chain data…
                        </td>
                      </tr>
                    )}
                    {!loading && technicians.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ ...tableCell, textAlign: 'center', color: 'var(--text2)' }}>
                          No technicians registered
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      technicians.map(({ publicKey: pda, account }) => (
                        <tr key={pda.toBase58()} style={{ transition: 'background 0.15s' }}>
                          <td style={tableCell}>
                            <span style={mono} title={account.technician.toBase58()}>
                              {truncatePubkey(account.technician.toBase58())}
                            </span>
                          </td>
                          <td style={tableCell}>{account.jobsCompleted}</td>
                          <td style={{ ...tableCell, ...mono }}>
                            {(account.totalEarned.toNumber() / 1e9).toFixed(4)}
                          </td>
                          <td style={tableCell}>
                            <a
                              href={explorerUrl(pda.toBase58())}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--green)', fontSize: '12px' }}
                            >
                              View ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
