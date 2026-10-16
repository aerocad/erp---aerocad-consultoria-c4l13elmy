/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints HTTP para os Assistentes IA Nativos da AEROCAD
 * Suporta os agentes nativos por seção de navegação e específicos:
 * - assistente-aerocad (Assistente geral / documentos)
 * - assistente-financeiro (Financeiro)
 * - assistente-painel (Painel executivo)
 * - assistente-funil (Funil comercial)
 * - assistente-clientes (Clientes)
 * - assistente-projetos (Projetos)
 * - assistente-processos (Processos)
 * - assistente-documentos (Documentos)
 *
 * Atenção: PocketBase JSVM executa callbacks em pools isoladas — funções auxiliares
 * devem ser inline dentro de cada callback de rota para evitar erros de escopo.
 */

// 1. Endpoint de Chat Streaming (SSE)
routerAdd(
  'POST',
  '/backend/v1/assistente/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const message = body.message?.trim()
      if (!message) return e.badRequestError('A mensagem é obrigatória')

      const conversationId = body.conversation_id || null

      const allowedAgents = [
        'assistente-aerocad',
        'assistente-financeiro',
        'assistente-painel',
        'assistente-funil',
        'assistente-clientes',
        'assistente-projetos',
        'assistente-processos',
        'assistente-documentos',
      ]

      let agentSlug = 'assistente-aerocad'
      if (allowedAgents.includes(body.agent_slug)) {
        agentSlug = body.agent_slug
      }

      const userRole = e.auth?.getString('role') || 'comercial'
      let isPermitido = true

      if (userRole === 'admin') {
        isPermitido = true
      } else if (userRole === 'terceiro') {
        isPermitido = false
      } else if (agentSlug === 'assistente-financeiro') {
        isPermitido = userRole === 'financeiro'
      } else if (agentSlug === 'assistente-funil') {
        isPermitido = userRole === 'comercial'
      } else if (agentSlug === 'assistente-clientes') {
        isPermitido = userRole === 'comercial' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-projetos') {
        isPermitido =
          userRole === 'comercial' || userRole === 'tecnico' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-processos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      } else if (agentSlug === 'assistente-documentos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      }

      if (!isPermitido) {
        return e.forbiddenError('Seu perfil não tem permissão para acessar este assistente.')
      }

      // Obter ou criar a conversa garantindo persistência e ID antes do stream
      const conv = $ai.agent(agentSlug).getOrCreateConversation({
        user_id: userId,
        id: conversationId,
        title: body.title || message.slice(0, 48),
      })

      const iter = $ai.agent(agentSlug).chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível (configuração)' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao processar solicitação com o agente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)

// 2. Endpoint de Chat Síncrono (Fallback ou chamadas diretas)
routerAdd(
  'POST',
  '/backend/v1/assistente/chat-sync',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const message = body.message?.trim()
      if (!message) return e.badRequestError('A mensagem é obrigatória')

      const allowedAgents = [
        'assistente-aerocad',
        'assistente-financeiro',
        'assistente-painel',
        'assistente-funil',
        'assistente-clientes',
        'assistente-projetos',
        'assistente-processos',
        'assistente-documentos',
      ]

      let agentSlug = 'assistente-aerocad'
      if (allowedAgents.includes(body.agent_slug)) {
        agentSlug = body.agent_slug
      }

      const userRole = e.auth?.getString('role') || 'comercial'
      let isPermitido = true

      if (userRole === 'admin') {
        isPermitido = true
      } else if (userRole === 'terceiro') {
        isPermitido = false
      } else if (agentSlug === 'assistente-financeiro') {
        isPermitido = userRole === 'financeiro'
      } else if (agentSlug === 'assistente-funil') {
        isPermitido = userRole === 'comercial'
      } else if (agentSlug === 'assistente-clientes') {
        isPermitido = userRole === 'comercial' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-projetos') {
        isPermitido =
          userRole === 'comercial' || userRole === 'tecnico' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-processos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      } else if (agentSlug === 'assistente-documentos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      }

      if (!isPermitido) {
        return e.forbiddenError('Seu perfil não tem permissão para acessar este assistente.')
      }

      const result = $ai.agent(agentSlug).chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'Falha no agente' : err.message })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: status >= 500 ? 'IA indisponível' : err.message })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)

