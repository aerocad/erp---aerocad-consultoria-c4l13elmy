import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { setGlobalOcultarValores } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types/crm'
import { clearSensitiveAreaGates } from '@/components/auth/SensitiveAreaGate'

import type { Role } from '@/types/crm'

type AuthContextValue = {
  user: UserRecord | null
  rawUser: UserRecord | null
  isSimulating: boolean
  simulatedRole: Role | null
  startSimulation: (role: Role) => void
  stopSimulation: () => void
  ready: boolean
  login: (email: string, password: string) => Promise<UserRecord>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [rawUser, setRawUser] = useState<UserRecord | null>(
    () => (pb.authStore.record as UserRecord | null) ?? null,
  )
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(() => {
    try {
      const saved = sessionStorage.getItem('aerocad_simulated_role')
      return (saved as Role) || null
    } catch {
      return null
    }
  })
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      setRawUser(null)
      setSimulatedRole(null)
      try {
        sessionStorage.removeItem('aerocad_simulated_role')
      } catch {
        /* intentionally ignored */
      }
      clearSensitiveAreaGates()
      setGlobalOcultarValores(true)
      return
    }
    try {
      const fresh = await pb.collection<UserRecord>('users').authRefresh({ requestKey: null })
      setRawUser(fresh.record)
      const isActualAdmin =
        fresh.record.role === 'admin' ||
        (Array.isArray(fresh.record.roles) && fresh.record.roles.includes('admin'))
      // Se o usuário real não for admin, cancelar simulação se houver
      if (!isActualAdmin) {
        setSimulatedRole(null)
        try {
          sessionStorage.removeItem('aerocad_simulated_role')
        } catch {
          /* intentionally ignored */
        }
      }
    } catch {
      pb.authStore.clear()
      setRawUser(null)
      setSimulatedRole(null)
      try {
        sessionStorage.removeItem('aerocad_simulated_role')
      } catch {
        /* intentionally ignored */
      }
      clearSensitiveAreaGates()
      setGlobalOcultarValores(true)
    }
  }, [])

  useEffect(() => {
    void refreshUser().finally(() => setReady(true))
    return pb.authStore.onChange((_, record) => {
      const rec = record as UserRecord | null
      setRawUser(rec)
      if (!rec) {
        clearSensitiveAreaGates()
      }
      const isActualAdmin =
        rec && (rec.role === 'admin' || (Array.isArray(rec.roles) && rec.roles.includes('admin')))
      if (!isActualAdmin) {
        setSimulatedRole(null)
        try {
          sessionStorage.removeItem('aerocad_simulated_role')
        } catch {
          /* intentionally ignored */
        }
      }
    })
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    // Ao efetuar um novo login, limpa imediatamente qualquer portão sensível de sessões anteriores
    clearSensitiveAreaGates()

    const result = await pb
      .collection<UserRecord>('users')
      .authWithPassword(email, password, { requestKey: null })
    try {
      const saved = localStorage.getItem(`aerocad_ocultar_valores_${result.record.id}`)
      if (saved !== null) {
        setGlobalOcultarValores(saved === 'true')
      } else {
        setGlobalOcultarValores(true)
      }
    } catch {
      setGlobalOcultarValores(true)
    }
    setRawUser(result.record)
    return result.record
  }, [])

  const startSimulation = useCallback(
    (role: Role) => {
      const isActualAdmin =
        rawUser?.role === 'admin' ||
        (Array.isArray(rawUser?.roles) && rawUser?.roles.includes('admin'))
      if (!isActualAdmin) return
      setSimulatedRole(role)
      try {
        sessionStorage.setItem('aerocad_simulated_role', role)
      } catch {
        /* intentionally ignored */
      }
    },
    [rawUser],
  )

  const stopSimulation = useCallback(() => {
    setSimulatedRole(null)
    try {
      sessionStorage.removeItem('aerocad_simulated_role')
    } catch {
      /* intentionally ignored */
    }
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    clearSensitiveAreaGates()
    setRawUser(null)
    setSimulatedRole(null)
    try {
      sessionStorage.removeItem('aerocad_simulated_role')
    } catch {
      /* intentionally ignored */
    }
    setGlobalOcultarValores(true)
    navigate('/login', { replace: true })
  }, [navigate])

  const isRealAdmin = Boolean(
    rawUser &&
    (rawUser.role === 'admin' || (Array.isArray(rawUser.roles) && rawUser.roles.includes('admin'))),
  )

  // O usuário efetivo para navegação e renderização
  const user = useMemo(() => {
    if (!rawUser) return null
    if (isRealAdmin && simulatedRole) {
      return {
        ...rawUser,
        role: simulatedRole,
        roles: [simulatedRole],
      }
    }
    return rawUser
  }, [rawUser, simulatedRole, isRealAdmin])

  const isSimulating = Boolean(isRealAdmin && simulatedRole)

  const value = useMemo(
    () => ({
      user,
      rawUser,
      isSimulating,
      simulatedRole,
      startSimulation,
      stopSimulation,
      ready,
      login,
      logout,
      refreshUser,
    }),
    [
      user,
      rawUser,
      isSimulating,
      simulatedRole,
      startSimulation,
      stopSimulation,
      ready,
      login,
      logout,
      refreshUser,
    ],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
