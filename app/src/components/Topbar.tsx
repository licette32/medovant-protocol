import type { CSSProperties } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/i18n/LangContext'
import { truncatePubkey } from '@/utils/formatters'

type Props = { lastTxSig?: string }

export default function Topbar({ lastTxSig: _ }: Props) {
  const { isDark, toggleTheme } = useTheme()
  const { lang, toggleLang, t } = useLang()
  const { publicKey, connected } = useWallet()

  const btnStyle: CSSProperties = {
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
    <header
      style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t('overview')}</h1>
        <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{t('subtitle')}</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button type="button" onClick={toggleTheme} style={btnStyle}>
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
        <button type="button" onClick={toggleLang} style={btnStyle}>
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
        {connected && publicKey && (
          <div
            style={{
              ...btnStyle,
              cursor: 'default',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
            }}
            title={publicKey.toBase58()}
          >
            {truncatePubkey(publicKey.toBase58())}
          </div>
        )}
        <WalletMultiButton />
      </div>
    </header>
  )
}
