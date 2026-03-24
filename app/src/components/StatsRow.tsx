import { Activity, AlertTriangle, Package, Wrench } from 'lucide-react'
import { useLang } from '@/i18n/LangContext'
import type { TranslationKey } from '@/i18n/translations'

type Props = {
  total?: number
  active?: number
  issues?: number
  maintenance?: number
}

const cards: {
  key: 'total' | 'active' | 'issues' | 'maintenance'
  labelKey: TranslationKey
  icon: typeof Package
  iconWrap: string
}[] = [
  { key: 'total', labelKey: 'totalEquipment', icon: Package, iconWrap: 'bg-[var(--green-d)] text-accentg' },
  { key: 'active', labelKey: 'activeDevices', icon: Activity, iconWrap: 'bg-[var(--cyan-d)] text-accentc' },
  { key: 'issues', labelKey: 'criticalIssues', icon: AlertTriangle, iconWrap: 'bg-[var(--amber-d)] text-accenta' },
  { key: 'maintenance', labelKey: 'inMaintenance', icon: Wrench, iconWrap: 'bg-[var(--red-d)] text-accentr' },
]

export default function StatsRow({ total = 0, active = 0, issues = 0, maintenance = 0 }: Props) {
  const { t } = useLang()
  const values = {
    total: Number(total),
    active: Number(active),
    issues: Number(issues),
    maintenance: Number(maintenance),
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ key, labelKey, icon: Icon, iconWrap }) => (
        <div
          key={key}
          className="rounded-[var(--radius)] border border-med bg-surface p-5 shadow-med"
        >
          <div className="flex items-start gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
              <Icon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium uppercase tracking-[0.05em] text-tsec">{t(labelKey)}</p>
              <span className="mt-1 block text-[28px] font-semibold tabular-nums text-tpri">{values[key]}</span>
              <p className="mt-0.5 text-[13px] text-tmuted">—</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
