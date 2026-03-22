import { createContext, useContext, useState, type ReactNode } from 'react'

type Role = 'hospital' | 'technician'

interface RoleContextType {
  role: Role
  setRole: (r: Role) => void
  isHospital: boolean
}

const RoleContext = createContext<RoleContextType>({
  role: 'hospital',
  setRole: () => {},
  isHospital: true,
})

/** UI-only role switch — does not change wallet or on-chain identity. */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('hospital')
  return (
    <RoleContext.Provider value={{ role, setRole, isHospital: role === 'hospital' }}>{children}</RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
