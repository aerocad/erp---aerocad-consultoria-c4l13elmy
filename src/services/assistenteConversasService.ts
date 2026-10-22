import pb from '@/lib/pocketbase/client'
import type { DisplayMessage } from '@/lib/skipAi'
import { sendAgentMessage, type AgentContextRecord } from '@/services/assistenteIa'

export type StatusProcessamento = 'concluido' | 'processando' | 'pendente' | 'erro'

export interface ConversaPersistidaRecord {
  id: string
  usuario: string
  agent_slug: string
  contexto?: string
  titulo?: string
  mensagens: DisplayMessage[]
  status_processamento: StatusProcessamento
  pergunta_pendente?: string
  ultima_auditoria_id?: string
  created: string
  updated: string
}

// Mapa em memória de requisições ativas de background para que sair da tela não cancele o processamento
interface BackgroundTask {
  controller: AbortController
  promise: Promise<void>
}
const backgroundTasks = new Map<string, BackgroundTask>()

/**
 * Lista as conversas persistidas no banco para o usuário logado e opcionalmente filtradas por agentSlug
 */
export async function listarConversasPersistidas(
  agentSlug?: string,
): Promise<ConversaPersistidaRecord[]> {
  const userId = pb.authStore.record?.id
  if (!userId) return []

  let filter = `usuario = "${userId}"`
  if (agentSlug) {
    filter += ` && agent_slug = "${agentSlug}"`
  }

  try {
    const records = await pb
      .collection('assistente_conversas')
      .getFullList<ConversaPersistidaRecord>({
        filter,
        sort: '-updated',
        requestKey: null,
      })
    return records
  } catch (err) {
    console.warn('Erro ao listar conversas persistidas:', err)
    return []
  }
}

/**
 * Carrega uma conversa persistida específica pelo ID
 */
export async function carregarConversaPersistida(
  conversaId: string,
): Promise<ConversaPersistidaRecord | null> {
  try {
    const record = await pb
      .collection('assistente_conversas')
      .getOne<ConversaPersistidaRecord>(conversaId, { requestKey: null })
    return record
  } catch (err) {
    console.warn(`Erro ao carregar conversa persistida ${conversaId}:`, err)
    return null
  }
}

/**
 * Cria uma nova conversa persistida no banco
 */
export async function criarConversaPersistida(dados: {
  agentSlug: string
  contexto?: string
  titulo?: string
  primeiraMensagem?: DisplayMessage
}): Promise<ConversaPersistidaRecord> {
  const userId = pb.authStore.record?.id
  if (!userId) {
    throw new Error('Usuário não autenticado para persistir conversa')
  }

  const mensagens: DisplayMessage[] = dados.primeiraMensagem ? [dados.primeiraMensagem] : []
  const titulo = dados.titulo || dados.primeiraMensagem?.content.slice(0, 48) || 'Nova Conversa'

  const record = await pb.collection('assistente_conversas').create<ConversaPersistidaRecord>({
    usuario: userId,
    agent_slug: dados.agentSlug,
    contexto: dados.contexto || '',
    titulo,
    mensagens,
    status_processamento: 'concluido',
  })

  return record
}

/**
 * Atualiza mensagens e status de uma conversa persistida
 */
export async function atualizarConversaPersistida(
  conversaId: string,
  dados: {
    mensagens?: DisplayMessage[]
    status_processamento?: StatusProcessamento
    pergunta_pendente?: string
    titulo?: string
    ultima_auditoria_id?: string
  },
): Promise<ConversaPersistidaRecord> {
  const payload: Record<string, unknown> = {}
  if (dados.mensagens !== undefined) payload.mensagens = dados.mensagens
  if (dados.status_processamento !== undefined)
    payload.status_processamento = dados.status_processamento
  if (dados.pergunta_pendente !== undefined) payload.pergunta_pendente = dados.pergunta_pendente
  if (dados.titulo !== undefined) payload.titulo = dados.titulo
  if (dados.ultima_auditoria_id !== undefined)
    payload.ultima_auditoria_id = dados.ultima_auditoria_id

  const record = await pb
    .collection('assistente_conversas')
    .update<ConversaPersistidaRecord>(conversaId, payload)
  return record
}

/**
 * Exclui MANUALMENTE uma conversa do banco (com regra estrita: só o usuário dono pode excluir)
 */
export async function excluirConversaPersistida(conversaId: string): Promise<void> {
  // Cancela background task se estiver rodando
  if (backgroundTasks.has(conversaId)) {
    try {
      backgroundTasks.get(conversaId)?.controller.abort('Conversa excluída pelo usuário')
    } catch {
      /* intentionally ignored */
    }
    backgroundTasks.delete(conversaId)
  }

  await pb.collection('assistente_conversas').delete(conversaId)
}

