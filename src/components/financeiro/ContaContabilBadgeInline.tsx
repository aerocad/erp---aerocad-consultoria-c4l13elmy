import React, { useState, useMemo } from 'react'
import {
  Tag,
  Pencil,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  FolderTree,
  AlertCircle,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { toast as toastSonner } from 'sonner'
import {
  PLANO_CONTAS_AEROCAD,
  ItemPlanoContas,
  TipoNaturezaConta,
  obterItemPlanoContasPorCodigo,
} from '@/lib/planoContas'
import {
  ColecaoReclassificavel,
  reclassificarLancamentoContabil,
  buscarTransacoesMesmaDescricao,
  DetalhesTransacoesMesmaDescricao,
} from '@/services/reclassificacaoContabilService'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Layers } from 'lucide-react'

export interface ContaContabilBadgeInlineProps {
  /** Coleção do registro alvo */
  colecao: ColecaoReclassificavel
  /** ID do registro no PocketBase */
  id: string
  /** Código contábil atual (ex: "3.1.5", "4.1.1", ou vazio se não tiver) */
  codigoAtual?: string | null
  /** Nome descritivo da conta contábil atual (opcional) */
  nomeAtual?: string | null
  /** Descrição do registro para log de auditoria e correspondência em bloco */
  descricaoRegistro?: string
  /** Data do lançamento (para checagem de balancete arquivado) */
  dataRegistro?: string
  /** Observações atuais do lançamento (qual a exata despesa?) */
  observacoesAtual?: string | null
  /** Se o registro já foi marcado como classificação manual */
  classificacaoManual?: boolean
  /** Callback executado após salvar com sucesso a reclassificação */
  onReclassificado?: (novoCodigo: string, novoNome: string, observacoes?: string) => void
  /** Modo de exibição compacto (apenas código ou reduzido) */
  compacto?: boolean
  /** Desabilitar edição mesmo se tiver permissão */
  disabled?: boolean
  /** Estilo customizado do badge */
  className?: string
  /** Usar modal dialog em vez de popover (útil em tabelas muito estreitas ou modais) */
  usarModal?: boolean
}

const GRUPOS_NATUREZA: {
  id: string
  codigoPrefixo: string
  nome: string
  natureza: TipoNaturezaConta
  corBadge: string
  corHeader: string
}[] = [
  {
    id: '1',
    codigoPrefixo: '1.',
    nome: '1. ATIVO',
    natureza: 'ativo',
    corBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    corHeader: 'text-blue-800 bg-blue-50/70 border-blue-200',
  },
  {
    id: '2',
    codigoPrefixo: '2.',
    nome: '2. PASSIVO',
    natureza: 'passivo',
    corBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    corHeader: 'text-purple-800 bg-purple-50/70 border-purple-200',
  },
  {
    id: '3',
    codigoPrefixo: '3.',
    nome: '3. CUSTOS E DESPESAS',
    natureza: 'despesa',
    corBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    corHeader: 'text-amber-800 bg-amber-50/70 border-amber-200',
  },
  {
    id: '4',
    codigoPrefixo: '4.',
    nome: '4. RECEITAS',
    natureza: 'receita',
    corBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    corHeader: 'text-emerald-800 bg-emerald-50/70 border-emerald-200',
  },
]

