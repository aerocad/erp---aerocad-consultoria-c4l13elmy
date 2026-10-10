import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Layers,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CrmBadge } from '@/components/common/CrmBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RelatorioSaldoAFaturarCliente } from '@/components/financeiro/RelatorioSaldoAFaturarCliente'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { stageColors, stageLabels, trailLabels, trailPhases } from '@/lib/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { calcularResumoFinanceiroTodosProjetos } from '@/services/projetoFinanceiroInferidor'
import type {
  ClienteRecord,
  ContratoRecord,
  ExigenciaRecord,
  OportunidadeRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
  Trail,
} from '@/types/crm'

// Cores temáticas prancheta técnica AEROCAD
const ORANGE_PRIMARY = '#FF6A13'
const ORANGE_LIGHT = '#FFA066'
const TEAL_ACCENT = '#10B981'
const SLATE_DARK = '#4B4B4B'
const SLATE_LIGHT = '#9A9A9A'
const LOSS_COLORS: Record<string, string> = {
  preco: '#EF4444',
  prazo: '#F59E0B',
  concorrente: '#8B5CF6',
  desistencia_obra: '#6B7280',
  sem_retorno: '#EC4899',
  outro: '#9CA3AF',
}

const LOSS_LABELS: Record<string, string> = {
  preco: 'Preço',
  prazo: 'Prazo',
  concorrente: 'Concorrente',
  desistencia_obra: 'Desistência da obra',
  sem_retorno: 'Sem retorno',
  outro: 'Outro',
}

const ORGAO_LABELS: Record<string, string> = {
  'DECEA-CINDACTA': 'DECEA / CINDACTA',
  COMAER: 'COMAER',
  ANAC: 'ANAC',
}

