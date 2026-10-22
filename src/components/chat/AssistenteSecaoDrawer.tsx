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
  History,
  Plus,
  AlertTriangle,
} from 'lucide-react'
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
import { canAccess } from '@/lib/crm'
import {
  listarConversasPersistidas,
  carregarConversaPersistida,
  excluirConversaPersistida,
  enviarMensagemPersistidaBackground,
  type ConversaPersistidaRecord,
} from '@/services/assistenteConversasService'
import type { CrmAgentSlug, AgentContextRecord } from '@/services/assistenteIa'
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

  // Regra mínima de autorização:
  // Se for especificada área de permissão, respeita canAccess da sidebar (união de perfis).
  // Se o usuário tiver APENAS o perfil 'terceiro', não tem acesso a assistentes internos.
  const isOnlyTerceiro = user?.role === 'terceiro' && (!user?.roles || user.roles.length <= 1)
  const isAutorizado = Boolean(
    user && !isOnlyTerceiro && (!areaPermissao || canAccess(user, areaPermissao)),
  )

  const [aberto, setAberto] = useState(isOpen ?? false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [listaConversas, setListaConversas] = useState<ConversaPersistidaRecord[]>([])
  const [conversaParaExcluir, setConversaParaExcluir] = useState<ConversaPersistidaRecord | null>(
    null,
  )
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  const recarregarHistorico = async () => {
    if (!isAutorizado) return []
    const convs = await listarConversasPersistidas(agentSlug)
    setListaConversas(convs)
    return convs
  }

  // Carrega histórico de conversas do usuário com este agente ao abrir
  useEffect(() => {
    if (!aberto || !isAutorizado) return

    void recarregarHistorico().then((convs) => {
      if (convs && convs.length > 0 && !conversationId) {
        const primeira = convs[0]
        setConversationId(primeira.id)
        setMessages(primeira.mensagens || [])
        if (primeira.status_processamento === 'processando') {
          setIsLoading(true)
        }
      }
    })
  }, [aberto, isAutorizado, agentSlug])

  if (!isAutorizado) {
    return null
  }

  function handleFechar() {
    setAberto(false)
    onClose?.()
  }

  async function handleSelecionarConversa(convId: string) {
    if (convId === 'nova') {
      handleIniciarNovaConversa()
      return
    }
    const conv = await carregarConversaPersistida(convId)
    if (conv) {
      setConversationId(conv.id)
      setMessages(conv.mensagens || [])
      setIsLoading(conv.status_processamento === 'processando')
    }
  }

  function handleIniciarNovaConversa() {
    setConversationId(null)
    setMessages([])
    setIsLoading(false)
    setActiveTool(null)
    toast.info(`Nova conversa iniciada com o ${titulo}.`)
  }

  async function handleConfirmarExclusao() {
    if (!conversaParaExcluir) return
    const idExcluir = conversaParaExcluir.id
    try {
      await excluirConversaPersistida(idExcluir)
      toast.success('Conversa excluída com sucesso.')
      setConversaParaExcluir(null)
      const atualizadas = await recarregarHistorico()
      if (conversationId === idExcluir) {
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

    try {
      const { conversaId: cid } = await enviarMensagemPersistidaBackground({
        conversaId: conversationId,
        agentSlug,
        contexto: secaoNome || agentSlug,
        titulo: msgToSend.slice(0, 48),
        userText: msgToSend,
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
          setActiveTool(`Consultando registros em "${info.name}"...`)
        },
        onToolCallDone: () => {
          setActiveTool(null)
        },
        onFinalizado: (convAtualizada) => {
          setConversationId(convAtualizada.id)
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

      if (!conversationId) {
        setConversationId(cid)
        void recarregarHistorico()
      }
    } catch (err: unknown) {
      setIsLoading(false)
      setActiveTool(null)
      toast.error(`Erro ao enviar mensagem: ${err instanceof Error ? err.message : String(err)}`)
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

          {/* Barra de Histórico Persistido com Exclusão Manual */}
          <div className="bg-neutral-100 border-b border-neutral-200 px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <History className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <Select
                value={conversationId || 'nova'}
                onValueChange={(val) => handleSelecionarConversa(val)}
              >
                <SelectTrigger className="h-7 text-xs bg-white border-neutral-300 w-full max-w-[270px]">
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

            {conversationId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const encontrada = listaConversas.find((c) => c.id === conversationId)
                  if (encontrada) setConversaParaExcluir(encontrada)
                }}
                className="h-7 w-7 text-neutral-500 hover:text-red-600 hover:bg-red-50"
                title="Excluir esta conversa definitivamente"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
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
              <span>Registro permanente até exclusão manual</span>
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
              O histórico será removido definitivamente do banco de dados.
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
