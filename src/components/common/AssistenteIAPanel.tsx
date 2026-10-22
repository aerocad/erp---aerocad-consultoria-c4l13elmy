import { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Send,
  Sparkles,
  Copy,
  Check,
  FileText,
  FileUp,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  listarConversasPersistidas,
  carregarConversaPersistida,
  excluirConversaPersistida,
  enviarMensagemPersistidaBackground,
  type ConversaPersistidaRecord,
} from '@/services/assistenteConversasService'
import { type AgentContextRecord } from '@/services/assistenteIa'
import { Trash2, AlertTriangle } from 'lucide-react'
import { uploadAnexo } from '@/services/anexos'
import { createOne } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { formatDocumentFileName } from '@/lib/documentCatalogo'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'

export interface AssistenteIAPanelProps {
  contextRecord?: AgentContextRecord | null
  quickPrompts?: string[]
  onDocumentCreated?: () => void
  className?: string
  defaultOpenHistory?: boolean
}

interface ToolStatus {
  id: string
  name: string
  status: 'running' | 'done'
}

export function AssistenteIAPanel({
  contextRecord,
  quickPrompts,
  onDocumentCreated,
  className = '',
}: AssistenteIAPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversaPersistidaRecord[]>([])
  const [conversaParaExcluir, setConversaParaExcluir] = useState<ConversaPersistidaRecord | null>(
    null,
  )
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([])
  const [streamedAssistantText, setStreamedAssistantText] = useState('')
  const [citations, setCitations] = useState<AgentCitation[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Modal para salvar como anexo ou documento oficial
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [savingTargetText, setSavingTargetText] = useState('')
  const [saveAsType, setSaveAsType] = useState<'anexo' | 'documento'>('documento')
  const [docTitle, setDocTitle] = useState('')
  const [docCategory, setDocCategory] = useState<string>('memorial')
  const [docPrefix, setDocPrefix] = useState<string>('MD')
  const [isSaving, setIsSaving] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamedAssistantText, activeTools])

  // Carregar conversas anteriores do usuário
  const reloadConversations = async () => {
    try {
      const list = await listarConversasPersistidas('assistente-aerocad')
      setConversations(list)
      return list
    } catch {
      return []
    }
  }

  useEffect(() => {
    void reloadConversations().then((list) => {
      if (list && list.length > 0 && !currentConversationId) {
        const primeira = list[0]
        setCurrentConversationId(primeira.id)
        setMessages(primeira.mensagens || [])
        if (primeira.status_processamento === 'processando') {
          setIsSending(true)
        }
      }
    })
  }, [])

  // Trocar de conversa
  const handleSelectConversation = async (convId: string) => {
    if (convId === 'nova') {
      handleStartNewChat()
      return
    }
    try {
      setIsSending(true)
      const conv = await carregarConversaPersistida(convId)
      if (conv) {
        setMessages(conv.mensagens || [])
        setCurrentConversationId(conv.id)
        setIsSending(conv.status_processamento === 'processando')
      }
      setStreamedAssistantText('')
      setActiveTools([])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar histórico'
      toast.error(msg)
    } finally {
      setIsSending(false)
    }
  }

  const handleStartNewChat = () => {
    setMessages([])
    setCurrentConversationId(null)
    setStreamedAssistantText('')
    setActiveTools([])
    setCitations([])
    setIsSending(false)
    toast.info('Nova conversa limpa iniciada.')
  }

  const handleConfirmarExclusaoConversa = async () => {
    if (!conversaParaExcluir) return
    const idExcluir = conversaParaExcluir.id
    try {
      await excluirConversaPersistida(idExcluir)
      toast.success('Conversa excluída com sucesso.')
      setConversaParaExcluir(null)
      const atualizadas = await reloadConversations()
      if (currentConversationId === idExcluir) {
        if (atualizadas && atualizadas.length > 0) {
          await handleSelectConversation(atualizadas[0].id)
        } else {
          handleStartNewChat()
        }
      }
    } catch (err: unknown) {
      toast.error(`Falha ao excluir conversa: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const raw = (textToSend ?? inputText).trim()
    if (!raw || isSending) return

    setInputText('')
    setIsSending(true)
    setStreamedAssistantText('')
    setActiveTools([])
    setCitations([])

    try {
      const { conversaId } = await enviarMensagemPersistidaBackground({
        conversaId: currentConversationId,
        agentSlug: 'assistente-aerocad',
        contexto: contextRecord?.tipo || 'geral',
        titulo: raw.slice(0, 48),
        userText: raw,
        contextRecord: contextRecord || null,
        onChunk: (_delta, full) => {
          setStreamedAssistantText(full)
        },
        onToolCallStart: (info) => {
          setActiveTools((prev) => [
            ...prev.filter((t) => t.id !== info.id),
            { id: info.id, name: info.name, status: 'running' },
          ])
        },
        onToolCallDone: (info) => {
          setActiveTools((prev) =>
            prev.map((t) => (t.id === info.id ? { ...t, status: 'done' } : t)),
          )
        },
        onFinalizado: (convAtualizada) => {
          setCurrentConversationId(convAtualizada.id)
          setMessages(convAtualizada.mensagens || [])
          setStreamedAssistantText('')
          setIsSending(false)
          setActiveTools([])
          void reloadConversations()
        },
        onError: (err) => {
          setIsSending(false)
          setActiveTools([])
          const errorText =
            err instanceof Error ? err.message : 'Erro ao processar resposta com o Assistente IA'
          toast.error(errorText)
        },
      })

      if (!currentConversationId) {
        setCurrentConversationId(conversaId)
        void reloadConversations()
      }
    } catch (err: unknown) {
      setIsSending(false)
      const errorText =
        err instanceof Error ? err.message : 'Erro ao enviar mensagem para o Assistente IA'
      toast.error(errorText)
    }
  }

  const copyToClipboard = (text: string, index: number) => {
    void navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    toast.success('Texto copiado com sucesso!')
    setTimeout(() => setCopiedIndex(null), 2500)
  }

  const openSaveDialog = (text: string) => {
    setSavingTargetText(text)
    const clientName = (contextRecord?.dados?.razao_social as string) || 'CLIENTE'
    const suggestedTitle = contextRecord
      ? `${docPrefix} — ${contextRecord.tipo.toUpperCase()} ${contextRecord.titulo}`
      : `${docPrefix} — Documento AEROCAD`
    setDocTitle(suggestedTitle)
    setSaveModalOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!savingTargetText.trim() || !user) return
    setIsSaving(true)

    try {
      const fileName = formatDocumentFileName({
        prefixo: docPrefix,
        numero: (contextRecord?.dados?.numero as string) || '001',
        cliente: (contextRecord?.dados?.razao_social as string) || 'CLIENTE',
        escopo: docCategory,
      })

      if (saveAsType === 'documento') {
        // Salvar na coleção 'documentos'
        await createOne('documentos', {
          nome: docTitle || fileName,
          tipo: docCategory,
          conteudo: savingTargetText,
          status: 'rascunho',
          versao: 'REV001',
          gerado_de_template: false,
          cliente:
            contextRecord?.tipo === 'cliente'
              ? contextRecord.id
              : contextRecord?.dados?.cliente || '',
          projeto:
            contextRecord?.tipo === 'projeto'
              ? contextRecord.id
              : contextRecord?.dados?.projeto || '',
          processo: contextRecord?.tipo === 'processo' ? contextRecord.id : '',
        })
        toast.success('Documento registrado com sucesso no repositório do CRM!')
      } else {
        // Salvar como anexo TXT/Markdown na coleção 'anexos'
        const blob = new Blob([savingTargetText], { type: 'text/markdown;charset=utf-8' })
        const file = new File([blob], `${fileName}.md`, { type: 'text/markdown' })

        await uploadAnexo(file, {
          nome: docTitle || `${fileName}.md`,
          descricao: `Gerado via Assistente IA AEROCAD para ${contextRecord?.titulo || 'registro'}`,
          categoria: 'laudo_relatorio',
          usuarioId: user.id,
          clienteId:
            contextRecord?.tipo === 'cliente'
              ? contextRecord.id
              : (contextRecord?.dados?.cliente as string),
          projetoId:
            contextRecord?.tipo === 'projeto'
              ? contextRecord.id
              : (contextRecord?.dados?.projeto as string),
          processoId: contextRecord?.tipo === 'processo' ? contextRecord.id : undefined,
          oportunidadeId: contextRecord?.tipo === 'oportunidade' ? contextRecord.id : undefined,
        })
        toast.success('Arquivo anexado com sucesso ao registro!')
      }

      setSaveModalOpen(false)
      onDocumentCreated?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar no CRM'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Prompts rápidos padrão baseados no contexto
  const defaultQuickPrompts = quickPrompts || [
    'Gere a minuta do memorial descritivo considerando a aeronave crítica deste registro.',
    'Adapte a Proposta Comercial (PC) destacando as 2 opções de contratação (por etapas vs. integrada).',
    'Reescreva a seção de prazos e cronograma segregando o prazo AEROCAD do prazo discricionário dos órgãos.',
    'Elabore uma Nota Técnica fundamentada na ICA 11-408 / RBAC 154 sobre a viabilidade deste caso.',
  ]

  return (
    <div
      className={`flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden ${className}`}
    >
      {/* Cabeçalho do Assistente IA */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#FFF6EC] via-white to-[#FFF6EC] border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6A13] text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#333]">Assistente IA Nativo AEROCAD</h3>
              <span className="inline-flex items-center gap-1 rounded bg-[#FFEDD9] px-2 py-0.5 text-[10px] font-bold text-[#D65100]">
                <Sparkles className="h-3 w-3" /> Skip Cloud Agent
              </span>
            </div>
            <p className="text-xs text-[#737373]">
              Geração e adaptação de minutas completas com rigor normativo aeronáutico
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={currentConversationId || 'nova'} onValueChange={handleSelectConversation}>
            <SelectTrigger className="h-8 text-xs w-[200px] bg-white border-neutral-300">
              <SelectValue placeholder="Histórico de chats..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nova" className="text-xs font-semibold text-[#FF6A13]">
                + Novo Chat Limpo
              </SelectItem>
              {conversations.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.titulo || `Conversa de ${new Date(c.created).toLocaleDateString('pt-BR')}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentConversationId && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const encontrada = conversations.find((c) => c.id === currentConversationId)
                if (encontrada) setConversaParaExcluir(encontrada)
              }}
              className="h-8 w-8 text-neutral-500 hover:text-red-600 hover:bg-red-50"
              title="Excluir este chat definitivamente"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleStartNewChat}
            className="h-8 text-xs border-orange-200 hover:bg-orange-50 text-[#FF6A13]"
            title="Iniciar nova conversa limpa"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Novo Chat
          </Button>
        </div>
      </div>

      {/* Faixa de Contexto do Registro Selecionado */}
      {contextRecord && (
        <div className="flex items-center justify-between px-4 py-2 bg-orange-50/60 border-b text-xs text-[#595959]">
          <div className="flex items-center gap-2 truncate">
            <Layers className="h-4 w-4 text-[#FF6A13] shrink-0" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-[#D65100]">
              {contextRecord.tipo}:
            </span>
            <span className="font-bold text-[#333] truncate">{contextRecord.titulo}</span>
            {contextRecord.subtitulo && (
              <span className="text-[#888] truncate">({contextRecord.subtitulo})</span>
            )}
          </div>
          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-orange-200 text-[#777]">
            ID: {contextRecord.id}
          </span>
        </div>
      )}

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[380px] max-h-[580px] bg-[#FAF8F5]">
        {messages.length === 0 && !streamedAssistantText && (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-[#FF6A13] mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-[#333]">Como posso ajudar hoje?</h4>
            <p className="mt-1 text-xs text-[#737373] max-w-md mx-auto">
              O assistente acessa diretamente as coleções do CRM, cataloga regras da ICA 11-408,
              RBAC 154/155 e redige memoriais, propostas com 2 opções, contratos e aditivos no
              padrão AEROCAD®.
            </p>

            {/* Atalhos Rápidos */}
            <div className="mt-5 grid gap-2 text-left max-w-xl mx-auto">
              <p className="text-[11px] font-bold text-[#999] uppercase tracking-wider">
                Sugestões rápidas de comando:
              </p>
              {defaultQuickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => void handleSend(prompt)}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-white hover:border-[#FF6A13] hover:bg-orange-50/50 text-xs text-[#444] transition-all group shadow-sm text-left"
                >
                  <span className="pr-2">{prompt}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#999] group-hover:text-[#FF6A13] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens Históricas */}
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id || index}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-bold text-[#777]">
                  {isUser ? 'Você' : 'Assistente Técnico AEROCAD'}
                </span>
                <span className="text-[10px] text-[#AAA]">
                  {new Date(msg.created).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`rounded-xl p-4 text-xs leading-relaxed max-w-[92%] sm:max-w-[85%] shadow-sm ${
                  isUser
                    ? 'bg-[#FF6A13] text-white rounded-tr-none'
                    : 'bg-white border text-[#333] rounded-tl-none prose prose-xs max-w-none'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* Citações da base de conhecimento */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-[#888] flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Fontes normativas:
                    </span>
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-mono text-[#666]"
                        title={c.excerpt}
                      >
                        Norma [{c.n}]
                      </span>
                    ))}
                  </div>
                )}

                {/* Ações para a resposta do Assistente */}
                {!isUser && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(msg.content, index)}
                      className="h-7 px-2 text-[11px] text-[#666] hover:text-[#FF6A13]"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSaveDialog(msg.content)}
                      className="h-7 px-2 text-[11px] border-[#FF6A13] text-[#FF6A13] hover:bg-orange-50"
                    >
                      <FileUp className="mr-1 h-3.5 w-3.5" /> Salvar no Registro
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Indicadores de Ferramentas em Execução */}
        {activeTools.length > 0 && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-orange-50/70 border border-orange-200 text-xs text-[#D65100]">
            <p className="font-semibold flex items-center gap-1.5 text-[11px]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Consultando dados reais do CRM via ferramentas nativas:
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {activeTools.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-mono border border-orange-200"
                >
                  {t.status === 'running' ? (
                    <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  )}
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stream em Tempo Real */}
        {streamedAssistantText && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[11px] font-bold text-[#FF6A13] animate-pulse">
                Assistente redigindo...
              </span>
            </div>
            <div className="rounded-xl rounded-tl-none p-4 text-xs leading-relaxed max-w-[92%] sm:max-w-[85%] bg-white border border-orange-200 shadow-sm text-[#333]">
              <div className="whitespace-pre-wrap font-sans">{streamedAssistantText}</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada e Envio */}
      <div className="p-3 bg-white border-t">
        <div className="relative">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Peça minutas, memoriais descritivos, adaptação de cláusulas ou justificativas técnicas..."
            className="min-h-[72px] pr-20 text-xs resize-none focus-visible:ring-[#FF6A13]"
            disabled={isSending}
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {isSending ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => abortControllerRef.current?.abort()}
                className="h-8 text-xs"
              >
                Parar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void handleSend()}
                disabled={!inputText.trim()}
                className="h-8 bg-[#FF6A13] hover:bg-[#E85B06] text-white"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[#999] flex items-center justify-between">
          <span>Pressione Enter para enviar, Shift+Enter para quebra de linha.</span>
          <span>Modelo de referência: Zurich · Alcoa · Maragogi · Bruna Rodrigues</span>
        </p>
      </div>

      {/* Modal para Salvar Documento / Anexo no CRM */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-[#333]">
              <FileUp className="h-5 w-5 text-[#FF6A13]" />
              Salvar Texto no Registro do CRM
            </DialogTitle>
            <DialogDescription className="text-xs">
              Grave o texto produzido pelo assistente no repositório de documentos oficiais ou como
              arquivo anexo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Destino no CRM</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSaveAsType('documento')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 ${
                    saveAsType === 'documento'
                      ? 'border-[#FF6A13] bg-orange-50 font-bold text-[#D65100]'
                      : 'border-gray-200 text-[#555]'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Documento Oficial</p>
                    <p className="text-[10px] text-[#888]">Editor / Minuta formal</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveAsType('anexo')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 ${
                    saveAsType === 'anexo'
                      ? 'border-[#FF6A13] bg-orange-50 font-bold text-[#D65100]'
                      : 'border-gray-200 text-[#555]'
                  }`}
                >
                  <FileUp className="h-4 w-4" />
                  <div>
                    <p className="text-xs">Arquivo Anexo (.md)</p>
                    <p className="text-[10px] text-[#888]">Repositório de anexos</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Prefixo Oficial</Label>
                <Select value={docPrefix} onValueChange={setDocPrefix}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MD">MD (Memorial)</SelectItem>
                    <SelectItem value="PC">PC (Proposta Com.)</SelectItem>
                    <SelectItem value="PT">PT (Proposta Téc.)</SelectItem>
                    <SelectItem value="NT">NT (Nota Técnica)</SelectItem>
                    <SelectItem value="LT">LT (Laudo Técnico)</SelectItem>
                    <SelectItem value="EVA">EVA (Viabilidade)</SelectItem>
                    <SelectItem value="CT">CT (Contrato)</SelectItem>
                    <SelectItem value="OS">OS (Ordem Serviço)</SelectItem>
                    <SelectItem value="RQ">RQ (Requerimento)</SelectItem>
                    <SelectItem value="RG">RG (Relatório)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="memorial">Memorial Descritivo / Cálculo</SelectItem>
                    <SelectItem value="proposta">Proposta Comercial</SelectItem>
                    <SelectItem value="proposta_tecnica">Proposta Técnica</SelectItem>
                    <SelectItem value="nota_tecnica">Nota Técnica</SelectItem>
                    <SelectItem value="laudo">Laudo Pericial</SelectItem>
                    <SelectItem value="estudo_viabilidade">Estudo de Viabilidade</SelectItem>
                    <SelectItem value="contrato">Contrato de Serviços</SelectItem>
                    <SelectItem value="ordem_servico">Ordem de Serviço</SelectItem>
                    <SelectItem value="relatorio_gerencial">Relatório Gerencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Título do Documento</Label>
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder="Ex: MD — Memorial Descritivo Superfícies OLS"
              />
            </div>

            <div className="rounded bg-gray-50 p-2 text-[11px] text-[#666]">
              <strong>Registro vinculado:</strong>{' '}
              {contextRecord
                ? `${contextRecord.tipo.toUpperCase()}: ${contextRecord.titulo}`
                : 'Geral'}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
              disabled={isSaving}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSave}
              disabled={isSaving || !docTitle.trim()}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
            >
              {isSaving ? 'Gravando...' : 'Confirmar e Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Tem certeza que deseja excluir o histórico da conversa{' '}
              <strong>"{conversaParaExcluir?.titulo || 'esta conversa'}"</strong>?
              <br />
              O registro será removido definitivamente do banco de dados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConversaParaExcluir(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmarExclusaoConversa}
              className="text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
