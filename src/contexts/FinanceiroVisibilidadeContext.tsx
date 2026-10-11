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
import { canViewFinancials } from '@/lib/crm'
import {
  setGlobalOcultarValores,
  setGlobalPodeVerValores,
  subscribeFinanceiroVisibilidade,
  VALOR_MASCARADO,
} from '@/lib/format'

export const TOOLTIP_SEM_PERMISSAO = 'Seu perfil não tem acesso aos valores financeiros'

interface FinanceiroVisibilidadeContextValue {
  ocultarValores: boolean
  podeVerValores: boolean
  canViewFinancials: boolean
  toggleOcultarValores: () => void
  setOcultarValores: (ocultar: boolean) => void
  mascara: string
  tooltipBloqueado?: string
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
  const effectiveRole = user?.role

  // Verifica permissão do perfil efetivo (respeita simulação de perfil)
  const podeVerValores = canViewFinancials(effectiveRole)

  // Preferência do toggle do usuário (se tem permissão)
  const [togglePreference, setTogglePreference] = useState<boolean>(() => {
    return readStoredPreference(userId)
  })

  // Sincroniza a permissão e o mascaramento global quando o usuário ou sua role mudam
  useEffect(() => {
    const perm = canViewFinancials(effectiveRole)
    setGlobalPodeVerValores(perm)

    const pref = readStoredPreference(userId)
    setTogglePreference(pref)
    setGlobalOcultarValores(pref)
  }, [userId, effectiveRole])

  // Escuta mudanças externas
  useEffect(() => {
    return subscribeFinanceiroVisibilidade(() => {
      // Re-sincroniza a preferência lida do storage se necessário
      const pref = readStoredPreference(userId)
      setTogglePreference(pref)
    })
  }, [userId])

  // O mascaramento efetivo = falta de permissão OU toggle oculto (preferência do usuário)
  const ocultarValoresEfetivo = !podeVerValores || togglePreference

  const setOcultarValores = useCallback(
    (ocultar: boolean) => {
      if (!podeVerValores) {
        // Perfis sem permissão não alteram o estado nem persistência
        return
      }
      setTogglePreference(ocultar)
      setGlobalOcultarValores(ocultar)
      persistPreference(userId, ocultar)
    },
    [podeVerValores, userId],
  )

  const toggleOcultarValores = useCallback(() => {
    if (!podeVerValores) {
      // Perfis sem permissão têm o toggle inoperante
      return
    }
    setTogglePreference((prev) => {
      const next = !prev
      setGlobalOcultarValores(next)
      persistPreference(userId, next)
      return next
    })
  }, [podeVerValores, userId])

  const value = useMemo(
    () => ({
      ocultarValores: ocultarValoresEfetivo,
      podeVerValores,
      canViewFinancials: podeVerValores,
      toggleOcultarValores,
      setOcultarValores,
      mascara: VALOR_MASCARADO,
      tooltipBloqueado: podeVerValores ? undefined : TOOLTIP_SEM_PERMISSAO,
    }),
    [ocultarValoresEfetivo, podeVerValores, toggleOcultarValores, setOcultarValores],
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
