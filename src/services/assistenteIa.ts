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

export interface PropostaBlocoFiltro {
  campo: string
  operador: 'equals' | 'contains' | 'in'
  valor: unknown
}

export interface PropostaBlocoAlteracoes {
  campo: string
  valor_novo: unknown
  valor_novo_label?: string
  campos_adicionais?: Record<string, unknown>
}

export interface PropostaBlocoData {
  tipo_operacao: string
  colecao_alvo: 'contas_pagar' | 'contas_receber' | 'extratos_transacoes'
  descricao_resumo: string
  filtro: PropostaBlocoFiltro
  alteracoes: PropostaBlocoAlteracoes
  total_estimado?: number
}

export interface PreviaBlocoResultado {
  colecao_alvo: string
  filtro_aplicado: string
  total_encontrados: number
  amostra: Array<{
    id: string
    descricao: string
    valor: number
    data: string
    categoria?: string
    status?: string
  }>
}

export interface ExecucaoBlocoResultado {
  sucesso: boolean
  audit_id?: string
  colecao_alvo: string
  campo_alterado: string
  total_afetados: number
  total_falhas: number
  mensagem: string
}

export interface DesfazerBlocoResultado {
  sucesso: boolean
  audit_id: string
  total_restaurados: number
  total_falhas: number
  descricao?: string
  mensagem: string
}

/**
 * Obtém prévia/contagem de registros atingidos pela operação em bloco
 */
export async function obterPreviaBloco(
  colecaoAlvo: string,
  filtro: PropostaBlocoFiltro,
): Promise<PreviaBlocoResultado> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/assistente/bloco/previa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ colecao_alvo: colecaoAlvo, filtro }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || 'Erro ao obter prévia da operação em bloco')
  }
  return payload as PreviaBlocoResultado
}

/**
 * Executa a operação em bloco aprovada pelo usuário com auditoria
 */
export async function executarOperacaoBloco(
  proposta: PropostaBlocoData,
): Promise<ExecucaoBlocoResultado> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/assistente/bloco/executar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ proposta }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || 'Erro ao executar operação em bloco')
  }
  return payload as ExecucaoBlocoResultado
}

/**
 * Desfaz a última correção em bloco realizada
 */
export async function desfazerUltimaOperacaoBloco(
  auditId?: string,
): Promise<DesfazerBlocoResultado> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/assistente/bloco/desfazer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ audit_id: auditId }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || 'Erro ao desfazer operação em bloco')
  }
  return payload as DesfazerBlocoResultado
}
