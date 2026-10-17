/**
 * Aba de Plano de Contas Completo da AEROCAD Consultoria
 *
 * Apresenta a árvore hierárquica contábil:
 * - Grupos sintéticos (1. Ativo, 2. Passivo, 3. Despesas e Custos, 4. Receitas)
 * - Subgrupos (Ativo Circulante, Ativo Não Circulante, Passivo Circulante, Despesas Fixas, Custos Diretos, etc.)
 * - Contas individualizadas analíticas com códigos, tipo, regime (fixo/variável)
 * - Contagem e totalização de lançamentos vinculados em contas a pagar / receber
 * - Ação de navegação para ir direto à listagem filtrada da conta
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
import { PLANO_CONTAS_AEROCAD, ItemPlanoContas, TipoNaturezaConta } from '@/lib/planoContas'
import { ContaPagarRecord, ParcelaRecord, ContaReceberRecord } from '@/types/crm'
import { formatCurrency } from '@/lib/format'

export interface PlanoContasTabProps {
  contasPagar: ContaPagarRecord[]
  parcelas: ParcelaRecord[]
  contasReceber: ContaReceberRecord[]
  canWrite: boolean
  onNavegarParaLancamentos?: (
    tipo: 'pagar' | 'receber',
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
  onNavegarParaLancamentos,
}: PlanoContasTabProps) {
  const [busca, setBusca] = useState('')
  const [filtroNatureza, setFiltroNatureza] = useState<string>('todos')
  const [apenasComLancamentos, setApenasComLancamentos] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '3': true,
    '4': true,
  })

  // 1. Mapear contagens e volumes financeiros por código de conta
  const dadosContas = useMemo(() => {
    const mapa = new Map<string, { qtd: number; valor: number }>()

    // Contas a Pagar
    for (const cp of contasPagar) {
      const codigo = cp.plano_contas_codigo || '3.1.1'
      const atual = mapa.get(codigo) || { qtd: 0, valor: 0 }
      atual.qtd += 1
      atual.valor += cp.valor || 0
      mapa.set(codigo, atual)
    }

    // Contas a Receber (Receitas Avulsas)
    for (const cr of contasReceber) {
      // 4.1.3 padrão para consultorias avulsas
      const codigo = '4.1.3'
      const atual = mapa.get(codigo) || { qtd: 0, valor: 0 }
      atual.qtd += 1
      atual.valor += cr.valor || 0
      mapa.set(codigo, atual)
    }

    // Parcelas de Projetos
    for (const p of parcelas) {
      // 4.1.1 padrão para projetos
      const codigo = '4.1.1'
      const atual = mapa.get(codigo) || { qtd: 0, valor: 0 }
      atual.qtd += 1
      atual.valor += p.valor || 0
      mapa.set(codigo, atual)
    }

    return mapa
  }, [contasPagar, contasReceber, parcelas])

  // 2. Estrutura em árvore hierárquica
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
      // Contas pertencentes a este grande grupo
      let contasGrupo = PLANO_CONTAS_AEROCAD.filter((item) =>
        item.codigo.startsWith(g.codigoPrefixo),
      )

      // Filtro de busca textual
      if (termoBusca) {
        contasGrupo = contasGrupo.filter(
          (c) =>
            c.codigo.toLowerCase().includes(termoBusca) ||
            c.nome.toLowerCase().includes(termoBusca) ||
            c.grupo.toLowerCase().includes(termoBusca),
        )
      }

      // Filtro de natureza
      if (filtroNatureza !== 'todos' && g.natureza !== filtroNatureza) {
        contasGrupo = []
      }

      // Agrupa por subgrupo
      const subgruposMap = new Map<
        string,
        (ItemPlanoContas & { qtdLancamentos: number; totalValor: number })[]
      >()

      let grupoQtdTotal = 0
      let grupoValorTotal = 0

      for (const conta of contasGrupo) {
        const dados = dadosContas.get(conta.codigo) || { qtd: 0, valor: 0 }

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
  }, [busca, filtroNatureza, apenasComLancamentos, dadosContas])

  // Contagem geral
  const totalContas = PLANO_CONTAS_AEROCAD.length
  const contasComUso = useMemo(() => {
    return PLANO_CONTAS_AEROCAD.filter((c) => {
      const d = dadosContas.get(c.codigo)
      return d && d.qtd > 0
    }).length
  }, [dadosContas])

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
              Estrutura hierárquica contábil padronizada para engenharia consultiva, balancetes,
              balanço e DRE gerencial.
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
              <span>Contas com Lançamentos</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600">{contasComUso}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {((contasComUso / (totalContas || 1)) * 100).toFixed(0)}% com movimentações ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Lançamentos Vinculados</span>
              <FileSpreadsheet className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {contasPagar.length + contasReceber.length + parcelas.length}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Pagar ({contasPagar.length}) · Receber/Projetos (
              {contasReceber.length + parcelas.length})
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Padrão de Classificação</span>
              <DollarSign className="h-4 w-4 text-[#FF6A13]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-base font-bold text-[#FF6A13] mt-1">Contábil Automatizado</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">Vinculado a NFS-e e Extratos PJ</p>
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
                      {grupo.qtdTotalLancamentos} lançamentos
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
                              <th className="py-2.5 px-3 w-[40%]">Nome da Conta Contábil</th>
                              <th className="py-2.5 px-3 w-[14%] text-center">Classificação</th>
                              <th className="py-2.5 px-3 w-[14%] text-center">Lançamentos</th>
                              <th className="py-2.5 px-3 w-[12%] text-right">Volume (R$)</th>
                              <th className="py-2.5 px-3 w-[8%] text-center">Ação</th>
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
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        {conta.qtdLancamentos} registro
                                        {conta.qtdLancamentos > 1 ? 's' : ''}
                                      </span>
                                    ) : (
                                      <span className="text-neutral-400 text-[11px]">Nenhum</span>
                                    )}
                                  </td>

                                  {/* Volume */}
                                  <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-700">
                                    {temLancamentos ? formatCurrency(conta.totalValor) : '—'}
                                  </td>

                                  {/* Ação: Navegar para os lançamentos da conta */}
                                  <td className="py-2.5 px-3 text-center">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-neutral-500 hover:text-[#FF6A13] hover:bg-orange-50"
                                      title={`Filtrar lançamentos da conta ${conta.codigo}`}
                                      onClick={() => {
                                        if (onNavegarParaLancamentos) {
                                          const tipo = conta.codigo.startsWith('4.')
                                            ? 'receber'
                                            : 'pagar'
                                          onNavegarParaLancamentos(tipo, {
                                            codigo: conta.codigo,
                                            nome: conta.nome,
                                          })
                                        }
                                      }}
                                    >
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
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

      {/* 5. Rodapé Informativo AEROCAD */}
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
            <strong>DRE</strong> e cálculo de <strong>Ponto de Equilíbrio</strong>. Toda despesa ou
            receita registrada no CRM herda essa codificação analítica.
          </p>
        </div>
      </div>
    </div>
  )
}
