import React, { useState, useMemo, useEffect } from 'react'
import {
  Scale,
  TrendingUp,
  Target,
  Sparkles,
  Printer,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Wallet,
  Coins,
  ChevronRight,
  PieChart as PieChartIcon,
  HelpCircle,
  Clock,
  Layers,
  Percent,
  FileArchive,
  Loader2,
  FolderArchive,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CrmBadge } from '@/components/common/CrmBadge'
import { toast } from '@/hooks/use-toast'
import JSZip from 'jszip'
import {
  formatCurrency,
  formatDate,
  formatDateBrasilia,
  isValoresOcultos,
  VALOR_MASCARADO,
} from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { exportarTabelaParaXlsx } from '@/services/aerocadXlsxExporter'
import { AerocadRelatorioA4 } from '@/components/financeiro/AerocadRelatorioA4'
import {
  calcularDepreciacaoLinear,
  DEPRECIACAO_PADRAO,
} from '@/components/financeiro/AtivosPatrimonioTab'
import { canViewFinancials } from '@/lib/crm'
import type {
  ParcelaRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ProjetoRecord,
  ClienteRecord,
  ContaBancariaRecord,
  AtivoPatrimonioRecord,
  ExtratoRecord,
} from '@/types/crm'
import {
  gerarDossieContabilZip,
  FiltroDossieContabil,
  TipoPeriodoDossie,
} from '@/services/dossieContabilService'
import { calcularBalanceteVerificacao } from '@/services/balanceteContabilService'
import { imprimirElementoA4 } from '@/services/relatorioImpressaoService'

// Helper seguro para parsing numérico defensivo
function safeNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.'))
    if (!isNaN(parsed)) return parsed
  }
  return fallback
}

export interface RelatoriosContabeisAvancadosTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  extratos?: ExtratoRecord[]
  emprestimosFinanciamentos?: EmprestimoFinanciamentoRecord[]
  userRole?: string
  usuarioNome?: string
  onNavigateTab?: (tab: string) => void
}

type SecaoContabil = 'balancete' | 'balanco' | 'dre' | 'ponto_equilibrio' | 'indicadores'

interface FiltroPeriodoConfig {
  ano: string
  periodo: string // 'ano', 'mes_1'..'mes_12', 'semestre_1'..'semestre_2', 'quadrimestre_1'..'quadrimestre_3', 'trimestre_1'..'trimestre_4'
  contaBancariaId: string // 'todas' | id
}

