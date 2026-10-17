import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, Trash2, X, Bot, User as UserIcon, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { canAccess } from '@/lib/crm'
import {
  sendAgentMessage,
  listAgentConversations,
  loadConversationMessages,
  type AgentConversationItem,
  type CrmAgentSlug,
  type AgentContextRecord,
} from '@/services/assistenteIa'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'
import { toast } from 'sonner'

export interface AssistenteSecaoDrawerProps {
  agentSlug: CrmAgentSlug
  titulo: string
  subtitulo?: string
  secaoNome?: string
  sugestoes?: string[]
  placeholder?: string
  descricaoModo?: string
  areaPermissao?:
    | 'painel'
    | 'funil'
    | 'clientes'
    | 'projetos'
    | 'processos'
    | 'financeiro'
    | 'documentos'
  contextRecord?: AgentContextRecord | null
  isOpen?: boolean
  onClose?: () => void
  showFloatingButton?: boolean
  floatingButtonLabel?: string
  floatingBottomClass?: string
}

export function AssistenteSecaoDrawer({
  agentSlug,
  titulo,
  subtitulo = 'Consulta de dados em tempo real • Modo Leitura',
  secaoNome,
  sugestoes = [],
  placeholder = 'Faça uma pergunta sobre esta seção...',
  descricaoModo = 'consulta registros em tempo real sem alterar nem excluir dados.',
  areaPermissao,
  contextRecord,
  isOpen,
  onClose,
  showFloatingButton = true,
  floatingButtonLabel,
  floatingBottomClass = 'bottom-6 right-6',
}: AssistenteSecaoDrawerProps) {
  const { user } = useAuth()
  const role = user?.role || 'comercial'

  // Regra mínima de autorização:
  // Se for especificada área de permissão, respeita canAccess da sidebar.
  // Terceiros nunca têm acesso a assistentes internos.
  const isAutorizado = Boolean(
    user && role !== 'terceiro' && (!areaPermissao || canAccess(role, areaPermissao)),
  )

  const [aberto, setAberto] = useState(isOpen ?? false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [, setConversations] = useState<AgentConversationItem[]>([])
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isOpen !== undefined) {
      setAberto(isOpen)
    }
  }, [isOpen])

  // Rola para o final da conversa
  useEffect(() => {
    if (aberto) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, aberto, activeTool])

  // Carrega histórico de conversas do usuário com este agente ao abrir
  useEffect(() => {
    if (!aberto || !isAutorizado) return

    listAgentConversations(agentSlug)
      .then((convs) => {
        setConversations(convs)
        if (convs.length > 0 && !conversationId) {
          const first = convs[0]
          setConversationId(first.id)
          loadConversationMessages(first.id, agentSlug)
            .then((msgs) => setMessages(msgs))
            .catch((err) => console.warn(`Erro ao carregar mensagens do agente ${agentSlug}:`, err))
        }
      })
      .catch((err) => console.warn(`Erro ao listar conversas do agente ${agentSlug}:`, err))
  }, [aberto, isAutorizado, agentSlug, conversationId])

  if (!isAutorizado) {
    return null
  }

  function handleFechar() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Drawer fechado pelo usuário')
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setActiveTool(null)
    setAberto(false)
    onClose?.()
  }

  function handleLimparConversa() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Conversa limpa pelo usuário')
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setActiveTool(null)
    setConversationId(null)
    setMessages([])
    toast.info(`Nova conversa iniciada com o ${titulo}.`)
  }

  async function handleEnviarMensagem(texto?: string) {
    const msgToSend = (texto || inputMessage).trim()
    if (!msgToSend || isLoading) return

    setInputMessage('')

    // Mensagem do usuário na UI (garantindo campo created no padrão ISO)
    const agora = new Date().toISOString()
    const userMsg: DisplayMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: msgToSend,
      created: agora,
    }

    const assistantMsgId = `ast_${Date.now()}`
    const assistantMsgPlaceholder: DisplayMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      created: agora,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder])
    setIsLoading(true)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Nova mensagem enviada pelo usuário')
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let acumulado = ''

      const res = await sendAgentMessage({
        message: msgToSend,
        conversationId,
        agentSlug,
        timeoutMs: 45000,
        contextRecord: contextRecord || {
          tipo: 'projeto',
          id: secaoNome || agentSlug,
          titulo: `${titulo} - Seção ${secaoNome || 'Geral'}`,
          dados: {
            secao_ativa: secaoNome || agentSlug,
            usuario: user?.name,
            empresa: 'AEROCAD CONSULTORIA',
            data_consulta: new Date().toISOString(),
          },
        },
        onChunk: (delta) => {
          acumulado += delta
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: acumulado } : m)),
          )
        },
        onToolCallStart: (info) => {
          setActiveTool(`Consultando registros em "${info.name}"...`)
        },
        onToolCallDone: () => {
          setActiveTool(null)
        },
        onCitations: (citations: AgentCitation[]) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, citations } : m)),
          )
        },
        signal: abortController.signal,
      })

      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId)
        listAgentConversations(agentSlug)
          .then((c) => setConversations(c))
          .catch(() => {})
      }
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
      const isTimeout =
        err instanceof Error &&
        (err.message.includes('Tempo limite') || err.message.includes('timeout'))

      if (isAbort && !isTimeout) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId && !m.content
              ? { ...m, content: 'Operação interrompida pelo usuário.' }
              : m,
          ),
        )
        return
      }

      const msgErr = err instanceof Error ? err.message : String(err)
      const mensagemAmigavel = isTimeout
        ? 'Não foi possível processar. O assistente atingiu o tempo limite. Tente reformular o pedido com critérios mais específicos.'
        : 'Não foi possível processar a consulta no momento. Tente reformular a pergunta.'

      toast.error(isTimeout ? 'Tempo limite excedido' : `Falha no ${titulo}: ${msgErr}`)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: m.content ? `${m.content}\n\n⚠️ ${mensagemAmigavel}` : mensagemAmigavel,
              }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      setActiveTool(null)
      abortControllerRef.current = null
    }
  }

  const labelBotao = floatingButtonLabel || titulo

  return (
    <>
      {/* Botão de disparo flutuante discreto com identidade AEROCAD #FF6A13 */}
      {showFloatingButton && !aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`fixed ${floatingBottomClass} z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg bg-[#FF6A13] hover:bg-[#e05b0d] text-white font-medium text-xs tracking-wide transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#FF6A13] focus:ring-offset-2`}
          title={`Abrir ${titulo}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{labelBotao}</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </button>
      )}

      {/* Painel lateral Drawer do Chat */}
      {aberto && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white shadow-2xl border-l border-neutral-200 flex flex-col font-sans animate-in slide-in-from-right duration-200">
          {/* Cabeçalho */}
          <div className="bg-[#FF6A13] text-white p-4 flex items-center justify-between border-b border-[#e05b0d]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/20 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                  {titulo}
                  <Badge className="bg-white/20 text-white text-[10px] font-normal border-0 hover:bg-white/25">
                    AEROCAD
                  </Badge>
                </h3>
                <p className="text-[11px] text-white/80">{subtitulo}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLimparConversa}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="Limpar conversa / Nova sessão"
              >
                <Trash2 className="w-4 h-4" />
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

          {/* Aviso Onboarding de Modo Leitura */}
          <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 text-[11px] text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Assistente de Leitura:</strong> {descricaoModo}
            </span>
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
                    Como posso ajudar em {secaoNome || titulo}?
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Faça perguntas objetivas sobre dados reais, prazos, registros e status.
                  </p>
                </div>

                {/* Sugestões de perguntas rápidas */}
                {sugestoes.length > 0 && (
                  <div className="text-left pt-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-neutral-500 px-1 uppercase tracking-wider">
                      Perguntas sugeridas:
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
                )}
              </div>
            ) : (
              <div className="space-y-3 pb-2">
                {messages.map((m) => {
                  const isUser = m.role === 'user'
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
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
                        {m.content || (
                          <span className="flex items-center gap-1.5 text-neutral-500 italic">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analisando registros do sistema...
                          </span>
                        )}
                      </div>
                      {isUser && (
                        <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
                          <UserIcon className="w-4 h-4" />
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
                placeholder={placeholder}
                className="min-h-[64px] max-h-28 text-xs resize-none bg-white focus-visible:ring-[#FF6A13]"
                disabled={isLoading}
              />
              {isLoading ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort('Cancelado pelo usuário')
                      abortControllerRef.current = null
                    }
                    setIsLoading(false)
                    setActiveTool(null)
                    toast.info('Processamento cancelado.')
                  }}
                  className="h-11 px-3 border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0 text-xs flex items-center gap-1.5"
                  title="Interromper processamento atual"
                >
                  <X className="w-4 h-4 text-orange-600" />
                  <span>Parar</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="h-11 px-3.5 bg-[#FF6A13] hover:bg-[#e05b0d] text-white shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
              <span>Enter envia • Shift+Enter quebra linha</span>
              <span>Modo consulta • CRM AEROCAD</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
