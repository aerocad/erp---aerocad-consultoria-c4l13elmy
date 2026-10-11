import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  Printer,
  Search,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import { exportarTabelaParaXlsx } from '@/services/aerocadXlsxExporter'
import { AerocadRelatorioA4 } from '@/components/financeiro/AerocadRelatorioA4'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  calcularResumoFinanceiroTodosProjetos,
  getStatusFinanceiroBadgeConfig,
  type ResumoFinanceiroProjeto,
} from '@/services/projetoFinanceiroInferidor'
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'

export interface ProjetoClienteSaldo {
  projeto: ProjetoRecord
  resumo: ResumoFinanceiroProjeto
}

export interface ClienteSaldoAFaturar {
  clienteId: string
  razaoSocial: string
  cnpjCpf: string
  segmento: string
  municipioUf: string
  totalContratado: number
  totalFaturadoNfse: number
  saldoAFaturar: number
  totalRecebido: number
  percentualFaturado: number
  projetosPendentes: ProjetoClienteSaldo[]
  projetosQuitados: ProjetoClienteSaldo[]
  todosProjetos: ProjetoClienteSaldo[]
  totalProjetos: number
  quitado: boolean // saldoAFaturar <= 0.05 e totalContratado > 0 (ou totalFaturadoNfse >= totalContratado)
}

export interface ResumoGlobalSaldoAFaturar {
  totalCarteiraContratado: number
  totalCarteiraFaturado: number
  saldoGlobalAFaturar: number
  totalCarteiraRecebido: number
  totalClientesComSaldo: number
  totalClientesQuitados: number
  totalProjetosPendentes: number
  percentualGlobalFaturado: number
}

export interface SaldoAFaturarProps {
  clientes: ClienteRecord[]
  projetos: ProjetoRecord[]
  parcelas: ParcelaRecord[]
}