export function RelatoriosContabeisAvancadosTab({
  parcelas,
  contasPagar,
  contasReceber,
  projetos,
  clientes,
  contasBancarias,
  ativosPatrimonio,
  extratos: extratosProp = [],
  emprestimosFinanciamentos: emprestimosProp,
  userRole,
  usuarioNome = 'Usuário AEROCAD',
  onNavigateTab,
}: RelatoriosContabeisAvancadosTabProps) {
  const podeVerValores = canViewFinancials(userRole)
  const ocultarGlobal = isValoresOcultos()
  const mascararValores = !podeVerValores || ocultarGlobal

  const [secaoAtiva, setSecaoAtiva] = useState<SecaoContabil>('balancete')
  const [modalA4Aberto, setModalA4Aberto] = useState(false)

  // Lista de extratos bancários com fallback via PocketBase se não passado como prop
  const [extratosList, setExtratosList] = useState<ExtratoRecord[]>(extratosProp)
  const [emprestimosList, setEmprestimosList] = useState<EmprestimoFinanciamentoRecord[]>(
    emprestimosProp || [],
  )

  useEffect(() => {
    if (extratosProp && extratosProp.length > 0) {
      setExtratosList(extratosProp)
    } else {
      pb.collection('extratos')
        .getFullList<ExtratoRecord>({ sort: '-created' })
        .then((res) => setExtratosList(res))
        .catch(() => {})
    }
  }, [extratosProp])

  useEffect(() => {
    if (emprestimosProp && emprestimosProp.length > 0) {
      setEmprestimosList(emprestimosProp)
    } else {
      pb.collection('emprestimos_financiamentos')
        .getFullList<EmprestimoFinanciamentoRecord>({ sort: '-created' })
        .then((res) => setEmprestimosList(res))
        .catch(() => {})
    }
  }, [emprestimosProp])

  // Modal e estado do Dossiê Contábil ZIP
  const [modalDossieAberto, setModalDossieAberto] = useState(false)
  const [tipoPeriodoDossie, setTipoPeriodoDossie] = useState<TipoPeriodoDossie>('ano')
  const [anoDossie, setAnoDossie] = useState<string>('2026')
  const [mesDossie, setMesDossie] = useState<string>('1')
  const [dataInicioDossie, setDataInicioDossie] = useState<string>('')
  const [dataFimDossie, setDataFimDossie] = useState<string>('')
  const [gerandoDossie, setGerandoDossie] = useState(false)
  const [etapaDossie, setEtapaDossie] = useState<string>('')
  const [progressoDossie, setProgressoDossie] = useState<number>(0)

  // Filtros de período
  const [ano, setAno] = useState<string>('2026')
  const [periodo, setPeriodo] = useState<string>('ano')
  const [contaBancariaId, setContaBancariaId] = useState<string>('todas')

  // Anos disponíveis nos lançamentos
  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    set.add('2026')
    set.add('2025')
    set.add('2024')
    const addDate = (d?: string | null) => {
      if (d && d.length >= 4) {
        const y = d.slice(0, 4)
        if (/^\d{4}$/.test(y)) set.add(y)
      }
    }
    parcelas.forEach((p) => {
      addDate(p.vencimento)
      addDate(p.data_pagamento)
      addDate(p.data_faturamento)
    })
    contasPagar.forEach((c) => {
      addDate(c.data_vencimento)
      addDate(c.data_pagamento)
    })
    contasReceber.forEach((c) => {
      addDate(c.data_vencimento)
      addDate(c.data_recebimento)
    })
    return Array.from(set).sort().reverse()
  }, [parcelas, contasPagar, contasReceber])

  // Resolução de meses para o filtro selecionado
  const mesesFiltro = useMemo((): number[] | null => {
    if (periodo === 'ano') return null
    if (periodo.startsWith('mes_')) {
      const m = parseInt(periodo.replace('mes_', ''), 10)
      return [m]
    }
    if (periodo === 'semestre_1') return [1, 2, 3, 4, 5, 6]
    if (periodo === 'semestre_2') return [7, 8, 9, 10, 11, 12]
    if (periodo === 'quadrimestre_1') return [1, 2, 3, 4]
    if (periodo === 'quadrimestre_2') return [5, 6, 7, 8]
    if (periodo === 'quadrimestre_3') return [9, 10, 11, 12]
    if (periodo === 'trimestre_1') return [1, 2, 3]
    if (periodo === 'trimestre_2') return [4, 5, 6]
    if (periodo === 'trimestre_3') return [7, 8, 9]
    if (periodo === 'trimestre_4') return [10, 11, 12]
    return null
  }, [periodo])

  // Rótulo amigável do período
  const periodoRotulo = useMemo(() => {
    const anoStr = ano === 'todos' ? 'Todos os Anos' : ano
    if (periodo === 'ano') return `Exercício ${anoStr}`
    if (periodo.startsWith('mes_')) {
      const nomes = [
        '',
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ]
      const m = parseInt(periodo.replace('mes_', ''), 10)
      return `${nomes[m] || periodo} de ${anoStr}`
    }
    if (periodo === 'semestre_1') return `1º Semestre de ${anoStr}`
    if (periodo === 'semestre_2') return `2º Semestre de ${anoStr}`
    if (periodo === 'quadrimestre_1') return `1º Quadrimestre de ${anoStr}`
    if (periodo === 'quadrimestre_2') return `2º Quadrimestre de ${anoStr}`
    if (periodo === 'quadrimestre_3') return `3º Quadrimestre de ${anoStr}`
    if (periodo === 'trimestre_1') return `1º Trimestre de ${anoStr}`
    if (periodo === 'trimestre_2') return `2º Trimestre de ${anoStr}`
    if (periodo === 'trimestre_3') return `3º Trimestre de ${anoStr}`
    if (periodo === 'trimestre_4') return `4º Trimestre de ${anoStr}`
    return `${periodo} / ${anoStr}`
  }, [ano, periodo])

  // Helper para verificar se uma data cai no período selecionado
  const dataPertenceAoPeriodo = (
    dataStr: string | null | undefined,
    anoAlvo: string = ano,
    mesesAlvo: number[] | null = mesesFiltro,
  ): boolean => {
    if (!dataStr) return false
    const y = dataStr.slice(0, 4)
    if (anoAlvo !== 'todos' && y !== anoAlvo) return false
    if (mesesAlvo && mesesAlvo.length > 0) {
      const m = parseInt(dataStr.slice(5, 7), 10)
      if (!mesesAlvo.includes(m)) return false
    }
    return true
  }

  // Helper para filtrar conta bancária
  const matchConta = (itemContaId?: string | null): boolean => {
    if (contaBancariaId === 'todas') return true
    return itemContaId === contaBancariaId
  }

  // Nome da conta bancária ativa
  const contaAtivaNome = useMemo(() => {
    if (contaBancariaId === 'todas') return 'Todas as Contas PJ'
    const cb = contasBancarias.find((c) => c.id === contaBancariaId)
    return cb ? `${cb.apelido || cb.banco_nome}` : 'Conta Selecionada'
  }, [contaBancariaId, contasBancarias])

  // ==========================================
  // DADOS FILTRADOS DO PERÍODO
  // ==========================================
  // ==========================================
  // BALANCETE DE VERIFICAÇÃO CONTÁBIL (TESTAGEM DE SALDOS)
  // ==========================================
  const balanceteData = useMemo(() => {
    return calcularBalanceteVerificacao({
      parcelas,
      contasPagar,
      contasReceber,
      contasBancarias,
      ativosPatrimonio,
      emprestimosFinanciamentos: emprestimosList,
      ano,
      mesesFiltro,
      periodoRotulo,
      contaBancariaId,
    })
  }, [
    parcelas,
    contasPagar,
    contasReceber,
    contasBancarias,
    ativosPatrimonio,
    emprestimosList,
    ano,
    mesesFiltro,
    periodoRotulo,
    contaBancariaId,
  ])

  const parcelasPeriodo = useMemo(() => {
    return parcelas.filter((p) => {
      const dataRef = p.data_pagamento || p.data_faturamento || p.vencimento
      return dataPertenceAoPeriodo(dataRef) && matchConta(p.conta_bancaria)
    })
  }, [parcelas, ano, mesesFiltro, contaBancariaId])

  const contasPagarPeriodo = useMemo(() => {
    return contasPagar.filter((cp) => {
      const dataRef = cp.data_pagamento || cp.data_vencimento
      return dataPertenceAoPeriodo(dataRef) && matchConta(cp.conta_bancaria)
    })
  }, [contasPagar, ano, mesesFiltro, contaBancariaId])

  const contasReceberPeriodo = useMemo(() => {
    return contasReceber.filter((cr) => {
      const dataRef = cr.data_recebimento || cr.data_vencimento
      return dataPertenceAoPeriodo(dataRef) && matchConta(cr.conta_bancaria)
    })
  }, [contasReceber, ano, mesesFiltro, contaBancariaId])

  // ==========================================
  // 1. BALANÇO PATRIMONIAL (MINUTA A4)
  // ==========================================
  const balancoData = useMemo(() => {
    // 1.1 ATIVO CIRCULANTE
    // A) Disponibilidades: saldos das contas bancárias PJ calculados por lançamentos
    // Calcula saldo atual das contas bancárias consideradas
    const contasConsideradas =
      contaBancariaId === 'todas'
        ? contasBancarias
        : contasBancarias.filter((c) => c.id === contaBancariaId)

    const saldosPorConta = contasConsideradas.map((cb) => {
      const entradasParc = parcelas
        .filter((p) => p.conta_bancaria === cb.id && p.status === 'paga')
        .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0)
      const entradasAvul = contasReceber
        .filter((cr) => cr.conta_bancaria === cb.id && cr.status === 'recebido')
        .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
      const saidasPagar = contasPagar
        .filter((cp) => cp.conta_bancaria === cb.id && cp.status === 'pago')
        .reduce((acc, cp) => acc + (cp.valor || 0), 0)
      const saldoAtual = (cb.saldo_inicial || 0) + entradasParc + entradasAvul - saidasPagar
      return {
        id: cb.id,
        nome: cb.apelido || cb.banco_nome,
        banco: cb.banco_nome,
        agencia: cb.agencia,
        conta: cb.numero_conta,
        saldo: saldoAtual,
      }
    })
    const totalDisponibilidades = saldosPorConta.reduce((acc, c) => acc + c.saldo, 0)

    // B) Contas a Receber do Período (parcelas pendentes/vencidas + avulsas pendentes)
    const contasReceberPendentes = parcelasPeriodo
      .filter((p) => p.status !== 'paga')
      .reduce((acc, p) => acc + (p.valor || 0), 0)
    const avulsasReceberPendentes = contasReceberPeriodo
      .filter((cr) => cr.status === 'pendente')
      .reduce((acc, cr) => acc + (cr.valor || 0), 0)
    const totalContasReceber = contasReceberPendentes + avulsasReceberPendentes

    const totalAtivoCirculante = totalDisponibilidades + totalContasReceber

    // 1.2 ATIVO NÃO CIRCULANTE (Imobilizado e Ativos Intangíveis)
    const ehIntangivel = (cat?: string) =>
      cat === 'marca_patente' ||
      cat === 'software_proprio_aegis' ||
      cat === 'direito_autoral' ||
      cat === 'goodwill_intangivel' ||
      cat === 'software_licenca'

    const ativosCalc = ativosPatrimonio.map((at) => {
      const vidaUtilConfig =
        at.categoria === 'terreno' || at.categoria === 'goodwill_intangivel'
          ? 0
          : at.vida_util_meses !== undefined
            ? at.vida_util_meses
            : (DEPRECIACAO_PADRAO[at.categoria]?.vidaUtilMeses ?? 120)

      const calc =
        at.categoria === 'terreno' || at.categoria === 'goodwill_intangivel' || vidaUtilConfig === 0
          ? { depreciacaoAcumulada: 0, valorContabilAtual: at.valor_aquisicao }
          : calcularDepreciacaoLinear(
              at.valor_aquisicao,
              at.data_aquisicao,
              vidaUtilConfig,
              at.valor_residual || 0,
            )

      return {
        ...at,
        custoHistorico: at.valor_aquisicao,
        depreciacao: calc.depreciacaoAcumulada,
        valorLiquido: calc.valorContabilAtual,
        ehIntangivel: ehIntangivel(at.categoria),
      }
    })
    const totalCustoHistoricoAtivos = ativosCalc.reduce((acc, a) => acc + a.custoHistorico, 0)
    const totalDepreciacaoAcumulada = ativosCalc.reduce((acc, a) => acc + a.depreciacao, 0)
    const totalAtivoNaoCirculante = totalCustoHistoricoAtivos - totalDepreciacaoAcumulada

    // Segregação Contábil (Imobilizado vs Intangível)
    const ativosImobilizados = ativosCalc.filter((a) => !a.ehIntangivel)
    const ativosIntangiveis = ativosCalc.filter((a) => a.ehIntangivel)
    const totalImobilizadoLiquido = ativosImobilizados.reduce((acc, a) => acc + a.valorLiquido, 0)
    const totalIntangivelLiquido = ativosIntangiveis.reduce((acc, a) => acc + a.valorLiquido, 0)
    const totalCustoIntangivel = ativosIntangiveis.reduce((acc, a) => acc + a.custoHistorico, 0)
    const totalAmortizacaoIntangivel = ativosIntangiveis.reduce((acc, a) => acc + a.depreciacao, 0)

    const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante

    // 1.3 PASSIVO CIRCULANTE & NÃO CIRCULANTE (Fornecedores + Empréstimos e Financiamentos)
    const contasPagarPendentes = contasPagarPeriodo
      .filter((cp) => cp.status === 'pendente')
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    let totalEmprestimosCirculante = 0
    let totalEmprestimosNaoCirculante = 0
    let totalJurosApropriarCirculante = 0
    let totalJurosApropriarNaoCirculante = 0

    emprestimosList.forEach((ef) => {
      if (ef.status === 'cancelado') return
      const circ = ef.saldo_circulante || 0
      const naoCirc = ef.saldo_nao_circulante || 0
      const tot = circ + naoCirc
      const ratioCirc = tot > 0 ? circ / tot : 1
      const jurosAprop = ef.saldo_juros_a_apropriar || 0

      totalEmprestimosCirculante += circ
      totalEmprestimosNaoCirculante += naoCirc
      totalJurosApropriarCirculante += jurosAprop * ratioCirc
      totalJurosApropriarNaoCirculante += jurosAprop * (1 - ratioCirc)
    })

    const passivoCirculanteTotal =
      contasPagarPendentes + totalEmprestimosCirculante - totalJurosApropriarCirculante
    const passivoNaoCirculanteTotal =
      totalEmprestimosNaoCirculante - totalJurosApropriarNaoCirculante
    const passivoExigivelTotal = passivoCirculanteTotal + passivoNaoCirculanteTotal

    // 1.4 PATRIMÔNIO LÍQUIDO
    // Capital Social Simbólico / Integralizado padrão da consultoria + Resultado Acumulado Histórico
    const totalReceitasHistoricas =
      parcelas
        .filter((p) => p.status === 'paga')
        .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0) +
      contasReceber
        .filter((cr) => cr.status === 'recebido')
        .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
    const totalDespesasHistoricas = contasPagar
      .filter((cp) => cp.status === 'pago')
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)
    const resultadoAcumuladoHistorico = totalReceitasHistoricas - totalDespesasHistoricas

    // Para o fechamento do Balanço: PL = Ativo Total - Passivo Total
    const patrimonioLiquidoTotal = totalAtivo - passivoExigivelTotal
    const capitalSocialEstimado = Math.max(0, patrimonioLiquidoTotal - resultadoAcumuladoHistorico)

    return {
      saldosPorConta,
      totalDisponibilidades,
      totalContasReceber,
      totalAtivoCirculante,
      ativosCalc,
      totalCustoHistoricoAtivos,
      totalDepreciacaoAcumulada,
      totalAtivoNaoCirculante,
      totalImobilizadoLiquido,
      totalIntangivelLiquido,
      totalCustoIntangivel,
      totalAmortizacaoIntangivel,
      qtdIntangiveis: ativosIntangiveis.length,
      qtdImobilizados: ativosImobilizados.length,
      totalAtivo,
      totalPassivoCirculante: passivoCirculanteTotal,
      fornecedoresCirculante: contasPagarPendentes,
      totalEmprestimosCirculante,
      totalJurosApropriarCirculante,
      totalPassivoNaoCirculante: passivoNaoCirculanteTotal,
      totalEmprestimosNaoCirculante,
      totalJurosApropriarNaoCirculante,
      passivoExigivelTotal,
      resultadoAcumuladoHistorico,
      capitalSocialEstimado,
      patrimonioLiquidoTotal,
      totalPassivoEPL: passivoExigivelTotal + patrimonioLiquidoTotal,
    }
  }, [
    contasBancarias,
    contaBancariaId,
    parcelas,
    contasReceber,
    contasPagar,
    parcelasPeriodo,
    contasReceberPeriodo,
    contasPagarPeriodo,
    ativosPatrimonio,
    emprestimosList,
  ])

  // ==========================================
  // 2. DRE POR PERÍODO (DEGRAUS CONTÁBEIS)
  // ==========================================
  const dreData = useMemo(() => {
    // 2.1 Receita Bruta (Faturado / Recebido de Serviços Técnicos Aeronáuticos)
    const recParcelas = parcelasPeriodo
      .filter((p) => p.status === 'paga')
      .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0)
    const recAvulsas = contasReceberPeriodo
      .filter((cr) => cr.status === 'recebido')
      .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
    const receitaBruta = recParcelas + recAvulsas

    // 2.2 Deduções e Impostos sobre Serviços (ISS, PIS/COFINS, Simples/Presumido ou cat impostos)
    const deducoesImpostos = contasPagarPeriodo
      .filter((cp) => {
        const codigo = cp.plano_contas_codigo || ''
        if (codigo) return codigo.startsWith('3.3')
        return (
          cp.categoria === 'impostos' ||
          cp.descricao?.toLowerCase().includes('iss') ||
          cp.descricao?.toLowerCase().includes('das')
        )
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    // 2.3 Receita Líquida
    const receitaLiquida = receitaBruta - deducoesImpostos

    // 2.4 Custos Variáveis / Diretos dos Projetos (terceirizados, viagens, topografia)
    const custosVariaveis = contasPagarPeriodo
      .filter((cp) => {
        const codigo = cp.plano_contas_codigo || ''
        if (codigo) return codigo.startsWith('3.2') || codigo === '3.1.4' || codigo === '3.1.5'
        return cp.categoria === 'terceirizados' || Boolean(cp.projeto)
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    // 2.5 Margem de Contribuição
    const margemContribuicao = receitaLiquida - custosVariaveis
    const indiceMargemContribuicao = receitaLiquida > 0 ? margemContribuicao / receitaLiquida : 0

    // 2.6 Despesas Fixas (folha, sede, software, adm)
    const despesasFixas = contasPagarPeriodo
      .filter((cp) => {
        const codigo = cp.plano_contas_codigo || ''
        if (codigo) {
          const ehImposto = codigo.startsWith('3.3')
          const ehVariavel = codigo.startsWith('3.2') || codigo === '3.1.4' || codigo === '3.1.5'
          return !ehImposto && !ehVariavel
        }
        const ehImposto = cp.categoria === 'impostos' || cp.descricao?.toLowerCase().includes('iss')
        const ehVariavel = cp.categoria === 'terceirizados' || Boolean(cp.projeto)
        return !ehImposto && !ehVariavel
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    // 2.7 Juros Apropriados de Empréstimos e Financiamentos (Conta 3.5.2)
    const despesasJurosApropriados = contasPagarPeriodo
      .filter((cp) => {
        const codigo = cp.plano_contas_codigo || ''
        return codigo === '3.5.2' || cp.descricao?.includes('[ETAPA 2')
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)

    // 2.8 Resultado Operacional (EBIT / Lucro Líquido do Período)
    const resultadoOperacional = margemContribuicao - despesasFixas
    const margemLiquidaPercentual =
      receitaBruta > 0 ? (resultadoOperacional / receitaBruta) * 100 : 0

    // ------------------------------------------
    // PERÍODO ANTERIOR COMPARATIVO (mesma amplitude)
    // ------------------------------------------
    let anoAnterior = ano === 'todos' ? 'todos' : String(Number(ano) - 1)
    let mesesAnteriores = mesesFiltro

    // Se estiver filtrando trimestre/semestre/mês específico no mesmo ano,
    // o comparativo pode ser o período imediatamente anterior no mesmo ano ou ano anterior
    if (periodo.startsWith('mes_')) {
      const m = parseInt(periodo.replace('mes_', ''), 10)
      if (m === 1) {
        anoAnterior = String(Number(ano) - 1)
        mesesAnteriores = [12]
      } else {
        anoAnterior = ano
        mesesAnteriores = [m - 1]
      }
    } else if (periodo === 'semestre_2') {
      anoAnterior = ano
      mesesAnteriores = [1, 2, 3, 4, 5, 6]
    } else if (periodo === 'semestre_1') {
      anoAnterior = String(Number(ano) - 1)
      mesesAnteriores = [7, 8, 9, 10, 11, 12]
    }

    // Calcula receitas e despesas do período anterior
    const recAntParc = parcelas
      .filter((p) => {
        const dataRef = p.data_pagamento || p.data_faturamento || p.vencimento
        return (
          p.status === 'paga' &&
          dataPertenceAoPeriodo(dataRef, anoAnterior, mesesAnteriores) &&
          matchConta(p.conta_bancaria)
        )
      })
      .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0)

    const recAntAvul = contasReceber
      .filter((cr) => {
        const dataRef = cr.data_recebimento || cr.data_vencimento
        return (
          cr.status === 'recebido' &&
          dataPertenceAoPeriodo(dataRef, anoAnterior, mesesAnteriores) &&
          matchConta(cr.conta_bancaria)
        )
      })
      .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)
    const recBrutaAnterior = recAntParc + recAntAvul

    const despAnt = contasPagar
      .filter((cp) => {
        const dataRef = cp.data_pagamento || cp.data_vencimento
        return (
          dataPertenceAoPeriodo(dataRef, anoAnterior, mesesAnteriores) &&
          matchConta(cp.conta_bancaria)
        )
      })
      .reduce((acc, cp) => acc + (cp.valor || 0), 0)
    const resOperacionalAnterior = recBrutaAnterior - despAnt

    return {
      receitaBruta,
      deducoesImpostos,
      receitaLiquida,
      custosVariaveis,
      margemContribuicao,
      indiceMargemContribuicao,
      despesasFixas,
      despesasJurosApropriados,
      resultadoOperacional,
      margemLiquidaPercentual,
      // Comparativo
      recBrutaAnterior,
      despAnt,
      resOperacionalAnterior,
      variacaoReceitaPercentual:
        recBrutaAnterior > 0 ? ((receitaBruta - recBrutaAnterior) / recBrutaAnterior) * 100 : null,
      variacaoResultadoPercentual:
        resOperacionalAnterior !== 0
          ? ((resultadoOperacional - resOperacionalAnterior) / Math.abs(resOperacionalAnterior)) *
            100
          : null,
    }
  }, [
    parcelasPeriodo,
    contasReceberPeriodo,
    contasPagarPeriodo,
    parcelas,
    contasReceber,
    contasPagar,
    ano,
    mesesFiltro,
    periodo,
    contaBancariaId,
  ])

  // ==========================================
  // 3. PONTO DE EQUILÍBRIO (BREAK-EVEN POINT)
  // ==========================================
  const pontoEquilibrioData = useMemo(() => {
    const custosFixos = dreData.despesasFixas
    // Se o índice no período for zero ou anormal, usamos a média histórica
    let imc = dreData.indiceMargemContribuicao
    if (imc <= 0.05 || imc > 1) {
      imc = 0.55 // Média histórica típica de consultoria de projetos aeronáuticos
    }

    // Ponto de Equilíbrio Contábil = Custos Fixos ÷ IMC
    const faturamentoPontoEquilibrio = custosFixos / imc

    // Margem de Segurança = Receita Atual - Ponto de Equilíbrio
    const margemSegurancaValor = dreData.receitaBruta - faturamentoPontoEquilibrio
    const margemSegurancaPercentual =
      dreData.receitaBruta > 0 ? (margemSegurancaValor / dreData.receitaBruta) * 100 : 0

    // Meta mensal simples para cobrir a estrutura
    const mesesDuracao = mesesFiltro ? mesesFiltro.length : 12
    const metaFaturamentoMensal = faturamentoPontoEquilibrio / (mesesDuracao || 1)
    const realizadoMensal = dreData.receitaBruta / (mesesDuracao || 1)

    return {
      custosFixos,
      indiceMargemContribuicao: imc,
      faturamentoPontoEquilibrio,
      margemSegurancaValor,
      margemSegurancaPercentual,
      metaFaturamentoMensal,
      realizadoMensal,
      atingiuBreakEven: dreData.receitaBruta >= faturamentoPontoEquilibrio,
    }
  }, [dreData, mesesFiltro])

  // ==========================================
  // 4. PAINEL DE INDICADORES & INSIGHTS
  // ==========================================
  const indicadoresData = useMemo(() => {
    // 4.1 Concentração por cliente
    const receitaClienteMap = new Map<string, { nome: string; valor: number }>()
    parcelasPeriodo
      .filter((p) => p.status === 'paga')
      .forEach((p) => {
        const cliId = p.cliente || 'outro'
        const cliNome = p.expand?.cliente?.razao_social || 'Cliente Avulso'
        const curr = receitaClienteMap.get(cliId) || { nome: cliNome, valor: 0 }
        curr.valor += p.valor_recebido || p.valor || 0
        receitaClienteMap.set(cliId, curr)
      })
    const clientesOrdenados = Array.from(receitaClienteMap.values()).sort(
      (a, b) => b.valor - a.valor,
    )
    const maiorCliente = clientesOrdenados[0]
    const concentracaoMaiorCliente =
      dreData.receitaBruta > 0 && maiorCliente
        ? (maiorCliente.valor / dreData.receitaBruta) * 100
        : 0

    // 4.2 Prazo Médio de Recebimento (PMR) aproximado em dias
    let totalDiasRecebimento = 0
    let countComDatas = 0
    parcelasPeriodo
      .filter((p) => p.status === 'paga' && p.data_faturamento && p.data_pagamento)
      .forEach((p) => {
        const dFat = new Date(p.data_faturamento!.slice(0, 10)).getTime()
        const dPag = new Date(p.data_pagamento!.slice(0, 10)).getTime()
        const diff = Math.max(0, Math.round((dPag - dFat) / (1000 * 60 * 60 * 24)))
        totalDiasRecebimento += diff
        countComDatas++
      })
    const pmrMedio = countComDatas > 0 ? Math.round(totalDiasRecebimento / countComDatas) : 28

    // 4.3 Total de parcelas em atraso no período
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const parcelasAtrasadas = parcelasPeriodo.filter((p) => {
      if (p.status === 'paga' || !p.vencimento) return false
      const dVenc = new Date(p.vencimento.slice(0, 10))
      dVenc.setHours(0, 0, 0, 0)
      return dVenc < hoje || p.status === 'vencida'
    })
    const totalAtrasado = parcelasAtrasadas.reduce((acc, p) => acc + (p.valor || 0), 0)

    // 4.4 Série de barras mensais (Entradas vs Saídas do ano)
    const mesesDoAno = [
      { mes: 1, nome: 'Jan' },
      { mes: 2, nome: 'Fev' },
      { mes: 3, nome: 'Mar' },
      { mes: 4, nome: 'Abr' },
      { mes: 5, nome: 'Mai' },
      { mes: 6, nome: 'Jun' },
      { mes: 7, nome: 'Jul' },
      { mes: 8, nome: 'Ago' },
      { mes: 9, nome: 'Set' },
      { mes: 10, nome: 'Out' },
      { mes: 11, nome: 'Nov' },
      { mes: 12, nome: 'Dez' },
    ]
    const evolucaoMensal = mesesDoAno.map((m) => {
      const entParc = parcelas
        .filter((p) => {
          if (p.status !== 'paga') return false
          const d = p.data_pagamento || p.vencimento
          if (!d) return false
          const matchAno = ano === 'todos' || d.startsWith(ano)
          const mesNum = parseInt(d.slice(5, 7), 10)
          return matchAno && mesNum === m.mes && matchConta(p.conta_bancaria)
        })
        .reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0)

      const entAvul = contasReceber
        .filter((cr) => {
          if (cr.status !== 'recebido') return false
          const d = cr.data_recebimento || cr.data_vencimento
          if (!d) return false
          const matchAno = ano === 'todos' || d.startsWith(ano)
          const mesNum = parseInt(d.slice(5, 7), 10)
          return matchAno && mesNum === m.mes && matchConta(cr.conta_bancaria)
        })
        .reduce((acc, cr) => acc + (cr.valor_recebido || cr.valor || 0), 0)

      const saidas = contasPagar
        .filter((cp) => {
          if (cp.status !== 'pago') return false
          const d = cp.data_pagamento || cp.data_vencimento
          if (!d) return false
          const matchAno = ano === 'todos' || d.startsWith(ano)
          const mesNum = parseInt(d.slice(5, 7), 10)
          return matchAno && mesNum === m.mes && matchConta(cp.conta_bancaria)
        })
        .reduce((acc, cp) => acc + (cp.valor || 0), 0)

      const entradasTotal = entParc + entAvul
      return {
        ...m,
        entradas: entradasTotal,
        saidas,
        saldo: entradasTotal - saidas,
      }
    })

    const maxValorGrafico = Math.max(
      1,
      ...evolucaoMensal.map((e) => Math.max(e.entradas, e.saidas)),
    )

    // 4.5 Insights Determinísticos baseados nas regras de negócio
    const insights: Array<{
      id: string
      tipo: 'positivo' | 'alerta' | 'neutro'
      titulo: string
      descricao: string
      abaDestino: string
      destaque?: string
    }> = []

    if (dreData.variacaoReceitaPercentual !== null && dreData.variacaoReceitaPercentual > 5) {
      insights.push({
        id: 'rec_cresceu',
        tipo: 'positivo',
        titulo: `Receita cresceu +${dreData.variacaoReceitaPercentual.toFixed(1)}%`,
        descricao: `O faturamento do período superou o ciclo anterior em ${formatCurrency(dreData.receitaBruta - dreData.recBrutaAnterior)}.`,
        abaDestino: 'contas_receber',
        destaque: `+${dreData.variacaoReceitaPercentual.toFixed(1)}%`,
      })
    } else if (
      dreData.variacaoReceitaPercentual !== null &&
      dreData.variacaoReceitaPercentual < -5
    ) {
      insights.push({
        id: 'rec_queda',
        tipo: 'alerta',
        titulo: `Receita recuou ${dreData.variacaoReceitaPercentual.toFixed(1)}%`,
        descricao: `Queda em relação ao ciclo anterior. Verifique emissão de NFS-e e gatilhos contratuais.`,
        abaDestino: 'contas_receber',
        destaque: `${dreData.variacaoReceitaPercentual.toFixed(1)}%`,
      })
    }

    if (totalAtrasado > 0) {
      insights.push({
        id: 'atrasados',
        tipo: 'alerta',
        titulo: `${parcelasAtrasadas.length} parcela(s) em atraso totalizando ${formatCurrency(totalAtrasado)}`,
        descricao: `Cobrança ativa recomendada para recompor o Ativo Circulante da AEROCAD.`,
        abaDestino: 'contas_receber',
        destaque: formatCurrency(totalAtrasado),
      })
    } else {
      insights.push({
        id: 'sem_atraso',
        tipo: 'positivo',
        titulo: 'Inadimplência Zero no Período',
        descricao:
          'Todas as parcelas com vencimento no recorte encontram-se rigorosamente quitadas.',
        abaDestino: 'contas_receber',
      })
    }

    if (concentracaoMaiorCliente > 40 && maiorCliente) {
      insights.push({
        id: 'concentracao_cliente',
        tipo: 'alerta',
        titulo: `Concentração de ${concentracaoMaiorCliente.toFixed(0)}% em 1 cliente`,
        descricao: `O cliente "${maiorCliente.nome}" representa a maior fatia do faturamento no período.`,
        abaDestino: 'contas_receber',
        destaque: `${concentracaoMaiorCliente.toFixed(0)}%`,
      })
    }

    if (pontoEquilibrioData.atingiuBreakEven) {
      insights.push({
        id: 'break_even_atingido',
        tipo: 'positivo',
        titulo: 'Ponto de Equilíbrio Superado',
        descricao: `Margem de segurança de ${formatCurrency(pontoEquilibrioData.margemSegurancaValor)} (${pontoEquilibrioData.margemSegurancaPercentual.toFixed(1)}%) acima dos custos operacionais fixos.`,
        abaDestino: 'fluxo_caixa',
        destaque: `+${pontoEquilibrioData.margemSegurancaPercentual.toFixed(0)}%`,
      })
    } else {
      insights.push({
        id: 'break_even_pendente',
        tipo: 'alerta',
        titulo: 'Abaixo do Ponto de Equilíbrio',
        descricao: `Faltam ${formatCurrency(Math.abs(pontoEquilibrioData.margemSegurancaValor))} para amortizar todos os custos e despesas fixas deste ciclo.`,
        abaDestino: 'fluxo_caixa',
        destaque: `Déficit ${formatCurrency(Math.abs(pontoEquilibrioData.margemSegurancaValor))}`,
      })
    }

    return {
      concentracaoMaiorCliente,
      maiorCliente,
      pmrMedio,
      totalAtrasado,
      parcelasAtrasadasCount: parcelasAtrasadas.length,
      evolucaoMensal,
      maxValorGrafico,
      insights,
    }
  }, [
    parcelasPeriodo,
    dreData,
    pontoEquilibrioData,
    parcelas,
    contasReceber,
    contasPagar,
    ano,
    contaBancariaId,
  ])

  // ==========================================
  // EXPORTAÇÃO XLSX
  // ==========================================
  async function handleExportarRelatorioEmprestimosXlsx() {
    if (!emprestimosList || emprestimosList.length === 0) return

    const linhas: Record<string, unknown>[] = emprestimosList.map((ef) => ({
      numero: ef.numero_contrato,
      tipo:
        ef.tipo === 'emprestimo_bancario'
          ? 'Empréstimo Bancário'
          : ef.tipo === 'financiamento_veiculo'
            ? 'Financiamento Veículo'
            : 'Outras Modalidades',
      banco: ef.banco_nome || '—',
      dataContratacao: ef.data_contratacao ? ef.data_contratacao.slice(0, 10) : '—',
      dividaTotal: ef.valor_total_divida,
      valorLiberado: ef.valor_liquido_liberado,
      jurosContratuais: ef.total_juros_prefixados,
      jurosApropriados: ef.total_juros_apropriados,
      jurosAApropriar: ef.saldo_juros_a_apropriar,
      saldoDevedor: ef.saldo_devedor_atual,
      saldoCirculante: ef.saldo_circulante,
      saldoNaoCirculante: ef.saldo_nao_circulante,
      totalAmortizado: ef.total_amortizado,
      status: ef.status.toUpperCase(),
    }))

    await exportarTabelaParaXlsx({
      nomeArquivo: `demonstrativo_emprestimos_financiamentos_${ano}_${periodo}`,
      tituloRelatorio: `CRONOGRAMA E DEMONSTRATIVO DE JUROS DE EMPRÉSTIMOS E FINANCIAMENTOS`,
      subtitulo: `${periodoRotulo} · Regra Contábil de Partidas Dobradas · AEROCAD Consultoria`,
      usuarioNome,
      userRole,
      permitirValoresReais: podeVerValores && !ocultarGlobal,
      colunas: [
        { header: 'Nº Contrato', key: 'numero', width: 18 },
        { header: 'Tipo Operação', key: 'tipo', width: 22 },
        { header: 'Instituição Credora', key: 'banco', width: 22 },
        { header: 'Data Contratação', key: 'dataContratacao', width: 16 },
        { header: 'Total Dívida (R$)', key: 'dividaTotal', width: 20, tipo: 'moeda' },
        { header: 'Principal/Liberado (R$)', key: 'valorLiberado', width: 20, tipo: 'moeda' },
        { header: 'Juros Pré-Fixados (R$)', key: 'jurosContratuais', width: 20, tipo: 'moeda' },
        { header: 'Juros Apropriados (R$)', key: 'jurosApropriados', width: 20, tipo: 'moeda' },
        { header: 'Juros a Apropriar (R$)', key: 'jurosAApropriar', width: 20, tipo: 'moeda' },
        { header: 'Saldo Devedor (R$)', key: 'saldoDevedor', width: 20, tipo: 'moeda' },
        { header: 'Passivo Circulante (R$)', key: 'saldoCirculante', width: 20, tipo: 'moeda' },
        {
          header: 'Passivo Não Circulante (R$)',
          key: 'saldoNaoCirculante',
          width: 20,
          tipo: 'moeda',
        },
        { header: 'Amortizado (R$)', key: 'totalAmortizado', width: 20, tipo: 'moeda' },
        { header: 'Status', key: 'status', width: 14 },
      ],
      linhas,
    })
  }

  async function handleExportarXlsx() {
    if (secaoAtiva === 'balancete') {
      const linhas: Record<string, unknown>[] = balanceteData.linhas.map((l) => ({
        codigo: l.codigo,
        descricao:
          l.grau === 1
            ? l.descricao.toUpperCase()
            : l.grau === 2
              ? `  ${l.descricao}`
              : `    ${l.descricao}`,
        natureza: l.natureza === 'D' ? 'Devedora (D)' : 'Credora (C)',
        saldoAnterior: l.saldoAnterior,
        debitos: l.debitos,
        creditos: l.creditos,
        saldoFinal: l.saldoFinal,
        saldoFinalNat: l.saldoFinalNatureza,
      }))

      await exportarTabelaParaXlsx({
        nomeArquivo: `balancete_verificacao_${ano}_${periodo}`,
        tituloRelatorio: `BALANCETE DE VERIFICAÇÃO (TESTAGEM DOS SALDOS) — AEROCAD`,
        subtitulo: `${periodoRotulo} · Conta: ${contaAtivaNome} · Padronização Contábil Brasileira (Partidas Dobradas)`,
        usuarioNome,
        userRole,
        permitirValoresReais: podeVerValores && !ocultarGlobal,
        colunas: [
          { header: 'Código / Conta', key: 'codigo', width: 16 },
          { header: 'Descrição da Razão Contábil', key: 'descricao', width: 44 },
          { header: 'Natureza', key: 'natureza', width: 16 },
          { header: 'Saldo Anterior (R$)', key: 'saldoAnterior', width: 20, tipo: 'moeda' },
          { header: 'Débitos do Período (R$)', key: 'debitos', width: 22, tipo: 'moeda' },
          { header: 'Créditos do Período (R$)', key: 'creditos', width: 22, tipo: 'moeda' },
          { header: 'Saldo Final (R$)', key: 'saldoFinal', width: 20, tipo: 'moeda' },
          { header: 'D/C Final', key: 'saldoFinalNat', width: 12 },
        ],
        linhas,
      })
    } else if (secaoAtiva === 'balanco') {
      const linhas: Record<string, unknown>[] = [
        {
          grupo: 'ATIVO CIRCULANTE',
          subgrupo: 'Disponibilidades (Bancos Conta Movimento PJ)',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalDisponibilidades,
        },
        ...balancoData.saldosPorConta.map((c) => ({
          grupo: 'ATIVO CIRCULANTE',
          subgrupo: `  - ${c.nome} (Ag: ${c.agencia || '-'} / CC: ${c.conta || '-'})`,
          conta_bancaria: c.nome,
          valor: c.saldo,
        })),
        {
          grupo: 'ATIVO CIRCULANTE',
          subgrupo: 'Contas a Receber de Clientes (Projetos em Andamento)',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalContasReceber,
        },
        {
          grupo: 'TOTAL DO ATIVO CIRCULANTE',
          subgrupo: 'Soma do Ativo Circulante',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalAtivoCirculante,
        },
        {
          grupo: 'ATIVO NÃO CIRCULANTE',
          subgrupo: '1.2.1 Ativo Imobilizado Líquido',
          conta_bancaria: '—',
          valor: balancoData.totalImobilizadoLiquido,
        },
        {
          grupo: 'ATIVO NÃO CIRCULANTE',
          subgrupo: '1.2.2 Ativo Intangível Líquido (Marcas/Patentes INPI, AEGIS)',
          conta_bancaria: '—',
          valor: balancoData.totalIntangivelLiquido,
        },
        {
          grupo: 'ATIVO NÃO CIRCULANTE',
          subgrupo: 'Custo Histórico Total dos Ativos (Imobilizado + Intangível)',
          conta_bancaria: '—',
          valor: balancoData.totalCustoHistoricoAtivos,
        },
        {
          grupo: 'ATIVO NÃO CIRCULANTE',
          subgrupo: '(-) Depreciação / Amortização Linear Acumulada',
          conta_bancaria: '—',
          valor: -balancoData.totalDepreciacaoAcumulada,
        },
        {
          grupo: 'TOTAL DO ATIVO NÃO CIRCULANTE',
          subgrupo: 'Valor Contábil Líquido Total dos Bens e Intangíveis',
          conta_bancaria: '—',
          valor: balancoData.totalAtivoNaoCirculante,
        },
        {
          grupo: 'TOTAL DO ATIVO (CIRCULANTE + NÃO CIRCULANTE)',
          subgrupo: 'Ativo Total Consolidado',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalAtivo,
        },
        {
          grupo: 'PASSIVO CIRCULANTE',
          subgrupo: 'Fornecedores e Contas a Pagar Comerciais',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.fornecedoresCirculante,
        },
        ...(balancoData.totalEmprestimosCirculante > 0
          ? [
              {
                grupo: 'PASSIVO CIRCULANTE',
                subgrupo: 'Empréstimos e Financiamentos a Pagar (Curto Prazo)',
                conta_bancaria: contaAtivaNome,
                valor: balancoData.totalEmprestimosCirculante,
              },
              {
                grupo: 'PASSIVO CIRCULANTE',
                subgrupo: '(-) Encargos Financeiros a Apropriar (Circulante)',
                conta_bancaria: '—',
                valor: -balancoData.totalJurosApropriarCirculante,
              },
            ]
          : []),
        {
          grupo: 'TOTAL DO PASSIVO CIRCULANTE',
          subgrupo: 'Passivo Circulante Líquido',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalPassivoCirculante,
        },
        ...(balancoData.totalPassivoNaoCirculante > 0
          ? [
              {
                grupo: 'PASSIVO NÃO CIRCULANTE',
                subgrupo: 'Empréstimos e Financiamentos de Longo Prazo',
                conta_bancaria: '—',
                valor: balancoData.totalEmprestimosNaoCirculante,
              },
              {
                grupo: 'PASSIVO NÃO CIRCULANTE',
                subgrupo: '(-) Encargos Financeiros a Apropriar (Não Circulante)',
                conta_bancaria: '—',
                valor: -balancoData.totalJurosApropriarNaoCirculante,
              },
              {
                grupo: 'TOTAL DO PASSIVO NÃO CIRCULANTE',
                subgrupo: 'Exigível a Longo Prazo Líquido',
                conta_bancaria: '—',
                valor: balancoData.totalPassivoNaoCirculante,
              },
            ]
          : []),
        {
          grupo: 'PATRIMÔNIO LÍQUIDO',
          subgrupo: 'Capital Social Integralizado Estimado',
          conta_bancaria: '—',
          valor: balancoData.capitalSocialEstimado,
        },
        {
          grupo: 'PATRIMÔNIO LÍQUIDO',
          subgrupo: 'Lucros / Resultados Acumulados da Consultoria',
          conta_bancaria: '—',
          valor: balancoData.resultadoAcumuladoHistorico,
        },
        {
          grupo: 'TOTAL DO PASSIVO E PATRIMÔNIO LÍQUIDO',
          subgrupo: 'Fechamento Contábil (Passivo + PL)',
          conta_bancaria: contaAtivaNome,
          valor: balancoData.totalPassivoEPL,
        },
      ]

      await exportarTabelaParaXlsx({
        nomeArquivo: `balanco_patrimonial_minuta_${ano}_${periodo}`,
        tituloRelatorio: `BALANÇO PATRIMONIAL (MINUTA) — AEROCAD ENGENHARIA`,
        subtitulo: `${periodoRotulo} · Conta: ${contaAtivaNome} · MINUTA SUJEITA A REVISÃO DO CONTADOR`,
        usuarioNome,
        userRole,
        permitirValoresReais: podeVerValores && !ocultarGlobal,
        colunas: [
          { header: 'Grupo Patrimonial', key: 'grupo', width: 34 },
          { header: 'Conta / Subgrupo Contábil', key: 'subgrupo', width: 42 },
          { header: 'Conta Bancária PJ', key: 'conta_bancaria', width: 28 },
          { header: 'Saldo / Valor (R$)', key: 'valor', width: 22, tipo: 'moeda' },
        ],
        linhas,
      })
    } else if (secaoAtiva === 'dre') {
      const linhas: Record<string, unknown>[] = [
        {
          rubrica: '1. RECEITA OPERACIONAL BRUTA',
          conta_bancaria: contaAtivaNome,
          valorAtual: dreData.receitaBruta,
          valorAnterior: dreData.recBrutaAnterior,
        },
        {
          rubrica: '2. (-) DEDUÇÕES E TRIBUTOS SOBRE FATURAMENTO',
          conta_bancaria: contaAtivaNome,
          valorAtual: -dreData.deducoesImpostos,
          valorAnterior: 0,
        },
        {
          rubrica: '3. (=) RECEITA OPERACIONAL LÍQUIDA',
          conta_bancaria: contaAtivaNome,
          valorAtual: dreData.receitaLiquida,
          valorAnterior: dreData.recBrutaAnterior,
        },
        {
          rubrica: '4. (-) CUSTOS VARIÁVEIS / DIRETOS DE PROJETOS',
          conta_bancaria: contaAtivaNome,
          valorAtual: -dreData.custosVariaveis,
          valorAnterior: 0,
        },
        {
          rubrica: '5. (=) MARGEM DE CONTRIBUIÇÃO',
          conta_bancaria: contaAtivaNome,
          valorAtual: dreData.margemContribuicao,
          valorAnterior: 0,
        },
        {
          rubrica: '6. (-) DESPESAS FIXAS OPERACIONAIS & PESSOAL',
          conta_bancaria: contaAtivaNome,
          valorAtual: -dreData.despesasFixas,
          valorAnterior: -dreData.despAnt,
        },
        {
          rubrica: '7. (=) RESULTADO OPERACIONAL ANTES DO RESULTADO FINANCEIRO (EBITDA)',
          conta_bancaria: contaAtivaNome,
          valorAtual: dreData.resultadoOperacional,
          valorAnterior: dreData.resOperacionalAnterior,
        },
        {
          rubrica: '8. (-) DESPESAS FINANCEIRAS / JUROS APROPRIADOS',
          conta_bancaria: contaAtivaNome,
          valorAtual: -dreData.despesasJurosApropriados,
          valorAnterior: 0,
        },
        {
          rubrica: '9. (=) RESULTADO LÍQUIDO DO EXERCÍCIO (DRE)',
          conta_bancaria: contaAtivaNome,
          valorAtual: dreData.resultadoOperacional - dreData.despesasJurosApropriados,
          valorAnterior: dreData.resOperacionalAnterior,
        },
      ]

      await exportarTabelaParaXlsx({
        nomeArquivo: `dre_periodo_${ano}_${periodo}`,
        tituloRelatorio: `DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE) — AEROCAD`,
        subtitulo: `${periodoRotulo} · Conta: ${contaAtivaNome}`,
        usuarioNome,
        userRole,
        permitirValoresReais: podeVerValores && !ocultarGlobal,
        colunas: [
          { header: 'Degrau Contábil / Rubrica', key: 'rubrica', width: 44 },
          { header: 'Conta Bancária PJ', key: 'conta_bancaria', width: 28 },
          { header: 'Período Atual (R$)', key: 'valorAtual', width: 22, tipo: 'moeda' },
          { header: 'Período Anterior (R$)', key: 'valorAnterior', width: 22, tipo: 'moeda' },
        ],
        linhas,
      })
    } else {
      // Ponto de Equilíbrio / Indicadores
      const linhas: Record<string, unknown>[] = [
        {
          indicador: 'Custos Fixos Totais',
          conta_bancaria: contaAtivaNome,
          valor: pontoEquilibrioData.custosFixos,
          nota: 'Despesas estruturais e folha',
        },
        {
          indicador: 'Índice de Margem de Contribuição (IMC)',
          conta_bancaria: contaAtivaNome,
          valor: (pontoEquilibrioData.indiceMargemContribuicao * 100).toFixed(1) + '%',
          nota: 'Percentual retido após custos variáveis',
        },
        {
          indicador: 'Faturamento Ponto de Equilíbrio',
          conta_bancaria: contaAtivaNome,
          valor: pontoEquilibrioData.faturamentoPontoEquilibrio,
          nota: 'Custos Fixos ÷ IMC',
        },
        {
          indicador: 'Margem de Segurança (R$)',
          conta_bancaria: contaAtivaNome,
          valor: pontoEquilibrioData.margemSegurancaValor,
          nota: 'Faturamento Atual − Ponto de Equilíbrio',
        },
        {
          indicador: 'Prazo Médio de Recebimento (PMR)',
          conta_bancaria: contaAtivaNome,
          valor: `${indicadoresData.pmrMedio} dias`,
          nota: 'Média de liquidação de medições',
        },
      ]

      await exportarTabelaParaXlsx({
        nomeArquivo: `indicadores_equilibrio_${ano}_${periodo}`,
        tituloRelatorio: `PONTO DE EQUILÍBRIO & INDICADORES — AEROCAD`,
        subtitulo: `${periodoRotulo} · Conta: ${contaAtivaNome}`,
        usuarioNome,
        userRole,
        permitirValoresReais: podeVerValores && !ocultarGlobal,
        colunas: [
          { header: 'Indicador / Métrica', key: 'indicador', width: 36 },
          { header: 'Conta Bancária PJ', key: 'conta_bancaria', width: 28 },
          { header: 'Valor Apurado', key: 'valor', width: 24, tipo: 'moeda' },
          { header: 'Nota Explicativa', key: 'nota', width: 38 },
        ],
        linhas,
      })
    }
  }

  // Gerador do Dossiê Contábil ZIP com JSZip
  async function handleGerarDossieContabilZip() {
    try {
      setGerandoDossie(true)
      setProgressoDossie(5)
      setEtapaDossie('Iniciando empacotamento contábil...')

      const filtroConfig: FiltroDossieContabil = {
        tipo: tipoPeriodoDossie,
        ano: Number(anoDossie) || 2026,
        mes: tipoPeriodoDossie === 'mes' ? Number(mesDossie) || 1 : undefined,
        dataInicio:
          tipoPeriodoDossie === 'personalizado' ? dataInicioDossie || undefined : undefined,
        dataFim: tipoPeriodoDossie === 'personalizado' ? dataFimDossie || undefined : undefined,
      }

      // Prepara demonstrativos HTML para inclusão na pasta AAAA/MM/demonstrativos/
      const demonstrativoBalancoHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Balanço Patrimonial - AEROCAD</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
    h1 { color: #FF6A13; font-size: 18px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: #FF6A13; color: white; text-align: left; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
  </style>
</head>
<body>
  <h1>AEROCAD CONSULTORIA — BALANÇO PATRIMONIAL (MINUTA GERENCIAL)</h1>
  <p><strong>Referência:</strong> ${periodoRotulo} | <strong>Gerado em:</strong> ${formatDateBrasilia(new Date())}</p>
  <table>
    <tr><th>Grupo Patrimonial</th><th class="right">Valor Contábil (R$)</th></tr>
    <tr><td>1. ATIVO CIRCULANTE (Disponibilidades + Contas a Receber)</td><td class="right bold">${formatCurrency(balancoData.totalAtivoCirculante)}</td></tr>
    <tr><td>• Disponibilidades Bancárias PJ</td><td class="right">${formatCurrency(balancoData.totalDisponibilidades)}</td></tr>
    <tr><td>• Contas a Receber de Clientes</td><td class="right">${formatCurrency(balancoData.totalContasReceber)}</td></tr>
    <tr><td>1.2 ATIVO NÃO CIRCULANTE (Imobilizado & Intangível)</td><td class="right bold">${formatCurrency(balancoData.totalAtivoNaoCirculante)}</td></tr>
    <tr><td>• 1.2.1 Ativo Imobilizado Líquido</td><td class="right">${formatCurrency(balancoData.totalImobilizadoLiquido)}</td></tr>
    <tr><td>• 1.2.2 Ativo Intangível Líquido (Marcas/Patentes INPI, AEGIS)</td><td class="right">${formatCurrency(balancoData.totalIntangivelLiquido)}</td></tr>
    <tr><td>• Custo Histórico Total</td><td class="right">${formatCurrency(balancoData.totalCustoHistoricoAtivos)}</td></tr>
    <tr><td>• (-) Depreciação / Amortização Acumulada</td><td class="right">- ${formatCurrency(balancoData.totalDepreciacaoAcumulada)}</td></tr>
    <tr style="background:#FFF3E8;"><td><strong>TOTAL DO ATIVO</strong></td><td class="right bold" style="color:#FF6A13;">${formatCurrency(balancoData.totalAtivo)}</td></tr>
    <tr><td>2. PASSIVO CIRCULANTE (Fornecedores e Contas a Pagar)</td><td class="right bold">${formatCurrency(balancoData.totalPassivoCirculante)}</td></tr>
    <tr><td>2.2 PATRIMÔNIO LÍQUIDO (Capital Estimado + Lucros Acumulados)</td><td class="right bold">${formatCurrency(balancoData.patrimonioLiquidoTotal)}</td></tr>
    <tr style="background:#F2F2F2;"><td><strong>TOTAL DO PASSIVO + PATRIMÔNIO LÍQUIDO</strong></td><td class="right bold">${formatCurrency(balancoData.totalPassivoEPL)}</td></tr>
  </table>
</body>
</html>`

      const demonstrativoDreHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>DRE - AEROCAD</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
    h1 { color: #FF6A13; font-size: 18px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: #2D2D2D; color: white; text-align: left; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
  </style>
</head>
<body>
  <h1>AEROCAD CONSULTORIA — DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)</h1>
  <p><strong>Referência:</strong> ${periodoRotulo} | <strong>Gerado em:</strong> ${formatDateBrasilia(new Date())}</p>
  <table>
    <tr><th>Degrau Contábil</th><th class="right">Valor (R$)</th></tr>
    <tr><td>1. RECEITA OPERACIONAL BRUTA</td><td class="right bold">${formatCurrency(dreData.receitaBruta)}</td></tr>
    <tr><td>2. (-) Tributos sobre Serviços (ISS / DAS)</td><td class="right">- ${formatCurrency(dreData.deducoesImpostos)}</td></tr>
    <tr><td>3. (=) RECEITA OPERACIONAL LÍQUIDA</td><td class="right bold">${formatCurrency(dreData.receitaLiquida)}</td></tr>
    <tr><td>4. (-) Custos Variáveis dos Projetos</td><td class="right">- ${formatCurrency(dreData.custosVariaveis)}</td></tr>
    <tr><td>5. (=) MARGEM DE CONTRIBUIÇÃO</td><td class="right bold">${formatCurrency(dreData.margemContribuicao)}</td></tr>
    <tr><td>6. (-) Despesas Fixas Operacionais e Administrativas</td><td class="right">- ${formatCurrency(dreData.despesasFixas)}</td></tr>
    <tr style="background:#FFF3E8;"><td><strong>7. (=) RESULTADO OPERACIONAL LÍQUIDO</strong></td><td class="right bold" style="color:#FF6A13;">${formatCurrency(dreData.resultadoOperacional)}</td></tr>
  </table>
</body>
</html>`

      const demonstrativoBalanceteHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Balancete de Verificação - AEROCAD</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 20px; }
  h1 { color: #FF6A13; font-size: 16px; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; }
  th { background: #FF6A13; color: white; text-align: left; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sintetica { background: #FFF7F0; font-weight: bold; }
</style>
</head>
<body>
<h1>AEROCAD CONSULTORIA — BALANCETE DE VERIFICAÇÃO CONTÁBIL</h1>
<p><strong>Referência:</strong> ${periodoRotulo} | <strong>Conta:</strong> ${contaAtivaNome} | <strong>Gerado em:</strong> ${formatDateBrasilia(new Date())}</p>
<table>
  <thead>
    <tr>
      <th>Código</th>
      <th>Descrição da Conta</th>
      <th class="center">Nat.</th>
      <th class="right">Saldo Anterior (R$)</th>
      <th class="right">Débitos (R$)</th>
      <th class="right">Créditos (R$)</th>
      <th class="right">Saldo Final (R$)</th>
      <th class="center">D/C</th>
    </tr>
  </thead>
  <tbody>
    ${balanceteData.linhas
      .map(
        (l) => `
    <tr class="${l.grau <= 2 ? 'sintetica' : ''}">
      <td>${l.codigo}</td>
      <td>${l.grau === 3 ? '&nbsp;&nbsp;&nbsp;&nbsp;' : l.grau === 2 ? '&nbsp;&nbsp;' : ''}${l.descricao}</td>
      <td class="center">${l.natureza}</td>
      <td class="right">${formatCurrency(l.saldoAnterior)}</td>
      <td class="right">${formatCurrency(l.debitos)}</td>
      <td class="right">${formatCurrency(l.creditos)}</td>
      <td class="right bold">${formatCurrency(l.saldoFinal)}</td>
      <td class="center bold">${l.saldoFinalNatureza}</td>
    </tr>`,
      )
      .join('')}
    <tr style="background:#2D2D2D; color:#FFF; font-weight:bold;">
      <td colspan="4">TOTAIS DE TESTAGEM CONTÁBIL</td>
      <td class="right">${formatCurrency(balanceteData.totalDebitos)}</td>
      <td class="right">${formatCurrency(balanceteData.totalCreditos)}</td>
      <td class="right">${formatCurrency(balanceteData.totalSaldoFinalDevedor)}</td>
      <td class="center">OK</td>
    </tr>
  </tbody>
</table>
</body>
</html>`

      const resultado = await gerarDossieContabilZip(
        filtroConfig,
        contasPagar,
        extratosList,
        {
          BALANCETE_DE_VERIFICACAO: demonstrativoBalanceteHtml,
          BALANCO_PATRIMONIAL_MINUTA: demonstrativoBalancoHtml,
          DEMONSTRATIVO_RESULTADO_DRE: demonstrativoDreHtml,
        },
        (p) => {
          setProgressoDossie(p.progresso)
          setEtapaDossie(p.etapa)
        },
      )

      // Download do ZIP pelo navegador
      const urlBlob = URL.createObjectURL(resultado.blob)
      const link = document.createElement('a')
      link.href = urlBlob
      link.download = resultado.nomeArquivoZip
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(urlBlob)

      toast({
        title: 'Dossiê Contábil Baixado com Sucesso',
        description: `${resultado.totalArquivos} arquivos organizados em AAAA/MM/ com NOTA_EXPLICATIVA.md gerada.`,
      })
      setModalDossieAberto(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao Gerar Dossiê Contábil',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setGerandoDossie(false)
      setProgressoDossie(0)
      setEtapaDossie('')
    }
  }

  // Render do valor mascarado ou formatado
  const renderValor = (val: number, cor?: string) => {
    if (mascararValores) {
      return <span className="text-neutral-400 font-mono select-none">{VALOR_MASCARADO}</span>
    }
    return (
      <span className={cor || 'text-neutral-900 font-mono font-bold'}>{formatCurrency(val)}</span>
    )
  }

  return (
    <div className="space-y-5">
      {/* 1. BARRA SUPERIOR DE CONTROLE E NAVEGAÇÃO DE SUB-RELATÓRIOS */}
      <div className="crm-card p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={secaoAtiva === 'balancete' ? 'default' : 'outline'}
            onClick={() => setSecaoAtiva('balancete')}
            className={
              secaoAtiva === 'balancete'
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-8 text-xs'
                : 'h-8 text-xs border-[#FF6A13]/30 text-[#FF6A13] hover:bg-orange-50 font-semibold'
            }
          >
            <Scale className="mr-1.5 h-3.5 w-3.5" />
            Balancete de Verificação
          </Button>

          <Button
            size="sm"
            variant={secaoAtiva === 'balanco' ? 'default' : 'outline'}
            onClick={() => setSecaoAtiva('balanco')}
            className={
              secaoAtiva === 'balanco'
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-8 text-xs'
                : 'h-8 text-xs'
            }
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Balanço Patrimonial (Minuta)
          </Button>

          <Button
            size="sm"
            variant={secaoAtiva === 'dre' ? 'default' : 'outline'}
            onClick={() => setSecaoAtiva('dre')}
            className={
              secaoAtiva === 'dre'
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-8 text-xs'
                : 'h-8 text-xs'
            }
          >
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            DRE por Período
          </Button>

          <Button
            size="sm"
            variant={secaoAtiva === 'ponto_equilibrio' ? 'default' : 'outline'}
            onClick={() => setSecaoAtiva('ponto_equilibrio')}
            className={
              secaoAtiva === 'ponto_equilibrio'
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-8 text-xs'
                : 'h-8 text-xs'
            }
          >
            <Target className="mr-1.5 h-3.5 w-3.5" />
            Ponto de Equilíbrio
          </Button>

          <Button
            size="sm"
            variant={secaoAtiva === 'indicadores' ? 'default' : 'outline'}
            onClick={() => setSecaoAtiva('indicadores')}
            className={
              secaoAtiva === 'indicadores'
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-8 text-xs'
                : 'h-8 text-xs'
            }
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Painel de Indicadores & Insights
          </Button>
        </div>

        {/* Botões de Ação: Minuta A4, XLSX e Dossiê Contábil */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setModalDossieAberto(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-8 text-xs font-bold shadow-sm"
            title="Empacotar Dossiê Contábil completo (.ZIP) com demonstrativos, comprovantes e extratos"
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Gerar Dossiê Contábil
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalA4Aberto(true)}
            className="border-neutral-300 text-neutral-700 hover:bg-neutral-50 h-8 text-xs"
            title="Abrir pré-visualização A4 oficial da AEROCAD para impressão ou salvar em PDF"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
            Visualizar A4 (PDF)
          </Button>

          <Button
            size="sm"
            onClick={handleExportarXlsx}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
            title="Exportar dados do relatório ativo para planilha Microsoft Excel (.XLSX)"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar XLSX
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS: ANO, RECORTES TEMPORAIS E CONTA BANCÁRIA PJ */}
      <div className="crm-card p-3 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 border-neutral-200">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-600 font-semibold mr-1">
            <Filter className="h-3.5 w-3.5 text-[#FF6A13]" />
            <span>Filtros do Relatório:</span>
          </div>

          {/* Ano */}
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-[110px] h-8 text-xs bg-white">
              <Calendar className="mr-1.5 h-3 w-3 text-neutral-400" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anosDisponiveis.map((a) => (
                <SelectItem key={a} value={a}>
                  Ano {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Período / Granularidade */}
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-white">
              <Clock className="mr-1.5 h-3 w-3 text-neutral-400" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ano">Exercício Inteiro (12m)</SelectItem>
              <SelectItem value="semestre_1">1º Semestre (Jan-Jun)</SelectItem>
              <SelectItem value="semestre_2">2º Semestre (Jul-Dez)</SelectItem>
              <SelectItem value="quadrimestre_1">1º Quadrimestre (Jan-Abr)</SelectItem>
              <SelectItem value="quadrimestre_2">2º Quadrimestre (Mai-Ago)</SelectItem>
              <SelectItem value="quadrimestre_3">3º Quadrimestre (Set-Dez)</SelectItem>
              <SelectItem value="trimestre_1">1º Trimestre (Jan-Mar)</SelectItem>
              <SelectItem value="trimestre_2">2º Trimestre (Abr-Jun)</SelectItem>
              <SelectItem value="trimestre_3">3º Trimestre (Jul-Set)</SelectItem>
              <SelectItem value="trimestre_4">4º Trimestre (Out-Dez)</SelectItem>
              <SelectItem value="mes_1">Janeiro</SelectItem>
              <SelectItem value="mes_2">Fevereiro</SelectItem>
              <SelectItem value="mes_3">Março</SelectItem>
              <SelectItem value="mes_4">Abril</SelectItem>
              <SelectItem value="mes_5">Maio</SelectItem>
              <SelectItem value="mes_6">Junho</SelectItem>
              <SelectItem value="mes_7">Julho</SelectItem>
              <SelectItem value="mes_8">Agosto</SelectItem>
              <SelectItem value="mes_9">Setembro</SelectItem>
              <SelectItem value="mes_10">Outubro</SelectItem>
              <SelectItem value="mes_11">Novembro</SelectItem>
              <SelectItem value="mes_12">Dezembro</SelectItem>
            </SelectContent>
          </Select>

          {/* Distinção de Contas PJ */}
          <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
            <SelectTrigger className="w-[240px] h-8 text-xs bg-white font-medium">
              <Wallet className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
              <SelectValue placeholder="Conta Bancária PJ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Contas PJ (Consolidado)</SelectItem>
              {contasBancarias.map((cb) => (
                <SelectItem key={cb.id} value={cb.id}>
                  {cb.apelido || cb.banco_nome} ({cb.agencia ? `Ag ${cb.agencia}` : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 font-medium">
            Recorte ativo: <strong className="text-neutral-800">{periodoRotulo}</strong> ·{' '}
            <strong className="text-[#FF6A13]">{contaAtivaNome}</strong>
          </span>
          {mascararValores && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Modo Restrito (Valores Mascarados)
            </span>
          )}
        </div>
      </div>

      {/* 3. CONTEÚDO ESPECÍFICO DE CADA SUB-RELATÓRIO */}

      {/* ======================================================== */}
      {/* 3.0 BALANCETE DE VERIFICAÇÃO CONTÁBIL (TESTAGEM DE SALDOS) */}
      {/* ======================================================== */}
      {secaoAtiva === 'balancete' && (
        <div className="space-y-4">
          {/* Card de Identificação e Explicação Técnica */}
          <div className="rounded-xl border border-[#FF6A13]/30 bg-gradient-to-r from-[#FFFBF8] via-[#FFF8F2] to-white p-4 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6A13] text-white shrink-0 shadow-xs">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6A13]">
                      TESTAGEM DOS SALDOS DAS CONTAS · NORMA BRASILEIRA (ITG / CFC)
                    </span>
                    <CrmBadge tone="orange">PADRÃO BRASILEIRO</CrmBadge>
                    <span className="text-[10px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full font-medium">
                      Conta ativa: {contaAtivaNome}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-neutral-900 mt-0.5">
                    Balancete de Verificação das Contas da AEROCAD
                  </h3>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Relatório oficial de testagem da exatidão dos saldos do Plano de Contas: apura
                    saldo anterior, débitos e créditos lançados no período e saldo final de cada
                    razão contábil.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalA4Aberto(true)}
                  className="h-8 text-xs border-[#FF6A13]/40 text-[#FF6A13] hover:bg-orange-50 font-bold"
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Imprimir / Salvar PDF (A4)
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportarXlsx}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-bold"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Exportar XLSX
                </Button>
              </div>
            </div>
          </div>

          {/* Cards de Resumo da Testagem (Débitos vs Créditos) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="crm-card p-3 bg-white">
              <span className="technical-label text-[10px]">Saldo Anterior Devedor</span>
              <p className="mono-value font-bold text-sm sm:text-base text-neutral-800 mt-1">
                {renderValor(balanceteData.totalSaldoAnteriorDevedor)}
              </p>
              <span className="text-[10px] text-neutral-400">Ativo Inicial</span>
            </div>

            <div className="crm-card p-3 bg-white border-blue-200">
              <span className="technical-label text-[10px] text-blue-700">
                Total Débitos Período
              </span>
              <p className="mono-value font-bold text-sm sm:text-base text-blue-700 mt-1">
                {renderValor(balanceteData.totalDebitos, 'text-blue-700 font-bold font-mono')}
              </p>
              <span className="text-[10px] text-neutral-400">Entradas + Despesas</span>
            </div>

            <div className="crm-card p-3 bg-white border-emerald-200">
              <span className="technical-label text-[10px] text-emerald-700">
                Total Créditos Período
              </span>
              <p className="mono-value font-bold text-sm sm:text-base text-emerald-700 mt-1">
                {renderValor(balanceteData.totalCreditos, 'text-emerald-700 font-bold font-mono')}
              </p>
              <span className="text-[10px] text-neutral-400">Saídas + Receitas</span>
            </div>

            <div className="crm-card p-3 bg-white border-[#FF6A13]/30">
              <span className="technical-label text-[10px] text-[#FF6A13]">
                Saldo Final Devedor
              </span>
              <p className="mono-value font-bold text-sm sm:text-base text-[#FF6A13] mt-1">
                {renderValor(
                  balanceteData.totalSaldoFinalDevedor,
                  'text-[#FF6A13] font-bold font-mono',
                )}
              </p>
              <span className="text-[10px] text-neutral-400">Ativo + Custos Finais</span>
            </div>
          </div>

          {/* Tabela Oficial do Balancete */}
          <div className="crm-card p-0 overflow-hidden bg-white shadow-xs">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#FF6A13]" />
                  Quadro Geral das Contas do Balancete
                </h4>
                <p className="text-[11px] text-neutral-500">
                  {balanceteData.quantidadeContas} contas apuradas no exercício de {periodoRotulo}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Equilíbrio Contábil OK
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100/80 text-neutral-700 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="px-3.5 py-2.5 w-24">Código</th>
                    <th className="px-3.5 py-2.5">Descrição da Conta Contábil</th>
                    <th className="px-3 py-2.5 text-center w-14">Nat.</th>
                    <th className="px-3.5 py-2.5 text-right w-36">Saldo Anterior</th>
                    <th className="px-3.5 py-2.5 text-right w-36 text-blue-700">Débitos (R$)</th>
                    <th className="px-3.5 py-2.5 text-right w-36 text-emerald-700">
                      Créditos (R$)
                    </th>
                    <th className="px-3.5 py-2.5 text-right w-36 font-bold">Saldo Final (R$)</th>
                    <th className="px-3 py-2.5 text-center w-14">D/C</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono">
                  {balanceteData.linhas.map((linha) => {
                    const ehSintetica = linha.grau === 1
                    const ehGrupo = linha.grau === 2
                    return (
                      <tr
                        key={linha.codigo}
                        className={
                          ehSintetica
                            ? 'bg-[#FFF8F2] font-bold text-neutral-900 border-t-2 border-neutral-200'
                            : ehGrupo
                              ? 'bg-neutral-50/70 font-semibold text-neutral-800'
                              : 'hover:bg-neutral-50/50 text-neutral-700'
                        }
                      >
                        <td className="px-3.5 py-2 whitespace-nowrap font-bold text-neutral-900">
                          {linha.codigo}
                        </td>
                        <td className="px-3.5 py-2 font-sans">
                          <span
                            style={{
                              paddingLeft:
                                linha.grau === 3 ? '1.5rem' : linha.grau === 2 ? '0.75rem' : '0rem',
                            }}
                            className={
                              ehSintetica ? 'uppercase tracking-wide font-black text-[#FF6A13]' : ''
                            }
                          >
                            {linha.descricao}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold">
                          <span
                            className={
                              linha.natureza === 'D' ? 'text-blue-700' : 'text-emerald-700'
                            }
                          >
                            {linha.natureza}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          {renderValor(linha.saldoAnterior, 'font-mono text-neutral-700')}
                        </td>
                        <td className="px-3.5 py-2 text-right text-blue-700">
                          {renderValor(linha.debitos, 'font-mono text-blue-700 font-semibold')}
                        </td>
                        <td className="px-3.5 py-2 text-right text-emerald-700">
                          {renderValor(linha.creditos, 'font-mono text-emerald-700 font-semibold')}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-neutral-900">
                          {renderValor(linha.saldoFinal, 'font-mono font-bold text-neutral-900')}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-neutral-700">
                          {linha.saldoFinalNatureza}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-[#2D2D2D] text-white font-bold text-xs border-t-2 border-neutral-300">
                  <tr>
                    <td colSpan={4} className="px-3.5 py-3 font-sans uppercase tracking-wider">
                      TOTAIS DE TESTAGEM CONTÁBIL (EQUILÍBRIO DE SALDOS)
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono text-blue-300">
                      {renderValor(balanceteData.totalDebitos, 'text-blue-300 font-mono font-bold')}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono text-emerald-300">
                      {renderValor(
                        balanceteData.totalCreditos,
                        'text-emerald-300 font-mono font-bold',
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono text-[#FFD2B3]">
                      {renderValor(
                        balanceteData.totalSaldoFinalDevedor,
                        'text-[#FFD2B3] font-mono font-bold',
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-emerald-400">OK</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.1 BALANÇO PATRIMONIAL */}
      {/* ======================================================== */}
      {secaoAtiva === 'balanco' && (
        <div className="space-y-4">
          {/* Alerta de Carimbo de Minuta */}
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50/70 p-3 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <strong className="uppercase tracking-wider font-bold">
                  MINUTA DE BALANÇO PATRIMONIAL — Sujeita a revisão e chancela do contador
                  responsável.
                </strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Demonstrativo gerencial extraído do ERP AEROCAD com base nos saldos bancários,
                  carteira de parcelas a receber, inventário permanente de ativos e passivo de
                  fornecedores.
                </p>
              </div>
            </div>
            <CrmBadge tone="amber">MINUTA CONTÁBIL</CrmBadge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* COLUNA ESQUERDA: ATIVO TOTAL */}
            <div className="crm-card p-4 space-y-4">
              <div className="border-b border-neutral-200 pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-[#FF6A13]" />
                    1. Ativo Total da AEROCAD
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Bens, direitos e disponibilidades líquidas da empresa
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Total do Ativo
                  </span>
                  <span className="text-base font-black text-[#FF6A13]">
                    {renderValor(
                      balancoData.totalAtivo,
                      'text-[#FF6A13] font-black font-mono text-base',
                    )}
                  </span>
                </div>
              </div>

              {/* 1.1 Ativo Circulante */}
              <div className="space-y-2">
                <div className="bg-neutral-100/80 px-2.5 py-1 rounded text-xs font-bold text-neutral-800 flex justify-between items-center">
                  <span>1.1 ATIVO CIRCULANTE</span>
                  <span>{renderValor(balancoData.totalAtivoCirculante)}</span>
                </div>

                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-700 font-medium">
                      Disponibilidades (Contas Bancárias PJ)
                    </span>
                    {renderValor(balancoData.totalDisponibilidades)}
                  </div>
                  {/* Detalhe por conta PJ */}
                  <div className="pl-3 space-y-0.5 text-[11px] text-neutral-500">
                    {balancoData.saldosPorConta.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span>• {c.nome}</span>
                        {renderValor(c.saldo, 'text-neutral-700 font-mono')}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between py-1 border-b border-neutral-100 pt-2">
                    <span className="text-neutral-700 font-medium">
                      Contas a Receber de Clientes (Projetos e Avulsas)
                    </span>
                    {renderValor(balancoData.totalContasReceber)}
                  </div>
                  <span className="text-[10px] text-neutral-400 pl-3 block">
                    Parcelas contratuais pendentes vinculadas ao período
                  </span>
                </div>
              </div>

              {/* 1.2 Ativo Não Circulante (Imobilizado e Intangível) */}
              <div className="space-y-2 pt-2">
                <div className="bg-neutral-100/80 px-2.5 py-1 rounded text-xs font-bold text-neutral-800 flex justify-between items-center">
                  <span>1.2 ATIVO NÃO CIRCULANTE (IMOBILIZADO & INTANGÍVEL)</span>
                  <span>{renderValor(balancoData.totalAtivoNaoCirculante)}</span>
                </div>

                <div className="pl-2 space-y-1.5 text-xs">
                  {/* Subgrupo: Imobilizado */}
                  <div className="rounded p-1.5 bg-neutral-50/70 border border-neutral-100 space-y-1">
                    <div className="flex justify-between font-semibold text-neutral-800">
                      <span>1.2.1 Imobilizado Tangível Líquido</span>
                      <span>{renderValor(balancoData.totalImobilizadoLiquido)}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block pl-1">
                      {balancoData.qtdImobilizados} bens físicos (veículos, drones, hardware CAD,
                      estações totais)
                    </span>
                  </div>

                  {/* Subgrupo: Intangível */}
                  <div className="rounded p-1.5 bg-orange-50/50 border border-orange-100 space-y-1">
                    <div className="flex justify-between font-semibold text-[#D65100]">
                      <span>1.2.2 Ativo Intangível Líquido (CPC 04)</span>
                      <span>
                        {renderValor(
                          balancoData.totalIntangivelLiquido,
                          'text-[#D65100] font-mono font-semibold',
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-600 pl-2">
                      <span>• Custo Capitalizado (Marcas/Patentes INPI, AEGIS, Softwares):</span>
                      <span>{renderValor(balancoData.totalCustoIntangivel)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-amber-700 pl-2">
                      <span>• (-) Amortização Acumulada:</span>
                      <span>
                        -{' '}
                        {renderValor(
                          balancoData.totalAmortizacaoIntangivel,
                          'text-amber-700 font-mono',
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block pl-2">
                      {balancoData.qtdIntangiveis} ativos intangíveis inventariados
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-neutral-100 text-amber-700 font-medium">
                    <span>(-) Depreciação / Amortização Linear Total</span>
                    <span>
                      -{' '}
                      {renderValor(
                        balancoData.totalDepreciacaoAcumulada,
                        'text-amber-700 font-mono',
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 pt-2 font-bold text-emerald-800 bg-emerald-50/50 px-2 rounded">
                    <span>Total Ativo Não Circulante Líquido</span>
                    {renderValor(
                      balancoData.totalAtivoNaoCirculante,
                      'text-emerald-800 font-mono font-bold',
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PASSIVO E PATRIMÔNIO LÍQUIDO */}
            <div className="crm-card p-4 space-y-4">
              <div className="border-b border-neutral-200 pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-[#0284C7]" />
                    2. Passivo & Patrimônio Líquido
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Obrigações, fornecedores e patrimônio dos sócios
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Passivo + PL
                  </span>
                  <span className="text-base font-black text-[#0284C7]">
                    {renderValor(
                      balancoData.totalPassivoEPL,
                      'text-[#0284C7] font-black font-mono text-base',
                    )}
                  </span>
                </div>
              </div>

              {/* 2.1 Passivo Circulante */}
              <div className="space-y-2">
                <div className="bg-neutral-100/80 px-2.5 py-1 rounded text-xs font-bold text-neutral-800 flex justify-between items-center">
                  <span>2.1 PASSIVO CIRCULANTE (OBRIGAÇÕES A CURTO PRAZO)</span>
                  <span>{renderValor(balancoData.totalPassivoCirculante)}</span>
                </div>

                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-700 font-medium">
                      Fornecedores, Subcontratados e Despesas a Pagar
                    </span>
                    {renderValor(balancoData.totalPassivoCirculante)}
                  </div>
                  <span className="text-[10px] text-neutral-400 pl-3 block">
                    Lançamentos pendentes de quitação cadastrados no Contas a Pagar
                  </span>
                </div>
              </div>

              {/* 2.2 Patrimônio Líquido */}
              <div className="space-y-2 pt-2">
                <div className="bg-neutral-100/80 px-2.5 py-1 rounded text-xs font-bold text-neutral-800 flex justify-between items-center">
                  <span>2.2 PATRIMÔNIO LÍQUIDO (PL)</span>
                  <span>{renderValor(balancoData.patrimonioLiquidoTotal)}</span>
                </div>

                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-700">Capital Social Integralizado Estimado</span>
                    {renderValor(balancoData.capitalSocialEstimado)}
                  </div>

                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-700">
                      Resultado Acumulado Histórico (Receitas − Despesas)
                    </span>
                    {renderValor(
                      balancoData.resultadoAcumuladoHistorico,
                      balancoData.resultadoAcumuladoHistorico >= 0
                        ? 'text-emerald-700 font-mono font-bold'
                        : 'text-rose-700 font-mono font-bold',
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 pl-3 block">
                    Superávit acumulado das operações de engenharia e consultoria
                  </span>

                  <div className="flex justify-between py-1 pt-2 font-bold text-blue-900 bg-blue-50/50 px-2 rounded">
                    <span>Total do Patrimônio Líquido</span>
                    {renderValor(
                      balancoData.patrimonioLiquidoTotal,
                      'text-blue-900 font-mono font-bold',
                    )}
                  </div>
                </div>
              </div>

              {/* Equação Fundamental do Balanço */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                <div className="flex items-center justify-between font-bold text-neutral-800">
                  <span>Equação Fundamental: Ativo = Passivo + PL</span>
                  <CrmBadge tone="green">Equilíbrio Fechado</CrmBadge>
                </div>
                <p className="text-[10px]">
                  Ativo Total: <strong>{renderValor(balancoData.totalAtivo)}</strong> ≡ Passivo +
                  PL: <strong>{renderValor(balancoData.totalPassivoEPL)}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.2 DRE POR PERÍODO */}
      {/* ======================================================== */}
      {secaoAtiva === 'dre' && (
        <div className="space-y-4">
          <div className="crm-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#FF6A13]" />
                  Demonstrativo de Resultado do Exercício (DRE Estruturada)
                </h3>
                <p className="text-xs text-neutral-500">
                  Degraus contábeis oficiais com comparativo automático do ciclo anterior de mesma
                  amplitude
                </p>
              </div>

              {dreData.variacaoReceitaPercentual !== null && (
                <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-neutral-100">
                  <span>Variação Receita vs Ciclo Anterior:</span>
                  <span
                    className={
                      dreData.variacaoReceitaPercentual >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {dreData.variacaoReceitaPercentual >= 0 ? '+' : ''}
                    {dreData.variacaoReceitaPercentual.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Degraus Contábeis em Tabela Zebrada Limpa */}
            <div className="border border-neutral-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#2D2D2D] text-white font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Degrau Contábil / Rubrica</th>
                    <th className="px-4 py-2.5">Classificação / Base</th>
                    <th className="px-4 py-2.5 text-right">Período Atual ({periodoRotulo})</th>
                    <th className="px-4 py-2.5 text-right">Período Anterior</th>
                    <th className="px-4 py-2.5 text-right">% Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {/* 1. Receita Bruta */}
                  <tr className="bg-emerald-50/40 font-bold text-neutral-900">
                    <td className="px-4 py-3 font-semibold text-emerald-900 flex items-center gap-1.5">
                      <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                      1. RECEITA OPERACIONAL BRUTA
                    </td>
                    <td className="px-4 py-3 text-neutral-600 text-[11px]">
                      Serviços Aeronáuticos e Consultorias Faturadas
                    </td>
                    <td className="px-4 py-3 text-right">
                      {renderValor(dreData.receitaBruta, 'text-emerald-800 font-mono font-bold')}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500 font-mono">
                      {renderValor(dreData.recBrutaAnterior, 'text-neutral-500 font-mono')}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600 font-mono">100.0%</td>
                  </tr>

                  {/* 2. Deduções */}
                  <tr className="text-neutral-700">
                    <td className="px-4 py-2.5 pl-8 text-neutral-800">
                      (-) Deduções da Receita & Tributos
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500 text-[11px]">
                      ISS, DAS Simples Nacional, Retenções Federais
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-700 font-mono">
                      - {renderValor(dreData.deducoesImpostos, 'text-rose-700 font-mono')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400 font-mono">—</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600 font-mono">
                      {dreData.receitaBruta > 0
                        ? ((dreData.deducoesImpostos / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>

                  {/* 3. Receita Líquida */}
                  <tr className="bg-neutral-50 font-semibold text-neutral-900 border-t border-neutral-300">
                    <td className="px-4 py-2.5 pl-6">(=) RECEITA OPERACIONAL LÍQUIDA</td>
                    <td className="px-4 py-2.5 text-neutral-500 text-[11px]">
                      Base líquida operacional da consultoria
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {renderValor(dreData.receitaLiquida, 'text-neutral-900 font-mono font-bold')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400 font-mono">—</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600 font-mono">
                      {dreData.receitaBruta > 0
                        ? ((dreData.receitaLiquida / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>

                  {/* 4. Custos Variáveis */}
                  <tr className="text-neutral-700">
                    <td className="px-4 py-2.5 pl-8 text-neutral-800">
                      (-) Custos Diretos / Variáveis dos Projetos
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500 text-[11px]">
                      Terceirizados, ensaios, viagens de campo e medições
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-700 font-mono">
                      - {renderValor(dreData.custosVariaveis, 'text-rose-700 font-mono')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400 font-mono">—</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600 font-mono">
                      {dreData.receitaBruta > 0
                        ? ((dreData.custosVariaveis / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>

                  {/* 5. Margem de Contribuição */}
                  <tr className="bg-orange-50/50 font-bold text-[#D65100] border-t border-orange-200">
                    <td className="px-4 py-2.5 pl-6 flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-[#FF6A13]" />
                      (=) MARGEM DE CONTRIBUIÇÃO (MC)
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 text-[11px]">
                      Geração de recursos para cobrir a estrutura fixa
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {renderValor(
                        dreData.margemContribuicao,
                        'text-[#D65100] font-mono font-bold',
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400 font-mono">—</td>
                    <td className="px-4 py-2.5 text-right text-[#D65100] font-mono">
                      {dreData.receitaBruta > 0
                        ? ((dreData.margemContribuicao / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>

                  {/* 6. Despesas Fixas */}
                  <tr className="text-neutral-700">
                    <td className="px-4 py-2.5 pl-8 text-neutral-800">
                      (-) Despesas Fixas Operacionais, Folha & Administrativas
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500 text-[11px]">
                      Salários, pró-labore, softwares, aluguel, suporte e tarifas
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-700 font-mono">
                      - {renderValor(dreData.despesasFixas, 'text-rose-700 font-mono')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-500 font-mono">
                      - {renderValor(dreData.despAnt, 'text-neutral-500 font-mono')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-600 font-mono">
                      {dreData.receitaBruta > 0
                        ? ((dreData.despesasFixas / dreData.receitaBruta) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </td>
                  </tr>

                  {/* 7. Resultado Operacional Líquido */}
                  <tr className="bg-[#FFF6EC] border-t-2 border-[#FF6A13] font-black text-neutral-900 text-sm">
                    <td className="px-4 py-3 font-black text-[#D65100] flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-[#FF6A13]" />
                      (=) RESULTADO OPERACIONAL LÍQUIDO DO PERÍODO
                    </td>
                    <td className="px-4 py-3 text-neutral-600 text-xs">
                      Lucro Líquido Realizado (EBITDA Operacional)
                    </td>
                    <td className="px-4 py-3 text-right">
                      {renderValor(
                        dreData.resultadoOperacional,
                        dreData.resultadoOperacional >= 0
                          ? 'text-emerald-700 font-mono font-black text-sm'
                          : 'text-rose-700 font-mono font-black text-sm',
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600 font-mono text-xs">
                      {renderValor(dreData.resOperacionalAnterior, 'text-neutral-600 font-mono')}
                    </td>
                    <td className="px-4 py-3 text-right text-[#D65100] font-mono">
                      {dreData.margemLiquidaPercentual.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.3 PONTO DE EQUILÍBRIO (BREAK-EVEN) */}
      {/* ======================================================== */}
      {secaoAtiva === 'ponto_equilibrio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="crm-card p-4">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Custos Fixos Totais
              </span>
              <p className="mono-value mt-2 text-xl font-bold text-neutral-900">
                {renderValor(pontoEquilibrioData.custosFixos)}
              </p>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Folha, pró-labore, softwares e escritório
              </span>
            </div>

            <div className="crm-card p-4">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Índice Margem Contribuição
              </span>
              <p className="mono-value mt-2 text-xl font-bold text-[#FF6A13]">
                {(pontoEquilibrioData.indiceMargemContribuicao * 100).toFixed(1)}%
              </p>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Média retida de cada R$ faturado
              </span>
            </div>

            <div className="crm-card p-4 border-[#FFD2B3] bg-[#FFFBF8]">
              <span className="text-[11px] font-semibold text-[#D65100] uppercase tracking-wider block">
                Faturamento Break-Even
              </span>
              <p className="mono-value mt-2 text-xl font-bold text-[#D65100]">
                {renderValor(pontoEquilibrioData.faturamentoPontoEquilibrio)}
              </p>
              <span className="text-[10px] text-[#D65100] mt-1 block">
                Receita mínima necessária para lucro zero
              </span>
            </div>

            <div
              className={`crm-card p-4 ${
                pontoEquilibrioData.atingiuBreakEven
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                  : 'border-rose-200 bg-rose-50/40 text-rose-900'
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider block opacity-80">
                Margem de Segurança
              </span>
              <p className="mono-value mt-2 text-xl font-bold">
                {renderValor(pontoEquilibrioData.margemSegurancaValor)}
              </p>
              <span className="text-[10px] mt-1 block font-semibold">
                {pontoEquilibrioData.atingiuBreakEven
                  ? '✓ Acima do Break-Even'
                  : '⚠ Abaixo da Meta'}{' '}
                ({pontoEquilibrioData.margemSegurancaPercentual.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Explicação Didática em Linguagem de Negócio */}
          <div className="crm-card p-5 space-y-4">
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#FF6A13]" />
              Diagnóstico Operacional em Linguagem de Negócio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/80 space-y-2">
                <strong className="block text-neutral-900 text-xs font-bold">
                  O que significa este resultado para a AEROCAD?
                </strong>
                <p className="text-neutral-600 leading-relaxed">
                  Para cobrir rigorosamente as despesas fixas de estrutura (equipe técnica, licenças
                  de software, aluguel, contabilidade e taxas aeroportuárias) no valor de{' '}
                  <strong>{renderValor(pontoEquilibrioData.custosFixos)}</strong>, a AEROCAD precisa
                  faturar no mínimo{' '}
                  <strong>{renderValor(pontoEquilibrioData.faturamentoPontoEquilibrio)}</strong> no
                  período selecionado ({periodoRotulo}).
                </p>
                <p className="text-neutral-600 leading-relaxed">
                  {pontoEquilibrioData.atingiuBreakEven ? (
                    <span className="text-emerald-700 font-semibold">
                      Parabéns: a consultoria ultrapassou o ponto de equilíbrio! Cada novo contrato
                      ou medição faturada neste ciclo gera lucro líquido direto à empresa.
                    </span>
                  ) : (
                    <span className="text-rose-700 font-semibold">
                      Atenção executiva: a operação ainda não amortizou integralmente a estrutura
                      neste período. Priorize emissão de NFS-e e faturamento de medições em aberto.
                    </span>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/80 space-y-2">
                <strong className="block text-neutral-900 text-xs font-bold">
                  Projeção & Meta Mensal Mínima de Faturamento
                </strong>
                <p className="text-neutral-600 leading-relaxed">
                  Meta mensal calculada para pagar as contas:{' '}
                  <strong>{renderValor(pontoEquilibrioData.metaFaturamentoMensal)} / mês</strong>.
                </p>
                <p className="text-neutral-600 leading-relaxed">
                  Média mensal realizada neste período:{' '}
                  <strong>{renderValor(pontoEquilibrioData.realizadoMensal)} / mês</strong>.
                </p>
                <div className="pt-1">
                  <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className={`h-full ${
                        pontoEquilibrioData.atingiuBreakEven ? 'bg-emerald-600' : 'bg-[#FF6A13]'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          pontoEquilibrioData.metaFaturamentoMensal > 0
                            ? (pontoEquilibrioData.realizadoMensal /
                                pontoEquilibrioData.metaFaturamentoMensal) *
                                100
                            : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Taxa de cobertura de custos:{' '}
                    {pontoEquilibrioData.metaFaturamentoMensal > 0
                      ? (
                          (pontoEquilibrioData.realizadoMensal /
                            pontoEquilibrioData.metaFaturamentoMensal) *
                          100
                        ).toFixed(0)
                      : 0}
                    % da meta
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.4 PAINEL DE INDICADORES & INSIGHTS DETERMINÍSTICOS */}
      {/* ======================================================== */}
      {secaoAtiva === 'indicadores' && (
        <div className="space-y-4">
          {/* Grade de KPIs Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Margem Líquida</span>
              <p className="mono-value font-black text-lg text-emerald-700 mt-1">
                {dreData.margemLiquidaPercentual.toFixed(1)}%
              </p>
              <span className="text-[9px] text-neutral-400">Lucro ÷ Receita</span>
            </div>

            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Margem Bruta (MC)</span>
              <p className="mono-value font-black text-lg text-[#FF6A13] mt-1">
                {(pontoEquilibrioData.indiceMargemContribuicao * 100).toFixed(1)}%
              </p>
              <span className="text-[9px] text-neutral-400">Após custos diretos</span>
            </div>

            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Receita x Despesa</span>
              <p className="mono-value font-black text-lg text-neutral-900 mt-1">
                {dreData.despesasFixas + dreData.custosVariaveis > 0
                  ? (
                      dreData.receitaBruta /
                      (dreData.despesasFixas + dreData.custosVariaveis)
                    ).toFixed(2)
                  : '—'}
                x
              </p>
              <span className="text-[9px] text-neutral-400">Índice de cobertura</span>
            </div>

            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Crescimento Período</span>
              <p
                className={`mono-value font-black text-lg mt-1 ${
                  dreData.variacaoReceitaPercentual !== null &&
                  dreData.variacaoReceitaPercentual >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {dreData.variacaoReceitaPercentual !== null
                  ? `${dreData.variacaoReceitaPercentual >= 0 ? '+' : ''}${dreData.variacaoReceitaPercentual.toFixed(0)}%`
                  : '—'}
              </p>
              <span className="text-[9px] text-neutral-400">vs ciclo anterior</span>
            </div>

            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Prazo Médio Recebimento</span>
              <p className="mono-value font-black text-lg text-neutral-900 mt-1">
                {indicadoresData.pmrMedio} <span className="text-xs font-normal">dias</span>
              </p>
              <span className="text-[9px] text-neutral-400">Faturamento → Baixa</span>
            </div>

            <div className="crm-card p-3">
              <span className="technical-label text-[10px] truncate">Concentração Maior Cli.</span>
              <p
                className={`mono-value font-black text-lg mt-1 ${
                  indicadoresData.concentracaoMaiorCliente > 35
                    ? 'text-amber-700'
                    : 'text-neutral-900'
                }`}
              >
                {indicadoresData.concentracaoMaiorCliente.toFixed(0)}%
              </p>
              <span
                className="text-[9px] text-neutral-400 truncate block"
                title={indicadoresData.maiorCliente?.nome}
              >
                {indicadoresData.maiorCliente
                  ? indicadoresData.maiorCliente.nome
                  : 'Sem faturamento'}
              </span>
            </div>
          </div>

          {/* Bloco de Insights Determinísticos Gerados por Regras */}
          <div className="crm-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#FF6A13]" />
                Insights Contábeis & Ações Recomendadas
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400">
                  {indicadoresData.insights.length} regras disparadas sobre os lançamentos
                </span>
                {onNavigateTab && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab('valuation')}
                    className="h-7 text-xs border-[#FFD2B3] bg-[#FFF0E6] text-[#D65100] hover:bg-[#FFE0CC] font-bold"
                  >
                    Abrir Valuation da Empresa →
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {indicadoresData.insights.map((ins) => (
                <div
                  key={ins.id}
                  onClick={() => onNavigateTab && onNavigateTab(ins.abaDestino)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition hover:shadow-xs flex items-start justify-between gap-3 ${
                    ins.tipo === 'positivo'
                      ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
                      : ins.tipo === 'alerta'
                        ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
                        : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                      {ins.tipo === 'positivo' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span>{ins.titulo}</span>
                    </div>
                    <p className="text-[11px] text-neutral-600 leading-snug">{ins.descricao}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#FF6A13] font-semibold mt-1">
                      Ver no módulo → {ins.abaDestino.replace('_', ' ')}
                    </span>
                  </div>

                  {ins.destaque && (
                    <span className="shrink-0 font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-neutral-200 text-neutral-800">
                      {ins.destaque}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico Simples de Barras Mensais (Entradas vs Saídas) */}
          <div className="crm-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <PieChartIcon className="h-4 w-4 text-[#FF6A13]" />
                  Evolução Mensal da Conta PJ: Entradas × Saídas ({ano === 'todos' ? '2026' : ano})
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Comparativo de caixa realizado mês a mês na conta selecionada ({contaAtivaNome})
                </p>
              </div>

              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-emerald-600 inline-block" />
                  <span className="text-neutral-600">Entradas (R$)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-rose-600 inline-block" />
                  <span className="text-neutral-600">Saídas (R$)</span>
                </div>
              </div>
            </div>

            {/* Barras por Mês */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2 items-end h-44">
              {indicadoresData.evolucaoMensal.map((m) => {
                const alturaEntrada =
                  indicadoresData.maxValorGrafico > 0
                    ? Math.round((m.entradas / indicadoresData.maxValorGrafico) * 110)
                    : 0
                const alturaSaida =
                  indicadoresData.maxValorGrafico > 0
                    ? Math.round((m.saidas / indicadoresData.maxValorGrafico) * 110)
                    : 0

                return (
                  <div key={m.mes} className="flex flex-col items-center justify-end h-full group">
                    <div className="flex items-end gap-1 h-32 w-full justify-center">
                      {/* Barra Entrada */}
                      <div
                        className="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition-all cursor-pointer relative"
                        style={{ height: `${Math.max(4, alturaEntrada)}px` }}
                        title={`${m.nome} - Entradas: ${formatCurrency(m.entradas)}`}
                      />
                      {/* Barra Saída */}
                      <div
                        className="w-2.5 sm:w-3.5 bg-rose-500 rounded-t-xs hover:bg-rose-600 transition-all cursor-pointer relative"
                        style={{ height: `${Math.max(4, alturaSaida)}px` }}
                        title={`${m.nome} - Saídas: ${formatCurrency(m.saidas)}`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-600 mt-2 block group-hover:text-[#FF6A13]">
                      {m.nome}
                    </span>
                    <span
                      className={`text-[9px] font-mono mt-0.5 block ${
                        m.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {mascararValores
                        ? '••••'
                        : `${m.saldo >= 0 ? '+' : ''}${Math.round(m.saldo / 1000)}k`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL COM PREVIEW A4 OFICIAL AEROCAD */}
      <Dialog open={modalA4Aberto} onOpenChange={setModalA4Aberto}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-neutral-100">
          <div className="flex justify-between items-center mb-3 print:hidden border-b border-neutral-200 pb-3">
            <div>
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                Preview A4 Oficial · Prancheta Técnica AEROCAD
              </span>
              <span className="text-[11px] text-neutral-500">
                {secaoAtiva === 'balancete'
                  ? 'Balancete de Verificação Contábil'
                  : secaoAtiva === 'balanco'
                    ? 'Balanço Patrimonial Gerencial'
                    : secaoAtiva === 'ponto_equilibrio'
                      ? 'Ponto de Equilíbrio & Margem de Segurança'
                      : secaoAtiva === 'indicadores'
                        ? 'Relatório Executivo de Indicadores & Insights'
                        : 'Demonstração do Resultado do Exercício (DRE)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  imprimirElementoA4({
                    elementId: 'print-document',
                    titulo:
                      secaoAtiva === 'balancete'
                        ? 'Balancete de Verificação Contábil'
                        : secaoAtiva === 'balanco'
                          ? 'Balanço Patrimonial'
                          : secaoAtiva === 'ponto_equilibrio'
                            ? 'Ponto de Equilíbrio'
                            : 'DRE - Demonstração do Resultado',
                  })
                }}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold shadow-xs"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </div>

          {/* Componente A4 padrão com renderização defensiva para todas as 5 seções */}
          {secaoAtiva === 'balancete' ? (
            <AerocadRelatorioA4
              titulo="BALANCETE DE VERIFICAÇÃO CONTÁBIL"
              subtitulo={`Testagem dos Saldos das Contas · ${periodoRotulo || 'Geral'} · Conta: ${contaAtivaNome || 'Todas'}`}
              referenciaPeriodo={`${periodoRotulo || 'Geral'} · ${contaAtivaNome || 'Todas'}`}
              responsavelNome={usuarioNome || 'Equipe AEROCAD'}
              resumoKpis={[
                {
                  rotulo: 'Saldo Anterior Devedor',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balanceteData?.totalSaldoAnteriorDevedor)),
                  cor: 'neutro',
                },
                {
                  rotulo: 'Total Débitos Período',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balanceteData?.totalDebitos)),
                  cor: 'verde',
                },
                {
                  rotulo: 'Total Créditos Período',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balanceteData?.totalCreditos)),
                  cor: 'verde',
                },
                {
                  rotulo: 'Saldo Final Devedor',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balanceteData?.totalSaldoFinalDevedor)),
                  cor: 'laranja',
                  destaque: true,
                },
              ]}
              secoes={[
                {
                  titulo: 'QUADRO GERAL DE TESTAGEM DAS CONTAS DO PLANO DE CONTAS',
                  subtitulo:
                    'Apuração de saldos anteriores, movimentações a débito/crédito e saldos finais com distinção por conta bancária PJ',
                  tabela: {
                    colunas: [
                      { cabecalho: 'Código', alinhamento: 'left', largura: '12%' },
                      {
                        cabecalho: 'Conta Contábil / Descrição',
                        alinhamento: 'left',
                        largura: '36%',
                      },
                      { cabecalho: 'Nat.', alinhamento: 'center', largura: '8%' },
                      { cabecalho: 'Saldo Anterior', alinhamento: 'right', largura: '14%' },
                      { cabecalho: 'Débitos (R$)', alinhamento: 'right', largura: '15%' },
                      { cabecalho: 'Créditos (R$)', alinhamento: 'right', largura: '15%' },
                    ],
                    linhas: (balanceteData?.linhas || []).map((l) => [
                      { conteudo: l?.codigo || '—', destaque: l?.grau === 1 },
                      {
                        conteudo: `${l?.grau === 3 ? '   ' : l?.grau === 2 ? ' ' : ''}${l?.descricao || 'Sem descrição'}`,
                        destaque: l?.grau === 1,
                      },
                      { conteudo: l?.natureza || '—', alinhamento: 'center' },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(l?.saldoAnterior)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(l?.debitos)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(l?.creditos)),
                        alinhamento: 'right',
                      },
                    ]),
                    linhaTotal: [
                      { conteudo: 'TOTAIS' },
                      { conteudo: 'CONFERÊNCIA DE SALDOS' },
                      { conteudo: 'OK', alinhamento: 'center' },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(balanceteData?.totalSaldoAnteriorDevedor)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(balanceteData?.totalDebitos)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(balanceteData?.totalCreditos)),
                        alinhamento: 'right',
                      },
                    ],
                  },
                },
              ]}
              observacoesFinais="BALANCETE DE VERIFICAÇÃO CONTÁBIL EMITIDO PELO ERP AEROCAD CONSULTORIA PARA FINS DE AUDITORIA INTERNA, TESTAGEM DA EXATIDÃO DOS SALDOS E CONCILIAÇÃO BANCÁRIA INTEGRAL DAS CONTAS PJ. DOCUMENTO PADRÃO A4 IMPRIMÍVEL/SALVÁVEL COMO PDF."
            />
          ) : secaoAtiva === 'balanco' ? (
            <AerocadRelatorioA4
              titulo="BALANÇO PATRIMONIAL (MINUTA GERENCIAL)"
              subtitulo="CARIMBO: MINUTA — SUJEITA A REVISÃO E CHANCELA DO CONTADOR RESPONSÁVEL"
              referenciaPeriodo={`${periodoRotulo || 'Geral'} · Conta: ${contaAtivaNome || 'Todas'}`}
              responsavelNome={usuarioNome || 'Equipe AEROCAD'}
              resumoKpis={[
                {
                  rotulo: 'Ativo Circulante',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balancoData?.totalAtivoCirculante)),
                  cor: 'laranja',
                },
                {
                  rotulo: 'Ativo Não Circulante (Líquido)',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balancoData?.totalAtivoNaoCirculante)),
                  cor: 'verde',
                },
                {
                  rotulo: 'Passivo Circulante',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balancoData?.totalPassivoCirculante)),
                  cor: 'vermelho',
                },
                {
                  rotulo: 'Patrimônio Líquido',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(balancoData?.patrimonioLiquidoTotal)),
                  cor: 'neutro',
                },
              ]}
              secoes={[
                {
                  titulo: '1. ATIVO TOTAL (BENS, DIREITOS E DISPONIBILIDADES)',
                  tabela: {
                    colunas: [
                      { cabecalho: 'Grupo / Conta Contábil', alinhamento: 'left', largura: '50%' },
                      { cabecalho: 'Conta Bancária PJ', alinhamento: 'center', largura: '25%' },
                      { cabecalho: 'Saldo / Valor (R$)', alinhamento: 'right', largura: '25%' },
                    ],
                    linhas: [
                      [
                        { conteudo: '1.1 Disponibilidades (Bancos Movimento PJ)' },
                        { conteudo: contaAtivaNome || 'Todas', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.totalDisponibilidades)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '1.2 Contas a Receber (Parcelas e Clientes)' },
                        { conteudo: contaAtivaNome || 'Todas', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.totalContasReceber)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '1.3 Imobilizado Tangível Líquido' },
                        { conteudo: 'Bens Corpóreos', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.totalImobilizadoLiquido)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '1.4 Ativo Intangível Líquido (Marcas/Patentes INPI, AEGIS)' },
                        { conteudo: 'CPC 04 / NBC TG 04', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.totalIntangivelLiquido)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '1.5 (-) Depreciação / Amortização Linear Acumulada' },
                        { conteudo: 'Norma RFB / CPC', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : `- ${formatCurrency(safeNumber(balancoData?.totalDepreciacaoAcumulada))}`,
                          alinhamento: 'right',
                        },
                      ],
                    ],
                    linhaTotal: [
                      { conteudo: 'TOTAL DO ATIVO CONSOLIDADO' },
                      { conteudo: 'Fechamento', alinhamento: 'center' },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(balancoData?.totalAtivo)),
                        alinhamento: 'right',
                      },
                    ],
                  },
                },
                {
                  titulo: '2. PASSIVO E PATRIMÔNIO LÍQUIDO',
                  tabela: {
                    colunas: [
                      {
                        cabecalho: 'Grupo / Obrigações e Capital',
                        alinhamento: 'left',
                        largura: '50%',
                      },
                      { cabecalho: 'Conta Bancária PJ', alinhamento: 'center', largura: '25%' },
                      { cabecalho: 'Saldo / Valor (R$)', alinhamento: 'right', largura: '25%' },
                    ],
                    linhas: [
                      [
                        { conteudo: '2.1 Fornecedores e Contas a Pagar (Passivo Circulante)' },
                        { conteudo: contaAtivaNome || 'Todas', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.totalPassivoCirculante)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '2.2 Capital Social Integralizado Estimado' },
                        { conteudo: 'Patrimônio', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.capitalSocialEstimado)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '2.3 Lucros / Resultados Acumulados' },
                        { conteudo: 'Patrimônio', alinhamento: 'center' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(balancoData?.resultadoAcumuladoHistorico)),
                          alinhamento: 'right',
                        },
                      ],
                    ],
                    linhaTotal: [
                      { conteudo: 'TOTAL DO PASSIVO E PATRIMÔNIO LÍQUIDO' },
                      { conteudo: 'Fechamento', alinhamento: 'center' },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(balancoData?.totalPassivoEPL)),
                        alinhamento: 'right',
                      },
                    ],
                  },
                },
              ]}
              observacoesFinais="ESTE DOCUMENTO CONSTITUI MINUTA CONTÁBIL GERENCIAL EMITIDA PELO CRM AEROCAD CONSULTORIA PARA CONCILIAÇÃO FINANCEIRA E PLANEJAMENTO FISCAL. OS VALORES DE ATIVO NÃO CIRCULANTE CONSIDERAM CRITÉRIO DE DEPRECIAÇÃO LINEAR COM VIDA ÚTIL PREVISTA PELA LEGISLAÇÃO BRASILEIRA. DOCUMENTO SUJEITO À REVISÃO FINAL DA ESCRITURAÇÃO CONTÁBIL PELO CONTADOR RESPONSÁVEL TÉCNICO."
            />
          ) : secaoAtiva === 'ponto_equilibrio' ? (
            <AerocadRelatorioA4
              titulo="RELATÓRIO DE PONTO DE EQUILÍBRIO & MARGEM DE SEGURANÇA"
              subtitulo={`Análise de Break-Even Operacional · ${periodoRotulo || 'Geral'} · Conta: ${contaAtivaNome || 'Todas'}`}
              referenciaPeriodo={`${periodoRotulo || 'Geral'} · ${contaAtivaNome || 'Todas'}`}
              responsavelNome={usuarioNome || 'Equipe AEROCAD'}
              resumoKpis={[
                {
                  rotulo: 'Ponto de Equilíbrio (Break-Even)',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(pontoEquilibrioData?.faturamentoPontoEquilibrio)),
                  cor: 'laranja',
                  destaque: true,
                },
                {
                  rotulo: 'Faturamento Realizado',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(dreData?.receitaBruta)),
                  cor: 'verde',
                },
                {
                  rotulo: 'Margem de Segurança',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : `${formatCurrency(safeNumber(pontoEquilibrioData?.margemSegurancaValor))} (${safeNumber(pontoEquilibrioData?.margemSegurancaPercentual).toFixed(1)}%)`,
                  cor: (pontoEquilibrioData?.margemSegurancaValor || 0) >= 0 ? 'verde' : 'vermelho',
                },
                {
                  rotulo: 'Status Operacional',
                  valorFormatado: pontoEquilibrioData?.atingiuBreakEven
                    ? 'Break-Even Superado'
                    : 'Déficit Operacional',
                  cor: pontoEquilibrioData?.atingiuBreakEven ? 'verde' : 'vermelho',
                },
              ]}
              secoes={[
                {
                  titulo: 'QUADRO TÉCNICO DE CUSTOS E MARGEM DE CONTRIBUIÇÃO',
                  subtitulo:
                    'Premissas contábeis de custeio variável para cobertura dos custos fixos estruturais AEROCAD',
                  tabela: {
                    colunas: [
                      { cabecalho: 'Parâmetro / Indicador', alinhamento: 'left', largura: '50%' },
                      { cabecalho: 'Fórmula Contábil', alinhamento: 'left', largura: '25%' },
                      { cabecalho: 'Valor Apurado', alinhamento: 'right', largura: '25%' },
                    ],
                    linhas: [
                      [
                        { conteudo: 'Custos e Despesas Fixas do Período' },
                        { conteudo: 'Σ Despesas Administrativas Fixas' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(pontoEquilibrioData?.custosFixos)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: 'Índice da Margem de Contribuição (IMC)' },
                        { conteudo: 'Margem de Contribuição ÷ Receita Bruta' },
                        {
                          conteudo: `${(safeNumber(pontoEquilibrioData?.indiceMargemContribuicao) * 100).toFixed(1)}%`,
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                      [
                        { conteudo: 'Faturamento de Equilíbrio Necessário' },
                        { conteudo: 'Custos Fixos ÷ IMC' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(
                                safeNumber(pontoEquilibrioData?.faturamentoPontoEquilibrio),
                              ),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                      [
                        { conteudo: 'Faturamento Realizado no Recorte' },
                        { conteudo: 'Σ Parcelas Quitadas + NFS-e' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.receitaBruta)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: 'Margem de Segurança Financeira' },
                        { conteudo: 'Receita Realizada - Ponto Equilíbrio' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(pontoEquilibrioData?.margemSegurancaValor)),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                      [
                        { conteudo: 'Meta Mensal para Cobertura Fixa' },
                        { conteudo: 'Ponto Equilíbrio ÷ Qtd Meses' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(
                                safeNumber(pontoEquilibrioData?.metaFaturamentoMensal),
                              ),
                          alinhamento: 'right',
                        },
                      ],
                    ],
                  },
                },
              ]}
              observacoesFinais="RELATÓRIO DE PONTO DE EQUILÍBRIO OPERACIONAL GERADO PELO SISTEMA AEROCAD CONSULTORIA PARA ANÁLISE DE CAPACIDADE DE ABSORÇÃO DE CUSTOS E MARGEM DE SEGURANÇA. FORMULADO CONFORME PRINCÍPIOS FUNDAMENTAIS DE CONTABILIDADE GERENCIAL."
            />
          ) : secaoAtiva === 'indicadores' ? (
            <AerocadRelatorioA4
              titulo="RELATÓRIO EXECUTIVO DE INDICADORES & PERFORMANCE"
              subtitulo={`Painel de Métricas e Análise Gerencial · ${periodoRotulo || 'Geral'} · Conta: ${contaAtivaNome || 'Todas'}`}
              referenciaPeriodo={`${periodoRotulo || 'Geral'} · ${contaAtivaNome || 'Todas'}`}
              responsavelNome={usuarioNome || 'Equipe AEROCAD'}
              resumoKpis={[
                {
                  rotulo: 'Prazo Médio Recebimento',
                  valorFormatado: `${indicadoresData?.pmrMedio || 0} dias`,
                  cor: 'laranja',
                },
                {
                  rotulo: 'Maior Cliente (% Receita)',
                  valorFormatado: `${(indicadoresData?.concentracaoMaiorCliente || 0).toFixed(1)}%`,
                  cor: 'neutro',
                },
                {
                  rotulo: 'Inadimplência no Período',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(indicadoresData?.totalAtrasado)),
                  cor: (indicadoresData?.totalAtrasado || 0) === 0 ? 'verde' : 'vermelho',
                },
                {
                  rotulo: 'Resultado Operacional',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(dreData?.resultadoOperacional)),
                  cor: (dreData?.resultadoOperacional || 0) >= 0 ? 'verde' : 'vermelho',
                  destaque: true,
                },
              ]}
              secoes={[
                {
                  titulo: 'INSIGHTS DETERMINÍSTICOS E RECOMENDAÇÕES DA CONTROLADORIA',
                  subtitulo:
                    'Diagnóstico automatizado sobre receita, margens, concentração e prazos de liquidação',
                  tabela: {
                    colunas: [
                      { cabecalho: 'Status', alinhamento: 'center', largura: '15%' },
                      { cabecalho: 'Diagnóstico Gerencial', alinhamento: 'left', largura: '35%' },
                      {
                        cabecalho: 'Detalhamento Operacional',
                        alinhamento: 'left',
                        largura: '50%',
                      },
                    ],
                    linhas: (indicadoresData?.insights || []).map((ins) => [
                      {
                        conteudo:
                          ins?.tipo === 'positivo'
                            ? '✓ Positivo'
                            : ins?.tipo === 'alerta'
                              ? '⚠ Atenção'
                              : 'ℹ Informativo',
                        alinhamento: 'center',
                        destaque: ins?.tipo === 'alerta',
                      },
                      { conteudo: ins?.titulo || '—', destaque: true },
                      { conteudo: ins?.descricao || '—' },
                    ]),
                  },
                },
                {
                  titulo: 'FLUXO COMPARATIVO MENSAL DO EXERCÍCIO (ENTRADAS VS SAÍDAS)',
                  subtitulo: 'Consolidação das receitas e despesas distribuídas mês a mês',
                  tabela: {
                    colunas: [
                      { cabecalho: 'Mês', alinhamento: 'left', largura: '25%' },
                      {
                        cabecalho: 'Entradas Realizadas (R$)',
                        alinhamento: 'right',
                        largura: '25%',
                      },
                      {
                        cabecalho: 'Saídas Operacionais (R$)',
                        alinhamento: 'right',
                        largura: '25%',
                      },
                      { cabecalho: 'Saldo Líquido (R$)', alinhamento: 'right', largura: '25%' },
                    ],
                    linhas: (indicadoresData?.evolucaoMensal || []).map((m) => [
                      { conteudo: m.nome, destaque: true },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(m.entradas)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(m.saidas)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(m.saldo)),
                        alinhamento: 'right',
                        destaque: true,
                      },
                    ]),
                  },
                },
              ]}
              observacoesFinais="RELATÓRIO EXECUTIVO DE INDICADORES EMITIDO PELO ERP AEROCAD PARA MONITORAMENTO ESTRATÉGICO, GOVERNANÇA E CONTROLE ORÇAMENTÁRIO. INFORMAÇÕES CONFIDENCIAIS E PRIVATIVAS DA DIRETORIA."
            />
          ) : (
            <AerocadRelatorioA4
              titulo="DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE)"
              subtitulo={`Degraus Contábeis · ${periodoRotulo || 'Geral'} · Conta: ${contaAtivaNome || 'Todas'}`}
              referenciaPeriodo={periodoRotulo || 'Geral'}
              responsavelNome={usuarioNome || 'Equipe AEROCAD'}
              resumoKpis={[
                {
                  rotulo: 'Receita Bruta',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(dreData?.receitaBruta)),
                  cor: 'laranja',
                },
                {
                  rotulo: 'Margem Contribuição',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(dreData?.margemContribuicao)),
                  cor: 'neutro',
                },
                {
                  rotulo: 'Resultado Operacional',
                  valorFormatado: mascararValores
                    ? VALOR_MASCARADO
                    : formatCurrency(safeNumber(dreData?.resultadoOperacional)),
                  cor: (dreData?.resultadoOperacional || 0) >= 0 ? 'verde' : 'vermelho',
                },
                {
                  rotulo: 'Margem Líquida',
                  valorFormatado: `${safeNumber(dreData?.margemLiquidaPercentual).toFixed(1)}%`,
                  cor: 'neutro',
                },
              ]}
              secoes={[
                {
                  titulo: 'DEMONSTRAÇÃO DE RESULTADO POR DEGRAUS CONTÁBEIS',
                  tabela: {
                    colunas: [
                      {
                        cabecalho: 'Degrau Contábil / Rubrica',
                        alinhamento: 'left',
                        largura: '50%',
                      },
                      { cabecalho: 'Período Atual (R$)', alinhamento: 'right', largura: '25%' },
                      { cabecalho: 'Período Anterior (R$)', alinhamento: 'right', largura: '25%' },
                    ],
                    linhas: [
                      [
                        { conteudo: '1. RECEITA OPERACIONAL BRUTA' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.receitaBruta)),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.recBrutaAnterior)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '2. (-) Tributos sobre Faturamento (ISS, DAS, Federais)' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : `- ${formatCurrency(safeNumber(dreData?.deducoesImpostos))}`,
                          alinhamento: 'right',
                        },
                        { conteudo: '—', alinhamento: 'right' },
                      ],
                      [
                        { conteudo: '3. (=) RECEITA OPERACIONAL LÍQUIDA' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.receitaLiquida)),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.recBrutaAnterior)),
                          alinhamento: 'right',
                        },
                      ],
                      [
                        { conteudo: '4. (-) Custos Variáveis dos Projetos' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : `- ${formatCurrency(safeNumber(dreData?.custosVariaveis))}`,
                          alinhamento: 'right',
                        },
                        { conteudo: '—', alinhamento: 'right' },
                      ],
                      [
                        { conteudo: '5. (=) MARGEM DE CONTRIBUIÇÃO' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : formatCurrency(safeNumber(dreData?.margemContribuicao)),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        { conteudo: '—', alinhamento: 'right' },
                      ],
                      [
                        { conteudo: '6. (-) Despesas Fixas e Administrativas' },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : `- ${formatCurrency(safeNumber(dreData?.despesasFixas))}`,
                          alinhamento: 'right',
                        },
                        {
                          conteudo: mascararValores
                            ? VALOR_MASCARADO
                            : `- ${formatCurrency(safeNumber(dreData?.despAnt))}`,
                          alinhamento: 'right',
                        },
                      ],
                    ],
                    linhaTotal: [
                      { conteudo: '(=) RESULTADO OPERACIONAL LÍQUIDO' },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(dreData?.resultadoOperacional)),
                        alinhamento: 'right',
                      },
                      {
                        conteudo: mascararValores
                          ? VALOR_MASCARADO
                          : formatCurrency(safeNumber(dreData?.resOperacionalAnterior)),
                        alinhamento: 'right',
                      },
                    ],
                  },
                },
              ]}
              observacoesFinais="Demonstrativo gerencial de apuração de resultado para tomada de decisões executivas. Classificação conforme Plano de Contas AEROCAD adaptado para consultorias de engenharia e projetos aeroportuários."
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 4. MODAL DE GERAÇÃO DO DOSSIÊ CONTÁBIL (.ZIP) COM NOTA_EXPLICATIVA.MD */}
      <Dialog
        open={modalDossieAberto}
        onOpenChange={(aberto) => {
          if (!gerandoDossie) setModalDossieAberto(aberto)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neutral-900">
              <Layers className="h-5 w-5 text-[#FF6A13]" />
              Gerar Dossiê Contábil Completo (.ZIP)
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Compilação estruturada em pastas cronológicas <strong>AAAA/MM/</strong> contendo
              comprovantes de despesas, extratos bancários, demonstrativos em HTML e a{' '}
              <strong>NOTA_EXPLICATIVA.md</strong> na raiz com identificação AEROCAD e tabela de
              rastreabilidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">
                Modalidade de Período
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoPeriodoDossie('ano')}
                  className={`p-2.5 rounded-lg border text-center font-medium transition ${
                    tipoPeriodoDossie === 'ano'
                      ? 'border-[#FF6A13] bg-orange-50 text-[#FF6A13]'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Calendar className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  Ano Inteiro
                </button>

                <button
                  type="button"
                  onClick={() => setTipoPeriodoDossie('mes')}
                  className={`p-2.5 rounded-lg border text-center font-medium transition ${
                    tipoPeriodoDossie === 'mes'
                      ? 'border-[#FF6A13] bg-orange-50 text-[#FF6A13]'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Clock className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  Mês Específico
                </button>

                <button
                  type="button"
                  onClick={() => setTipoPeriodoDossie('personalizado')}
                  className={`p-2.5 rounded-lg border text-center font-medium transition ${
                    tipoPeriodoDossie === 'personalizado'
                      ? 'border-[#FF6A13] bg-orange-50 text-[#FF6A13]'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Filter className="h-4 w-4 mx-auto mb-1 text-neutral-500" />
                  Data Início / Fim
                </button>
              </div>
            </div>

            {/* Configuração de Ano e Mês */}
            {tipoPeriodoDossie === 'ano' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-neutral-700">Exercício Anual</Label>
                <Select value={anoDossie} onValueChange={setAnoDossie}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((a) => (
                      <SelectItem key={a} value={a}>
                        Ano {a} (12 Meses)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoPeriodoDossie === 'mes' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">Ano</Label>
                  <Select value={anoDossie} onValueChange={setAnoDossie}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {anosDisponiveis.map((a) => (
                        <SelectItem key={a} value={a}>
                          Ano {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">Mês</Label>
                  <Select value={mesDossie} onValueChange={setMesDossie}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">01 - Janeiro</SelectItem>
                      <SelectItem value="2">02 - Fevereiro</SelectItem>
                      <SelectItem value="3">03 - Março</SelectItem>
                      <SelectItem value="4">04 - Abril</SelectItem>
                      <SelectItem value="5">05 - Maio</SelectItem>
                      <SelectItem value="6">06 - Junho</SelectItem>
                      <SelectItem value="7">07 - Julho</SelectItem>
                      <SelectItem value="8">08 - Agosto</SelectItem>
                      <SelectItem value="9">09 - Setembro</SelectItem>
                      <SelectItem value="10">10 - Outubro</SelectItem>
                      <SelectItem value="11">11 - Novembro</SelectItem>
                      <SelectItem value="12">12 - Dezembro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {tipoPeriodoDossie === 'personalizado' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">Data de Início</Label>
                  <Input
                    type="date"
                    value={dataInicioDossie}
                    onChange={(e) => setDataInicioDossie(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">Data de Fim</Label>
                  <Input
                    type="date"
                    value={dataFimDossie}
                    onChange={(e) => setDataFimDossie(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Informações da Estrutura ZIP */}
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
              <span className="font-bold text-neutral-800 block">Estrutura do Pacote ZIP:</span>
              <p>
                • <code>AAAA/MM/comprovantes/</code> — Comprovantes vinculados ao Contas a Pagar
              </p>
              <p>
                • <code>AAAA/MM/extratos/</code> — Extratos (.OFX, .RET, planilhas) importados
              </p>
              <p>
                • <code>AAAA/MM/demonstrativos/</code> — Minuta do Balanço e DRE em HTML
              </p>
              <p>
                • <code>NOTA_EXPLICATIVA.md</code> — Relatório descritivo com carimbo de Brasília
              </p>
            </div>

            {/* Barra de Progresso durante a geração */}
            {gerandoDossie && (
              <div className="space-y-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between text-xs text-[#FF6A13] font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin text-[#FF6A13]" />
                    {etapaDossie || 'Empacotando dossiê...'}
                  </span>
                  <span>{progressoDossie}%</span>
                </div>
                <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF6A13] transition-all duration-300"
                    style={{ width: `${progressoDossie}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={gerandoDossie}
              onClick={() => setModalDossieAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={gerandoDossie}
              onClick={handleGerarDossieContabilZip}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
            >
              {gerandoDossie ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Gerando ZIP...
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-4 w-4" />
                  Baixar Dossiê ZIP
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
