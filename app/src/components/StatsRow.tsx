import { Activity, AlertTriangle, Package, Wrench } from 'lucide-react'

type Props = {
  total?: number
  active?: number
  issues?: number
  maintenance?: number
}

const cards = [
  { key: 'total', label: 'Total Equipment', icon: Package, border: 'border-t-lavender' },
  { key: 'active', label: 'Active Devices', icon: Activity, border: 'border-t-green' },
  { key: 'issues', label: 'Critical Issues', icon: AlertTriangle, border: 'border-t-error' },
  { key: 'maintenance', label: 'In Maintenance', icon: Wrench, border: 'border-t-warning' },
] as const

export default function StatsRow({ total = 0, active = 0, issues = 0, maintenance = 0 }: Props) {
  const values: Record<(typeof cards)[number]['key'], number> = {
    total: Number(total),
    active: Number(active),
    issues: Number(issues),
    maintenance: Number(maintenance),
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, border }) => (
        <div
          key={key}
          className={`rounded-xl border border-stone-100 bg-surface p-4 shadow-sm ${border} border-t-[3px]`}
        >
          <div className="flex items-center gap-2 text-stone-500">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          </div>
          <span className="mt-2 block text-3xl font-semibold tabular-nums text-navy">{values[key]}</span>
        </div>
      ))}
    </div>
  )
}
