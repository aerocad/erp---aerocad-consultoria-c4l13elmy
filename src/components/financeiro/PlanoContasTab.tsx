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
} from 'lucide-react'
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
}: PlanoContasTabProps) {
  const [busca, setBusca] = useState('')
  const [filtroNatureza, setFiltroNatureza] = useState<string>('todos')
  const [apenasComLancamentos, setApenasComLancamentos] = useState(false)
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

  // 1. Mapear TODOS os lançamentos reais da AEROCAD para as contas analíticas do plano
  const todosLancamentosMapeados = useMemo<LancamentoMapeado[]>(() => {
    const lista: LancamentoMapeado[] = []

    // 1.1 Disponibilidades (Contas Bancárias PJ no Ativo 1.1.1)
    for (const cb of contasBancarias) {
      if (cb.saldo_atual && Math.abs(cb.saldo_atual) > 0) {
        lista.push({
          id: `cb-${cb.id}`,
          origem: 'conta_bancaria',
          origemLabel: 'Conta Bancária PJ',
          codigoConta: '1.1.1',
          nomeConta: 'Disponibilidades (Bancos Conta Movimento PJ)',
          natureza: 'ativo',
          descricao: `Saldo em Conta Corrente PJ (${cb.banco_nome || 'Banco'} · Ag: ${cb.agencia || '-'} CC: ${cb.conta_corrente || '-'})`,
          entidade: cb.banco_nome || 'Banco PJ',
          data:
            cb.data_saldo_inicial ||
            cb.created?.slice(0, 10) ||
            new Date().toISOString().slice(0, 10),
          valor: Math.abs(cb.saldo_atual),
          tipoMovimento: 'debito',
          status: cb.status === 'ativa' ? 'Ativa' : 'Inativa',
          documentoRef: cb.tipo_chave_pix ? `PIX: ${cb.chave_pix}` : undefined,
        })
      }
    }

    // 1.2 Ativos Patrimoniais Imobilizados / Intangíveis (Ativo 1.2.x)
    for (const at of ativosPatrimonio) {
      const contaAlvo = classificarAtivoPatrimonio(at)
      lista.push({
        id: `at-${at.id}`,
        origem: 'ativo',
        origemLabel: 'Ativo Patrimonial',
        codigoConta: contaAlvo.codigo,
        nomeConta: contaAlvo.nome,
        natureza: 'ativo',
        descricao: `${at.descricao || at.categoria} (${at.identificador_codigo || 'Sem código'})`,
        entidade: at.fornecedor_nome || at.expand?.credor?.nome_razao_social || 'AEROCAD',
        data: at.data_aquisicao || at.created?.slice(0, 10) || '',
        valor: at.valor_contabil_atual || at.valor_aquisicao || 0,
        tipoMovimento: 'debito',
        status: at.status || 'ativo',
        documentoRef: at.numero_nf_registro ? `NF ${at.numero_nf_registro}` : undefined,
      })
    }

    // 1.3 Contas a Receber (Faturamento / Medições emitidas de Projetos - 1.1.2 Ativo ou 4.1.x Receita)
    for (const cr of contasReceber) {
      const contaReceita = classificarContaReceber(cr)
      const val = cr.valor || cr.valor_recebido || 0
      // Conta a receber pendente alimenta direito a receber (1.1.2) e faturamento (4.1.x)
      lista.push({
        id: `cr-${cr.id}`,
        origem: 'conta_receber',
        origemLabel: 'Conta a Receber',
        codigoConta: contaReceita.codigo,
        nomeConta: contaReceita.nome,
        natureza: 'receita',
        descricao: cr.descricao || 'Receita Técnica Operacional',
        entidade: cr.cliente_nome || cr.expand?.cliente?.razao_social || 'Cliente AEROCAD',
        data: cr.data_recebimento || cr.data_vencimento || cr.created?.slice(0, 10) || '',
        valor: val,
        tipoMovimento: 'credito',
        status: cr.status || 'pendente',
        documentoRef: cr.numero_documento,
        observacoes: cr.observacoes,
      })
    }

    // 1.4 Parcelas de Projetos Aeronáuticos (Receitas - 4.1.x e Ativo - 1.1.2)
    for (const p of parcelas) {
      const contaReceita = classificarParcela(p)
      const val = p.valor_recebido || p.valor || 0
      lista.push({
        id: `parc-${p.id}`,
        origem: 'parcela',
        origemLabel: 'Parcela de Projeto',
        codigoConta: contaReceita.codigo,
        nomeConta: contaReceita.nome,
        natureza: 'receita',
        descricao: `${p.expand?.projeto?.numero ? `[${p.expand.projeto.numero}] ` : ''}${p.descricao || 'Parcela de Contrato'}`,
        entidade:
          p.expand?.cliente?.razao_social || p.expand?.projeto?.nome || 'Cliente do Projeto',
        data: p.data_pagamento || p.vencimento || p.created?.slice(0, 10) || '',
        valor: val,
        tipoMovimento: 'credito',
        status: p.status || 'pendente',
        documentoRef: p.nf_numero ? `NFS-e ${p.nf_numero}` : undefined,
        observacoes: p.observacoes,
      })

      // Se a parcela está pendente de recebimento, ela também representa direito a receber no Ativo Circulante (1.1.2)
      if (p.status === 'pendente' || p.status === 'vencida') {
        lista.push({
          id: `parc-ativo-${p.id}`,
          origem: 'parcela',
          origemLabel: 'Direito a Receber (Ativo)',
          codigoConta: '1.1.2',
          nomeConta: 'Contas a Receber de Clientes (Projetos em Andamento)',
          natureza: 'ativo',
          descricao: `Faturamento a Receber: ${p.expand?.projeto?.numero || ''} ${p.descricao || ''}`,
          entidade: p.expand?.cliente?.razao_social || 'Cliente do Projeto',
          data: p.vencimento || p.created?.slice(0, 10) || '',
          valor: p.valor || 0,
          tipoMovimento: 'debito',
          status: p.status,
          documentoRef: p.nf_numero ? `NFS-e ${p.nf_numero}` : undefined,
        })
      }
    }

    // 1.5 Contas a Pagar (Despesas Operacionais, Tributos, Folha, Terceiros)
    for (const cp of contasPagar) {
      const contaDespesa = classificarContaPagar(cp)
      const val = cp.valor || 0

      lista.push({
        id: `cp-${cp.id}`,
        origem: 'conta_pagar',
        origemLabel: 'Conta a Pagar',
        codigoConta: contaDespesa.codigo,
        nomeConta: contaDespesa.nome,
        natureza: contaDespesa.natureza,
        descricao: cp.descricao || 'Despesa Administrativa/Operacional',
        entidade: cp.fornecedor || cp.expand?.credor?.nome_razao_social || 'Fornecedor/Credor',
        data: cp.data_pagamento || cp.data_vencimento || cp.created?.slice(0, 10) || '',
        valor: val,
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
            descricao: `Obrigação a Pagar: ${cp.descricao || cp.fornecedor}`,
            entidade: cp.fornecedor || cp.expand?.credor?.nome_razao_social || 'Credor',
            data: cp.data_vencimento || cp.created?.slice(0, 10) || '',
            valor: val,
            tipoMovimento: 'credito',
            status: cp.status,
            documentoRef: cp.numero_documento,
          })
        }
      }
    }

    // 1.6 Extratos Bancários (Transações importadas .RET, OFX, PDF, CSV)
    // Se a transação estiver vinculada a uma conta_pagar/parcela já contabilizada, evitamos dupla contagem
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

    for (const tx of extratosTransacoes) {
      // Se a transação já tem vínculo formal com conta a pagar ou parcela existente no banco,
      // a conta já foi lançada acima pelos dados da conta a pagar/parcela.
      // Caso contrário (transação avulsa de extrato, tarifa, conciliação manual ou débito direto em conta):
      const temVinculoDiretoComRegistroExistente =
        (tx.vinculo_tipo === 'conta_pagar' && contasPagar.some((c) => c.id === tx.vinculo_id)) ||
        (tx.vinculo_tipo === 'parcela' && parcelas.some((p) => p.id === tx.vinculo_id))

      if (!temVinculoDiretoComRegistroExistente) {
        const contaAlvo = classificarTransacaoExtrato(tx)
        lista.push({
          id: `tx-${tx.id}`,
          origem: 'extrato',
          origemLabel: 'Extrato Bancário',
          codigoConta: contaAlvo.codigo,
          nomeConta: contaAlvo.nome,
          natureza: contaAlvo.natureza,
          descricao: tx.descricao || 'Movimentação em Conta PJ',
          data: tx.data || tx.created?.slice(0, 10) || '',
          valor: Math.abs(tx.valor || 0),
          tipoMovimento: tx.tipo === 'entrada' ? 'credito' : 'debito',
          status: tx.status_conciliacao || 'conciliado',
          documentoRef: tx.documento_ref,
          observacoes: tx.observacoes,
        })
      }
    }

    return lista
  }, [contasBancarias, ativosPatrimonio, contasReceber, parcelas, contasPagar, extratosTransacoes])

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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandirTodos}
            className="text-xs text-neutral-700 h-8"
          >
            Expandir Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={recolherTodos}
            className="text-xs text-neutral-700 h-8"
          >
            Recolher Todos
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
              Extratos ({extratosTransacoes.length}) · Pagar ({contasPagar.length}) ·
              Receber/Projetos ({contasReceber.length + parcelas.length})
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

          {(busca || filtroNatureza !== 'todos' || apenasComLancamentos) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBusca('')
                setFiltroNatureza('todos')
                setApenasComLancamentos(false)
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
                      <div className="border border-neutral-200 rounded-md overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-neutral-100/70 text-neutral-700 font-semibold border-b border-neutral-200 text-[11px]">
                              <th className="py-2.5 px-3 w-[12%]">Código</th>
                              <th className="py-2.5 px-3 w-[38%]">Nome da Conta Contábil</th>
                              <th className="py-2.5 px-3 w-[14%] text-center">Classificação</th>
                              <th className="py-2.5 px-3 w-[14%] text-center">Lançamentos</th>
                              <th className="py-2.5 px-3 w-[12%] text-right">Volume (R$)</th>
                              <th className="py-2.5 px-3 w-[10%] text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {sub.contas.map((conta) => {
                              const temLancamentos = conta.qtdLancamentos > 0

                              return (
                                <tr
                                  key={conta.codigo}
                                  className="hover:bg-neutral-50/70 transition-colors"
                                >
                                  {/* Código */}
                                  <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                                    <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">
                                      {conta.codigo}
                                    </span>
                                  </td>

                                  {/* Nome */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-neutral-800">{conta.nome}</div>
                                    {conta.descricao && (
                                      <div className="text-[11px] text-neutral-400">
                                        {conta.descricao}
                                      </div>
                                    )}
                                  </td>

                                  {/* Classificação / Regime */}
                                  <td className="py-2.5 px-3 text-center">
                                    {conta.fixoOuVariavel ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] py-0 px-2 capitalize ${
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
                                  <td className="py-2.5 px-3 text-center">
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
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
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
                                  <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-700">
                                    {temLancamentos ? formatCurrency(conta.totalValor) : '—'}
                                  </td>

                                  {/* Ação: Visualizar lançamentos ou navegar para aba */}
                                  <td className="py-2.5 px-3 text-center">
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

      {/* 5. Modal de Lançamentos Analíticos da Conta */}
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
                        <th className="py-2 px-3 w-[14%]">Data</th>
                        <th className="py-2 px-3 w-[15%]">Origem</th>
                        <th className="py-2 px-3 w-[45%]">Descrição / Favorecido</th>
                        <th className="py-2 px-3 w-[14%] text-center">Status</th>
                        <th className="py-2 px-3 w-[12%] text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {contaSelecionadaModal.lancamentos.map((item) => (
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
                      ))}
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
