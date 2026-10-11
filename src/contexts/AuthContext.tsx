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

type AuthContextValue = {
  user: UserRecord | null
  ready: boolean
  login: (email: string, password: string) => Promise<UserRecord>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserRecord | null>(
    () => (pb.authStore.record as UserRecord | null) ?? null,
  )
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      setUser(null)
      setGlobalOcultarValores(true)
      return
    }
    try {
      const fresh = await pb.collection<UserRecord>('users').authRefresh({ requestKey: null })
      setUser(fresh.record)
    } catch {
      pb.authStore.clear()
      setUser(null)
      setGlobalOcultarValores(true)
    }
  }, [])

  useEffect(() => {
    void refreshUser().finally(() => setReady(true))
    return pb.authStore.onChange((_, record) => setUser(record as UserRecord | null))
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
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
    setUser(result.record)
    return result.record
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
    setGlobalOcultarValores(true)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser }),
    [user, ready, login, logout, refreshUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
