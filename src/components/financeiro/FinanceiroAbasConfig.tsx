import { useState, useEffect, useCallback, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type { FinanceTabKey } from './CentralFinanceiraHub'
import {
  CreditCard,
  Building2,
  Landmark,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  Scale,
  Laptop,
  BarChart3,
  Calculator,
  BookOpen,
  FileText,
  Layers,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface TabDefinition {
  id: FinanceTabKey
  label: string
  shortLabel: string
  icon: LucideIcon
  description: string
  requiresWrite?: boolean
  adminOrFinanceiroOnly?: boolean
  defaultVisible: boolean
}

export const ALL_FINANCE_TABS: readonly TabDefinition[] = [
  {
    id: 'contas_pagar',
    label: 'Contas a Pagar',
    shortLabel: 'Pagar',
    icon: CreditCard,
    description: 'Despesas operacionais, tributos, boletos e comprovantes',
    defaultVisible: true,
  },
  {
    id: 'credores',
    label: 'Credores',
    shortLabel: 'Credores',
    icon: Building2,
    description: 'Cadastro de fornecedores, dados bancários e contratos sociais',
    defaultVisible: true,
  },
  {
    id: 'contas_bancarias',
    label: 'Contas Bancárias',
    shortLabel: 'Contas PJ',
    icon: Landmark,
    description: 'Contas correntes PJ, poupanças e saldos iniciais',
    defaultVisible: true,
  },
  {
    id: 'emprestimos_financiamentos',
    label: 'Empréstimos & Financiamentos',
    shortLabel: 'Empréstimos',
    icon: Landmark,
    description: 'Contratos, apropriação mensal de juros, parcelas e reclassificação contábil',
    requiresWrite: true,
    defaultVisible: true,
  },
  {
    id: 'contas_receber',
    label: 'Contas a Receber',
    shortLabel: 'Receber',
    icon: Receipt,
    description: 'Parcelas contratuais e receitas avulsas',
    defaultVisible: true,
  },
  {
    id: 'fluxo_caixa',
    label: 'Fluxo de Caixa',
    shortLabel: 'Fluxo Caixa',
    icon: TrendingUp,
    description: 'Entradas × saídas, previsto vs realizado',
    defaultVisible: true,
  },
  {
    id: 'extratos',
    label: 'Extratos & Comprovantes',
    shortLabel: 'Extratos',
    icon: FileSpreadsheet,
    description: 'Conciliação bancária (OFX, RET, PDF), OCR e I.A.',
    defaultVisible: true,
  },
  {
    id: 'balancetes',
    label: 'Balancetes Mensais',
    shortLabel: 'Balancetes',
    icon: Scale,
    description: 'Consolidação mensal e histórico arquivado',
    defaultVisible: true,
  },
  {
    id: 'ativos_patrimonio',
    label: 'Ativos & Patrimônio',
    shortLabel: 'Ativos',
    icon: Laptop,
    description: 'Equipamentos topográficos, aeronaves, hardware e depreciação',
    defaultVisible: true,
  },
  {
    id: 'relatorios_avancados',
    label: 'Balancete, Balanço & DRE',
    shortLabel: 'Balancete/DRE',
    icon: BarChart3,
    description: 'Balancete de Verificação, Balanço Patrimonial e DRE contábil',
    defaultVisible: true,
  },
  {
    id: 'valuation',
    label: 'Valuation da AEROCAD',
    shortLabel: 'Valuation',
    icon: Calculator,
    description: 'Avaliação econômica por Patrimônio Líquido, EBITDA e Múltiplos',
    requiresWrite: true,
    defaultVisible: true,
  },
  {
    id: 'plano_contas',
    label: 'Plano de Contas',
    shortLabel: 'Plano Contas',
    icon: BookOpen,
    description: 'Estrutura contábil analítica e plano referencial',
    requiresWrite: true,
    defaultVisible: true,
  },
  {
    id: 'relatorios',
    label: 'Relatórios Gerenciais & Contábeis',
    shortLabel: 'Relatórios',
    icon: FileText,
    description: 'Faturamento, aging, clientes, projetos e impostos',
    defaultVisible: true,
  },
  {
    id: 'parcelas',
    label: 'Parcelas de Projetos',
    shortLabel: 'Parcelas',
    icon: Layers,
    description: 'Visão granular de medições vinculadas aos projetos',
    defaultVisible: true,
  },
  {
    id: 'orfas',
    label: 'Notas Órfãs & NFS-e',
    shortLabel: 'Órfãs',
    icon: Sparkles,
    description: 'NFS-e importadas pendentes de vínculo com parcelas',
    requiresWrite: true,
    defaultVisible: true,
  },
] as const

const STORAGE_PREFIX = 'aerocad_financeiro_abas_visiveis_'

export function getTabStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'anon'}`
}

export function useFinanceiroAbasPersonalizadas(
  userId?: string | null,
  userRole?: string | null,
  activeTab?: FinanceTabKey,
  onTabChange?: (tab: FinanceTabKey) => void,
) {
  const canWrite = userRole === 'admin' || userRole === 'financeiro'

  // Abas que o perfil do usuário pode ver (e restritas se o admin configurou menus_visiveis com prefixo fin_)
  const allowedTabs = useMemo(() => {
    let list = ALL_FINANCE_TABS.filter((tab) => {
      if (tab.requiresWrite && !canWrite) return false
      return true
    })
    // Se o usuário atual possuir restrição explícita de abas financeiras (fin_*) em menus_visiveis:
    const currentUser = pb.authStore.record as any
    const isAdmin =
      currentUser?.role === 'admin' ||
      (Array.isArray(currentUser?.roles) && currentUser?.roles.includes('admin'))
    if (!isAdmin && currentUser?.menus_visiveis && Array.isArray(currentUser.menus_visiveis)) {
      const finRestrictions = currentUser.menus_visiveis.filter((m: string) => m.startsWith('fin_'))
      if (finRestrictions.length > 0) {
        list = list.filter((tab) => finRestrictions.includes(`fin_${tab.id}`))
      }
    }
    return list
  }, [canWrite])

  // Preferência salva de visibilidade (mapa { tabId: boolean })
  const [visibilityMap, setVisibilityMap] = useState<Record<FinanceTabKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem(getTabStorageKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      }
    } catch {
      /* ignore */
    }
    // Padrão: todas visíveis
    const init: Record<string, boolean> = {}
    for (const t of ALL_FINANCE_TABS) {
      init[t.id] = true
    }
    return init as Record<FinanceTabKey, boolean>
  })

  // Recarregar quando trocar de usuário
  useEffect(() => {
    try {
      const raw = localStorage.getItem(getTabStorageKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          setVisibilityMap(parsed)
          return
        }
      }
    } catch {
      /* ignore */
    }
    const init: Record<string, boolean> = {}
    for (const t of ALL_FINANCE_TABS) {
      init[t.id] = true
    }
    setVisibilityMap(init as Record<FinanceTabKey, boolean>)
  }, [userId])

  // Salvar no localStorage
  const saveMap = useCallback(
    (newMap: Record<FinanceTabKey, boolean>) => {
      setVisibilityMap(newMap)
      try {
        localStorage.setItem(getTabStorageKey(userId), JSON.stringify(newMap))
      } catch {
        /* ignore */
      }
    },
    [userId],
  )

  // Lista de abas visíveis filtradas por permissão E personalização
  const visibleTabs = useMemo(() => {
    return allowedTabs.filter((tab) => visibilityMap[tab.id] !== false)
  }, [allowedTabs, visibilityMap])

  // Alternar visibilidade de uma aba individual
  const toggleTab = useCallback(
    (tabId: FinanceTabKey) => {
      const current = visibilityMap[tabId] !== false
      const willBeVisible = !current

      // Não permitir ocultar se for a única visível
      if (!willBeVisible && visibleTabs.length <= 1) {
        return false
      }

      const nextMap = {
        ...visibilityMap,
        [tabId]: willBeVisible,
      }

      // Se a aba sendo ocultada for a atualmente ativa, mover usuário para outra visível
      if (!willBeVisible && activeTab === tabId && onTabChange) {
        const remaining = allowedTabs.filter((t) => t.id !== tabId && nextMap[t.id] !== false)
        if (remaining.length > 0) {
          onTabChange(remaining[0].id)
        }
      }

      saveMap(nextMap)
      return true
    },
    [visibilityMap, visibleTabs.length, activeTab, onTabChange, allowedTabs, saveMap],
  )

  // Restaurar todas as abas para visíveis
  const restoreAll = useCallback(() => {
    const fullMap: Record<string, boolean> = {}
    for (const t of ALL_FINANCE_TABS) {
      fullMap[t.id] = true
    }
    saveMap(fullMap as Record<FinanceTabKey, boolean>)
  }, [saveMap])

  // Ocultar todas exceto a essencial/atual
  const isTabVisible = useCallback(
    (tabId: FinanceTabKey) => {
      return visibilityMap[tabId] !== false
    },
    [visibilityMap],
  )

  return {
    allowedTabs,
    visibleTabs,
    visibilityMap,
    isTabVisible,
    toggleTab,
    restoreAll,
  }
}