// 3. Listar conversas anteriores do usuário
routerAdd(
  'GET',
  '/backend/v1/assistente/conversas',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')
      const limit = parseInt(e.requestInfo().query?.limit || '30', 10) || 30

      const allowedAgents = [
        'assistente-aerocad',
        'assistente-financeiro',
        'assistente-painel',
        'assistente-funil',
        'assistente-clientes',
        'assistente-projetos',
        'assistente-processos',
        'assistente-documentos',
      ]

      const reqSlug = e.requestInfo().query?.agent_slug
      let agentSlug = 'assistente-aerocad'
      if (allowedAgents.includes(reqSlug)) {
        agentSlug = reqSlug
      }

      const userRole = e.auth?.getString('role') || 'comercial'
      let isPermitido = true

      if (userRole === 'admin') {
        isPermitido = true
      } else if (userRole === 'terceiro') {
        isPermitido = false
      } else if (agentSlug === 'assistente-financeiro') {
        isPermitido = userRole === 'financeiro'
      } else if (agentSlug === 'assistente-funil') {
        isPermitido = userRole === 'comercial'
      } else if (agentSlug === 'assistente-clientes') {
        isPermitido = userRole === 'comercial' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-projetos') {
        isPermitido =
          userRole === 'comercial' || userRole === 'tecnico' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-processos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      } else if (agentSlug === 'assistente-documentos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      }

      if (!isPermitido) {
        return e.forbiddenError('Seu perfil não tem permissão para acessar este assistente.')
      }

      return e.json(200, $ai.agent(agentSlug).listConversations({ user_id: userId, limit }))
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        return e.json(err.status || 500, { error: err.message })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)

// 4. Listar mensagens de uma conversa
routerAdd(
  'GET',
  '/backend/v1/assistente/conversas/{id}/mensagens',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')
      const conversationId = e.request.pathValue('id')

      const allowedAgents = [
        'assistente-aerocad',
        'assistente-financeiro',
        'assistente-painel',
        'assistente-funil',
        'assistente-clientes',
        'assistente-projetos',
        'assistente-processos',
        'assistente-documentos',
      ]

      const reqSlug = e.requestInfo().query?.agent_slug
      let agentSlug = 'assistente-aerocad'
      if (allowedAgents.includes(reqSlug)) {
        agentSlug = reqSlug
      }

      const userRole = e.auth?.getString('role') || 'comercial'
      let isPermitido = true

      if (userRole === 'admin') {
        isPermitido = true
      } else if (userRole === 'terceiro') {
        isPermitido = false
      } else if (agentSlug === 'assistente-financeiro') {
        isPermitido = userRole === 'financeiro'
      } else if (agentSlug === 'assistente-funil') {
        isPermitido = userRole === 'comercial'
      } else if (agentSlug === 'assistente-clientes') {
        isPermitido = userRole === 'comercial' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-projetos') {
        isPermitido =
          userRole === 'comercial' || userRole === 'tecnico' || userRole === 'financeiro'
      } else if (agentSlug === 'assistente-processos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      } else if (agentSlug === 'assistente-documentos') {
        isPermitido = userRole === 'comercial' || userRole === 'tecnico'
      }

      if (!isPermitido) {
        return e.forbiddenError('Seu perfil não tem permissão para acessar este assistente.')
      }

      return e.json(
        200,
        $ai.agent(agentSlug).listMessages({
          conversation_id: conversationId,
          user_id: userId,
        }),
      )
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao buscar histórico de mensagens' : err.message,
        })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
