import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { Toaster } from 'sonner'
import { useProgram } from '@/hooks/useProgram'
import type { ActivityItem } from '@/components/ActivityFeed'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import HeroCard from '@/components/HeroCard'
import StatsRow from '@/components/StatsRow'
import EquipmentTable from '@/components/EquipmentTable'
import ActionsPanel from '@/components/ActionsPanel'
import ActivityFeed from '@/components/ActivityFeed'
import BlockchainPanel from '@/components/BlockchainPanel'

/**
 * Post-connect operational view — same layout as the previous single-page app root.
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const { publicKey, connected } = useWallet()
  const { program } = useProgram()
  const [lastTxSig, setLastTxSig] = useState<string>()
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    if (!connected) navigate('/')
  }, [connected, navigate])

  function onTxSuccess(sig: string, message: string, type: ActivityItem['type']) {
    setLastTxSig(sig)
    setActivity((prev) => [{ message, time: new Date().toLocaleTimeString(), type }, ...prev].slice(0, 8))
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="min-h-screen flex-1 overflow-y-auto pl-[220px] p-8">
        <Topbar lastTxSig={lastTxSig} />
        <HeroCard />
        <StatsRow total={0} active={0} issues={0} maintenance={0} />
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <EquipmentTable program={program} publicKey={publicKey} />
          <div className="flex flex-col gap-5">
            <ActionsPanel program={program} publicKey={publicKey} onTxSuccess={onTxSuccess} />
            <ActivityFeed items={activity} />
          </div>
        </div>
        <BlockchainPanel lastTxSig={lastTxSig} />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
