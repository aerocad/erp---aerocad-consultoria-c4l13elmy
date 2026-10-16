import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type AgentCitation,
  type AgentMessage,
  type DisplayMessage,
} from '@/lib/skipAi'

export interface AgentContextRecord {
  tipo: 'projeto' | 'proposta' | 'processo' | 'cliente' | 'oportunidade' | 'secao_financeira'
  id: string
  titulo: string
  subtitulo?: string
  dados?: Record<string, unknown>
}

export type CrmAgentSlug =
  | 'assistente-aerocad'
  | 'assistente-financeiro'
  | 'assistente-painel'
  | 'assistente-funil'
  | 'assistente-clientes'
  | 'assistente-projetos'
  | 'assistente-processos'
  | 'assistente-documentos'

export interface SendAgentMessageOptions {
  message: string
  conversationId?: string | null
  agentSlug?: CrmAgentSlug
  contextRecord?: AgentContextRecord | null
  onChunk?: (delta: string, accumulated: string) => void
  onToolCallStart?: (info: { id: string; name: string }) => void
  onToolCallDone?: (info: { id: string; ok: boolean }) => void
  onCitations?: (items: AgentCitation[]) => void
  signal?: AbortSignal
}

export interface AgentConversationItem {
  id: string
  title?: string
  created: string
  updated: string
}

/**
 * Monta o prompt enriquecido com o contexto do registro do CRM
 */
function buildEnrichedMessage(message: string, contextRecord?: AgentContextRecord | null): string {
  if (!contextRecord) return message

  const ctxHeader = `[CONTEXTO CRM ATUAL — ${contextRecord.tipo.toUpperCase()}: ${contextRecord.titulo} (ID: ${contextRecord.id})]`
  const ctxDetails = contextRecord.dados
    ? `\nDetalhes do registro selecionado:\n${JSON.stringify(contextRecord.dados, null, 2)}`
    : ''

  return `${ctxHeader}${ctxDetails}\n\nSolicitação do usuário:\n${message}`
}

/**
 * Envia uma mensagem para o agente nativo com streaming via SSE
 */
export async function sendAgentMessage(options: SendAgentMessageOptions) {
  const {
    message,
    conversationId,
    agentSlug = 'assistente-aerocad',
    contextRecord,
    onChunk,
    onToolCallStart,
    onToolCallDone,
    onCitations,
    signal,
  } = options

  const enriched = buildEnrichedMessage(message, contextRecord)
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL

  const res = await fetch(`${baseUrl}/backend/v1/assistente/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({
      message: enriched,
      conversation_id: conversationId || null,
      agent_slug: agentSlug,
      title: contextRecord
        ? `${contextRecord.tipo.toUpperCase()}: ${contextRecord.titulo.slice(0, 32)}`
        : message.slice(0, 48),
    }),
    signal,
  })

  const result = await streamAgentChat(res, {
    onChunk,
    onToolCallStart,
    onToolCallDone,
    onCitations,
    signal,
  })

  const finalConversationId = res.headers.get('X-Conversation-Id') || result.conversation_id

  return {
    conversationId: finalConversationId,
    messageId: result.message_id,
    content: result.content,
    citations: result.citations,
    toolCalls: result.toolCalls,
  }
}

/**
 * Carrega a lista de conversas do usuário com o assistente
 */
export async function listAgentConversations(
  agentSlug: CrmAgentSlug = 'assistente-aerocad',
): Promise<AgentConversationItem[]> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(
    `${baseUrl}/backend/v1/assistente/conversas?limit=40&agent_slug=${agentSlug}`,
    {
      headers: {
        Authorization: pb.authStore.token,
      },
    },
  )

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || 'Erro ao carregar conversas do assistente')
  }

  const data = await res.json()
  return (data?.items || data || []) as AgentConversationItem[]
}

/**
 * Carrega o histórico de mensagens de uma conversa
 */
export async function loadConversationMessages(
  conversationId: string,
  agentSlug: CrmAgentSlug = 'assistente-aerocad',
): Promise<DisplayMessage[]> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(
    `${baseUrl}/backend/v1/assistente/conversas/${conversationId}/mensagens?agent_slug=${agentSlug}`,
    {
      headers: {
        Authorization: pb.authStore.token,
      },
    },
  )

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody?.error || 'Erro ao carregar mensagens da conversa')
  }

  const payload = await res.json()
  const rawMessages = (payload?.messages || payload || []) as AgentMessage[]
  return displayableMessages(rawMessages)
}
