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

import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types/crm'

type AuthContextValue = {
  user: UserRecord | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
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
      return
    }
    try {
      const fresh = await pb.collection<UserRecord>('users').authRefresh({ requestKey: null })
      setUser(fresh.record)
    } catch {
      pb.authStore.clear()
      setUser(null)
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
    setUser(result.record)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
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
