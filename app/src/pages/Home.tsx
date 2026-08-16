import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Moon, Sun } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/i18n/LangContext'
import { useRole } from '@/context/RoleContext'
import { truncatePubkey } from '@/utils/formatters'

/**
 * Value-first landing — the visitor understands the protocol before
 * choosing a role, then connects a wallet (issue #18).
 */
export default function Home() {
  const navigate = useNavigate()
  const { connected, publicKey } = useWallet()
  const { setVisible } = useWalletModal()
  const { isDark, toggleTheme } = useTheme()
  const { lang, t, toggleLang } = useLang()
  const { setRole } = useRole()
  const [pendingRole, setPendingRole] = useState<'hospital' | 'technician' | null>(null)

  useEffect(() => {
    if (!connected) return
    if (pendingRole) {
      setRole(pendingRole)
      navigate('/dashboard')
    } else {
      navigate('/dashboard')
    }
  }, [connected])

  const handleRoleSelect = (role: 'hospital' | 'technician') => {
    setPendingRole(role)
    if (connected) {
      setRole(role)
      navigate('/dashboard')
    } else {
      setVisible(true)
    }
  }

  const addressLine =
    connected && publicKey ? `${t('connected')}: ${truncatePubkey(publicKey.toBase58())}` : null

  const pills = [t('pill1'), t('pill2'), t('pill3')]

  const actors = [
    { emoji: '🏥', title: t('actorHospital'), desc: t('actorHospitalDesc') },
    { emoji: '🔧', title: t('actorTech'), desc: t('actorTechDesc') },
    { emoji: '📋', title: t('actorAuditor'), desc: t('actorAuditorDesc') },
  ]

  const steps = [
    { title: t('step1Title'), desc: t('step1Desc') },
    { title: t('step2Title'), desc: t('step2Desc') },
    { title: t('step3Title'), desc: t('step3Desc') },
  ]

  const toggleBtn: CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    color: 'var(--text2)',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  }

  const stepCircle: CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--green)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
  }

  return (
    <div
      className="relative"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--bg)',
        backgroundImage: 'radial-gradient(1000px 420px at 50% -120px, var(--green-d), transparent 62%)',
        padding: '48px 20px 80px',
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
          maxWidth: '880px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '72px',
        }}
      >
        <section
          style={{
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--green-b)] bg-[var(--green-d)] px-3 py-1 text-[13px] font-medium text-accentg"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-accentg" aria-hidden />
            {t('devnetLive')}
          </div>
          <img
            src="/logo-home.png"
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
              fontSize: '42px',
              lineHeight: 1.15,
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {t('heroTagline')}
          </h1>
          <p
            style={{
              margin: 0,
              width: '100%',
              fontSize: '16px',
              lineHeight: 1.7,
              color: 'var(--text3)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {t('heroDesc')}
          </p>
        </section>

        <section
          style={{
            maxWidth: '880px',
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          {actors.map((actor) => (
            <div
              key={actor.title}
              style={{
                flex: '1 1 250px',
                minWidth: '230px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '26px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <p style={{ margin: 0, fontSize: '24px', lineHeight: 1 }}>{actor.emoji}</p>
              <p
                style={{
                  margin: '10px 0 6px',
                  fontSize: '17px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {actor.title}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--text2)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {actor.desc}
              </p>
            </div>
          ))}
        </section>

        <section
          style={{
            maxWidth: '620px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {t('howTitle')}
          </h2>
          {steps.map((step, i) => (
            <div
              key={step.title}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                position: 'relative',
                paddingBottom: i === steps.length - 1 ? 0 : '22px',
              }}
            >
              {i !== steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '13px',
                    top: '36px',
                    bottom: '0',
                    width: '2px',
                    background: 'var(--border-accent)',
                  }}
                />
              )}
              <div style={stepCircle}>{i + 1}</div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: 'var(--text2)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
          <button type="button" className="cta-role" onClick={() => handleRoleSelect('hospital')}>
            {t('ctaHospital')}
          </button>
          <button type="button" className="cta-role" onClick={() => handleRoleSelect('technician')}>
            {t('ctaTech')}
          </button>
        </section>

        {addressLine && (
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text2)',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            {addressLine}
          </p>
        )}

        <footer
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            borderTop: '1px solid var(--border)',
            paddingTop: '36px',
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
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {text}
            </span>
          ))}
          <button
            type="button"
            onClick={() => navigate('/admin')}
            style={{
              fontSize: '11px',
              color: 'var(--text3)',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Admin
          </button>
        </footer>
      </div>
    </div>
  )
}