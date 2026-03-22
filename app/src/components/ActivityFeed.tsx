import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Hammer, Radio } from 'lucide-react'
import { useLang } from '@/i18n/LangContext'

export type ActivityItem = {
  message: string
  time: string
  type: 'ok' | 'warn' | 'tx' | 'fix'
}

const typeConfig: Record<
  ActivityItem['type'],
  { dot: string; icon: LucideIcon; iconClass: string }
> = {
  ok: { dot: 'bg-accentg', icon: CheckCircle2, iconClass: 'text-accentg' },
  warn: { dot: 'bg-accenta', icon: AlertTriangle, iconClass: 'text-accenta' },
  tx: { dot: 'bg-accentc', icon: Radio, iconClass: 'text-accentc' },
  fix: { dot: 'bg-accentg', icon: Hammer, iconClass: 'text-accentg' },
}

type Props = {
  items: ActivityItem[]
  /** When set, replaces default "Activity" title. */
  headerTitle?: string
  /**
   * Subtitle under header. Omit for default when headerTitle is also omitted.
   * Pass `null` to hide the subtitle line (e.g. technician earnings header).
   */
  headerDesc?: string | null
}

export default function ActivityFeed({ items, headerTitle, headerDesc }: Props) {
  const { t } = useLang()
  const title = headerTitle ?? t('activity')
  const resolvedDesc =
    headerDesc === null
      ? null
      : headerTitle !== undefined && headerDesc === undefined
        ? null
        : headerDesc ?? t('activityDesc')

  return (
    <section className="rounded-[var(--radius)] border border-med bg-surface p-0 shadow-med">
      <div className="border-b border-med p-5">
        <h3 className="text-sm font-semibold text-tpri">{title}</h3>
        {resolvedDesc != null && resolvedDesc !== '' && (
          <p className="mt-0.5 text-xs text-tsec">{resolvedDesc}</p>
        )}
      </div>
      <ul className="divide-y divide-med">
        {items.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm italic text-tmuted">{t('noActivity')}</li>
        ) : (
          items.map((item, i) => {
            // Defensive: bad `type` from future callbacks would crash cfg.icon
            const safeType: ActivityItem['type'] =
              item.type === 'ok' || item.type === 'warn' || item.type === 'tx' || item.type === 'fix' ? item.type : 'tx'
            const cfg = typeConfig[safeType]
            const Icon = cfg.icon
            return (
              <li key={`${item.time}-${i}`} className="flex gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-tpri">{item.message}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-tsec">
                    <Icon className={`h-3 w-3 ${cfg.iconClass}`} />
                    <span className="text-[10px] text-tmuted">{item.time}</span>
                  </p>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
