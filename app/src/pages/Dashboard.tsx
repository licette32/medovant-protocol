import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { Toaster } from 'sonner'
import { useRole } from '@/context/RoleContext'
import { useProgram } from '@/hooks/useProgram'
import type { ActivityItem } from '@/components/ActivityFeed'
import { normalizeTxSignature } from '@/utils/formatters'
import HospitalDashboard from '@/components/HospitalDashboard'
import Sidebar from '@/components/Sidebar'
import TechnicianDashboard from '@/components/TechnicianDashboard'
import Topbar from '@/components/Topbar'

/**
 * Post-connect shell: sidebar + topbar; main content depends on hospital vs technician role (UI only).
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const { publicKey, connected } = useWallet()
  const { program } = useProgram()
  const { isHospital } = useRole()
  const [lastTxSig, setLastTxSig] = useState<string>()
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    if (!connected) navigate('/')
  }, [connected, navigate])

  function onTxSuccess(sig: string, message: string, type: ActivityItem['type']) {
    setLastTxSig(normalizeTxSignature(sig))
    setActivity((prev) => [{ message, time: new Date().toLocaleTimeString(), type }, ...prev].slice(0, 8))
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-y-auto pl-[220px]">
        <Topbar lastTxSig={lastTxSig} />
        <main className="flex-1 px-7 py-6">
          {isHospital ? (
            <HospitalDashboard
              program={program}
              publicKey={publicKey}
              onTxSuccess={onTxSuccess}
              activity={activity}
              lastTxSig={lastTxSig}
            />
          ) : (
            <TechnicianDashboard program={program} publicKey={publicKey} onTxSuccess={onTxSuccess} activity={activity} />
          )}
        </main>
      </div>
      <Toaster position="bottom-right" richColors theme="system" />
    </div>
  )
}
