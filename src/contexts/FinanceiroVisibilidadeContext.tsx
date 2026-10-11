import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  setGlobalOcultarValores,
  subscribeFinanceiroVisibilidade,
  VALOR_MASCARADO,
} from '@/lib/format'

interface FinanceiroVisibilidadeContextValue {
  ocultarValores: boolean
  toggleOcultarValores: () => void
  setOcultarValores: (ocultar: boolean) => void
  mascara: string
}

const FinanceiroVisibilidadeContext = createContext<FinanceiroVisibilidadeContextValue | null>(null)

const STORAGE_KEY_PREFIX = 'aerocad_ocultar_valores_'

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'anon'}`
}

function readStoredPreference(userId?: string | null): boolean {
  try {
    const key = getStorageKey(userId)
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      return stored === 'true'
    }
  } catch {
    // Caso localStorage esteja bloqueado/indisponível
  }
  return true // Padrão: valores ocultos
}

function persistPreference(userId: string | null | undefined, ocultar: boolean) {
  try {
    const key = getStorageKey(userId)
    localStorage.setItem(key, String(ocultar))
  } catch {
    // Ignora erros de escrita em localStorage
  }
}

export function FinanceiroVisibilidadeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id

  const [ocultarValores, setOcultarValoresState] = useState<boolean>(() => {
    const initial = readStoredPreference(userId)
    setGlobalOcultarValores(initial)
    return initial
  })

  // Sincroniza imediatamente quando o usuário logado muda ou a sessão é carregada
  useEffect(() => {
    const pref = readStoredPreference(userId)
    setGlobalOcultarValores(pref)
    setOcultarValoresState(pref)
  }, [userId])

  // Escuta mudanças externas (ex: evento global ou outra aba)
  useEffect(() => {
    return subscribeFinanceiroVisibilidade((novo) => {
      setOcultarValoresState(novo)
    })
  }, [])

  const setOcultarValores = useCallback(
    (ocultar: boolean) => {
      setOcultarValoresState(ocultar)
      setGlobalOcultarValores(ocultar)
      persistPreference(userId, ocultar)
    },
    [userId],
  )

  const toggleOcultarValores = useCallback(() => {
    setOcultarValoresState((prev) => {
      const next = !prev
      setGlobalOcultarValores(next)
      persistPreference(userId, next)
      return next
    })
  }, [userId])

  const value = useMemo(
    () => ({
      ocultarValores,
      toggleOcultarValores,
      setOcultarValores,
      mascara: VALOR_MASCARADO,
    }),
    [ocultarValores, toggleOcultarValores, setOcultarValores],
  )

  return (
    <FinanceiroVisibilidadeContext.Provider value={value}>
      {children}
    </FinanceiroVisibilidadeContext.Provider>
  )
}

export function useFinanceiroVisibilidade() {
  const ctx = useContext(FinanceiroVisibilidadeContext)
  if (!ctx) {
    throw new Error(
      'useFinanceiroVisibilidade deve ser usado dentro de FinanceiroVisibilidadeProvider',
    )
  }
  return ctx
}
