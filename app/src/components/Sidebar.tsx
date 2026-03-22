import {
  Activity,
  HeartPulse,
  History,
  LayoutDashboard,
  Stethoscope,
  Wrench,
} from 'lucide-react'

/**
 * Primary navigation — fixed column so the dashboard feels like a product shell, not a single page.
 */
export default function Sidebar() {
  const nav = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Stethoscope, label: 'Equipment', active: false },
    { icon: Wrench, label: 'Technicians', active: false },
    { icon: History, label: 'History', active: false },
    { icon: Activity, label: 'Transactions', active: false },
  ]

  return (
    <aside
      className="fixed left-0 top-0 z-20 flex h-screen w-[220px] flex-col border-r border-stone-200 bg-surface shadow-sm"
      aria-label="Main navigation"
    >
      <div className="flex items-start gap-3 border-b border-stone-100 p-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender to-[#9061f9] text-white shadow-md"
          aria-hidden
        >
          <HeartPulse className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-navy">MEDOVANT</p>
          <p className="text-xs text-stone-500">Escrow Protocol</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            type="button"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              active
                ? 'bg-lavender-light text-violet-900'
                : 'text-stone-600 hover:bg-surface2'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {label}
          </button>
        ))}
      </nav>
      <div className="border-t border-stone-100 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-green-light/80 px-3 py-2 text-xs font-medium text-emerald-900">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden />
          Solana Devnet
        </div>
      </div>
    </aside>
  )
}
