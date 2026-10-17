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
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  Filter,
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
  obterPreviaBloco,
  executarOperacaoBloco,
  desfazerUltimaOperacaoBloco,
  type AgentConversationItem,
  type PropostaBlocoData,
} from '@/services/assistenteIa'
import type { DisplayMessage, AgentCitation } from '@/lib/skipAi'
import { toast } from 'sonner'

export interface AssistenteFinanceiroChatProps {
  secaoAtual: 'extratos' | 'fluxo' | 'demonstracoes' | 'balancos' | 'ativos' | 'relatorios'
  isOpen?: boolean
  onClose?: () => void
  onAcaoExecutada?: () => void
}

const SUGESTOES_POR_SECAO: Record<string, string[]> = {
  extratos: [
    'Reclassificar todos os lançamentos com "tarifa" para despesas operacionais',
    'Marcar transações bancárias com "aplicacao" como ignoradas para conciliação',
    'Quais transações bancárias ainda estão pendentes de conciliação?',
    'Quanto entrou na conta do Banco Inter este mês?',
  ],
  fluxo: [
    'Reclassificar todos os lançamentos de combustível para a conta 3.1.5',
    'Atribuir a conta Banco Inter PJ às contas a pagar sem conta bancária',
    'Quais as maiores contas a pagar com vencimento esta semana?',
    'Qual o saldo previsto para os próximos 15 dias no fluxo de caixa?',
  ],
  demonstracoes: [
    'Atualizar o plano de contas de despesas com cartório para 3.1.1',
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

// Interface de estado da proposta no chat
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

// Extrai proposta JSON delimitada por ```proposta_bloco ... ``` ou ```json ... ```
function extrairPropostaBloco(texto: string): {
  textoLimpo: string
  proposta: PropostaBlocoData | null
} {
  if (!texto) return { textoLimpo: '', proposta: null }

  // Tenta achar ```proposta_bloco
  const matchBloco = texto.match(/```(?:proposta_bloco|json)?\s*([\s\S]*?)\s*```/)
  if (matchBloco) {
    try {
      const parsed = JSON.parse(matchBloco[1])
      if (parsed && parsed.tipo_operacao && parsed.colecao_alvo && parsed.alteracoes) {
        const textoLimpo = texto.replace(matchBloco[0], '').trim()
        return { textoLimpo, proposta: parsed as PropostaBlocoData }
      }
    } catch (_) {
      // Ignora erro de JSON incompleto enquanto digita no stream
    }
  }

  return { textoLimpo: texto, proposta: null }
}

export function AssistenteFinanceiroChatDrawer({
  secaoAtual,
  isOpen,
  onClose,
  onAcaoExecutada,
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

  // Controle de propostas de escrita em bloco por ID da mensagem do assistente
  const [propostasPorMensagem, setPropostasPorMensagem] = useState<
    Record<string, PropostaCardState>
  >({})
  const [ultimaAuditoriaId, setUltimaAuditoriaId] = useState<string | null>(null)
  const [isDesfazendo, setIsDesfazendo] = useState(false)

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
    // Ao fechar o drawer, cancela qualquer stream em andamento imediatamente
    // garantindo que não continue consumindo recursos nem trave o estado
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

    // Se já havia uma requisição anterior em andamento, aborta imediatamente
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
        agentSlug: 'assistente-financeiro',
        timeoutMs: 45000, // Timeout de 45 segundos para resposta do assistente financeiro
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

      // Após término do stream, verifica se a mensagem gerou uma proposta estruturada de bloco
      const { proposta } = extrairPropostaBloco(acumulado)
      if (proposta) {
        setPropostasPorMensagem((prev) => ({
          ...prev,
          [assistantMsgId]: {
            proposta,
            status: 'pendente',
          },
        }))
      }

      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId)
        listAgentConversations('assistente-financeiro')
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
        // Usuário cancelou ou fechou deliberadamente
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
        ? 'Não foi possível processar. O assistente atingiu o tempo limite ao pesquisar os lançamentos. Tente reformular o pedido com critérios mais específicos (ex.: especificar data ou valor aproximado).'
        : 'Não foi possível processar a solicitação no momento. Tente reformular o pedido.'

      toast.error(
        isTimeout
          ? 'Tempo limite atingido no Assistente Financeiro'
          : `Falha no Assistente: ${msgErr}`,
      )

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

  // Execução da proposta de alteração em bloco aprovada pelo usuário
  async function handleAplicarProposta(msgId: string, proposta: PropostaBlocoData) {
    setPropostasPorMensagem((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], status: 'aplicando' },
    }))

    try {
      const res = await executarOperacaoBloco(proposta)
      if (!res.sucesso) {
        throw new Error(res.mensagem || 'Erro ao processar lote')
      }

      setPropostasPorMensagem((prev) => ({
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
      }

      toast.success(res.mensagem || `${res.total_afetados} registros alterados com sucesso!`)
      onAcaoExecutada?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao aplicar alteração em bloco: ${msg}`)
      setPropostasPorMensagem((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], status: 'pendente' },
      }))
    }
  }

  function handleDescartarProposta(msgId: string) {
    setPropostasPorMensagem((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], status: 'descartada' },
    }))
    toast.info('Proposta de alteração em bloco descartada.')
  }

  async function handleDesfazerUltimaOperacao() {
    if (isDesfazendo) return
    setIsDesfazendo(true)
    try {
      const res = await desfazerUltimaOperacaoBloco(ultimaAuditoriaId || undefined)
      if (!res.sucesso) {
        throw new Error(res.mensagem || 'Falha ao reverter')
      }
      toast.success(res.mensagem || 'Operação anterior revertida com sucesso!')
      setUltimaAuditoriaId(null)
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

          {/* Aviso com suporte a Propostas em Bloco e Ação de Desfazer */}
          <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Assistente Financeiro Ativo:</strong> consulta dados e{' '}
                <strong>propõe correções em bloco</strong> com sua confirmação.
              </span>
            </div>
            {ultimaAuditoriaId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDesfazerUltimaOperacao}
                disabled={isDesfazendo}
                className="h-6 text-[10px] px-2 border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center gap-1 shrink-0"
                title="Desfazer última alteração em bloco aplicada"
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
                  const propostaEstado = propostasPorMensagem[m.id]
                  const { textoLimpo, proposta: inlineProposta } = !isUser
                    ? extrairPropostaBloco(m.content)
                    : { textoLimpo: m.content, proposta: null }
                  const propostaAtual = propostaEstado?.proposta || inlineProposta

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

                      {/* CARTÃO DE PROPOSTA DE CORREÇÃO EM BLOCO */}
                      {!isUser && propostaAtual && (
                        <div className="ml-9 max-w-[85%] rounded-xl border-2 border-orange-200 bg-orange-50/70 p-3 shadow-sm text-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-orange-200 pb-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                              <Layers className="w-4 h-4 text-[#FF6A13]" />
                              <span>Proposta de Correção em Bloco</span>
                            </div>
                            <Badge className="bg-[#FF6A13] text-white hover:bg-[#e05b0d] text-[10px] px-2">
                              Aguardando Confirmação
                            </Badge>
                          </div>

                          <p className="text-neutral-700 font-medium">
                            {propostaAtual.descricao_resumo || 'Alteração estruturada de registros'}
                          </p>

                          <div className="bg-white rounded-lg p-2.5 border border-neutral-200 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between text-neutral-600">
                              <span className="flex items-center gap-1 text-neutral-500">
                                <Filter className="w-3 h-3 text-[#FF6A13]" /> Coleção Alvo:
                              </span>
                              <span className="font-semibold text-neutral-800 uppercase">
                                {propostaAtual.colecao_alvo.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-neutral-600">
                              <span className="text-neutral-500">Critério de Filtro:</span>
                              <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">
                                {propostaAtual.filtro.campo} {propostaAtual.filtro.operador} "
                                {String(propostaAtual.filtro.valor)}"
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-neutral-600 pt-1 border-t border-neutral-100">
                              <span className="text-neutral-500">Alteração Proposta:</span>
                              <span className="flex items-center gap-1 font-semibold text-[#FF6A13]">
                                <span>{propostaAtual.alteracoes.campo}</span>
                                <ArrowRight className="w-3 h-3" />
                                <span>
                                  {propostaAtual.alteracoes.valor_novo_label ||
                                    String(propostaAtual.alteracoes.valor_novo)}
                                </span>
                              </span>
                            </div>

                            {propostaAtual.total_estimado !== undefined &&
                              propostaAtual.total_estimado > 0 && (
                                <div className="text-[10px] text-neutral-500 text-right">
                                  Estimativa: ~{propostaAtual.total_estimado} registro(s) afetado(s)
                                </div>
                              )}
                          </div>

                          {/* Estado e Ações da Proposta */}
                          {(!propostaEstado || propostaEstado.status === 'pendente') && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDescartarProposta(m.id)}
                                className="h-7 text-xs text-neutral-600 hover:text-neutral-800 hover:bg-neutral-200/50"
                              >
                                Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleAplicarProposta(m.id, propostaAtual)}
                                className="h-7 text-xs bg-[#FF6A13] hover:bg-[#e05b0d] text-white flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aplicar em Bloco</span>
                              </Button>
                            </div>
                          )}

                          {propostaEstado?.status === 'aplicando' && (
                            <div className="flex items-center justify-center gap-2 py-1 text-[#FF6A13] font-medium text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Aplicando alterações no banco de dados...</span>
                            </div>
                          )}

                          {propostaEstado?.status === 'aplicada' && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2 text-[11px] flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  <strong>Sucesso:</strong> {propostaEstado.resultado?.mensagem}
                                </span>
                              </div>
                            </div>
                          )}

                          {propostaEstado?.status === 'descartada' && (
                            <div className="text-[11px] text-neutral-400 italic text-right">
                              Proposta descartada pelo usuário.
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
                placeholder="Pergunte sobre saldos, contas a pagar, boletos ou extratos..."
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
              <span>Acesso restrito: Administrador e Financeiro</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