/**
 * Envia uma mensagem com garantia de persistência assíncrona.
 * Se o usuário sair da página ou fechar o modal, a Promise continua rodando em background
 * e grava o resultado final na coleção 'assistente_conversas' no banco.
 */
export async function enviarMensagemPersistidaBackground(params: {
  conversaId?: string | null
  agentSlug: string
  contexto?: string
  titulo?: string
  userText: string
  contextRecord?: AgentContextRecord | null
  onChunk?: (delta: string, acumulado: string) => void
  onToolCallStart?: (info: { id: string; name: string }) => void
  onToolCallDone?: (info: { id: string; name: string }) => void
  onFinalizado?: (conversaAtualizada: ConversaPersistidaRecord) => void
  onError?: (err: unknown) => void
}): Promise<{ conversaId: string; userMessage: DisplayMessage }> {
  const {
    conversaId: existingConvId,
    agentSlug,
    contexto,
    userText,
    contextRecord,
    onChunk,
    onToolCallStart,
    onToolCallDone,
    onFinalizado,
    onError,
  } = params

  const agora = new Date().toISOString()
  const userMessage: DisplayMessage = {
    id: `usr_${Date.now()}`,
    role: 'user',
    content: userText,
    created: agora,
  }

  let convRecord: ConversaPersistidaRecord
  if (existingConvId) {
    const existing = await carregarConversaPersistida(existingConvId)
    if (!existing) {
      convRecord = await criarConversaPersistida({
        agentSlug,
        contexto,
        titulo: params.titulo || userText.slice(0, 48),
        primeiraMensagem: userMessage,
      })
    } else {
      const novasMensagens = [...(existing.mensagens || []), userMessage]
      convRecord = await atualizarConversaPersistida(existing.id, {
        mensagens: novasMensagens,
        status_processamento: 'processando',
        pergunta_pendente: userText,
      })
    }
  } else {
    convRecord = await criarConversaPersistida({
      agentSlug,
      contexto,
      titulo: params.titulo || userText.slice(0, 48),
      primeiraMensagem: userMessage,
    })
    // Marca como processando
    convRecord = await atualizarConversaPersistida(convRecord.id, {
      status_processamento: 'processando',
      pergunta_pendente: userText,
    })
  }

  const activeConvId = convRecord.id

  // Se já havia uma tarefa em background para essa conversa, aborta anterior
  if (backgroundTasks.has(activeConvId)) {
    try {
      backgroundTasks.get(activeConvId)?.controller.abort()
    } catch {
      /* intentionally ignored */
    }
    backgroundTasks.delete(activeConvId)
  }

  const controller = new AbortController()

  // Task assíncrona desacoplada da UI
  const bgPromise = (async () => {
    let respostaCompleta = ''
    try {
      const res = await sendAgentMessage({
        message: userText,
        agentSlug: agentSlug as any,
        contextRecord,
        signal: controller.signal,
        timeoutMs: 50000,
        onChunk: (delta, full) => {
          respostaCompleta = full
          onChunk?.(delta, full)
        },
        onToolCallStart,
        onToolCallDone,
      })

      const textoFinal = res.content || respostaCompleta || 'Concluído sem texto de resposta.'
      const assistantMessage: DisplayMessage = {
        id: res.messageId || `ast_${Date.now()}`,
        role: 'assistant',
        content: textoFinal,
        citations: res.citations,
        created: new Date().toISOString(),
      }

      // Recarrega conversa atualizada para evitar conflitos
      const convAtual = (await carregarConversaPersistida(activeConvId)) || convRecord
      const mensagensFinais = [...(convAtual.mensagens || [])]
      // Adiciona mensagem se não estiver lá
      if (!mensagensFinais.some((m) => m.id === assistantMessage.id)) {
        mensagensFinais.push(assistantMessage)
      }

      const atualizado = await atualizarConversaPersistida(activeConvId, {
        mensagens: mensagensFinais,
        status_processamento: 'concluido',
        pergunta_pendente: '',
      })

      onFinalizado?.(atualizado)
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        console.error('Erro na tarefa de background do assistente:', err)
        try {
          const convAtual = (await carregarConversaPersistida(activeConvId)) || convRecord
          const msgErro: DisplayMessage = {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Não foi possível concluir o processamento: ${err instanceof Error ? err.message : String(err)}`,
            created: new Date().toISOString(),
          }
          const atualizado = await atualizarConversaPersistida(activeConvId, {
            mensagens: [...(convAtual.mensagens || []), msgErro],
            status_processamento: 'erro',
            pergunta_pendente: '',
          })
          onFinalizado?.(atualizado)
        } catch {
          /* intentionally ignored */
        }
        onError?.(err)
      }
    } finally {
      backgroundTasks.delete(activeConvId)
    }
  })()

  backgroundTasks.set(activeConvId, { controller, promise: bgPromise })

  return { conversaId: activeConvId, userMessage }
}
