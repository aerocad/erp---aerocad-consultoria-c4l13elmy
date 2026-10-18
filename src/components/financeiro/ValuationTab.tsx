import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  Scale,
  Calculator,
  Save,
  Download,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Building2,
  DollarSign,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
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
} from 'lucide-react'
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
  type MultiplosConfig,
  type AjusteSubjetivoItem,
  type ValuationCalculado,
  type ValuationRecordItem,
} from '@/services/valuationService'
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
} from '@/types/crm'

export interface ValuationTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  contasBancarias: ContaBancariaRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  balancetes?: BalanceteMensalRecord[]
  canWrite?: boolean
  canDelete?: boolean
  userRole?: string
  usuarioNome?: string
  usuarioId?: string
  onNavigateTab?: (tab: string) => void
}

export function ValuationTab({
  parcelas = [],
  contasPagar = [],
  contasReceber = [],
  contasBancarias = [],
  ativosPatrimonio = [],
  extratosTransacoes = [],
  balancetes = [],
  canWrite = true,
  canDelete = false,
  userRole = 'financeiro',
  usuarioNome = 'Diretoria AEROCAD',
  usuarioId,
  onNavigateTab,
}: ValuationTabProps) {
  // Estado de controle de ano de exercício
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

  // Múltiplos editáveis pelo usuário (com default plausível)
  const [multiplos, setMultiplos] = useState<MultiplosConfig>(MULTIPLOS_PADRAO)

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

  // Modais e visualizações
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

  // Carregar histórico inicial
  const carregarHistorico = async () => {
    try {
      setCarregandoHistorico(true)
      const lista = await listarValuations()
      setHistorico(lista)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  useEffect(() => {
    carregarHistorico()
  }, [])

  // CÁLCULO DINÂMICO REATIVO DO VALUATION (leve e executado ao abrir ou ao alterar parâmetros)
  const valuation: ValuationCalculado = useMemo(() => {
    return calcularValuationAerocad({
      parcelas,
      contasPagar,
      contasReceber,
      contasBancarias,
      ativosPatrimonio,
      extratosTransacoes,
      balancetes,
      empresa,
      anoExercicio: anoSelecionado,
      multiplos,
      ajustesSubjetivos: ajustes,
    })
  }, [
    parcelas,
    contasPagar,
    contasReceber,
    contasBancarias,
    ativosPatrimonio,
    extratosTransacoes,
    balancetes,
    empresa,
    anoSelecionado,
    multiplos,
    ajustes,
  ])

  // Ações de Ajustes Subjetivos
  const handleAdicionarAjuste = (e: React.FormEvent) => {
    e.preventDefault()
    const val = Number(novoAjusteValor.replace(/\D/g, '')) / 100 || Number(novoAjusteValor) || 0
    if (!novoAjusteTitulo.trim() || val <= 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Informe uma descrição e um valor monetário positivo válido para o ajuste.',
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
      description: 'O valor foi incorporado ao cálculo consolidado do valuation.',
    })
  }

  const handleRemoverAjuste = (id: string) => {
    setAjustes((prev) => prev.filter((a) => a.id !== id))
    toast({
      title: 'Ajuste removido',
      description: 'O recálculo foi atualizado automaticamente.',
    })
  }

  // Ação de Salvar Avaliação
  const handleSalvarAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tituloSalvar.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Dê um nome para identificar esta avaliação (ex: Valuation Anual 2026).',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoValuation(true)
      await salvarValuation({
        titulo: tituloSalvar.trim(),
        periodoReferencia: `Exercício ${anoSelecionado}`,
        metodoPrincipal: 'combinado',
        multiplos,
        ajustes,
        resultado: valuation,
        usuarioId,
        usuarioNome,
        observacoes: `Avaliação consolidada da AEROCAD. Faixa: ${valuation.resultadoFinal.faixaEstimada}. Confiabilidade: ${valuation.confiabilidade.percentualConfiabilidade}%.`,
      })

      toast({
        title: 'Valuation salvo com sucesso!',
        description: 'A avaliação foi arquivada no histórico oficial da empresa.',
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

  // Ação de Excluir do Histórico
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

  // Ação de Restaurar/Duplicar Parâmetros do Histórico
  const handleCarregarDoHistorico = (item: ValuationRecordItem) => {
    if (item.multiplos_usados) {
      setMultiplos(item.multiplos_usados)
    }
    if (Array.isArray(item.ajustes_subjetivos)) {
      setAjustes(item.ajustes_subjetivos)
    }
    toast({
      title: 'Cenário restaurado',
      description: `Múltiplos e ajustes da avaliação "${item.titulo}" foram carregados na tela.`,
    })
    setModalHistoricoAberto(false)
  }

  // Ação de Exportar Planilha XLSX
  const handleExportarXlsx = async () => {
    try {
      await exportarValuationXlsx(valuation, usuarioNome)
      toast({
        title: 'Exportação Concluída',
        description: 'Planilha XLSX de Valuation gerada com 4 abas estruturadas.',
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

  // Ação de Imprimir Relatório Oficial A4
  const handleImprimirA4 = () => {
    const ok = imprimirElementoA4({
      elementId: 'print-valuation-a4',
      titulo: `Valuation Econômico — ${valuation.empresa.nomeFantasia}`,
      orientacao: 'portrait',
    })
    if (!ok) {
      toast({
        title: 'Impressão direta',
        description: 'Preparando impressão da prancheta técnica...',
      })
      setTimeout(() => window.print(), 200)
    }
  }

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
                Módulo Econômico
              </span>
              <span className="text-xs font-medium text-neutral-500">
                AEROCAD Consultoria & Aeroportos
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
              Valuation Contábil & Econômico
            </h1>
            <p className="text-sm text-neutral-600 max-w-2xl">
              Avaliação de mercado combinando <strong>Patrimônio Líquido contábil</strong>,{' '}
              <strong>Múltiplos de EBITDA</strong>, <strong>Múltiplos de Receita</strong> e{' '}
              <strong>Intangíveis Regulatórios</strong> a partir dos lançamentos e balanços reais.
            </p>
          </div>

          {/* Barra de Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs shadow-2xs">
              <Calendar className="h-4 w-4 text-[#FF6A13]" />
              <span className="font-semibold text-neutral-700">Ano:</span>
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
              className="border-neutral-300 hover:border-emerald-600 text-neutral-700 hover:text-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
              Exportar XLSX
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalVisualizarA4(true)}
              className="border-neutral-300 hover:border-blue-600 text-neutral-700 hover:text-blue-700"
            >
              <FileText className="h-4 w-4 mr-1.5 text-blue-600" />
              Relatório A4 / PDF
            </Button>

            {canWrite && (
              <Button
                size="sm"
                onClick={() => {
                  setTituloSalvar(`Valuation AEROCAD — Exercício ${anoSelecionado}`)
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

      {/* 2. AVISO DE CONFIABILIDADE DOS DADOS CONTÁBEIS */}
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

          {/* Atalho para regularizar lançamentos se houver pendências */}
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

      {/* 3. QUADRO-RESUMO FINAL DO VALUATION (DESTAQUE MÁXIMO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cenário Conservador */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">
              <span>Cenário Conservador</span>
              <Badge variant="outline" className="border-neutral-300 text-neutral-600 text-[10px]">
                Múltiplo 3.0×
              </Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-800 mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioConservadorTotal)}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Ponderação prudente com foco estrito em ativos e múltiplos defensivos.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-600 space-y-1">
            <div className="flex justify-between">
              <span>Múltiplo s/ EBITDA:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosEbitda.conservador)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Múltiplo s/ Receita:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosReceita.conservador)}
              </strong>
            </div>
          </div>
        </div>

        {/* Cenário Médio (Referência Central) */}
        <div className="rounded-xl border-2 border-[#FF6A13] bg-gradient-to-b from-[#FFF9F5] to-white p-5 shadow-sm flex flex-col justify-between relative ring-2 ring-[#FF6A13]/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6A13] text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-2xs">
            Valor de Referência
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-[#D65100] font-bold uppercase tracking-wider mb-2 mt-1">
              <span>Cenário Central / Médio</span>
              <Badge className="bg-[#FF6A13] text-white text-[10px] font-bold">Múltiplo 4.5×</Badge>
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#FF6A13] mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioMedioTotal)}
            </div>
            <p className="text-xs text-neutral-600 mt-2">
              Combinação balanceada de capacidade operacional, contratos e reputação técnica.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-orange-100 text-[11px] text-neutral-700 space-y-1">
            <div className="flex justify-between">
              <span>Múltiplo s/ EBITDA:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosEbitda.medio)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Múltiplo s/ Receita:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosReceita.medio)}
              </strong>
            </div>
            <div className="flex justify-between text-[#D65100] font-bold pt-1">
              <span>Intangíveis somados:</span>
              <strong className="mono-value">
                +{formatCurrency(valuation.ajustes.totalLiquidoIntangiveis)}
              </strong>
            </div>
          </div>
        </div>

        {/* Cenário Otimista */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-emerald-700 font-bold uppercase tracking-wider mb-2">
              <span>Cenário Otimista</span>
              <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-[10px]">
                Múltiplo 6.0×
              </Badge>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-800 mono-value">
              {formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal)}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Premissa de aceleração de demanda por infraestrutura e aviação regional.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-600 space-y-1">
            <div className="flex justify-between">
              <span>Múltiplo s/ EBITDA:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosEbitda.otimista)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Múltiplo s/ Receita:</span>
              <strong className="mono-value">
                {formatCurrency(valuation.cenariosReceita.otimista)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. OS TRÊS PILARES DO CÁLCULO (PATRIMÔNIO, RENTABILIDADE E FLUXO PROJETADO) */}
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
                    Método Contábil (Balanço Real)
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
              <span className="text-neutral-600">Disponibilidades (Contas PJ):</span>
              <strong className="mono-value text-neutral-900">
                {formatCurrency(valuation.patrimonio.disponibilidadesBancarias)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Contas a Receber / Medições:</span>
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
                    Capacidade de Geração de Caixa
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

        {/* PILAR 3: FLUXO DE CAIXA PROJETADO & CONTRATOS */}
        <Card className="border-neutral-200/90 shadow-2xs">
          <CardHeader className="pb-3 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-neutral-900">
                    3. Fluxo de Caixa Projetado
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Carteira a Realizar & Médias
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Projeção
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Total a Receber Previsto em Aberto:</span>
              <strong className="mono-value text-sky-700 font-bold">
                {formatCurrency(valuation.fluxoProjetado.totalReceberPrevistoAberto)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Parcelas Contratuais em Carteira:</span>
              <strong className="mono-value text-neutral-900">
                {valuation.fluxoProjetado.parcelasContratuaisQtd} parcelas
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Média de Receita Mensal Realizada:</span>
              <strong className="mono-value text-neutral-900">
                {formatCurrency(valuation.fluxoProjetado.mediaReceitaMensalRealizada)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-100 text-rose-600">
              <span>Média de Despesa Mensal Realizada:</span>
              <strong className="mono-value">
                -{formatCurrency(valuation.fluxoProjetado.mediaDespesaMensalRealizada)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-neutral-100 bg-neutral-50 px-2 rounded">
              <span className="font-semibold text-neutral-700">
                Resultado Operacional Médio/Mês:
              </span>
              <strong className="mono-value text-neutral-900">
                {formatCurrency(valuation.fluxoProjetado.mediaResultadoMensal)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-2 bg-sky-50/70 border border-sky-200 px-2.5 rounded-lg text-sm text-sky-950">
              <div>
                <span className="font-black uppercase tracking-tight block">
                  Projeção Resultado 12 Meses:
                </span>
                <span className="text-[10px] text-sky-700 font-normal">
                  Com base na média histórica realizada
                </span>
              </div>
              <strong className="mono-value font-black text-base">
                {formatCurrency(valuation.fluxoProjetado.projecao12MesesResultado)}
              </strong>
            </div>
            <div className="flex justify-between items-center py-1 text-neutral-600">
              <span>Cobertura de Caixa Atual:</span>
              <strong className="mono-value font-bold text-neutral-900">
                {valuation.indicadoresApoio.coberturaCustosFixosMeses.toFixed(1)} meses de custos
                fixos
              </strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. CONFIGURAÇÃO DE MÚLTIPLOS DE MERCADO (EDITÁVEIS COM RECÁLCULO INSTANTÂNEO) */}
      <Card className="border-neutral-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-50 text-[#FF6A13]">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-neutral-900">
                  Hipóteses & Múltiplos de Mercado Configuráveis
                </CardTitle>
                <CardDescription className="text-xs">
                  Ajuste os múltiplos aplicados sobre o EBITDA e a Receita Líquida para recalcular
                  os cenários em tempo real.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMultiplos(MULTIPLOS_PADRAO)}
              className="text-xs text-neutral-500 hover:text-[#FF6A13]"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Restaurar Padrões de Mercado
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco Múltiplos EBITDA */}
            <div className="space-y-3 p-4 bg-neutral-50/60 rounded-xl border border-neutral-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                  Múltiplos sobre EBITDA
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">
                  Padrão Setorial (3x a 6x)
                </Badge>
              </div>
              <p className="text-[11px] text-neutral-500">
                Avalia quantas vezes o lucro operacional antes de impostos e depreciação a empresa
                vale.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="technical-label block text-[10px] mb-1">Conservador</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      value={multiplos.ebitdaConservador}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          ebitdaConservador: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-neutral-400">×</span>
                  </div>
                </div>

                <div>
                  <label className="technical-label block text-[10px] mb-1">Médio (Base)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      value={multiplos.ebitdaMedio}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          ebitdaMedio: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs text-[#FF6A13] border-orange-300"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-orange-400">×</span>
                  </div>
                </div>

                <div>
                  <label className="technical-label block text-[10px] mb-1">Otimista</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      value={multiplos.ebitdaOtimista}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          ebitdaOtimista: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-neutral-400">×</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Múltiplos Receita */}
            <div className="space-y-3 p-4 bg-neutral-50/60 rounded-xl border border-neutral-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                  Múltiplos sobre Receita Líquida
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">
                  Padrão Consultivo (0.5x a 1.2x)
                </Badge>
              </div>
              <p className="text-[11px] text-neutral-500">
                Avalia a empresa como fração do volume total anualizado de contratos de engenharia.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="technical-label block text-[10px] mb-1">Conservador</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="10"
                      value={multiplos.receitaConservador}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          receitaConservador: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-neutral-400">×</span>
                  </div>
                </div>

                <div>
                  <label className="technical-label block text-[10px] mb-1">Médio (Base)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="10"
                      value={multiplos.receitaMedio}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          receitaMedio: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs text-[#FF6A13] border-orange-300"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-orange-400">×</span>
                  </div>
                </div>

                <div>
                  <label className="technical-label block text-[10px] mb-1">Otimista</label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="10"
                      value={multiplos.receitaOtimista}
                      onChange={(e) =>
                        setMultiplos((prev) => ({
                          ...prev,
                          receitaOtimista: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="font-mono text-center font-bold text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-neutral-400">×</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela Comparativa de Cenários Lado a Lado */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#2D2D2D] text-white">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Método / Múltiplo</th>
                  <th className="py-2.5 px-4 text-right font-bold">Cenário Conservador</th>
                  <th className="py-2.5 px-4 text-right font-bold text-orange-300">
                    Cenário Médio (Padrão)
                  </th>
                  <th className="py-2.5 px-4 text-right font-bold">Cenário Otimista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">
                    Múltiplo sobre EBITDA (LAJIDA)
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value">
                    {formatCurrency(valuation.cenariosEbitda.conservador)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value font-bold text-[#D65100] bg-orange-50/40">
                    {formatCurrency(valuation.cenariosEbitda.medio)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-emerald-700">
                    {formatCurrency(valuation.cenariosEbitda.otimista)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">
                    Múltiplo sobre Receita Líquida
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value">
                    {formatCurrency(valuation.cenariosReceita.conservador)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value font-bold text-[#D65100] bg-orange-50/40">
                    {formatCurrency(valuation.cenariosReceita.medio)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-emerald-700">
                    {formatCurrency(valuation.cenariosReceita.otimista)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-neutral-800">
                    Patrimônio Líquido Contábil (Fixado)
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-neutral-600">
                    {formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value font-bold text-[#D65100] bg-orange-50/40">
                    {formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-neutral-600">
                    {formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil)}
                  </td>
                </tr>
                <tr className="bg-neutral-50 font-bold text-neutral-900 border-t-2 border-neutral-200">
                  <td className="py-2.5 px-4">
                    Média Ponderada (20% PL + 50% EBITDA + 30% Receita)
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value">
                    {formatCurrency(valuation.cenariosPonderados.conservador)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-[#D65100] bg-orange-100/50">
                    {formatCurrency(valuation.cenariosPonderados.medio)}
                  </td>
                  <td className="py-2.5 px-4 text-right mono-value text-emerald-800">
                    {formatCurrency(valuation.cenariosPonderados.otimista)}
                  </td>
                </tr>
                <tr className="bg-[#FFF6EC] font-black text-neutral-950 border-t-2 border-[#FF6A13]">
                  <td className="py-3 px-4 text-sm text-[#D65100]">
                    VALUATION CONSOLIDADO (+ Intangíveis Informados)
                  </td>
                  <td className="py-3 px-4 text-right mono-value text-sm">
                    {formatCurrency(valuation.resultadoFinal.cenarioConservadorTotal)}
                  </td>
                  <td className="py-3 px-4 text-right mono-value text-base text-[#D65100] bg-[#FFEBD9]">
                    {formatCurrency(valuation.resultadoFinal.cenarioMedioTotal)}
                  </td>
                  <td className="py-3 px-4 text-right mono-value text-sm text-emerald-900">
                    {formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 6. SEÇÃO DE AJUSTES SUBJETIVOS / ATIVOS INTANGÍVEIS (GOODWILL) */}
      <Card className="border-neutral-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-50 text-[#FF6A13]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-neutral-900">
                  Ajustes Subjetivos & Goodwill (Ativos Intangíveis)
                </CardTitle>
                <CardDescription className="text-xs">
                  Adicione ou deduza valores intangíveis estratégicos da consultoria (acervo
                  técnico, credenciamentos, carteira de clientes ou contingências).
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
              Nenhum ajuste intangível cadastrado. Os cenários estão considerando puramente as
              métricas contábeis.
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
                        {item.tipo === 'positivo' ? '+ Acréscimo (Ativo)' : '- Dedução (Passivo)'}
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

          {/* Totalizador de Intangíveis */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#FFFBF7] rounded-lg border border-[#FFD2B3] text-xs">
            <span className="font-bold text-[#D65100]">
              Saldo Líquido de Goodwill & Intangíveis Informados:
            </span>
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 text-[11px]">
                +{formatCurrency(valuation.ajustes.totalPositivo)} / -
                {formatCurrency(valuation.ajustes.totalNegativo)}
              </span>
              <strong className="mono-value font-black text-sm text-[#FF6A13]">
                {valuation.ajustes.totalLiquidoIntangiveis >= 0 ? '+' : ''}
                {formatCurrency(valuation.ajustes.totalLiquidoIntangiveis)}
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. INDICADORES DE APOIO GERENCIAIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <span className="technical-label block text-[10px] text-neutral-500">
            Liquidez Corrente
          </span>
          <div className="text-lg font-black text-neutral-900 mono-value mt-0.5">
            {valuation.indicadoresApoio.liquidezCorrente > 50
              ? '> 50x'
              : `${valuation.indicadoresApoio.liquidezCorrente.toFixed(2)}x`}
          </div>
          <span className="text-[10px] text-neutral-500">Ativo Circ. / Passivo Circ.</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <span className="technical-label block text-[10px] text-neutral-500">
            Endividamento Geral
          </span>
          <div className="text-lg font-black text-neutral-900 mono-value mt-0.5">
            {valuation.indicadoresApoio.endividamentoGeral.toFixed(1)}%
          </div>
          <span className="text-[10px] text-neutral-500">Passivo Total / Ativo Total</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <span className="technical-label block text-[10px] text-neutral-500">
            Retorno s/ PL (ROE Est.)
          </span>
          <div className="text-lg font-black text-neutral-900 mono-value mt-0.5">
            {valuation.indicadoresApoio.retornoSobrePL.toFixed(1)}%
          </div>
          <span className="text-[10px] text-neutral-500">Lucro Líquido / PL Contábil</span>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <span className="technical-label block text-[10px] text-neutral-500">
            Capital Social Registrado
          </span>
          <div className="text-lg font-black text-neutral-900 mono-value mt-0.5">
            {formatCurrency(valuation.empresa.capitalSocialContratual)}
          </div>
          <span className="text-[10px] text-neutral-500">Contrato Social Arquivado</span>
        </div>
      </div>

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
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
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
              Os múltiplos, ajustes e resultados calculados serão arquivados na coleção de
              valuations da AEROCAD.
            </p>

            <form onSubmit={handleSalvarAvaliacao} className="space-y-3.5 text-xs">
              <div>
                <label className="technical-label block mb-1">Título da Avaliação</label>
                <Input
                  required
                  value={tituloSalvar}
                  onChange={(e) => setTituloSalvar(e.target.value)}
                  placeholder="Ex: Valuation Semestral AEROCAD 2026"
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
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
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

            <div className="flex items-center justify-end pt-4 mt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setModalHistoricoAberto(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO */}
      {avaliacaoExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border text-xs">
            <h3 className="text-sm font-bold text-rose-600 mb-2">
              Excluir Avaliação do Histórico?
            </h3>
            <p className="text-neutral-600 mb-4">
              Deseja realmente excluir a avaliação <strong>"{avaliacaoExcluindo.titulo}"</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setAvaliacaoExcluindo(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleConfirmarExclusao}
              >
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO E IMPRESSÃO A4 (RELATÓRIO INSTITUCIONAL AEROCAD) */}
      {modalVisualizarA4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border p-4 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Relatório Executivo de Valuation — Padrão A4
                </h3>
                <p className="text-xs text-neutral-500">
                  Visualização da prancheta técnica com logotipo institucional e composição
                  contábil.
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

            {/* DOCUMENTO RENDERIZADO NO TEMPLATE A4 */}
            <div
              id="print-valuation-a4"
              className="border rounded-xl shadow-inner bg-neutral-50 p-2 sm:p-4 overflow-x-auto"
            >
              <AerocadRelatorioA4
                titulo="Relatório Econômico de Avaliação da Empresa (Valuation)"
                subtitulo={`Avaliação patrimonial e múltiplos de mercado — Exercício ${anoSelecionado}`}
                referenciaPeriodo={`Exercício ${anoSelecionado}`}
                responsavelNome={usuarioNome}
                resumoKpis={[
                  {
                    rotulo: 'Cenário Conservador',
                    valorFormatado: formatCurrency(
                      valuation.resultadoFinal.cenarioConservadorTotal,
                    ),
                    cor: 'neutro',
                  },
                  {
                    rotulo: 'Valor de Referência (Médio)',
                    valorFormatado: formatCurrency(valuation.resultadoFinal.cenarioMedioTotal),
                    destaque: true,
                    cor: 'laranja',
                  },
                  {
                    rotulo: 'Cenário Otimista',
                    valorFormatado: formatCurrency(valuation.resultadoFinal.cenarioOtimistaTotal),
                    cor: 'verde',
                  },
                  {
                    rotulo: 'Patrimônio Líquido (PL)',
                    valorFormatado: formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil),
                    cor: 'neutro',
                  },
                ]}
                secoes={[
                  {
                    titulo: '1. Hipóteses e Múltiplos Utilizados',
                    subtitulo: 'Parâmetros definidos pela diretoria com base no mercado consultivo',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Métrica / Base', largura: '40%' },
                        { cabecalho: 'Conservador', alinhamento: 'right' },
                        { cabecalho: 'Médio (Base)', alinhamento: 'right' },
                        { cabecalho: 'Otimista', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: 'Múltiplo sobre EBITDA (LAJIDA)' },
                          {
                            conteudo: `${valuation.multiplosUsados.ebitdaConservador}x`,
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.multiplosUsados.ebitdaMedio}x`,
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: `${valuation.multiplosUsados.ebitdaOtimista}x`,
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: 'Múltiplo sobre Receita Líquida' },
                          {
                            conteudo: `${valuation.multiplosUsados.receitaConservador}x`,
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `${valuation.multiplosUsados.receitaMedio}x`,
                            alinhamento: 'right',
                            destaque: true,
                          },
                          {
                            conteudo: `${valuation.multiplosUsados.receitaOtimista}x`,
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: 'Ponderação no Valor Final' },
                          { conteudo: '20% PL · 50% EBITDA · 30% Rec.', alinhamento: 'right' },
                          {
                            conteudo: '20% PL · 50% EBITDA · 30% Rec.',
                            alinhamento: 'right',
                            destaque: true,
                          },
                          { conteudo: '20% PL · 50% EBITDA · 30% Rec.', alinhamento: 'right' },
                        ],
                      ],
                    },
                  },
                  {
                    titulo: '2. Composição do Valor Patrimonial Contábil',
                    subtitulo: 'Saldos bancários reais, imobilizado líquido e obrigações',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Conta Contábil / Descrição', largura: '60%' },
                        { cabecalho: 'Classificação', alinhamento: 'center' },
                        { cabecalho: 'Saldo (R$)', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: '(+) Disponibilidades Bancárias (Contas PJ)' },
                          { conteudo: 'Ativo Circulante', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(
                              valuation.patrimonio.disponibilidadesBancarias,
                            ),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(+) Contas e Parcelas a Receber da Operação' },
                          { conteudo: 'Ativo Circulante', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(valuation.patrimonio.contasReceberCirculante),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          {
                            conteudo: '(+) Ativo Imobilizado Líquido (Veículos, Equipamentos, TI)',
                          },
                          { conteudo: 'Ativo Permanente', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(valuation.patrimonio.imobilizadoLiquido),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(=) ATIVO TOTAL DA AEROCAD', destaque: true },
                          { conteudo: 'Ativo Consolidado', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(valuation.patrimonio.ativoTotal),
                            alinhamento: 'right',
                            destaque: true,
                          },
                        ],
                        [
                          { conteudo: '(-) Passivo Circulante (Contas a Pagar Pendentes)' },
                          { conteudo: 'Obrigações', alinhamento: 'center' },
                          {
                            conteudo: `-${formatCurrency(
                              valuation.patrimonio.passivoCirculanteTotal,
                            )}`,
                            alinhamento: 'right',
                          },
                        ],
                      ],
                      linhaTotal: [
                        { conteudo: '(=) PATRIMÔNIO LÍQUIDO CONTÁBIL (PL)', destaque: true },
                        { conteudo: 'PL', alinhamento: 'center' },
                        {
                          conteudo: formatCurrency(valuation.patrimonio.patrimonioLiquidoContabil),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                    },
                  },
                  {
                    titulo: '3. Demonstração de Rentabilidade & EBITDA do Exercício',
                    subtitulo: 'Receitas realizadas, deduções fiscais e lucro operacional',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Degrau DRE', largura: '60%' },
                        { cabecalho: 'Margem %', alinhamento: 'center' },
                        { cabecalho: 'Valor (R$)', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: 'Receita Bruta Operacional' },
                          { conteudo: '100.0%', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(valuation.rentabilidade.receitaBruta),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(-) Deduções Tributárias (ISS / Simples)' },
                          { conteudo: '—', alinhamento: 'center' },
                          {
                            conteudo: `-${formatCurrency(
                              valuation.rentabilidade.deducoesTributarias,
                            )}`,
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(=) Receita Operacional Líquida', destaque: true },
                          { conteudo: '—', alinhamento: 'center' },
                          {
                            conteudo: formatCurrency(valuation.rentabilidade.receitaLiquida),
                            alinhamento: 'right',
                            destaque: true,
                          },
                        ],
                        [
                          { conteudo: '(-) Custos Diretos e Terceirizados de Projetos' },
                          { conteudo: '—', alinhamento: 'center' },
                          {
                            conteudo: `-${formatCurrency(
                              valuation.rentabilidade.custosDiretosProjetos,
                            )}`,
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(-) Despesas Operacionais e Administrativas' },
                          { conteudo: '—', alinhamento: 'center' },
                          {
                            conteudo: `-${formatCurrency(
                              valuation.rentabilidade.despesasOperacionaisFixas,
                            )}`,
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '(+) Depreciação Linear Estimada' },
                          { conteudo: '—', alinhamento: 'center' },
                          {
                            conteudo: `+${formatCurrency(
                              valuation.rentabilidade.depreciacaoEstimadaExercicio,
                            )}`,
                            alinhamento: 'right',
                          },
                        ],
                      ],
                      linhaTotal: [
                        { conteudo: '(=) EBITDA / LAJIDA ANUALIZADO', destaque: true },
                        {
                          conteudo: `${valuation.rentabilidade.margemEbitdaPercentual.toFixed(1)}%`,
                          alinhamento: 'center',
                        },
                        {
                          conteudo: formatCurrency(valuation.rentabilidade.ebitda),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ],
                    },
                  },
                  {
                    titulo: '4. Quadro-Resumo Final de Valuation',
                    subtitulo: 'Consolidação de Múltiplos, Patrimônio Líquido e Intangíveis',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Metodologia', largura: '40%' },
                        { cabecalho: 'Conservador (R$)', alinhamento: 'right' },
                        { cabecalho: 'Médio / Referência (R$)', alinhamento: 'right' },
                        { cabecalho: 'Otimista (R$)', alinhamento: 'right' },
                      ],
                      linhas: [
                        [
                          { conteudo: 'Múltiplos sobre EBITDA' },
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
                          { conteudo: 'Múltiplos sobre Receita' },
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
                          { conteudo: 'Patrimônio Líquido Contábil' },
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
                          { conteudo: '(+) Goodwill e Intangíveis Informados' },
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
                      ],
                      linhaTotal: [
                        { conteudo: 'VALUATION TOTAL ESTIMADO', destaque: true },
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
                      ],
                    },
                  },
                ]}
                observacoesFinais={`Documento gerado pelo CRM AEROCAD — uso interno da diretoria. Índice de confiabilidade contábil da base de dados: ${valuation.confiabilidade.percentualConfiabilidade}% (${valuation.confiabilidade.nivel.toUpperCase()}). Todos os cálculos refletem as demonstrações contábeis e lançamentos registrados até ${new Date().toLocaleDateString('pt-BR')}.`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
