import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  Scale,
  Calculator,
  Save,
  Printer,
  FileSpreadsheet,
  Building2,
  DollarSign,
  Plus,
  Trash2,
  RefreshCw,
  History,
  Info,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Layers,
  Calendar,
  FileText,
  PieChart as PieIcon,
  BarChart3,
  Percent,
  CheckCircle2,
  HelpCircle,
  GitCompare,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/format'
import { AerocadRelatorioA4 } from '@/components/financeiro/AerocadRelatorioA4'
import { imprimirElementoA4 } from '@/services/relatorioImpressaoService'
import {
  calcularValuationAerocad,
  salvarValuation,
  listarValuations,
  excluirValuation,
  exportarValuationXlsx,
  MULTIPLOS_PADRAO,
  DCF_PADRAO,
  COMPOSICAO_PESOS_PADRAO,
  AEGIS_CONFIG_PADRAO,
  type MultiplosConfig,
  type DcfParametrosConfig,
  type ComposicaoPesosConfig,
  type AjusteSubjetivoItem,
  type AegisConfiguracaoCompleta,
  type ValuationCalculado,
  type ValuationRecordItem,
} from '@/services/valuationService'
import { AegisValuationSection } from '@/components/financeiro/AegisValuationSection'
import { Rocket } from 'lucide-react'
import { obterDadosEmpresa } from '@/services/empresaService'
import type {
  ParcelaRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ContaBancariaRecord,
  AtivoPatrimonioRecord,
  ExtratoTransacaoRecord,
  BalanceteMensalRecord,
  EmpresaRecord,
  ProjetoRecord,
  ClienteRecord,
} from '@/types/crm'

export interface ValuationTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  balancetes?: BalanceteMensalRecord[]
  projetos?: ProjetoRecord[]
  clientes?: ClienteRecord[]
  canWrite?: boolean
  canDelete?: boolean
  userRole?: string
  usuarioNome?: string
  usuarioId?: string
  onNavigateTab?: (tab: string) => void
}

type SubAbaValuation =
  | 'visao_geral'
  | 'serie_historica'
  | 'dcf'
  | 'sensibilidade'
  | 'despesas_receita'
  | 'composicao_pesos'
  | 'aegis_ativo'
  | 'comparador_historico'

