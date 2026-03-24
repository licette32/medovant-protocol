import { useTheme } from '@/context/ThemeContext'
import { useLang } from '@/i18n/LangContext'

/**
 * Hero strip — establishes trust (devnet, program live) without blocking the operational UI below.
 */
export default function HeroCard() {
  const { t } = useLang()
  const { isDark } = useTheme()
  const logo = isDark ? '/logo-black.png' : '/logo-W.png'
  const pills = [t('pill1'), t('pill2'), t('pill3'), t('pill4')] as const

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius)] border border-[color:var(--border-accent)] bg-surface px-10 py-9 text-tpri before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(90deg,var(--border)_1px,transparent_1px),linear-gradient(var(--border)_1px,transparent_1px)] before:bg-[length:32px_32px] before:opacity-[0.35] before:content-['']"
      aria-labelledby="hero-title"
    >
      <div className="relative z-[1]">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--green-b)] bg-[var(--green-d)] px-3 py-1 text-[13px] font-medium text-accentg">
          <span className="h-2 w-2 rounded-full bg-accentg" aria-hidden />
          {t('devnetLive')}
        </div>
        <img
          src={logo}
          alt="Medovant"
          className="mb-3 h-14 w-auto opacity-95"
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.onerror = null
            el.src = '/logo-W.png'
          }}
        />
        <h2 id="hero-title" className="text-4xl font-semibold tracking-[0.02em] text-tpri">
          MEDOVANT
        </h2>
        <p className="mt-2 max-w-[480px] text-sm text-tsec">{t('tagline')}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <li
              key={pill}
              className="rounded-full border border-med bg-surface2 px-[14px] py-[5px] text-[13px] text-tsec"
            >
              {pill}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
