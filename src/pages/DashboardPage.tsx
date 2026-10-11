import { useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  FileCheck2,
  FolderKanban,
  TimerReset,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { ErrorState, PageLoading } from '@/components/common/States'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useAlertas } from '@/contexts/AlertasContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import {
  firstName,
  osStatusColors,
  osStatusLabels,
  stageColors,
  stageLabels,
  trailLabels,
} from '@/lib/crm'
import { formatCurrency, formatDate, formatDateLong, initials, relativeTime } from '@/lib/format'
import { AlertasWidget } from '@/components/common/AlertasWidget'
import type {
  AtividadeRecord,
  ExigenciaRecord,
  OportunidadeRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProjetoRecord,
  PropostaRecord,
} from '@/types/crm'

export default function DashboardPage() {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const { alertas, dispensados, reload: reloadAlertas, loading: loadingAlertas } = useAlertas()
  const navigate = useNavigate()
  const opportunities = useCrmData<OportunidadeRecord>('oportunidades', {
    expand: 'cliente,responsavel',
    sort: '-updated',
    realtime: true,
  })
  const requirements = useCrmData<ExigenciaRecord>('exigencias', {
    expand: 'processo,processo.projeto',
    sort: 'prazo',
    realtime: true,
  })
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    expand: 'projeto,cliente',
    sort: 'vencimento',
    realtime: true,
  })
  const projects = useCrmData<ProjetoRecord>('projetos', {
    filter: 'arquivado != true',
    sort: '-created',
    realtime: true,
  })
  const proposals = useCrmData<PropostaRecord>('propostas', {
    sort: '-created',
    realtime: true,
  })
  const activities = useCrmData<AtividadeRecord>('atividades', {
    expand: 'usuario',
    sort: '-created',
    realtime: true,
  })
  const ordensServico = useCrmData<OrdemServicoRecord>('ordens_servico', {
    expand: 'projeto,prestador_usuario',
    sort: '-created',
    realtime: true,
  })
  const loading =
    opportunities.loading ||
    requirements.loading ||
    installments.loading ||
    projects.loading ||
    proposals.loading ||
    ordensServico.loading ||
    activities.loading
  const error = opportunities.error || requirements.error || projects.error

  // Revalidação por foco de janela, visibilidade e intervalo de segurança (30s)
  useEffect(() => {
    const revalidarTudo = () => {
      void opportunities.reload()
      void requirements.reload()
      void installments.reload()
      void projects.reload()
      void proposals.reload()
      void ordensServico.reload()
      void activities.reload()
      reloadAlertas()
    }

    const handleFocus = () => revalidarTudo()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidarTudo()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Intervalo de segurança suave a cada 30 segundos
    const timer = setInterval(revalidarTudo, 30000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(timer)
    }
  }, [
    opportunities,
    requirements,
    installments,
    projects,
    proposals,
    ordensServico,
    activities,
    reloadAlertas,
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7 = new Date(today)
  in7.setDate(in7.getDate() + 7)
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)
  const openOpps = opportunities.data.filter((item) => !['ganho', 'perdido'].includes(item.etapa))
  const openValue = openOpps.reduce((sum, item) => sum + item.valor_estimado, 0)
  const dueRequirements = requirements.data.filter(
    (item) => item.status === 'pendente' && item.prazo && new Date(item.prazo) <= in7,
  ).length
  const thisMonth = installments.data.filter((item) => {
    const date = new Date(item.vencimento)
    return (
      item.status !== 'paga' &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  })
  const monthReceivable = thisMonth.reduce((sum, item) => sum + item.valor, 0)
  const sentProposals = proposals.data.filter((item) => item.status === 'enviada').length
  const maxStage = Math.max(
    1,
    ...Object.keys(stageLabels).map(
      (stage) => opportunities.data.filter((item) => item.etapa === stage).length,
    ),
  )

  // Cálculos de Ordens de Serviço de Terceiros
  const isAdmin = user?.role === 'admin'
  const isInternal = ['admin', 'tecnico', 'comercial'].includes(user?.role || '')

  const osPendentesAceite = ordensServico.data.filter((o) =>
    ['atribuida', 'emitida', 'rascunho'].includes(o.status),
  )
  const osEmExecucao = ordensServico.data.filter((o) => o.status === 'em_execucao')
  const osVencidas = ordensServico.data.filter((o) => {
    if (['concluida', 'cancelada', 'recusada'].includes(o.status)) return false
    if (!o.prazo) return false
    return new Date(o.prazo) < today
  })
  const totalCustoTerceiros = isAdmin
    ? ordensServico.data
        .filter((o) => o.status !== 'cancelada' && o.status !== 'recusada')
        .reduce((sum, o) => sum + (Number(o.valor_interno) || 0), 0)
    : 0

  const upcoming = useMemo(
    () =>
      [
        ...requirements.data
          .filter(
            (item) => item.status === 'pendente' && item.prazo && new Date(item.prazo) <= in30,
          )
          .map((item) => ({
            id: `e-${item.id}`,
            date: item.prazo,
            title: item.descricao,
            code: item.expand?.processo?.numero_protocolo || 'Exigência',
            path: `/processos/${item.processo}`,
            type: 'Exigência',
          })),
        ...installments.data
          .filter(
            (item) =>
              item.status !== 'paga' && item.vencimento && new Date(item.vencimento) <= in30,
          )
          .map((item) => ({
            id: `p-${item.id}`,
            date: item.vencimento,
            title: item.descricao,
            code: item.expand?.projeto?.numero || 'Parcela',
            path: `/financeiro?projeto=${item.projeto}`,
            type: 'Parcela',
          })),
      ]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 8),
    [requirements.data, installments.data, in30],
  )

  const kpis = useMemo(
    () => [
      {
        label: 'Oportunidades abertas',
        value: String(openOpps.length),
        sub: formatCurrency(openValue),
        icon: FolderKanban,
        tone: 'orange',
      },
      {
        label: 'Propostas enviadas',
        value: String(sentProposals),
        sub: 'aguardando retorno',
        icon: FileCheck2,
        tone: 'gray',
      },
      {
        label: 'Exigências em 7 dias',
        value: String(dueRequirements),
        sub: dueRequirements ? 'requerem atenção' : 'sem urgências',
        icon: AlertTriangle,
        tone: dueRequirements ? 'red' : 'green',
      },
      {
        label: 'Receber no mês',
        value: formatCurrency(monthReceivable),
        sub: `${thisMonth.length} parcela(s)`,
        icon: Banknote,
        tone: 'green',
      },
    ],
    [
      openOpps.length,
      openValue,
      sentProposals,
      dueRequirements,
      monthReceivable,
      thisMonth.length,
      ocultarValores,
    ],
  )

  if (loading) return <PageLoading />
  if (error) return <ErrorState onRetry={() => void opportunities.reload()} />

  return (
    <div className="space-y-6">
      <div className="animate-blueprint-rise flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="technical-label">VISÃO GERAL · {formatDate(new Date())}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#424242] sm:text-[28px]">
            Bom dia, {firstName(user?.name)}
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
          onReload={() => {
            reloadAlertas()
            void requirements.reload()
            void proposals.reload()
            void ordensServico.reload()
            void installments.reload()
          }}
          loading={loading || loadingAlertas}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="crm-card animate-blueprint-rise p-5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-bold uppercase tracking-[.08em] text-[#737373]">
                  {kpi.label}
                </p>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.tone === 'orange' ? 'bg-orange-50 text-[#FF6A13]' : kpi.tone === 'red' ? 'bg-red-50 text-red-600' : kpi.tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#F2F2F2] text-[#737373]'}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mono-value mt-4 text-2xl font-bold text-[#424242]">{kpi.value}</p>
              <p className="mt-1 text-xs text-[#8A8A8A]">{kpi.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="crm-card p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="technical-label">COMERCIAL</p>
              <h2 className="text-lg font-bold text-[#4B4B4B]">Funil resumido</h2>
            </div>
            <Link to="/funil" className="flex items-center text-xs font-bold text-[#E85B06]">
              Abrir funil <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-4">
            {Object.entries(stageLabels).map(([stage, label]) => {
              const rows = opportunities.data.filter((item) => item.etapa === stage)
              const total = rows.reduce((sum, item) => sum + item.valor_estimado, 0)
              return (
                <button
                  key={stage}
                  onClick={() => navigate(`/funil?etapa=${stage}`)}
                  className="grid w-full grid-cols-[120px_1fr_90px] items-center gap-3 text-left"
                >
                  <span className="text-xs font-semibold text-[#595959]">{label}</span>
                  <span className="h-7 overflow-hidden rounded bg-[#F2F2F2]">
                    <span
                      className="flex h-full items-center justify-end rounded px-2 text-[10px] font-bold text-white transition-[width] duration-500"
                      style={{
                        width: `${Math.max(rows.length ? 12 : 0, (rows.length / maxStage) * 100)}%`,
                        backgroundColor: stageColors[stage as keyof typeof stageLabels],
                      }}
                    >
                      {rows.length || ''}
                    </span>
                  </span>
                  <span className="mono-value text-right text-xs text-[#737373]">
                    {formatCurrency(total)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <section className="crm-card p-5">
          <p className="technical-label">ENTREGA</p>
          <h2 className="text-lg font-bold text-[#4B4B4B]">Projetos por trilha</h2>
          <div className="mt-5 space-y-5">
            {(['opea', 'registro', 'demais'] as const).map((trail) => {
              const rows = projects.data.filter((item) => item.trilha === trail)
              const active = rows.filter((item) => item.status === 'ativo').length
              return (
                <div key={trail}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 ${trail === 'opea' ? 'bg-[#FF6A13]' : trail === 'registro' ? 'bg-emerald-600' : 'bg-[#737373]'}`}
                      />
                      <span className="text-sm font-semibold">{trailLabels[trail]}</span>
                    </div>
                    <span className="mono-value text-lg font-bold">{rows.length}</span>
                  </div>
                  <Progress
                    value={rows.length ? (active / rows.length) * 100 : 0}
                    className="h-2"
                  />
                  <p className="mt-1 text-[11px] text-[#8A8A8A]">{active} ativo(s)</p>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Seção Exclusiva: Gestão de Ordens de Serviço de Terceiros (Diretoria / Admin / Equipe Técnica) */}
      {isInternal && (
        <section className="crm-card overflow-hidden">
          <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="technical-label flex items-center gap-1.5 text-[#FF6A13]">
                <UserCheck className="h-3.5 w-3.5" />
                PRESTADORES TERCEIRIZADOS
              </p>
              <h2 className="text-lg font-bold text-[#4B4B4B]">Ordens de Serviço em Campo</h2>
            </div>
            {isAdmin && (
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  Valores Confidenciais (Admin)
                </span>
                <p className="font-mono text-sm font-bold text-amber-900 mt-0.5">
                  Total Alocado: {formatCurrency(totalCustoTerceiros)}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 border-b bg-neutral-50/50">
            <div className="p-4 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                Pendentes de Aceite
              </span>
              <p className="font-mono text-2xl font-bold text-blue-900 mt-1">
                {osPendentesAceite.length}
              </p>
              <p className="text-xs text-[#737373] mt-0.5">Aguardando início do prestador</p>
            </div>
            <div className="p-4 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                Em Execução
              </span>
              <p className="font-mono text-2xl font-bold text-amber-900 mt-1">
                {osEmExecucao.length}
              </p>
              <p className="text-xs text-[#737373] mt-0.5">Trabalhos em andamento</p>
            </div>
            <div className="p-4 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                Prazos Vencidos / Alerta
              </span>
              <p className="font-mono text-2xl font-bold text-rose-900 mt-1">{osVencidas.length}</p>
              <p className="text-xs text-[#737373] mt-0.5">Requerem cobrança técnica</p>
            </div>
          </div>

          <div className="divide-y">
            {ordensServico.data.slice(0, 6).map((os) => {
              const statusCfg = osStatusColors[os.status] || {
                bg: 'bg-neutral-100',
                text: 'text-neutral-700',
                border: 'border-neutral-200',
              }
              const prestadorDisplay =
                os.expand?.prestador_usuario?.name || os.prestador || 'Prestador não alocado'
              const isVencida =
                !['concluida', 'cancelada', 'recusada'].includes(os.status) &&
                os.prazo &&
                new Date(os.prazo) < today

              return (
                <div
                  key={os.id}
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-[#FFF6EC]/50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#D65100]">
                        {os.expand?.projeto?.numero || 'AEROCAD OS'}
                      </span>
                      <span className="text-sm font-semibold text-[#333]">
                        {os.titulo || os.descricao.slice(0, 60)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {osStatusLabels[os.status] || os.status}
                      </span>
                      {isVencida && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          Vencida
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-[#666]">
                      Prestador: <strong className="text-[#333]">{prestadorDisplay}</strong>
                      {os.expand?.projeto?.nome && ` · Projeto: ${os.expand.projeto.nome}`}
                      {os.prazo && ` · Prazo: ${formatDate(os.prazo)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {isAdmin && os.valor_interno !== undefined && os.valor_interno !== null && (
                      <div className="text-right">
                        <p className="font-mono text-xs font-bold text-amber-900">
                          {formatCurrency(os.valor_interno)}
                        </p>
                        <p className="text-[10px] text-amber-700 uppercase font-semibold">
                          Custo interno
                        </p>
                      </div>
                    )}
                    {os.projeto && (
                      <Link
                        to={`/projetos/${os.projeto}`}
                        className="text-xs font-semibold text-[#FF6A13] hover:underline"
                      >
                        Ver no projeto →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
            {!ordensServico.data.length && (
              <p className="p-8 text-center text-sm text-[#8A8A8A]">
                Nenhuma ordem de serviço interna de terceiros cadastrada no momento.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="crm-card overflow-hidden xl:col-span-2">
          <div className="border-b px-5 py-4">
            <p className="technical-label">PRÓXIMOS 30 DIAS</p>
            <h2 className="text-lg font-bold text-[#4B4B4B]">Vencimentos e alertas</h2>
          </div>
          {upcoming.length ? (
            <div className="divide-y">
              {upcoming.map((item, index) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className="animate-blueprint-rise flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-[#FFF6EC]"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded border border-[#FFD2B3] bg-orange-50 font-mono text-[#D65100]">
                    <span className="text-[10px] uppercase">
                      {new Date(item.date)
                        .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                        .replace('.', '')}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {new Date(item.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        timeZone: 'UTC',
                      })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#4B4B4B]">{item.title}</p>
                    <p className="mono-value mt-0.5 text-xs text-[#8A8A8A]">{item.code}</p>
                  </div>
                  <CrmBadge tone={item.type === 'Exigência' ? 'amber' : 'green'}>
                    {item.type}
                  </CrmBadge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-[#8A8A8A]">
              Nenhum vencimento nos próximos 30 dias.
            </p>
          )}
        </section>
        <section className="crm-card overflow-hidden">
          <div className="border-b px-5 py-4">
            <p className="technical-label">TIMELINE</p>
            <h2 className="text-lg font-bold text-[#4B4B4B]">Atividade recente</h2>
          </div>
          <div className="divide-y">
            {activities.data.slice(0, 8).map((activity) => (
              <div key={activity.id} className="flex gap-3 px-5 py-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#FFF0E5] text-[10px] font-bold text-[#D65100]">
                    {initials(activity.expand?.usuario?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-[#595959]">{activity.texto}</p>
                  <p className="mt-1 text-[10px] text-[#9A9A9A]">
                    {relativeTime(activity.created)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
