import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { truncatePubkey } from '@/utils/formatters'

/**
 * Landing screen — wallet connect is the gate before the operational dashboard.
 */
export default function Home() {
  const navigate = useNavigate()
  const { connected, publicKey } = useWallet()

  useEffect(() => {
    if (connected) navigate('/dashboard')
  }, [connected, navigate])

  const addressLine =
    connected && publicKey ? `Connected: ${truncatePubkey(publicKey.toBase58())}` : null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        backgroundColor: '#F0EDE8',
        backgroundImage: `
          linear-gradient(rgba(167, 139, 250, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(167, 139, 250, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        padding: '40px 20px',
      }}
    >
      <img src="/logo.png" alt="Medovant" style={{ height: '300px' }} />
      <p
        style={{
          margin: 0,
          maxWidth: '440px',
          textAlign: 'center',
          fontSize: '14px',
          lineHeight: 1.7,
          color: '#9E9E9E',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Verifiable maintenance. Trustless coordination. Automated payments.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {['Vault PDA escrow', 'Technician reputation', 'Anchor 0.32.1'].map((text) => (
          <span
            key={text}
            style={{
              background: '#EDE9FE',
              color: '#5B21B6',
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '12px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {text}
          </span>
        ))}
      </div>
      <div style={{ marginTop: '8px' }}>
        <WalletMultiButton />
      </div>
      {addressLine && (
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#6B7280',
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {addressLine}
        </p>
      )}
    </div>
  )
}

