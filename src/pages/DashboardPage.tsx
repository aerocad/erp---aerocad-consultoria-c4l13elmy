import { memo, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { useAlertas } from '@/contexts/AlertasContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { isUserAdmin, userHasAnyRole } from '@/lib/crm'
import { formatDateBrasilia, formatDateLong } from '@/lib/format'
import { montarSaudacao } from '@/lib/saudacao'
import { AlertasWidget } from '@/components/common/AlertasWidget'

import { KpiCardsSection } from '@/components/dashboard/KpiCardsSection'
import { FunilResumidoCard } from '@/components/dashboard/FunilResumidoCard'
import { ProjetosTrilhaCard } from '@/components/dashboard/ProjetosTrilhaCard'
import { OrdensServicoSection } from '@/components/dashboard/OrdensServicoSection'
import { UpcomingSection } from '@/components/dashboard/UpcomingSection'
import { TimelineSection } from '@/components/dashboard/TimelineSection'

import type {
  AtividadeRecord,
  ExigenciaRecord,
  OportunidadeRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProjetoRecord,
} from '@/types/crm'

// Carregamento sob demanda do assistente de IA para liberar a thread principal no primeiro render
const AssistenteSecaoDrawer = lazy(() =>
  import('@/components/chat/AssistenteSecaoDrawer').then((mod) => ({
    default: mod.AssistenteSecaoDrawer,
  })),
)

const SUGESTOES_PAINEL = [
  'Qual o resumo geral dos KPIs e oportunidades abertas hoje?',
  'Quantas exigências regulatórias estão vencendo nos próximos 7 dias?',
  'Quais parcelas financeiras têm vencimento previsto para este mês?',
  'Quantos projetos ativos temos por trilha (OPEA vs Registro)?',
]

// TTL em cache da API do dashboard: 30 segundos
const DASHBOARD_CACHE_TTL_MS = 30_000

export default function DashboardPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const { alertas, dispensados, reload: reloadAlertas, loading: loadingAlertas } = useAlertas()

  // Controla se montamos as seções secundárias de forma preguiçosa para acelerar o first-paint
  const [secondaryReady, setSecondaryReady] = useState(false)
  useEffect(() => {
    // Permite que a tela inicial pinte os KPIs e o topo antes de disparar atividades/ordens/assistente
    const timer = setTimeout(() => {
      setSecondaryReady(true)
    }, 40)
    return () => clearTimeout(timer)
  }, [])

  // 1. Coleções Essenciais (KPIs, Funil, Projetos, Exigências)
  const opportunities = useCrmData<OportunidadeRecord>('oportunidades', {
    expand: 'cliente,responsavel',
    sort: '-updated',
    realtime: true,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })
  const requirements = useCrmData<ExigenciaRecord>('exigencias', {
    expand: 'processo,processo.projeto',
    sort: 'prazo',
    realtime: true,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    expand: 'projeto,cliente',
    sort: 'vencimento',
    realtime: true,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })
  const projects = useCrmData<ProjetoRecord>('projetos', {
    filter: 'arquivado != true',
    sort: '-created',
    realtime: true,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })

  // 2. Coleções Secundárias / Lazy (Atividades recentes e Ordens de serviço)
  const isInternal = userHasAnyRole(user, ['admin', 'tecnico', 'comercial'])
  const isAdmin = isUserAdmin(user)

  const activities = useCrmData<AtividadeRecord>('atividades', {
    expand: 'usuario',
    sort: '-created',
    realtime: true,
    enabled: secondaryReady,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })
  const ordensServico = useCrmData<OrdemServicoRecord>('ordens_servico', {
    expand: 'projeto,prestador_usuario',
    sort: '-created',
    realtime: true,
    enabled: secondaryReady && isInternal,
    ttlMs: DASHBOARD_CACHE_TTL_MS,
  })

  // Render progressivo: se qualquer coleção essencial responder, renderiza a tela
  const hasAnyEssentialData =
    opportunities.data.length > 0 ||
    requirements.data.length > 0 ||
    projects.data.length > 0 ||
    installments.data.length > 0

  const loadingEssential =
    opportunities.loading && requirements.loading && projects.loading && !hasAnyEssentialData

  const error =
    !hasAnyEssentialData && (opportunities.error || requirements.error || projects.error)

  // Recarga inteligente manual
  const handleReloadAll = () => {
    void opportunities.reload()
    void requirements.reload()
    void installments.reload()
    void projects.reload()
    if (secondaryReady) {
      void ordensServico.reload()
      void activities.reload()
    }
    reloadAlertas()
  }

  // Polling espaçado e foco com throttle de 30s
  useEffect(() => {
    let lastRevalidation = Date.now()
    const MIN_INTERVAL_MS = 30_000

    const throttledRevalidar = () => {
      const now = Date.now()
      if (now - lastRevalidation < MIN_INTERVAL_MS) return
      lastRevalidation = now
      handleReloadAll()
    }

    const handleFocus = () => throttledRevalidar()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        throttledRevalidar()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const timer = setInterval(() => {
      throttledRevalidar()
    }, 120_000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(timer)
    }
  }, [
    opportunities.reload,
    requirements.reload,
    installments.reload,
    projects.reload,
    ordensServico.reload,
    activities.reload,
    reloadAlertas,
    secondaryReady,
  ])

  // Cálculos de prazos e métricas memoizados
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const in7 = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d
  }, [today])

  const in30 = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 30)
    return d
  }, [today])

  // KPIs calculados
  const { openCount, openValue, sentCount, sentValue } = useMemo(() => {
    let openC = 0
    let openV = 0
    let sentC = 0
    let sentV = 0

    for (const opp of opportunities.data) {
      if (!['ganho', 'perdido'].includes(opp.etapa)) {
        openC += 1
        openV += opp.valor_estimado || 0
      }
      if (opp.etapa === 'proposta_enviada') {
        sentC += 1
        sentV += opp.valor_estimado || 0
      }
    }
    return { openCount: openC, openValue: openV, sentCount: sentC, sentValue: sentV }
  }, [opportunities.data])

  const dueRequirements = useMemo(() => {
    return requirements.data.filter(
      (item) => item.status === 'pendente' && item.prazo && new Date(item.prazo) <= in7,
    ).length
  }, [requirements.data, in7])

  const { monthReceivable, monthCount } = useMemo(() => {
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    let sum = 0
    let count = 0

    for (const item of installments.data) {
      if (item.status === 'paga' || !item.vencimento) continue
      const date = new Date(item.vencimento)
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        sum += item.valor || 0
        count += 1
      }
    }
    return { monthReceivable: sum, monthCount: count }
  }, [installments.data, today])

  // Lista dos próximos 30 dias consolidada
  const upcoming = useMemo(() => {
    const list = []

    for (const item of requirements.data) {
      if (item.status === 'pendente' && item.prazo && new Date(item.prazo) <= in30) {
        list.push({
          id: `e-${item.id}`,
          date: item.prazo,
          title: item.descricao,
          code: item.expand?.processo?.numero_protocolo || 'Exigência',
          path: `/processos/${item.processo}`,
          type: 'Exigência',
        })
      }
    }

    for (const item of installments.data) {
      if (item.status !== 'paga' && item.vencimento && new Date(item.vencimento) <= in30) {
        list.push({
          id: `p-${item.id}`,
          date: item.vencimento,
          title: item.descricao,
          code: item.expand?.projeto?.numero || 'Parcela',
          path: `/financeiro?projeto=${item.projeto}`,
          type: 'Parcela',
        })
      }
    }

    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return list.slice(0, 8)
  }, [requirements.data, installments.data, in30])

  if (loadingEssential) return <PageLoading />
  if (error) return <ErrorState onRetry={handleReloadAll} />

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel */}
      <div className="animate-blueprint-rise flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="technical-label">VISÃO GERAL · {formatDateBrasilia()}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#424242] sm:text-[28px]">
            {montarSaudacao(user?.name)}
          </h1>
          <p className="mt-1 text-sm capitalize text-[#737373]">{formatDateLong()}</p>
        </div>
        <CrmBadge tone="orange">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#FF6A13]" />
          Operação sincronizada
        </CrmBadge>
      </div>

      {/* Seção Alertas por Prazo */}
      {user?.role !== 'terceiro' && (
        <AlertasWidget
          alertas={alertas}
          dispensados={dispensados}
          onReload={handleReloadAll}
          loading={loadingAlertas}
        />
      )}

      {/* Grid de 4 KPIs com suporte a loading por seção */}
      <KpiCardsSection
        openCount={openCount}
        openValue={openValue}
        sentCount={sentCount}
        sentValue={sentValue}
        dueRequirements={dueRequirements}
        monthReceivable={monthReceivable}
        monthCount={monthCount}
        loading={opportunities.loading && !opportunities.data.length}
      />

      {/* Grid Comercial & Entrega */}
      <div className="grid gap-6 xl:grid-cols-3">
        <FunilResumidoCard
          opportunities={opportunities.data}
          loading={opportunities.loading && !opportunities.data.length}
        />
        <ProjetosTrilhaCard
          projects={projects.data}
          loading={projects.loading && !projects.data.length}
        />
      </div>

      {/* Seção Exclusiva: Gestão de Ordens de Serviço de Terceiros */}
      {isInternal && (
        <OrdensServicoSection
          ordensServico={ordensServico.data}
          isAdmin={isAdmin}
          loading={ordensServico.loading && !ordensServico.data.length}
        />
      )}

      {/* Grid Vencimentos Próximos & Atividade Recente */}
      <div className="grid gap-6 xl:grid-cols-3">
        <UpcomingSection
          items={upcoming}
          loading={(requirements.loading || installments.loading) && !upcoming.length}
        />
        <TimelineSection
          activities={activities.data}
          loading={activities.loading && !activities.data.length}
        />
      </div>

      {/* Assistente de IA Nativo da Seção Painel (Lazy Suspense) */}
      {secondaryReady && (
        <Suspense fallback={null}>
          <AssistenteSecaoDrawer
            agentSlug="assistente-painel"
            titulo="Assistente do Painel"
            subtitulo="Visão geral executiva, KPIs e prazos em tempo real"
            secaoNome="Painel Executivo"
            areaPermissao="painel"
            sugestoes={SUGESTOES_PAINEL}
            placeholder="Pergunte sobre KPIs, exigências, oportunidades ou projetos..."
            descricaoModo="consulta indicadores, prazos e contagens consolidadas do CRM em tempo real."
            floatingButtonLabel="Assistente do Painel"
          />
        </Suspense>
      )}
    </div>
  )
}
