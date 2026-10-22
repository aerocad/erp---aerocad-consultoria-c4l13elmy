import React, { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/format'
import { canViewFinancials } from '@/lib/crm'
import { isValoresOcultos } from '@/lib/format'
import type {
  EmprestimoFinanciamentoRecord,
  EmprestimoParcelaRecord,
  ContaBancariaRecord,
  CredorRecord,
  AtivoPatrimonioRecord,
} from '@/types/crm'
import { ContratarEmprestimoModal } from './ContratarEmprestimoModal'
import { PagarParcelaModal } from './PagarParcelaModal'
import { ApropriarJurosModal } from './ApropriarJurosModal'
import { ReclassificarPassivoModal } from './ReclassificarPassivoModal'
import { ExcluirContratoModal } from './ExcluirContratoModal'
import { exportarTabelaParaXlsx } from '@/services/aerocadXlsxExporter'
import {
  Landmark,
  Car,
  Plus,
  CalendarClock,
  ArrowLeftRight,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingDown,
  Trash2,
  FileSpreadsheet,
  ChevronRight,
  DollarSign,
  HelpCircle,
  Eye,
  RefreshCw,
} from 'lucide-react'

export interface EmprestimosFinanciamentosTabProps {
  contasBancarias: ContaBancariaRecord[]
  credores: CredorRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  userRole?: string
  usuarioNome?: string
  onNavigateTab?: (tab: string) => void
}

export function EmprestimosFinanciamentosTab({
  contasBancarias,
  credores,
  ativosPatrimonio,
  userRole,
  usuarioNome = 'Usuário AEROCAD',
  onNavigateTab,
}: EmprestimosFinanciamentosTabProps) {
  const { toast } = useToast()
  const podeVerValores = canViewFinancials(userRole)
  const ocultarGlobal = isValoresOcultos()
  const mascararValores = !podeVerValores || ocultarGlobal
  const ehAdmin = userRole === 'admin'

  // Estados de dados
  const [contratos, setContratos] = useState<EmprestimoFinanciamentoRecord[]>([])
  const [parcelas, setParcelas] = useState<EmprestimoParcelaRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [contratoSelecionadoId, setContratoSelecionadoId] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState('')

  // Modais
  const [modalContratarAberto, setModalContratarAberto] = useState(false)
  const [modalPagarAberto, setModalPagarAberto] = useState(false)
  const [parcelaParaPagar, setParcelaParaPagar] = useState<EmprestimoParcelaRecord | null>(null)
  const [modalApropriarAberto, setModalApropriarAberto] = useState(false)
  const [modalReclassificarAberto, setModalReclassificarAberto] = useState(false)
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [contratoParaExcluir, setContratoParaExcluir] =
    useState<EmprestimoFinanciamentoRecord | null>(null)

  // Carrega dados da coleção
  const carregarDados = async () => {
    try {
      setCarregando(true)
      const [listaContratos, listaParcelas] = await Promise.all([
        pb.collection('emprestimos_financiamentos').getFullList<EmprestimoFinanciamentoRecord>({
          sort: '-created',
          expand: 'credor,conta_bancaria_debito,ativo_patrimonio_vinculado',
        }),
        pb.collection('emprestimos_parcelas').getFullList<EmprestimoParcelaRecord>({
          sort: 'numero_parcela',
          expand: 'contrato,conta_bancaria',
        }),
      ])

      setContratos(listaContratos)
      setParcelas(listaParcelas)
    } catch (err) {
      console.warn('Aviso ao carregar empréstimos e parcelas:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Atualiza status de parcelas vencidas para 'atrasada' se aplicável
  useEffect(() => {
    const hojeStr = new Date().toISOString().slice(0, 10)
    parcelas.forEach((p) => {
      if (
        p.status === 'pendente' &&
        p.data_vencimento &&
        p.data_vencimento.slice(0, 10) < hojeStr
      ) {
        // Marca visualmente ou pode persistir se necessário
      }
    })
  }, [parcelas])

  // Contratos filtrados
  const contratosFiltrados = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
      if (buscaTexto.trim()) {
        const t = buscaTexto.toLowerCase()
        const num = (c.numero_contrato || '').toLowerCase()
        const desc = (c.descricao || '').toLowerCase()
        const banco = (c.banco_nome || '').toLowerCase()
        const bem = (c.bem_adquirido_descricao || '').toLowerCase()
        if (!num.includes(t) && !desc.includes(t) && !banco.includes(t) && !bem.includes(t)) {
          return false
        }
      }
      return true
    })
  }, [contratos, filtroTipo, filtroStatus, buscaTexto])

  // Contrato atualmente em foco (ou nulo para visão geral)
  const contratoAtivo = useMemo(() => {
    if (contratoSelecionadoId === 'todos') return null
    return contratos.find((c) => c.id === contratoSelecionadoId) || null
  }, [contratos, contratoSelecionadoId])

  // Parcelas filtradas conforme seleção de contrato e busca
  const parcelasFiltradas = useMemo(() => {
    let list = parcelas
    if (contratoSelecionadoId !== 'todos') {
      list = list.filter((p) => p.contrato === contratoSelecionadoId)
    } else if (contratosFiltrados.length < contratos.length) {
      const idsValidos = new Set(contratosFiltrados.map((c) => c.id))
      list = list.filter((p) => idsValidos.has(p.contrato))
    }
    return list
  }, [parcelas, contratoSelecionadoId, contratosFiltrados, contratos])

  // Métricas agregadas do módulo
  const metricas = useMemo(() => {
    const contratosAlvo = contratoAtivo ? [contratoAtivo] : contratosFiltrados

    const totalDivida = contratosAlvo.reduce((acc, c) => acc + (c.valor_total_divida || 0), 0)
    const saldoDevedorTotal = contratosAlvo.reduce(
      (acc, c) => acc + (c.saldo_devedor_atual || 0),
      0,
    )
    const jurosAApropriarTotal = contratosAlvo.reduce(
      (acc, c) => acc + (c.saldo_juros_a_apropriar || 0),
      0,
    )
    const jurosApropriadosTotal = contratosAlvo.reduce(
      (acc, c) => acc + (c.total_juros_apropriados || 0),
      0,
    )
    const totalAmortizado = contratosAlvo.reduce((acc, c) => acc + (c.total_amortizado || 0), 0)
    const totalJurosPagos = contratosAlvo.reduce((acc, c) => acc + (c.total_juros_pagos || 0), 0)
    const saldoCirculanteTotal = contratosAlvo.reduce(
      (acc, c) => acc + (c.saldo_circulante || 0),
      0,
    )
    const saldoNaoCirculanteTotal = contratosAlvo.reduce(
      (acc, c) => acc + (c.saldo_nao_circulante || 0),
      0,
    )

    // Parcelas pendentes e atrasadas
    const hojeIso = new Date().toISOString().slice(0, 10)
    let qtdPendentes = 0
    let qtdPagas = 0
    let qtdAtrasadas = 0
    let proximoVencimento: string | null = null
    let valorProximaParcela = 0

    parcelasFiltradas.forEach((p) => {
      const venc = p.data_vencimento ? p.data_vencimento.slice(0, 10) : ''
      if (p.status === 'paga') {
        qtdPagas++
      } else {
        qtdPendentes++
        if (venc && venc < hojeIso) {
          qtdAtrasadas++
        }
        if (venc && venc >= hojeIso) {
          if (!proximoVencimento || venc < proximoVencimento) {
            proximoVencimento = venc
            valorProximaParcela = p.valor_parcela
          }
        }
      }
    })

    return {
      totalDivida,
      saldoDevedorTotal,
      jurosAApropriarTotal,
      jurosApropriadosTotal,
      totalAmortizado,
      totalJurosPagos,
      saldoCirculanteTotal,
      saldoNaoCirculanteTotal,
      qtdPendentes,
      qtdPagas,
      qtdAtrasadas,
      proximoVencimento,
      valorProximaParcela,
    }
  }, [contratosFiltrados, contratoAtivo, parcelasFiltradas])

  // Parcelas elegíveis para apropriação (pendentes de apropriação)
  const parcelasPendentesApropriacao = useMemo(() => {
    return parcelas.filter((p) => !p.juros_apropriados && p.valor_juros > 0)
  }, [parcelas])

  // Parcelas elegíveis para reclassificação (não circulante com vencimento <= 12 meses)
  const parcelasCandidatasReclassificacao = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10)
    const pBase = hojeStr.split('-').map(Number)
    return parcelas.filter((p) => {
      if (p.status === 'paga' || p.classificacao_passivo !== 'nao_circulante') return false
      const venc = p.data_vencimento ? p.data_vencimento.slice(0, 10) : ''
      if (!venc) return false
      const pVenc = venc.split('-').map(Number)
      const meses = (pVenc[0] - pBase[0]) * 12 + (pVenc[1] - pBase[1])
      return meses <= 12
    })
  }, [parcelas])

  // Exportação Excel XLSX do Cronograma e Demonstrativo
  const handleExportarXlsx = async () => {
    if (parcelasFiltradas.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Não há parcelas listadas para exportação.',
        variant: 'destructive',
      })
      return
    }

    const linhas = parcelasFiltradas.map((p) => {
      const c = p.expand?.contrato
      return {
        contrato: c?.numero_contrato || 'S/N',
        banco: c?.banco_nome || '—',
        numero: p.numero_parcela,
        competencia: p.competencia,
        vencimento: p.data_vencimento ? p.data_vencimento.slice(0, 10) : '—',
        valorTotal: p.valor_parcela,
        principal: p.valor_principal,
        juros: p.valor_juros,
        saldoDevedor: p.saldo_devedor_restante,
        classificacao: p.classificacao_passivo === 'circulante' ? 'Circulante' : 'Não Circulante',
        jurosApropriados: p.juros_apropriados ? 'SIM' : 'NÃO',
        status: p.status.toUpperCase(),
        dataPagamento: p.data_pagamento ? p.data_pagamento.slice(0, 10) : '—',
      }
    })

    await exportarTabelaParaXlsx({
      nomeArquivo: `cronograma_financiamento_aerocad_${new Date().toISOString().slice(0, 10)}`,
      tituloRelatorio: `CRONOGRAMA DE AMORTIZAÇÃO E DECOMPOSIÇÃO DE JUROS — AEROCAD`,
      subtitulo: `Demonstrativo Contábil por Competência · Partidas Dobradas · Saldo Restante e Segregação Passivo`,
      usuarioNome,
      userRole,
      permitirValoresReais: podeVerValores && !ocultarGlobal,
      colunas: [
        { header: 'Nº Contrato', key: 'contrato', width: 18 },
        { header: 'Banco / Credor', key: 'banco', width: 20 },
        { header: 'Parc. Nº', key: 'numero', width: 10 },
        { header: 'Competência', key: 'competencia', width: 14 },
        { header: 'Vencimento', key: 'vencimento', width: 14 },
        { header: 'Valor Prestação (R$)', key: 'valorTotal', width: 20, tipo: 'moeda' },
        { header: 'Amortização Principal (R$)', key: 'principal', width: 22, tipo: 'moeda' },
        { header: 'Juros Período (R$)', key: 'juros', width: 18, tipo: 'moeda' },
        { header: 'Saldo Restante (R$)', key: 'saldoDevedor', width: 20, tipo: 'moeda' },
        { header: 'Classificação Passivo', key: 'classificacao', width: 20 },
        { header: 'Juros Apropriados?', key: 'jurosApropriados', width: 18 },
        { header: 'Status Parcela', key: 'status', width: 14 },
        { header: 'Data Pagamento', key: 'dataPagamento', width: 16 },
      ],
      linhas,
    })
  }

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A13]/10 text-[#FF6A13] flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5 text-[#FF6A13]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                Empréstimos & Financiamentos
              </h2>
              <p className="text-xs text-neutral-500">
                Ciclo contábil completo: Contratação (Etapa 1), Apropriação de Juros (Etapa 2) e
                Pagamento/Baixa (Etapa 3)
              </p>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={carregarDados}
            disabled={carregando}
            className="text-xs h-8 text-neutral-700 bg-white"
            title="Recarregar saldos e parcelas"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalApropriarAberto(true)}
            className="text-xs h-8 text-amber-700 border-amber-300 hover:bg-amber-50 bg-white"
          >
            <CalendarClock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Apropriar Juros do Mês
            {parcelasPendentesApropriacao.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full font-bold">
                {parcelasPendentesApropriacao.length}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalReclassificarAberto(true)}
            className="text-xs h-8 text-blue-700 border-blue-300 hover:bg-blue-50 bg-white"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Reclassificar Passivo
            {parcelasCandidatasReclassificacao.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full font-bold">
                {parcelasCandidatasReclassificacao.length}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportarXlsx}
            className="text-xs h-8 text-neutral-700 bg-white"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-neutral-600" />
            Exportar XLSX
          </Button>

          <Button
            size="sm"
            onClick={() => setModalContratarAberto(true)}
            className="text-xs h-8 bg-[#FF6A13] hover:bg-[#E55A0A] text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Operação (Contrato)
          </Button>
        </div>
      </div>

      {/* CARDS DE KPIS DO PAINEL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 border-neutral-200/90 shadow-sm bg-white">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-medium">Saldo Devedor Principal</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-900 tabular-nums">
            {mascararValores ? '••••••••' : formatCurrency(metricas.saldoDevedorTotal)}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 flex justify-between">
            <span>
              Dívida Total: {mascararValores ? '•••' : formatCurrency(metricas.totalDivida)}
            </span>
            <span className="text-emerald-600 font-semibold">
              Amortizado: {mascararValores ? '•••' : formatCurrency(metricas.totalAmortizado)}
            </span>
          </div>
        </Card>

        <Card className="p-3 border-neutral-200/90 shadow-sm bg-white">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-medium">Juros a Apropriar (Passivo Redutora)</span>
            <CalendarClock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 tabular-nums">
            {mascararValores ? '••••••••' : formatCurrency(metricas.jurosAApropriarTotal)}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 flex justify-between">
            <span>Conta 2.1.8 / 2.2.3</span>
            <span className="text-neutral-700 font-semibold">
              Já Apropriados:{' '}
              {mascararValores ? '•••' : formatCurrency(metricas.jurosApropriadosTotal)}
            </span>
          </div>
        </Card>

        <Card className="p-3 border-neutral-200/90 shadow-sm bg-white">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-medium">Segregação do Passivo</span>
            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xs space-y-0.5 mt-1 font-mono">
            <div className="flex justify-between items-center text-neutral-800">
              <span className="text-neutral-500 text-[11px]">Passivo Circulante:</span>
              <span className="font-bold text-neutral-900">
                {mascararValores ? '••••' : formatCurrency(metricas.saldoCirculanteTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-neutral-700">
              <span className="text-neutral-500 text-[11px]">Não Circulante (&gt;12m):</span>
              <span className="font-bold text-neutral-600">
                {mascararValores ? '••••' : formatCurrency(metricas.saldoNaoCirculanteTotal)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-3 border-neutral-200/90 shadow-sm bg-white">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-medium">Próximo Vencimento</span>
            <Clock className="w-4 h-4 text-[#FF6A13]" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-900 tabular-nums">
            {metricas.proximoVencimento ? formatDate(metricas.proximoVencimento) : 'Em dia'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 flex justify-between">
            <span>
              {metricas.valorProximaParcela > 0
                ? `Valor: ${mascararValores ? '•••' : formatCurrency(metricas.valorProximaParcela)}`
                : 'Sem parcelas a vencer'}
            </span>
            {metricas.qtdAtrasadas > 0 && (
              <span className="text-red-600 font-bold">
                {metricas.qtdAtrasadas} parcela(s) em atraso
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* FILTROS E BARRA DE PESQUISA */}
      <div className="p-3 bg-white rounded-lg border border-neutral-200 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <Input
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar por contrato, banco, veículo..."
              className="pl-8 h-8 text-xs bg-neutral-50/50"
            />
          </div>

          <Select value={contratoSelecionadoId} onValueChange={setContratoSelecionadoId}>
            <SelectTrigger className="h-8 text-xs w-[220px] bg-neutral-50/50">
              <SelectValue placeholder="Filtrar por Contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Contratos ({contratos.length})</SelectItem>
              {contratos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero_contrato} - {c.banco_nome} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-neutral-50/50">
              <SelectValue placeholder="Tipo de Operação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="emprestimo_bancario">Empréstimo Bancário</SelectItem>
              <SelectItem value="financiamento_veiculo">Financiamento de Veículo</SelectItem>
              <SelectItem value="outras_modalidades">Outras Modalidades</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-8 text-xs w-[130px] bg-neutral-50/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {contratoAtivo && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setContratoSelecionadoId('todos')}
            className="text-xs text-neutral-500 hover:text-neutral-900 h-8"
          >
            Ver todos os contratos
          </Button>
        )}
      </div>

      {/* SEÇÃO 1: CARTÕES / TABELA DE CONTRATOS ATIVOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
            Contratos de Empréstimos e Financiamentos ({contratosFiltrados.length})
          </span>
          {contratoAtivo && (
            <Badge className="bg-orange-100 text-[#FF6A13] border-orange-200 text-xs">
              Exibindo apenas contrato {contratoAtivo.numero_contrato}
            </Badge>
          )}
        </div>

        {contratosFiltrados.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg border border-neutral-200">
            <Landmark className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm font-semibold text-neutral-700">Nenhum contrato cadastrado</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Utilize o botão "Nova Operação (Contrato)" para registrar empréstimos bancários ou
              financiamentos de veículos com reconhecimento contábil automático.
            </p>
            <Button
              size="sm"
              onClick={() => setModalContratarAberto(true)}
              className="mt-3 text-xs bg-[#FF6A13] hover:bg-[#E55A0A] text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Contratar Operação
            </Button>
          </div>
        ) : (
          <div className="crm-table-wrapper">
            <table className="crm-data-table">
              <thead>
                <tr>
                  <th className="crm-table-th">Nº Contrato</th>
                  <th className="crm-table-th">Tipo / Modalidade</th>
                  <th className="crm-table-th">Instituição Credora</th>
                  <th className="crm-table-th">Data Contratação</th>
                  <th className="crm-table-th crm-col-num">Total Dívida</th>
                  <th className="crm-table-th crm-col-num">Saldo Devedor</th>
                  <th className="crm-table-th crm-col-num">Juros a Apropriar</th>
                  <th className="crm-table-th crm-col-num">Circulante / Não Circ.</th>
                  <th className="crm-table-th text-center">Parcelas</th>
                  <th className="crm-table-th text-center">Status</th>
                  <th className="crm-table-th text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.map((c) => {
                  const ehSelecionado = contratoSelecionadoId === c.id
                  return (
                    <tr
                      key={c.id}
                      className={`crm-table-row cursor-pointer transition-colors ${
                        ehSelecionado ? 'bg-orange-50/50' : ''
                      }`}
                      onClick={() => setContratoSelecionadoId(ehSelecionado ? 'todos' : c.id)}
                    >
                      <td className="crm-table-td font-semibold text-neutral-900">
                        <div className="flex items-center gap-1.5">
                          {c.tipo === 'financiamento_veiculo' ? (
                            <Car className="w-3.5 h-3.5 text-[#FF6A13] shrink-0" />
                          ) : (
                            <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          <span>{c.numero_contrato}</span>
                        </div>
                        {c.bem_adquirido_descricao && (
                          <div className="text-[10px] text-neutral-500 font-normal truncate max-w-[180px]">
                            {c.bem_adquirido_descricao}
                          </div>
                        )}
                      </td>
                      <td className="crm-table-td">
                        <span className="capitalize text-neutral-700">
                          {c.tipo === 'financiamento_veiculo'
                            ? 'Financiamento Veículo'
                            : c.tipo === 'emprestimo_bancario'
                              ? 'Empréstimo Bancário'
                              : 'Outras Modalidades'}
                        </span>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {c.metodo_amortizacao} · {c.taxa_juros_mensal}% a.m.
                        </div>
                      </td>
                      <td className="crm-table-td font-medium text-neutral-800">{c.banco_nome}</td>
                      <td className="crm-table-td font-mono text-neutral-600">
                        {c.data_contratacao ? formatDate(c.data_contratacao) : '—'}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-neutral-900">
                        {mascararValores ? '••••' : formatCurrency(c.valor_total_divida)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono font-bold text-neutral-900">
                        {mascararValores ? '••••' : formatCurrency(c.saldo_devedor_atual)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-amber-600">
                        {mascararValores ? '••••' : formatCurrency(c.saldo_juros_a_apropriar)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-[11px] text-neutral-600">
                        <span className="text-neutral-900">
                          C: {mascararValores ? '••' : formatCurrency(c.saldo_circulante)}
                        </span>
                        <span className="text-neutral-400 ml-1">
                          NC: {mascararValores ? '••' : formatCurrency(c.saldo_nao_circulante)}
                        </span>
                      </td>
                      <td className="crm-table-td text-center font-mono">
                        {c.quantidade_parcelas} parc.
                      </td>
                      <td className="crm-table-td text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold ${
                            c.status === 'quitado'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : c.status === 'ativo'
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                          }`}
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="crm-table-td text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setContratoSelecionadoId(ehSelecionado ? 'todos' : c.id)}
                            className="h-7 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                            title="Filtrar cronograma de parcelas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {ehAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setContratoParaExcluir(c)
                                setModalExcluirAberto(true)
                              }}
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Excluir e estornar contrato contábil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SEÇÃO 2: PLANILHA E CRONOGRAMA DE PARCELAS */}
      <div className="space-y-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Planilha e Cronograma de Parcelas ({parcelasFiltradas.length})
            </h3>
            <p className="text-[11px] text-neutral-500">
              Decomposição contábil (Principal × Juros), competência, status e botão de baixa (Etapa
              3)
            </p>
          </div>

          <div className="text-xs text-neutral-500 font-mono">
            Mostrando {parcelasFiltradas.length} parcelas
          </div>
        </div>

        {parcelasFiltradas.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-lg border border-neutral-200 text-neutral-500 text-xs">
            Nenhuma parcela encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="crm-table-wrapper max-h-[500px]">
            <table className="crm-data-table">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="crm-table-th">Contrato / Credor</th>
                  <th className="crm-table-th text-center">Nº</th>
                  <th className="crm-table-th">Competência</th>
                  <th className="crm-table-th">Vencimento</th>
                  <th className="crm-table-th crm-col-num">Valor Prestação</th>
                  <th className="crm-table-th crm-col-num">Principal (Amortização)</th>
                  <th className="crm-table-th crm-col-num">Juros Incorridos</th>
                  <th className="crm-table-th crm-col-num">Saldo Devedor Restante</th>
                  <th className="crm-table-th text-center">Classificação Passivo</th>
                  <th className="crm-table-th text-center">Juros Apropriados</th>
                  <th className="crm-table-th text-center">Status</th>
                  <th className="crm-table-th text-right">Ação / Baixa</th>
                </tr>
              </thead>
              <tbody>
                {parcelasFiltradas.map((p) => {
                  const c = p.expand?.contrato
                  const hojeStr = new Date().toISOString().slice(0, 10)
                  const vencStr = p.data_vencimento ? p.data_vencimento.slice(0, 10) : ''
                  const ehAtrasada = p.status !== 'paga' && vencStr && vencStr < hojeStr

                  return (
                    <tr
                      key={p.id}
                      className={`crm-table-row ${
                        p.status === 'paga'
                          ? 'bg-neutral-50/50 opacity-90'
                          : ehAtrasada
                            ? 'bg-red-50/40'
                            : ''
                      }`}
                    >
                      <td className="crm-table-td font-medium text-neutral-900">
                        <span>{c?.numero_contrato || 'Contrato'}</span>
                        <div className="text-[10px] text-neutral-500 font-normal">
                          {c?.banco_nome || 'Banco'}
                        </div>
                      </td>
                      <td className="crm-table-td text-center font-mono font-semibold">
                        {p.numero_parcela}
                      </td>
                      <td className="crm-table-td font-mono text-neutral-700">{p.competencia}</td>
                      <td className="crm-table-td font-mono">
                        <span
                          className={
                            ehAtrasada
                              ? 'text-red-600 font-bold'
                              : p.status === 'paga'
                                ? 'text-neutral-500'
                                : 'text-neutral-800'
                          }
                        >
                          {vencStr ? formatDate(vencStr) : '—'}
                        </span>
                      </td>
                      <td className="crm-table-td crm-col-num font-mono font-bold text-neutral-900">
                        {mascararValores ? '••••' : formatCurrency(p.valor_parcela)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-emerald-700">
                        {mascararValores ? '••••' : formatCurrency(p.valor_principal)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-amber-700">
                        {mascararValores ? '••••' : formatCurrency(p.valor_juros)}
                      </td>
                      <td className="crm-table-td crm-col-num font-mono text-neutral-600">
                        {mascararValores ? '••••' : formatCurrency(p.saldo_devedor_restante)}
                      </td>
                      <td className="crm-table-td text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            p.classificacao_passivo === 'circulante'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                          }`}
                        >
                          {p.classificacao_passivo === 'circulante'
                            ? 'Circulante'
                            : 'Não Circulante'}
                        </Badge>
                      </td>
                      <td className="crm-table-td text-center">
                        {p.juros_apropriados ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Apropriado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="crm-table-td text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            p.status === 'paga'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : ehAtrasada
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                        >
                          {p.status === 'paga' ? 'Paga' : ehAtrasada ? 'Atrasada' : 'Pendente'}
                        </Badge>
                        {p.data_pagamento && (
                          <div className="text-[9px] text-neutral-400 font-mono mt-0.5">
                            Pago em: {formatDate(p.data_pagamento.slice(0, 10))}
                          </div>
                        )}
                      </td>
                      <td className="crm-table-td text-right">
                        {p.status === 'paga' ? (
                          <span className="text-[11px] text-neutral-400 font-mono">Baixada</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setParcelaParaPagar(p)
                              setModalPagarAberto(true)
                            }}
                            className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            Pagar Parcela (Etapa 3)
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CONTRATAR OPERAÇÃO */}
      <ContratarEmprestimoModal
        open={modalContratarAberto}
        onOpenChange={setModalContratarAberto}
        contasBancarias={contasBancarias}
        credores={credores}
        ativosPatrimonio={ativosPatrimonio}
        onSuccess={carregarDados}
      />

      {/* MODAL 2: PAGAR PARCELA */}
      <PagarParcelaModal
        open={modalPagarAberto}
        onOpenChange={setModalPagarAberto}
        parcela={parcelaParaPagar}
        contasBancarias={contasBancarias}
        onSuccess={carregarDados}
      />

      {/* MODAL 3: APROPRIAR JUROS DO MÊS */}
      <ApropriarJurosModal
        open={modalApropriarAberto}
        onOpenChange={setModalApropriarAberto}
        parcelasPendentesApropriacao={parcelasPendentesApropriacao}
        contratos={contratos}
        onSuccess={carregarDados}
      />

      {/* MODAL 4: RECLASSIFICAR PASSIVO */}
      <ReclassificarPassivoModal
        open={modalReclassificarAberto}
        onOpenChange={setModalReclassificarAberto}
        parcelasCandidatasReclassificacao={parcelasCandidatasReclassificacao}
        onSuccess={carregarDados}
      />

      {/* MODAL 5: EXCLUIR E ESTORNAR CONTRATO */}
      <ExcluirContratoModal
        open={modalExcluirAberto}
        onOpenChange={setModalExcluirAberto}
        contrato={contratoParaExcluir}
        userRole={userRole}
        onSuccess={carregarDados}
      />
    </div>
  )
}
