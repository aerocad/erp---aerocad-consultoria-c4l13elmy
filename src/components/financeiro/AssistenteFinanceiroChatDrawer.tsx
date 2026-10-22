import { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  ArrowRight,
  Filter,
  Info,
  History,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import type { DisplayMessage } from '@/lib/skipAi'
import { executarOperacaoBloco, type PropostaBlocoData } from '@/services/assistenteIa'
import {
  listarConversasPersistidas,
  carregarConversaPersistida,
  excluirConversaPersistida,
  enviarMensagemPersistidaBackground,
  atualizarConversaPersistida,
  type ConversaPersistidaRecord,
} from '@/services/assistenteConversasService'
import {
  executarAcaoFinanceira,
  desfazerAcaoFinanceira,
  type PropostaAcaoData,
} from '@/services/assistenteAcoesService'

export interface AssistenteFinanceiroChatProps {
  secaoAtual:
    | 'extratos'
    | 'contas_pagar'
    | 'contas_receber'
    | 'balancetes'
    | 'fluxo_caixa'
    | 'plano_contas'
    | 'credores'
    | 'ativos'
    | 'valuation'
    | 'relatorios'
  isOpen?: boolean
  onClose?: () => void
  onAcaoExecutada?: () => void
}

const SUGESTOES_POR_SECAO: Record<string, string[]> = {
  extratos: [
    'Qual o saldo disponível consolidado nas contas bancárias PJ?',
    'Existem lançamentos não conciliados nos extratos recentes?',
    'Quais foram as 3 maiores saídas bancárias deste mês?',
  ],
  contas_pagar: [
    'Quais despesas vencem nos próximos 7 dias?',
    'Qual o total de despesas em aberto por categoria?',
    'Criar uma nova conta no Plano de Contas para Marketing Digital',
  ],
  contas_receber: [
    'Qual o valor total de faturamentos pendentes de recebimento?',
    'Quais clientes possuem faturamentos em atraso?',
  ],
  plano_contas: [
    'Criar nova conta no Plano de Contas: 3.1.6 Marketing e Divulgação Técnica',
    'Como está distribuída a estrutura do grupo 3 (Despesas)?',
    'Cadastrar credor Posto Ipiranga para abastecimento de campo',
  ],
  balancetes: [
    'Qual o resultado contábil acumulado do trimestre?',
    'Apresente o resumo DRE entre receitas brutas e despesas fixas.',
  ],
}

interface PropostaCardState {
  proposta: PropostaBlocoData
  status: 'pendente' | 'aplicando' | 'aplicada' | 'descartada'
  resultado?: {
    totalAfetados: number
    totalFalhas: number
    auditId?: string
    mensagem: string
  }
}

interface AcaoCardState {
  proposta: PropostaAcaoData
  status: 'pendente' | 'aplicando' | 'aplicada' | 'descartada'
  resultado?: {
    auditId?: string
    mensagem: string
  }
}

function extrairBlocos(texto: string): {
  textoLimpo: string
  propostaBloco: PropostaBlocoData | null
  propostaAcao: PropostaAcaoData | null
} {
  if (!texto) return { textoLimpo: '', propostaBloco: null, propostaAcao: null }

  let limpo = texto
  let propostaBloco: PropostaBlocoData | null = null
  let propostaAcao: PropostaAcaoData | null = null

  // 1. Proposta em bloco
  const matchBloco = texto.match(/```(?:proposta_bloco|json)?\s*([\s\S]*?)\s*```/)
  if (matchBloco) {
    try {
      const parsed = JSON.parse(matchBloco[1])
      if (parsed && parsed.tipo_operacao && parsed.colecao_alvo && parsed.alteracoes) {
        limpo = limpo.replace(matchBloco[0], '').trim()
        propostaBloco = parsed as PropostaBlocoData
      }
    } catch {
      /* intentionally ignored */
    }
  }

  // 2. Proposta de ação executável (criar conta, credor etc.)
  const matchAcao = limpo.match(/```(?:proposta_acao)?\s*([\s\S]*?)\s*```/)
  if (matchAcao) {
    try {
      const parsedAcao = JSON.parse(matchAcao[1])
      if (parsedAcao && parsedAcao.tipo && parsedAcao.dados) {
        limpo = limpo.replace(matchAcao[0], '').trim()
        propostaAcao = parsedAcao as PropostaAcaoData
      }
    } catch {
      /* intentionally ignored */
    }
  }

  return { textoLimpo: limpo, propostaBloco, propostaAcao }
}

export function AssistenteFinanceiroChatDrawer({
  secaoAtual,
  isOpen,
  onClose,
  onAcaoExecutada,
}: AssistenteFinanceiroChatProps) {
  const { user } = useAuth()
  const { podeVerValores } = useFinanceiroVisibilidade()

  // Restrição estrita de perfis: apenas admin ou financeiro com permissão de valores
  const isAutorizado = (user?.role === 'admin' || user?.role === 'financeiro') && podeVerValores

  const [aberto, setAberto] = useState(isOpen ?? false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)

  // Persistência das conversas
  const [conversaAtivaId, setConversaAtivaId] = useState<string | null>(null)
  const [listaConversas, setListaConversas] = useState<ConversaPersistidaRecord[]>([])
  const [conversaParaExcluir, setConversaParaExcluir] = useState<ConversaPersistidaRecord | null>(
    null,
  )

  // Controle de propostas em bloco e de ações executáveis com botão Desfazer
  const [propostasBlocoPorMsg, setPropostasBlocoPorMsg] = useState<
    Record<string, PropostaCardState>
  >({})
  const [propostasAcaoPorMsg, setPropostasAcaoPorMsg] = useState<Record<string, AcaoCardState>>({})
  const [ultimaAuditoriaId, setUltimaAuditoriaId] = useState<string | null>(null)
  const [isDesfazendo, setIsDesfazendo] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen !== undefined) {
      setAberto(isOpen)
    }
  }, [isOpen])

  // Rola para o fim
  useEffect(() => {
    if (aberto) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, aberto, activeTool, isLoading])

  // Carregar conversas persistidas no banco
  const recarregarHistorico = async () => {
    if (!isAutorizado) return
    const convs = await listarConversasPersistidas('assistente-financeiro')
    setListaConversas(convs)
    return convs
  }

  useEffect(() => {
    if (!aberto || !isAutorizado) return

    void recarregarHistorico().then((convs) => {
      if (convs && convs.length > 0 && !conversaAtivaId) {
        const primeira = convs[0]
        setConversaAtivaId(primeira.id)
        setMessages(primeira.mensagens || [])
        if (primeira.ultima_auditoria_id) {
          setUltimaAuditoriaId(primeira.ultima_auditoria_id)
        }
        if (primeira.status_processamento === 'processando') {
          setIsLoading(true)
        }
      }
    })
  }, [aberto, isAutorizado])

  if (!isAutorizado) {
    return null
  }

  function handleFechar() {
    setAberto(false)
    onClose?.()
  }

  // Trocar de conversa persistida
  async function handleSelecionarConversa(convId: string) {
    if (convId === 'nova') {
      handleIniciarNovaConversa()
      return
    }
    const conv = await carregarConversaPersistida(convId)
    if (conv) {
      setConversaAtivaId(conv.id)
      setMessages(conv.mensagens || [])
      setUltimaAuditoriaId(conv.ultima_auditoria_id || null)
      setIsLoading(conv.status_processamento === 'processando')
    }
  }

  function handleIniciarNovaConversa() {
    setConversaAtivaId(null)
    setMessages([])
    setIsLoading(false)
    setActiveTool(null)
    toast.info('Nova conversa limpa iniciada.')
  }

  async function handleConfirmarExclusao() {
    if (!conversaParaExcluir) return
    const idExcluir = conversaParaExcluir.id
    try {
      await excluirConversaPersistida(idExcluir)
      toast.success('Conversa excluída com sucesso.')
      setConversaParaExcluir(null)
      const atualizadas = await recarregarHistorico()
      if (conversaAtivaId === idExcluir) {
        if (atualizadas && atualizadas.length > 0) {
          await handleSelecionarConversa(atualizadas[0].id)
        } else {
          handleIniciarNovaConversa()
        }
      }
    } catch (err: unknown) {
      toast.error(`Falha ao excluir conversa: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleEnviarMensagem(texto?: string) {
    const msgToSend = (texto || inputMessage).trim()
    if (!msgToSend || isLoading) return

    setInputMessage('')
    setIsLoading(true)

    // Inicia envio em background garantindo persistência no banco
    try {
      const { conversaId } = await enviarMensagemPersistidaBackground({
        conversaId: conversaAtivaId,
        agentSlug: 'assistente-financeiro',
        contexto: secaoAtual,
        titulo: msgToSend.slice(0, 48),
        userText: msgToSend,
        contextRecord: {
          tipo: 'secao_financeira',
          id: secaoAtual,
          titulo: `Módulo Financeiro - Seção ${secaoAtual.toUpperCase()}`,
          dados: {
            secao_ativa: secaoAtual,
            usuario: user?.name,
            empresa: 'AEROCAD CONSULTORIA',
            data_consulta: new Date().toISOString(),
          },
        },
        onChunk: (_delta, full) => {
          setMessages((prev) => {
            const semPlaceholder = prev.filter((m) => m.id !== 'temp-ast')
            return [
              ...semPlaceholder,
              {
                id: 'temp-ast',
                role: 'assistant',
                content: full,
                created: new Date().toISOString(),
              },
            ]
          })
        },
        onToolCallStart: (info) => {
          setActiveTool(`Consultando "${info.name}"...`)
        },
        onToolCallDone: () => {
          setActiveTool(null)
        },
        onFinalizado: (convAtualizada) => {
          setConversaAtivaId(convAtualizada.id)
          setMessages(convAtualizada.mensagens || [])
          setIsLoading(false)
          setActiveTool(null)
          void recarregarHistorico()
        },
        onError: (err) => {
          setIsLoading(false)
          setActiveTool(null)
          toast.error(`Erro no processamento: ${err instanceof Error ? err.message : String(err)}`)
        },
      })

      if (!conversaAtivaId) {
        setConversaAtivaId(conversaId)
        void recarregarHistorico()
      }
    } catch (err: unknown) {
      setIsLoading(false)
      toast.error(`Erro ao enviar mensagem: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Execução de Ação Financeira (Criar Conta no Plano de Contas ou Cadastrar Credor)
  async function handleAplicarAcao(msgId: string, proposta: PropostaAcaoData) {
    setPropostasAcaoPorMsg((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], status: 'aplicando', proposta },
    }))

    try {
      const res = await executarAcaoFinanceira(proposta)
      if (!res.sucesso) {
        throw new Error(res.mensagem || 'Falha ao executar ação')
      }

      setPropostasAcaoPorMsg((prev) => ({
        ...prev,
        [msgId]: {
          proposta,
          status: 'aplicada',
          resultado: {
            auditId: res.auditId,
            mensagem: res.mensagem,
          },
        },
      }))

      if (res.auditId) {
        setUltimaAuditoriaId(res.auditId)
        if (conversaAtivaId) {
          void atualizarConversaPersistida(conversaAtivaId, {
            ultima_auditoria_id: res.auditId,
          })
        }
      }

      toast.success(res.mensagem)
      onAcaoExecutada?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao executar ação: ${msg}`)
      setPropostasAcaoPorMsg((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], status: 'pendente', proposta },
      }))
    }
  }

  // Execução de proposta de alteração em bloco (reclassificação de lançamentos)
  async function handleAplicarBloco(msgId: string, proposta: PropostaBlocoData) {
    setPropostasBlocoPorMsg((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], status: 'aplicando', proposta },
    }))

    try {
      const res = await executarOperacaoBloco(proposta)
      if (!res.sucesso) {
        throw new Error(res.mensagem || 'Erro ao processar lote')
      }

      setPropostasBlocoPorMsg((prev) => ({
        ...prev,
        [msgId]: {
          proposta,
          status: 'aplicada',
          resultado: {
            totalAfetados: res.total_afetados,
            totalFalhas: res.total_falhas,
            auditId: res.audit_id,
            mensagem: res.mensagem,
          },
        },
      }))

      if (res.audit_id) {
        setUltimaAuditoriaId(res.audit_id)
        if (conversaAtivaId) {
          void atualizarConversaPersistida(conversaAtivaId, {
            ultima_auditoria_id: res.audit_id,
          })
        }
      }

      toast.success(res.mensagem || `${res.total_afetados} registros alterados com sucesso!`)
      onAcaoExecutada?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao aplicar alteração: ${msg}`)
      setPropostasBlocoPorMsg((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], status: 'pendente', proposta },
      }))
    }
  }

  // Desfazer última alteração
  async function handleDesfazer(auditIdParaDesfazer?: string) {
    if (isDesfazendo) return
    setIsDesfazendo(true)
    const auditId = auditIdParaDesfazer || ultimaAuditoriaId || undefined

    try {
      const res = await desfazerAcaoFinanceira(auditId)
      if (!res.sucesso) {
        throw new Error(res.mensagem || 'Falha ao reverter')
      }
      toast.success(res.mensagem || 'Ação revertida com sucesso!')
      setUltimaAuditoriaId(null)
      if (conversaAtivaId) {
        void atualizarConversaPersistida(conversaAtivaId, {
          ultima_auditoria_id: '',
        })
      }
      onAcaoExecutada?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Não foi possível desfazer: ${msg}`)
    } finally {
      setIsDesfazendo(false)
    }
  }

  const sugestoes = SUGESTOES_POR_SECAO[secaoAtual] || SUGESTOES_POR_SECAO.extratos

  return (
    <>
      {/* Botão flutuante discreto padrão AEROCAD #FF6A13 */}
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg bg-[#FF6A13] hover:bg-[#e05b0d] text-white font-medium text-xs tracking-wide transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#FF6A13] focus:ring-offset-2"
          title="Abrir Assistente Financeiro AEROCAD"
        >
          <Sparkles className="w-4 h-4" />
          <span>Assistente Financeiro</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </button>
      )}

      {/* Drawer lateral */}
      {aberto && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl border-l border-neutral-200 flex flex-col font-sans animate-in slide-in-from-right duration-200">
          {/* Cabeçalho */}
          <div className="bg-[#FF6A13] text-white p-4 flex items-center justify-between border-b border-[#e05b0d]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/20 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                  Assistente Financeiro
                  <Badge className="bg-white/20 text-white text-[10px] font-normal border-0 hover:bg-white/25">
                    AEROCAD
                  </Badge>
                </h3>
                <p className="text-[11px] text-white/80">
                  Poder de Ação Contábil • Histórico Persistido
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleIniciarNovaConversa}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="Nova conversa"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFechar}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Barra de Histórico de Conversas Persistidas */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <History className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <Select
                value={conversaAtivaId || 'nova'}
                onValueChange={(val) => handleSelecionarConversa(val)}
              >
                <SelectTrigger className="h-7 text-xs bg-white border-neutral-300 w-full max-w-[280px]">
                  <SelectValue placeholder="Histórico de conversas..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova" className="text-xs font-semibold text-[#FF6A13]">
                    + Iniciar Nova Conversa
                  </SelectItem>
                  {listaConversas.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.titulo || `Conversa de ${new Date(c.created).toLocaleDateString('pt-BR')}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {conversaAtivaId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const encontrada = listaConversas.find((c) => c.id === conversaAtivaId)
                  if (encontrada) setConversaParaExcluir(encontrada)
                }}
                className="h-7 w-7 text-neutral-500 hover:text-red-600 hover:bg-red-50"
                title="Excluir esta conversa definitivamente"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Banner de status e botão DESFAZER se houver ação executada */}
          <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">
                Ações contábeis exigem confirmação e são 100% reversíveis.
              </span>
            </div>
            {ultimaAuditoriaId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDesfazer(ultimaAuditoriaId)}
                disabled={isDesfazendo}
                className="h-6 text-[10px] px-2 border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center gap-1 shrink-0 font-semibold"
                title="Desfazer última alteração"
              >
                {isDesfazendo ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 text-amber-700" />
                )}
                <span>Desfazer</span>
              </Button>
            )}
          </div>

          {/* Área de Mensagens */}
          <ScrollArea className="flex-1 p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="py-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-orange-100 text-[#FF6A13] mx-auto flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-neutral-800 text-sm">
                    Como posso ajudar no financeiro hoje?
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Consulte saldos, proponha criação de contas no Plano de Contas, credores ou
                    reclassifique lançamentos com segurança.
                  </p>
                </div>

                {/* Perguntas sugeridas */}
                <div className="text-left pt-2 space-y-1.5">
                  <p className="text-[11px] font-semibold text-neutral-500 px-1 uppercase tracking-wider">
                    Sugestões para {secaoAtual}:
                  </p>
                  <div className="space-y-1.5">
                    {sugestoes.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleEnviarMensagem(sug)}
                        className="w-full text-left text-xs p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-orange-50 hover:border-orange-300 text-neutral-700 hover:text-[#FF6A13] transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pb-2">
                {messages.map((m) => {
                  const isUser = m.role === 'user'
                  const { textoLimpo, propostaBloco, propostaAcao } = !isUser
                    ? extrairBlocos(m.content)
                    : { textoLimpo: m.content, propostaBloco: null, propostaAcao: null }

                  const blocoState = propostasBlocoPorMsg[m.id]
                  const acaoState = propostasAcaoPorMsg[m.id]

                  const blocoAtual = blocoState?.proposta || propostaBloco
                  const acaoAtual = acaoState?.proposta || propostaAcao

                  return (
                    <div key={m.id} className="space-y-2">
                      <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-[#FF6A13] flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            isUser
                              ? 'bg-[#FF6A13] text-white rounded-br-none'
                              : 'bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-bl-none whitespace-pre-wrap'
                          }`}
                        >
                          {textoLimpo || (
                            <span className="flex items-center gap-1.5 text-neutral-500 italic">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Processando consulta com o Assistente...
                            </span>
                          )}
                        </div>
                        {isUser && (
                          <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
                            <UserIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* CARTÃO DE PROPOSTA DE AÇÃO EXECUTÁVEL (NOVA CONTA OU NOVO CREDOR) */}
                      {!isUser && acaoAtual && (
                        <div className="ml-9 max-w-[88%] rounded-xl border-2 border-orange-300 bg-orange-50/90 p-3.5 shadow-sm text-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                              <Sparkles className="w-4 h-4 text-[#FF6A13]" />
                              <span>{acaoAtual.titulo || 'Ação Proposta pelo Assistente'}</span>
                            </div>
                            <Badge className="bg-[#FF6A13] text-white text-[10px]">
                              Aprovação Necessária
                            </Badge>
                          </div>

                          <p className="text-neutral-700">{acaoAtual.descricao}</p>

                          {/* Detalhes dos Campos */}
                          <div className="bg-white rounded-lg p-2.5 border border-neutral-200 space-y-1.5 text-[11px]">
                            {Object.entries(acaoAtual.dados).map(([chave, valor]) => (
                              <div key={chave} className="flex justify-between items-center py-0.5">
                                <span className="text-neutral-500 capitalize">
                                  {chave.replace(/_/g, ' ')}:
                                </span>
                                <span className="font-semibold text-neutral-800 font-mono">
                                  {String(valor)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Botões de Ação */}
                          {(!acaoState || acaoState.status === 'pendente') && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPropostasAcaoPorMsg((prev) => ({
                                    ...prev,
                                    [m.id]: { proposta: acaoAtual, status: 'descartada' },
                                  }))
                                  toast.info('Ação descartada.')
                                }}
                                className="h-7 text-xs text-neutral-600 hover:text-neutral-800"
                              >
                                Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleAplicarAcao(m.id, acaoAtual)}
                                className="h-7 text-xs bg-[#FF6A13] hover:bg-[#e05b0d] text-white flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirmar & Executar</span>
                              </Button>
                            </div>
                          )}

                          {acaoState?.status === 'aplicando' && (
                            <div className="flex items-center justify-center gap-2 py-1 text-[#FF6A13] font-medium text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Criando registro e gerando auditoria reversível...</span>
                            </div>
                          )}

                          {acaoState?.status === 'aplicada' && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2.5 text-[11px] space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>{acaoState.resultado?.mensagem}</span>
                                </div>
                                {acaoState.resultado?.auditId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDesfazer(acaoState.resultado?.auditId)}
                                    className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-900 hover:bg-emerald-100 flex items-center gap-1"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Desfazer</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CARTÃO DE PROPOSTA DE RECLASSIFICAÇÃO EM BLOCO */}
                      {!isUser && blocoAtual && (
                        <div className="ml-9 max-w-[88%] rounded-xl border-2 border-orange-200 bg-orange-50/70 p-3 shadow-sm text-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-orange-200 pb-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                              <Layers className="w-4 h-4 text-[#FF6A13]" />
                              <span>Reclassificação Contábil em Bloco</span>
                            </div>
                            <Badge className="bg-[#FF6A13] text-white text-[10px] px-2">
                              Confirmação Requerida
                            </Badge>
                          </div>

                          <p className="text-neutral-700 font-medium">
                            {blocoAtual.descricao_resumo || 'Alteração de lançamentos'}
                          </p>

                          <div className="bg-white rounded-lg p-2.5 border border-neutral-200 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between text-neutral-600">
                              <span className="flex items-center gap-1 text-neutral-500">
                                <Filter className="w-3 h-3 text-[#FF6A13]" /> Coleção Alvo:
                              </span>
                              <span className="font-semibold text-neutral-800 uppercase">
                                {blocoAtual.colecao_alvo.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-neutral-600">
                              <span className="text-neutral-500">Critério de Filtro:</span>
                              <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">
                                {blocoAtual.filtro.campo} {blocoAtual.filtro.operador} "
                                {String(blocoAtual.filtro.valor)}"
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-neutral-600 pt-1 border-t border-neutral-100">
                              <span className="text-neutral-500">Alteração:</span>
                              <span className="flex items-center gap-1 font-semibold text-[#FF6A13]">
                                <span>{blocoAtual.alteracoes.campo}</span>
                                <ArrowRight className="w-3 h-3" />
                                <span>
                                  {blocoAtual.alteracoes.valor_novo_label ||
                                    String(blocoAtual.alteracoes.valor_novo)}
                                </span>
                              </span>
                            </div>
                          </div>

                          {(!blocoState || blocoState.status === 'pendente') && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPropostasBlocoPorMsg((prev) => ({
                                    ...prev,
                                    [m.id]: { proposta: blocoAtual, status: 'descartada' },
                                  }))
                                }}
                                className="h-7 text-xs text-neutral-600"
                              >
                                Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleAplicarBloco(m.id, blocoAtual)}
                                className="h-7 text-xs bg-[#FF6A13] hover:bg-[#e05b0d] text-white flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aplicar em Bloco</span>
                              </Button>
                            </div>
                          )}

                          {blocoState?.status === 'aplicando' && (
                            <div className="flex items-center justify-center gap-2 py-1 text-[#FF6A13] font-medium text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Aplicando alterações...</span>
                            </div>
                          )}

                          {blocoState?.status === 'aplicada' && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2 text-[11px] flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{blocoState.resultado?.mensagem}</span>
                              </div>
                              {blocoState.resultado?.auditId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDesfazer(blocoState.resultado?.auditId)}
                                  className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-900 hover:bg-emerald-100 flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Desfazer</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {activeTool && (
                  <div className="flex items-center gap-2 text-[11px] text-[#FF6A13] font-medium bg-orange-50 p-2 rounded-lg border border-orange-200 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{activeTool}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Campo de Entrada de Mensagem */}
          <div className="p-3 border-t border-neutral-200 bg-neutral-50">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleEnviarMensagem()
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleEnviarMensagem()
                  }
                }}
                placeholder="Ex.: Criar nova conta no Plano de Contas para Marketing Digital..."
                className="min-h-[64px] max-h-28 text-xs resize-none bg-white focus-visible:ring-[#FF6A13]"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="h-11 px-3.5 bg-[#FF6A13] hover:bg-[#e05b0d] text-white shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
              <span>Enter envia • Shift+Enter quebra linha</span>
              <span>Histórico mantido até você excluir</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Conversa */}
      <Dialog
        open={Boolean(conversaParaExcluir)}
        onOpenChange={(v) => !v && setConversaParaExcluir(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Excluir Conversa do Assistente
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-2">
              Tem certeza que deseja excluir a conversa{' '}
              <strong>"{conversaParaExcluir?.titulo || 'esta conversa'}"</strong>?
              <br />
              Esta ação removerá o histórico do banco de dados definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConversaParaExcluir(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmarExclusao}
              className="text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