export function ContaContabilBadgeInline({
  colecao,
  id,
  codigoAtual,
  nomeAtual,
  descricaoRegistro,
  dataRegistro,
  observacoesAtual,
  classificacaoManual = false,
  onReclassificado,
  compacto = false,
  disabled = false,
  className = '',
  usarModal = false,
}: ContaContabilBadgeInlineProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [naturezaFiltro, setNaturezaFiltro] = useState<string>('todos')
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '3': true,
    '4': true,
  })
  const [salvando, setSalvando] = useState(false)
  const [observacoesTexto, setObservacoesTexto] = useState(observacoesAtual || '')
  const [aplicarEmBloco, setAplicarEmBloco] = useState(true)
  const [mesmaDescricaoInfo, setMesmaDescricaoInfo] =
    useState<DetalhesTransacoesMesmaDescricao | null>(null)
  const [buscandoMesmaDescricao, setBuscandoMesmaDescricao] = useState(false)

  // Ao abrir o modal, sincroniza o texto de observações e busca outras transações iguais
  React.useEffect(() => {
    if (aberto) {
      setObservacoesTexto(observacoesAtual || '')
      setAplicarEmBloco(true)
      if (descricaoRegistro && (colecao === 'extratos_transacoes' || colecao === 'contas_pagar')) {
        setBuscandoMesmaDescricao(true)
        buscarTransacoesMesmaDescricao({
          colecao,
          idAtual: id,
          descricao: descricaoRegistro,
        })
          .then((info) => {
            setMesmaDescricaoInfo(info)
          })
          .catch(() => {
            setMesmaDescricaoInfo(null)
          })
          .finally(() => {
            setBuscandoMesmaDescricao(false)
          })
      } else {
        setMesmaDescricaoInfo(null)
      }
    }
  }, [aberto, observacoesAtual, descricaoRegistro, colecao, id])

  // Permissão: editável apenas para perfis admin e financeiro
  const podeEditar = !disabled && (user?.role === 'admin' || user?.role === 'financeiro')

  // Resolver conta atual
  const contaCadastrada = codigoAtual ? obterItemPlanoContasPorCodigo(codigoAtual) : null
  const codigoExibicao = codigoAtual || null
  const nomeExibicao = nomeAtual || contaCadastrada?.nome || null

  const alternarGrupo = (grupoId: string) => {
    setGruposAbertos((prev) => ({ ...prev, [grupoId]: !prev[grupoId] }))
  }

  // Filtragem hierárquica das contas
  const arvoreFiltrada = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return GRUPOS_NATUREZA.map((g) => {
      if (naturezaFiltro !== 'todos' && g.id !== naturezaFiltro) {
        return { ...g, subgrupos: [], totalContas: 0 }
      }

      let contasDoGrupo = PLANO_CONTAS_AEROCAD.filter((item) =>
        item.codigo.startsWith(g.codigoPrefixo),
      )

      if (termo) {
        contasDoGrupo = contasDoGrupo.filter(
          (c) =>
            c.codigo.toLowerCase().includes(termo) ||
            c.nome.toLowerCase().includes(termo) ||
            c.grupo.toLowerCase().includes(termo),
        )
      }

      // Agrupar por subgrupo (grupo textual do plano)
      const subgruposMap = new Map<string, ItemPlanoContas[]>()
      for (const conta of contasDoGrupo) {
        const sub = subgruposMap.get(conta.grupo) || []
        sub.push(conta)
        subgruposMap.set(conta.grupo, sub)
      }

      const subgrupos = Array.from(subgruposMap.entries()).map(([nomeSub, contas]) => ({
        nome: nomeSub,
        contas,
      }))

      return {
        ...g,
        subgrupos,
        totalContas: contasDoGrupo.length,
      }
    })
  }, [busca, naturezaFiltro])

  // Ação de selecionar e persistir
  const handleSelecionarConta = async (contaEscolhida: ItemPlanoContas) => {
    // Permitir salvar mesmo se o código for igual caso as observações tenham mudado
    const observacoesMudaram = (observacoesTexto || '').trim() !== (observacoesAtual || '').trim()
    if (contaEscolhida.codigo === codigoAtual && !observacoesMudaram) {
      setAberto(false)
      return
    }

    try {
      setSalvando(true)
      const aplicarEmBlocoFinal = Boolean(
        aplicarEmBloco && mesmaDescricaoInfo && mesmaDescricaoInfo.total > 0,
      )

      const res = await reclassificarLancamentoContabil({
        colecao,
        id,
        codigoNovo: contaEscolhida.codigo,
        nomeNovo: contaEscolhida.nome,
        codigoAnterior: codigoAtual || undefined,
        nomeAnterior: nomeAtual || undefined,
        descricaoRegistro,
        dataRegistro,
        observacoes: observacoesTexto,
        user,
        aplicarEmBlocoMesmaDescricao: aplicarEmBlocoFinal,
      })

      const totalAfetados = res.totalAfetados || 1

      if (totalAfetados > 1) {
        const compsTexto = (res.competenciasAfetadas || [])
          .map((c) => {
            const [ano, mes] = c.split('-')
            return `${mes}/${ano}`
          })
          .join(', ')

        toast({
          title: `Classificação aplicada a ${totalAfetados} lançamentos com a mesma descrição!`,
          description: `${contaEscolhida.codigo} · ${contaEscolhida.nome}${compsTexto ? ` · Competências: ${compsTexto}` : ''}`,
        })
      } else if (res.balanceteRegenerado && res.balanceteReferenciaFormatada) {
        toast({
          title: `Conta reclassificada — balancete de ${res.balanceteReferenciaFormatada} regenerado automaticamente`,
          description: `${contaEscolhida.codigo} · ${contaEscolhida.nome}`,
        })
      } else if (res.balanceteErro || res.balanceteDesatualizadoReferencia) {
        // Balancete arquivado falhou ao regenerar -> toast warning e fallback
        toastSonner.warning(
          `Balancete de ${res.balanceteReferenciaFormatada || res.balanceteDesatualizadoReferencia} arquivado não pôde ser regenerado automaticamente. Abra a aba Balancetes para atualizar.`,
        )
        toast({
          title: 'Conta reclassificada — demonstrativos atualizados',
          description: `${contaEscolhida.codigo} · ${contaEscolhida.nome}`,
        })
      } else {
        // Não havia balancete arquivado para este período -> toast atual padrão
        toast({
          title: 'Conta reclassificada — demonstrativos atualizados',
          description: `${contaEscolhida.codigo} · ${contaEscolhida.nome}`,
        })
      }

      if (onReclassificado) {
        onReclassificado(contaEscolhida.codigo, contaEscolhida.nome, observacoesTexto.trim())
      }
      setAberto(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reclassificar lançamento.'
      toast({
        title: 'Erro ao reclassificar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Estilização do badge conforme a natureza do código
  const obterEstiloBadge = () => {
    if (!codigoExibicao) {
      return 'bg-neutral-100 text-neutral-500 border-neutral-300 border-dashed hover:bg-neutral-200/70'
    }
    if (codigoExibicao.startsWith('1.')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70'
    }
    if (codigoExibicao.startsWith('2.')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70'
    }
    if (codigoExibicao.startsWith('3.')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70'
    }
    if (codigoExibicao.startsWith('4.')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
    }
    return 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
  }

  // Gatilho visual do Badge
  const triggerButton = (
    <button
      type="button"
      disabled={!podeEditar}
      onClick={() => podeEditar && setAberto(true)}
      title={
        podeEditar
          ? `Clique para reclassificar conta contábil (${codigoExibicao || 'Sem conta'})`
          : 'Apenas Administrador ou Financeiro podem reclassificar contas'
      }
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-all text-left border ${obterEstiloBadge()} ${
        podeEditar ? 'cursor-pointer hover:shadow-xs group' : 'cursor-default opacity-90'
      } ${className}`}
    >
      <Tag className="w-3 h-3 text-[#FF6A13] shrink-0" />
      {codigoExibicao ? (
        <span className="truncate max-w-[210px]">
          <strong className="font-mono">{codigoExibicao}</strong>
          {!compacto && nomeExibicao && (
            <span className="text-neutral-600 font-normal ml-1">· {nomeExibicao}</span>
          )}
        </span>
      ) : (
        <span className="italic text-neutral-400">Sem conta</span>
      )}
      {classificacaoManual && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#FF6A13] shrink-0"
          title="Classificação manual auditada"
        />
      )}
      {podeEditar && (
        <Pencil className="w-2.5 h-2.5 text-[#FF6A13] ml-0.5 opacity-60 group-hover:opacity-100 shrink-0" />
      )}
    </button>
  )

  // Conteúdo do seletor em árvore com busca em tempo real
  const seletorConteudo = (
    <div className="flex flex-col h-full max-h-[500px] w-[420px] max-w-[95vw] text-xs">
      {/* Cabeçalho */}
      <div className="p-3 border-b border-neutral-200 bg-neutral-50/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <FolderTree className="w-4 h-4 text-[#FF6A13]" />
            <span className="font-bold text-neutral-800 text-sm">Plano de Contas Contábil</span>
          </div>
          {usarModal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setAberto(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {descricaoRegistro && (
          <p className="text-[11px] text-neutral-500 truncate mb-2">
            Lançamento: <span className="font-medium text-neutral-700">{descricaoRegistro}</span>
          </p>
        )}

        {/* REQUISITO 2: Campo de Observações por lançamento */}
        <div className="mb-2.5 p-2 rounded-md bg-white border border-neutral-200 space-y-1">
          <Label className="text-[10px] font-semibold text-neutral-700 block">
            Observações (qual a exata despesa envolvida?)
          </Label>
          <Textarea
            value={observacoesTexto}
            onChange={(e) => setObservacoesTexto(e.target.value)}
            placeholder="Especifique a exata despesa (ex: tarifa transferência PIX fornecedor X, compra suprimentos...)"
            rows={2}
            className="text-[11px] min-h-[46px] resize-none bg-neutral-50/50"
          />
        </div>

        {/* REQUISITO 1: Opção em bloco para mesma descrição */}
        {buscandoMesmaDescricao ? (
          <div className="mb-2 p-2 rounded-md bg-neutral-100 text-[10px] text-neutral-500 flex items-center gap-1.5 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-[#FF6A13]" />
            Verificando outras transações com esta mesma descrição...
          </div>
        ) : mesmaDescricaoInfo && mesmaDescricaoInfo.total > 0 ? (
          <div className="mb-2.5 p-2.5 rounded-md bg-orange-50 border border-orange-200 text-neutral-800 space-y-1.5">
            <div className="flex items-start gap-2">
              <Checkbox
                id={`em-bloco-${id}`}
                checked={aplicarEmBloco}
                onCheckedChange={(checked) => setAplicarEmBloco(Boolean(checked))}
                className="mt-0.5 border-orange-400 data-[state=checked]:bg-[#FF6A13] data-[state=checked]:border-[#FF6A13]"
              />
              <div className="flex-1 text-[11px]">
                <label
                  htmlFor={`em-bloco-${id}`}
                  className="font-bold text-[#D65100] cursor-pointer flex items-center gap-1"
                >
                  <Layers className="w-3 h-3 text-[#FF6A13] shrink-0" />
                  Aplicar também às {mesmaDescricaoInfo.total} outras transações com a mesma
                  descrição
                </label>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  Descrição exata: &ldquo;<span className="font-semibold">{descricaoRegistro}</span>
                  &rdquo;
                </p>
                {mesmaDescricaoInfo.competenciasFormatadas.length > 0 && (
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Períodos afetados ({mesmaDescricaoInfo.competenciasFormatadas.length}):{' '}
                    <span className="font-mono font-medium text-neutral-700">
                      {mesmaDescricaoInfo.competenciasFormatadas.join(', ')}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Campo de Busca em tempo real */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código (ex: 3.1.5) ou nome..."
            className="pl-8 h-8 text-xs bg-white"
            autoFocus
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros rápidos por natureza */}
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setNaturezaFiltro('todos')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
              naturezaFiltro === 'todos'
                ? 'bg-[#FF6A13] text-white'
                : 'bg-neutral-200/80 text-neutral-700 hover:bg-neutral-300'
            }`}
          >
            Todas
          </button>
          {GRUPOS_NATUREZA.map((g) => (
            <button
              key={g.id}
              onClick={() => setNaturezaFiltro(g.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition whitespace-nowrap ${
                naturezaFiltro === g.id
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {g.codigoPrefixo} {g.natureza.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Lista da Árvore */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {salvando ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6A13]" />
            <span>Salvando e auditando reclassificação...</span>
          </div>
        ) : arvoreFiltrada.every((g) => g.totalContas === 0) ? (
          <div className="py-8 text-center text-neutral-500">
            <AlertCircle className="w-6 h-6 mx-auto mb-1 text-neutral-400" />
            <p>Nenhuma conta contábil encontrada para &ldquo;{busca}&rdquo;</p>
          </div>
        ) : (
          arvoreFiltrada.map((grupo) => {
            if (grupo.totalContas === 0) return null
            const expandido = gruposAbertos[grupo.id] !== false

            return (
              <div
                key={grupo.id}
                className="border border-neutral-200 rounded-md overflow-hidden bg-white"
              >
                {/* Cabeçalho do Grupo (1. Ativo, 2. Passivo, 3. Custos, 4. Receitas) */}
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left font-bold text-xs border-b border-neutral-200 ${grupo.corHeader}`}
                >
                  <div className="flex items-center gap-1.5">
                    {expandido ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>{grupo.nome}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1 font-normal bg-white/70"
                  >
                    {grupo.totalContas} contas
                  </Badge>
                </button>

                {/* Subgrupos e Contas */}
                {expandido && (
                  <div className="p-1 space-y-1.5">
                    {grupo.subgrupos.map((sub) => (
                      <div key={sub.nome} className="pl-1">
                        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide px-2 py-0.5 bg-neutral-50 rounded">
                          {sub.nome}
                        </div>
                        <div className="space-y-0.5 mt-0.5">
                          {sub.contas.map((c) => {
                            const estaSelecionada = c.codigo === codigoAtual
                            return (
                              <button
                                key={c.codigo}
                                type="button"
                                onClick={() => handleSelecionarConta(c)}
                                className={`w-full flex items-start justify-between px-2.5 py-1.5 rounded text-left transition ${
                                  estaSelecionada
                                    ? 'bg-[#FF6A13]/10 border border-[#FF6A13]/40 text-neutral-900 font-medium'
                                    : 'hover:bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                <div className="flex-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-[#FF6A13]">
                                      {c.codigo}
                                    </span>
                                    <span className="font-medium text-neutral-800">{c.nome}</span>
                                  </div>
                                  {c.descricao && (
                                    <p className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                                      {c.descricao}
                                    </p>
                                  )}
                                </div>
                                {estaSelecionada && (
                                  <Check className="w-4 h-4 text-[#FF6A13] shrink-0 mt-0.5" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Rodapé explicativo */}
      <div className="p-2.5 border-t border-neutral-200 bg-neutral-50 text-[11px] text-neutral-500 flex items-center justify-between gap-2">
        <span className="truncate">A reclassificação é auditada e atualiza os relatórios.</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {(observacoesTexto || '').trim() !== (observacoesAtual || '').trim() && (
            <Button
              size="sm"
              disabled={salvando}
              onClick={() => {
                if (contaCadastrada) {
                  handleSelecionarConta(contaCadastrada)
                } else if (codigoAtual) {
                  handleSelecionarConta({
                    codigo: codigoAtual,
                    nome: nomeAtual || 'Conta Atual',
                    grupo: '',
                    natureza: 'despesa',
                    descricao: '',
                  })
                }
              }}
              className="h-6 text-xs px-2.5 bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              Salvar Observação
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAberto(false)}
            className="h-6 text-xs px-2"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )

  if (!podeEditar) {
    return triggerButton
  }

  if (usarModal) {
    return (
      <>
        {triggerButton}
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Reclassificação Contábil</DialogTitle>
              <DialogDescription>
                Selecione a nova conta contábil para o registro.
              </DialogDescription>
            </DialogHeader>
            {seletorConteudo}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="p-0 w-auto shadow-xl border-neutral-200 z-50"
      >
        {seletorConteudo}
      </PopoverContent>
    </Popover>
  )
}
