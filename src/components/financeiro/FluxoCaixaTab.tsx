import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
} from 'lucide-react'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import type { ContaPagarRecord, ContaReceberRecord, ParcelaRecord } from '@/types/crm'

import type { ExtratoTransacaoRecord } from '@/types/crm'

export interface FluxoCaixaTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  transacoesExtratos?: ExtratoTransacaoRecord[]
}

interface ItemFluxoMes {
  tipo: 'entrada' | 'saida'
  descricao: string
  origem: string
  valor: number
  dataRef: string
  status: 'realizado' | 'previsto'
}

interface MesFluxo {
  chave: string // YYYY-MM
  rotulo: string // ex: "Out/2026"
  entradasPrevistas: number
  entradasRealizadas: number
  saidasPrevistas: number
  saidasRealizadas: number
  resultadoPrevisto: number
  resultadoRealizado: number
  saldoAcumulado: number
  itens: ItemFluxoMes[]
}

export function FluxoCaixaTab({
  parcelas,
  contasPagar,
  contasReceber,
  transacoesExtratos = [],
}: FluxoCaixaTabProps) {
  // Ano de referência selecionado (padrão ano atual ou 2026/2025 conforme dados existentes)
  const [anoRef, setAnoRef] = useState<number>(() => {
    // Detecta ano com maior concentração de dados ou 2026
    return 2026
  })
  const [mesExpandido, setMesExpandido] = useState<string | null>(null)

  // Monta grade de 12 meses para o anoRef
  const fluxo12Meses = useMemo<MesFluxo[]>(() => {
    const mesesMap = new Map<string, MesFluxo>()

    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m).padStart(2, '0')
      const chave = `${anoRef}-${mesStr}`
      const d = new Date(anoRef, m - 1, 1)
      const rotulo = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

      mesesMap.set(chave, {
        chave,
        rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1),
        entradasPrevistas: 0,
        entradasRealizadas: 0,
        saidasPrevistas: 0,
        saidasRealizadas: 0,
        resultadoPrevisto: 0,
        resultadoRealizado: 0,
        saldoAcumulado: 0,
        itens: [],
      })
    }

    // 1. Processa Parcelas de Projetos
    for (const p of parcelas) {
      const dataEfetiva = p.data_pagamento || p.data_faturamento || p.vencimento
      if (!dataEfetiva) continue
      const anoMes = dataEfetiva.slice(0, 7)
      const mesObj = mesesMap.get(anoMes)
      if (mesObj) {
        const isRealizada = p.status === 'paga'
        const valRec = p.valor_recebido && p.valor_recebido > 0 ? p.valor_recebido : p.valor

        mesObj.entradasPrevistas += p.valor
        if (isRealizada) {
          mesObj.entradasRealizadas += valRec
        }

        mesObj.itens.push({
          tipo: 'entrada',
          descricao: p.nf_numero ? `NFS-e nº ${p.nf_numero} — ${p.descricao}` : p.descricao,
          origem: p.expand?.cliente?.razao_social || p.expand?.projeto?.numero || 'Projeto',
          valor: isRealizada ? valRec : p.valor,
          dataRef: dataEfetiva.slice(0, 10),
          status: isRealizada ? 'realizado' : 'previsto',
        })
      }
    }

    // 2. Processa Contas a Receber Avulsas
    for (const cr of contasReceber) {
      if (cr.status === 'cancelado') continue
      const dataEfetiva = cr.data_recebimento || cr.data_vencimento
      if (!dataEfetiva) continue
      const anoMes = dataEfetiva.slice(0, 7)
      const mesObj = mesesMap.get(anoMes)
      if (mesObj) {
        const isRealizada = cr.status === 'recebido'
        const valRec = cr.valor_recebido && cr.valor_recebido > 0 ? cr.valor_recebido : cr.valor

        mesObj.entradasPrevistas += cr.valor
        if (isRealizada) {
          mesObj.entradasRealizadas += valRec
        }

        mesObj.itens.push({
          tipo: 'entrada',
          descricao: cr.descricao,
          origem: cr.cliente_nome || 'Receita Avulsa',
          valor: isRealizada ? valRec : cr.valor,
          dataRef: dataEfetiva.slice(0, 10),
          status: isRealizada ? 'realizado' : 'previsto',
        })
      }
    }

    // 3. Processa Contas a Pagar
    for (const cp of contasPagar) {
      if (cp.status === 'cancelado') continue
      const dataEfetiva = cp.data_pagamento || cp.data_vencimento
      if (!dataEfetiva) continue
      const anoMes = dataEfetiva.slice(0, 7)
      const mesObj = mesesMap.get(anoMes)
      if (mesObj) {
        const isRealizada = cp.status === 'pago'

        mesObj.saidasPrevistas += cp.valor
        if (isRealizada) {
          mesObj.saidasRealizadas += cp.valor
        }

        mesObj.itens.push({
          tipo: 'saida',
          descricao: cp.descricao,
          origem: cp.fornecedor,
          valor: cp.valor,
          dataRef: dataEfetiva.slice(0, 10),
          status: isRealizada ? 'realizado' : 'previsto',
        })
      }
    }

    // 4. Processa Lançamentos Reais Alimentados por Extratos Bancários (OFX / Planilhas)
    // Se a transação do extrato não estiver vinculada a uma conta_pagar/parcela já contabilizada,
    // ou for classificada no extrato, entra como movimento bancário real no fluxo de caixa.
    const idsVinculadosSet = new Set<string>()
    for (const tx of transacoesExtratos) {
      if (tx.vinculo_id) idsVinculadosSet.add(tx.vinculo_id)
    }

    for (const tx of transacoesExtratos) {
      if (tx.status_conciliacao === 'ignorado') continue
      if (!tx.data) continue
      const anoMes = tx.data.slice(0, 7)
      const mesObj = mesesMap.get(anoMes)
      if (!mesObj) continue

      // Se a transação já foi conciliada com uma conta a pagar ou parcela já presente nos arrays acima,
      // evitamos duplicar o montante no saldo realizado
      const isConciliadoComItem = Boolean(tx.vinculo_id)
      const bancoOrigem =
        tx.expand?.extrato?.banco || tx.expand?.extrato?.nome_arquivo || 'Extrato Bancário'

      if (tx.tipo === 'entrada') {
        if (!isConciliadoComItem) {
          mesObj.entradasRealizadas += tx.valor
          mesObj.entradasPrevistas += tx.valor
        }
        mesObj.itens.push({
          tipo: 'entrada',
          descricao: `[Extrato] ${tx.descricao}`,
          origem: `${bancoOrigem}${tx.status_conciliacao === 'conciliado' ? ' · Conciliado' : ''}`,
          valor: tx.valor,
          dataRef: tx.data.slice(0, 10),
          status: 'realizado',
        })
      } else {
        if (!isConciliadoComItem) {
          mesObj.saidasRealizadas += tx.valor
          mesObj.saidasPrevistas += tx.valor
        }
        mesObj.itens.push({
          tipo: 'saida',
          descricao: `[Extrato] ${tx.descricao}`,
          origem: `${bancoOrigem}${tx.status_conciliacao === 'conciliado' ? ' · Conciliado' : ''}`,
          valor: tx.valor,
          dataRef: tx.data.slice(0, 10),
          status: 'realizado',
        })
      }
    }

    // Calcula resultados e saldo acumulado mês a mês
    const lista = Array.from(mesesMap.values())
    let saldoAcumuladoCorr = 0

    for (const m of lista) {
      m.resultadoPrevisto = m.entradasPrevistas - m.saidasPrevistas
      m.resultadoRealizado = m.entradasRealizadas - m.saidasRealizadas
      saldoAcumuladoCorr += m.resultadoRealizado
      m.saldoAcumulado = saldoAcumuladoCorr

      // Ordena itens do mês por data
      m.itens.sort((a, b) => a.dataRef.localeCompare(b.dataRef))
    }

    return lista
  }, [anoRef, parcelas, contasPagar, contasReceber, transacoesExtratos])

  // Totalizadores anuais
  const totalEntradasPrevistasAno = fluxo12Meses.reduce((acc, m) => acc + m.entradasPrevistas, 0)
  const totalEntradasRealizadasAno = fluxo12Meses.reduce((acc, m) => acc + m.entradasRealizadas, 0)
  const totalSaidasPrevistasAno = fluxo12Meses.reduce((acc, m) => acc + m.saidasPrevistas, 0)
  const totalSaidasRealizadasAno = fluxo12Meses.reduce((acc, m) => acc + m.saidasRealizadas, 0)
  const resultadoRealizadoAno = totalEntradasRealizadasAno - totalSaidasRealizadasAno

  // Maior valor para escala das barras
  const maxBarValor = useMemo(() => {
    let max = 1
    for (const m of fluxo12Meses) {
      if (m.entradasPrevistas > max) max = m.entradasPrevistas
      if (m.entradasRealizadas > max) max = m.entradasRealizadas
      if (m.saidasPrevistas > max) max = m.saidasPrevistas
      if (m.saidasRealizadas > max) max = m.saidasRealizadas
    }
    return max
  }, [fluxo12Meses])

  return (
    <div className="space-y-5">
      {/* Topo: Navegação de Ano e Resumo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 crm-card p-4">
        <div>
          <h3 className="font-bold text-neutral-900 text-sm">Fluxo de Caixa Mensal</h3>
          <p className="text-xs text-neutral-500">
            Acompanhamento de entradas (parcelas + receitas) vs saídas (contas a pagar).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnoRef((a) => a - 1)}
            className="h-8 text-xs border-neutral-300"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {anoRef - 1}
          </Button>
          <div className="px-3 py-1 font-mono font-bold text-sm bg-orange-50 border border-orange-200 text-[#FF6A13] rounded">
            Ano {anoRef}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnoRef((a) => a + 1)}
            className="h-8 text-xs border-neutral-300"
          >
            {anoRef + 1}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Cards de KPIs Anuais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="crm-card p-4 border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Entradas Realizadas</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-emerald-700">
            {formatCurrency(totalEntradasRealizadasAno)}
          </p>
          <span className="text-[11px] text-neutral-500">
            Previsto: {formatCurrency(totalEntradasPrevistasAno)}
          </span>
        </div>

        <div className="crm-card p-4 border-rose-200 bg-rose-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 uppercase tracking-wider">
            <span>Saídas Realizadas</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mono-value mt-2 text-xl font-bold text-rose-700">
            {formatCurrency(totalSaidasRealizadasAno)}
          </p>
          <span className="text-[11px] text-neutral-500">
            Previsto: {formatCurrency(totalSaidasPrevistasAno)}
          </span>
        </div>

        <div className="crm-card p-4 border-sky-200 bg-sky-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-800 uppercase tracking-wider">
            <span>Resultado Operacional ({anoRef})</span>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </div>
          <p
            className={`mono-value mt-2 text-xl font-bold ${
              resultadoRealizadoAno >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(resultadoRealizadoAno)}
          </p>
          <span className="text-[11px] text-neutral-500">
            {resultadoRealizadoAno >= 0 ? 'Superávit acumulado' : 'Déficit no exercício'}
          </span>
        </div>

        <div className="crm-card p-4 border-orange-200 bg-orange-50/30">
          <div className="flex items-center justify-between text-xs font-semibold text-[#D65100] uppercase tracking-wider">
            <span>Saldo Realizado Acumulado</span>
            <DollarSign className="h-4 w-4 text-[#FF6A13]" />
          </div>
          <p
            className={`mono-value mt-2 text-xl font-bold ${
              fluxo12Meses[11]?.saldoAcumulado >= 0 ? 'text-neutral-900' : 'text-rose-700'
            }`}
          >
            {formatCurrency(fluxo12Meses[11]?.saldoAcumulado || 0)}
          </p>
          <span className="text-[11px] text-neutral-500">Posição final ao fim do ano</span>
        </div>
      </div>

      {/* Gráfico Comparativo de Barras Entradas × Saídas por Mês */}
      <div className="crm-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Entradas × Saídas por Mês ({anoRef})
          </h4>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              Entradas Realizadas
            </span>
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className="h-3 w-3 rounded-sm bg-rose-500" />
              Saídas Realizadas
            </span>
          </div>
        </div>

        <div className="pt-2 pb-1 overflow-x-auto">
          <div className="min-w-[700px] flex items-end justify-between gap-2 h-44 border-b border-neutral-200 pb-2">
            {fluxo12Meses.map((m) => {
              const altEntrada = (m.entradasRealizadas / maxBarValor) * 100
              const altSaida = (m.saidasRealizadas / maxBarValor) * 100

              return (
                <div
                  key={m.chave}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
                >
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    {/* Barra de Entrada */}
                    <div
                      title={`Entradas ${m.rotulo}: ${formatCurrency(m.entradasRealizadas)}`}
                      className="w-1/2 max-w-[18px] bg-emerald-500 hover:bg-emerald-600 rounded-t transition cursor-pointer"
                      style={{ height: `${Math.max(altEntrada > 0 ? 4 : 0, altEntrada)}%` }}
                    />
                    {/* Barra de Saída */}
                    <div
                      title={`Saídas ${m.rotulo}: ${formatCurrency(m.saidasRealizadas)}`}
                      className="w-1/2 max-w-[18px] bg-rose-500 hover:bg-rose-600 rounded-t transition cursor-pointer"
                      style={{ height: `${Math.max(altSaida > 0 ? 4 : 0, altSaida)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-500 group-hover:text-neutral-900">
                    {m.rotulo.slice(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabela Detalhada com Mês a Mês Expandível */}
      <div className="crm-card overflow-hidden">
        <div className="p-3 bg-neutral-50 border-b text-xs font-semibold text-neutral-700 flex items-center justify-between">
          <span>Demonstrativo Mensal Previsto vs Realizado</span>
          <span className="text-[11px] font-normal text-neutral-500">
            Clique no mês para expandir os lançamentos detalhados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/70 text-neutral-600 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3 text-right">Entradas Prev.</th>
                <th className="px-4 py-3 text-right text-emerald-700">Entradas Realiz.</th>
                <th className="px-4 py-3 text-right">Saídas Prev.</th>
                <th className="px-4 py-3 text-right text-rose-700">Saídas Realiz.</th>
                <th className="px-4 py-3 text-right">Resultado Mês</th>
                <th className="px-4 py-3 text-right font-bold">Saldo Acumulado</th>
                <th className="px-3 py-3 text-center">Itens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {fluxo12Meses.map((mes) => {
                const isExp = mesExpandido === mes.chave
                const temMovimento = mes.itens.length > 0

                return (
                  <tr key={mes.chave} className="hover:bg-neutral-50/60 transition group">
                    <td colSpan={8} className="p-0">
                      <div
                        onClick={() => temMovimento && setMesExpandido(isExp ? null : mes.chave)}
                        className={`flex items-center px-4 py-3 cursor-pointer ${
                          temMovimento ? '' : 'opacity-70'
                        } ${isExp ? 'bg-orange-50/40' : ''}`}
                      >
                        <div className="w-[16%] font-semibold text-neutral-800 flex items-center gap-1.5">
                          {temMovimento && (
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${
                                isExp ? 'rotate-180 text-[#FF6A13]' : ''
                              }`}
                            />
                          )}
                          <span>{mes.rotulo}</span>
                        </div>

                        <div className="w-[14%] text-right font-mono text-neutral-500">
                          {formatCurrency(mes.entradasPrevistas)}
                        </div>

                        <div className="w-[14%] text-right font-mono font-semibold text-emerald-700">
                          {formatCurrency(mes.entradasRealizadas)}
                        </div>

                        <div className="w-[14%] text-right font-mono text-neutral-500">
                          {formatCurrency(mes.saidasPrevistas)}
                        </div>

                        <div className="w-[14%] text-right font-mono font-semibold text-rose-700">
                          {formatCurrency(mes.saidasRealizadas)}
                        </div>

                        <div
                          className={`w-[14%] text-right font-mono font-bold ${
                            mes.resultadoRealizado >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatCurrency(mes.resultadoRealizado)}
                        </div>

                        <div className="w-[14%] text-right font-mono font-bold text-neutral-900">
                          {formatCurrency(mes.saldoAcumulado)}
                        </div>
                      </div>

                      {/* Itens Detalhados do Mês Expandido */}
                      {isExp && temMovimento && (
                        <div className="bg-neutral-50/90 border-t border-b border-orange-100 p-3 space-y-2">
                          <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
                            Detalhamento de {mes.rotulo} ({mes.itens.length} transações)
                          </p>
                          <div className="divide-y divide-neutral-200 bg-white rounded border overflow-hidden">
                            {mes.itens.map((it, idx) => (
                              <div
                                key={`${it.descricao}_${idx}`}
                                className="px-3 py-2 flex items-center justify-between text-xs hover:bg-neutral-50"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      it.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                  />
                                  <span className="font-mono text-neutral-500 text-[11px]">
                                    {formatDate(it.dataRef)}
                                  </span>
                                  <span className="font-medium text-neutral-800">
                                    {it.descricao}
                                  </span>
                                  <span className="text-neutral-400 text-[11px]">
                                    ({it.origem})
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <CrmBadge tone={it.status === 'realizado' ? 'green' : 'amber'}>
                                    {it.status === 'realizado' ? 'Realizado' : 'Previsto'}
                                  </CrmBadge>
                                  <span
                                    className={`font-mono font-bold ${
                                      it.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {it.tipo === 'entrada' ? '+' : '-'} {formatCurrency(it.valor)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
