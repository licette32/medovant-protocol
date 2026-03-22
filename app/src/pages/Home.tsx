import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Moon, Sun } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/i18n/LangContext'
import { truncatePubkey } from '@/utils/formatters'

/**
 * Landing screen — wallet connect is the gate before the operational dashboard.
 */
export default function Home() {
  const navigate = useNavigate()
  const { connected, publicKey } = useWallet()
  const { isDark, toggleTheme } = useTheme()
  const { lang, t, toggleLang } = useLang()

  useEffect(() => {
    if (connected) navigate('/dashboard')
  }, [connected, navigate])

  const addressLine =
    connected && publicKey ? `${t('connected')}: ${truncatePubkey(publicKey.toBase58())}` : null

  const pills = [t('pill1'), t('pill2'), t('pill3')]
  const logo = isDark ? '/logo-home.png' : '/logo-claro.png'

  const toggleBtn: CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: 'var(--text2)',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  }

  return (
    <div
      className="relative"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg)',
        backgroundImage: `
          linear-gradient(rgba(63,175,143,0.06) 0.5px, transparent 0.5px),
          linear-gradient(90deg, rgba(63,175,143,0.06) 0.5px, transparent 0.5px)
        `,
        backgroundSize: '40px 40px',
        padding: '40px 20px 80px',
      }}
    >
      <div className="absolute right-5 top-5 z-10 flex gap-2" style={{ background: 'transparent' }}>
        <button type="button" onClick={toggleTheme} style={toggleBtn} aria-label="Toggle theme">
          {isDark ? (
            <>
              <Sun size={12} />
              {t('themeLight')}
            </>
          ) : (
            <>
              <Moon size={12} />
              {t('themeDark')}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={toggleLang}
          style={toggleBtn}
          aria-label={lang === 'en' ? 'Switch to Spanish' : 'Switch to English'}
        >
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
      </div>

      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--green-b)] bg-[var(--green-d)] px-3 py-1 text-[11px] font-medium text-accentg"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <span className="medovant-pulse-dot h-2 w-2 shrink-0 rounded-full bg-accentg" aria-hidden />
          {t('devnetLive')}
        </div>
        <img
          src={logo}
          alt="Medovant"
          style={{ height: '120px', width: 'auto', marginBottom: '8px' }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.onerror = null
            el.src = '/logo-W.png'
          }}
        />
        <h1
          style={{
            margin: 0,
            fontSize: '56px',
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {t('homeTitle')}
        </h1>
        <p style={{ margin: 0, fontSize: '17px', color: 'var(--text2)', fontFamily: 'Inter, sans-serif' }}>
          {t('homeSubtitle')}
        </p>
        <p
          style={{
            margin: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '14px',
            lineHeight: 1.7,
            color: 'var(--text3)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {t('homeTagline')}
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {pills.map((text, i) => (
            <span
              key={`${text}-${i}`}
              style={{
                background: 'var(--surface2)',
                color: 'var(--text2)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {text}
            </span>
          ))}
        </div>
        <div className="home-wallet-btn" style={{ marginTop: '20px' }}>
          <WalletMultiButton />
        </div>
        {addressLine && (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--text2)',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            {addressLine}
          </p>
        )}
      </div>
    </div>
  )
}
