/**
 * Aba de Plano de Contas Completo da AEROCAD Consultoria
 *
 * Apresenta a árvore hierárquica contábil:
 * - Grupos sintéticos (1. Ativo, 2. Passivo, 3. Despesas e Custos, 4. Receitas)
 * - Subgrupos (Ativo Circulante, Ativo Não Circulante, Passivo Circulante, Despesas Fixas, Custos Diretos, etc.)
 * - Contas individualizadas analíticas com códigos, tipo, regime (fixo/variável)
 * - Contagem e totalização de lançamentos vinculados em extratos bancários, contas a pagar, parcelas de faturamento, contas a receber e patrimônio
 * - Gaveta / Modal de Lançamentos Analíticos com listagem de todos os registros que compõem a conta
 * - Visual oficial AEROCAD: #FF6A13, Arial, prancheta técnica
 */

import { useState, useMemo } from 'react'
import {
  Search,
  BookOpen,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  Calendar,
  X,
  CreditCard,
  Printer,
  Download,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import {
  PLANO_CONTAS_AEROCAD,
  ItemPlanoContas,
  TipoNaturezaConta,
  LancamentoMapeado,
  classificarTransacaoExtrato,
  classificarContaPagar,
  classificarContaReceber,
  classificarParcela,
  classificarAtivoPatrimonio,
} from '@/lib/planoContas'
import {
  ContaPagarRecord,
  ParcelaRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ContaBancariaRecord,
  AtivoPatrimonioRecord,
} from '@/types/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { exportarTabelaParaXlsx } from '@/services/aerocadXlsxExporter'
import { imprimirElementoA4 } from '@/services/relatorioImpressaoService'
import { AerocadRelatorioA4 } from '@/components/financeiro/AerocadRelatorioA4'
import { ContaContabilBadgeInline } from '@/components/financeiro/ContaContabilBadgeInline'

export interface PlanoContasTabProps {
  contasPagar?: ContaPagarRecord[]
  parcelas?: ParcelaRecord[]
  contasReceber?: ContaReceberRecord[]
  extratosTransacoes?: ExtratoTransacaoRecord[]
  contasBancarias?: ContaBancariaRecord[]
  ativosPatrimonio?: AtivoPatrimonioRecord[]
  canWrite?: boolean
  onNavegarParaLancamentos?: (
    tipo: 'pagar' | 'receber' | 'extratos',
    filtro: { codigo: string; nome: string; categoria?: string },
  ) => void
  onReload?: () => void
}

interface GrupoEstruturado {
  id: string
  codigoPrefixo: string
  nome: string
  natureza: TipoNaturezaConta
  subgrupos: {
    nome: string
    contas: (ItemPlanoContas & {
      qtdLancamentos: number
      totalValor: number
      lancamentos: LancamentoMapeado[]
    })[]
  }[]
  qtdTotalLancamentos: number
  totalValor: number
}

const NATUREZA_CONFIG: Record<
  TipoNaturezaConta,
  { label: string; corBadge: string; icon: typeof TrendingUp; corTexto: string }
> = {
  ativo: {
    label: 'Ativo',
    corBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    corTexto: 'text-blue-600',
    icon: Layers,
  },
  passivo: {
    label: 'Passivo',
    corBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    corTexto: 'text-amber-600',
    icon: Layers,
  },
  patrimonio_liquido: {
    label: 'Patrimônio Líquido',
    corBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    corTexto: 'text-purple-600',
    icon: Layers,
  },
  despesa: {
    label: 'Despesa / Custo',
    corBadge: 'bg-red-50 text-red-700 border-red-200',
    corTexto: 'text-red-600',
    icon: TrendingDown,
  },
  receita: {
    label: 'Receita',
    corBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corTexto: 'text-emerald-600',
    icon: TrendingUp,
  },
}

export function PlanoContasTab({
  contasPagar = [],
  parcelas = [],
  contasReceber = [],
  extratosTransacoes = [],
  contasBancarias = [],
  ativosPatrimonio = [],
  onNavegarParaLancamentos,
  onReload,
}: PlanoContasTabProps) {
  const { user } = useAuth()
  const { ocultarValores } = useFinanceiroVisibilidade()
  const canExportAndPrint = Boolean(user?.role === 'admin' || user?.role === 'financeiro')

  const anoAtualCorrente = new Date().getFullYear()
  const [filtroAno, setFiltroAno] = useState<string>(String(anoAtualCorrente))
  const [busca, setBusca] = useState('')
  const [filtroNatureza, setFiltroNatureza] = useState<string>('todos')
  const [apenasComLancamentos, setApenasComLancamentos] = useState(false)
  const [visualizandoImpressaoModal, setVisualizandoImpressaoModal] = useState(false)
  const [contaSelecionadaModal, setContaSelecionadaModal] = useState<{
    conta: ItemPlanoContas
    lancamentos: LancamentoMapeado[]
    totalValor: number
  } | null>(null)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '3': true,
    '4': true,
  })

  // Extrai o ano de uma string de data (ISO 'YYYY-MM-DD...', BR 'DD/MM/YYYY' ou timestamp) de forma defensiva
  const extrairAnoDeData = (dataStr?: string | null): number | null => {
    if (!dataStr || typeof dataStr !== 'string') return null
    const limpo = dataStr.trim()
    if (!limpo) return null

    // Formato ISO: '2026-03-15...'
    if (/^\d{4}/.test(limpo)) {
      const y = Number(limpo.slice(0, 4))
      if (!isNaN(y) && y >= 2000 && y <= 2050) return y
    }

    // Formato brasileiro: '15/03/2026' ou '15-03-2026'
    const matchBr = limpo.match(/\d{2}[/-]\d{2}[/-](\d{4})/)
    if (matchBr && matchBr[1]) {
      const y = Number(matchBr[1])
      if (!isNaN(y) && y >= 2000 && y <= 2050) return y
    }

    // Fallback defensivo com Date.parse
    try {
      const parsed = new Date(limpo)
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear()
        if (y >= 2000 && y <= 2050) return y
      }
    } catch {
      // Ignora silenciosamente para não quebrar a aplicação
    }

    return null
  }

  // 0. Extração dinâmica de anos disponíveis nos dados financeiros reais
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>()
    // Garante no mínimo o ano corrente
    anos.add(anoAtualCorrente)

    const coletarAno = (dataStr?: string | null) => {
      const y = extrairAnoDeData(dataStr)
      if (y) anos.add(y)
    }

    parcelas.forEach((p) => {
      coletarAno(p.data_pagamento)
      coletarAno(p.data_faturamento)
      coletarAno(p.vencimento)
      coletarAno(p.created)
    })
    contasPagar.forEach((c) => {
      coletarAno(c.data_pagamento)
      coletarAno(c.data_vencimento)
      coletarAno(c.created)
    })
    contasReceber.forEach((c) => {
      coletarAno(c.data_recebimento)
      coletarAno(c.data_vencimento)
      coletarAno(c.created)
    })
    extratosTransacoes.forEach((tx) => {
      coletarAno(tx.data)
      coletarAno(tx.created)
    })
    ativosPatrimonio.forEach((at) => {
      coletarAno(at.data_aquisicao)
      coletarAno(at.created)
    })
    contasBancarias.forEach((cb) => {
      coletarAno(cb.data_saldo_inicial)
      coletarAno(cb.created)
    })

    return Array.from(anos).sort((a, b) => b - a)
  }, [
    anoAtualCorrente,
    parcelas,
    contasPagar,
    contasReceber,
    extratosTransacoes,
    ativosPatrimonio,
    contasBancarias,
  ])

  // Helper defensivo para testar se uma data pertence ao ano filtrado.
  // Se filtroAno for 'todos', aceita qualquer registro (mesmo sem data ou com data nula/inválida).
  // Se houver um ano específico selecionado, extrai defensivamente o ano do registro.
  const correspondeAoAno = (dataStr?: string | null): boolean => {
    if (!filtroAno || filtroAno === 'todos') return true
    if (!dataStr) return false
    const y = extrairAnoDeData(dataStr)
    return y !== null && String(y) === String(filtroAno)
  }

  // 1. Mapear lançamentos da AEROCAD respeitando o filtro de ANO selecionado
  // Carrega e integra contas customizadas salvas no banco
  const [contasCustomizadas, setContasCustomizadas] = useState<
    import('@/services/assistenteAcoesService').PlanoContasCustomizadaRecord[]
  >([])

  useEffect(() => {
    import('@/services/assistenteAcoesService').then((m) => {
      m.listarContasCustomizadas().then((extras) => {
        setContasCustomizadas(extras)
        m.obterPlanoContasCompleto().then((completo) => {
          import('@/lib/planoContas').then((pc) => pc.registrarContasExtrasPlano(completo))
        })
      })
    })
  }, [])

  const todosLancamentosMapeados = useMemo<LancamentoMapeado[]>(() => {
    const lista: LancamentoMapeado[] = []

    // 1.1 Disponibilidades (Contas Bancárias PJ no Ativo 1.1.1)
    for (const cb of contasBancarias) {
      const dataCb = cb.data_saldo_inicial || cb.created?.slice(0, 10) || ''
      if (correspondeAoAno(dataCb)) {
        const saldo = Number(cb.saldo_atual) || 0
        if (Math.abs(saldo) > 0) {
          lista.push({
            id: `cb-${cb.id}`,
            origem: 'conta_bancaria',
            origemLabel: 'Conta Bancária PJ',
            codigoConta: '1.1.1',
            nomeConta: 'Disponibilidades (Bancos Conta Movimento PJ)',
            natureza: 'ativo',
            descricao: `Saldo em Conta Corrente PJ (${cb.banco_nome || 'Banco'} · Ag: ${cb.agencia || '-'} CC: ${cb.conta_corrente || '-'})`,
            entidade: cb.banco_nome || 'Banco PJ',
            data: dataCb || `${filtroAno !== 'todos' ? filtroAno : anoAtualCorrente}-01-01`,
            valor: Math.abs(saldo),
            tipoMovimento: saldo >= 0 ? 'debito' : 'credito',
            status: cb.status === 'ativa' ? 'Ativa' : 'Inativa',
            documentoRef: cb.tipo_chave_pix ? `PIX: ${cb.chave_pix}` : undefined,
          })
        }
      }
    }

    // 1.2 Ativos Patrimoniais Imobilizados / Intangíveis (Ativo 1.2.x)
    for (const at of ativosPatrimonio) {
      const dataAt = at.data_aquisicao || at.created?.slice(0, 10) || ''
      if (correspondeAoAno(dataAt)) {
        const contaAlvo = classificarAtivoPatrimonio(at)
        const valorAtivo = Number(at.valor_contabil_atual) || Number(at.valor_aquisicao) || 0
        lista.push({
          id: `at-${at.id}`,
          origem: 'ativo',
          origemLabel: 'Ativo Patrimonial',
          codigoConta: contaAlvo.codigo,
          nomeConta: contaAlvo.nome,
          natureza: 'ativo',
          descricao: `${at.descricao || at.categoria || 'Ativo Patrimonial'} (${at.identificador_codigo || 'Sem código'})`,
          entidade: at.fornecedor_nome || at.expand?.credor?.nome_razao_social || 'AEROCAD',
          data: dataAt,
          valor: Math.abs(valorAtivo),
          tipoMovimento: 'debito',
          status: at.status || 'ativo',
          documentoRef: at.numero_nf_registro ? `NF ${at.numero_nf_registro}` : undefined,
        })
      }
    }

    // 1.3 Contas a Receber (Faturamento / Medições emitidas de Projetos - 1.1.2 Ativo ou 4.1.x Receita)
    for (const cr of contasReceber) {
      const dataCr = cr.data_recebimento || cr.data_vencimento || cr.created?.slice(0, 10) || ''
      if (correspondeAoAno(dataCr)) {
        const contaReceita = classificarContaReceber(cr)
        const val = Number(cr.valor) || Number(cr.valor_recebido) || 0
        lista.push({
          id: `cr-${cr.id}`,
          registroIdOriginal: cr.id,
          classificacaoManual: cr.classificacao_manual,
          origem: 'conta_receber',
          origemLabel: 'Conta a Receber',
          codigoConta: contaReceita.codigo,
          nomeConta: contaReceita.nome,
          natureza: 'receita',
          descricao: cr.descricao || 'Receita Técnica Operacional',
          entidade: cr.cliente_nome || cr.expand?.cliente?.razao_social || 'Cliente AEROCAD',
          data: dataCr,
          valor: Math.abs(val),
          tipoMovimento: 'credito',
          status: cr.status || 'pendente',
          documentoRef: cr.numero_documento,
          observacoes: cr.observacoes,
        })
      }
    }

    // 1.4 Parcelas de Projetos Aeronáuticos (Receitas - 4.1.x e Ativo - 1.1.2)
    for (const p of parcelas) {
      const dataP =
        p.data_pagamento || p.vencimento || p.data_faturamento || p.created?.slice(0, 10) || ''
      if (correspondeAoAno(dataP)) {
        const contaReceita = classificarParcela(p)
        const val = Number(p.valor_recebido) || Number(p.valor) || 0
        lista.push({
          id: `parc-${p.id}`,
          registroIdOriginal: p.id,
          classificacaoManual: p.classificacao_manual,
          origem: 'parcela',
          origemLabel: 'Parcela de Projeto',
          codigoConta: contaReceita.codigo,
          nomeConta: contaReceita.nome,
          natureza: 'receita',
          descricao: `${p.expand?.projeto?.numero ? `[${p.expand.projeto.numero}] ` : ''}${p.descricao || 'Parcela de Contrato'}`,
          entidade:
            p.expand?.cliente?.razao_social || p.expand?.projeto?.nome || 'Cliente do Projeto',
          data: dataP,
          valor: Math.abs(val),
          tipoMovimento: 'credito',
          status: p.status || 'pendente',
          documentoRef: p.nf_numero ? `NFS-e ${p.nf_numero}` : undefined,
          observacoes: p.observacoes,
        })

        // Se a parcela está pendente de recebimento, ela também representa direito a receber no Ativo Circulante (1.1.2)
        if (p.status === 'pendente' || p.status === 'vencida') {
          const valAtivo = Number(p.valor) || 0
          lista.push({
            id: `parc-ativo-${p.id}`,
            origem: 'parcela',
            origemLabel: 'Direito a Receber (Ativo)',
            codigoConta: '1.1.2',
            nomeConta: 'Contas a Receber de Clientes (Projetos em Andamento)',
            natureza: 'ativo',
            descricao: `Faturamento a Receber: ${p.expand?.projeto?.numero || ''} ${p.descricao || ''}`,
            entidade: p.expand?.cliente?.razao_social || 'Cliente do Projeto',
            data: p.vencimento || dataP,
            valor: Math.abs(valAtivo),
            tipoMovimento: 'debito',
            status: p.status,
            documentoRef: p.nf_numero ? `NFS-e ${p.nf_numero}` : undefined,
          })
        }
      }
    }

    // 1.5 Contas a Pagar (Despesas Operacionais, Tributos, Folha, Terceiros)
    for (const cp of contasPagar) {
      const dataCp = cp.data_pagamento || cp.data_vencimento || cp.created?.slice(0, 10) || ''
      if (correspondeAoAno(dataCp)) {
        const contaDespesa = classificarContaPagar(cp)
        const val = Number(cp.valor) || 0

        lista.push({
          id: `cp-${cp.id}`,
          registroIdOriginal: cp.id,
          classificacaoManual: cp.classificacao_manual,
          origem: 'conta_pagar',
          origemLabel: 'Conta a Pagar',
          codigoConta: contaDespesa.codigo,
          nomeConta: contaDespesa.nome,
          natureza: contaDespesa.natureza,
          descricao: cp.descricao || 'Despesa Administrativa/Operacional',
          entidade: cp.fornecedor || cp.expand?.credor?.nome_razao_social || 'Fornecedor/Credor',
          data: dataCp,
          valor: Math.abs(val),
          tipoMovimento: 'debito',
          status: cp.status || 'pendente',
          documentoRef: cp.numero_documento,
          observacoes: cp.observacoes,
        })

        // Se estiver pendente, também alimenta obrigações a pagar no Passivo Circulante (2.1.1 ou 2.1.3)
        if (cp.status === 'pendente') {
          const codigoPassivo = contaDespesa.codigo.startsWith('3.3')
            ? '2.1.3'
            : contaDespesa.codigo.startsWith('3.4')
              ? '2.1.4'
              : contaDespesa.codigo === '2.1.5' || cp.categoria === 'despesas_operacionais'
                ? '2.1.5'
                : '2.1.1'
          const itemPassivo = PLANO_CONTAS_AEROCAD.find((i) => i.codigo === codigoPassivo)
          if (itemPassivo) {
            lista.push({
              id: `cp-passivo-${cp.id}`,
              origem: 'conta_pagar',
              origemLabel: 'Obrigação a Pagar (Passivo)',
              codigoConta: itemPassivo.codigo,
              nomeConta: itemPassivo.nome,
              natureza: 'passivo',
              descricao: `Obrigação a Pagar: ${cp.descricao || cp.fornecedor || 'Despesa'}`,
              entidade: cp.fornecedor || cp.expand?.credor?.nome_razao_social || 'Credor',
              data: cp.data_vencimento || dataCp,
              valor: Math.abs(val),
              tipoMovimento: 'credito',
              status: cp.status,
              documentoRef: cp.numero_documento,
            })
          }
        }
      }
    }

    // 1.6 Extratos Bancários (Transações importadas .RET, OFX, PDF, CSV)
    // Se a transação estiver vinculada a uma conta_pagar/parcela já contabilizada, evitamos dupla contagem
    for (const tx of extratosTransacoes) {
      const dataTx = tx.data || tx.created?.slice(0, 10) || ''
      if (!correspondeAoAno(dataTx)) continue

      const temVinculoDiretoComRegistroExistente =
        (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) ||
        (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id))

      if (!temVinculoDiretoComRegistroExistente) {
        const contaAlvo = classificarTransacaoExtrato(tx)
        const valorTx = Number(tx.valor) || 0
        lista.push({
          id: `tx-${tx.id}`,
          registroIdOriginal: tx.id,
          classificacaoManual: tx.classificacao_manual,
          origem: 'extrato',
          origemLabel: 'Extrato Bancário',
          codigoConta: contaAlvo.codigo,
          nomeConta: contaAlvo.nome,
          natureza: contaAlvo.natureza,
          descricao: tx.descricao || 'Movimentação em Conta PJ',
          data: dataTx,
          valor: Math.abs(valorTx),
          tipoMovimento: tx.tipo === 'entrada' ? 'credito' : 'debito',
          status: tx.status_conciliacao || 'conciliado',
          documentoRef: tx.documento_ref,
          observacoes: tx.observacoes,
        })
      }
    }

    return lista
  }, [
    contasBancarias,
    ativosPatrimonio,
    contasReceber,
    parcelas,
    contasPagar,
    extratosTransacoes,
    filtroAno,
    anoAtualCorrente,
  ])
  // 2. Mapa indexado de lançamentos por código da conta
  const mapaLancamentosPorConta = useMemo(() => {
    const mapa = new Map<string, { qtd: number; valor: number; lancamentos: LancamentoMapeado[] }>()

    for (const lanc of todosLancamentosMapeados) {
      const atual = mapa.get(lanc.codigoConta) || { qtd: 0, valor: 0, lancamentos: [] }
      atual.qtd += 1
      atual.valor += lanc.valor || 0
      atual.lancamentos.push(lanc)
      mapa.set(lanc.codigoConta, atual)
    }

    return mapa
  }, [todosLancamentosMapeados])

  // 3. Montar a Árvore Hierárquica contábil
  const arvoreEstruturada = useMemo<GrupoEstruturado[]>(() => {
    const gruposDefs: {
      id: string
      codigoPrefixo: string
      nome: string
      natureza: TipoNaturezaConta
    }[] = [
      {
        id: '1',
        codigoPrefixo: '1.',
        nome: '1. ATIVO (Disponibilidades, Direitos e Imobilizado)',
        natureza: 'ativo',
      },
      {
        id: '2',
        codigoPrefixo: '2.',
        nome: '2. PASSIVO (Obrigações a Curto e Longo Prazo)',
        natureza: 'passivo',
      },
      {
        id: '3',
        codigoPrefixo: '3.',
        nome: '3. DESPESAS E CUSTOS OPERACIONAIS (DRE & Ponto de Equilíbrio)',
        natureza: 'despesa',
      },
      {
        id: '4',
        codigoPrefixo: '4.',
        nome: '4. RECEITAS OPERACIONAIS E FINANCEIRAS',
        natureza: 'receita',
      },
    ]

    const termoBusca = busca.toLowerCase().trim()

    return gruposDefs.map((g) => {
      let contasGrupo = PLANO_CONTAS_AEROCAD.filter((item) =>
        item.codigo.startsWith(g.codigoPrefixo),
      )

      if (termoBusca) {
        contasGrupo = contasGrupo.filter(
          (c) =>
            c.codigo.toLowerCase().includes(termoBusca) ||
            c.nome.toLowerCase().includes(termoBusca) ||
            c.grupo.toLowerCase().includes(termoBusca),
        )
      }

      if (filtroNatureza !== 'todos' && g.natureza !== filtroNatureza) {
        contasGrupo = []
      }

      const subgruposMap = new Map<
        string,
        (ItemPlanoContas & {
          qtdLancamentos: number
          totalValor: number
          lancamentos: LancamentoMapeado[]
        })[]
      >()

      let grupoQtdTotal = 0
      let grupoValorTotal = 0

      for (const conta of contasGrupo) {
        const dados = mapaLancamentosPorConta.get(conta.codigo) || {
          qtd: 0,
          valor: 0,
          lancamentos: [],
        }

        if (apenasComLancamentos && dados.qtd === 0) {
          continue
        }

        grupoQtdTotal += dados.qtd
        grupoValorTotal += dados.valor

        const subLista = subgruposMap.get(conta.grupo) || []
        subLista.push({
          ...conta,
          qtdLancamentos: dados.qtd,
          totalValor: dados.valor,
          lancamentos: dados.lancamentos,
        })
        subgruposMap.set(conta.grupo, subLista)
      }

      const subgrupos = Array.from(subgruposMap.entries()).map(([nome, contas]) => ({
        nome,
        contas,
      }))

      return {
        ...g,
        subgrupos,
        qtdTotalLancamentos: grupoQtdTotal,
        totalValor: grupoValorTotal,
      }
    })
  }, [busca, filtroNatureza, apenasComLancamentos, mapaLancamentosPorConta])

  // Contagem de cobertura e volume total
  const totalContas = PLANO_CONTAS_AEROCAD.length
  const contasComUso = useMemo(() => {
    return PLANO_CONTAS_AEROCAD.filter((c) => {
      const d = mapaLancamentosPorConta.get(c.codigo)
      return d && d.qtd > 0
    }).length
  }, [mapaLancamentosPorConta])

  const volumeTotalMapeado = useMemo(() => {
    return todosLancamentosMapeados.reduce((acc, item) => acc + (item.valor || 0), 0)
  }, [todosLancamentosMapeados])

  // Lista plana de contas filtradas para exportação XLSX / CSV e Impressão A4
  const contasFiltradasPlanas = useMemo(() => {
    const lista: (ItemPlanoContas & {
      qtdLancamentos: number
      totalValor: number
      volumeDebito: number
      volumeCredito: number
      naturezaSaldo: 'Devedor' | 'Credor'
      lancamentos: LancamentoMapeado[]
    })[] = []

    for (const grupo of arvoreEstruturada) {
      for (const sub of grupo.subgrupos) {
        for (const c of sub.contas) {
          let deb = 0
          let cred = 0
          for (const l of c.lancamentos) {
            if (l.tipoMovimento === 'debito') deb += l.valor || 0
            else if (l.tipoMovimento === 'credito') cred += l.valor || 0
          }

          // Se a conta tem natureza ativo ou despesa, é devedora (D); passivo ou receita é credora (C)
          const ehDevedora = c.natureza === 'ativo' || c.natureza === 'despesa'
          const saldoCalculado = ehDevedora ? deb - cred : cred - deb
          const natSaldo: 'Devedor' | 'Credor' =
            c.qtdLancamentos === 0
              ? ehDevedora
                ? 'Devedor'
                : 'Credor'
              : saldoCalculado >= 0
                ? ehDevedora
                  ? 'Devedor'
                  : 'Credor'
                : ehDevedora
                  ? 'Credor'
                  : 'Devedor'

          lista.push({
            ...c,
            qtdLancamentos: c.qtdLancamentos,
            totalValor: c.totalValor,
            volumeDebito: deb,
            volumeCredito: cred,
            naturezaSaldo: natSaldo,
            lancamentos: c.lancamentos,
          })
        }
      }
    }

    return lista.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
  }, [arvoreEstruturada])

  // Totalizadores consolidados por natureza para cabeçalho A4 e relatórios
  const totaisPorNatureza = useMemo(() => {
    const resultado = {
      ativo: { qtd: 0, volume: 0 },
      passivo: { qtd: 0, volume: 0 },
      despesa: { qtd: 0, volume: 0 },
      receita: { qtd: 0, volume: 0 },
    }

    for (const c of contasFiltradasPlanas) {
      if (c.natureza === 'ativo') {
        resultado.ativo.qtd += c.qtdLancamentos
        resultado.ativo.volume += c.totalValor
      } else if (c.natureza === 'passivo' || c.natureza === 'patrimonio_liquido') {
        resultado.passivo.qtd += c.qtdLancamentos
        resultado.passivo.volume += c.totalValor
      } else if (c.natureza === 'despesa') {
        resultado.despesa.qtd += c.qtdLancamentos
        resultado.despesa.volume += c.totalValor
      } else if (c.natureza === 'receita') {
        resultado.receita.qtd += c.qtdLancamentos
        resultado.receita.volume += c.totalValor
      }
    }

    return resultado
  }, [contasFiltradasPlanas])

  // Exportação XLSX
  async function handleExportarXlsx() {
    if (!canExportAndPrint) {
      toast.error(
        'Apenas usuários com perfil Administrador ou Financeiro podem exportar o Plano de Contas.',
      )
      return
    }

    try {
      const hojeStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const anoStr = filtroAno !== 'todos' ? `_${filtroAno}` : ''
      const linhas = contasFiltradasPlanas.map((c) => {
        const natFormatada =
          c.natureza === 'ativo'
            ? '1 - Ativo'
            : c.natureza === 'passivo'
              ? '2 - Passivo'
              : c.natureza === 'patrimonio_liquido'
                ? '2.2 - Patrimônio Líquido'
                : c.natureza === 'despesa'
                  ? '3 - Despesas e Custos'
                  : '4 - Receitas'

        const classif =
          c.fixoOuVariavel === 'fixo'
            ? 'Custo Fixo'
            : c.fixoOuVariavel === 'variavel'
              ? 'Custo Variável'
              : 'Geral'
        const ehDevedora = c.natureza === 'ativo' || c.natureza === 'despesa'
        const saldo = ehDevedora
          ? c.volumeDebito - c.volumeCredito
          : c.volumeCredito - c.volumeDebito

        return {
          codigo: c.codigo,
          nome: c.nome,
          natureza: natFormatada,
          classificacao: classif,
          qtdLancamentos: c.qtdLancamentos,
          volumeDebito: c.volumeDebito,
          volumeCredito: c.volumeCredito,
          saldo,
        }
      })

      const totais = {
        qtdLancamentos: linhas.reduce((a, b) => a + b.qtdLancamentos, 0),
        volumeDebito: linhas.reduce((a, b) => a + b.volumeDebito, 0),
        volumeCredito: linhas.reduce((a, b) => a + b.volumeCredito, 0),
        saldo: linhas.reduce((a, b) => a + b.saldo, 0),
      }

      await exportarTabelaParaXlsx({
        nomeArquivo: `plano_contas_aerocad${anoStr}_${hojeStr}`,
        tituloRelatorio: 'PLANO DE CONTAS GERENCIAL E CONTÁBIL',
        subtitulo: `Ano: ${filtroAno !== 'todos' ? `Exercício ${filtroAno}` : 'Todos os exercícios'} · Natureza [${filtroNatureza.toUpperCase()}] · ${apenasComLancamentos ? 'Apenas com lançamentos' : 'Todas as contas'} · Total: ${contasFiltradasPlanas.length} contas`,
        usuarioNome: user?.name || user?.email || 'Equipe AEROCAD',
        userRole: user?.role,
        colunas: [
          { header: 'Código', key: 'codigo', width: 14, tipo: 'texto' },
          { header: 'Nome da Conta', key: 'nome', width: 38, tipo: 'texto' },
          { header: 'Natureza', key: 'natureza', width: 22, tipo: 'texto' },
          { header: 'Classificação', key: 'classificacao', width: 16, tipo: 'texto' },
          { header: 'Qtd. Lançamentos', key: 'qtdLancamentos', width: 18, tipo: 'numero' },
          { header: 'Volume Débito (R$)', key: 'volumeDebito', width: 22, tipo: 'moeda' },
          { header: 'Volume Crédito (R$)', key: 'volumeCredito', width: 22, tipo: 'moeda' },
          { header: 'Saldo (R$)', key: 'saldo', width: 22, tipo: 'moeda' },
        ],
        linhas,
        totais,
      })

      toast.success('Plano de contas exportado em XLSX com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao exportar XLSX: ' + msg)
    }
  }

  // Exportação CSV (Padrão de importação de softwares contábeis brasileiros: sep=";", BOM UTF-8 \uFEFF)
  function handleExportarCsv() {
    if (!canExportAndPrint) {
      toast.error(
        'Apenas usuários com perfil Administrador ou Financeiro podem exportar o Plano de Contas.',
      )
      return
    }

    try {
      const hojeStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const anoStr = filtroAno !== 'todos' ? `_${filtroAno}` : ''
      const cabecalhos = [
        'Código',
        'Nome da Conta',
        'Natureza',
        'Classificação',
        'Qtd. Lançamentos',
        'Volume Débito (R$)',
        'Volume Crédito (R$)',
        'Saldo (R$)',
      ]

      const linhasCsv: string[] = []
      // Header com separador ;
      linhasCsv.push(cabecalhos.join(';'))

      for (const c of contasFiltradasPlanas) {
        const natFormatada =
          c.natureza === 'ativo'
            ? '1 - Ativo'
            : c.natureza === 'passivo'
              ? '2 - Passivo'
              : c.natureza === 'patrimonio_liquido'
                ? '2.2 - Patrimônio Líquido'
                : c.natureza === 'despesa'
                  ? '3 - Despesas e Custos'
                  : '4 - Receitas'

        const classif =
          c.fixoOuVariavel === 'fixo'
            ? 'Custo Fixo'
            : c.fixoOuVariavel === 'variavel'
              ? 'Custo Variável'
              : 'Geral'
        const ehDevedora = c.natureza === 'ativo' || c.natureza === 'despesa'
        const saldo = ehDevedora
          ? c.volumeDebito - c.volumeCredito
          : c.volumeCredito - c.volumeDebito

        const formatarNumeroCsv = (num: number) => {
          if (ocultarValores) return '***'
          return num.toFixed(2).replace('.', ',')
        }

        const linha = [
          `"${c.codigo}"`,
          `"${c.nome.replace(/"/g, '""')}"`,
          `"${natFormatada}"`,
          `"${classif}"`,
          c.qtdLancamentos,
          `"${formatarNumeroCsv(c.volumeDebito)}"`,
          `"${formatarNumeroCsv(c.volumeCredito)}"`,
          `"${formatarNumeroCsv(saldo)}"`,
        ]

        linhasCsv.push(linha.join(';'))
      }

      // BOM UTF-8 para garantir abertura correta no Excel brasileiro
      const conteudoCsv = '\uFEFF' + linhasCsv.join('\r\n')
      const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `plano_contas_aerocad${anoStr}_${hojeStr}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Plano de contas exportado em CSV (padrão contábil) com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao exportar CSV: ' + msg)
    }
  }

  function alternarGrupo(id: string) {
    setGruposAbertos((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  function expandirTodos() {
    setGruposAbertos({
      '1': true,
      '2': true,
      '3': true,
      '4': true,
    })
  }

  function recolherTodos() {
    setGruposAbertos({
      '1': false,
      '2': false,
      '3': false,
      '4': false,
    })
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* 1. Header do Plano de Contas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-neutral-200 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-md bg-[#FF6A13]/10 text-[#FF6A13] mt-0.5">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Plano de Contas Oficial AEROCAD
              </h2>
              <Badge
                variant="outline"
                className="text-xs bg-orange-50 text-[#FF6A13] border-[#FF6A13]/30"
              >
                Prancheta Técnica
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Estrutura contábil sincronizada com extratos bancários (.RET, OFX), faturamento de
              projetos, contas a pagar e patrimônio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExportAndPrint && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisualizandoImpressaoModal(true)}
                className="text-xs text-neutral-700 hover:text-[#FF6A13] hover:border-[#FF6A13] h-8"
                title="Visualizar documento oficial A4 e imprimir"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir A4
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarXlsx}
                className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
                title="Exportar planilha Excel (.XLSX)"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Exportar XLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarCsv}
                className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50 h-8"
                title="Exportar arquivo CSV com separador ; para softwares contábeis"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={expandirTodos}
            className="text-xs text-neutral-700 h-8"
          >
            Expandir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={recolherTodos}
            className="text-xs text-neutral-700 h-8"
          >
            Recolher
          </Button>
        </div>
      </div>

      {/* 2. KPIs de Cobertura do Plano de Contas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total de Contas</span>
              <BookOpen className="h-4 w-4 text-neutral-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-neutral-900">{totalContas}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">Estruturadas em 4 macro-grupos</p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Contas com Movimento</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">{contasComUso}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {((contasComUso / (totalContas || 1)) * 100).toFixed(0)}% com lançamentos ativos
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Lançamentos Contábeis</span>
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {todosLancamentosMapeados.length}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {filtroAno !== 'todos' ? `Exercício ${filtroAno}` : 'Todos os exercícios'} ·{' '}
              {todosLancamentosMapeados.filter((l) => l.origem === 'extrato').length} extratos ·{' '}
              {todosLancamentosMapeados.filter((l) => l.origem === 'conta_pagar').length} pagar ·{' '}
              {
                todosLancamentosMapeados.filter(
                  (l) => l.origem === 'parcela' || l.origem === 'conta_receber',
                ).length
              }{' '}
              receber
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Volume Total em R$</span>
              <DollarSign className="h-4 w-4 text-[#FF6A13]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-[#FF6A13] mt-0.5 font-mono">
              {formatCurrency(volumeTotalMapeado)}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">Total consolidado das contas</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Buscar por código (ex: 3.1.5), nome da conta ou grupo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Ano */}
          <div className="w-[155px]">
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger
                aria-label="Selecionar exercício ou ano"
                className="h-9 text-xs font-semibold border-[#FF6A13]/40 bg-orange-50/40 text-neutral-800"
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13] shrink-0" />
                <SelectValue placeholder="Exercício / Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {anosDisponiveis.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="font-medium">
                    Ano {ano} {ano === anoAtualCorrente ? '(Atual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Select value={filtroNatureza} onValueChange={setFiltroNatureza}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as naturezas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as naturezas</SelectItem>
                <SelectItem value="ativo">1. Ativo</SelectItem>
                <SelectItem value="passivo">2. Passivo</SelectItem>
                <SelectItem value="despesa">3. Despesas & Custos</SelectItem>
                <SelectItem value="receita">4. Receitas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={apenasComLancamentos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setApenasComLancamentos(!apenasComLancamentos)}
            className={`h-9 text-xs ${
              apenasComLancamentos
                ? 'bg-[#FF6A13] hover:bg-[#E85B06] text-white'
                : 'text-neutral-700'
            }`}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            {apenasComLancamentos ? 'Com Lançamentos' : 'Todas as Contas'}
          </Button>

          {(busca ||
            filtroNatureza !== 'todos' ||
            apenasComLancamentos ||
            filtroAno !== String(anoAtualCorrente)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBusca('')
                setFiltroNatureza('todos')
                setApenasComLancamentos(false)
                setFiltroAno(String(anoAtualCorrente))
              }}
              className="h-9 text-xs text-neutral-500 hover:text-neutral-800"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* 4. Lista em Árvore Hierárquica */}
      <div className="space-y-4">
        {arvoreEstruturada.map((grupo) => {
          const aberto = gruposAbertos[grupo.id]
          const natCfg = NATUREZA_CONFIG[grupo.natureza]
          const totalSubContas = grupo.subgrupos.reduce((acc, s) => acc + s.contas.length, 0)

          if (totalSubContas === 0) return null

          return (
            <div
              key={grupo.id}
              className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden"
            >
              {/* Cabeçalho do Grande Grupo (Nível 1) */}
              <button
                type="button"
                onClick={() => alternarGrupo(grupo.id)}
                className="w-full flex items-center justify-between p-4 bg-neutral-50/80 hover:bg-neutral-100/80 transition-colors border-b border-neutral-200 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-white border border-neutral-200 text-neutral-600">
                    {aberto ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neutral-900 tracking-tight">
                        {grupo.nome}
                      </span>
                      <Badge className={`text-[10px] py-0 px-2 font-semibold ${natCfg.corBadge}`}>
                        {natCfg.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {totalSubContas} contas analíticas cadastradas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xs font-semibold text-neutral-700">
                      {grupo.qtdTotalLancamentos} lançamento
                      {grupo.qtdTotalLancamentos !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-500">
                      {formatCurrency(grupo.totalValor)}
                    </div>
                  </div>
                </div>
              </button>

              {/* Corpo com Subgrupos e Contas */}
              {aberto && (
                <div className="divide-y divide-neutral-100">
                  {grupo.subgrupos.map((sub, subIdx) => (
                    <div key={subIdx} className="p-4 sm:p-5">
                      {/* Subgrupo (Nível 2) */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-[#FF6A13]" />
                        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                          {sub.nome}
                        </h4>
                        <span className="text-[11px] text-neutral-400">
                          ({sub.contas.length} contas)
                        </span>
                      </div>

                      {/* Tabela de Contas Analíticas (Nível 3) */}
                      <div className="border border-neutral-200 rounded-md overflow-hidden bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-neutral-50/95 text-neutral-600 font-bold border-b border-neutral-200 text-[11px]">
                              <th className="py-2 px-2.5 w-[11%]">Código</th>
                              <th className="py-2 px-2.5 w-[41%]">Nome da Conta Contábil</th>
                              <th className="py-2 px-2.5 w-[12%] text-center">Classificação</th>
                              <th className="py-2 px-2.5 w-[12%] text-center">Lançamentos</th>
                              <th className="py-2 px-2.5 w-[13%] text-right">Volume (R$)</th>
                              <th className="py-2 px-2.5 w-[11%] text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {sub.contas.map((conta) => {
                              const temLancamentos = conta.qtdLancamentos > 0

                              return (
                                <tr
                                  key={conta.codigo}
                                  className="hover:bg-neutral-50/80 transition-colors"
                                >
                                  {/* Código */}
                                  <td className="py-2 px-2.5 font-mono tabular-nums font-bold text-neutral-900 whitespace-nowrap">
                                    <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[11px] border border-neutral-200/80">
                                      {conta.codigo}
                                    </span>
                                  </td>

                                  {/* Nome */}
                                  <td className="py-2 px-2.5">
                                    <div className="font-semibold text-neutral-900 text-xs">
                                      {conta.nome}
                                    </div>
                                    {conta.descricao && (
                                      <div className="text-[11px] text-neutral-400 truncate max-w-md">
                                        {conta.descricao}
                                      </div>
                                    )}
                                  </td>

                                  {/* Classificação / Regime */}
                                  <td className="py-2 px-2.5 text-center">
                                    {conta.fixoOuVariavel ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] py-0 px-2 capitalize font-semibold ${
                                          conta.fixoOuVariavel === 'fixo'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}
                                      >
                                        {conta.fixoOuVariavel === 'fixo'
                                          ? 'Custo Fixo'
                                          : 'Variável'}
                                      </Badge>
                                    ) : (
                                      <span className="text-neutral-400 text-[11px]">Geral</span>
                                    )}
                                  </td>

                                  {/* Lançamentos */}
                                  <td className="py-2 px-2.5 text-center">
                                    {temLancamentos ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setContaSelecionadaModal({
                                            conta,
                                            lancamentos: conta.lancamentos,
                                            totalValor: conta.totalValor,
                                          })
                                        }
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer font-mono tabular-nums"
                                        title="Clique para ver os lançamentos individuais desta conta"
                                      >
                                        {conta.qtdLancamentos} registro
                                        {conta.qtdLancamentos > 1 ? 's' : ''}
                                      </button>
                                    ) : (
                                      <span className="text-neutral-400 text-[11px]">Nenhum</span>
                                    )}
                                  </td>

                                  {/* Volume */}
                                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-neutral-900 whitespace-nowrap text-xs">
                                    {temLancamentos ? formatCurrency(conta.totalValor) : '—'}
                                  </td>

                                  {/* Ação: Visualizar lançamentos ou navegar para aba */}
                                  <td className="py-2 px-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {temLancamentos && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs text-neutral-600 hover:text-[#FF6A13] hover:bg-orange-50"
                                          title={`Ver ${conta.qtdLancamentos} lançamentos analíticos`}
                                          onClick={() =>
                                            setContaSelecionadaModal({
                                              conta,
                                              lancamentos: conta.lancamentos,
                                              totalValor: conta.totalValor,
                                            })
                                          }
                                        >
                                          Detalhes
                                        </Button>
                                      )}
                                      {onNavegarParaLancamentos && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-neutral-400 hover:text-[#FF6A13] hover:bg-orange-50"
                                          title={`Ir para listagem de ${conta.codigo}`}
                                          onClick={() => {
                                            const tipo = conta.codigo.startsWith('4.')
                                              ? 'receber'
                                              : conta.codigo === '1.1.1'
                                                ? 'extratos'
                                                : 'pagar'
                                            onNavegarParaLancamentos(tipo, {
                                              codigo: conta.codigo,
                                              nome: conta.nome,
                                            })
                                          }}
                                        >
                                          <ArrowUpRight className="h-3.5 w-3.5" />
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {arvoreEstruturada.every(
          (g) => g.subgrupos.reduce((acc, s) => acc + s.contas.length, 0) === 0,
        ) && (
          <div className="bg-white p-12 text-center rounded-lg border border-neutral-200 text-neutral-500">
            <BookOpen className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
            <p className="font-medium text-sm text-neutral-700">
              Nenhuma conta contábil encontrada
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Tente ajustar os termos da busca ou os filtros de natureza.
            </p>
          </div>
        )}
      </div>

      {/* 5. Modal do Documento Oficial A4 para Impressão do Plano de Contas */}
      <Dialog open={visualizandoImpressaoModal} onOpenChange={setVisualizandoImpressaoModal}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-20 bg-neutral-900 text-white px-5 py-3 flex items-center justify-between shadow-md print:hidden">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#FF6A13] tracking-widest">
                PREVIEW A4 · DOCUMENTO OFICIAL
              </p>
              <h3 className="text-sm font-bold text-white truncate">
                Plano de Contas Oficial AEROCAD
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportarXlsx}
                className="bg-transparent border-white/20 text-white hover:bg-white/10 text-xs h-8"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                Exportar XLSX
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  imprimirElementoA4({
                    elementId: 'print-document',
                    titulo: 'Plano de Contas Oficial AEROCAD',
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
            <div className="bg-white shadow-lg border border-neutral-300 w-full max-w-[210mm]">
              <AerocadRelatorioA4
                titulo="PLANO DE CONTAS OFICIAL & ESTRUTURA CONTÁBIL"
                subtitulo={`Árvore Hierárquica · ${
                  filtroAno !== 'todos' ? `Exercício ${filtroAno}` : 'Todos os exercícios'
                } · ${
                  filtroNatureza === 'todos'
                    ? 'Todas as naturezas (1 Ativo, 2 Passivo, 3 Despesas, 4 Receitas)'
                    : `Filtro ativo: ${filtroNatureza.toUpperCase()}`
                } · ${apenasComLancamentos ? 'Apenas contas com lançamentos' : 'Todas as contas'}`}
                referenciaPeriodo={
                  filtroAno !== 'todos'
                    ? `Exercício ${filtroAno} · Padrão AEROCAD`
                    : 'Exercício Consolidado · Padrão AEROCAD'
                }
                responsavelNome={user?.name || user?.email || 'Equipe AEROCAD'}
                resumoKpis={[
                  {
                    rotulo: '1. Ativo Total',
                    valorFormatado: formatCurrency(totaisPorNatureza.ativo.volume),
                    cor: 'laranja',
                  },
                  {
                    rotulo: '2. Passivo / Obrigações',
                    valorFormatado: formatCurrency(totaisPorNatureza.passivo.volume),
                    cor: 'vermelho',
                  },
                  {
                    rotulo: '3. Despesas & Custos',
                    valorFormatado: formatCurrency(totaisPorNatureza.despesa.volume),
                    cor: 'vermelho',
                  },
                  {
                    rotulo: '4. Receitas Operacionais',
                    valorFormatado: formatCurrency(totaisPorNatureza.receita.volume),
                    cor: 'verde',
                    destaque: true,
                  },
                ]}
                secoes={[
                  {
                    titulo: '1. RESUMO CONSOLIDADO POR NATUREZA CONTÁBIL',
                    subtitulo:
                      'Totalização de lançamentos e volume financeiro movimentado por macro-grupo',
                    tabela: {
                      colunas: [
                        { cabecalho: 'Grupo / Natureza', largura: '45%' },
                        { cabecalho: 'Classificação', alinhamento: 'center', largura: '20%' },
                        { cabecalho: 'Lançamentos', alinhamento: 'center', largura: '15%' },
                        { cabecalho: 'Volume em R$', alinhamento: 'right', largura: '20%' },
                      ],
                      linhas: [
                        [
                          {
                            conteudo: '1. Ativo (Disponibilidades, Direitos e Imobilizado)',
                            destaque: true,
                          },
                          { conteudo: 'Devedora (D)', alinhamento: 'center' },
                          {
                            conteudo: `${totaisPorNatureza.ativo.qtd} reg.`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(totaisPorNatureza.ativo.volume),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          {
                            conteudo: '2. Passivo (Obrigações e Patrimônio Líquido)',
                            destaque: true,
                          },
                          { conteudo: 'Credora (C)', alinhamento: 'center' },
                          {
                            conteudo: `${totaisPorNatureza.passivo.qtd} reg.`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(totaisPorNatureza.passivo.volume),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '3. Despesas e Custos Operacionais', destaque: true },
                          { conteudo: 'Devedora (D)', alinhamento: 'center' },
                          {
                            conteudo: `${totaisPorNatureza.despesa.qtd} reg.`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(totaisPorNatureza.despesa.volume),
                            alinhamento: 'right',
                          },
                        ],
                        [
                          { conteudo: '4. Receitas Operacionais e Faturamento', destaque: true },
                          { conteudo: 'Credora (C)', alinhamento: 'center' },
                          {
                            conteudo: `${totaisPorNatureza.receita.qtd} reg.`,
                            alinhamento: 'center',
                          },
                          {
                            conteudo: formatCurrency(totaisPorNatureza.receita.volume),
                            alinhamento: 'right',
                          },
                        ],
                      ],
                      linhaTotal: [
                        { conteudo: 'TOTAL CONSOLIDADO' },
                        { conteudo: 'Geral', alinhamento: 'center' },
                        {
                          conteudo: `${
                            totaisPorNatureza.ativo.qtd +
                            totaisPorNatureza.passivo.qtd +
                            totaisPorNatureza.despesa.qtd +
                            totaisPorNatureza.receita.qtd
                          } reg.`,
                          alinhamento: 'center',
                        },
                        { conteudo: formatCurrency(volumeTotalMapeado), alinhamento: 'right' },
                      ],
                    },
                  },
                  {
                    titulo: '2. ÁRVORE HIERÁRQUICA DETALHADA DAS CONTAS',
                    subtitulo: `Relação analítica das ${contasFiltradasPlanas.length} contas contábeis respeitando filtros ativos`,
                    tabela: {
                      colunas: [
                        { cabecalho: 'Código', largura: '12%' },
                        { cabecalho: 'Nome da Conta', largura: '40%' },
                        { cabecalho: 'Lanç.', alinhamento: 'center', largura: '12%' },
                        { cabecalho: 'Volume (R$)', alinhamento: 'right', largura: '20%' },
                        { cabecalho: 'Natureza Saldo', alinhamento: 'center', largura: '16%' },
                      ],
                      linhas: contasFiltradasPlanas.map((c) => [
                        { conteudo: c.codigo, destaque: c.codigo.length <= 3 },
                        { conteudo: c.nome, destaque: c.codigo.length <= 3 },
                        {
                          conteudo: c.qtdLancamentos > 0 ? `${c.qtdLancamentos}` : '—',
                          alinhamento: 'center',
                        },
                        {
                          conteudo: c.totalValor > 0 ? formatCurrency(c.totalValor) : '—',
                          alinhamento: 'right',
                        },
                        {
                          conteudo: c.naturezaSaldo,
                          alinhamento: 'center',
                          destaque: c.qtdLancamentos > 0,
                        },
                      ]),
                      linhaTotal: [
                        { conteudo: 'TOTAIS' },
                        { conteudo: `${contasFiltradasPlanas.length} contas listadas` },
                        {
                          conteudo: `${contasFiltradasPlanas.reduce((a, b) => a + b.qtdLancamentos, 0)}`,
                          alinhamento: 'center',
                        },
                        {
                          conteudo: formatCurrency(
                            contasFiltradasPlanas.reduce((a, b) => a + b.totalValor, 0),
                          ),
                          alinhamento: 'right',
                        },
                        { conteudo: 'Equilibrado', alinhamento: 'center' },
                      ],
                    },
                  },
                ]}
                observacoesFinais="Plano de Contas Oficial emitido pelo CRM AEROCAD Consultoria. Estrutura padronizada conforme as Normas Brasileiras de Contabilidade (NBC TG) e compatível com as regras de importação de softwares contábeis e fiscais."
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Modal de Lançamentos Analíticos da Conta */}
      <Dialog
        open={!!contaSelecionadaModal}
        onOpenChange={(open) => {
          if (!open) setContaSelecionadaModal(null)
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {contaSelecionadaModal && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm bg-orange-100 text-[#D65100] px-2 py-0.5 rounded">
                    {contaSelecionadaModal.conta.codigo}
                  </span>
                  <DialogTitle className="text-base font-bold text-neutral-900">
                    {contaSelecionadaModal.conta.nome}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-neutral-500 mt-1 flex items-center justify-between">
                  <span>
                    Grupo: <strong>{contaSelecionadaModal.conta.grupo}</strong> · Natureza:{' '}
                    <strong>{contaSelecionadaModal.conta.natureza.toUpperCase()}</strong>
                  </span>
                  <span className="text-neutral-800 font-mono font-semibold">
                    Total: {formatCurrency(contaSelecionadaModal.totalValor)} (
                    {contaSelecionadaModal.lancamentos.length} registros)
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="border border-neutral-200 rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200 text-[11px]">
                        <th className="py-2 px-3 w-[12%]">Data</th>
                        <th className="py-2 px-3 w-[13%]">Origem</th>
                        <th className="py-2 px-3 w-[35%]">Descrição / Favorecido</th>
                        <th className="py-2 px-3 w-[20%]">Conta Contábil</th>
                        <th className="py-2 px-3 w-[10%] text-center">Status</th>
                        <th className="py-2 px-3 w-[10%] text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {contaSelecionadaModal.lancamentos.map((item) => {
                        const targetColecao =
                          item.origem === 'extrato'
                            ? 'extratos_transacoes'
                            : item.origem === 'conta_pagar'
                              ? 'contas_pagar'
                              : item.origem === 'parcela'
                                ? 'parcelas'
                                : item.origem === 'conta_receber'
                                  ? 'contas_receber'
                                  : null
                        const targetId = item.registroIdOriginal

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/80 transition">
                            <td className="py-2.5 px-3 font-mono text-neutral-600">
                              {formatDate(item.data)}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 px-1.5 font-normal ${
                                  item.origem === 'extrato'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : item.origem === 'conta_pagar'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : item.origem === 'parcela' || item.origem === 'conta_receber'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                {item.origemLabel}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-neutral-800">{item.descricao}</div>
                              {(item.entidade || item.documentoRef) && (
                                <div className="text-[11px] text-neutral-500 mt-0.5">
                                  {item.entidade && (
                                    <span className="font-semibold text-neutral-600">
                                      {item.entidade}
                                    </span>
                                  )}
                                  {item.documentoRef && (
                                    <span className="ml-2 text-neutral-400">
                                      · Doc: {item.documentoRef}
                                    </span>
                                  )}
                                </div>
                              )}
                              {item.observacoes && (
                                <div
                                  className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2"
                                  title={item.observacoes}
                                >
                                  <span className="font-semibold text-neutral-600">Obs:</span>{' '}
                                  {item.observacoes}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {targetColecao && targetId ? (
                                <ContaContabilBadgeInline
                                  colecao={targetColecao}
                                  id={targetId}
                                  codigoAtual={item.codigoConta}
                                  nomeAtual={item.nomeConta}
                                  descricaoRegistro={item.descricao}
                                  dataRegistro={item.data}
                                  observacoesAtual={item.observacoes}
                                  classificacaoManual={item.classificacaoManual}
                                  compacto
                                  onReclassificado={(novoCod, novoNom, novasObs) => {
                                    // Atualiza o lançamento na visualização do modal imediatamente
                                    setContaSelecionadaModal((prev) => {
                                      if (!prev) return null
                                      const atualizados = prev.lancamentos.map((l) =>
                                        l.id === item.id
                                          ? {
                                              ...l,
                                              codigoConta: novoCod,
                                              nomeConta: novoNom,
                                              classificacaoManual: true,
                                              observacoes:
                                                novasObs !== undefined ? novasObs : l.observacoes,
                                            }
                                          : l,
                                      )
                                      return { ...prev, lancamentos: atualizados }
                                    })
                                    if (onReload) onReload()
                                  }}
                                />
                              ) : (
                                <span className="font-mono text-xs text-neutral-600">
                                  {item.codigoConta} · {item.nomeConta}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-[11px] font-medium capitalize text-neutral-600">
                                {item.status || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-800">
                              {formatCurrency(item.valor)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  Lançamentos consolidados em tempo real
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setContaSelecionadaModal(null)}
                  className="text-xs h-8"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Rodapé Informativo AEROCAD */}
      <div className="bg-[#FFF6EC] border border-[#FF6A13]/30 rounded-lg p-4 text-xs text-neutral-700 flex items-start gap-3">
        <div className="p-1 rounded bg-[#FF6A13] text-white mt-0.5">
          <ExternalLink className="h-3.5 w-3.5" />
        </div>
        <div>
          <span className="font-bold text-neutral-900 block">
            Integração Contábil Direta AEROCAD
          </span>
          <p className="text-neutral-600 mt-0.5">
            As contas acima alimentam em tempo real os relatórios A4 oficiais:{' '}
            <strong>Balancete de Verificação</strong>, <strong>Balanço Patrimonial</strong>,{' '}
            <strong>DRE</strong> e cálculo de <strong>Ponto de Equilíbrio</strong>. Toda despesa,
            extrato bancário, nota fiscal ou recebível registrado no CRM herda essa codificação
            analítica.
          </p>
        </div>
      </div>
    </div>
  )
}
