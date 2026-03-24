import {
  ArrowLeftRight,
  History,
  LayoutDashboard,
  Stethoscope,
  Wrench,
} from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { useLang } from '@/i18n/LangContext'

export default function Sidebar() {
  const { role, setRole } = useRole()
  const { t } = useLang()

  const navItems = [
    { label: t('dashboard'), icon: LayoutDashboard },
    { label: t('equipment'), icon: Stethoscope },
    { label: t('technicians'), icon: Wrench },
    { label: t('history'), icon: History },
    { label: t('transactions'), icon: ArrowLeftRight },
  ]

  return (
    <aside
      style={{
        width: '220px',
        minHeight: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 10,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
      aria-label="Main navigation"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '6px 6px 22px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '8px',
          boxSizing: 'border-box',
        }}
      >
        <img
          src="/logo-dashboard.png"
          alt="Medovant"
          style={{
            display: 'block',
            height: '90px',
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.onerror = null
            el.src = '/logo-W.png'
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setRole('hospital')}
          style={{
            flex: 1,
            padding: '7px 4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            background: role === 'hospital' ? 'var(--green-d)' : 'transparent',
            color: role === 'hospital' ? 'var(--green)' : 'var(--text2)',
            borderRight: '1px solid var(--border)',
          }}
        >
          🏥 {t('roleHospitalTab')}
        </button>
        <button
          type="button"
          onClick={() => setRole('technician')}
          style={{
            flex: 1,
            padding: '7px 4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            background: role === 'technician' ? 'var(--cyan-d)' : 'transparent',
            color: role === 'technician' ? 'var(--cyan)' : 'var(--text2)',
          }}
        >
          🔧 {t('roleTechnicianTab')}
        </button>
      </div>

      {navItems.map((item, i) => {
        const Icon = item.icon
        return (
          <div
            key={`${item.label}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: i === 0 ? '8px 10px 8px 8px' : '8px 10px',
              borderRadius: i === 0 ? '0 6px 6px 0' : '6px',
              borderLeft: i === 0 ? '2px solid var(--green)' : 'none',
              background: i === 0 ? 'var(--green-d)' : 'transparent',
              color: i === 0 ? 'var(--green)' : 'var(--text2)',
              fontSize: '13px',
              fontWeight: i === 0 ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            <Icon size={14} />
            {item.label}
          </div>
        )
      })}

      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            background: 'var(--green-d)',
            border: '1px solid var(--green-b)',
            borderRadius: '6px',
            padding: '7px 10px',
            fontSize: '13px',
            color: 'var(--green)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--green)',
            }}
          />
          Solana Devnet
        </div>
      </div>
    </aside>
  )
}
