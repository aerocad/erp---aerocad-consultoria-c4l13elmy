import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  PieChart,
  Printer,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { formatCurrency, formatCurrencyRaw, formatDate } from '@/lib/format'
import { CATEGORIA_PAGAR_LABELS } from './ContasPagarTab'
import type {
  ClienteRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ParcelaRecord,
  ProjetoRecord,
} from '@/types/crm'

interface RelatoriosFinanceirosTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
}

type SubRelatorio =
  | 'dre'
  | 'faturamento_cliente'
  | 'custo_projeto'
  | 'aging'
  | 'competencia'
  | 'impostos'
  | 'livro_caixa'

export function RelatoriosFinanceirosTab({
  parcelas,
  contasPagar,
  contasReceber,
  projetos,
  clientes,
}: RelatoriosFinanceirosTabProps) {
  const { ocultarValores } = useFinanceiroVisibilidade()
  const [subTipo, setSubTipo] = useState<SubRelatorio>('dre')
  const [periodoAno, setPeriodoAno] = useState<string>('2026')

  // Filtra dados pelo ano selecionado ou todos
  const parcelasAno = useMemo(() => {
    return parcelas.filter((p) => {
      if (periodoAno === 'todos') return true
      const d = p.data_pagamento || p.data_faturamento || p.vencimento
      return d && d.startsWith(periodoAno)
    })
  }, [parcelas, periodoAno])

  const contasPagarAno = useMemo(() => {
    return contasPagar.filter((c) => {
      if (periodoAno === 'todos') return true
      const d = c.data_pagamento || c.data_vencimento
      return d && d.startsWith(periodoAno)
    })
  }, [contasPagar, periodoAno])

  const contasReceberAno = useMemo(() => {
    return contasReceber.filter((c) => {
      if (periodoAno === 'todos') return true
      const d = c.data_recebimento || c.data_vencimento
      return d && d.startsWith(periodoAno)
    })
  }, [contasReceber, periodoAno])

  // 1. DRE SIMPLIFICADA
  const dreCalculada = useMemo(() => {
    // Receita Bruta (Faturado em parcelas + receitas avulsas)
    const recParcelasRealizada = parcelasAno
      .filter((p) => p.status === 'paga')
      .reduce((acc, p) => acc + (p.valor_recebido || p.valor), 0)
    const recAvulsasRealizada = contasReceberAno
      .filter((c) => c.status === 'recebido')
      .reduce((acc, c) => acc + (c.valor_recebido || c.valor), 0)

    const recParcelasPrevista = parcelasAno.reduce((acc, p) => acc + p.valor, 0)
    const recAvulsasPrevista = contasReceberAno.reduce((acc, c) => acc + c.valor, 0)

    const receitaBrutaRealizada = recParcelasRealizada + recAvulsasRealizada
    const receitaBrutaPrevista = recParcelasPrevista + recAvulsasPrevista

    // Despesas por Categoria (Contas a Pagar)
    const despesasPorCat: Record<string, { prevista: number; realizada: number }> = {}
    for (const [k] of Object.entries(CATEGORIA_PAGAR_LABELS)) {
      despesasPorCat[k] = { prevista: 0, realizada: 0 }
    }

    for (const cp of contasPagarAno) {
      if (!despesasPorCat[cp.categoria]) {
        despesasPorCat[cp.categoria] = { prevista: 0, realizada: 0 }
      }
      despesasPorCat[cp.categoria].prevista += cp.valor
      if (cp.status === 'pago') {
        despesasPorCat[cp.categoria].realizada += cp.valor
      }
    }

    const totalDespesasRealizada = Object.values(despesasPorCat).reduce(
      (acc, v) => acc + v.realizada,
      0,
    )
    const totalDespesasPrevista = Object.values(despesasPorCat).reduce(
      (acc, v) => acc + v.prevista,
      0,
    )

    const resultadoLiquidoRealizado = receitaBrutaRealizada - totalDespesasRealizada
    const resultadoLiquidoPrevisto = receitaBrutaPrevista - totalDespesasPrevista

    return {
      receitaBrutaRealizada,
      receitaBrutaPrevista,
      despesasPorCat,
      totalDespesasRealizada,
      totalDespesasPrevista,
      resultadoLiquidoRealizado,
      resultadoLiquidoPrevisto,
    }
  }, [parcelasAno, contasReceberAno, contasPagarAno])

  // 2. FATURAMENTO POR CLIENTE
  const faturamentoPorCliente = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clienteNome: string
        totalPrevisto: number
        totalFaturado: number
        totalPago: number
        qtdProjetos: number
        qtdNfse: number
      }
    >()

    // Soma parcelas
    for (const p of parcelasAno) {
      const cliId = p.cliente || 'indefinido'
      const cliNome = p.expand?.cliente?.razao_social || 'Cliente Avulso'

      const curr = mapa.get(cliId) || {
        clienteNome: cliNome,
        totalPrevisto: 0,
        totalFaturado: 0,
        totalPago: 0,
        qtdProjetos: 0,
        qtdNfse: 0,
      }

      curr.totalPrevisto += p.valor
      if (p.nf_numero) {
        curr.totalFaturado += p.valor
        curr.qtdNfse++
      }
      if (p.status === 'paga') {
        curr.totalPago += p.valor_recebido || p.valor
      }

      mapa.set(cliId, curr)
    }

    // Soma avulsas
    for (const cr of contasReceberAno) {
      const cliId = cr.cliente || `avulso_${cr.cliente_nome}`
      const curr = mapa.get(cliId) || {
        clienteNome: cr.cliente_nome,
        totalPrevisto: 0,
        totalFaturado: 0,
        totalPago: 0,
        qtdProjetos: 0,
        qtdNfse: 0,
      }
      curr.totalPrevisto += cr.valor
      if (cr.status === 'recebido') {
        curr.totalPago += cr.valor_recebido || cr.valor
      }
      mapa.set(cliId, curr)
    }

    return Array.from(mapa.values()).sort((a, b) => b.totalPago - a.totalPago)
  }, [parcelasAno, contasReceberAno])

  // 3. CUSTO E MARGEM POR PROJETO
  const custoPorProjeto = useMemo(() => {
    const mapa = new Map<
      string,
      {
        projetoNumero: string
        projetoNome: string
        clienteNome: string
        receitasRealizadas: number
        receitasPrevistas: number
        custosRealizados: number
        custosPrevistos: number
      }
    >()

    // Receitas
    for (const p of parcelasAno) {
      if (!p.projeto) continue
      const projId = p.projeto
      const num = p.expand?.projeto?.numero || 'S/N'
      const nome = p.expand?.projeto?.nome || 'Projeto'
      const cli = p.expand?.cliente?.razao_social || ''

      const curr = mapa.get(projId) || {
        projetoNumero: num,
        projetoNome: nome,
        clienteNome: cli,
        receitasRealizadas: 0,
        receitasPrevistas: 0,
        custosRealizados: 0,
        custosPrevistos: 0,
      }

      curr.receitasPrevistas += p.valor
      if (p.status === 'paga') {
        curr.receitasRealizadas += p.valor_recebido || p.valor
      }
      mapa.set(projId, curr)
    }

    // Custos diretos vinculados ao projeto
    for (const cp of contasPagarAno) {
      if (!cp.projeto) continue
      const projId = cp.projeto
      const num = cp.expand?.projeto?.numero || 'S/N'
      const nome = cp.expand?.projeto?.nome || 'Projeto'

      const curr = mapa.get(projId) || {
        projetoNumero: num,
        projetoNome: nome,
        clienteNome: '',
        receitasRealizadas: 0,
        receitasPrevistas: 0,
        custosRealizados: 0,
        custosPrevistos: 0,
      }

      curr.custosPrevistos += cp.valor
      if (cp.status === 'pago') {
        curr.custosRealizados += cp.valor
      }
      mapa.set(projId, curr)
    }

    return Array.from(mapa.values())
      .map((item) => {
        const margemRealizada = item.receitasRealizadas - item.custosRealizados
        const margemPercentual =
          item.receitasRealizadas > 0
            ? Math.round((margemRealizada / item.receitasRealizadas) * 100)
            : 0
        return {
          ...item,
          margemRealizada,
          margemPercentual,
        }
      })
      .sort((a, b) => b.receitasRealizadas - a.receitasRealizadas)
  }, [parcelasAno, contasPagarAno])

  // 4. AGING DE CONTAS A PAGAR / RECEBER
  const agingCalculado = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    function calcularFaixa(vencStr: string): 'em_dia' | 'ate30' | 'de31a60' | 'de61a90' | 'mais90' {
      const venc = new Date(vencStr.slice(0, 10))
      venc.setHours(0, 0, 0, 0)
      if (venc >= hoje) return 'em_dia'
      const diffDias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDias <= 30) return 'ate30'
      if (diffDias <= 60) return 'de31a60'
      if (diffDias <= 90) return 'de61a90'
      return 'mais90'
    }

    const pagar = {
      em_dia: 0,
      ate30: 0,
      de31a60: 0,
      de61a90: 0,
      mais90: 0,
    }

    for (const cp of contasPagar) {
      if (cp.status !== 'pendente') continue
      const f = calcularFaixa(cp.data_vencimento)
      pagar[f] += cp.valor
    }

    const receber = {
      em_dia: 0,
      ate30: 0,
      de31a60: 0,
      de61a90: 0,
      mais90: 0,
    }

    for (const p of parcelas) {
      if (p.status === 'paga') continue
      const f = calcularFaixa(p.vencimento)
      receber[f] += p.valor
    }

    for (const cr of contasReceber) {
      if (cr.status !== 'pendente') continue
      const f = calcularFaixa(cr.data_vencimento)
      receber[f] += cr.valor
    }

    return { pagar, receber }
  }, [contasPagar, parcelas, contasReceber])

  // 5. RESUMO DE IMPOSTOS RETIDOS DAS NFS-e
  const impostosRetidosNfse = useMemo(() => {
    let issTotal = 0
    let inssTotal = 0
    let irpjTotal = 0
    let csllTotal = 0
    let cofinsTotal = 0
    let pisTotal = 0
    let notasComRetencao = 0

    for (const p of parcelasAno) {
      const raw = (p as any).nfse_dados
      if (!raw) continue

      let d: any = raw
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d)
        } catch {
          d = {}
        }
      }

      const iss = Number(d.issRetido || 0)
      const inss = Number(d.inssRetido || 0)
      const irpj = Number(d.irRetido || 0)
      const csll = Number(d.csllRetido || 0)
      const cofins = Number(d.cofinsRetido || 0)
      const pis = Number(d.pisRetido || 0)

      if (iss > 0 || inss > 0 || irpj > 0 || csll > 0 || cofins > 0 || pis > 0) {
        notasComRetencao++
        issTotal += iss
        inssTotal += inss
        irpjTotal += irpj
        csllTotal += csll
        cofinsTotal += cofins
        pisTotal += pis
      }
    }

    const totalRetencoes = issTotal + inssTotal + irpjTotal + csllTotal + cofinsTotal + pisTotal

    return {
      issTotal,
      inssTotal,
      irpjTotal,
      csllTotal,
      cofinsTotal,
      pisTotal,
      totalRetencoes,
      notasComRetencao,
    }
  }, [parcelasAno])

  // Exportação para impressão / PDF (janela A4 padrão AEROCAD)
  function handleImprimirRelatorio() {
    window.print()
  }

  // Exportação CSV
  function handleExportarCsv() {
    let cabecalho = ''
    let linhas: string[] = []

    if (subTipo === 'dre') {
      cabecalho = 'Rubrica;Previsto (R$);Realizado (R$)\n'
      linhas.push(
        `Receita Bruta;${dreCalculada.receitaBrutaPrevista};${dreCalculada.receitaBrutaRealizada}`,
      )
      for (const [k, v] of Object.entries(dreCalculada.despesasPorCat)) {
        linhas.push(`${CATEGORIA_PAGAR_LABELS[k as any] || k};${v.prevista};${v.realizada}`)
      }
      linhas.push(
        `Total de Despesas;${dreCalculada.totalDespesasPrevista};${dreCalculada.totalDespesasRealizada}`,
      )
      linhas.push(
        `Resultado Líquido;${dreCalculada.resultadoLiquidoPrevisto};${dreCalculada.resultadoLiquidoRealizado}`,
      )
    } else if (subTipo === 'faturamento_cliente') {
      cabecalho = 'Cliente;Previsto (R$);Faturado NFS-e (R$);Recebido Quitado (R$);NFS-e Emitidas\n'
      for (const fc of faturamentoPorCliente) {
        linhas.push(
          `"${fc.clienteNome}";${fc.totalPrevisto};${fc.totalFaturado};${fc.totalPago};${fc.qtdNfse}`,
        )
      }
    } else if (subTipo === 'custo_projeto') {
      cabecalho = 'Projeto;Nome;Cliente;Receitas (R$);Custos (R$);Margem Líquida (R$);Margem %\n'
      for (const cp of custoPorProjeto) {
        linhas.push(
          `"${cp.projetoNumero}";"${cp.projetoNome}";"${cp.clienteNome}";${cp.receitasRealizadas};${cp.custosRealizados};${cp.margemRealizada};${cp.margemPercentual}%`,
        )
      }
    } else if (subTipo === 'impostos') {
      cabecalho = 'Tributo;Total Retido (R$)\n'
      linhas.push(`ISS Retido;${impostosRetidosNfse.issTotal}`)
      linhas.push(`INSS Retido;${impostosRetidosNfse.inssTotal}`)
      linhas.push(`IRPJ Retido;${impostosRetidosNfse.irpjTotal}`)
      linhas.push(`CSLL Retido;${impostosRetidosNfse.csllTotal}`)
      linhas.push(`COFINS Retido;${impostosRetidosNfse.cofinsTotal}`)
      linhas.push(`PIS Retido;${impostosRetidosNfse.pisTotal}`)
      linhas.push(`TOTAL RETIDO;${impostosRetidosNfse.totalRetencoes}`)
    }

    const csvContent = '\uFEFF' + cabecalho + linhas.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_aerocad_${subTipo}_${periodoAno}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV exportado com sucesso!')
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Seleção do Relatório */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 crm-card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subTipo} onValueChange={(val) => setSubTipo(val as SubRelatorio)}>
            <SelectTrigger className="w-[260px] h-9 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dre">DRE Simplificada (Gerencial)</SelectItem>
              <SelectItem value="faturamento_cliente">Faturamento por Cliente</SelectItem>
              <SelectItem value="custo_projeto">Custos e Margem por Projeto</SelectItem>
              <SelectItem value="aging">Aging de Pagar / Receber</SelectItem>
              <SelectItem value="impostos">Resumo de Impostos Retidos (NFS-e)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodoAno} onValueChange={setPeriodoAno}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">Exercício 2026</SelectItem>
              <SelectItem value="2025">Exercício 2025</SelectItem>
              <SelectItem value="2024">Exercício 2024</SelectItem>
              <SelectItem value="todos">Todos os Anos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            className="border-neutral-300 text-neutral-700 h-9 text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>

          <Button
            size="sm"
            onClick={handleImprimirRelatorio}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white h-9 text-xs font-semibold"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir / Salvar PDF (A4)
          </Button>
        </div>
      </div>

      {/* Cabeçalho Oficial AEROCAD para Impressão */}
      <div className="hidden print:block p-4 border-b border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              AEROCAD ENGENHARIA & CONSULTORIA AEROPORTUÁRIA
            </h1>
            <p className="text-xs text-neutral-500">
              Relatório Financeiro e Contábil · Exercício {periodoAno}
            </p>
          </div>
          <div className="text-right text-xs text-neutral-500 font-mono">
            Gerado em: {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Conteúdo Dinâmico por Subtipo */}

      {/* 1. DRE */}
      {subTipo === 'dre' && (
        <div className="crm-card p-5 space-y-5">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">
              Demonstrativo de Resultado do Exercício (DRE Simplificada)
            </h3>
            <p className="text-xs text-neutral-500">
              Receitas faturadas e auferidas menos custos e despesas operacionais no período.
            </p>
          </div>

          <div className="divide-y divide-neutral-200 text-xs border rounded-lg overflow-hidden bg-white">
            {/* Receitas */}
            <div className="p-3 bg-emerald-50/40 flex justify-between font-bold text-emerald-950">
              <span>(+) RECEITA OPERACIONAL BRUTA</span>
              <div className="flex items-center gap-6 font-mono">
                <span className="text-neutral-500 font-normal">
                  Prev: {formatCurrency(dreCalculada.receitaBrutaPrevista)}
                </span>
                <span>Realiz: {formatCurrency(dreCalculada.receitaBrutaRealizada)}</span>
              </div>
            </div>

            {/* Despesas Operacionais por Categoria */}
            <div className="p-3 bg-rose-50/40 font-bold text-rose-950">
              (-) CUSTOS E DESPESAS OPERACIONAIS
            </div>

            {Object.entries(dreCalculada.despesasPorCat).map(([cat, vals]) => {
              return (
                <div
                  key={cat}
                  className="px-6 py-2.5 flex justify-between text-neutral-700 hover:bg-neutral-50"
                >
                  <span>{CATEGORIA_PAGAR_LABELS[cat as any] || cat}</span>
                  <div className="flex items-center gap-6 font-mono">
                    <span className="text-neutral-400">Prev: {formatCurrency(vals.prevista)}</span>
                    <span className="font-semibold text-rose-700">
                      - {formatCurrency(vals.realizada)}
                    </span>
                  </div>
                </div>
              )
            })}

            <div className="p-3 bg-neutral-100 flex justify-between font-bold text-neutral-900">
              <span>(=) TOTAL DE DESPESAS</span>
              <div className="flex items-center gap-6 font-mono">
                <span className="text-neutral-500 font-normal">
                  Prev: {formatCurrency(dreCalculada.totalDespesasPrevista)}
                </span>
                <span className="text-rose-700">
                  - {formatCurrency(dreCalculada.totalDespesasRealizada)}
                </span>
              </div>
            </div>

            {/* Resultado Final */}
            <div
              className={`p-4 flex justify-between font-bold text-base ${
                dreCalculada.resultadoLiquidoRealizado >= 0
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-rose-100 text-rose-900'
              }`}
            >
              <span>(=) RESULTADO LÍQUIDO DO PERÍODO</span>
              <span className="font-mono">
                {formatCurrency(dreCalculada.resultadoLiquidoRealizado)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. FATURAMENTO POR CLIENTE */}
      {subTipo === 'faturamento_cliente' && (
        <div className="crm-card p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">
              Faturamento Consolidado por Cliente
            </h3>
            <p className="text-xs text-neutral-500">
              Valores previstos em contrato, notas NFS-e emitidas e quitações por tomador de
              serviço.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Cliente / Tomador</th>
                  <th className="px-4 py-3 text-center">NFS-e Emitidas</th>
                  <th className="px-4 py-3 text-right">Total Previsto</th>
                  <th className="px-4 py-3 text-right text-orange-700">Faturado em Notas</th>
                  <th className="px-4 py-3 text-right text-emerald-700 font-bold">
                    Total Recebido
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {faturamentoPorCliente.map((fc, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-semibold text-neutral-900">{fc.clienteNome}</td>
                    <td className="px-4 py-3 text-center font-mono">
                      {fc.qtdNfse > 0 ? (
                        <span className="bg-orange-50 text-[#FF6A13] px-2 py-0.5 rounded font-bold border border-orange-200">
                          {fc.qtdNfse} notas
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-500">
                      {formatCurrency(fc.totalPrevisto)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-orange-700">
                      {formatCurrency(fc.totalFaturado)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(fc.totalPago)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CUSTO E MARGEM POR PROJETO */}
      {subTipo === 'custo_projeto' && (
        <div className="crm-card p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">
              Rentabilidade, Custos e Margem por Projeto
            </h3>
            <p className="text-xs text-neutral-500">
              Soma de contas a pagar vinculadas ao projeto (custos diretos) versus receitas
              auferidas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Projeto</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right text-emerald-700">Receitas Recebidas</th>
                  <th className="px-4 py-3 text-right text-rose-700">Custos Diretos</th>
                  <th className="px-4 py-3 text-right font-bold">Margem Líquida</th>
                  <th className="px-4 py-3 text-center">Margem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {custoPorProjeto.map((cp, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono font-bold text-[#FF6A13]">
                      {cp.projetoNumero}
                      <span className="block text-[11px] font-normal text-neutral-500 truncate max-w-[200px]">
                        {cp.projetoNome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{cp.clienteNome || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                      {formatCurrency(cp.receitasRealizadas)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-rose-700">
                      {formatCurrency(cp.custosRealizados)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold ${
                        cp.margemRealizada >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(cp.margemRealizada)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CrmBadge
                        tone={
                          cp.margemPercentual >= 40
                            ? 'green'
                            : cp.margemPercentual >= 15
                              ? 'amber'
                              : 'red'
                        }
                      >
                        {cp.margemPercentual}%
                      </CrmBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. AGING DE CONTAS */}
      {subTipo === 'aging' && (
        <div className="crm-card p-5 space-y-5">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">
              Aging de Títulos (Faixas de Atraso e Vencimento)
            </h3>
            <p className="text-xs text-neutral-500">
              Distribuição de títulos pendentes em faixas etárias de vencimento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contas a Receber */}
            <div className="border rounded-lg p-4 space-y-3 bg-white">
              <h4 className="font-semibold text-xs text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Contas a Receber em Aberto
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-neutral-600">A Vencer (Em dia)</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(agingCalculado.receber.em_dia)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-amber-800">Vencidos de 1 a 30 dias</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {formatCurrency(agingCalculado.receber.ate30)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-amber-800">Vencidos de 31 a 60 dias</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {formatCurrency(agingCalculado.receber.de31a60)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-rose-800">Vencidos de 61 a 90 dias</span>
                  <span className="font-mono font-semibold text-rose-700">
                    {formatCurrency(agingCalculado.receber.de61a90)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-rose-900 font-semibold">Vencidos há mais de 90 dias</span>
                  <span className="font-mono font-bold text-rose-800">
                    {formatCurrency(agingCalculado.receber.mais90)}
                  </span>
                </div>
              </div>
            </div>

            {/* Contas a Pagar */}
            <div className="border rounded-lg p-4 space-y-3 bg-white">
              <h4 className="font-semibold text-xs text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-rose-600" />
                Contas a Pagar em Aberto
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-neutral-600">A Vencer (Em dia)</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {formatCurrency(agingCalculado.pagar.em_dia)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-amber-800">Vencidos de 1 a 30 dias</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {formatCurrency(agingCalculado.pagar.ate30)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-amber-800">Vencidos de 31 a 60 dias</span>
                  <span className="font-mono font-semibold text-amber-700">
                    {formatCurrency(agingCalculado.pagar.de31a60)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-rose-800">Vencidos de 61 a 90 dias</span>
                  <span className="font-mono font-semibold text-rose-700">
                    {formatCurrency(agingCalculado.pagar.de61a90)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-rose-900 font-semibold">Vencidos há mais de 90 dias</span>
                  <span className="font-mono font-bold text-rose-800">
                    {formatCurrency(agingCalculado.pagar.mais90)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. RESUMO DE IMPOSTOS RETIDOS */}
      {subTipo === 'impostos' && (
        <div className="crm-card p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-neutral-900">
              Resumo Contábil de Impostos Retidos na Fonte (NFS-e)
            </h3>
            <p className="text-xs text-neutral-500">
              Totalização de retenções tributárias extraídas dos XMLs das 99 notas NFS-e emitidas
              pela AEROCAD.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                ISS Retido
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.issTotal)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                INSS Retido
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.inssTotal)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                IRPJ Retido
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.irpjTotal)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                CSLL Retida
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.csllTotal)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                COFINS Retido
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.cofinsTotal)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 rounded border">
              <span className="text-[10px] uppercase font-semibold text-neutral-500">
                PIS Retido
              </span>
              <p className="font-mono font-bold text-base text-neutral-900 mt-1">
                {formatCurrency(impostosRetidosNfse.pisTotal)}
              </p>
            </div>
          </div>

          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-[#D65100]">
                Total Geral de Impostos Retidos na Fonte
              </p>
              <p className="text-xs text-neutral-600">
                {impostosRetidosNfse.notasComRetencao} notas fiscais registraram retenção pelo
                tomador
              </p>
            </div>
            <span className="font-mono font-bold text-2xl text-[#FF6A13]">
              {formatCurrency(impostosRetidosNfse.totalRetencoes)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
