import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { exportarTabelaParaXlsx } from '@/services/aerocadXlsxExporter'
import { AerocadRelatorioA4 } from '@/components/financeiro/AerocadRelatorioA4'
import { imprimirElementoA4 } from '@/services/relatorioImpressaoService'
import {
  consolidarBalanceteMensal,
  derivarDetalhamentoContasBalancete,
  MESES_NOMES,
} from '@/services/balanceteMensalDetalhamentoService'
import { ContaContabilBadgeInline } from '@/components/financeiro/ContaContabilBadgeInline'
import type {
  BalanceteConsolidadoDados,
  BalanceteContaResumo,
  BalanceteLancamentoAnalitico,
  BalanceteMensalRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
  ProjetoRecord,
} from '@/types/crm'

interface BalancetesTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  onReload?: () => void
}

export function BalancetesTab({
  parcelas,
  contasPagar,
  contasReceber,
  projetos,
  extratosTransacoes = [],
  onReload,
}: BalancetesTabProps) {
  const { user } = useAuth()
  const { ocultarValores } = useFinanceiroVisibilidade()
  const canWrite = user?.role === 'admin' || user?.role === 'financeiro'

  const {
    data: balancetes,
    loading: crmLoading,
    error: crmError,
    reload,
  } = useCrmData<BalanceteMensalRecord>('balancetes_mensais', {
    sort: '-referencia',
    expand: 'criado_por',
  })

  // Loading defensivo: nunca fica preso indefinidamente
  const [loadingTimeoutExceeded, setLoadingTimeoutExceeded] = useState(false)
  const loading = crmLoading && !loadingTimeoutExceeded

  // Efeito para soltar o loading após 3.5 segundos caso a conexão do backend fique pendente
  useMemo(() => {
    if (crmLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeoutExceeded(true)
      }, 3500)
      return () => clearTimeout(timer)
    } else {
      setLoadingTimeoutExceeded(false)
    }
  }, [crmLoading])

  const hoje = new Date()
  const [anoSelecionado, setAnoSelecionado] = useState<number>(hoje.getFullYear())
  const [mesSelecionado, setMesSelecionado] = useState<number>(hoje.getMonth() + 1)
  const [balanceteAtivo, setBalanceteAtivo] = useState<BalanceteMensalRecord | null>(null)
  const [gerando, setGerando] = useState(false)
  const [visualizandoModal, setVisualizandoModal] = useState(false)
  const [referenciasDesatualizadas, setReferenciasDesatualizadas] = useState<string[]>([])

  useEffect(() => {
    const handleDesatualizado = (e: Event) => {
      const custom = e as CustomEvent<{ referencia: string }>
      if (custom.detail?.referencia) {
        setReferenciasDesatualizadas((prev) =>
          prev.includes(custom.detail.referencia) ? prev : [...prev, custom.detail.referencia],
        )
      }
    }
    window.addEventListener('aerocad:balancete_desatualizado', handleDesatualizado)
    return () => window.removeEventListener('aerocad:balancete_desatualizado', handleDesatualizado)
  }, [])

  // Estado da expansão de balancete na listagem principal
  // Permite expandir múltiplos balancetes (ex: "bal-id")
  const [balancetesExpandidos, setBalancetesExpandidos] = useState<Set<string>>(new Set())
  // Permite expandir grupos de receitas e despesas por balancete (ex: `${balId}-rec`, `${balId}-desp`)
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set())
  // Permite expandir contas individuais (nível 2: grupo -> conta)
  const [contasExpandidas, setContasExpandidas] = useState<Set<string>>(new Set())

  // Modal de Lançamentos Analíticos da Conta (estilo Plano de Contas)
  const [contaSelecionadaModal, setContaSelecionadaModal] = useState<{
    conta: BalanceteContaResumo
    lancamentos: BalanceteLancamentoAnalitico[]
    totalValor: number
    balanceteTitulo: string
  } | null>(null)

  // Modo de visualização do documento A4 (Resumido vs Detalhado por Contas & Lançamentos)
  const [modoImpressaoA4, setModoImpressaoA4] = useState<'resumido' | 'detalhado'>('detalhado')

  // Cache/lazy loading sob demanda dos detalhes por conta de cada balancete
  const [cacheDetalhamento, setCacheDetalhamento] = useState<
    Record<
      string,
      {
        contasReceitas: BalanceteContaResumo[]
        contasDespesas: BalanceteContaResumo[]
      }
    >
  >({})

  function handleReclassificacaoSucesso() {
    // Limpa caches locais
    setCacheDetalhamento({})
    // Dispara recarregamento dos dados nas abas superiores
    if (onReload) {
      onReload()
    }
  }

  // Obter ou calcular sob demanda o detalhamento de contas de um balancete
  function obterDetalhamentoBalancete(bal: BalanceteMensalRecord) {
    if (cacheDetalhamento[bal.id]) {
      return cacheDetalhamento[bal.id]
    }
    const det = derivarDetalhamentoContasBalancete(bal, {
      parcelas,
      contasPagar,
      contasReceber,
      projetos,
      extratosTransacoes,
    })
    setCacheDetalhamento((prev) => ({ ...prev, [bal.id]: det }))
    return det
  }

  function toggleExpandirBalancete(balId: string, bal: BalanceteMensalRecord) {
    setBalancetesExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(balId)) {
        next.delete(balId)
      } else {
        next.add(balId)
        // Pré-carrega sob demanda os detalhes
        obterDetalhamentoBalancete(bal)
        // Por padrão, abre ambos os grupos (receitas e despesas) para facilitar navegação
        setGruposExpandidos((gPrev) => {
          const gNext = new Set(gPrev)
          gNext.add(`${balId}-rec`)
          gNext.add(`${balId}-desp`)
          return gNext
        })
      }
      return next
    })
  }

  function toggleExpandirGrupo(chave: string) {
    setGruposExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  function toggleExpandirConta(chave: string) {
    setContasExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  // Extrai lista de anos disponíveis com base nas transações e balancetes
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>()
    anos.add(hoje.getFullYear())
    anos.add(hoje.getFullYear() - 1)
    anos.add(2026)
    anos.add(2025)
    anos.add(2024)
    parcelas.forEach((p) => {
      const d = p.data_pagamento || p.data_faturamento || p.vencimento
      if (d) {
        const y = Number(d.slice(0, 4))
        if (!isNaN(y) && y > 2000) anos.add(y)
      }
    })
    contasPagar.forEach((c) => {
      const d = c.data_pagamento || c.data_vencimento
      if (d) {
        const y = Number(d.slice(0, 4))
        if (!isNaN(y) && y > 2000) anos.add(y)
      }
    })
    extratosTransacoes.forEach((tx) => {
      const d = tx.data
      if (d) {
        const y = Number(d.slice(0, 4))
        if (!isNaN(y) && y > 2000) anos.add(y)
      }
    })
    return Array.from(anos).sort().reverse()
  }, [parcelas, contasPagar, extratosTransacoes, hoje])

  /**
   * Consolida as receitas e despesas para um ano e mês específicos
   */
  function consolidarDadosMes(ano: number, mes: number): BalanceteConsolidadoDados {
    const mesStr = String(mes).padStart(2, '0')
    const ref = `${ano}-${mesStr}`

    // 1. Receitas do Mês: Parcelas quitadas no mês/ano OU faturadas no período + Contas a receber recebidas
    const parcelasDoMes = parcelas.filter((p) => {
      if (p.status !== 'paga') return false
      const dataPagto = p.data_pagamento || p.data_faturamento || p.vencimento
      if (!dataPagto) return false
      return dataPagto.startsWith(ref)
    })

    const avulsasDoMes = contasReceber.filter((c) => {
      if (c.status !== 'recebido') return false
      const dataRec = c.data_recebimento || c.data_vencimento
      if (!dataRec) return false
      return dataRec.startsWith(ref)
    })

    // 2. Despesas do Mês: Contas a pagar pagas no mês/ano
    const despesasDoMes = contasPagar.filter((c) => {
      if (c.status !== 'pago') return false
      const dataPag = c.data_pagamento || c.data_vencimento
      if (!dataPag) return false
      return dataPag.startsWith(ref)
    })

    // 3. Extratos bancários avulsos do mês (transações não vinculadas a contas_pagar ou parcelas já contabilizadas)
    const contasPagarIdsVinculadas = new Set(
      extratosTransacoes
        .filter((tx) => tx.vinculo_tipo === 'conta_pagar' && tx.vinculo_id)
        .map((tx) => tx.vinculo_id),
    )
    const parcelasIdsVinculadas = new Set(
      extratosTransacoes
        .filter((tx) => tx.vinculo_tipo === 'parcela' && tx.vinculo_id)
        .map((tx) => tx.vinculo_id),
    )

    const extratosDoMes = extratosTransacoes.filter((tx) => {
      if (!tx.data || !tx.data.startsWith(ref)) return false
      // Se já vinculado a registro existente de contas a pagar ou parcela, não duplicar
      if (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) {
        return false
      }
      if (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id)) {
        return false
      }
      return true
    })

    // Totalizações de Receita
    let receitaTotalMes = 0
    const recPorCategoria: Record<string, number> = {}
    const recPorClienteMap = new Map<string, { total: number; qtd: number }>()

    const itensReceita: BalanceteConsolidadoDados['receitas']['itens'] = []

    for (const p of parcelasDoMes) {
      const val = p.valor_recebido || p.valor || 0
      receitaTotalMes += val

      const cat = p.nf_numero ? 'Projetos (Faturado NFS-e)' : 'Projetos (Parcelas Contratuais)'
      recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

      const cliNome = p.expand?.cliente?.razao_social || 'Cliente Avulso'
      const cliAtual = recPorClienteMap.get(cliNome) || { total: 0, qtd: 0 }
      cliAtual.total += val
      cliAtual.qtd += 1
      recPorClienteMap.set(cliNome, cliAtual)

      itensReceita.push({
        id: p.id,
        data: (p.data_pagamento || p.vencimento || '').slice(0, 10),
        descricao: p.descricao,
        clienteNome: cliNome,
        projetoNumero: p.expand?.projeto?.numero,
        valor: val,
        origem: 'parcela',
        nfNumero: p.nf_numero,
      })
    }

    for (const c of avulsasDoMes) {
      const val = c.valor_recebido || c.valor || 0
      receitaTotalMes += val

      const cat = 'Receitas Avulsas / Outros'
      recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

      const cliNome = c.cliente_nome || c.expand?.cliente?.razao_social || 'Cliente Avulso'
      const cliAtual = recPorClienteMap.get(cliNome) || { total: 0, qtd: 0 }
      cliAtual.total += val
      cliAtual.qtd += 1
      recPorClienteMap.set(cliNome, cliAtual)

      itensReceita.push({
        id: c.id,
        data: (c.data_recebimento || c.data_vencimento || '').slice(0, 10),
        descricao: c.descricao,
        clienteNome: cliNome,
        valor: val,
        origem: 'receita_avulsa',
        nfNumero: c.numero_documento,
      })
    }

    // Extratos com entrada de crédito avulsa
    for (const tx of extratosDoMes) {
      if (tx.tipo === 'entrada') {
        const val = Math.abs(tx.valor || 0)
        receitaTotalMes += val
        const cat = 'Movimentação Bancária (Entrada Extrato)'
        recPorCategoria[cat] = (recPorCategoria[cat] || 0) + val

        const contraparte = 'Entrada Bancária PJ'
        const cliAtual = recPorClienteMap.get(contraparte) || { total: 0, qtd: 0 }
        cliAtual.total += val
        cliAtual.qtd += 1
        recPorClienteMap.set(contraparte, cliAtual)

        itensReceita.push({
          id: `tx-${tx.id}`,
          data: (tx.data || '').slice(0, 10),
          descricao: tx.descricao || 'Entrada em conta corrente PJ',
          clienteNome: contraparte,
          valor: val,
          origem: 'receita_avulsa',
          nfNumero: tx.documento_ref,
        })
      }
    }

    // Totalizações de Despesa
    let despesaTotalMes = 0
    const despPorCategoria: Record<string, number> = {}
    const despPorFornecedorMap = new Map<string, { total: number; qtd: number }>()
    const itensDespesa: BalanceteConsolidadoDados['despesas']['itens'] = []

    for (const c of despesasDoMes) {
      const val = c.valor || 0
      despesaTotalMes += val

      const catNome = c.categoria || 'outros'
      despPorCategoria[catNome] = (despPorCategoria[catNome] || 0) + val

      const fornNome = c.fornecedor || 'Fornecedor Operacional'
      const fornAtual = despPorFornecedorMap.get(fornNome) || { total: 0, qtd: 0 }
      fornAtual.total += val
      fornAtual.qtd += 1
      despPorFornecedorMap.set(fornNome, fornAtual)

      itensDespesa.push({
        id: c.id,
        data: (c.data_pagamento || c.data_vencimento || '').slice(0, 10),
        descricao: c.descricao,
        fornecedor: fornNome,
        categoria: catNome,
        valor: val,
        numeroDocumento: c.numero_documento,
      })
    }

    // Extratos com débito/saída avulsa
    for (const tx of extratosDoMes) {
      if (tx.tipo === 'saida') {
        const val = Math.abs(tx.valor || 0)
        despesaTotalMes += val

        const catNome = 'despesas_operacionais'
        despPorCategoria[catNome] = (despPorCategoria[catNome] || 0) + val

        const fornNome = tx.descricao ? tx.descricao.slice(0, 45) : 'Débito Bancário PJ'
        const fornAtual = despPorFornecedorMap.get(fornNome) || { total: 0, qtd: 0 }
        fornAtual.total += val
        fornAtual.qtd += 1
        despPorFornecedorMap.set(fornNome, fornAtual)

        itensDespesa.push({
          id: `tx-${tx.id}`,
          data: (tx.data || '').slice(0, 10),
          descricao: tx.descricao || 'Débito em conta PJ',
          fornecedor: fornNome,
          categoria: catNome,
          valor: val,
          numeroDocumento: tx.documento_ref,
        })
      }
    }

    // 4. Acumulado do Ano (de janeiro até o mês selecionado)
    let totalRecAno = 0
    let totalDespAno = 0
    const mesesAcumulado: BalanceteConsolidadoDados['acumuladoAno']['meses'] = []

    for (let m = 1; m <= mes; m++) {
      const mStr = String(m).padStart(2, '0')
      const refM = `${ano}-${mStr}`

      let recM = 0
      parcelas.forEach((p) => {
        if (p.status !== 'paga') return
        const d = p.data_pagamento || p.data_faturamento || p.vencimento
        if (d && d.startsWith(refM)) recM += p.valor_recebido || p.valor || 0
      })
      contasReceber.forEach((c) => {
        if (c.status !== 'recebido') return
        const d = c.data_recebimento || c.data_vencimento
        if (d && d.startsWith(refM)) recM += c.valor_recebido || c.valor || 0
      })

      let despM = 0
      contasPagar.forEach((c) => {
        if (c.status !== 'pago') return
        const d = c.data_pagamento || c.data_vencimento
        if (d && d.startsWith(refM)) despM += c.valor || 0
      })

      // Extratos bancários no acumulado
      extratosTransacoes.forEach((tx) => {
        if (!tx.data || !tx.data.startsWith(refM)) return
        if (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id))
          return
        if (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id)) return

        if (tx.tipo === 'entrada') recM += Math.abs(tx.valor || 0)
        else if (tx.tipo === 'saida') despM += Math.abs(tx.valor || 0)
      })

      totalRecAno += recM
      totalDespAno += despM

      mesesAcumulado.push({
        mes: m,
        nomeMes: MESES_NOMES[m - 1],
        receita: recM,
        despesa: despM,
        saldo: recM - despM,
      })
    }

    return {
      ano,
      mes,
      referencia: ref,
      receitas: {
        total: receitaTotalMes,
        porCategoria: recPorCategoria,
        porCliente: Array.from(recPorClienteMap.entries())
          .map(([clienteNome, v]) => ({ clienteNome, total: v.total, qtdLancamentos: v.qtd }))
          .sort((a, b) => b.total - a.total),
        itens: itensReceita.sort((a, b) => b.valor - a.valor),
      },
      despesas: {
        total: despesaTotalMes,
        porCategoria: despPorCategoria,
        porFornecedor: Array.from(despPorFornecedorMap.entries())
          .map(([fornecedorNome, v]) => ({
            fornecedorNome,
            total: v.total,
            qtdLancamentos: v.qtd,
          }))
          .sort((a, b) => b.total - a.total),
        itens: itensDespesa.sort((a, b) => b.valor - a.valor),
      },
      acumuladoAno: {
        receitasTotal: totalRecAno,
        despesasTotal: totalDespAno,
        saldoAcumulado: totalRecAno - totalDespAno,
        meses: mesesAcumulado,
      },
    }
  }

  // Gera ou regenera o balancete oficial e salva na coleção PocketBase
  async function handleGerarBalancete(ano: number, mes: number) {
    if (!canWrite) {
      toast.error('Apenas Administrador ou Financeiro podem gerar balancetes oficiais.')
      return
    }

    setGerando(true)
    try {
      const mesNome = MESES_NOMES[mes - 1]
      const mesStr = String(mes).padStart(2, '0')
      const ref = `${ano}-${mesStr}`

      // Usar a consolidação com contas contábeis e lançamentos analíticos
      const consolidado = consolidarBalanceteMensal(ano, mes, {
        parcelas,
        contasPagar,
        contasReceber,
        projetos,
        extratosTransacoes,
      })

      const payload = {
        referencia: ref,
        ano,
        mes,
        titulo: `BALANCETE MENSAL — ${mesNome.toUpperCase()}/${ano}`,
        receita_total: consolidado.receitas.total,
        despesa_total: consolidado.despesas.total,
        saldo_mes: consolidado.receitas.total - consolidado.despesas.total,
        saldo_acumulado_ano: consolidado.acumuladoAno.saldoAcumulado,
        total_receitas_ano: consolidado.acumuladoAno.receitasTotal,
        total_despesas_ano: consolidado.acumuladoAno.despesasTotal,
        dados_consolidados: consolidado,
        responsavel_emissao: user?.name || 'Equipe Financeira AEROCAD',
        data_emissao: new Date().toISOString().slice(0, 10),
        criado_por: user?.id,
      }

      // Procura se já existe um balancete para este período para atualizar
      const existente = balancetes.find((b) => b.referencia === ref)
      let registroSalvo: BalanceteMensalRecord

      if (existente) {
        registroSalvo = await pb.collection('balancetes_mensais').update(existente.id, payload)
        toast.success(`Balancete de ${mesNome}/${ano} regenerado com sucesso com dados atuais!`)
      } else {
        registroSalvo = await pb.collection('balancetes_mensais').create(payload)
        toast.success(`Balancete oficial de ${mesNome}/${ano} gerado com sucesso!`)
      }

      setBalanceteAtivo(registroSalvo)
      setVisualizandoModal(true)
      void reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao gerar balancete: ' + msg)
    } finally {
      setGerando(false)
    }
  }

  // Monta as seções para o Relatório A4 (Resumido ou Detalhado por Contas & Lançamentos)
  const secoesDocumentoA4 = useMemo(() => {
    if (!balanceteAtivo) return []

    const detalhe = derivarDetalhamentoContasBalancete(balanceteAtivo, {
      parcelas,
      contasPagar,
      contasReceber,
      projetos,
      extratosTransacoes,
    })

    if (modoImpressaoA4 === 'detalhado') {
      // MODO DETALHADO: Contas contábeis expandidas com lançamentos analíticos
      return [
        {
          titulo: '1. Receitas Detalhadas por Contas Contábeis e Lançamentos (Grupo 4.0)',
          subtitulo:
            'Classificação pelo Plano de Contas AEROCAD com notas fiscais, parcelas e clientes',
          tabela: {
            colunas: [
              { cabecalho: 'Conta / Lançamento', largura: '48%' },
              { cabecalho: 'Data', alinhamento: 'center' as const, largura: '14%' },
              { cabecalho: 'Documento / NFS-e', alinhamento: 'center' as const, largura: '18%' },
              { cabecalho: 'Valor (R$)', alinhamento: 'right' as const, largura: '20%' },
            ],
            linhas: detalhe.contasReceitas.flatMap((c) => {
              const headerConta = [
                {
                  conteudo: `CONTA ${c.codigoConta} — ${c.nomeConta.toUpperCase()}`,
                  destaque: true,
                },
                { conteudo: `${c.qtdLancamentos} item(ns)`, alinhamento: 'center' as const },
                { conteudo: 'Subtotal Conta', alinhamento: 'center' as const },
                {
                  conteudo: formatCurrency(c.total),
                  alinhamento: 'right' as const,
                  destaque: true,
                },
              ]

              const linhasLanc = (c.lancamentos || []).map((l) => [
                { conteudo: `  ↳ ${l.entidade} — ${l.descricao}` },
                { conteudo: l.data ? formatDate(l.data) : '—', alinhamento: 'center' as const },
                { conteudo: l.documentoRef || '—', alinhamento: 'center' as const },
                { conteudo: formatCurrency(l.valor), alinhamento: 'right' as const },
              ])

              return [headerConta, ...linhasLanc]
            }),
            linhaTotal: [
              { conteudo: 'TOTAL GERAL DE RECEITAS DO MÊS' },
              {
                conteudo: `${detalhe.contasReceitas.reduce(
                  (acc, curr) => acc + curr.qtdLancamentos,
                  0,
                )} lançamentos`,
                alinhamento: 'center' as const,
              },
              { conteudo: '—', alinhamento: 'center' as const },
              {
                conteudo: formatCurrency(balanceteAtivo.receita_total ?? 0),
                alinhamento: 'right' as const,
              },
            ],
          },
        },
        {
          titulo: '2. Despesas Detalhadas por Contas Contábeis e Favorecidos (Grupo 3.0)',
          subtitulo:
            'Custos e despesas operacionais classificadas com credores, comprovantes e valores',
          tabela: {
            colunas: [
              { cabecalho: 'Conta / Despesa Favorecido', largura: '48%' },
              { cabecalho: 'Data', alinhamento: 'center' as const, largura: '14%' },
              { cabecalho: 'Doc. / Referência', alinhamento: 'center' as const, largura: '18%' },
              { cabecalho: 'Valor (R$)', alinhamento: 'right' as const, largura: '20%' },
            ],
            linhas: detalhe.contasDespesas.flatMap((c) => {
              const headerConta = [
                {
                  conteudo: `CONTA ${c.codigoConta} — ${c.nomeConta.toUpperCase()}`,
                  destaque: true,
                },
                { conteudo: `${c.qtdLancamentos} item(ns)`, alinhamento: 'center' as const },
                { conteudo: 'Subtotal Conta', alinhamento: 'center' as const },
                {
                  conteudo: `- ${formatCurrency(c.total)}`,
                  alinhamento: 'right' as const,
                  destaque: true,
                },
              ]

              const linhasLanc = (c.lancamentos || []).map((l) => [
                { conteudo: `  ↳ ${l.entidade} — ${l.descricao}` },
                { conteudo: l.data ? formatDate(l.data) : '—', alinhamento: 'center' as const },
                { conteudo: l.documentoRef || '—', alinhamento: 'center' as const },
                { conteudo: `- ${formatCurrency(l.valor)}`, alinhamento: 'right' as const },
              ])

              return [headerConta, ...linhasLanc]
            }),
            linhaTotal: [
              { conteudo: 'TOTAL GERAL DE DESPESAS DO MÊS' },
              {
                conteudo: `${detalhe.contasDespesas.reduce(
                  (acc, curr) => acc + curr.qtdLancamentos,
                  0,
                )} lançamentos`,
                alinhamento: 'center' as const,
              },
              { conteudo: '—', alinhamento: 'center' as const },
              {
                conteudo: `- ${formatCurrency(balanceteAtivo.despesa_total ?? 0)}`,
                alinhamento: 'right' as const,
              },
            ],
          },
        },
        {
          titulo: '3. Evolução Acumulada no Exercício (Janeiro ao Mês de Referência)',
          subtitulo: 'Comportamento das entradas e saídas e saldo residual consolidado',
          tabela: {
            colunas: [
              { cabecalho: 'Mês', largura: '30%' },
              { cabecalho: 'Receitas (R$)', alinhamento: 'right' as const, largura: '25%' },
              { cabecalho: 'Despesas (R$)', alinhamento: 'right' as const, largura: '25%' },
              { cabecalho: 'Resultado (R$)', alinhamento: 'right' as const, largura: '20%' },
            ],
            linhas: (balanceteAtivo.dados_consolidados?.acumuladoAno?.meses ?? []).map((m) => [
              { conteudo: m.nomeMes, destaque: true },
              { conteudo: formatCurrency(m.receita ?? 0), alinhamento: 'right' as const },
              { conteudo: `- ${formatCurrency(m.despesa ?? 0)}`, alinhamento: 'right' as const },
              {
                conteudo: formatCurrency(m.saldo ?? 0),
                alinhamento: 'right' as const,
                destaque: true,
              },
            ]),
            linhaTotal: [
              { conteudo: 'TOTAL ACUMULADO NO ANO' },
              {
                conteudo: formatCurrency(balanceteAtivo.total_receitas_ano ?? 0),
                alinhamento: 'right' as const,
              },
              {
                conteudo: `- ${formatCurrency(balanceteAtivo.total_despesas_ano ?? 0)}`,
                alinhamento: 'right' as const,
              },
              {
                conteudo: formatCurrency(balanceteAtivo.saldo_acumulado_ano ?? 0),
                alinhamento: 'right' as const,
              },
            ],
          },
        },
      ]
    }

    // MODO RESUMIDO (padrão compacto tradicional)
    return [
      {
        titulo: '1. Receitas Realizadas no Período (por Cliente / Tomador)',
        subtitulo:
          'Parcelas contratuais quitadas, consultorias avulsas e serviços técnicos faturados',
        tabela: {
          colunas: [
            { cabecalho: 'Cliente / Tomador', largura: '45%' },
            { cabecalho: 'Lançamentos', alinhamento: 'center' as const, largura: '20%' },
            {
              cabecalho: 'Total Recebido (R$)',
              alinhamento: 'right' as const,
              largura: '35%',
            },
          ],
          linhas: (balanceteAtivo.dados_consolidados?.receitas?.porCliente ?? []).map((item) => [
            { conteudo: item.clienteNome, destaque: true },
            {
              conteudo: `${item.qtdLancamentos ?? 0} nota(s)/parcela(s)`,
              alinhamento: 'center' as const,
            },
            { conteudo: formatCurrency(item.total ?? 0), alinhamento: 'right' as const },
          ]),
          linhaTotal: [
            { conteudo: 'TOTAL DE RECEITAS DO MÊS' },
            {
              conteudo: `${balanceteAtivo.dados_consolidados?.receitas?.itens?.length ?? 0} itens`,
              alinhamento: 'center' as const,
            },
            {
              conteudo: formatCurrency(balanceteAtivo.receita_total ?? 0),
              alinhamento: 'right' as const,
            },
          ],
        },
      },
      {
        titulo: '2. Despesas Operacionais e Tributárias (por Categoria)',
        subtitulo: 'Contas a pagar quitadas: impostos, colaboradores, terceirizados e suprimentos',
        tabela: {
          colunas: [
            { cabecalho: 'Categoria da Despesa', largura: '60%' },
            { cabecalho: 'Total Pago (R$)', alinhamento: 'right' as const, largura: '40%' },
          ],
          linhas: Object.entries(
            balanceteAtivo.dados_consolidados?.despesas?.porCategoria ?? {},
          ).map(([cat, val]) => [
            { conteudo: cat.toUpperCase().replace(/_/g, ' ') },
            {
              conteudo: `- ${formatCurrency(Number(val) || 0)}`,
              alinhamento: 'right' as const,
            },
          ]),
          linhaTotal: [
            { conteudo: 'TOTAL DE DESPESAS DO MÊS' },
            {
              conteudo: `- ${formatCurrency(balanceteAtivo.despesa_total ?? 0)}`,
              alinhamento: 'right' as const,
            },
          ],
        },
      },
      {
        titulo: '3. Evolução Acumulada no Exercício (Janeiro ao Mês de Referência)',
        subtitulo: 'Comportamento das entradas e saídas e saldo residual consolidado',
        tabela: {
          colunas: [
            { cabecalho: 'Mês', largura: '30%' },
            { cabecalho: 'Receitas (R$)', alinhamento: 'right' as const, largura: '25%' },
            { cabecalho: 'Despesas (R$)', alinhamento: 'right' as const, largura: '25%' },
            { cabecalho: 'Resultado (R$)', alinhamento: 'right' as const, largura: '20%' },
          ],
          linhas: (balanceteAtivo.dados_consolidados?.acumuladoAno?.meses ?? []).map((m) => [
            { conteudo: m.nomeMes, destaque: true },
            { conteudo: formatCurrency(m.receita ?? 0), alinhamento: 'right' as const },
            {
              conteudo: `- ${formatCurrency(m.despesa ?? 0)}`,
              alinhamento: 'right' as const,
            },
            {
              conteudo: formatCurrency(m.saldo ?? 0),
              alinhamento: 'right' as const,
              destaque: true,
            },
          ]),
          linhaTotal: [
            { conteudo: 'TOTAL ACUMULADO NO ANO' },
            {
              conteudo: formatCurrency(balanceteAtivo.total_receitas_ano ?? 0),
              alinhamento: 'right' as const,
            },
            {
              conteudo: `- ${formatCurrency(balanceteAtivo.total_despesas_ano ?? 0)}`,
              alinhamento: 'right' as const,
            },
            {
              conteudo: formatCurrency(balanceteAtivo.saldo_acumulado_ano ?? 0),
              alinhamento: 'right' as const,
            },
          ],
        },
      },
    ]
  }, [
    balanceteAtivo,
    modoImpressaoA4,
    parcelas,
    contasPagar,
    contasReceber,
    projetos,
    extratosTransacoes,
  ])

  // Exportar balancete atual para planilha Excel no template AEROCAD
  async function handleExportarBalanceteXlsx(bal: BalanceteMensalRecord) {
    const dados = bal.dados_consolidados
    if (!dados) {
      toast.error('Dados consolidados do balancete não encontrados.')
      return
    }

    try {
      const linhas: Record<string, unknown>[] = []

      // 1. Bloco de Receitas
      linhas.push({
        tipo: 'SEÇÃO',
        categoria: 'RECEITAS OPERACIONAIS DO MÊS',
        detalhe: '',
        valor: dados.receitas?.total ?? 0,
      })

      for (const item of dados.receitas?.itens ?? []) {
        linhas.push({
          tipo: 'Receita',
          categoria: item.clienteNome,
          detalhe: `${item.descricao}${item.projetoNumero ? ` (${item.projetoNumero})` : ''}${
            item.nfNumero ? ` [NFS-e ${item.nfNumero}]` : ''
          }`,
          valor: item.valor ?? 0,
        })
      }

      // 2. Bloco de Despesas
      linhas.push({
        tipo: 'SEÇÃO',
        categoria: 'DESPESAS OPERACIONAIS DO MÊS',
        detalhe: '',
        valor: -(dados.despesas?.total ?? 0),
      })

      for (const item of dados.despesas?.itens ?? []) {
        linhas.push({
          tipo: 'Despesa',
          categoria: item.fornecedor,
          detalhe: `${item.descricao} - Cat: ${item.categoria}`,
          valor: -(item.valor ?? 0),
        })
      }

      await exportarTabelaParaXlsx({
        nomeArquivo: `balancete_aerocad_${bal.referencia || 'periodo'}`,
        tituloRelatorio: bal.titulo || 'Balancete Mensal AEROCAD',
        subtitulo: `Saldo Líquido do Mês: ${formatCurrency(
          bal.saldo_mes ?? 0,
        )} | Saldo Acumulado no Exercício: ${formatCurrency(bal.saldo_acumulado_ano ?? 0)}`,
        usuarioNome: bal.responsavel_emissao || user?.name,
        userRole: user?.role,
        colunas: [
          { header: 'Tipo', key: 'tipo', width: 14 },
          { header: 'Categoria / Contraparte', key: 'categoria', width: 34 },
          { header: 'Descrição do Lançamento', key: 'detalhe', width: 44 },
          { header: 'Valor (R$)', key: 'valor', width: 20, tipo: 'moeda' },
        ],
        linhas,
        totais: {
          valor: bal.saldo_mes ?? 0,
        },
      })
      toast.success('Planilha XLSX do balancete exportada com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao exportar planilha Excel: ' + msg)
    }
  }

  // Regeneração de todas as referências desatualizadas
  const handleRegenerarDesatualizados = async () => {
    if (!canWrite) return
    const refs = [...referenciasDesatualizadas]
    for (const ref of refs) {
      const [anoStr, mesStr] = ref.split('-')
      const ano = Number(anoStr)
      const mes = Number(mesStr)
      if (!isNaN(ano) && !isNaN(mes)) {
        await handleGerarBalancete(ano, mes)
      }
    }
    setReferenciasDesatualizadas([])
  }

  // Formata lista de referências (YYYY-MM -> MM/AAAA)
  const formatarReferenciasTexto = (refs: string[]) => {
    return refs
      .map((r) => {
        const parts = r.split('-')
        if (parts.length === 2) {
          return `${parts[1]}/${parts[0]}`
        }
        return r
      })
      .join(', ')
  }

  return (
    <div className="space-y-6">
      {/* Banner de Balancetes Desatualizados pós-reclassificação */}
      {referenciasDesatualizadas.length > 0 && (
        <div className="rounded-xl border border-[#FF6A13]/40 bg-gradient-to-r from-[#FFF6EC] via-white to-[#FFF6EC] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF6A13] text-white shadow-xs">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6A13] bg-orange-100 px-2 py-0.5 rounded-full">
                  Aviso Contábil AEROCAD
                </span>
                <span className="text-xs font-bold text-neutral-900">
                  Balancetes Oficiais Desatualizados
                </span>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Há balancetes oficiais desatualizados após reclassificação contábil — competências:{' '}
                <strong className="font-mono text-[#D65100]">
                  {formatarReferenciasTexto(referenciasDesatualizadas)}
                </strong>
                .
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canWrite && (
              <Button
                onClick={handleRegenerarDesatualizados}
                disabled={gerando}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-8 px-3 shadow-xs"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${gerando ? 'animate-spin' : ''}`} />
                {gerando ? 'Regenerando...' : 'Regenerar agora'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReferenciasDesatualizadas([])}
              className="h-8 px-2 text-xs text-neutral-500 hover:text-neutral-800"
              title="Ignorar aviso temporariamente"
            >
              Ignorar
            </Button>
          </div>
        </div>
      )}

      {/* 1. Header do Balancete */}
      <div className="crm-card border-[#FF6A13]/25 bg-gradient-to-br from-white via-[#FFFBF8] to-[#FFF5ED] p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs shrink-0">
              <FileText className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6A13]">
                  CONTROLADORIA & BALANÇO MENSAL
                </span>
                <span className="rounded-full bg-orange-100 text-[#D65100] text-[10px] font-bold px-2 py-0.5">
                  Restrito Admin / Financeiro
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#333]">Balancetes Mensais AEROCAD</h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Consolidação oficial de receitas (parcelas quitadas de projetos, consultorias
                avulsas e NFS-e) e despesas (contas a pagar pagas), com saldo do mês e acumulado do
                ano.
              </p>
            </div>
          </div>

          {/* Seletor do Período e Botão de Geração */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(mesSelecionado)}
              onValueChange={(val) => setMesSelecionado(Number(val))}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES_NOMES.map((nome, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(anoSelecionado)}
              onValueChange={(val) => setAnoSelecionado(Number(val))}
            >
              <SelectTrigger className="w-[110px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((ano) => (
                  <SelectItem key={ano} value={String(ano)}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canWrite ? (
              <Button
                onClick={() => handleGerarBalancete(anoSelecionado, mesSelecionado)}
                disabled={gerando}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-9 shrink-0 shadow-xs"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${gerando ? 'animate-spin' : ''}`} />
                {gerando ? 'Consolidando...' : 'Gerar / Atualizar Balancete'}
              </Button>
            ) : (
              <Button
                disabled
                className="bg-neutral-200 text-neutral-400 font-bold text-xs h-9 shrink-0 cursor-not-allowed"
                title="Apenas usuários Admin ou Financeiro podem gerar balancetes oficiais."
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Gerar Balancete (Restrito)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Histórico de Balancetes Gerados */}
      <div className="crm-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Balancetes Mensais Registrados no Período
            </h3>
            <p className="text-xs text-neutral-500">
              Selecione qualquer balancete arquivado para visualizar o documento oficial, imprimir
              em A4 ou exportar em planilha XLSX.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-500 font-semibold">
            {balancetes.length} balancetes emitidos
          </span>
        </div>

        {crmError && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Não foi possível carregar a lista remota de balancetes mensais. Você ainda pode
                gerar ou recalcular o período atual.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reload()}
              className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
            </Button>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-[#FF6A13]" />
            <span>Consultando balancetes mensais oficiais...</span>
          </div>
        ) : balancetes.length === 0 ? (
          <div className="p-8 sm:p-10 text-center rounded-xl border border-dashed border-[#FF6A13]/30 bg-gradient-to-b from-white to-[#FFFBF8] space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-[#FF6A13]">
              <FileText className="h-6 w-6 stroke-[2]" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="text-sm font-bold text-neutral-800">
                Nenhum balancete mensal oficial gerado ainda
              </p>
              <p className="text-xs text-neutral-500">
                A base contábil de balancetes consolidados está vazia. O CRM AEROCAD pode consolidar
                automaticamente todas as receitas de parcelas faturadas, consultorias avulsas e
                contas a pagar do mês de{' '}
                <strong className="text-neutral-700">
                  {MESES_NOMES[mesSelecionado - 1]}/{anoSelecionado}
                </strong>
                .
              </p>
            </div>
            {canWrite && (
              <div className="pt-1">
                <Button
                  onClick={() => handleGerarBalancete(anoSelecionado, mesSelecionado)}
                  disabled={gerando}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-9 px-4 shadow-sm"
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${gerando ? 'animate-spin' : ''}`} />
                  {gerando
                    ? 'Consolidando movimento...'
                    : `Gerar primeiro balancete oficial de ${MESES_NOMES[mesSelecionado - 1]}/${anoSelecionado}`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Referência / Título</th>
                  <th className="px-4 py-3 text-right text-emerald-700">Receitas do Mês</th>
                  <th className="px-4 py-3 text-right text-rose-700">Despesas do Mês</th>
                  <th className="px-4 py-3 text-right font-bold">Saldo do Mês</th>
                  <th className="px-4 py-3 text-right text-[#D65100]">Saldo Acumulado (Ano)</th>
                  <th className="px-4 py-3 text-center">Data Emissão</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {balancetes.map((bal) => {
                  const expandido = balancetesExpandidos.has(bal.id)
                  const detalhe = expandido ? obterDetalhamentoBalancete(bal) : null
                  const recGrupoKey = `${bal.id}-rec`
                  const despGrupoKey = `${bal.id}-desp`
                  const expandeRec = gruposExpandidos.has(recGrupoKey)
                  const expandeDesp = gruposExpandidos.has(despGrupoKey)

                  return (
                    <React.Fragment key={bal.id}>
                      <tr
                        className={`hover:bg-[#FFF6EC]/30 transition-colors ${expandido ? 'bg-[#FFF8F3]/60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandirBalancete(bal.id, bal)}
                              className="p-1 rounded-md hover:bg-orange-100 text-[#FF6A13] transition-colors focus:outline-none"
                              title={
                                expandido
                                  ? 'Recolher detalhamento por contas'
                                  : 'Expandir contas contábeis'
                              }
                            >
                              {expandido ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900">
                                  {bal.titulo || 'Balancete Mensal'}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-100 text-[#D65100] font-semibold">
                                  {expandido ? 'Contas Detalhadas' : 'Clique p/ Expandir'}
                                </span>
                              </div>
                              <div className="font-mono text-[11px] text-neutral-500">
                                Ref: {bal.referencia || '—'} · Resp:{' '}
                                {bal.responsavel_emissao || 'AEROCAD'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                          {formatCurrency(bal.receita_total ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-rose-700">
                          - {formatCurrency(bal.despesa_total ?? 0)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            (bal.saldo_mes ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatCurrency(bal.saldo_mes ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#D65100]">
                          {formatCurrency(bal.saldo_acumulado_ano ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-neutral-600">
                          {bal.data_emissao ? formatDate(bal.data_emissao) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleExpandirBalancete(bal.id, bal)}
                              className="h-8 px-2 text-xs border-orange-200 text-[#FF6A13] hover:bg-orange-50"
                              title="Expandir/Recolher Contas Contábeis"
                            >
                              <Layers className="mr-1 h-3.5 w-3.5" />
                              {expandido ? 'Recolher' : 'Expandir Contas'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setBalanceteAtivo(bal)
                                setVisualizandoModal(true)
                              }}
                              className="h-8 px-2.5 text-xs text-[#555] hover:text-[#FF6A13] hover:border-[#FF6A13]"
                              title="Visualizar documento oficial A4"
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              Ver Balancete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportarBalanceteXlsx(bal)}
                              className="h-8 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              title="Exportar planilha Excel (.XLSX)"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* LINHA EXPANSÍVEL: DETALHAMENTO DE CONTAS CONTÁBEIS */}
                      {expandido && detalhe && (
                        <tr className="bg-neutral-50/70 border-b-2 border-orange-200">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="space-y-4 rounded-lg bg-white p-4 border border-neutral-200 shadow-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FF6A13] text-white">
                                    <BookOpen className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                                      Detalhamento por Contas Contábeis (Plano de Contas AEROCAD)
                                    </h4>
                                    <p className="text-[11px] text-neutral-500">
                                      Referência {bal.referencia || '—'} · Expansão analítica de
                                      receitas e despesas vinculadas aos lançamentos
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] font-mono border-emerald-300 text-emerald-700 bg-emerald-50"
                                  >
                                    {detalhe.contasReceitas.length} contas de receita
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] font-mono border-rose-300 text-rose-700 bg-rose-50"
                                  >
                                    {detalhe.contasDespesas.length} contas de despesa
                                  </Badge>
                                </div>
                              </div>

                              {/* 1. GRUPO: RECEITAS OPERACIONAIS */}
                              <div className="rounded-md border border-emerald-200 bg-white overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandirGrupo(recGrupoKey)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 bg-emerald-50/70 hover:bg-emerald-100/60 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {expandeRec ? (
                                      <ChevronDown className="h-4 w-4 text-emerald-800" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-emerald-800" />
                                    )}
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-bold uppercase text-emerald-900 tracking-wide">
                                      Grupo 4.0 — Receitas Operacionais e Faturamento
                                    </span>
                                    <span className="text-[11px] text-emerald-700 font-mono">
                                      ({detalhe.contasReceitas.length} contas)
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono font-bold text-emerald-700">
                                    {formatCurrency(bal.receita_total ?? 0)}
                                  </div>
                                </button>

                                {expandeRec && (
                                  <div className="divide-y divide-neutral-100">
                                    {detalhe.contasReceitas.length === 0 ? (
                                      <div className="p-3 text-xs text-neutral-400 italic text-center">
                                        Nenhuma receita registrada neste período.
                                      </div>
                                    ) : (
                                      detalhe.contasReceitas.map((c) => {
                                        const contaKey = `${bal.id}-rec-${c.codigoConta}`
                                        const expandeConta = contasExpandidas.has(contaKey)
                                        return (
                                          <div key={c.codigoConta} className="text-xs">
                                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 transition-colors">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleExpandirConta(contaKey)}
                                                  className="p-0.5 rounded hover:bg-neutral-200 text-neutral-500"
                                                  title="Ver lançamentos analíticos desta conta"
                                                >
                                                  {expandeConta ? (
                                                    <ChevronDown className="h-3.5 w-3.5 text-neutral-700" />
                                                  ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700" />
                                                  )}
                                                </button>
                                                <span className="font-mono font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">
                                                  {c.codigoConta}
                                                </span>
                                                <span className="font-medium text-neutral-900 truncate">
                                                  {c.nomeConta}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                                                  ({c.grupoContabil})
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-[11px] font-mono text-neutral-500">
                                                  {c.qtdLancamentos} lançamento
                                                  {c.qtdLancamentos !== 1 ? 's' : ''}
                                                </span>
                                                <span className="font-mono font-bold text-emerald-700 w-28 text-right">
                                                  {formatCurrency(c.total)}
                                                </span>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    setContaSelecionadaModal({
                                                      conta: c,
                                                      lancamentos: c.lancamentos || [],
                                                      totalValor: c.total,
                                                      balanceteTitulo:
                                                        bal.titulo || `Balancete ${bal.referencia}`,
                                                    })
                                                  }
                                                  className="h-6 px-1.5 text-[11px] text-neutral-600 hover:text-[#FF6A13]"
                                                  title="Abrir modal de lançamentos analíticos"
                                                >
                                                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                                                  Analítico
                                                </Button>
                                              </div>
                                            </div>

                                            {/* Nível 2: Lançamentos individuais da conta */}
                                            {expandeConta && (
                                              <div className="bg-neutral-50/90 px-4 py-2 border-t border-dashed border-neutral-200">
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-[11px]">
                                                    <thead>
                                                      <tr className="text-neutral-500 font-semibold border-b border-neutral-200">
                                                        <th className="py-1 px-2 w-24">Data</th>
                                                        <th className="py-1 px-2">
                                                          Cliente / Descrição
                                                        </th>
                                                        <th className="py-1 px-2 w-28">
                                                          Doc. / NFS-e
                                                        </th>
                                                        <th className="py-1 px-2 text-right w-24">
                                                          Valor
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-200/50">
                                                      {(c.lancamentos || []).map((lanc) => (
                                                        <tr
                                                          key={lanc.id}
                                                          className="hover:bg-white/80"
                                                        >
                                                          <td className="py-1 px-2 font-mono text-neutral-600">
                                                            {lanc.data
                                                              ? formatDate(lanc.data)
                                                              : '—'}
                                                          </td>
                                                          <td className="py-1 px-2">
                                                            <div className="font-semibold text-neutral-800">
                                                              {lanc.entidade}
                                                            </div>
                                                            <div className="text-[10px] text-neutral-500 truncate max-w-md">
                                                              {lanc.descricao}
                                                            </div>
                                                          </td>
                                                          <td className="py-1 px-2 font-mono text-neutral-600">
                                                            {lanc.documentoRef || '—'}
                                                          </td>
                                                          <td className="py-1 px-2 text-right font-mono font-semibold text-emerald-700">
                                                            {formatCurrency(lanc.valor)}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 2. GRUPO: DESPESAS OPERACIONAIS E TRIBUTÁRIAS */}
                              <div className="rounded-md border border-rose-200 bg-white overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandirGrupo(despGrupoKey)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 bg-rose-50/70 hover:bg-rose-100/60 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {expandeDesp ? (
                                      <ChevronDown className="h-4 w-4 text-rose-800" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-rose-800" />
                                    )}
                                    <TrendingDown className="h-4 w-4 text-rose-600" />
                                    <span className="text-xs font-bold uppercase text-rose-900 tracking-wide">
                                      Grupo 3.0 — Custos e Despesas Operacionais
                                    </span>
                                    <span className="text-[11px] text-rose-700 font-mono">
                                      ({detalhe.contasDespesas.length} contas)
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono font-bold text-rose-700">
                                    - {formatCurrency(bal.despesa_total ?? 0)}
                                  </div>
                                </button>

                                {expandeDesp && (
                                  <div className="divide-y divide-neutral-100">
                                    {detalhe.contasDespesas.length === 0 ? (
                                      <div className="p-3 text-xs text-neutral-400 italic text-center">
                                        Nenhuma despesa registrada neste período.
                                      </div>
                                    ) : (
                                      detalhe.contasDespesas.map((c) => {
                                        const contaKey = `${bal.id}-desp-${c.codigoConta}`
                                        const expandeConta = contasExpandidas.has(contaKey)
                                        return (
                                          <div key={c.codigoConta} className="text-xs">
                                            <div className="flex items-center justify-between px-3 py-2 hover:bg-neutral-50 transition-colors">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleExpandirConta(contaKey)}
                                                  className="p-0.5 rounded hover:bg-neutral-200 text-neutral-500"
                                                  title="Ver lançamentos analíticos desta conta"
                                                >
                                                  {expandeConta ? (
                                                    <ChevronDown className="h-3.5 w-3.5 text-neutral-700" />
                                                  ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700" />
                                                  )}
                                                </button>
                                                <span className="font-mono font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">
                                                  {c.codigoConta}
                                                </span>
                                                <span className="font-medium text-neutral-900 truncate">
                                                  {c.nomeConta}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                                                  ({c.grupoContabil})
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-[11px] font-mono text-neutral-500">
                                                  {c.qtdLancamentos} lançamento
                                                  {c.qtdLancamentos !== 1 ? 's' : ''}
                                                </span>
                                                <span className="font-mono font-bold text-rose-700 w-28 text-right">
                                                  - {formatCurrency(c.total)}
                                                </span>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    setContaSelecionadaModal({
                                                      conta: c,
                                                      lancamentos: c.lancamentos || [],
                                                      totalValor: c.total,
                                                      balanceteTitulo:
                                                        bal.titulo || `Balancete ${bal.referencia}`,
                                                    })
                                                  }
                                                  className="h-6 px-1.5 text-[11px] text-neutral-600 hover:text-[#FF6A13]"
                                                  title="Abrir modal de lançamentos analíticos"
                                                >
                                                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                                                  Analítico
                                                </Button>
                                              </div>
                                            </div>

                                            {/* Nível 2: Lançamentos individuais da conta */}
                                            {expandeConta && (
                                              <div className="bg-neutral-50/90 px-4 py-2 border-t border-dashed border-neutral-200">
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-left text-[11px]">
                                                    <thead>
                                                      <tr className="text-neutral-500 font-semibold border-b border-neutral-200">
                                                        <th className="py-1 px-2 w-24">Data</th>
                                                        <th className="py-1 px-2">
                                                          Favorecido / Fornecedor
                                                        </th>
                                                        <th className="py-1 px-2">Descrição</th>
                                                        <th className="py-1 px-2 w-28">
                                                          Doc. / Ref
                                                        </th>
                                                        <th className="py-1 px-2 text-right w-24">
                                                          Valor
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-200/50">
                                                      {(c.lancamentos || []).map((lanc) => (
                                                        <tr
                                                          key={lanc.id}
                                                          className="hover:bg-white/80"
                                                        >
                                                          <td className="py-1 px-2 font-mono text-neutral-600">
                                                            {lanc.data
                                                              ? formatDate(lanc.data)
                                                              : '—'}
                                                          </td>
                                                          <td className="py-1 px-2 font-semibold text-neutral-800">
                                                            {lanc.entidade}
                                                          </td>
                                                          <td className="py-1 px-2 text-neutral-600 truncate max-w-xs">
                                                            {lanc.descricao}
                                                          </td>
                                                          <td className="py-1 px-2 font-mono text-neutral-600">
                                                            {lanc.documentoRef || '—'}
                                                          </td>
                                                          <td className="py-1 px-2 text-right font-mono font-semibold text-rose-700">
                                                            - {formatCurrency(lanc.valor)}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Modal com o Documento Oficial A4 para Preview e Impressão */}
      <Dialog open={visualizandoModal} onOpenChange={setVisualizandoModal}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-20 bg-neutral-900 text-white px-5 py-3 flex items-center justify-between shadow-md print:hidden">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#FF6A13] tracking-widest">
                PREVIEW A4 · DOCUMENTO OFICIAL
              </p>
              <h3 className="text-sm font-bold text-white truncate">
                {balanceteAtivo?.titulo || 'Balancete Mensal AEROCAD'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Seletor do Modo do Documento A4: Detalhado vs Resumido */}
              <div className="flex items-center rounded-lg bg-neutral-800 p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setModoImpressaoA4('detalhado')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    modoImpressaoA4 === 'detalhado'
                      ? 'bg-[#FF6A13] text-white shadow-xs'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Modo Detalhado (Contas & Lançamentos)
                </button>
                <button
                  type="button"
                  onClick={() => setModoImpressaoA4('resumido')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    modoImpressaoA4 === 'resumido'
                      ? 'bg-[#FF6A13] text-white shadow-xs'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Resumido
                </button>
              </div>

              {balanceteAtivo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportarBalanceteXlsx(balanceteAtivo)}
                  className="bg-transparent border-white/20 text-white hover:bg-white/10 text-xs h-8"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Exportar XLSX
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  imprimirElementoA4({
                    elementId: 'print-document',
                    titulo: `${balanceteAtivo?.titulo || 'Balancete Mensal AEROCAD'} (${
                      modoImpressaoA4 === 'detalhado' ? 'Detalhado' : 'Resumido'
                    })`,
                    orientacao: 'portrait',
                  })
                }}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs h-8"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir / Salvar PDF (A4)
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-neutral-100 flex justify-center">
            {balanceteAtivo && (
              <div className="bg-white shadow-lg border border-neutral-300 w-full max-w-[210mm]">
                <AerocadRelatorioA4
                  titulo={balanceteAtivo.titulo}
                  subtitulo={`Consolidação Contábil AEROCAD — Visualização ${
                    modoImpressaoA4 === 'detalhado'
                      ? 'Detalhada por Contas Contábeis e Lançamentos Analíticos'
                      : 'Sintética Resumida'
                  }`}
                  referenciaPeriodo={balanceteAtivo.referencia}
                  responsavelNome={balanceteAtivo.responsavel_emissao}
                  dataEmissao={balanceteAtivo.data_emissao}
                  resumoKpis={[
                    {
                      rotulo: 'Receitas do Mês',
                      valorFormatado: formatCurrency(balanceteAtivo.receita_total ?? 0),
                      cor: 'verde',
                    },
                    {
                      rotulo: 'Despesas do Mês',
                      valorFormatado: formatCurrency(balanceteAtivo.despesa_total ?? 0),
                      cor: 'vermelho',
                    },
                    {
                      rotulo: 'Saldo Líquido do Mês',
                      valorFormatado: formatCurrency(balanceteAtivo.saldo_mes ?? 0),
                      cor: (balanceteAtivo.saldo_mes ?? 0) >= 0 ? 'verde' : 'vermelho',
                      destaque: true,
                    },
                    {
                      rotulo: 'Acumulado no Ano',
                      valorFormatado: formatCurrency(balanceteAtivo.saldo_acumulado_ano ?? 0),
                      cor: 'laranja',
                      destaque: true,
                    },
                  ]}
                  secoes={secoesDocumentoA4}
                  observacoesFinais="Balancete consolidado emitido para fins gerenciais, controle de fluxo de caixa e conciliação contábil da AEROCAD. Documento gerado eletronicamente com base nos lançamentos autenticados do CRM."
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Modal de Lançamentos Analíticos da Conta Contábil Selecionada (Estilo Plano de Contas) */}
      <Dialog
        open={Boolean(contaSelecionadaModal)}
        onOpenChange={(open) => {
          if (!open) setContaSelecionadaModal(null)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-orange-100 text-[#D65100] px-2 py-0.5 rounded">
                  {contaSelecionadaModal?.conta.codigoConta}
                </span>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  {contaSelecionadaModal?.conta.nomeConta}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-neutral-500 mt-1">
              {contaSelecionadaModal?.balanceteTitulo} · Grupo:{' '}
              <strong className="text-neutral-700">
                {contaSelecionadaModal?.conta.grupoContabil}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* Resumo da Conta no Balancete */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-2">
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
              <span className="text-[10px] font-bold uppercase text-neutral-500">Natureza</span>
              <p className="text-xs font-semibold text-neutral-800 capitalize mt-0.5">
                {contaSelecionadaModal?.conta.natureza === 'receita'
                  ? 'Receita (Crédito)'
                  : 'Despesa (Débito)'}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
              <span className="text-[10px] font-bold uppercase text-neutral-500">
                Total de Itens
              </span>
              <p className="text-xs font-mono font-semibold text-neutral-800 mt-0.5">
                {contaSelecionadaModal?.lancamentos.length ?? 0} lançamento(s)
              </p>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-neutral-500">Volume Total</span>
              <p
                className={`text-xs font-mono font-bold mt-0.5 ${
                  contaSelecionadaModal?.conta.natureza === 'receita'
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {contaSelecionadaModal?.conta.natureza === 'despesa' ? '- ' : ''}
                {formatCurrency(contaSelecionadaModal?.totalValor ?? 0)}
              </p>
            </div>
          </div>

          {/* Tabela de Lançamentos Analíticos */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-24">Data</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Favorecido / Tomador</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 w-28">Doc. / Ref</th>
                  <th className="px-3 py-2 text-right w-24">Valor (R$)</th>
                  <th className="px-3 py-2 w-48 text-center">Conta Contábil (Inline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {(contaSelecionadaModal?.lancamentos ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-xs text-neutral-400 italic">
                      Nenhum lançamento encontrado nesta conta.
                    </td>
                  </tr>
                ) : (
                  contaSelecionadaModal?.lancamentos.map((lanc) => {
                    const targetId =
                      lanc.registroIdOriginal || lanc.id.replace(/^(parc|cp|cr|tx)-/, '')
                    const targetColecao =
                      lanc.origem === 'extrato'
                        ? 'extratos_transacoes'
                        : lanc.origem === 'conta_pagar'
                          ? 'contas_pagar'
                          : lanc.origem === 'parcela'
                            ? 'parcelas'
                            : 'contas_receber'

                    return (
                      <tr key={lanc.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 font-mono text-neutral-600">
                          {lanc.data ? formatDate(lanc.data) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            {lanc.origemLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-neutral-900">
                          {lanc.entidade}
                        </td>
                        <td
                          className="px-3 py-2 text-neutral-600 max-w-[220px]"
                          title={lanc.descricao}
                        >
                          <p className="truncate font-medium text-neutral-900">{lanc.descricao}</p>
                          {lanc.observacoes && (
                            <p
                              className="text-[10px] text-neutral-500 truncate"
                              title={lanc.observacoes}
                            >
                              <span className="font-semibold text-neutral-600">Obs:</span>{' '}
                              {lanc.observacoes}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-neutral-600 text-[11px]">
                          {lanc.documentoRef || '—'}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold ${
                            lanc.tipoMovimento === 'credito' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {lanc.tipoMovimento === 'debito' ? '- ' : ''}
                          {formatCurrency(lanc.valor)}
                        </td>
                        <td className="px-3 py-2">
                          {targetColecao && targetId ? (
                            <ContaContabilBadgeInline
                              colecao={targetColecao}
                              id={targetId}
                              codigoAtual={lanc.codigoConta}
                              nomeAtual={lanc.nomeConta}
                              classificacaoManual={lanc.classificacaoManual}
                              dataRegistro={lanc.data}
                              descricaoRegistro={lanc.descricao}
                              observacoesAtual={lanc.observacoes}
                              compacto={false}
                              onReclassificado={(novoCod, novoNome, novasObs) => {
                                lanc.codigoConta = novoCod
                                lanc.nomeConta = novoNome
                                lanc.classificacaoManual = true
                                if (novasObs !== undefined) {
                                  lanc.observacoes = novasObs
                                }
                                handleReclassificacaoSucesso()
                              }}
                            />
                          ) : (
                            <span className="font-mono text-xs text-neutral-600">
                              {lanc.codigoConta || 'Sem conta'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter className="mt-4 border-t pt-3 flex items-center justify-between sm:justify-between">
            <span className="text-[11px] text-neutral-500 font-mono">
              Registros conciliados com segurança · Sem dupla contagem
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContaSelecionadaModal(null)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
