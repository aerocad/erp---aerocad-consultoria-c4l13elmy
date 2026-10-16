import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
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
import type {
  BalanceteConsolidadoDados,
  BalanceteMensalRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ParcelaRecord,
  ProjetoRecord,
} from '@/types/crm'

interface BalancetesTabProps {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  projetos: ProjetoRecord[]
}

const MESES_NOMES = [
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

export function BalancetesTab({
  parcelas,
  contasPagar,
  contasReceber,
  projetos,
}: BalancetesTabProps) {
  const { user } = useAuth()
  const { ocultarValores } = useFinanceiroVisibilidade()
  const canWrite = user?.role === 'admin' || user?.role === 'financeiro'

  const {
    data: balancetes,
    loading,
    reload,
  } = useCrmData<BalanceteMensalRecord>('balancetes_mensais', {
    sort: '-referencia',
    expand: 'criado_por',
  })

  const hoje = new Date()
  const [anoSelecionado, setAnoSelecionado] = useState<number>(hoje.getFullYear())
  const [mesSelecionado, setMesSelecionado] = useState<number>(hoje.getMonth() + 1)
  const [balanceteAtivo, setBalanceteAtivo] = useState<BalanceteMensalRecord | null>(null)
  const [gerando, setGerando] = useState(false)
  const [visualizandoModal, setVisualizandoModal] = useState(false)

  // Extrai lista de anos disponíveis com base nas transações e balancetes
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>()
    anos.add(2026)
    anos.add(2025)
    anos.add(2024)
    parcelas.forEach((p) => {
      const d = p.data_pagamento || p.vencimento
      if (d) anos.add(new Date(d).getFullYear())
    })
    contasPagar.forEach((c) => {
      const d = c.data_pagamento || c.data_vencimento
      if (d) anos.add(new Date(d).getFullYear())
    })
    return Array.from(anos).sort().reverse()
  }, [parcelas, contasPagar])

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

    // Totalizações de Receita
    let receitaTotalMes = 0
    const recPorCategoria: Record<string, number> = {}
    const recPorClienteMap = new Map<string, { total: number; qtd: number }>()

    const itensReceita: BalanceteConsolidadoDados['receitas']['itens'] = []

    for (const p of parcelasDoMes) {
      const val = p.valor_recebido || p.valor
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
      const val = c.valor_recebido || c.valor
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

    // Totalizações de Despesa
    let despesaTotalMes = 0
    const despPorCategoria: Record<string, number> = {}
    const despPorFornecedorMap = new Map<string, { total: number; qtd: number }>()
    const itensDespesa: BalanceteConsolidadoDados['despesas']['itens'] = []

    for (const c of despesasDoMes) {
      const val = c.valor
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

    // 3. Acumulado do Ano (de janeiro até o mês selecionado)
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
        if (d && d.startsWith(refM)) recM += p.valor_recebido || p.valor
      })
      contasReceber.forEach((c) => {
        if (c.status !== 'recebido') return
        const d = c.data_recebimento || c.data_vencimento
        if (d && d.startsWith(refM)) recM += c.valor_recebido || c.valor
      })

      let despM = 0
      contasPagar.forEach((c) => {
        if (c.status !== 'pago') return
        const d = c.data_pagamento || c.data_vencimento
        if (d && d.startsWith(refM)) despM += c.valor
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
      const consolidado = consolidarDadosMes(ano, mes)

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

  return (
    <div className="space-y-6">
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

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500">Carregando balancetes...</div>
        ) : balancetes.length === 0 ? (
          <div className="p-8 sm:p-10 text-center rounded-xl border border-dashed border-[#FF6A13]/30 bg-gradient-to-b from-white to-[#FFFBF8] space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-[#FF6A13]">
              <FileText className="h-6 w-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-neutral-800">
                Nenhum balancete mensal emitido para o período selecionado.
              </p>
              <p className="text-xs text-neutral-500 max-w-lg mx-auto">
                Utilize o botão acima para consolidar receitas, despesas e apurar o saldo oficial.
              </p>
            </div>
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
                {balancetes.map((bal) => (
                  <tr key={bal.id} className="hover:bg-[#FFF6EC]/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-neutral-900">
                        {bal.titulo || 'Balancete Mensal'}
                      </div>
                      <div className="font-mono text-[11px] text-neutral-500">
                        Ref: {bal.referencia || '—'} · Resp: {bal.responsavel_emissao || 'AEROCAD'}
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
                ))}
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
            <div className="flex items-center gap-2">
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
                onClick={() => window.print()}
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
                  subtitulo="Consolidação Contábil de Receitas Operacionais, Tributos e Despesas"
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
                  secoes={[
                    {
                      titulo: '1. Receitas Realizadas no Período (por Cliente / Tomador)',
                      subtitulo:
                        'Parcelas contratuais quitadas, consultorias avulsas e serviços técnicos faturados',
                      tabela: {
                        colunas: [
                          { cabecalho: 'Cliente / Tomador', largura: '45%' },
                          { cabecalho: 'Lançamentos', alinhamento: 'center', largura: '20%' },
                          {
                            cabecalho: 'Total Recebido (R$)',
                            alinhamento: 'right',
                            largura: '35%',
                          },
                        ],
                        linhas: (balanceteAtivo.dados_consolidados?.receitas?.porCliente ?? []).map(
                          (item) => [
                            { conteudo: item.clienteNome, destaque: true },
                            {
                              conteudo: `${item.qtdLancamentos ?? 0} nota(s)/parcela(s)`,
                              alinhamento: 'center',
                            },
                            { conteudo: formatCurrency(item.total ?? 0), alinhamento: 'right' },
                          ],
                        ),
                        linhaTotal: [
                          { conteudo: 'TOTAL DE RECEITAS DO MÊS' },
                          {
                            conteudo: `${
                              balanceteAtivo.dados_consolidados?.receitas?.itens?.length ?? 0
                            } itens`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(balanceteAtivo.receita_total ?? 0),
                            alinhamento: 'right',
                          },
                        ],
                      },
                    },
                    {
                      titulo: '2. Despesas Operacionais e Tributárias (por Categoria)',
                      subtitulo:
                        'Contas a pagar quitadas: impostos, colaboradores, terceirizados e suprimentos',
                      tabela: {
                        colunas: [
                          { cabecalho: 'Categoria da Despesa', largura: '60%' },
                          { cabecalho: 'Total Pago (R$)', alinhamento: 'right', largura: '40%' },
                        ],
                        linhas: Object.entries(
                          balanceteAtivo.dados_consolidados?.despesas?.porCategoria ?? {},
                        ).map(([cat, val]) => [
                          { conteudo: cat.toUpperCase().replace(/_/g, ' ') },
                          {
                            conteudo: `- ${formatCurrency(Number(val) || 0)}`,
                            alinhamento: 'right',
                          },
                        ]),
                        linhaTotal: [
                          { conteudo: 'TOTAL DE DESPESAS DO MÊS' },
                          {
                            conteudo: `- ${formatCurrency(balanceteAtivo.despesa_total ?? 0)}`,
                            alinhamento: 'right',
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
                          { cabecalho: 'Receitas (R$)', alinhamento: 'right', largura: '25%' },
                          { cabecalho: 'Despesas (R$)', alinhamento: 'right', largura: '25%' },
                          { cabecalho: 'Resultado (R$)', alinhamento: 'right', largura: '20%' },
                        ],
                        linhas: (balanceteAtivo.dados_consolidados?.acumuladoAno?.meses ?? []).map(
                          (m) => [
                            { conteudo: m.nomeMes, destaque: true },
                            { conteudo: formatCurrency(m.receita ?? 0), alinhamento: 'right' },
                            {
                              conteudo: `- ${formatCurrency(m.despesa ?? 0)}`,
                              alinhamento: 'right',
                            },
                            {
                              conteudo: formatCurrency(m.saldo ?? 0),
                              alinhamento: 'right',
                              destaque: true,
                            },
                          ],
                        ),
                        linhaTotal: [
                          { conteudo: 'TOTAL ACUMULADO NO ANO' },
                          {
                            conteudo: formatCurrency(balanceteAtivo.total_receitas_ano ?? 0),
                            alinhamento: 'right',
                          },
                          {
                            conteudo: `- ${formatCurrency(balanceteAtivo.total_despesas_ano ?? 0)}`,
                            alinhamento: 'right',
                          },
                          {
                            conteudo: formatCurrency(balanceteAtivo.saldo_acumulado_ano ?? 0),
                            alinhamento: 'right',
                          },
                        ],
                      },
                    },
                  ]}
                  observacoesFinais="Balancete consolidado emitido para fins gerenciais, controle de fluxo de caixa e conciliação de faturamento de contratos da AEROCAD. Documento gerado eletronicamente com base nos lançamentos autenticados do CRM."
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
