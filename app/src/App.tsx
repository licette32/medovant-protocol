import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import Home from '@/pages/Home'
import Dashboard from '@/pages/Dashboard'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { connected } = useWallet()
  if (!connected) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
