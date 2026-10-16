import { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  Trash2,
  X,
  Bot,
  User as UserIcon,
  Loader2,
  Info,
  ChevronDown,
  RefreshCw,
  Coins,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import {
  sendAgentMessage,
  listAgentConversations,
  loadConversationMessages,
  type AgentConversationItem,
} from '@/services/assistenteIa'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'
import { toast } from 'sonner'

export interface AssistenteFinanceiroChatProps {
  secaoAtual: 'extratos' | 'fluxo' | 'demonstracoes' | 'balancos' | 'ativos' | 'relatorios'
  isOpen?: boolean
  onClose?: () => void
}

const SUGESTOES_POR_SECAO: Record<string, string[]> = {
  extratos: [
    'Quais transações bancárias ainda estão pendentes de conciliação?',
    'Quanto entrou na conta do Banco Inter este mês?',
    'Existem lançamentos de tarifas bancárias nos últimos 30 dias?',
  ],
  fluxo: [
    'Qual o saldo previsto para os próximos 15 dias no fluxo de caixa?',
    'Quais as maiores contas a pagar com vencimento esta semana?',
    'Quanto temos a receber previsto para este mês?',
  ],
  demonstracoes: [
    'Qual o resultado operacional líquido acumulado do exercício?',
    'Como está a divisão entre receitas de consultoria e despesas?',
    'Resuma os principais indicadores da DRE do período atual.',
  ],
  balancos: [
    'Qual o total do Ativo Circulante vs Passivo Circulante?',
    'Qual a composição do patrimônio líquido da empresa?',
    'Como está o equilíbrio financeiro do balancete atual?',
  ],
  ativos: [
    'Quais são os principais bens e veículos cadastrados no patrimônio?',
    'Qual o valor total de aquisição dos ativos imobilizados?',
    'Existe cálculo de depreciação acumulada para os veículos?',
  ],
  relatorios: [
    'Qual o faturamento total acumulado no ano?',
    'Quais clientes possuem maior saldo pendente de faturamento?',
    'Resuma a rentabilidade geral das operações.',
  ],
}

export function AssistenteFinanceiroChatDrawer({
  secaoAtual,
  isOpen,
  onClose,
}: AssistenteFinanceiroChatProps) {
  const { user } = useAuth()
  const { podeVerValores } = useFinanceiroVisibilidade()

  // Restrição de perfis: apenas admin ou financeiro com permissão de valores
  const isAutorizado = (user?.role === 'admin' || user?.role === 'financeiro') && podeVerValores

  const [aberto, setAberto] = useState(isOpen ?? false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<AgentConversationItem[]>([])
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

  // Carrega histórico de conversas do usuário ao abrir
  useEffect(() => {
    if (!aberto || !isAutorizado) return

    listAgentConversations('assistente-financeiro')
      .then((convs) => {
        setConversations(convs)
        if (convs.length > 0 && !conversationId) {
          const first = convs[0]
          setConversationId(first.id)
          loadConversationMessages(first.id, 'assistente-financeiro')
            .then((msgs) => setMessages(msgs))
            .catch((err) => console.warn('Erro ao carregar mensagens:', err))
        }
      })
      .catch((err) => console.warn('Erro ao listar conversas financeiras:', err))
  }, [aberto, isAutorizado])

  if (!isAutorizado) {
    return null
  }

  function handleFechar() {
    setAberto(false)
    onClose?.()
  }

  function handleLimparConversa() {
    setConversationId(null)
    setMessages([])
    toast.info('Nova conversa iniciada com o Assistente Financeiro.')
  }

  async function handleEnviarMensagem(texto?: string) {
    const msgToSend = (texto || inputMessage).trim()
    if (!msgToSend || isLoading) return

    setInputMessage('')

    // Mensagem do usuário na UI
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

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let acumulado = ''

      const res = await sendAgentMessage({
        message: msgToSend,
        conversationId,
        agentSlug: 'assistente-financeiro',
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
        listAgentConversations('assistente-financeiro')
          .then((c) => setConversations(c))
          .catch(() => {})
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msgErr = err instanceof Error ? err.message : String(err)
      toast.error(`Falha no Assistente Financeiro: ${msgErr}`)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content:
                  'Ocorreu uma instabilidade momentânea ao consultar os dados financeiros. Por favor, tente novamente.',
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

  const sugestoes = SUGESTOES_POR_SECAO[secaoAtual] || SUGESTOES_POR_SECAO.extratos

  return (
    <>
      {/* Botão de disparo flutuante discreto com identidade AEROCAD #FF6A13 */}
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
                  Assistente Financeiro
                  <Badge className="bg-white/20 text-white text-[10px] font-normal border-0 hover:bg-white/25">
                    AEROCAD
                  </Badge>
                </h3>
                <p className="text-[11px] text-white/80">Consulta de dados reais • Modo Leitura</p>
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
              <strong>Assistente de Leitura:</strong> consulta contas, extratos e demonstrativos em
              tempo real sem alterar ou excluir nenhum registro.
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
                    Como posso ajudar no financeiro hoje?
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Faça perguntas sobre transações, extratos, contas a pagar, recebíveis ou
                    indicadores contábeis.
                  </p>
                </div>

                {/* Sugestões de perguntas rápidas baseadas na seção atual */}
                <div className="text-left pt-2 space-y-1.5">
                  <p className="text-[11px] font-semibold text-neutral-500 px-1 uppercase tracking-wider">
                    Perguntas frequentes ({secaoAtual}):
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
                            Analisando dados do financeiro...
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
                placeholder="Pergunte sobre saldos, contas a pagar, boletos ou extratos..."
                className="min-h-[64px] max-h-28 text-xs resize-none bg-white focus-visible:ring-[#FF6A13]"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
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
              <span>Acesso restrito: Administrador e Financeiro</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