export function ValuationTab({
  parcelas = [],
  contasPagar = [],
  contasReceber = [],
  contasBancarias = [],
  ativosPatrimonio = [],
  extratosTransacoes = [],
  balancetes = [],
  projetos = [],
  clientes = [],
  canWrite = true,
  canDelete = false,
  usuarioNome = 'Diretoria AEROCAD',
  usuarioId,
  onNavigateTab,
}: ValuationTabProps) {
  // Sub-abas de aprofundamento do Valuation
  const [subAbaAtiva, setSubAbaAtiva] = useState<SubAbaValuation>('visao_geral')

  // Controle de ano de exercício
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>()
    anos.add(new Date().getFullYear())
    for (const p of parcelas) {
      const dt = p.data_pagamento || p.vencimento || ''
      if (dt.length >= 4) {
        const y = parseInt(dt.slice(0, 4), 10)
        if (y > 2015 && y < 2050) anos.add(y)
      }
    }
    return Array.from(anos).sort((a, b) => b - a)
  }, [parcelas])

  const [anoSelecionado, setAnoSelecionado] = useState<number>(
    anosDisponiveis[0] || new Date().getFullYear(),
  )

  // Dados da Empresa
  const [empresa, setEmpresa] = useState<EmpresaRecord | null>(null)
  useEffect(() => {
    let ativo = true
    obterDadosEmpresa()
      .then((res) => {
        if (ativo) setEmpresa(res)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  // Parâmetros de Múltiplos
  const [multiplos, setMultiplos] = useState<MultiplosConfig>(MULTIPLOS_PADRAO)

  // Parâmetros do Fluxo de Caixa Descontado (FCD / DCF)
  const [dcfConfig, setDcfConfig] = useState<DcfParametrosConfig>(DCF_PADRAO)

  // Composição Ponderada dos Métodos
  const [composicaoPesos, setComposicaoPesos] =
    useState<ComposicaoPesosConfig>(COMPOSICAO_PESOS_PADRAO)

  // Premissas e Configuração do Ativo Estratégico AEGIS
  const [aegisConfig, setAegisConfig] = useState<AegisConfiguracaoCompleta>(AEGIS_CONFIG_PADRAO)

  // Ajustes Subjetivos / Intangíveis (Goodwill)
  const [ajustes, setAjustes] = useState<AjusteSubjetivoItem[]>([
    {
      id: 'ajuste_1',
      tipo: 'positivo',
      titulo: 'Acervo Técnico e Homologações DECEA / ANAC / COMAER',
      categoria: 'reputacao_decea_anac',
      valor: 250000,
      justificativa:
        'Know-how especializado em ZPA/PBZPA, deferimentos históricos e relacionamento regulatório institucional consolidado.',
    },
    {
      id: 'ajuste_2',
      tipo: 'positivo',
      titulo: 'Carteira de Clientes Corporativos e Construtoras Ativas',
      categoria: 'carteira_clientes',
      valor: 150000,
      justificativa:
        'Recorrência comprovada em projetos imobiliários e aeroportuários nos últimos 5 anos.',
    },
  ])

  // Modais e formulários
  const [novoAjusteTitulo, setNovoAjusteTitulo] = useState('')
  const [novoAjusteValor, setNovoAjusteValor] = useState('')
  const [novoAjusteTipo, setNovoAjusteTipo] = useState<'positivo' | 'negativo'>('positivo')
  const [novoAjusteCategoria, setNovoAjusteCategoria] =
    useState<AjusteSubjetivoItem['categoria']>('acervo_tecnico')
  const [novoAjusteJustificativa, setNovoAjusteJustificativa] = useState('')
  const [modalNovoAjusteAberto, setModalNovoAjusteAberto] = useState(false)

  // Histórico de avaliações salvas
  const [historico, setHistorico] = useState<ValuationRecordItem[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)
  const [salvandoValuation, setSalvandoValuation] = useState(false)
  const [tituloSalvar, setTituloSalvar] = useState('')
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false)
  const [modalVisualizarA4, setModalVisualizarA4] = useState(false)
  const [avaliacaoExcluindo, setAvaliacaoExcluindo] = useState<ValuationRecordItem | null>(null)

  // Seleções para Comparador de Histórico
  const [avaliacaoComparadaAId, setAvaliacaoComparadaAId] = useState<string>('')
  const [avaliacaoComparadaBId, setAvaliacaoComparadaBId] = useState<string>('')

  // Carregar histórico
  const carregarHistorico = async () => {
    try {
      setCarregandoHistorico(true)
      const lista = await listarValuations()
      setHistorico(lista)
      if (lista.length > 0 && !avaliacaoComparadaAId) {
        setAvaliacaoComparadaAId(lista[0].id)
        if (lista.length > 1) {
          setAvaliacaoComparadaBId(lista[1].id)
        }
      }
    } finally {
      setCarregandoHistorico(false)
    }
  }

  useEffect(() => {
    carregarHistorico()
  }, [])

  // CÁLCULO DINÂMICO REATIVO DO VALUATION COMPLETO
  const valuation: ValuationCalculado = useMemo(() => {
    return calcularValuationAerocad({
      parcelas,
      contasPagar,
      contasReceber,
      contasBancarias,
      ativosPatrimonio,
      extratosTransacoes,
      balancetes,
      projetos,
      clientes,
      empresa,
      anoExercicio: anoSelecionado,
      multiplos,
      dcfConfig,
      composicaoPesos,
      ajustesSubjetivos: ajustes,
      aegisConfig,
    })
  }, [
    parcelas,
    contasPagar,
    contasReceber,
    contasBancarias,
    ativosPatrimonio,
    extratosTransacoes,
    balancetes,
    projetos,
    clientes,
    empresa,
    anoSelecionado,
    multiplos,
    dcfConfig,
    composicaoPesos,
    ajustes,
    aegisConfig,
  ])

  // Dados para Gráficos
  const dadosGraficoSerie = useMemo(() => {
    return valuation.serieHistorica.map((s) => ({
      ano: `Ano ${s.ano}`,
      receitaBruta: s.receitaBruta,
      ebitda: s.ebitda,
      lucroLiquido: s.lucroLiquido,
      margemEbitda: s.margemEbitda,
    }))
  }, [valuation.serieHistorica])

  const dadosGraficoDcf = useMemo(() => {
    return valuation.dcf.projecoesAnuais.map((p) => ({
      ano: `Ano ${p.anoNumero} (${p.ano})`,
      fcl: p.fluxoCaixaLivre,
      vpl: p.fluxoPresente,
      receita: p.receitaLiquida,
    }))
  }, [valuation.dcf.projecoesAnuais])

  const dadosGraficoComposicao = useMemo(() => {
    return valuation.composicaoMultimetodos.metodos.map((m) => ({
      name: m.nome.split(' (')[0],
      peso: Math.round(m.peso * 100),
      valorMedio: m.valorMedio,
      contribuicao: m.valorPonderadoContribuicao,
    }))
  }, [valuation.composicaoMultimetodos.metodos])

  const CORES_PALETA = ['#FF6A13', '#2563EB', '#10B981', '#8B5CF6', '#F59E0B']

  // Ações de Ajustes
  const handleAdicionarAjuste = (e: React.FormEvent) => {
    e.preventDefault()
    const val = Number(novoAjusteValor.replace(/\D/g, '')) / 100 || Number(novoAjusteValor) || 0
    if (!novoAjusteTitulo.trim() || val <= 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Informe uma descrição e um valor positivo válido.',
        variant: 'destructive',
      })
      return
    }

    const item: AjusteSubjetivoItem = {
      id: `ajuste_${Date.now()}`,
      tipo: novoAjusteTipo,
      titulo: novoAjusteTitulo.trim(),
      categoria: novoAjusteCategoria,
      valor: val,
      justificativa: novoAjusteJustificativa.trim(),
    }

    setAjustes((prev) => [...prev, item])
    setNovoAjusteTitulo('')
    setNovoAjusteValor('')
    setNovoAjusteJustificativa('')
    setModalNovoAjusteAberto(false)

    toast({
      title: 'Ajuste adicionado',
      description: 'O valor foi incorporado aos métodos e ao valor substantivo.',
    })
  }

  const handleRemoverAjuste = (id: string) => {
    setAjustes((prev) => prev.filter((a) => a.id !== id))
    toast({
      title: 'Ajuste removido',
      description: 'O recálculo foi atualizado automaticamente.',
    })
  }

  // Salvar Avaliação
  const handleSalvarAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tituloSalvar.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Dê um nome para identificar esta avaliação.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoValuation(true)
      await salvarValuation({
        titulo: tituloSalvar.trim(),
        periodoReferencia: `Exercício ${anoSelecionado}`,
        metodoPrincipal: 'multimetodos_ponderado',
        multiplos,
        ajustes,
        resultado: valuation,
        usuarioId,
        usuarioNome,
        observacoes: `Valuation Aprofundado AEROCAD. Faixa: ${valuation.resultadoFinal.faixaEstimada}. FCD: ${formatCurrency(valuation.dcf.valorPatrimonialFcd)}. Substantivo: ${formatCurrency(valuation.valorSubstantivo.valorSubstantivoAjustado)}.`,
      })

      toast({
        title: 'Valuation salvo com sucesso!',
        description: 'A avaliação completa foi arquivada no histórico oficial.',
      })

      setTituloSalvar('')
      setModalSalvarAberto(false)
      carregarHistorico()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a avaliação no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoValuation(false)
    }
  }

  // Excluir do Histórico
  const handleConfirmarExclusao = async () => {
    if (!avaliacaoExcluindo) return
    try {
      await excluirValuation(avaliacaoExcluindo.id)
      toast({
        title: 'Avaliação excluída',
        description: 'O registro foi removido com sucesso.',
      })
      setAvaliacaoExcluindo(null)
      carregarHistorico()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Permissão insuficiente ou falha de conexão.',
        variant: 'destructive',
      })
    }
  }

  // Carregar Parâmetros do Histórico
  const handleCarregarDoHistorico = (item: ValuationRecordItem) => {
    if (item.multiplos_usados) {
      setMultiplos(item.multiplos_usados)
    }
    if (Array.isArray(item.ajustes_subjetivos)) {
      setAjustes(item.ajustes_subjetivos)
    }
    if (item.resultado_consolidado?.pesosComposicao) {
      setComposicaoPesos(item.resultado_consolidado.pesosComposicao)
    }
    toast({
      title: 'Cenário restaurado',
      description: `Parâmetros da avaliação "${item.titulo}" foram aplicados.`,
    })
    setModalHistoricoAberto(false)
  }

  // Exportação XLSX
  const handleExportarXlsx = async () => {
    try {
      await exportarValuationXlsx(valuation, usuarioNome)
      toast({
        title: 'Exportação Concluída',
        description: 'Planilha XLSX gerada com 8 abas analíticas completas.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível gerar a planilha Excel.',
        variant: 'destructive',
      })
    }
  }

  // Imprimir Relatório Oficial A4
  const handleImprimirA4 = () => {
    const ok = imprimirElementoA4({
      elementId: 'print-valuation-a4',
      titulo: `Relatório Econômico de Valuation — AEROCAD ${anoSelecionado}`,
      orientacao: 'portrait',
    })
    if (!ok) {
      toast({
        title: 'Impressão direta',
        description: 'Abrindo caixa de impressão do navegador...',
      })
      setTimeout(() => window.print(), 200)
    }
  }

  // Dados para comparação entre avaliações salvas
  const itemA = historico.find((h) => h.id === avaliacaoComparadaAId)
  const itemB = historico.find((h) => h.id === avaliacaoComparadaBId)

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO TÉCNICO COM IDENTIDADE AEROCAD */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#FFD2B3] bg-gradient-to-r from-[#FFFBF8] via-white to-[#FFF5EB] p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-25" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0E6] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#D65100] border border-[#FFD2B3]">
                <Calculator className="h-3.5 w-3.5 text-[#FF6A13]" />
                Módulo Econômico & Governança
              </span>
              <span className="text-xs font-medium text-neutral-500">
                AEROCAD Consultoria & Aeroportos
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
              Valuation Multimétodos & Relatórios Aprofundados
            </h1>
            <p className="text-sm text-neutral-600 max-w-3xl">
              Avaliação de mercado combinando <strong>Fluxo de Caixa Descontado (FCD)</strong>,{' '}
              <strong>Múltiplos de EBITDA e Receita</strong>,{' '}
              <strong>Valor Substantivo (Ativo Ajustado)</strong>, Matriz de Sensibilidade e
              Qualidade da Receita.
            </p>
          </div>

          {/* Barra de Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs shadow-2xs">
              <Calendar className="h-4 w-4 text-[#FF6A13]" />
              <span className="font-semibold text-neutral-700">Ano Base:</span>
              <select
                aria-label="Ano do Exercício"
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="bg-transparent font-bold text-neutral-900 focus:outline-none cursor-pointer"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    Exercício {a}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalHistoricoAberto(true)}
              className="border-neutral-300 hover:border-[#FF6A13] text-neutral-700 hover:text-[#D65100]"
            >
              <History className="h-4 w-4 mr-1.5 text-neutral-500" />
              Histórico ({historico.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarXlsx}
              className="border-neutral-300 hover:border-emerald-600 text-neutral-700 hover:text-emerald-700 font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
              Exportar XLSX (10 Abas)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalVisualizarA4(true)}
              className="border-neutral-300 hover:border-blue-600 text-neutral-700 hover:text-blue-700 font-semibold"
            >
              <FileText className="h-4 w-4 mr-1.5 text-blue-600" />
              Relatório Completo A4 / PDF
            </Button>

            {canWrite && (
              <Button
                size="sm"
                onClick={() => {
                  setTituloSalvar(`Valuation Multimétodos AEROCAD — Exercício ${anoSelecionado}`)
                  setModalSalvarAberto(true)
                }}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white shadow-xs font-bold"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Salvar Avaliação
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. SUB-ABAS DE NAVEGAÇÃO INTERNA DO VALUATION */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
        <button
          type="button"
          onClick={() => setSubAbaAtiva('visao_geral')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'visao_geral'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Visão Geral & Métricas
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('serie_historica')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'serie_historica'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Série Histórica Multianual
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('dcf')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'dcf'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          FCD / DCF (5 Anos)
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('sensibilidade')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'sensibilidade'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Percent className="h-3.5 w-3.5" />
          Matriz de Sensibilidade
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('despesas_receita')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'despesas_receita'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <PieIcon className="h-3.5 w-3.5" />
          Qualidade da Receita & Despesas
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('composicao_pesos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'composicao_pesos'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Composição dos 4 Métodos
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('aegis_ativo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition ${
            subAbaAtiva === 'aegis_ativo'
              ? 'bg-[#FF6A13] text-white shadow-xs'
              : 'text-[#D65100] hover:bg-orange-50 font-bold'
          }`}
        >
          <Rocket className="h-3.5 w-3.5" />
          AEGIS — Ativo de Produto
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('comparador_historico')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaAtiva === 'comparador_historico'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <GitCompare className="h-3.5 w-3.5" />
          Comparador de Avaliações
        </button>
      </div>

      {/* 3. AVISO DE CONFIABILIDADE DOS DADOS CONTÁBEIS */}
      <div
        className={`rounded-xl border p-4 transition-all ${
          valuation.confiabilidade.nivel === 'alta'
            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
            : valuation.confiabilidade.nivel === 'moderada'
              ? 'bg-amber-50/70 border-amber-300 text-amber-950'
              : 'bg-rose-50/70 border-rose-300 text-rose-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-lg p-2 ${
                valuation.confiabilidade.nivel === 'alta'
                  ? 'bg-emerald-100 text-emerald-700'
                  : valuation.confiabilidade.nivel === 'moderada'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-700'
              }`}
            >
              {valuation.confiabilidade.nivel === 'alta' ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  Índice de Confiabilidade Contábil:{' '}
                  <span>{valuation.confiabilidade.percentualConfiabilidade}%</span>
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase ${
                    valuation.confiabilidade.nivel === 'alta'
                      ? 'border-emerald-400 bg-emerald-100/60 text-emerald-800'
                      : valuation.confiabilidade.nivel === 'moderada'
                        ? 'border-amber-400 bg-amber-100/60 text-amber-900'
                        : 'border-rose-400 bg-rose-100/60 text-rose-900'
                  }`}
                >
                  Nível {valuation.confiabilidade.nivel}
                </Badge>
              </div>
              <p className="text-xs mt-0.5 opacity-90">
                Checagem automática: {valuation.confiabilidade.totalBalancetesArquivados} balancetes
                arquivados · {valuation.confiabilidade.transacoesSemClassificacao} transações sem
                plano de contas · {valuation.confiabilidade.transacoesSemContaBancaria} sem conta
                PJ.
              </p>
              {valuation.confiabilidade.alertas.length > 0 && (
                <ul className="mt-2 text-xs space-y-1 list-disc list-inside font-medium">
                  {valuation.confiabilidade.alertas.map((alerta, i) => (
                    <li key={i}>{alerta}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {valuation.confiabilidade.transacoesSemClassificacao > 0 && onNavigateTab && (
            <div className="shrink-0 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab('plano_contas')}
                className="bg-white/90 border-amber-300 text-amber-900 hover:bg-white text-xs font-semibold"
              >
                Classificar no Plano de Contas
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 4. QUADRO-RESUMO FINAL DO VALUATION (FAIXA COMBINADA PONDERADA) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Cenário Conservador */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">
              <span>Faixa Conservadora</span>
              <Badge variant="outline" className="border-neutral-300 text-neutral-600 text-[10px]">
                Piso Seguro
              </Badge>
            </div>
            <div className="text-2xl font-black tracking-tight text-neutral-800 mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioConservadorTotal)}
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Ponderação prudente com múltiplos e premissas defensivas em todos os métodos.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-600 space-y-1">
            <div className="flex justify-between">
              <span>FCD Conservador:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.dcf.cenariosFcd.conservador)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Múltiplo EBITDA (3.0x):</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosEbitda.conservador)}
              </strong>
            </div>
          </div>
        </div>

        {/* Cenário Central / Médio (Referência da Empresa) */}
        <div className="col-span-1 md:col-span-2 rounded-xl border-2 border-[#FF6A13] bg-gradient-to-b from-[#FFF9F5] to-white p-5 shadow-sm flex flex-col justify-between relative ring-2 ring-[#FF6A13]/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6A13] text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-2xs">
            Valor Central Ponderado (Referência Oficial)
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-[#D65100] font-bold uppercase tracking-wider mb-2 mt-1">
              <span>Valor Justo AEROCAD (4 Métodos Ponderados)</span>
              <Badge className="bg-[#FF6A13] text-white text-[10px] font-bold">
                Base Contratual
              </Badge>
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#FF6A13] mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioMedioTotal)}
            </div>
            <p className="text-xs text-neutral-600 mt-2">
              Combinação de{' '}
              <strong>
                FCD ({(valuation.composicaoMultimetodos.pesosConfig.pesoDcf * 100).toFixed(0)}%)
              </strong>
              ,{' '}
              <strong>
                Múltiplos EBITDA (
                {(valuation.composicaoMultimetodos.pesosConfig.pesoMultiplosEbitda * 100).toFixed(
                  0,
                )}
                %)
              </strong>
              ,{' '}
              <strong>
                Receita (
                {(valuation.composicaoMultimetodos.pesosConfig.pesoMultiplosReceita * 100).toFixed(
                  0,
                )}
                %)
              </strong>{' '}
              e{' '}
              <strong>
                Substantivo (
                {(valuation.composicaoMultimetodos.pesosConfig.pesoValorSubstantivo * 100).toFixed(
                  0,
                )}
                %)
              </strong>
              .
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-orange-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-neutral-700">
            <div>
              <span className="block text-neutral-500 text-[10px]">FCD 5 Anos:</span>
              <strong className="mono-value font-bold text-neutral-900">
                {formatCurrency(valuation.dcf.valorPatrimonialFcd)}
              </strong>
            </div>
            <div>
              <span className="block text-neutral-500 text-[10px]">Múlt. EBITDA:</span>
              <strong className="mono-value font-bold text-neutral-900">
                {formatCurrency(valuation.cenariosEbitda.medio)}
              </strong>
            </div>
            <div>
              <span className="block text-neutral-500 text-[10px]">Múlt. Receita:</span>
              <strong className="mono-value font-bold text-neutral-900">
                {formatCurrency(valuation.cenariosReceita.medio)}
              </strong>
            </div>
            <div>
              <span className="block text-neutral-500 text-[10px]">Substantivo:</span>
              <strong className="mono-value font-bold text-[#D65100]">
                {formatCurrency(valuation.valorSubstantivo.valorSubstantivoAjustado)}
              </strong>
            </div>
          </div>
        </div>

        {/* Cenário Otimista */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-emerald-700 font-bold uppercase tracking-wider mb-2">
              <span>Faixa Otimista</span>
              <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-[10px]">
                Expansão
              </Badge>
            </div>
            <div className="text-2xl font-black tracking-tight text-emerald-800 mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal)}
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Aceleração de projetos aeroportuários, novos contratos e expansão de margens
              operacionais.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-600 space-y-1">
            <div className="flex justify-between">
              <span>FCD Otimista:</span>
              <strong className="mono-value text-emerald-700">
                {formatCurrency(valuation.dcf.cenariosFcd.otimista)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Múltiplo EBITDA (6.0x):</span>
              <strong className="mono-value text-emerald-700">
                {formatCurrency(valuation.cenariosEbitda.otimista)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO DEPENDENTE DA SUB-ABA SELECIONADA */}

      {/* ========================================================================= */}
      {/* SUB-ABA 1: VISÃO GERAL & MÉTRICAS TRADICIONAIS */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'visao_geral' && (
        <div className="space-y-6">
          {/* OS TRÊS PILARES TRADICIONAIS (PATRIMÔNIO, RENTABILIDADE E FLUXO PROJETADO) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PILAR 1: VALOR PATRIMONIAL CONTÁBIL */}
            <Card className="border-neutral-200/90 shadow-2xs">
              <CardHeader className="pb-3 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-50 text-[#FF6A13]">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-900">
                        1. Valor Patrimonial
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Balanço Real & Ativos Tangíveis
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    PL Contábil
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Disponibilidades Bancárias (PJ):</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.patrimonio.disponibilidadesBancarias)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Contas e Parcelas a Receber:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.patrimonio.contasReceberCirculante)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 bg-neutral-50 px-2 rounded">
                  <span className="font-semibold text-neutral-700">Ativo Circulante Total:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.patrimonio.ativoCirculanteTotal)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Imobilizado Custo Histórico:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.patrimonio.imobilizadoCustoHistorico)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-600">
                  <span>(-) Depreciação Acumulada:</span>
                  <strong className="mono-value">
                    -{formatCurrency(valuation.patrimonio.imobilizadoDepreciacaoAcumulada)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 bg-neutral-50 px-2 rounded">
                  <span className="font-semibold text-neutral-700">Imobilizado Líquido:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.patrimonio.imobilizadoLiquido)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="font-bold text-neutral-800">Ativo Total:</span>
                  <strong className="mono-value text-neutral-900 font-bold">
                    {formatCurrency(valuation.patrimonio.ativoTotal)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-700">
                  <span>(-) Passivo Circulante (Pagar):</span>
                  <strong className="mono-value font-bold">
                    -{formatCurrency(valuation.patrimonio.passivoCirculanteTotal)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-2 bg-orange-50/70 border border-orange-200 px-2.5 rounded-lg text-sm text-[#D65100]">
                  <span className="font-black uppercase tracking-tight">Patrimônio Líquido:</span>
                  <strong className="mono-value font-black text-base">
                    {formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil)}
                  </strong>
                </div>
              </CardContent>
            </Card>

            {/* PILAR 2: RENTABILIDADE & EBITDA */}
            <Card className="border-neutral-200/90 shadow-2xs">
              <CardHeader className="pb-3 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-900">
                        2. Rentabilidade & EBITDA
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Geração Operacional Realizada
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Exercício {anoSelecionado}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Receita Operacional Bruta:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.rentabilidade.receitaBruta)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-600">
                  <span>(-) Tributos sobre Serviços:</span>
                  <strong className="mono-value">
                    -{formatCurrency(valuation.rentabilidade.deducoesTributarias)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 bg-neutral-50 px-2 rounded">
                  <span className="font-semibold text-neutral-700">Receita Líquida:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.rentabilidade.receitaLiquida)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-600">
                  <span>(-) Custos Diretos Projetos:</span>
                  <strong className="mono-value">
                    -{formatCurrency(valuation.rentabilidade.custosDiretosProjetos)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-600">
                  <span>(-) Despesas Operacionais:</span>
                  <strong className="mono-value">
                    -{formatCurrency(valuation.rentabilidade.despesasOperacionaisFixas)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">(+) Depreciação Anual Imobilizado:</span>
                  <strong className="mono-value text-neutral-700">
                    +{formatCurrency(valuation.rentabilidade.depreciacaoEstimadaExercicio)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-2 bg-emerald-50/70 border border-emerald-200 px-2.5 rounded-lg text-sm text-emerald-900">
                  <div>
                    <span className="font-black uppercase tracking-tight block">EBITDA Anual:</span>
                    <span className="text-[10px] text-emerald-700 font-normal">
                      Margem EBITDA: {valuation.rentabilidade.margemEbitdaPercentual.toFixed(1)}%
                    </span>
                  </div>
                  <strong className="mono-value font-black text-base">
                    {formatCurrency(valuation.rentabilidade.ebitda)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 text-neutral-600">
                  <span>Lucro Líquido Estimado:</span>
                  <strong className="mono-value font-bold text-neutral-900">
                    {formatCurrency(valuation.rentabilidade.lucroLiquido)} (
                    {valuation.rentabilidade.margemLiquidaPercentual.toFixed(1)}%)
                  </strong>
                </div>
              </CardContent>
            </Card>

            {/* PILAR 3: CAPITAL DE GIRO E LIQUIDEZ */}
            <Card className="border-neutral-200/90 shadow-2xs">
              <CardHeader className="pb-3 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-900">
                        3. Capital de Giro & Liquidez
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Eficiência Operacional & Prazos
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Indicadores
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Capital de Giro Líquido:</span>
                  <strong className="mono-value text-neutral-900 font-bold">
                    {formatCurrency(valuation.capitalGiro.capitalGiroLiquido)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Necessidade de Capital de Giro:</span>
                  <strong className="mono-value text-neutral-900">
                    {formatCurrency(valuation.capitalGiro.necessidadeCapitalGiro)}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Prazo Médio Recebimento (PMR):</span>
                  <strong className="mono-value text-neutral-900">
                    {valuation.capitalGiro.prazoMedioRecebimentoDias} dias
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Prazo Médio Pagamento (PMP):</span>
                  <strong className="mono-value text-neutral-900">
                    {valuation.capitalGiro.prazoMedioPagamentoDias} dias
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-neutral-100 bg-neutral-50 px-2 rounded">
                  <span className="font-semibold text-neutral-700">Ciclo Operacional Líquido:</span>
                  <strong className="mono-value text-neutral-900">
                    {valuation.capitalGiro.cicloOperacionalDias} dias
                  </strong>
                </div>
                <div className="flex justify-between items-center py-2 bg-sky-50/70 border border-sky-200 px-2.5 rounded-lg text-sm text-sky-950">
                  <div>
                    <span className="font-black uppercase tracking-tight block">
                      Liquidez Corrente:
                    </span>
                    <span className="text-[10px] text-sky-700 font-normal">
                      Capacidade de honrar passivos
                    </span>
                  </div>
                  <strong className="mono-value font-black text-base">
                    {valuation.capitalGiro.liquidezCorrente > 50
                      ? '> 50x'
                      : `${valuation.capitalGiro.liquidezCorrente.toFixed(2)}x`}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 text-neutral-600">
                  <span>Cobertura de Custos Fixos:</span>
                  <strong className="mono-value font-bold text-neutral-900">
                    {valuation.indicadoresApoio.coberturaCustosFixosMeses.toFixed(1)} meses
                  </strong>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AJUSTES SUBJETIVOS / ATIVOS INTANGÍVEIS (GOODWILL) */}
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-50 text-[#FF6A13]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-neutral-900">
                      Ajustes Subjetivos & Goodwill (Ativo Substantivo Ajustado)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ativos regulatórios estratégicos (acervo técnico, credenciamentos ANAC/DECEA)
                      e passivos contingentes.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setModalNovoAjusteAberto(true)}
                  className="bg-white border border-[#FF6A13] text-[#D65100] hover:bg-[#FFF6EC]"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Ajuste Intangível
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {ajustes.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs">
                  Nenhum ajuste intangível cadastrado.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 border rounded-lg overflow-hidden bg-white">
                  {ajustes.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.tipo === 'positivo'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.tipo === 'positivo'
                              ? '+ Acréscimo (Ativo)'
                              : '- Dedução (Passivo)'}
                          </span>
                          <strong className="text-xs text-neutral-900">{item.titulo}</strong>
                        </div>
                        {item.justificativa && (
                          <p className="text-[11px] text-neutral-500 italic max-w-2xl">
                            {item.justificativa}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span
                          className={`text-sm font-black mono-value ${
                            item.tipo === 'positivo' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {item.tipo === 'positivo' ? '+' : '-'}
                          {formatCurrency(item.valor)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoverAjuste(item.id)}
                          className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totalizador de Intangíveis & Valor Substantivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-[#FFFBF7] rounded-lg border border-[#FFD2B3] text-xs">
                  <span className="font-bold text-[#D65100]">Saldo Líquido de Intangíveis:</span>
                  <strong className="mono-value font-black text-sm text-[#FF6A13]">
                    {valuation.ajustes.totalLiquidoIntangiveis >= 0 ? '+' : ''}
                    {formatCurrency(valuation.ajustes.totalLiquidoIntangiveis)}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-300 text-xs">
                  <span className="font-bold text-neutral-800">
                    Valor Substantivo (PL + Intangíveis):
                  </span>
                  <strong className="mono-value font-black text-sm text-neutral-900">
                    {formatCurrency(valuation.valorSubstantivo.valorSubstantivoAjustado)}
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 2: SÉRIE HISTÓRICA MULTIANUAL */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'serie_historica' && (
        <div className="space-y-6">
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Evolução Multianual da Rentabilidade & Geração Operacional
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparativo histórico de Receita Bruta, EBITDA e Lucro Líquido por
                    competência/exercício.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs bg-orange-50 border-orange-300 text-[#D65100]"
                >
                  {valuation.serieHistorica.length} Exercícios Analisados
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">
              {/* Gráfico Recharts de Evolução */}
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dadosGraficoSerie}
                    margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), '']}
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="receitaBruta"
                      name="Receita Bruta"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ebitda"
                      name="EBITDA"
                      stroke="#FF6A13"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="lucroLiquido"
                      name="Lucro Líquido"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Comparativa Detalhada com Variações % */}
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2D2D2D] text-white">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Exercício</th>
                      <th className="py-2.5 px-3 text-right font-bold">Receita Bruta</th>
                      <th className="py-2.5 px-3 text-center font-bold">Var. Rec. %</th>
                      <th className="py-2.5 px-3 text-right font-bold">Tributos</th>
                      <th className="py-2.5 px-3 text-right font-bold">Receita Líquida</th>
                      <th className="py-2.5 px-3 text-right font-bold">Custos Diretos</th>
                      <th className="py-2.5 px-3 text-right font-bold">Despesas Fixas</th>
                      <th className="py-2.5 px-3 text-right font-bold text-orange-300">EBITDA</th>
                      <th className="py-2.5 px-3 text-center font-bold">Var. EBITDA %</th>
                      <th className="py-2.5 px-3 text-center font-bold">Margem EBITDA</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-300">
                        Lucro Líquido
                      </th>
                      <th className="py-2.5 px-3 text-center font-bold">Margem Líq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {valuation.serieHistorica.map((s) => (
                      <tr
                        key={s.ano}
                        className={
                          s.ano === anoSelecionado
                            ? 'bg-orange-50/40 font-semibold'
                            : 'hover:bg-neutral-50'
                        }
                      >
                        <td className="py-2.5 px-3 font-bold text-neutral-900">
                          {s.ano} {s.ano === anoSelecionado && '(Atual)'}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value">
                          {formatCurrency(s.receitaBruta)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {s.variacaoReceitaPercentual !== null ? (
                            <span
                              className={
                                s.variacaoReceitaPercentual >= 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-600'
                              }
                            >
                              {s.variacaoReceitaPercentual > 0 ? '+' : ''}
                              {s.variacaoReceitaPercentual.toFixed(1)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value text-rose-600">
                          -{formatCurrency(s.tributos)}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value font-medium">
                          {formatCurrency(s.receitaLiquida)}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value text-rose-600">
                          -{formatCurrency(s.custosDiretos)}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value text-rose-600">
                          -{formatCurrency(s.despesasFixas)}
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value font-bold text-[#D65100] bg-orange-50/50">
                          {formatCurrency(s.ebitda)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {s.variacaoEbitdaPercentual !== null ? (
                            <span
                              className={
                                s.variacaoEbitdaPercentual >= 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-600'
                              }
                            >
                              {s.variacaoEbitdaPercentual > 0 ? '+' : ''}
                              {s.variacaoEbitdaPercentual.toFixed(1)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {s.margemEbitda.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right mono-value font-bold text-emerald-800">
                          {formatCurrency(s.lucroLiquido)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-neutral-600">
                          {s.margemLiquida.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 3: FLUXO DE CAIXA DESCONTADO (FCD / DCF 5 ANOS) */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'dcf' && (
        <div className="space-y-6">
          {/* Parâmetros do FCD */}
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Premissas do Fluxo de Caixa Descontado (FCD / DCF)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Taxa de desconto (WACC), taxa de perpetuidade (g) e projeções anuais de
                    crescimento operacional.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDcfConfig(DCF_PADRAO)}
                  className="text-xs text-neutral-500 hover:text-[#FF6A13]"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Restaurar Padrões FCD
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="technical-label block text-[10px]">
                    Taxa WACC (Desconto a.a.)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="5"
                      max="30"
                      value={(dcfConfig.wacc * 100).toFixed(1)}
                      onChange={(e) =>
                        setDcfConfig((prev) => ({
                          ...prev,
                          wacc: (parseFloat(e.target.value) || 14.5) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-neutral-900"
                    />
                    <span className="absolute right-2 top-2 text-xs text-neutral-400">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="technical-label block text-[10px]">
                    Crescimento Perpétuo (g a.a.)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={(dcfConfig.crescimentoPerpetuo * 100).toFixed(1)}
                      onChange={(e) =>
                        setDcfConfig((prev) => ({
                          ...prev,
                          crescimentoPerpetuo: (parseFloat(e.target.value) || 3.5) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-neutral-900"
                    />
                    <span className="absolute right-2 top-2 text-xs text-neutral-400">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="technical-label block text-[10px]">
                    Margem EBITDA Projetada
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="5"
                      max="60"
                      value={(dcfConfig.margemEbitdaProjetada * 100).toFixed(0)}
                      onChange={(e) =>
                        setDcfConfig((prev) => ({
                          ...prev,
                          margemEbitdaProjetada: (parseFloat(e.target.value) || 28) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-neutral-900"
                    />
                    <span className="absolute right-2 top-2 text-xs text-neutral-400">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="technical-label block text-[10px]">
                    Reinvestimento Capex/Giro
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="50"
                      value={(dcfConfig.reinvestimentoPercentual * 100).toFixed(0)}
                      onChange={(e) =>
                        setDcfConfig((prev) => ({
                          ...prev,
                          reinvestimentoPercentual: (parseFloat(e.target.value) || 10) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-neutral-900"
                    />
                    <span className="absolute right-2 top-2 text-xs text-neutral-400">%</span>
                  </div>
                </div>
              </div>

              {/* Taxas de Crescimento Anual (Anos 1 a 5) */}
              <div className="pt-2">
                <label className="technical-label block text-[10px] mb-1.5 text-neutral-600">
                  Taxas de Crescimento Anual Projetadas (Anos 1 a 5):
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {dcfConfig.taxasCrescimentoAnual.map((tx, idx) => (
                    <div key={idx} className="p-2 bg-neutral-50 rounded border text-center">
                      <span className="text-[10px] font-bold text-neutral-500 block">
                        Ano {idx + 1}
                      </span>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="1"
                          min="-20"
                          max="100"
                          value={(tx * 100).toFixed(0)}
                          onChange={(e) => {
                            const val = (parseFloat(e.target.value) || 0) / 100
                            setDcfConfig((prev) => {
                              const novasTaxas = [...prev.taxasCrescimentoAnual] as [
                                number,
                                number,
                                number,
                                number,
                                number,
                              ]
                              novasTaxas[idx] = val
                              return { ...prev, taxasCrescimentoAnual: novasTaxas }
                            })
                          }}
                          className="font-mono text-xs text-center font-bold p-1 h-7"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico do FCD */}
          <div className="h-64 w-full bg-white p-4 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold text-neutral-700 block mb-2">
              Fluxo de Caixa Livre Projetado vs Valor Presente Líquido (VPL)
            </span>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={dadosGraficoDcf} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val: number) => [formatCurrency(val), '']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                  }}
                />
                <Legend />
                <Bar dataKey="fcl" name="Fluxo Livre (FCL)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="vpl"
                  name="Valor Presente (VPL)"
                  fill="#FF6A13"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela do FCD Passo a Passo */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#2D2D2D] text-white">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Ano da Projeção</th>
                  <th className="py-2.5 px-3 text-center font-bold">Cresc. %</th>
                  <th className="py-2.5 px-3 text-right font-bold">Receita Líquida</th>
                  <th className="py-2.5 px-3 text-right font-bold">EBITDA</th>
                  <th className="py-2.5 px-3 text-right font-bold">EBIT</th>
                  <th className="py-2.5 px-3 text-right font-bold">(-) Impostos</th>
                  <th className="py-2.5 px-3 text-right font-bold">(-) Capex/Giro</th>
                  <th className="py-2.5 px-3 text-right font-bold text-blue-300">
                    Fluxo Livre (FCL)
                  </th>
                  <th className="py-2.5 px-3 text-center font-bold">Fator Desconto</th>
                  <th className="py-2.5 px-3 text-right font-bold text-orange-300">VPL Presente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {valuation.dcf.projecoesAnuais.map((p) => (
                  <tr key={p.anoNumero} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-bold text-neutral-900">
                      Ano {p.anoNumero} ({p.ano})
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {(p.taxaCrescimento * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value">
                      {formatCurrency(p.receitaLiquida)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value">
                      {formatCurrency(p.ebitda)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value font-medium">
                      {formatCurrency(p.ebit)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value text-rose-600">
                      -{formatCurrency(p.impostos)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value text-rose-600">
                      -{formatCurrency(p.reinvestimentoCapexGiro)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value font-bold text-blue-700 bg-blue-50/40">
                      {formatCurrency(p.fluxoCaixaLivre)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                      {p.fatorDesconto.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-right mono-value font-bold text-[#D65100] bg-orange-50/40">
                      {formatCurrency(p.fluxoPresente)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quadro de Fechamento do FCD (Perpetuidade e Equity Value) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2 text-xs">
              <span className="text-neutral-500 font-bold block uppercase tracking-wider text-[10px]">
                1. Fluxos Explícitos (5 Anos)
              </span>
              <div className="text-xl font-black text-neutral-900 mono-value">
                {formatCurrency(valuation.dcf.somaVplFluxosExplicitos)}
              </div>
              <p className="text-[11px] text-neutral-500">
                Soma dos valores presentes descontados ano a ano pelo WACC de{' '}
                {(valuation.dcf.parametros.wacc * 100).toFixed(1)}%.
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs space-y-2 text-xs">
              <span className="text-neutral-500 font-bold block uppercase tracking-wider text-[10px]">
                2. Perpetuidade Descontada
              </span>
              <div className="text-xl font-black text-neutral-900 mono-value">
                {formatCurrency(valuation.dcf.valorPerpetuidadePresente)}
              </div>
              <p className="text-[11px] text-neutral-500">
                Modelo Gordon Shapiro com crescimento contínuo de{' '}
                {(valuation.dcf.parametros.crescimentoPerpetuo * 100).toFixed(1)}% ao ano.
              </p>
            </div>

            <div className="p-4 bg-orange-50/80 rounded-xl border-2 border-[#FF6A13] shadow-xs space-y-2 text-xs">
              <span className="text-[#D65100] font-black block uppercase tracking-wider text-[10px]">
                3. Valor Patrimonial FCD (Equity Value)
              </span>
              <div className="text-2xl font-black text-[#FF6A13] mono-value">
                {formatCurrency(valuation.dcf.valorPatrimonialFcd)}
              </div>
              <p className="text-[11px] text-neutral-600">
                EV ({formatCurrency(valuation.dcf.valorEmpresaFcdTotal)}) ajustado por Caixa Líquido
                ({formatCurrency(valuation.dcf.caixaLiquido)}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 4: MATRIZ DE SENSIBILIDADE BIDIMENSIONAL */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'sensibilidade' && (
        <div className="space-y-6">
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div>
                <CardTitle className="text-base font-bold text-neutral-900">
                  Matriz de Sensibilidade Bidimensional (WACC × Taxa de Crescimento g)
                </CardTitle>
                <CardDescription className="text-xs">
                  Avalie como o valuation patrimonial varia em cenários de juros mais altos ou mais
                  baixos (WACC de ±1pp e ±2pp) combinados com aceleração de crescimento na
                  perpetuidade (g de ±1pp).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Tabela de Sensibilidade FCD */}
              <div>
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Impacto no Valor pelo Fluxo de Caixa Descontado (FCD / DCF)
                </h4>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-[#2D2D2D] text-white">
                      <tr>
                        <th className="py-2.5 px-4 text-left font-bold">Taxa WACC \ Taxa g</th>
                        {valuation.matrizSensibilidade[0]?.map((col, idx) => (
                          <th key={idx} className="py-2.5 px-4 font-bold">
                            g = {(col.crescimentoPerpetuo * 100).toFixed(1)}% ({col.deltaG})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {valuation.matrizSensibilidade.map((linha, lIdx) => (
                        <tr key={lIdx} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-4 text-left font-bold text-neutral-800 bg-neutral-100/70">
                            WACC = {(linha[0].wacc * 100).toFixed(1)}% ({linha[0].deltaWacc})
                          </td>
                          {linha.map((cel, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2.5 px-4 mono-value font-semibold ${
                                cel.isBase
                                  ? 'bg-[#FFEBD9] text-[#D65100] font-black border-2 border-[#FF6A13]'
                                  : 'text-neutral-800'
                              }`}
                            >
                              {formatCurrency(cel.valorFcd)}
                              {cel.isBase && (
                                <span className="block text-[9px] font-bold">CENÁRIO BASE</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela de Sensibilidade Ponderada Final */}
              <div>
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Impacto no Valuation Consolidado Ponderado Final
                </h4>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-neutral-800 text-white">
                      <tr>
                        <th className="py-2 px-4 text-left font-bold">Taxa WACC \ Taxa g</th>
                        {valuation.matrizSensibilidade[0]?.map((col, idx) => (
                          <th key={idx} className="py-2 px-4 font-bold">
                            g = {(col.crescimentoPerpetuo * 100).toFixed(1)}% ({col.deltaG})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {valuation.matrizSensibilidade.map((linha, lIdx) => (
                        <tr key={lIdx} className="hover:bg-neutral-50">
                          <td className="py-2 px-4 text-left font-bold text-neutral-800 bg-neutral-100/70">
                            WACC = {(linha[0].wacc * 100).toFixed(1)}% ({linha[0].deltaWacc})
                          </td>
                          {linha.map((cel, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2 px-4 mono-value ${
                                cel.isBase
                                  ? 'bg-orange-100 text-[#D65100] font-black border-2 border-[#FF6A13]'
                                  : 'text-neutral-700'
                              }`}
                            >
                              {formatCurrency(cel.valorConsolidadoPonderado)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 5: QUALIDADE DA RECEITA & DECOMPOSIÇÃO DE DESPESAS */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'despesas_receita' && (
        <div className="space-y-6">
          {/* Concentração da Receita por Cliente */}
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Qualidade da Receita & Concentração por Cliente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Grau de dependência de grandes clientes no faturamento da empresa (Top 1, Top 3
                    e Top 5).
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold uppercase ${
                    valuation.qualidadeReceita.classificacaoRiscoConcentracao === 'baixo'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : valuation.qualidadeReceita.classificacaoRiscoConcentracao === 'moderado'
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-rose-400 bg-rose-50 text-rose-800'
                  }`}
                >
                  Risco de Concentração: {valuation.qualidadeReceita.classificacaoRiscoConcentracao}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-neutral-50 rounded-lg border text-xs">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    Top 1 Maior Cliente
                  </span>
                  <div className="text-lg font-black text-neutral-900 mono-value mt-1">
                    {valuation.qualidadeReceita.percentualTop1.toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-neutral-600">
                    {formatCurrency(valuation.qualidadeReceita.faturamentoTop1)}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg border text-xs">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    Top 3 Maiores Clientes
                  </span>
                  <div className="text-lg font-black text-neutral-900 mono-value mt-1">
                    {valuation.qualidadeReceita.percentualTop3.toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-neutral-600">
                    {formatCurrency(valuation.qualidadeReceita.faturamentoTop3)}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg border text-xs">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    Top 5 Maiores Clientes
                  </span>
                  <div className="text-lg font-black text-neutral-900 mono-value mt-1">
                    {valuation.qualidadeReceita.percentualTop5.toFixed(1)}%
                  </div>
                  <span className="text-[11px] text-neutral-600">
                    {formatCurrency(valuation.qualidadeReceita.faturamentoTop5)}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg border text-xs">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                    Índice HHI (Herfindahl)
                  </span>
                  <div className="text-lg font-black text-neutral-900 mono-value mt-1">
                    {valuation.qualidadeReceita.indiceHHI} pts
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    {valuation.qualidadeReceita.totalClientesAtivos} clientes no ano
                  </span>
                </div>
              </div>

              {/* Lista dos Top Clientes */}
              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2D2D2D] text-white">
                    <tr>
                      <th className="py-2 px-3 font-bold">Ranking</th>
                      <th className="py-2 px-3 font-bold">Cliente / Razão Social</th>
                      <th className="py-2 px-3 text-right font-bold">Total Faturado</th>
                      <th className="py-2 px-3 text-center font-bold">Participação %</th>
                      <th className="py-2 px-3 text-center font-bold">Medições / Parcelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {valuation.qualidadeReceita.topClientes.map((c) => (
                      <tr key={c.posicao} className="hover:bg-neutral-50">
                        <td className="py-2 px-3 font-bold text-neutral-900">#{c.posicao}</td>
                        <td className="py-2 px-3 font-medium text-neutral-800">{c.clienteNome}</td>
                        <td className="py-2 px-3 text-right mono-value font-bold text-neutral-900">
                          {formatCurrency(c.totalFaturado)}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {c.percentualSobreReceita.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-neutral-600">
                          {c.quantidadeProjetosOuParcelas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Decomposição de Despesas por Grupo Contábil */}
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div>
                <CardTitle className="text-base font-bold text-neutral-900">
                  Decomposição de Despesas por Grupo Contábil & Plano de Contas
                </CardTitle>
                <CardDescription className="text-xs">
                  Estrutura de custos e despesas operacionais da empresa no exercício selecionado.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                {valuation.decomposicaoDespesas.map((grupo) => (
                  <div
                    key={grupo.codigoGrupo}
                    className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] bg-white">
                          Grupo {grupo.codigoGrupo}
                        </Badge>
                        <strong className="text-xs text-neutral-900">{grupo.nomeGrupo}</strong>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-neutral-500">
                          {grupo.percentualSobreTotal.toFixed(1)}% das despesas
                        </span>
                        <strong className="mono-value font-bold text-neutral-900">
                          {formatCurrency(grupo.valorTotal)}
                        </strong>
                      </div>
                    </div>

                    {/* Subcontas */}
                    <div className="pt-2 pl-2 border-t border-neutral-200/60 divide-y divide-neutral-200/40 text-[11px]">
                      {grupo.contas.slice(0, 5).map((conta) => (
                        <div
                          key={conta.codigo}
                          className="py-1 flex justify-between items-center text-neutral-600"
                        >
                          <span>
                            {conta.codigo} — {conta.nome}
                          </span>
                          <span className="mono-value font-medium text-neutral-800">
                            {formatCurrency(conta.valor)} ({conta.percentual.toFixed(1)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 6: COMPOSIÇÃO PONDERADA DOS 4 MÉTODOS */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'composicao_pesos' && (
        <div className="space-y-6">
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Composição Ponderada e Ponderação dos 4 Métodos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Defina o peso percentual de cada método de avaliação para calibrar a faixa final
                    recomendada pela diretoria.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComposicaoPesos(COMPOSICAO_PESOS_PADRAO)}
                  className="text-xs text-neutral-500 hover:text-[#FF6A13]"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Pesos Recomendados (40/30/15/15)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">
              {/* Controles de Pesos */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 block">
                    1. Fluxo Descontado (FCD)
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={Math.round(composicaoPesos.pesoDcf * 100)}
                      onChange={(e) =>
                        setComposicaoPesos((prev) => ({
                          ...prev,
                          pesoDcf: (parseFloat(e.target.value) || 0) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-center"
                    />
                    <span className="text-xs text-neutral-500">%</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block">
                    Capacidade futura de geração
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 block">
                    2. Múltiplos sobre EBITDA
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={Math.round(composicaoPesos.pesoMultiplosEbitda * 100)}
                      onChange={(e) =>
                        setComposicaoPesos((prev) => ({
                          ...prev,
                          pesoMultiplosEbitda: (parseFloat(e.target.value) || 0) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-center"
                    />
                    <span className="text-xs text-neutral-500">%</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block">
                    Múltiplos setoriais consultivos
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 block">
                    3. Múltiplos sobre Receita
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={Math.round(composicaoPesos.pesoMultiplosReceita * 100)}
                      onChange={(e) =>
                        setComposicaoPesos((prev) => ({
                          ...prev,
                          pesoMultiplosReceita: (parseFloat(e.target.value) || 0) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-center"
                    />
                    <span className="text-xs text-neutral-500">%</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block">
                    Valuation por volume de vendas
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 block">
                    4. Valor Substantivo
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={Math.round(composicaoPesos.pesoValorSubstantivo * 100)}
                      onChange={(e) =>
                        setComposicaoPesos((prev) => ({
                          ...prev,
                          pesoValorSubstantivo: (parseFloat(e.target.value) || 0) / 100,
                        }))
                      }
                      className="font-mono text-xs font-bold text-center"
                    />
                    <span className="text-xs text-neutral-500">%</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block">
                    PL Contábil + Intangíveis ANAC
                  </span>
                </div>
              </div>

              {/* Tabela Síntese dos 4 Métodos e Contribuições */}
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2D2D2D] text-white">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Método de Avaliação</th>
                      <th className="py-2.5 px-4 text-center font-bold">Peso %</th>
                      <th className="py-2.5 px-4 text-right font-bold">Faixa Conservadora</th>
                      <th className="py-2.5 px-4 text-right font-bold text-orange-300">
                        Valor Médio / Base
                      </th>
                      <th className="py-2.5 px-4 text-right font-bold">Faixa Otimista</th>
                      <th className="py-2.5 px-4 text-right font-bold text-emerald-300">
                        Contribuição Ponderada
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {valuation.composicaoMultimetodos.metodos.map((m) => (
                      <tr key={m.chave} className="hover:bg-neutral-50">
                        <td className="py-3 px-4">
                          <strong className="text-neutral-900 block">{m.nome}</strong>
                          <span className="text-[11px] text-neutral-500">{m.descricao}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800">
                          {(m.peso * 100).toFixed(0)}%
                        </td>
                        <td className="py-3 px-4 text-right mono-value">
                          {formatCurrency(m.valorConservador)}
                        </td>
                        <td className="py-3 px-4 text-right mono-value font-bold text-[#D65100] bg-orange-50/40">
                          {formatCurrency(m.valorMedio)}
                        </td>
                        <td className="py-3 px-4 text-right mono-value text-emerald-700">
                          {formatCurrency(m.valorOtimista)}
                        </td>
                        <td className="py-3 px-4 text-right mono-value font-black text-neutral-900 bg-neutral-50">
                          {formatCurrency(m.valorPonderadoContribuicao)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#FFF6EC] border-t-2 border-[#FF6A13] font-black text-neutral-950">
                      <td className="py-3 px-4 text-sm text-[#D65100]">
                        VALOR TOTAL RECOMENDADO DA AEROCAD
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-sm">100%</td>
                      <td className="py-3 px-4 text-right mono-value text-sm">
                        {formatCurrency(valuation.composicaoMultimetodos.faixaFinalConservadora)}
                      </td>
                      <td className="py-3 px-4 text-right mono-value text-base text-[#D65100] bg-[#FFEBD9]">
                        {formatCurrency(valuation.composicaoMultimetodos.faixaFinalMedia)}
                      </td>
                      <td className="py-3 px-4 text-right mono-value text-sm text-emerald-900">
                        {formatCurrency(valuation.composicaoMultimetodos.faixaFinalOtimista)}
                      </td>
                      <td className="py-3 px-4 text-right mono-value text-base text-[#D65100]">
                        {formatCurrency(valuation.composicaoMultimetodos.faixaFinalMedia)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA: AEGIS — ATIVO ESTRATÉGICO DE PRODUTO / SOFTWARE PROPRIETÁRIO */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'aegis_ativo' && (
        <AegisValuationSection
          aegisConfig={aegisConfig}
          onChangeConfig={setAegisConfig}
          resultado={valuation.aegis.resultado}
          composicaoEmpresa={valuation.aegis.composicaoEmpresa}
          canWrite={canWrite}
          anoExercicio={anoSelecionado}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 7: COMPARADOR DE AVALIAÇÕES SALVAS NO HISTÓRICO */}
      {/* ========================================================================= */}
      {subAbaAtiva === 'comparador_historico' && (
        <div className="space-y-6">
          <Card className="border-neutral-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Comparador de Evolução entre Avaliações Salvas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Analise lado a lado duas avaliações históricas e veja a variação do valor
                    estimado, EBITDA e PL.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {historico.length} Registros Salvos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {historico.length < 2 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  É necessário ter pelo menos 2 avaliações salvas no histórico para comparar a
                  evolução. Salve a avaliação atual no botão superior direito "Salvar Avaliação".
                </div>
              ) : (
                <>
                  {/* Seletor das 2 Avaliações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="technical-label block text-xs">
                        Avaliação A (Mais Recente)
                      </label>
                      <select
                        value={avaliacaoComparadaAId}
                        onChange={(e) => setAvaliacaoComparadaAId(e.target.value)}
                        className="w-full h-9 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold"
                      >
                        {historico.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.titulo} ({formatDate(h.data_avaliacao)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="technical-label block text-xs">
                        Avaliação B (Referência Anterior)
                      </label>
                      <select
                        value={avaliacaoComparadaBId}
                        onChange={(e) => setAvaliacaoComparadaBId(e.target.value)}
                        className="w-full h-9 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold"
                      >
                        {historico.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.titulo} ({formatDate(h.data_avaliacao)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {itemA && itemB && (
                    <div className="overflow-x-auto rounded-lg border border-neutral-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#2D2D2D] text-white">
                          <tr>
                            <th className="py-2.5 px-4 font-bold">Métrica / Hipótese</th>
                            <th className="py-2.5 px-4 text-right font-bold text-orange-300">
                              {itemA.titulo} ({formatDate(itemA.data_avaliacao)})
                            </th>
                            <th className="py-2.5 px-4 text-right font-bold text-neutral-300">
                              {itemB.titulo} ({formatDate(itemB.data_avaliacao)})
                            </th>
                            <th className="py-2.5 px-4 text-center font-bold">
                              Variação Nominal / %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 bg-white">
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-neutral-900">
                              Valor Central Estimado (Valuation)
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value font-black text-[#D65100] bg-orange-50/40">
                              {formatCurrency(itemA.resultado_consolidado?.cenarioMedio || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value font-bold text-neutral-800">
                              {formatCurrency(itemB.resultado_consolidado?.cenarioMedio || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-center mono-value font-bold">
                              {(() => {
                                const vA = itemA.resultado_consolidado?.cenarioMedio || 0
                                const vB = itemB.resultado_consolidado?.cenarioMedio || 0
                                const diff = vA - vB
                                const pct = vB > 0 ? (diff / vB) * 100 : 0
                                return (
                                  <span
                                    className={diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}
                                  >
                                    {diff >= 0 ? '+' : ''}
                                    {formatCurrency(diff)} ({pct > 0 ? '+' : ''}
                                    {pct.toFixed(1)}%)
                                  </span>
                                )
                              })()}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-semibold text-neutral-800">
                              EBITDA Considerado
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {formatCurrency(itemA.resultado_consolidado?.ebitda || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {formatCurrency(itemB.resultado_consolidado?.ebitda || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-center mono-value">
                              {(() => {
                                const vA = itemA.resultado_consolidado?.ebitda || 0
                                const vB = itemB.resultado_consolidado?.ebitda || 0
                                const diff = vA - vB
                                const pct = vB > 0 ? (diff / vB) * 100 : 0
                                return (
                                  <span
                                    className={diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}
                                  >
                                    {diff >= 0 ? '+' : ''}
                                    {pct.toFixed(1)}%
                                  </span>
                                )
                              })()}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-semibold text-neutral-800">
                              Patrimônio Líquido Contábil
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {formatCurrency(itemA.resultado_consolidado?.patrimonioLiquido || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {formatCurrency(itemB.resultado_consolidado?.patrimonioLiquido || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-center mono-value">
                              {(() => {
                                const vA = itemA.resultado_consolidado?.patrimonioLiquido || 0
                                const vB = itemB.resultado_consolidado?.patrimonioLiquido || 0
                                const diff = vA - vB
                                const pct = vB > 0 ? (diff / vB) * 100 : 0
                                return (
                                  <span
                                    className={diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}
                                  >
                                    {diff >= 0 ? '+' : ''}
                                    {pct.toFixed(1)}%
                                  </span>
                                )
                              })()}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-semibold text-neutral-800">
                              Múltiplo Médio de EBITDA
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {itemA.multiplos_usados?.ebitdaMedio || 4.5}x
                            </td>
                            <td className="py-2.5 px-4 text-right mono-value">
                              {itemB.multiplos_usados?.ebitdaMedio || 4.5}x
                            </td>
                            <td className="py-2.5 px-4 text-center mono-value text-neutral-600">
                              {(
                                (itemA.multiplos_usados?.ebitdaMedio || 4.5) -
                                (itemB.multiplos_usados?.ebitdaMedio || 4.5)
                              ).toFixed(1)}
                              x
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: NOVO AJUSTE INTANGÍVEL */}
      {modalNovoAjusteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Adicionar Ajuste Intangível / Goodwill
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Acrescente diferenciais regulatórios ou reduza riscos contratuais ao cálculo de
              valuation.
            </p>

            <form onSubmit={handleAdicionarAjuste} className="space-y-3.5 text-xs">
              <div>
                <label className="technical-label block mb-1">Tipo de Ajuste</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovoAjusteTipo('positivo')}
                    className={`py-2 px-3 rounded-lg border font-bold transition text-xs ${
                      novoAjusteTipo === 'positivo'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    + Acréscimo (Ativo Intangível)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoAjusteTipo('negativo')}
                    className={`py-2 px-3 rounded-lg border font-bold transition text-xs ${
                      novoAjusteTipo === 'negativo'
                        ? 'bg-rose-50 border-rose-400 text-rose-800'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    - Dedução (Risco / Contingência)
                  </button>
                </div>
              </div>

              <div>
                <label className="technical-label block mb-1">Título / Descrição</label>
                <Input
                  required
                  placeholder="Ex: Credenciamentos ANAC e deferimentos no CINDACTA"
                  value={novoAjusteTitulo}
                  onChange={(e) => setNovoAjusteTitulo(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="technical-label block mb-1">Valor (R$)</label>
                  <Input
                    required
                    type="number"
                    step="1000"
                    min="1"
                    placeholder="Ex: 100000"
                    value={novoAjusteValor}
                    onChange={(e) => setNovoAjusteValor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="technical-label block mb-1">Categoria</label>
                  <select
                    aria-label="Categoria do Ajuste Intangível"
                    value={novoAjusteCategoria}
                    onChange={(e) =>
                      setNovoAjusteCategoria(e.target.value as AjusteSubjetivoItem['categoria'])
                    }
                    className="w-full h-9 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="reputacao_decea_anac">Reputação DECEA / ANAC</option>
                    <option value="acervo_tecnico">Acervo Técnico Especializado</option>
                    <option value="carteira_clientes">Carteira de Clientes Ativa</option>
                    <option value="equipe_tecnica">Equipe Técnica / RTs</option>
                    <option value="passivo_contingente">Passivo Contingente</option>
                    <option value="outro">Outro Intangível</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="technical-label block mb-1">Justificativa Técnica</label>
                <textarea
                  rows={2}
                  placeholder="Fundamentação técnica para o acréscimo ou dedução..."
                  value={novoAjusteJustificativa}
                  onChange={(e) => setNovoAjusteJustificativa(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF6A13]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNovoAjusteAberto(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
                >
                  Confirmar e Somar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SALVAR AVALIAÇÃO OFICIAL */}
      {modalSalvarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Salvar Avaliação no Histórico da Empresa
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Os 4 métodos, sensibilidade e hipóteses calculadas serão arquivados na coleção de
              valuations da AEROCAD.
            </p>

            <form onSubmit={handleSalvarAvaliacao} className="space-y-3.5 text-xs">
              <div>
                <label className="technical-label block mb-1">Título da Avaliação</label>
                <Input
                  required
                  value={tituloSalvar}
                  onChange={(e) => setTituloSalvar(e.target.value)}
                  placeholder="Ex: Valuation Multimétodos AEROCAD 2026"
                  className="text-xs font-semibold"
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Exercício de Referência:</span>
                  <strong className="text-neutral-900">Exercício {anoSelecionado}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Faixa Calculada:</span>
                  <strong className="mono-value text-[#D65100]">
                    {valuation.resultadoFinal.faixaEstimada}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Valor Central:</span>
                  <strong className="mono-value text-neutral-900 font-bold">
                    {formatCurrency(valuation.resultadoFinal.cenarioMedioTotal)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Responsável:</span>
                  <strong className="text-neutral-700">{usuarioNome}</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalSalvarAberto(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={salvandoValuation}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
                >
                  {salvandoValuation ? 'Salvando...' : 'Salvar Oficialmente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO DE VALUATIONS */}
      {modalHistoricoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#FF6A13]" />
                <h3 className="text-base font-bold text-neutral-900">
                  Histórico de Avaliações Salvas
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalHistoricoAberto(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {carregandoHistorico ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                Carregando avaliações salvas...
              </div>
            ) : historico.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                Nenhuma avaliação foi salva anteriormente. Salve o cenário atual para registrar no
                histórico.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border rounded-xl overflow-hidden bg-white text-xs">
                {historico.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-neutral-900">{item.titulo}</strong>
                        <Badge variant="outline" className="text-[10px]">
                          {formatDate(item.data_avaliacao)}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {item.periodo_referencia} · Emissor: {item.usuario_nome || 'Diretoria'}
                      </p>
                      {item.resultado_consolidado && (
                        <div className="flex items-center gap-3 text-[11px] pt-1">
                          <span className="text-neutral-500">
                            Cenário Central:{' '}
                            <strong className="mono-value text-[#D65100]">
                              {formatCurrency(item.resultado_consolidado.cenarioMedio || 0)}
                            </strong>
                          </span>
                          <span className="text-neutral-400">|</span>
                          <span className="text-neutral-500">
                            PL:{' '}
                            <strong className="mono-value">
                              {formatCurrency(item.resultado_consolidado.patrimonioLiquido || 0)}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCarregarDoHistorico(item)}
                        className="text-xs hover:border-[#FF6A13] hover:text-[#D65100]"
                      >
                        Carregar Parâmetros
                      </Button>

                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAvaliacaoExcluindo(item)}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {avaliacaoExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border text-xs">
            <h3 className="text-sm font-bold text-neutral-900 mb-2">Excluir Avaliação?</h3>
            <p className="text-neutral-600 mb-4">
              Deseja realmente remover o registro "{avaliacaoExcluindo.titulo}" do histórico oficial
              da empresa?
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setAvaliacaoExcluindo(null)}>
                Cancelar
              </Button>
              <Button size="sm" variant="destructive" onClick={handleConfirmarExclusao}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO E IMPRESSÃO A4 (RELATÓRIO INSTITUCIONAL APROFUNDADO) */}
      {modalVisualizarA4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border p-4 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Relatório Executivo Aprofundado de Valuation — AEROCAD A4
                </h3>
                <p className="text-xs text-neutral-500">
                  Prancheta técnica oficial com os 4 métodos, séries históricas, FCD, matriz de
                  sensibilidade e conclusão ponderada.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleImprimirA4}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Imprimir / Salvar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setModalVisualizarA4(false)}>
                  Fechar
                </Button>
              </div>
            </div>

            {/* DOCUMENTO RENDERIZADO NO TEMPLATE INSTITUCIONAL A4 */}
            <div
              id="print-valuation-a4"
              className="border rounded-xl shadow-inner bg-neutral-50 p-2 sm:p-4 overflow-x-auto"
            >
              <AerocadRelatorioA4
                titulo="Relatório Executivo de Avaliação da Empresa (Valuation Multimétodos)"
                subtitulo={`Avaliação patrimonial, fluxo de caixa descontado (FCD) e múltiplos — Exercício ${anoSelecionado}`}
                referenciaPeriodo={`Exercício ${anoSelecionado}`}
                responsavelNome={usuarioNome}
                resumoKpis={[
                  {
                    rotulo: 'Piso Conservador',
                    valorFormatado: formatCurrency(
                      valuation.resultadoFinal.cenarioConservadorTotal,
                    ),
                    cor: 'neutro',
                  },
                  {
                    rotulo: 'Valor Central (Referência)',
                    valorFormatado: formatCurrency(valuation.resultadoFinal.cenarioMedioTotal),
                    destaque: true,
                    cor: 'laranja',
                  },
                  {
                    rotulo: 'Teto Otimista',
                    valorFormatado: formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal),
                    cor: 'verde',
                  },
                  {
                    rotulo: 'Patrimônio Líquido (PL)',
                    valorFormatado: formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil),
                    cor: 'neutro',
                  },
                  {
                    rotulo: 'Ativo AEGIS (Software Hoje)',
                    valorFormatado: formatCurrency(
                      valuation.aegis.resultado.valuationHoje.referencia,
                    ),
                    destaque: true,
                    cor: 'laranja',
                  },
                  {
                    rotulo: 'Consolidado c/ AEGIS Hoje',
                    valorFormatado: formatCurrency(
                      valuation.aegis.composicaoEmpresa.visaoServicosMaisAegisBase.base,
                    ),
                    destaque: true,
                    cor: 'laranja',
                  },
                  {
                    rotulo: 'Consolidado em Escala (3-5a)',
                    valorFormatado: formatCurrency(
                      valuation.aegis.composicaoEmpresa.visaoCenarioEscala.base,
                    ),
                    destaque: true,
                    cor: 'verde',
                  },
                  {
                    rotulo: 'Poder Multiplicador AEGIS',
                    valorFormatado: `${valuation.aegis.composicaoEmpresa.visaoCenarioEscala.multiplicadorTotalSobreServicos.toFixed(2)}x`,
                    destaque: true,
                    cor: 'verde',
                  },
                ]}
                secoes={[
                  {
                    titulo: '1. Sumário Executivo & Conclusão Ponderada',
                    subtitulo:
                      'Consolidação dos 4 métodos de avaliação com ponderação recomendada pela diretoria',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Método de Avaliação', largura: '38%' },
                        { cabecalho: 'Peso %', alinhamento: 'center' },
                        { cabecalho: 'Conservador', alinhamento: 'right' },
                        { cabecalho: 'Médio / Referência', alinhamento: 'right' },
                        { cabecalho: 'Otimista', alinhamento: 'right' },
                        { cabecalho: 'Contribuição', alinhamento: 'right' },
                      ],
                      linhas: valuation.composicaoMultimetodos.metodos.map((m) => [
                        { conteudo: m.nome },
                        { conteudo: `${(m.peso * 100).toFixed(0)}%`, alinhamento: 'center' },
                        { conteudo: formatCurrency(m.valorConservador), alinhamento: 'right' },
                        {
                          conteudo: formatCurrency(m.valorMedio),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        { conteudo: formatCurrency(m.valorOtimista), alinhamento: 'right' },
                        {
                          conteudo: formatCurrency(m.valorPonderadoContribuicao),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ]),
                      linhaTotal: [
                        { conteudo: 'VALUATION TOTAL ESTIMADO AEROCAD', destaque: true },
                        { conteudo: '100%', alinhamento: 'center' },
                        {
                          conteudo: formatCurrency(
                            valuation.resultadoFinal.cenarioConservadorTotal,
                          ),
                          alinhamento: 'right',
                        },
                        {
                          conteudo: formatCurrency(valuation.resultadoFinal.cenarioMedioTotal),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        {
                          conteudo: formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal),
                          alinhamento: 'right',
                        },
                        {
                          conteudo: formatCurrency(valuation.resultadoFinal.cenarioMedioTotal),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                    },
                  },
                  {
                    titulo:
                      '2. Método 1: Fluxo de Caixa Descontado (FCD / DCF 5 Anos + Perpetuidade)',
                    subtitulo: `Projeção explícita de 5 anos com WACC de ${(valuation.dcf.parametros.wacc * 100).toFixed(1)}% e taxa de perpetuidade g de ${(valuation.dcf.parametros.crescimentoPerpetuo * 100).toFixed(1)}%`,
                    tabela: {
                      colunas: [
                        { cabecalho: 'Ano Projeção', largura: '20%' },
                        { cabecalho: 'Cresc. %', alinhamento: 'center' },
                        { cabecalho: 'Receita Líquida', alinhamento: 'right' },
                        { cabecalho: 'EBITDA', alinhamento: 'right' },
                        { cabecalho: 'Fluxo Livre (FCL)', alinhamento: 'right' },
                        { cabecalho: 'Fator', alinhamento: 'center' },
                        { cabecalho: 'VPL Presente', alinhamento: 'right' },
                      ],
                      linhas: valuation.dcf.projecoesAnuais.map((p) => [
                        { conteudo: `Ano ${p.anoNumero} (${p.ano})` },
                        {
                          conteudo: `${(p.taxaCrescimento * 100).toFixed(1)}%`,
                          alinhamento: 'center',
                        },
                        { conteudo: formatCurrency(p.receitaLiquida), alinhamento: 'right' },
                        { conteudo: formatCurrency(p.ebitda), alinhamento: 'right' },
                        { conteudo: formatCurrency(p.fluxoCaixaLivre), alinhamento: 'right' },
                        { conteudo: p.fatorDesconto.toFixed(4), alinhamento: 'center' },
                        {
                          conteudo: formatCurrency(p.fluxoPresente),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ]),
                      linhaTotal: [
                        { conteudo: 'VALOR PATRIMONIAL FCD (EQUITY VALUE)', destaque: true },
                        { conteudo: '—', alinhamento: 'center' },
                        { conteudo: '—', alinhamento: 'right' },
                        {
                          conteudo: `VPL Explícitos: ${formatCurrency(valuation.dcf.somaVplFluxosExplicitos)}`,
                          alinhamento: 'right',
                        },
                        {
                          conteudo: `Perpetuidade: ${formatCurrency(valuation.dcf.valorPerpetuidadePresente)}`,
                          alinhamento: 'right',
                        },
                        { conteudo: 'Caixa Líq.', alinhamento: 'center' },
                        {
                          conteudo: formatCurrency(valuation.dcf.valorPatrimonialFcd),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                    },
                  },
                  {
                    titulo: '3. Método 2: Matriz de Sensibilidade Bidimensional (WACC × Taxa g)',
                    subtitulo:
                      'Sensibilidade do valor patrimonial FCD variando taxas de desconto e crescimento perpétuo',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Taxa WACC \\ Taxa g', largura: '30%' },
                        ...valuation.matrizSensibilidade[0].map((col) => ({
                          cabecalho: `g = ${(col.crescimentoPerpetuo * 100).toFixed(1)}% (${col.deltaG})`,
                          alinhamento: 'right' as const,
                        })),
                      ],
                      linhas: valuation.matrizSensibilidade.map((linha) => [
                        {
                          conteudo: `WACC = ${(linha[0].wacc * 100).toFixed(1)}% (${linha[0].deltaWacc})`,
                          destaque: linha[0].deltaWacc === 'Base',
                        },
                        ...linha.map((cel) => ({
                          conteudo: formatCurrency(cel.valorFcd),
                          alinhamento: 'right' as const,
                          destaque: cel.isBase,
                        })),
                      ]),
                    },
                  },
                  {
                    titulo:
                      '4. Método 3 & 4: Múltiplos de Mercado & Valor Substantivo (Ativo Ajustado)',
                    subtitulo:
                      'Patrimônio Líquido ajustado por licenças/acervo ANAC e múltiplos operacionais',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Base Metodológica', largura: '40%' },
                        { cabecalho: 'Conservador', alinhamento: 'right' },
                        { cabecalho: 'Médio / Referência', alinhamento: 'right' },
                        { cabecalho: 'Otimista', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: 'Múltiplos sobre EBITDA (3.0x / 4.5x / 6.0x)' },
                          {
                            conteudo: formatCurrency(valuation.cenariosEbitda.conservador),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(valuation.cenariosEbitda.medio),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(valuation.cenariosEbitda.otimista),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: 'Múltiplos sobre Receita Líquida (0.5x / 0.8x / 1.2x)' },
                          {
                            conteudo: formatCurrency(valuation.cenariosReceita.conservador),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(valuation.cenariosReceita.medio),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(valuation.cenariosReceita.otimista),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: 'Patrimônio Líquido Contábil (Balanço Real)' },
                          {
                            conteudo: formatCurrency(
                              valuation.patrimonio.patrimonioLiquidoContabil,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.patrimonio.patrimonioLiquidoContabil,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.patrimonio.patrimonioLiquidoContabil,
                            ),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(+) Acervo Técnico e Intangíveis Regulatórios DECEA/ANAC' },
                          {
                            conteudo: formatCurrency(valuation.ajustes.totalLiquidoIntangiveis),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(valuation.ajustes.totalLiquidoIntangiveis),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(valuation.ajustes.totalLiquidoIntangiveis),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(=) Valor Substantivo Ajustado Final', destaque: true },
                          {
                            conteudo: formatCurrency(
                              valuation.valorSubstantivo.cenariosSubstantivo.conservador,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.valorSubstantivo.valorSubstantivoAjustado,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.valorSubstantivo.cenariosSubstantivo.otimista,
                            ),
                            alinhamento: 'right',
                          },
                        ],
                      ],
                    },
                  },
                  {
                    titulo: '5. Série Histórica Multianual & Qualidade da Receita',
                    subtitulo: 'Evolução por competência e concentração da carteira de clientes',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Exercício', largura: '15%' },
                        { cabecalho: 'Receita Bruta', alinhamento: 'right' },
                        { cabecalho: 'Var. Rec. %', alinhamento: 'center' },
                        { cabecalho: 'EBITDA', alinhamento: 'right' },
                        { cabecalho: 'Margem EBITDA', alinhamento: 'center' },
                        { cabecalho: 'Lucro Líquido', alinhamento: 'right' },
                      ],
                      linhas: valuation.serieHistorica.map((s) => [
                        { conteudo: `Exercício ${s.ano}`, destaque: s.ano === anoSelecionado },
                        { conteudo: formatCurrency(s.receitaBruta), alinhamento: 'right' },
                        {
                          conteudo:
                            s.variacaoReceitaPercentual !== null
                              ? `${s.variacaoReceitaPercentual > 0 ? '+' : ''}${s.variacaoReceitaPercentual.toFixed(1)}%`
                              : '—',
                          alinhamento: 'center',
                        },
                        {
                          conteudo: formatCurrency(s.ebitda),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        { conteudo: `${s.margemEbitda.toFixed(1)}%`, alinhamento: 'center' },
                        { conteudo: formatCurrency(s.lucroLiquido), alinhamento: 'right' },
                      ]),
                    },
                  },
                  {
                    titulo:
                      '6. AEGIS — Ativo Estratégico de Software Proprietário (Dimensionamento SAM & Cenários ARR)',
                    subtitulo: `Plataforma plugin QGIS v1.9.384 para automação ICA 11-408/2020 DECEA, DXF oficial, KMZ 3D e OPEA (${valuation.aegis.config.premissasMercado.totalSitiosBrasil.toLocaleString('pt-BR')} sítios no Brasil)`,
                    tabela: {
                      colunas: [
                        { cabecalho: 'Segmento do SAM Brasil', largura: '36%' },
                        { cabecalho: 'Qtd.', alinhamento: 'center' },
                        { cabecalho: 'Preço Assento/Ano', alinhamento: 'right' },
                        { cabecalho: 'Potencial Anual (SAM)', alinhamento: 'right' },
                        { cabecalho: 'Part. % SAM', alinhamento: 'center' },
                      ],
                      linhas: valuation.aegis.resultado.segmentosDetalhados.map((s) => [
                        { conteudo: s.nome },
                        { conteudo: s.quantidade.toString(), alinhamento: 'center' },
                        { conteudo: formatCurrency(s.precoAno), alinhamento: 'right' },
                        {
                          conteudo: formatCurrency(s.potencialAnual),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        { conteudo: `${s.participacaoSam.toFixed(1)}%`, alinhamento: 'center' },
                      ]),
                      linhaTotal: [
                        { conteudo: 'TOTAL SAM BRASIL (TAM LATAM ≈ 5x SAM)', destaque: true },
                        { conteudo: '—', alinhamento: 'center' },
                        { conteudo: '—', alinhamento: 'right' },
                        {
                          conteudo: formatCurrency(valuation.aegis.resultado.samBrasilTotal),
                          alinhamento: 'right',
                          destaque: true,
                        },
                        { conteudo: '100.0%', alinhamento: 'center' },
                      ],
                    },
                  },
                  {
                    titulo:
                      '7. Projeção de ARR do AEGIS em Escala & Múltiplos SaaS Vertical (5x a 8x)',
                    subtitulo:
                      'Valuation por ARR projetado em 3 a 5 anos com desconto de risco e estágio inicial',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Cenário de Escala', largura: '28%' },
                        { cabecalho: 'Captura SAM %', alinhamento: 'center' },
                        { cabecalho: 'ARR Projetado', alinhamento: 'right' },
                        { cabecalho: 'Múltiplo ARR', alinhamento: 'center' },
                        { cabecalho: 'Valuation Bruto', alinhamento: 'right' },
                        { cabecalho: 'Valuation Ajustado', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: 'Conservador (Piso de Escala, 3 anos)' },
                          {
                            conteudo: `${(valuation.aegis.resultado.cenariosEscala.conservador.percentualCapturaSam * 100).toFixed(0)}%`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.conservador.arrProjetado,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.aegis.resultado.cenariosEscala.conservador.multiploAplicado}x`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.conservador
                                .valuationBrutoMultiplo,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.conservador
                                .valuationComDescontoEstagio,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                        ],
                        [
                          { conteudo: 'Base (Equilibrado / Referência, 5 anos)', destaque: true },
                          {
                            conteudo: `${(valuation.aegis.resultado.cenariosEscala.base.percentualCapturaSam * 100).toFixed(0)}%`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.base.arrProjetado,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.aegis.resultado.cenariosEscala.base.multiploAplicado}x`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.base.valuationBrutoMultiplo,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.base
                                .valuationComDescontoEstagio,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                        ],
                        [
                          { conteudo: 'Otimista / Acelerado (5 anos)' },
                          {
                            conteudo: `${(valuation.aegis.resultado.cenariosEscala.otimista.percentualCapturaSam * 100).toFixed(0)}%`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.otimista.arrProjetado,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.aegis.resultado.cenariosEscala.otimista.multiploAplicado}x`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.otimista
                                .valuationBrutoMultiplo,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.resultado.cenariosEscala.otimista
                                .valuationComDescontoEstagio,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                        ],
                      ],
                    },
                  },
                  {
                    titulo:
                      '8. Composição Estratégica Consolidada: Aerocad (Serviços) + Ativo AEGIS (Software)',
                    subtitulo:
                      'Demonstrativo do poder multiplicador do AEGIS sobre o valor da companhia nas três visões estratégicas',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Visão Estratégica de Negociação', largura: '38%' },
                        { cabecalho: 'Piso Conservador', alinhamento: 'right' },
                        { cabecalho: 'Base / Referência', alinhamento: 'right' },
                        { cabecalho: 'Teto Otimista', alinhamento: 'right' },
                        { cabecalho: 'Ganho s/ Serviços %', alinhamento: 'center' },
                      ],
                      linhas: [
                        [
                          { conteudo: '1. Somente Operação de Serviços (Situação Atual)' },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoSomenteServicos.conservador,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoSomenteServicos.base,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoSomenteServicos.otimista,
                            ),
                            alinhamento: 'right',
                          },
                          { conteudo: '0.0%', alinhamento: 'center' },
                        ],
                        [
                          {
                            conteudo: '2. Serviços + AEGIS Hoje (Base Inicial Recomendada)',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoServicosMaisAegisBase
                                .conservador,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoServicosMaisAegisBase.base,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoServicosMaisAegisBase.otimista,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `+${valuation.aegis.composicaoEmpresa.visaoServicosMaisAegisBase.ganhoPercentualSobreServicos.toFixed(1)}%`,
                            alinhamento: 'center',
                            destaque: true,
                          },
                        ],
                        [
                          {
                            conteudo: '3. Cenário de Escala Consolidado (3 a 5 Anos)',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoCenarioEscala.conservador,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoCenarioEscala.base,
                            ),
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: formatCurrency(
                              valuation.aegis.composicaoEmpresa.visaoCenarioEscala.otimista,
                            ),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.aegis.composicaoEmpresa.visaoCenarioEscala.multiplicadorTotalSobreServicos.toFixed(2)}x (+${valuation.aegis.composicaoEmpresa.visaoCenarioEscala.ganhoPercentualSobreServicos.toFixed(0)}%)`,
                            alinhamento: 'center',
                            destaque: true,
                          },
                        ],
                      ],
                    },
                  },
                ]}
                observacoesFinais={`Relatório gerado pelo CRM AEROCAD — Uso interno da diretoria executiva. RESSALVA OBRIGATÓRIA: Os produtos e estimativas do AEGIS constituem apoio técnico à decisão e não substituem a análise e os pareceres das autoridades regulatórias aeronáuticas (DECEA/COMAER, ANAC e órgãos municipais). A responsabilidade técnica é do RT mediante ART/RRT. Os números de mercado marcados dependem de validação formal pela administração e não constituem aconselhamento financeiro ou garantia de aprovação. Índice de Confiança do Ativo AEGIS: ${valuation.aegis.resultado.indiceConfianca.score}% (${valuation.aegis.resultado.indiceConfianca.nivel.toUpperCase()}). Todos os cálculos refletem as demonstrações contábeis e lançamentos registrados até ${new Date().toLocaleDateString('pt-BR')}.`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