export default function ReportsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear().toString()

  // Controle de permissão para visualização de valores internos de faturamento/cobrança
  const canViewFinancialDetails = ['admin', 'financeiro'].includes(user?.role || '')

  // Filtros principais
  const [selectedYear, setSelectedYear] = useState<string>(currentYear)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ano') // 'ano', 'q1', 'q2', 'q3', 'q4', 'ultimos_90', 'ultimos_30', 'todos'

  // Carregamento de coleções com useCrmData
  const clientesData = useCrmData<ClienteRecord>('clientes', { sort: 'razao_social' })
  const projetosData = useCrmData<ProjetoRecord>('projetos', {
    expand: 'cliente,oportunidade,contrato',
    sort: '-created',
  })
  const oportunidadesData = useCrmData<OportunidadeRecord>('oportunidades', {
    expand: 'cliente,responsavel',
    sort: '-created',
  })
  const propostasData = useCrmData<PropostaRecord>('propostas', {
    expand: 'oportunidade',
    sort: '-created',
  })
  const contratosData = useCrmData<ContratoRecord>('contratos', {
    expand: 'cliente,proposta',
    sort: '-created',
  })
  const parcelasData = useCrmData<ParcelaRecord>('parcelas', {
    expand: 'projeto,cliente',
    sort: '-vencimento',
  })
  const processosData = useCrmData<ProcessoRecord>('processos', {
    expand: 'projeto',
    sort: '-created',
  })
  const exigenciasData = useCrmData<ExigenciaRecord>('exigencias', {
    expand: 'processo',
    sort: '-created',
  })

  const loading =
    clientesData.loading ||
    projetosData.loading ||
    oportunidadesData.loading ||
    propostasData.loading ||
    contratosData.loading ||
    parcelasData.loading ||
    processosData.loading ||
    exigenciasData.loading

  const reloadAll = () => {
    void clientesData.reload()
    void projetosData.reload()
    void oportunidadesData.reload()
    void propostasData.reload()
    void contratosData.reload()
    void parcelasData.reload()
    void processosData.reload()
    void exigenciasData.reload()
  }

  // Anos disponíveis para seleção (extraídos dinamicamente dos dados + ano atual)
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    years.add(currentYear)
    years.add((Number(currentYear) - 1).toString())

    projetosData.data.forEach((p) => {
      const d = p.data_inicio || p.data_proposta || p.created
      if (d) years.add(new Date(d).getFullYear().toString())
    })
    oportunidadesData.data.forEach((o) => {
      if (o.created) years.add(new Date(o.created).getFullYear().toString())
      if (o.data_fechamento) years.add(new Date(o.data_fechamento).getFullYear().toString())
    })
    parcelasData.data.forEach((pc) => {
      if (pc.vencimento) years.add(new Date(pc.vencimento).getFullYear().toString())
      if (pc.data_pagamento) years.add(new Date(pc.data_pagamento).getFullYear().toString())
    })

    return Array.from(years)
      .filter((y) => !isNaN(Number(y)) && Number(y) >= 2020)
      .sort()
      .reverse()
  }, [projetosData.data, oportunidadesData.data, parcelasData.data, currentYear])

  // Helper de filtragem de data
  const isDateInFilter = (dateStr?: string | null): boolean => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return false

    if (selectedYear !== 'todos' && d.getFullYear().toString() !== selectedYear) {
      return false
    }

    const month = d.getMonth() // 0-11
    if (selectedPeriod === 'q1') return month >= 0 && month <= 2
    if (selectedPeriod === 'q2') return month >= 3 && month <= 5
    if (selectedPeriod === 'q3') return month >= 6 && month <= 8
    if (selectedPeriod === 'q4') return month >= 9 && month <= 11

    if (selectedPeriod === 'ultimos_30') {
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 30
    }
    if (selectedPeriod === 'ultimos_90') {
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 90
    }

    return true
  }

  // ==========================================
  // 1. VISÃO GERAL
  // ==========================================
  const visaoGeral = useMemo(() => {
    // Pipeline de oportunidades ativas (não fechadas) ou no período
    const filteredOpps = oportunidadesData.data.filter((opp) => {
      const d = opp.created || opp.updated
      return isDateInFilter(d)
    })

    const pipelinePorEtapa = [
      'lead',
      'qualificacao',
      'proposta_enviada',
      'negociacao',
      'ganho',
      'perdido',
    ].map((etapaKey) => {
      const items = filteredOpps.filter((o) => o.etapa === etapaKey)
      const totalValor = items.reduce((acc, curr) => acc + (Number(curr.valor_estimado) || 0), 0)
      return {
        etapaKey,
        label: stageLabels[etapaKey as keyof typeof stageLabels] || etapaKey,
        count: items.length,
        valor: totalValor,
        color: stageColors[etapaKey as keyof typeof stageLabels] || '#737373',
      }
    })

    // Valor contratado no ano/período
    // Soma de contratos no ano + projetos com valor_global > 0 + parcelas faturadas/recebidas
    const contratosPeriodo = contratosData.data.filter((c) =>
      isDateInFilter(c.data_assinatura || c.created),
    )
    const valorContratos = contratosPeriodo.reduce(
      (acc, curr) => acc + (Number(curr.valor_global) || 0),
      0,
    )

    const projetosPeriodo = projetosData.data.filter((p) =>
      isDateInFilter(p.data_inicio || p.data_aceite || p.created),
    )
    const valorProjetosGlobal = projetosPeriodo.reduce(
      (acc, curr) => acc + (Number(curr.valor_global) || 0),
      0,
    )

    // Também consideramos oportunidades ganhas no período se valor contratado direto for zero
    const oppsGanhasPeriodo = oportunidadesData.data.filter(
      (o) => o.etapa === 'ganho' && isDateInFilter(o.data_fechamento || o.created),
    )
    const valorOppsGanhas = oppsGanhasPeriodo.reduce(
      (acc, curr) => acc + (Number(curr.valor_estimado) || 0),
      0,
    )

    // Parcelas geradas no período
    const parcelasPeriodo = parcelasData.data.filter((p) =>
      isDateInFilter(p.vencimento || p.data_faturamento || p.created),
    )
    const valorParcelasTotal = parcelasPeriodo.reduce(
      (acc, curr) => acc + (Number(curr.valor) || 0),
      0,
    )

    // Valor contratado consolidado: usa maior valor entre contratos, projetos, parcelas ou opps ganhas
    const valorContratado = Math.max(
      valorContratos,
      valorProjetosGlobal,
      valorParcelasTotal,
      valorOppsGanhas,
      0,
    )

    // Ticket médio por família de serviço (OPEA / Registro / Demais)
    // Agrupamos projetos e oportunidades ganhas por trilha
    const familias: Record<Trail, { count: number; totalValor: number }> = {
      opea: { count: 0, totalValor: 0 },
      registro: { count: 0, totalValor: 0 },
      demais: { count: 0, totalValor: 0 },
    }

    // A partir de projetos
    projetosPeriodo.forEach((p) => {
      const trilha = (p.trilha || 'demais') as Trail
      if (familias[trilha]) {
        familias[trilha].count += 1
        // Se projeto tem valor_global usa, senão procura se tem parcela ou oportunidade ligada
        let val = Number(p.valor_global) || 0
        if (val === 0 && p.oportunidade) {
          const opp = oportunidadesData.data.find((o) => o.id === p.oportunidade)
          if (opp) val = Number(opp.valor_estimado) || 0
        }
        if (val === 0) {
          const parc = parcelasData.data.filter((pc) => pc.projeto === p.id)
          val = parc.reduce((s, pc) => s + (Number(pc.valor) || 0), 0)
        }
        familias[trilha].totalValor += val
      }
    })

    // Se projetosPeriodo não tiver valor, complementa com oportunidades do período
    filteredOpps.forEach((o) => {
      const trilha = (o.trilha_prevista || 'demais') as Trail
      if (familias[trilha] && familias[trilha].totalValor === 0) {
        familias[trilha].totalValor += Number(o.valor_estimado) || 0
        if (familias[trilha].count === 0) familias[trilha].count += 1
      }
    })

    const ticketMedio = {
      opea: familias.opea.count > 0 ? familias.opea.totalValor / familias.opea.count : 0,
      registro:
        familias.registro.count > 0 ? familias.registro.totalValor / familias.registro.count : 0,
      demais: familias.demais.count > 0 ? familias.demais.totalValor / familias.demais.count : 0,
    }

    // Nº de projetos por trilha e por fase
    const projetosPorTrilha = (['opea', 'registro', 'demais'] as const).map((trilha) => {
      const itens = projetosPeriodo.filter((p) => (p.trilha || 'demais') === trilha)
      const ativos = itens.filter((p) => p.status === 'ativo').length
      const concluidos = itens.filter((p) => p.status === 'concluido').length
      return {
        trilha,
        label: trailLabels[trilha],
        total: itens.length,
        ativos,
        concluidos,
      }
    })

    // Fases dos projetos
    const fasesMap = new Map<string, number>()
    projetosPeriodo.forEach((p) => {
      const faseNome = p.fase || 'Fase inicial'
      fasesMap.set(faseNome, (fasesMap.get(faseNome) || 0) + 1)
    })
    const projetosPorFase = Array.from(fasesMap.entries())
      .map(([fase, total]) => ({ fase, total }))
      .sort((a, b) => b.total - a.total)

    return {
      pipelinePorEtapa,
      totalPipeline: pipelinePorEtapa
        .filter((e) => !['ganho', 'perdido'].includes(e.etapaKey))
        .reduce((acc, curr) => acc + curr.valor, 0),
      valorContratado,
      ticketMedio,
      projetosPorTrilha,
      projetosPorFase,
      totalProjetos: projetosPeriodo.length,
    }
  }, [
    oportunidadesData.data,
    projetosData.data,
    contratosData.data,
    parcelasData.data,
    selectedYear,
    selectedPeriod,
  ])

  // ==========================================
  // 2. CONVERSÃO COMERCIAL
  // ==========================================
  const conversao = useMemo(() => {
    const opps = oportunidadesData.data.filter((opp) => {
      const d = opp.created || opp.updated
      return isDateInFilter(d)
    })

    const totalOpps = opps.length
    const ganhas = opps.filter((o) => o.etapa === 'ganho')
    const perdidas = opps.filter((o) => o.etapa === 'perdido')
    const fechadasTotal = ganhas.length + perdidas.length

    const taxaGanho = fechadasTotal > 0 ? (ganhas.length / fechadasTotal) * 100 : 0
    const taxaPerda = fechadasTotal > 0 ? (perdidas.length / fechadasTotal) * 100 : 0

    // Funil de conversão por etapa (contagem e taxa acumulada/passagem)
    // Ordem do funil: Lead -> Qualificação -> Proposta enviada -> Negociação -> Fechado (ganho)
    const etapasFunil = ['lead', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho']
    const contagemPorEtapa = etapasFunil.map((etapa) => {
      const count = opps.filter((o) => o.etapa === etapa).length
      return {
        etapa,
        label: stageLabels[etapa as keyof typeof stageLabels] || etapa,
        count,
        color: stageColors[etapa as keyof typeof stageLabels] || '#FF6A13',
      }
    })

    // Motivos de perda
    const motivosContagem: Record<string, number> = {}
    perdidas.forEach((o) => {
      const motivo = o.motivo_perda || 'outro'
      motivosContagem[motivo] = (motivosContagem[motivo] || 0) + 1
    })

    const motivosPerdaGrafico = Object.entries(motivosContagem).map(([motivo, count]) => ({
      motivo,
      label: LOSS_LABELS[motivo] || motivo,
      count,
      percent: perdidas.length > 0 ? (count / perdidas.length) * 100 : 0,
      color: LOSS_COLORS[motivo] || '#9CA3AF',
    }))

    // Tempo médio de fechamento (criação da oportunidade -> data_fechamento ou data_aceite)
    let diasTotais = 0
    let oppsComTempo = 0

    ganhas.forEach((o) => {
      if (o.data_fechamento && o.created) {
        const criacao = new Date(o.created).getTime()
        const fechamento = new Date(o.data_fechamento).getTime()
        const dias = Math.max(0, Math.round((fechamento - criacao) / (1000 * 60 * 60 * 24)))
        if (!isNaN(dias)) {
          diasTotais += dias
          oppsComTempo += 1
        }
      }
    })

    // Complementar com projetos que têm data_proposta e data_aceite
    projetosData.data.forEach((p) => {
      if (p.data_proposta && p.data_aceite && isDateInFilter(p.data_aceite)) {
        const prop = new Date(p.data_proposta).getTime()
        const aceite = new Date(p.data_aceite).getTime()
        const dias = Math.max(0, Math.round((aceite - prop) / (1000 * 60 * 60 * 24)))
        if (!isNaN(dias)) {
          diasTotais += dias
          oppsComTempo += 1
        }
      }
    })

    const tempoMedioDias = oppsComTempo > 0 ? Math.round(diasTotais / oppsComTempo) : 0

    return {
      totalOpps,
      ganhasCount: ganhas.length,
      perdidasCount: perdidas.length,
      taxaGanho,
      taxaPerda,
      contagemPorEtapa,
      motivosPerdaGrafico,
      tempoMedioDias,
      fechadasTotal,
    }
  }, [oportunidadesData.data, projetosData.data, selectedYear, selectedPeriod])

  // ==========================================
  // 3. OPERAÇÃO REGULATÓRIA
  // ==========================================
  const operacaoRegulatoria = useMemo(() => {
    // Processos do período
    const processos = processosData.data.filter((pr) => {
      const d = pr.data_protocolo || pr.created
      return isDateInFilter(d)
    })

    // Tempo médio sob controle AEROCAD vs Tempo nos órgãos (Prazo do órgão)
    // Por órgão / CINDACTA: média entre data_protocolo e data_parecer nos processos com parecer/concluídos
    const porOrgao: Record<
      string,
      { totalDiasOrgao: number; concluidosCount: number; todosCount: number }
    > = {
      'DECEA-CINDACTA': { totalDiasOrgao: 0, concluidosCount: 0, todosCount: 0 },
      COMAER: { totalDiasOrgao: 0, concluidosCount: 0, todosCount: 0 },
      ANAC: { totalDiasOrgao: 0, concluidosCount: 0, todosCount: 0 },
    }

    processos.forEach((pr) => {
      const org = pr.orgao || 'DECEA-CINDACTA'
      if (!porOrgao[org]) {
        porOrgao[org] = { totalDiasOrgao: 0, concluidosCount: 0, todosCount: 0 }
      }
      porOrgao[org].todosCount += 1

      if (pr.data_protocolo && pr.data_parecer) {
        const proto = new Date(pr.data_protocolo).getTime()
        const pare = new Date(pr.data_parecer).getTime()
        const diff = Math.max(0, Math.round((pare - proto) / (1000 * 60 * 60 * 24)))
        if (!isNaN(diff)) {
          porOrgao[org].totalDiasOrgao += diff
          porOrgao[org].concluidosCount += 1
        }
      }
    })

    // Tempo sob controle AEROCAD: tempo do início do projeto até o protocolo do processo
    let tempoAerocadTotal = 0
    let processosComTempoAerocad = 0

    processos.forEach((pr) => {
      const proj = projetosData.data.find((p) => p.id === pr.projeto)
      if (proj && proj.data_inicio && pr.data_protocolo) {
        const inicio = new Date(proj.data_inicio).getTime()
        const proto = new Date(pr.data_protocolo).getTime()
        const diff = Math.max(0, Math.round((proto - inicio) / (1000 * 60 * 60 * 24)))
        if (!isNaN(diff)) {
          tempoAerocadTotal += diff
          processosComTempoAerocad += 1
        }
      }
    })

    const tempoMedioAerocadDias =
      processosComTempoAerocad > 0 ? Math.round(tempoAerocadTotal / processosComTempoAerocad) : 21 // valor padrão operacional estimado caso sem protocolo

    const tempoOrgaosComparativo = Object.entries(porOrgao).map(([orgaoKey, stats]) => {
      const mediaDias =
        stats.concluidosCount > 0 ? Math.round(stats.totalDiasOrgao / stats.concluidosCount) : 0
      return {
        orgaoKey,
        label: ORGAO_LABELS[orgaoKey] || orgaoKey,
        totalProcessos: stats.todosCount,
        processosConcluidos: stats.concluidosCount,
        prazoOrgaoDias: mediaDias,
      }
    })

    // Média de exigências por processo
    const totalExigencias = exigenciasData.data.length
    const totalProcessosGerais = processosData.data.length
    const mediaExigenciasPorProcesso =
      totalProcessosGerais > 0 ? (totalExigencias / totalProcessosGerais).toFixed(1) : '0.0'

    // % de pareceres favoráveis
    const pareceresStats = {
      favoravel: 0,
      favoravel_com_restricoes: 0,
      desfavoravel: 0,
      pendente: 0,
    }

    processos.forEach((pr) => {
      const statusParecer = pr.parecer || 'pendente'
      if (statusParecer in pareceresStats) {
        pareceresStats[statusParecer as keyof typeof pareceresStats] += 1
      }
    })

    const pareceresEmitidos =
      pareceresStats.favoravel +
      pareceresStats.favoravel_com_restricoes +
      pareceresStats.desfavoravel
    const percentFavoravelTotal =
      pareceresEmitidos > 0
        ? (
            ((pareceresStats.favoravel + pareceresStats.favoravel_com_restricoes) /
              pareceresEmitidos) *
            100
          ).toFixed(0)
        : '100'

    // Projetos sem movimentação há 15+ dias
    const agora = Date.now()
    const projetosSemMovimentacao = projetosData.data
      .filter((p) => p.status === 'ativo')
      .map((p) => {
        const d = p.updated || p.created
        const dataUltima = d ? new Date(d).getTime() : agora
        const diasSemMov = Math.max(0, Math.round((agora - dataUltima) / (1000 * 60 * 60 * 24)))
        return {
          ...p,
          diasSemMov,
        }
      })
      .filter((p) => p.diasSemMov >= 15)
      .sort((a, b) => b.diasSemMov - a.diasSemMov)

    return {
      tempoMedioAerocadDias,
      tempoOrgaosComparativo,
      mediaExigenciasPorProcesso,
      pareceresStats,
      pareceresEmitidos,
      percentFavoravelTotal,
      projetosSemMovimentacao,
      totalProcessos: processos.length,
    }
  }, [processosData.data, projetosData.data, exigenciasData.data, selectedYear, selectedPeriod])

  // ==========================================
  // 4. FINANCEIRO
  // ==========================================
  const financeiro = useMemo(() => {
    const parcelas = parcelasData.data.filter((p) => {
      const d = p.vencimento || p.data_faturamento || p.created
      return isDateInFilter(d)
    })

    let faturado = 0
    let aReceber = 0
    let vencido = 0

    // Por mês do ano selecionável (Jan-Dez)
    const mesesNomes = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const evolucaoMes = mesesNomes.map((mes, idx) => ({
      mes,
      mesNum: idx,
      faturado: 0,
      aReceber: 0,
      vencido: 0,
    }))

    const hoje = new Date()

    parcelas.forEach((p) => {
      const valor = Number(p.valor) || 0
      const valorRecebido = Number(p.valor_recebido) || valor
      const dVenc = p.vencimento ? new Date(p.vencimento) : null
      const mesIdx = dVenc ? dVenc.getMonth() : -1

      // Notas importadas com status pago ou com data de pagamento/recebimento contam como recebimento efetivo
      const foiRecebido =
        p.status === 'paga' ||
        Boolean(p.data_pagamento) ||
        (p.status_pagamento && p.status_pagamento.toLowerCase().includes('recebid'))

      if (foiRecebido) {
        faturado += valorRecebido
        if (mesIdx >= 0 && mesIdx <= 11) {
          evolucaoMes[mesIdx].faturado += valorRecebido
        }
      } else if (p.status === 'vencida' || (dVenc && dVenc < hoje)) {
        vencido += valor
        if (mesIdx >= 0 && mesIdx <= 11) {
          evolucaoMes[mesIdx].vencido += valor
        }
      } else {
        aReceber += valor
        if (mesIdx >= 0 && mesIdx <= 11) {
          evolucaoMes[mesIdx].aReceber += valor
        }
      }
    })

    const totalGeral = faturado + aReceber + vencido

    // Inferência de projetos: faturados 100%, pagamento parcial e sem NFS-e
    const resumosProjetos = calcularResumoFinanceiroTodosProjetos(
      projetosData.data,
      parcelasData.data,
    )
    let projetosFaturamentoIntegral = 0
    let projetosPagamentoParcial = 0
    let projetosSemNfse = 0
    let totalFaturadoNfseProjetos = 0
    let totalSaldoAFaturarProjetos = 0

    resumosProjetos.forEach((res) => {
      totalFaturadoNfseProjetos += res.totalFaturadoNfse
      totalSaldoAFaturarProjetos += res.saldoAFaturar
      if (res.statusFinanceiro === 'faturamento_integral') {
        projetosFaturamentoIntegral++
      } else if (res.statusFinanceiro === 'pagamento_parcial') {
        projetosPagamentoParcial++
      } else {
        projetosSemNfse++
      }
    })

    // Receita por cliente com concentração
    const receitaClienteMap = new Map<
      string,
      { id: string; razao: string; totalFaturado: number; totalAberto: number }
    >()

    parcelas.forEach((p) => {
      const cid = p.cliente || p.expand?.cliente?.id || 'desconhecido'
      const razao = p.expand?.cliente?.razao_social || 'Cliente não identificado'
      const val = Number(p.valor) || 0

      if (!receitaClienteMap.has(cid)) {
        receitaClienteMap.set(cid, {
          id: cid,
          razao,
          totalFaturado: 0,
          totalAberto: 0,
        })
      }
      const entry = receitaClienteMap.get(cid)!
      const itemRecebido =
        p.status === 'paga' ||
        Boolean(p.data_pagamento) ||
        (p.status_pagamento && p.status_pagamento.toLowerCase().includes('recebid'))

      if (itemRecebido) {
        entry.totalFaturado += Number(p.valor_recebido) || val
      } else {
        entry.totalAberto += val
      }
    })

    const rankingClientes = Array.from(receitaClienteMap.values())
      .map((c) => {
        const total = c.totalFaturado + c.totalAberto
        return {
          ...c,
          total,
          percentual: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
        }
      })
      .sort((a, b) => b.total - a.total)

    const top3 = rankingClientes.slice(0, 3)
    const concentracaoTop3 = top3.reduce((acc, curr) => acc + curr.percentual, 0)

    return {
      faturado,
      aReceber,
      vencido,
      totalGeral,
      evolucaoMes,
      rankingClientes,
      top3,
      concentracaoTop3,
      projetosFaturamentoIntegral,
      projetosPagamentoParcial,
      projetosSemNfse,
      totalFaturadoNfseProjetos,
      totalSaldoAFaturarProjetos,
    }
  }, [parcelasData.data, projetosData.data, selectedYear, selectedPeriod])

  // ==========================================
  // 5. PÓS-VENDA & GESTÃO CONTÍNUA
  // ==========================================
  const posVenda = useMemo(() => {
    const hojeMs = Date.now()
    const noventaDiasMs = 90 * 24 * 60 * 60 * 1000

    // Clientes recorrentes sem novo projeto/proposta há mais de 90 dias
    const clientesRecorrentes = clientesData.data.filter((c) => c.recorrente)

    const recorrentesSemMovimentacao = clientesRecorrentes
      .map((c) => {
        // Encontrar projetos do cliente
        const projs = projetosData.data.filter((p) => p.cliente === c.id)
        // Encontrar oportunidades do cliente
        const opps = oportunidadesData.data.filter((o) => o.cliente === c.id)

        // Datas de última movimentação
        const datas: number[] = []
        projs.forEach((p) => {
          if (p.data_inicio) datas.push(new Date(p.data_inicio).getTime())
          if (p.created) datas.push(new Date(p.created).getTime())
        })
        opps.forEach((o) => {
          if (o.created) datas.push(new Date(o.created).getTime())
          if (o.updated) datas.push(new Date(o.updated).getTime())
        })

        const ultimaAtividadeMs =
          datas.length > 0 ? Math.max(...datas) : new Date(c.created).getTime()
        const diasSemMov = Math.max(
          0,
          Math.round((hojeMs - ultimaAtividadeMs) / (1000 * 60 * 60 * 24)),
        )

        return {
          cliente: c,
          ultimaAtividade: new Date(ultimaAtividadeMs).toISOString(),
          diasSemMov,
          totalProjetos: projs.length,
        }
      })
      .filter((item) => item.diasSemMov >= 90)
      .sort((a, b) => b.diasSemMov - a.diasSemMov)

    // Oportunidades perdidas há 90+ dias para reativação
    const oportunidadesParaReativar = oportunidadesData.data
      .filter((o) => o.etapa === 'perdido')
      .map((o) => {
        const d = o.data_fechamento || o.updated || o.created
        const dataPerda = d ? new Date(d).getTime() : hojeMs
        const diasPerdida = Math.max(0, Math.round((hojeMs - dataPerda) / (1000 * 60 * 60 * 24)))
        return {
          oportunidade: o,
          diasPerdida,
          motivo: o.motivo_perda || 'Não informado',
        }
      })
      .filter((item) => item.diasPerdida >= 90)
      .sort((a, b) => b.diasPerdida - a.diasPerdida)

    // Contratos de Gestão (GEST-155 / RBAC 155 / PBZH / Gestão contínua) ativos
    // Buscamos em contratos ou projetos com escopo/tipo de gestão ou heliponto
    const contratosGestao = contratosData.data.filter((c) => {
      const num = (c.numero || '').toLowerCase()
      const desc = (c.po_cliente || '').toLowerCase()
      return num.includes('gest') || desc.includes('gest') || desc.includes('155')
    })

    const projetosGestao = projetosData.data.filter((p) => {
      const nome = (p.nome || '').toLowerCase()
      const escopo = (p.escopo_resumido || '').toLowerCase()
      const tipo = (p.tipo_servico || '').toLowerCase()
      return (
        nome.includes('gest') ||
        nome.includes('155') ||
        escopo.includes('gest') ||
        escopo.includes('155') ||
        tipo.includes('gest')
      )
    })

    return {
      recorrentesSemMovimentacao,
      oportunidadesParaReativar,
      totalContratosGestao: contratosGestao.length + projetosGestao.length,
      contratosGestao,
      projetosGestao,
    }
  }, [clientesData.data, projetosData.data, oportunidadesData.data, contratosData.data])

  return (
    <div className="space-y-6">
      {/* Header técnico com Seletor de Período e Ano */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#DEDEDE] pb-5 md:flex-row md:items-end">
        <div>
          <SectionHeader
            eyebrow="INTELIGÊNCIA & PERFORMANCE"
            title="Relatórios & Indicadores"
            description="KPIs estratégicos de conversão comercial, prazos de órgãos regulatórios, financeiro e pós-venda."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 rounded-lg border border-[#DEDEDE] bg-white px-3 py-1.5 shadow-xs">
            <Calendar className="h-4 w-4 text-[#FF6A13]" />
            <span className="text-xs font-semibold text-[#737373]">Ano:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-[100px] border-none bg-transparent px-2 text-xs font-bold text-[#4B4B4B] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Período */}
          <div className="flex items-center gap-1.5 rounded-lg border border-[#DEDEDE] bg-white px-3 py-1.5 shadow-xs">
            <Filter className="h-4 w-4 text-[#FF6A13]" />
            <span className="text-xs font-semibold text-[#737373]">Período:</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-7 w-[140px] border-none bg-transparent px-2 text-xs font-bold text-[#4B4B4B] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ano">Ano completo</SelectItem>
                <SelectItem value="q1">1º Trimestre (Q1)</SelectItem>
                <SelectItem value="q2">2º Trimestre (Q2)</SelectItem>
                <SelectItem value="q3">3º Trimestre (Q3)</SelectItem>
                <SelectItem value="q4">4º Trimestre (Q4)</SelectItem>
                <SelectItem value="ultimos_30">Últimos 30 dias</SelectItem>
                <SelectItem value="ultimos_90">Últimos 90 dias</SelectItem>
                <SelectItem value="todos">Todo histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={reloadAll}
            className="h-9 border-[#DEDEDE] text-[#555] hover:border-[#FF6A13] hover:text-[#FF6A13]"
            title="Recarregar indicadores"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Abas Temáticas de Indicadores */}
      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1 border border-[#DEDEDE] rounded-xl">
          <TabsTrigger
            value="geral"
            className="data-[state=active]:bg-[#FF6A13] data-[state=active]:text-white font-semibold text-xs py-2.5 px-4"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            1. Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="conversao"
            className="data-[state=active]:bg-[#FF6A13] data-[state=active]:text-white font-semibold text-xs py-2.5 px-4"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            2. Conversão Comercial
          </TabsTrigger>
          <TabsTrigger
            value="regulatorio"
            className="data-[state=active]:bg-[#FF6A13] data-[state=active]:text-white font-semibold text-xs py-2.5 px-4"
          >
            <Workflow className="mr-2 h-4 w-4" />
            3. Operação Regulatória
          </TabsTrigger>
          <TabsTrigger
            value="financeiro"
            className="data-[state=active]:bg-[#FF6A13] data-[state=active]:text-white font-semibold text-xs py-2.5 px-4"
          >
            <PieChartIcon className="mr-2 h-4 w-4" />
            4. Financeiro & Concentração
          </TabsTrigger>
          <TabsTrigger
            value="posvenda"
            className="data-[state=active]:bg-[#FF6A13] data-[state=active]:text-white font-semibold text-xs py-2.5 px-4"
          >
            <UsersRound className="mr-2 h-4 w-4" />
            5. Pós-Venda & Reativação
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* ABA 1: VISÃO GERAL */}
        {/* ========================================================= */}
        <TabsContent value="geral" className="space-y-6">
          {/* Cartões de Alto Nível */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="crm-card p-5">
              <p className="technical-label">VALOR EM PIPELINE</p>
              {loading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <p className="mono-value mt-2 text-2xl font-bold text-[#FF6A13]">
                  {formatCurrency(visaoGeral.totalPipeline)}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A8A8A]">Negócios abertos no período</p>
              <Link
                to="/funil"
                className="mt-3 inline-flex items-center text-xs font-bold text-[#FF6A13] hover:underline"
              >
                Abrir funil comercial <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">CONTRATADO NO PERÍODO</p>
              {loading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <p className="mono-value mt-2 text-2xl font-bold text-[#248A57]">
                  {formatCurrency(visaoGeral.valorContratado)}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A8A8A]">
                Ano {selectedYear} · contratos e projetos fechados
              </p>
              <Link
                to="/financeiro"
                className="mt-3 inline-flex items-center text-xs font-bold text-[#248A57] hover:underline"
              >
                Ver parcelas e recebimentos <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">PROJETOS ATIVOS</p>
              {loading ? (
                <Skeleton className="h-8 w-16 mt-2" />
              ) : (
                <p className="mono-value mt-2 text-2xl font-bold text-[#4B4B4B]">
                  {visaoGeral.totalProjetos}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A8A8A]">Nas três trilhas técnicas</p>
              <Link
                to="/projetos"
                className="mt-3 inline-flex items-center text-xs font-bold text-[#4B4B4B] hover:underline"
              >
                Listar todos os projetos <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">TICKET MÉDIO GERAL</p>
              {loading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <p className="mono-value mt-2 text-2xl font-bold text-[#4B4B4B]">
                  {formatCurrency(
                    (visaoGeral.ticketMedio.opea +
                      visaoGeral.ticketMedio.registro +
                      visaoGeral.ticketMedio.demais) /
                      (visaoGeral.ticketMedio.opea > 0
                        ? 1
                        : 0 +
                            (visaoGeral.ticketMedio.registro > 0 ? 1 : 0) +
                            (visaoGeral.ticketMedio.demais > 0 ? 1 : 0) || 1),
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A8A8A]">Consolidado da carteira</p>
            </div>
          </div>

          {/* Gráfico: Pipeline por Etapa */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="crm-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">PIPELINE POR ETAPA</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">
                    Volume Financeiro por Estágio do Funil
                  </h3>
                </div>
                <CrmBadge tone="orange">{selectedYear}</CrmBadge>
              </div>

              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-56 w-full" />
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={visaoGeral.pipelinePorEtapa}
                      margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#737373', fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: '#737373', fontSize: 11 }}
                        tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), 'Valor Total']}
                        labelFormatter={(label) => `Etapa: ${label}`}
                        contentStyle={{
                          backgroundColor: '#FFF',
                          border: '1px solid #DEDEDE',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                        {visaoGeral.pipelinePorEtapa.map((entry) => (
                          <Cell key={entry.etapaKey} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Ticket Médio por Família de Serviço */}
            <div className="crm-card p-5 flex flex-col justify-between">
              <div>
                <p className="technical-label">FAMÍLIAS DE SERVIÇO</p>
                <h3 className="text-base font-bold text-[#4B4B4B]">Ticket Médio</h3>
                <p className="mt-1 text-xs text-[#8A8A8A]">
                  Comparativo de ticket por linha técnica contratada
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-lg border border-[#FFD2B3] bg-[#FFF6EC] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-[#D65100]">OPEA</span>
                      <CrmBadge tone="orange">SYSAGA / COMAER</CrmBadge>
                    </div>
                    <p className="mono-value mt-2 text-xl font-bold text-[#4B4B4B]">
                      {formatCurrency(visaoGeral.ticketMedio.opea)}
                    </p>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Processos de implantação e obstáculos
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-emerald-800">REGISTRO</span>
                      <CrmBadge tone="green">ANAC / RBAC</CrmBadge>
                    </div>
                    <p className="mono-value mt-2 text-xl font-bold text-[#4B4B4B]">
                      {formatCurrency(visaoGeral.ticketMedio.registro)}
                    </p>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Aeródromos privados e helipontos
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-zinc-700">DEMAIS</span>
                      <CrmBadge tone="gray">Consultoria / EVAs</CrmBadge>
                    </div>
                    <p className="mono-value mt-2 text-xl font-bold text-[#4B4B4B]">
                      {formatCurrency(visaoGeral.ticketMedio.demais)}
                    </p>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Estudos de viabilidade e laudos
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t text-[11px] text-[#8A8A8A]">
                Baseado em projetos e propostas aceitas no período filtrado.
              </div>
            </div>
          </div>

          {/* Distribuição de Projetos por Trilha e por Fase */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">CARTEIRA TÉCNICA</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">Projetos por Trilha</h3>
                </div>
                <Link to="/projetos" className="text-xs font-bold text-[#FF6A13] hover:underline">
                  Ver projetos →
                </Link>
              </div>

              <div className="space-y-4">
                {visaoGeral.projetosPorTrilha.map((item) => (
                  <div key={item.trilha} className="rounded-lg border p-3 hover:bg-[#FFF6EC]/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              item.trilha === 'opea'
                                ? ORANGE_PRIMARY
                                : item.trilha === 'registro'
                                  ? '#10B981'
                                  : '#6B7280',
                          }}
                        />
                        <span className="text-sm font-bold text-[#4B4B4B]">{item.label}</span>
                      </div>
                      <span className="mono-value text-base font-bold">
                        {item.total} projeto(s)
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#737373]">
                      <span>
                        Ativos em execução: <strong>{item.ativos}</strong>
                      </span>
                      <span className="text-right">
                        Concluídos: <strong>{item.concluidos}</strong>
                      </span>
                    </div>

                    <Progress
                      value={item.total > 0 ? (item.ativos / item.total) * 100 : 0}
                      className="mt-2.5 h-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">ESTÁGIOS DE ENTREGA</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">Nº de Projetos por Fase</h3>
                </div>
                <CrmBadge tone="gray">{visaoGeral.totalProjetos} projetos</CrmBadge>
              </div>

              {visaoGeral.projetosPorFase.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#8A8A8A]">
                  Nenhum projeto registrado neste período.
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {visaoGeral.projetosPorFase.map((item) => (
                    <div
                      key={item.fase}
                      className="flex items-center justify-between rounded-lg border border-[#F0F0F0] p-2.5 text-xs hover:border-[#FFD2B3]"
                    >
                      <span className="font-semibold text-[#4B4B4B] truncate max-w-[240px]">
                        {item.fase}
                      </span>
                      <span className="mono-value font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded">
                        {item.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 2: CONVERSÃO COMERCIAL */}
        {/* ========================================================= */}
        <TabsContent value="conversao" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="crm-card p-5">
              <p className="technical-label">TAXA DE GANHO (WIN RATE)</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#248A57]">
                {conversao.taxaGanho.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">
                {conversao.ganhasCount} ganhas de {conversao.fechadasTotal} decididas
              </p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">TAXA DE PERDA</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#C83E36]">
                {conversao.taxaPerda.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">
                {conversao.perdidasCount} oportunidades recusadas
              </p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">CICLO MÉDIO DE FECHAMENTO</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#FF6A13]">
                {conversao.tempoMedioDias}{' '}
                <span className="text-base font-normal text-[#737373]">dias</span>
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Criação → Aceite formal</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">TOTAL EM TRÂMITE</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#4B4B4B]">
                {conversao.totalOpps}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Oportunidades no funil</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Funil de Conversão em Barras Horizontais */}
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">PROGRESSÃO COMERCIAL</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">
                    Funil de Conversão por Etapa
                  </h3>
                </div>
                <Link to="/funil" className="text-xs font-bold text-[#FF6A13] hover:underline">
                  Abrir Kanban →
                </Link>
              </div>

              <div className="space-y-4 pt-2">
                {conversao.contagemPorEtapa.map((item, idx) => {
                  const maxContagem = Math.max(1, ...conversao.contagemPorEtapa.map((e) => e.count))
                  const pct = (item.count / maxContagem) * 100
                  return (
                    <div key={item.etapa} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#4B4B4B]">
                          {idx + 1}. {item.label}
                        </span>
                        <span className="mono-value font-bold text-[#333]">
                          {item.count} oportunidade(s)
                        </span>
                      </div>
                      <div className="h-6 w-full rounded bg-[#F2F2F2] overflow-hidden flex">
                        <div
                          className="h-full flex items-center px-2 text-[10px] font-bold text-white transition-all duration-500"
                          style={{
                            width: `${Math.max(10, pct)}%`,
                            backgroundColor: item.color,
                          }}
                        >
                          {pct >= 20 ? `${pct.toFixed(0)}%` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 rounded-lg border border-[#FFD2B3] bg-[#FFF6EC] p-3 text-xs text-[#6A4A34]">
                <strong>Gargalo comercial:</strong> monitore a transição entre{' '}
                <em>Proposta enviada</em> e <em>Negociação</em> para evitar estagnação no ciclo de
                vendas.
              </div>
            </div>

            {/* Motivos de Perda (Pizza / Barras) */}
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">ANÁLISE DE CHURN COMERCIAL</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">Motivos de Perda</h3>
                </div>
                <CrmBadge tone="red">{conversao.perdidasCount} perdas</CrmBadge>
              </div>

              {conversao.motivosPerdaGrafico.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8A8A8A]">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  Nenhuma oportunidade perdida registrada no período selecionado.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={conversao.motivosPerdaGrafico}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {conversao.motivosPerdaGrafico.map((entry) => (
                            <Cell key={entry.motivo} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [`${val} oportunidade(s)`, 'Volume']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="divide-y text-xs">
                    {conversao.motivosPerdaGrafico.map((item) => (
                      <div key={item.motivo} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-[#4B4B4B]">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="mono-value font-bold text-[#333]">{item.count}</span>
                          <span className="mono-value text-[11px] text-[#737373] w-12 text-right">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 3: OPERAÇÃO REGULATÓRIA */}
        {/* ========================================================= */}
        <TabsContent value="regulatorio" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="crm-card p-5">
              <p className="technical-label">TEMPO CONTROLE AEROCAD</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#FF6A13]">
                {operacaoRegulatoria.tempoMedioAerocadDias}{' '}
                <span className="text-base font-normal text-[#737373]">dias</span>
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Kick-off até Protocolo SYSAGA/Órgão</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">EXIGÊNCIAS POR PROCESSO</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#4B4B4B]">
                {operacaoRegulatoria.mediaExigenciasPorProcesso}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Média histórica por processo</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">PARECERES FAVORÁVEIS</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#248A57]">
                {operacaoRegulatoria.percentFavoravelTotal}%
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Favoráveis ou com restrições</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">SEM MOVIMENTAÇÃO (15+ DIAS)</p>
              <p
                className={`mono-value mt-2 text-3xl font-black ${
                  operacaoRegulatoria.projetosSemMovimentacao.length > 0
                    ? 'text-red-600'
                    : 'text-[#4B4B4B]'
                }`}
              >
                {operacaoRegulatoria.projetosSemMovimentacao.length}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Requerem atenção operacional</p>
            </div>
          </div>

          {/* Comparativo de Prazo: AEROCAD × Órgão (DECEA / CINDACTA / COMAER / ANAC) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">TEMPO NOS ÓRGÃOS REGULATÓRIOS</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">Prazo Médio por Órgão</h3>
                </div>
                <CrmBadge tone="orange">Prazo do órgão</CrmBadge>
              </div>

              <p className="text-xs text-[#737373] mb-4">
                Média de dias corridos entre o <strong>Protocolo</strong> e a emissão do{' '}
                <strong>Parecer Conclusivo</strong> nos processos concluídos.
              </p>

              <div className="space-y-4">
                {operacaoRegulatoria.tempoOrgaosComparativo.map((item) => (
                  <div key={item.orgaoKey} className="rounded-lg border p-4 bg-white shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#4B4B4B]">{item.label}</span>
                      <span className="mono-value text-lg font-black text-[#FF6A13]">
                        {item.prazoOrgaoDias > 0 ? `${item.prazoOrgaoDias} dias` : 'Em tramitação'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-[#8A8A8A]">
                      <span>{item.totalProcessos} processo(s) protocolado(s)</span>
                      <span>{item.processosConcluidos} parecer(es) emitido(s)</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-[#F2F2F2] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#FF6A13] h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (item.prazoOrgaoDias / 120) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[#737373] font-mono">Meta ICA: ≤ 90d</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-[#737373]">
                <span>Controle Interno AEROCAD:</span>
                <span className="font-bold text-[#4B4B4B]">
                  {operacaoRegulatoria.tempoMedioAerocadDias} dias até protocolo
                </span>
              </div>
            </div>

            {/* Projetos Sem Movimentação há 15+ dias */}
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">ALERTA OPERACIONAL</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">
                    Projetos Sem Movimentação (15+ dias)
                  </h3>
                </div>
                <CrmBadge tone="red">
                  {operacaoRegulatoria.projetosSemMovimentacao.length} projeto(s)
                </CrmBadge>
              </div>

              {operacaoRegulatoria.projetosSemMovimentacao.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8A8A8A]">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  Todos os projetos ativos foram atualizados recentemente.
                </div>
              ) : (
                <div className="divide-y max-h-[360px] overflow-y-auto pr-1">
                  {operacaoRegulatoria.projetosSemMovimentacao.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 hover:bg-[#FFF6EC]/40 px-2 rounded-lg transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/projetos/${p.id}`}
                            className="mono-value font-bold text-xs text-[#D65100] hover:underline"
                          >
                            {p.numero}
                          </Link>
                          <span className="text-sm font-semibold text-[#333] truncate">
                            {p.nome}
                          </span>
                        </div>
                        <p className="text-xs text-[#737373] mt-0.5">
                          Fase atual: {p.fase || 'Não informada'} · Trilha: {trailLabels[p.trilha]}
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          {p.diasSemMov} dias parado
                        </span>
                        <Link
                          to={`/projetos/${p.id}`}
                          className="block text-[11px] text-[#FF6A13] font-semibold hover:underline mt-1"
                        >
                          Acessar ficha →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 4: FINANCEIRO & CONCENTRAÇÃO */}
        {/* ========================================================= */}
        <TabsContent value="financeiro" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="crm-card p-5">
              <p className="technical-label">TOTAL FATURADO / RECEBIDO</p>
              <p className="mono-value mt-2 text-2xl font-bold text-[#248A57]">
                {formatCurrency(financeiro.faturado)}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Parcelas quitadas no período</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">A RECEBER (EM ABERTO)</p>
              <p className="mono-value mt-2 text-2xl font-bold text-sky-600">
                {formatCurrency(financeiro.aReceber)}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Parcelas a vencer</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">INADIMPLÊNCIA / VENCIDO</p>
              <p className="mono-value mt-2 text-2xl font-bold text-red-600">
                {formatCurrency(financeiro.vencido)}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Requerem cobrança ativa</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">CONCENTRAÇÃO TOP 3 CLIENTES</p>
              <p className="mono-value mt-2 text-2xl font-bold text-[#FF6A13]">
                {financeiro.concentracaoTop3.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Da receita total da carteira</p>
            </div>
          </div>

          {/* Painel de Faturamento de Projetos por NFS-e (Inferência) */}
          <div className="crm-card p-5 bg-gradient-to-br from-white to-[#FFF9F5] border-[#FFD2B3]">
            <div className="mb-4 flex flex-wrap items-center justify-between border-b border-[#FFD2B3]/60 pb-3 gap-2">
              <div>
                <p className="technical-label">STATUS DE FATURAMENTO DOS PROJETOS (NFS-E)</p>
                <h3 className="text-base font-bold text-[#4B4B4B]">
                  Confronto de Projetos Contratados × Faturados em Notas
                </h3>
              </div>
              <Link to="/projetos" className="text-xs font-bold text-[#FF6A13] hover:underline">
                Ver todos os projetos →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div className="rounded-lg bg-white p-3 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                  100% Faturados (Integral)
                </span>
                <span className="mono-value font-black text-2xl text-emerald-700">
                  {financeiro.projetosFaturamentoIntegral}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Projetos quitados em notas
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-orange-200">
                <span className="text-[10px] text-[#D65100] font-bold uppercase block">
                  Pagamento Parcial
                </span>
                <span className="mono-value font-black text-2xl text-[#FF6A13]">
                  {financeiro.projetosPagamentoParcial}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Com faturamento em andamento
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-neutral-200">
                <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                  Sem NFS-e Vinculada
                </span>
                <span className="mono-value font-black text-2xl text-neutral-700">
                  {financeiro.projetosSemNfse}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Aguardando emissão
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-neutral-200">
                <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                  Total Faturado em NFS-e
                </span>
                <span className="mono-value font-bold text-lg text-emerald-700">
                  {formatCurrency(financeiro.totalFaturadoNfseProjetos)}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Soma nominal das notas
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-neutral-200">
                <span className="text-[10px] text-neutral-600 font-bold uppercase block">
                  Saldo a Faturar
                </span>
                <span className="mono-value font-bold text-lg text-[#FF6A13]">
                  {formatCurrency(financeiro.totalSaldoAFaturarProjetos)}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Contratado restante
                </span>
              </div>
            </div>
          </div>

          {/* Relatório Analítico: Saldo a Faturar por Cliente para Cobrança Ativa (Restrito Admin / Financeiro) */}
          {canViewFinancialDetails && (
            <RelatorioSaldoAFaturarCliente
              clientes={clientesData.data}
              projetos={projetosData.data}
              parcelas={parcelasData.data}
            />
          )}

          {/* Gráfico de Barras por Mês do Ano Selecionável */}
          <div className="crm-card p-5">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <p className="technical-label">FLUXO FINANCEIRO MENSAL</p>
                <h3 className="text-base font-bold text-[#4B4B4B]">
                  Faturado × A Receber × Vencido ({selectedYear})
                </h3>
              </div>
              <Link to="/financeiro" className="text-xs font-bold text-[#FF6A13] hover:underline">
                Abrir Financeiro Completo →
              </Link>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={financeiro.evolucaoMes}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis dataKey="mes" tick={{ fill: '#737373', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: '#737373', fontSize: 11 }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val)]}
                    contentStyle={{
                      backgroundColor: '#FFF',
                      border: '1px solid #DEDEDE',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="faturado"
                    name="Faturado / Recebido"
                    fill="#248A57"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="aReceber" name="A Receber" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="vencido" name="Vencido" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Concentração de Receita por Cliente (Top 3 e ranking) */}
          <div className="crm-card p-5">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <p className="technical-label">DISTRIBUIÇÃO DE CARTEIRA</p>
                <h3 className="text-base font-bold text-[#4B4B4B]">
                  Concentração de Receita por Cliente
                </h3>
              </div>
              <CrmBadge tone="orange">
                Top 3: {financeiro.concentracaoTop3.toFixed(1)}% do total
              </CrmBadge>
            </div>

            {/* Barra de Concentração Gráfica */}
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-[#737373]">
                <span>Top 3 Clientes Estratégicos</span>
                <span>
                  Restante da Carteira ({Math.max(0, 100 - financeiro.concentracaoTop3).toFixed(1)}
                  %)
                </span>
              </div>
              <div className="h-4 w-full rounded-full bg-zinc-100 overflow-hidden flex">
                <div
                  className="bg-[#FF6A13] h-full"
                  style={{ width: `${Math.min(100, financeiro.concentracaoTop3)}%` }}
                  title={`Top 3 Clientes: ${financeiro.concentracaoTop3.toFixed(1)}%`}
                />
                <div
                  className="bg-zinc-300 h-full"
                  style={{ width: `${Math.max(0, 100 - financeiro.concentracaoTop3)}%` }}
                  title="Demais clientes"
                />
              </div>
            </div>

            {/* Lista dos Top Clientes */}
            <div className="divide-y text-xs">
              {financeiro.rankingClientes.slice(0, 5).map((cli, idx) => (
                <div
                  key={cli.id}
                  className="flex items-center justify-between py-3 hover:bg-[#FFF6EC]/30 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F2F2F2] font-mono text-xs font-bold text-[#4B4B4B]">
                      {idx + 1}
                    </span>
                    <div>
                      <Link
                        to={`/clientes/${cli.id}`}
                        className="font-bold text-sm text-[#4B4B4B] hover:text-[#FF6A13] hover:underline"
                      >
                        {cli.razao}
                      </Link>
                      <p className="text-[#8A8A8A] text-[11px]">
                        Recebido: {formatCurrency(cli.totalFaturado)} · A receber:{' '}
                        {formatCurrency(cli.totalAberto)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="mono-value font-bold text-sm text-[#333]">
                      {formatCurrency(cli.total)}
                    </p>
                    <span className="mono-value font-bold text-[#FF6A13] text-[11px]">
                      {cli.percentual.toFixed(1)}% do total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA 5: PÓS-VENDA & GESTÃO CONTÍNUA */}
        {/* ========================================================= */}
        <TabsContent value="posvenda" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="crm-card p-5">
              <p className="technical-label">RECORRENTES INATIVOS (90+ DIAS)</p>
              <p className="mono-value mt-2 text-3xl font-black text-amber-600">
                {posVenda.recorrentesSemMovimentacao.length}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Clientes sem novos projetos/propostas</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">OPORTUNIDADES PARA REATIVAÇÃO</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#FF6A13]">
                {posVenda.oportunidadesParaReativar.length}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Perdidas há 90+ dias</p>
            </div>

            <div className="crm-card p-5">
              <p className="technical-label">CONTRATOS DE GESTÃO (GEST-155)</p>
              <p className="mono-value mt-2 text-3xl font-black text-[#248A57]">
                {posVenda.totalContratosGestao}
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A]">Gestão contínua / Helipontos</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Clientes Recorrentes sem novo projeto há 90+ dias */}
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">RELACIONAMENTO & RETENÇÃO</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">
                    Clientes Recorrentes sem Contrato Ativo
                  </h3>
                </div>
                <CrmBadge tone="amber">
                  {posVenda.recorrentesSemMovimentacao.length} acionáveis
                </CrmBadge>
              </div>

              {posVenda.recorrentesSemMovimentacao.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8A8A8A]">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  Todos os clientes recorrentes possuem projetos ou propostas recentes.
                </div>
              ) : (
                <div className="divide-y max-h-[380px] overflow-y-auto pr-1">
                  {posVenda.recorrentesSemMovimentacao.map((item) => (
                    <div
                      key={item.cliente.id}
                      className="flex items-center justify-between py-3 hover:bg-[#FFF6EC]/30 px-2 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/clientes/${item.cliente.id}`}
                          className="font-bold text-sm text-[#4B4B4B] hover:text-[#FF6A13] hover:underline block truncate"
                        >
                          {item.cliente.razao_social}
                        </Link>
                        <p className="text-xs text-[#737373] mt-0.5">
                          Segmento: {item.cliente.segmento || 'Geral'} · Histórico:{' '}
                          {item.totalProjetos} projeto(s)
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          {item.diasSemMov} dias sem contato
                        </span>
                        <Link
                          to={`/clientes/${item.cliente.id}`}
                          className="block text-[11px] text-[#FF6A13] font-semibold hover:underline mt-1"
                        >
                          Ver ficha 360º →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Oportunidades Perdidas há 90+ dias marcadas para Reativação */}
            <div className="crm-card p-5">
              <div className="mb-4 flex items-center justify-between border-b pb-3">
                <div>
                  <p className="technical-label">PIPELINE DE RETOMADA</p>
                  <h3 className="text-base font-bold text-[#4B4B4B]">
                    Oportunidades para Reativação (90+ dias)
                  </h3>
                </div>
                <Link to="/funil" className="text-xs font-bold text-[#FF6A13] hover:underline">
                  Abrir Funil →
                </Link>
              </div>

              {posVenda.oportunidadesParaReativar.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8A8A8A]">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  Nenhuma oportunidade perdida há mais de 90 dias pendente de reativação.
                </div>
              ) : (
                <div className="divide-y max-h-[380px] overflow-y-auto pr-1">
                  {posVenda.oportunidadesParaReativar.map((item) => (
                    <div
                      key={item.oportunidade.id}
                      className="flex items-center justify-between py-3 hover:bg-[#FFF6EC]/30 px-2 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-[#4B4B4B] block truncate">
                          {item.oportunidade.titulo}
                        </span>
                        <p className="text-xs text-[#737373] mt-0.5">
                          Motivo perda: <strong>{LOSS_LABELS[item.motivo] || item.motivo}</strong> ·
                          Estimado: {formatCurrency(item.oportunidade.valor_estimado)}
                        </p>
                      </div>

                      <div className="text-right pl-3">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700">
                          {item.diasPerdida} dias atrás
                        </span>
                        <Link
                          to={`/funil?etapa=perdido`}
                          className="block text-[11px] text-[#FF6A13] font-semibold hover:underline mt-1"
                        >
                          Reabrir negociação →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