export function RelatorioSaldoAFaturarCliente({
  clientes,
  projetos,
  parcelas,
}: SaldoAFaturarProps) {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({})
  const [mostrarQuitados, setMostrarQuitados] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  // 1. Processar dados de saldo a faturar por cliente
  const { clientesComSaldo, clientesQuitados, resumoGlobal } = useMemo(() => {
    const resumosProjetos = calcularResumoFinanceiroTodosProjetos(projetos, parcelas)

    // Agrupar projetos por cliente
    const projetosPorCliente = new Map<string, ProjetoClienteSaldo[]>()

    projetos.forEach((proj) => {
      const cid = proj.cliente || proj.expand?.cliente?.id || 'desconhecido'
      const resumo = resumosProjetos.get(proj.id) || {
        projetoId: proj.id,
        valorGlobalContratado: Number(proj.valor_global) || 0,
        totalFaturadoNfse: 0,
        saldoAFaturar: Number(proj.valor_global) || 0,
        percentualFaturado: 0,
        statusFinanceiro: 'sem_nfse' as const,
        quantidadeNotas: 0,
        numerosNotas: [],
        totalParcelas: 0,
        totalRecebido: 0,
      }

      const lista = projetosPorCliente.get(cid) || []
      lista.push({ projeto: proj, resumo })
      projetosPorCliente.set(cid, lista)
    })

    // Construir agregação por cliente
    const clientesProcessados: ClienteSaldoAFaturar[] = []

    // Map de clientes por ID para busca rápida
    const clientesMap = new Map<string, ClienteRecord>()
    clientes.forEach((c) => clientesMap.set(c.id, c))

    // Itera sobre todos os clientes que possuem projetos ou clientes cadastrados
    const clientesIdsEnvolvidos = new Set<string>()
    projetosPorCliente.forEach((_, cid) => {
      if (cid && cid !== 'desconhecido') clientesIdsEnvolvidos.add(cid)
    })

    clientesIdsEnvolvidos.forEach((cid) => {
      const cliRecord = clientesMap.get(cid)
      const listaProjetos = projetosPorCliente.get(cid) || []

      // Se não houver projetos, não gera saldo
      if (listaProjetos.length === 0) return

      let totalContratado = 0
      let totalFaturadoNfse = 0
      let saldoAFaturar = 0
      let totalRecebido = 0

      const projetosPendentes: ProjetoClienteSaldo[] = []
      const projetosQuitados: ProjetoClienteSaldo[] = []

      listaProjetos.forEach((item) => {
        totalContratado += item.resumo.valorGlobalContratado
        totalFaturadoNfse += item.resumo.totalFaturadoNfse
        saldoAFaturar += item.resumo.saldoAFaturar
        totalRecebido += item.resumo.totalRecebido

        if (item.resumo.saldoAFaturar > 0.05) {
          projetosPendentes.push(item)
        } else {
          projetosQuitados.push(item)
        }
      })

      const percentualFaturado =
        totalContratado > 0
          ? Math.min(100, Math.round((totalFaturadoNfse / totalContratado) * 100))
          : totalFaturadoNfse > 0
            ? 100
            : 0

      const razaoSocial =
        cliRecord?.razao_social ||
        listaProjetos[0]?.projeto?.expand?.cliente?.razao_social ||
        'Cliente não identificado'

      const cnpjCpf = cliRecord?.cnpj_cpf || ''
      const segmento = cliRecord?.segmento || 'Não informado'
      const municipioUf =
        cliRecord?.municipio && cliRecord?.uf
          ? `${cliRecord.municipio}/${cliRecord.uf}`
          : cliRecord?.municipio_uf || ''

      const quitado = saldoAFaturar <= 0.05 && totalContratado > 0

      clientesProcessados.push({
        clienteId: cid,
        razaoSocial,
        cnpjCpf,
        segmento,
        municipioUf,
        totalContratado,
        totalFaturadoNfse,
        saldoAFaturar,
        totalRecebido,
        percentualFaturado,
        projetosPendentes,
        projetosQuitados,
        todosProjetos: listaProjetos,
        totalProjetos: listaProjetos.length,
        quitado,
      })
    })

    // Separar clientes com saldo a faturar > 0 daqueles 100% quitados
    const comSaldo = clientesProcessados
      .filter((c) => c.saldoAFaturar > 0.05)
      .sort((a, b) => b.saldoAFaturar - a.saldoAFaturar)

    const quitados = clientesProcessados
      .filter((c) => c.saldoAFaturar <= 0.05 && c.totalContratado > 0)
      .sort((a, b) => b.totalFaturadoNfse - a.totalFaturadoNfse)

    // Resumo global de todos os clientes com projetos
    let totalCarteiraContratado = 0
    let totalCarteiraFaturado = 0
    let saldoGlobalAFaturar = 0
    let totalCarteiraRecebido = 0
    let totalProjetosPendentes = 0

    clientesProcessados.forEach((c) => {
      totalCarteiraContratado += c.totalContratado
      totalCarteiraFaturado += c.totalFaturadoNfse
      saldoGlobalAFaturar += c.saldoAFaturar
      totalCarteiraRecebido += c.totalRecebido
      totalProjetosPendentes += c.projetosPendentes.length
    })

    const percentualGlobalFaturado =
      totalCarteiraContratado > 0
        ? Math.round((totalCarteiraFaturado / totalCarteiraContratado) * 100)
        : 0

    const resumoGlobal: ResumoGlobalSaldoAFaturar = {
      totalCarteiraContratado,
      totalCarteiraFaturado,
      saldoGlobalAFaturar,
      totalCarteiraRecebido,
      totalClientesComSaldo: comSaldo.length,
      totalClientesQuitados: quitados.length,
      totalProjetosPendentes,
      percentualGlobalFaturado,
    }

    return {
      clientesComSaldo: comSaldo,
      clientesQuitados: quitados,
      resumoGlobal,
    }
  }, [clientes, projetos, parcelas, ocultarValores])

  // Filtragem por busca
  const termLower = searchTerm.trim().toLowerCase()

  const clientesComSaldoFiltrados = useMemo(() => {
    if (!termLower) return clientesComSaldo
    return clientesComSaldo.filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(termLower) ||
        c.cnpjCpf.toLowerCase().includes(termLower) ||
        c.segmento.toLowerCase().includes(termLower) ||
        c.todosProjetos.some(
          (p) =>
            p.projeto.numero.toLowerCase().includes(termLower) ||
            p.projeto.nome.toLowerCase().includes(termLower),
        ),
    )
  }, [clientesComSaldo, termLower])

  const clientesQuitadosFiltrados = useMemo(() => {
    if (!termLower) return clientesQuitados
    return clientesQuitados.filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(termLower) ||
        c.cnpjCpf.toLowerCase().includes(termLower) ||
        c.segmento.toLowerCase().includes(termLower) ||
        c.todosProjetos.some(
          (p) =>
            p.projeto.numero.toLowerCase().includes(termLower) ||
            p.projeto.nome.toLowerCase().includes(termLower),
        ),
    )
  }, [clientesQuitados, termLower])

  const toggleExpand = (clienteId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clienteId]: !prev[clienteId],
    }))
  }

  const expandirTodos = () => {
    const next: Record<string, boolean> = {}
    clientesComSaldoFiltrados.forEach((c) => {
      next[c.clienteId] = true
    })
    setExpandedClients(next)
  }

  const recolherTodos = () => {
    setExpandedClients({})
  }

  return (
    <div className="space-y-6">
      {/* 1. Header do Módulo com Identidade AEROCAD */}
      <div className="crm-card border-[#FF6A13]/25 bg-gradient-to-br from-white via-[#FFFBF8] to-[#FFF5ED] p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[#FFD2B3]/60 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs shrink-0">
              <DollarSign className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6A13]">
                  COBRANÇA ATIVA & FATURAMENTO
                </span>
                <span className="rounded-full bg-orange-100 text-[#D65100] text-[10px] font-bold px-2 py-0.5">
                  Restrito Admin / Financeiro
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#333]">
                Saldo a Faturar por Cliente da Carteira
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Confronto analítico entre Contratos fechados × NFS-e emitidas para orientação de
                emissão e cobrança ativa.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const linhas = clientesComSaldoFiltrados.map((c) => ({
                    cliente: c.razaoSocial,
                    cnpj: c.cnpjCpf || '',
                    projetos: c.totalProjetos,
                    contratado: c.totalContratado,
                    faturado: c.totalFaturadoNfse,
                    cobertura: `${c.percentualFaturado}%`,
                    saldo: c.saldoAFaturar,
                    recebido: c.totalRecebido,
                  }))

                  await exportarTabelaParaXlsx({
                    nomeArquivo: 'saldo_a_faturar_por_cliente_aerocad',
                    tituloRelatorio: 'SALDO A FATURAR POR CLIENTE — RELATÓRIO OFICIAL',
                    subtitulo: `Saldo Global a Faturar: ${formatCurrency(resumoGlobal.saldoGlobalAFaturar)}`,
                    usuarioNome: user?.name,
                    userRole: user?.role,
                    colunas: [
                      { header: 'Cliente / Tomador', key: 'cliente', width: 36 },
                      { header: 'CNPJ / CPF', key: 'cnpj', width: 20 },
                      { header: 'Projetos', key: 'projetos', width: 12, tipo: 'numero' },
                      { header: 'Contratado (R$)', key: 'contratado', width: 22, tipo: 'moeda' },
                      { header: 'Faturado NFS-e (R$)', key: 'faturado', width: 22, tipo: 'moeda' },
                      { header: '% Cobertura', key: 'cobertura', width: 14 },
                      { header: 'Saldo a Faturar (R$)', key: 'saldo', width: 22, tipo: 'moeda' },
                      { header: 'Total Recebido (R$)', key: 'recebido', width: 22, tipo: 'moeda' },
                    ],
                    linhas,
                    totais: {
                      contratado: resumoGlobal.totalCarteiraContratado,
                      faturado: resumoGlobal.totalCarteiraFaturado,
                      saldo: resumoGlobal.saldoGlobalAFaturar,
                      recebido: resumoGlobal.totalCarteiraRecebido,
                    },
                  })
                  toast.success('Planilha de Saldo a Faturar exportada com sucesso!')
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err)
                  toast.error('Erro ao exportar planilha: ' + msg)
                }
              }}
              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-8 font-semibold"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Exportar XLSX
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalOpen(true)}
              className="text-xs bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold border-none h-8"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Exportar / Imprimir PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={expandirTodos}
              className="text-xs border-[#DEDEDE] text-[#555] hover:text-[#FF6A13] hover:border-[#FF6A13] h-8"
            >
              Expandir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={recolherTodos}
              className="text-xs border-[#DEDEDE] text-[#555] hover:text-[#FF6A13] hover:border-[#FF6A13] h-8"
            >
              Recolher
            </Button>
          </div>
        </div>

        {/* 2. Resumo da Carteira em 4 Cartões de KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
          {/* Total Contratado */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                Total Contratado da Carteira
              </span>
              <FileCheck2 className="h-4 w-4 text-neutral-400" />
            </div>
            <p className="mono-value mt-2 text-2xl font-black text-[#333]">
              {formatCurrency(resumoGlobal.totalCarteiraContratado)}
            </p>
            <span className="text-[11px] text-[#8A8A8A] mt-1 block">
              Soma global dos projetos e contratos
            </span>
          </div>

          {/* Total Faturado em NFS-e */}
          <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Total Já Faturado (NFS-e)
              </span>
              <FileText className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mono-value mt-2 text-2xl font-black text-emerald-700">
              {formatCurrency(resumoGlobal.totalCarteiraFaturado)}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span className="text-neutral-500">Cobertura da carteira</span>
              <span className="mono-value font-bold text-emerald-700">
                {resumoGlobal.percentualGlobalFaturado}%
              </span>
            </div>
          </div>

          {/* Saldo Global a Faturar (Destaque AEROCAD) */}
          <div className="rounded-xl border-2 border-[#FF6A13]/50 bg-gradient-to-br from-[#FFF8F2] to-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D65100]">
                Saldo Global a Faturar
              </span>
              <AlertCircle className="h-4 w-4 text-[#FF6A13]" />
            </div>
            <p className="mono-value mt-2 text-2xl font-black text-[#FF6A13]">
              {formatCurrency(resumoGlobal.saldoGlobalAFaturar)}
            </p>
            <span className="text-[11px] font-medium text-[#D65100] mt-1 block">
              {resumoGlobal.totalClientesComSaldo} clientes · {resumoGlobal.totalProjetosPendentes}{' '}
              projeto(s) pendente(s)
            </span>
          </div>

          {/* Total Recebido (Baixas) */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                Total Recebido em Conta
              </span>
              <Wallet className="h-4 w-4 text-neutral-400" />
            </div>
            <p className="mono-value mt-2 text-2xl font-black text-[#248A57]">
              {formatCurrency(resumoGlobal.totalCarteiraRecebido)}
            </p>
            <span className="text-[11px] text-[#8A8A8A] mt-1 block">
              Baixas confirmadas de parcelas
            </span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Busca e Filtro */}
      <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9 text-xs"
            placeholder="Buscar por cliente, CNPJ ou número de projeto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-[#737373]">
          <span className="font-semibold">
            {clientesComSaldoFiltrados.length} cliente(s) com saldo a faturar
          </span>
          <span className="text-neutral-300">|</span>
          <span className="font-medium text-neutral-600">
            {clientesQuitadosFiltrados.length} quitado(s) 100%
          </span>
        </div>
      </div>

      {/* 4. Tabela de Clientes com Saldo a Faturar (Topo / Prioridade de Cobrança) */}
      <div className="crm-card overflow-hidden">
        <div className="border-b bg-[#FAFAFA] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF6A13]" />
            <h3 className="text-sm font-bold text-[#333]">Clientes com Saldo a Faturar Pendente</h3>
            <span className="rounded-full bg-orange-100 text-[#D65100] text-[11px] font-bold px-2 py-0.2">
              Prioridade de Faturamento
            </span>
          </div>
          <span className="text-xs text-[#737373] hidden sm:inline">
            Ordenado pelo maior saldo restante
          </span>
        </div>

        {clientesComSaldoFiltrados.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8A8A8A]">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            {searchTerm
              ? 'Nenhum cliente com saldo a faturar encontrado com esse filtro.'
              : 'Excelente! Todos os projetos com valor contratado possuem notas fiscais emitidas (100% faturados).'}
          </div>
        ) : (
          <div className="divide-y">
            {/* Cabeçalho da Tabela */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-[#737373]">
              <div className="col-span-4">Cliente / Segmento</div>
              <div className="col-span-2 text-right">Contratado</div>
              <div className="col-span-2 text-right">Faturado NFS-e</div>
              <div className="col-span-2 text-right">Saldo a Faturar</div>
              <div className="col-span-2 text-right">Recebido</div>
            </div>

            {/* Linhas de Clientes com Saldo */}
            {clientesComSaldoFiltrados.map((cliente) => {
              const isExpanded = Boolean(expandedClients[cliente.clienteId])
              return (
                <div key={cliente.clienteId} className="transition-colors hover:bg-[#FFF9F5]/40">
                  {/* Linha Principal do Cliente */}
                  <div
                    onClick={() => toggleExpand(cliente.clienteId)}
                    className="cursor-pointer p-4 sm:px-5 flex flex-col lg:grid lg:grid-cols-12 gap-3 items-start lg:items-center"
                  >
                    {/* Nome do Cliente e Badges */}
                    <div className="lg:col-span-4 flex items-start gap-2.5 w-full">
                      <button
                        type="button"
                        className="mt-0.5 text-neutral-400 hover:text-[#FF6A13] transition"
                        title={isExpanded ? 'Recolher projetos' : 'Ver projetos deste cliente'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-[#FF6A13]" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/clientes/${cliente.clienteId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-sm text-[#333] hover:text-[#FF6A13] hover:underline flex items-center gap-1"
                          >
                            {cliente.razaoSocial}
                            <ExternalLink className="h-3 w-3 text-neutral-400 shrink-0" />
                          </Link>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#737373] mt-0.5">
                          {cliente.cnpjCpf && (
                            <span className="font-mono text-[11px] text-neutral-500">
                              {cliente.cnpjCpf}
                            </span>
                          )}
                          {cliente.municipioUf && (
                            <>
                              <span>·</span>
                              <span>{cliente.municipioUf}</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="font-medium text-[#FF6A13]">
                            {cliente.projetosPendentes.length} pendente(s) de{' '}
                            {cliente.totalProjetos} proj.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contratado */}
                    <div className="lg:col-span-2 w-full lg:text-right flex justify-between lg:block text-xs">
                      <span className="lg:hidden text-[#737373] font-semibold">Contratado:</span>
                      <span className="mono-value font-bold text-neutral-800">
                        {formatCurrency(cliente.totalContratado)}
                      </span>
                    </div>

                    {/* Faturado em NFS-e */}
                    <div className="lg:col-span-2 w-full lg:text-right flex justify-between lg:block text-xs">
                      <span className="lg:hidden text-[#737373] font-semibold">
                        Faturado NFS-e:
                      </span>
                      <div>
                        <span className="mono-value font-bold text-emerald-700">
                          {formatCurrency(cliente.totalFaturadoNfse)}
                        </span>
                        <span className="mono-value block text-[10px] text-neutral-500">
                          {cliente.percentualFaturado}% coberto
                        </span>
                      </div>
                    </div>

                    {/* Saldo a Faturar (Destaque) */}
                    <div className="lg:col-span-2 w-full lg:text-right flex justify-between lg:block text-xs">
                      <span className="lg:hidden text-[#737373] font-semibold">
                        Saldo a Faturar:
                      </span>
                      <div>
                        <span className="mono-value font-black text-sm text-[#FF6A13]">
                          {formatCurrency(cliente.saldoAFaturar)}
                        </span>
                        <span className="block text-[10px] font-semibold text-[#D65100]">
                          Pendente emissão
                        </span>
                      </div>
                    </div>

                    {/* Recebido */}
                    <div className="lg:col-span-2 w-full lg:text-right flex justify-between lg:block text-xs">
                      <span className="lg:hidden text-[#737373] font-semibold">
                        Total Recebido:
                      </span>
                      <div>
                        <span className="mono-value font-bold text-emerald-800">
                          {formatCurrency(cliente.totalRecebido)}
                        </span>
                        <span className="block text-[10px] text-neutral-500">Baixas em conta</span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabela de Projetos do Cliente (Expansão) */}
                  {isExpanded && (
                    <div className="bg-[#FFFDFB] border-t border-b border-[#FFD2B3]/50 px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#737373]">
                        <span className="flex items-center gap-1.5 text-[#333]">
                          <Layers className="h-3.5 w-3.5 text-[#FF6A13]" />
                          Projetos vinculados ao cliente ({cliente.todosProjetos.length})
                        </span>
                        <Link
                          to={`/financeiro?cliente=${cliente.clienteId}`}
                          className="text-[11px] font-bold text-[#FF6A13] hover:underline"
                        >
                          Ver no financeiro →
                        </Link>
                      </div>

                      <div className="rounded-lg border border-[#FFD2B3]/60 bg-white overflow-hidden divide-y text-xs">
                        {cliente.todosProjetos.map(({ projeto, resumo }) => {
                          const badge = getStatusFinanceiroBadgeConfig(resumo)
                          return (
                            <div
                              key={projeto.id}
                              className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#FFF9F5]/50"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/projetos/${projeto.id}`}
                                    className="mono-value font-black text-[#D65100] hover:underline text-xs"
                                  >
                                    {projeto.numero}
                                  </Link>
                                  <span className="font-semibold text-[#333] truncate">
                                    {projeto.nome}
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-bold ${badge.badgeClass}`}
                                  >
                                    {badge.label}
                                  </span>
                                  <CrmBadge
                                    tone={
                                      projeto.status === 'ativo'
                                        ? 'green'
                                        : projeto.status === 'concluido'
                                          ? 'gray'
                                          : 'amber'
                                    }
                                  >
                                    {projeto.status}
                                  </CrmBadge>
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-[#737373] mt-1">
                                  <span>Trilha: {projeto.trilha.toUpperCase()}</span>
                                  <span>·</span>
                                  <span>Fase: {projeto.fase}</span>
                                  {resumo.numerosNotas.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-neutral-700">
                                        NFS-e: {resumo.numerosNotas.join(', ')}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Barra de Progresso do Projeto */}
                                <div className="mt-2 flex items-center gap-2 max-w-sm">
                                  <div className="h-1.5 flex-1 rounded-full bg-neutral-200 overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        resumo.statusFinanceiro === 'faturamento_integral'
                                          ? 'bg-emerald-600'
                                          : resumo.totalFaturadoNfse > 0
                                            ? 'bg-[#FF6A13]'
                                            : 'bg-neutral-300'
                                      }`}
                                      style={{
                                        width: `${Math.min(100, resumo.percentualFaturado)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="mono-value text-[10px] font-bold text-neutral-600">
                                    {resumo.percentualFaturado}%
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-right shrink-0">
                                <div>
                                  <span className="text-[10px] uppercase text-neutral-400 block font-semibold">
                                    Contratado
                                  </span>
                                  <span className="mono-value font-bold text-xs text-neutral-800">
                                    {formatCurrency(resumo.valorGlobalContratado)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] uppercase text-emerald-800 block font-semibold">
                                    Faturado
                                  </span>
                                  <span className="mono-value font-bold text-xs text-emerald-700">
                                    {formatCurrency(resumo.totalFaturadoNfse)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] uppercase text-[#D65100] block font-semibold">
                                    Saldo
                                  </span>
                                  <span
                                    className={`mono-value font-bold text-xs ${
                                      resumo.saldoAFaturar > 0.05
                                        ? 'text-[#FF6A13]'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {formatCurrency(resumo.saldoAFaturar)}
                                  </span>
                                </div>

                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs text-[#FF6A13] hover:bg-orange-50"
                                >
                                  <Link to={`/projetos/${projeto.id}`}>Abrir →</Link>
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Seção Discreta de Clientes Quitados (Faturados 100%) */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setMostrarQuitados((prev) => !prev)}
          className="w-full px-5 py-3.5 bg-neutral-50/70 hover:bg-neutral-100/60 transition flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-neutral-800">
              Clientes 100% Quitados em NFS-e ({clientesQuitadosFiltrados.length})
            </span>
            <span className="text-[11px] text-neutral-500">· Sem pendências de emissão</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">
              {mostrarQuitados ? 'Ocultar quitados' : 'Mostrar lista quitada'}
            </span>
            {mostrarQuitados ? (
              <ChevronDown className="h-4 w-4 text-neutral-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-neutral-500" />
            )}
          </div>
        </button>

        {mostrarQuitados && (
          <div className="divide-y border-t">
            {clientesQuitadosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                Nenhum cliente quitado no momento.
              </div>
            ) : (
              clientesQuitadosFiltrados.map((cliente) => (
                <div
                  key={cliente.clienteId}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <Link
                      to={`/clientes/${cliente.clienteId}`}
                      className="font-bold text-[#333] hover:text-[#FF6A13] hover:underline"
                    >
                      {cliente.razaoSocial}
                    </Link>
                    <span className="text-neutral-400">·</span>
                    <span className="text-neutral-500 text-[11px]">
                      {cliente.totalProjetos} projeto(s)
                    </span>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.2">
                      100% Faturado
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-right">
                    <div>
                      <span className="text-[10px] uppercase text-neutral-400 block">Total</span>
                      <span className="mono-value font-bold text-neutral-700">
                        {formatCurrency(cliente.totalContratado)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-emerald-700 block">NFS-e</span>
                      <span className="mono-value font-bold text-emerald-700">
                        {formatCurrency(cliente.totalFaturadoNfse)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-400 block">Recebido</span>
                      <span className="mono-value font-bold text-emerald-800">
                        {formatCurrency(cliente.totalRecebido)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal A4 para Visualização Oficial e Impressão do Saldo a Faturar */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-20 bg-neutral-900 text-white px-5 py-3 flex items-center justify-between shadow-md print:hidden">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#FF6A13] tracking-widest">
                PREVIEW A4 · TEMPLATE OFICIAL AEROCAD
              </p>
              <h3 className="text-sm font-bold text-white">
                Relatório de Saldo a Faturar por Cliente da Carteira
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const linhas = clientesComSaldoFiltrados.map((c) => ({
                      cliente: c.razaoSocial,
                      cnpj: c.cnpjCpf || '',
                      projetos: c.totalProjetos,
                      contratado: c.totalContratado,
                      faturado: c.totalFaturadoNfse,
                      cobertura: `${c.percentualFaturado}%`,
                      saldo: c.saldoAFaturar,
                      recebido: c.totalRecebido,
                    }))

                    await exportarTabelaParaXlsx({
                      nomeArquivo: 'saldo_a_faturar_por_cliente_aerocad',
                      tituloRelatorio: 'SALDO A FATURAR POR CLIENTE — RELATÓRIO OFICIAL',
                      subtitulo: `Saldo Global a Faturar: ${formatCurrency(resumoGlobal.saldoGlobalAFaturar)}`,
                      usuarioNome: user?.name,
                      userRole: user?.role,
                      colunas: [
                        { header: 'Cliente / Tomador', key: 'cliente', width: 36 },
                        { header: 'CNPJ / CPF', key: 'cnpj', width: 20 },
                        { header: 'Projetos', key: 'projetos', width: 12, tipo: 'numero' },
                        { header: 'Contratado (R$)', key: 'contratado', width: 22, tipo: 'moeda' },
                        {
                          header: 'Faturado NFS-e (R$)',
                          key: 'faturado',
                          width: 22,
                          tipo: 'moeda',
                        },
                        { header: '% Cobertura', key: 'cobertura', width: 14 },
                        { header: 'Saldo a Faturar (R$)', key: 'saldo', width: 22, tipo: 'moeda' },
                        {
                          header: 'Total Recebido (R$)',
                          key: 'recebido',
                          width: 22,
                          tipo: 'moeda',
                        },
                      ],
                      linhas,
                      totais: {
                        contratado: resumoGlobal.totalCarteiraContratado,
                        faturado: resumoGlobal.totalCarteiraFaturado,
                        saldo: resumoGlobal.saldoGlobalAFaturar,
                        recebido: resumoGlobal.totalCarteiraRecebido,
                      },
                    })
                    toast.success('Planilha exportada com sucesso!')
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    toast.error('Erro ao exportar planilha: ' + msg)
                  }
                }}
                className="bg-transparent border-white/20 text-white hover:bg-white/10 text-xs h-8"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                Exportar XLSX
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-8"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir / Salvar PDF (A4)
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-neutral-100 flex justify-center">
            <div className="bg-white shadow-lg border border-neutral-300 w-full max-w-[210mm]">
              <AerocadRelatorioA4
                titulo="RELATÓRIO DE SALDO A FATURAR POR CLIENTE"
                subtitulo="Confronto Analítico entre Contratos Globais e NFS-e Emitidas (Prioridade de Emissão)"
                referenciaPeriodo={`Posição em ${new Date().toLocaleDateString('pt-BR')}`}
                responsavelNome={user?.name || 'Controladoria AEROCAD'}
                resumoKpis={[
                  {
                    rotulo: 'Total Contratado da Carteira',
                    valorFormatado: formatCurrency(resumoGlobal.totalCarteiraContratado),
                  },
                  {
                    rotulo: 'Total Faturado em NFS-e',
                    valorFormatado: formatCurrency(resumoGlobal.totalCarteiraFaturado),
                    cor: 'verde',
                  },
                  {
                    rotulo: 'Saldo a Faturar Pendente',
                    valorFormatado: formatCurrency(resumoGlobal.saldoGlobalAFaturar),
                    cor: 'laranja',
                    destaque: true,
                  },
                  {
                    rotulo: 'Total Recebido em Conta',
                    valorFormatado: formatCurrency(resumoGlobal.totalCarteiraRecebido),
                    cor: 'verde',
                  },
                ]}
                secoes={[
                  {
                    titulo: 'Clientes com Saldo a Faturar Pendente',
                    subtitulo: 'Ordenado pelo maior montante residual pendente de faturamento',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Cliente / Tomador', largura: '35%' },
                        { cabecalho: 'Contratado (R$)', alinhamento: 'right', largura: '22%' },
                        { cabecalho: 'Faturado NFS-e', alinhamento: 'right', largura: '21%' },
                        { cabecalho: 'Saldo a Faturar', alinhamento: 'right', largura: '22%' },
                      ],
                      linhas: clientesComSaldoFiltrados.map((c) => [
                        { conteudo: c.razaoSocial, destaque: true },
                        { conteudo: formatCurrency(c.totalContratado), alinhamento: 'right' },
                        { conteudo: formatCurrency(c.totalFaturadoNfse), alinhamento: 'right' },
                        {
                          conteudo: formatCurrency(c.saldoAFaturar),
                          alinhamento: 'right',
                          destaque: true,
                        },
                      ]),
                      linhaTotal: [
                        { conteudo: 'TOTAL CONSOLIDADO' },
                        {
                          conteudo: formatCurrency(resumoGlobal.totalCarteiraContratado),
                          alinhamento: 'right',
                        },
                        {
                          conteudo: formatCurrency(resumoGlobal.totalCarteiraFaturado),
                          alinhamento: 'right',
                        },
                        {
                          conteudo: formatCurrency(resumoGlobal.saldoGlobalAFaturar),
                          alinhamento: 'right',
                        },
                      ],
                    },
                  },
                ]}
                observacoesFinais="Relatório gerencial de controle de emissão de notas fiscais de serviço. Documento emitido eletronicamente pelo CRM AEROCAD."
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
