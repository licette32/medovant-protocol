import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Hammer, Radio } from 'lucide-react'

export type ActivityItem = {
  message: string
  time: string
  type: 'ok' | 'warn' | 'tx' | 'fix'
}

const typeConfig: Record<
  ActivityItem['type'],
  { dot: string; icon: LucideIcon }
> = {
  ok: { dot: 'bg-green', icon: CheckCircle2 },
  warn: { dot: 'bg-warning', icon: AlertTriangle },
  tx: { dot: 'bg-lavender', icon: Radio },
  fix: { dot: 'bg-stone-400', icon: Hammer },
}

type Props = { items: ActivityItem[] }

export default function ActivityFeed({ items }: Props) {
  return (
    <section className="rounded-xl border border-stone-100 bg-surface p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-navy">Activity</h3>
      <p className="mt-0.5 text-xs text-stone-500">Latest on-chain actions from this session.</p>
      <ul className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-stone-400">No activity yet — submit a transaction to populate.</li>
        ) : (
          items.map((item, i) => {
            const cfg = typeConfig[item.type]
            const Icon = cfg.icon
            return (
              <li key={`${item.time}-${i}`} className="flex gap-3 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-stone-800">{item.message}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-400">
                    <Icon className="h-3 w-3" />
                    {item.time}
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
