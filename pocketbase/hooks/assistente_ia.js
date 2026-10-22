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
      e.response.header().set('Connection', 'keep-alive')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      console.log('Erro no endpoint de chat do assistente:', err.message || err)
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível (configuração)' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha ao processar solicitação com o assistente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'Assistente IA temporariamente indisponível' : err.message,
        })
      }
      return e.json(500, {
        error: 'Não foi possível concluir o processamento da mensagem pelo assistente.',
      })
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

// 5. Endpoint de Prévia / Contagem Server-Side de Operação em Bloco
routerAdd(
  'POST',
  '/backend/v1/assistente/bloco/previa',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const userRole = e.auth?.getString('role') || 'comercial'
      if (userRole !== 'admin' && userRole !== 'financeiro') {
        return e.forbiddenError(
          'Apenas perfis de Administração ou Financeiro podem simular correções em bloco.',
        )
      }

      const body = e.requestInfo().body || {}
      const colecaoAlvo = body.colecao_alvo
      const filtro = body.filtro || {}

      const colecoesPermitidas = ['contas_pagar', 'contas_receber', 'extratos_transacoes']
      if (!colecoesPermitidas.includes(colecaoAlvo)) {
        return e.badRequestError('Coleção alvo inválida para operação em bloco.')
      }

      // Monta filtro PocketBase de forma segura
      let pbFilter = 'id != ""'
      const campo = filtro.campo ? String(filtro.campo).trim() : ''
      const operador = filtro.operador || 'contains'
      const valor =
        filtro.valor !== undefined && filtro.valor !== null ? String(filtro.valor).trim() : ''

      if (campo && valor) {
        const valorSanitizado = valor.replace(/'/g, "\\'")
        if (operador === 'equals') {
          pbFilter = `${campo} = '${valorSanitizado}'`
        } else if (operador === 'contains') {
          pbFilter = `${campo} ~ '${valorSanitizado}'`
        } else if (operador === 'in' && Array.isArray(filtro.valor)) {
          const ids = filtro.valor.map((v) => `'${String(v).replace(/'/g, "\\'")}'`).join(',')
          pbFilter = ids ? `${campo} ?= [${ids}]` : 'id != ""'
        }
      }

      const records = $app.findRecordsByFilter(colecaoAlvo, pbFilter, '-created', 100, 0)
      const total = records.length

      const amostra = records.slice(0, 5).map((r) => {
        return {
          id: r.id,
          descricao: r.getString('descricao') || r.getString('nome') || '',
          valor: r.getFloat('valor') || 0,
          data: r.getString('data') || r.getString('data_vencimento') || '',
          categoria: r.getString('categoria') || '',
          status: r.getString('status') || r.getString('status_conciliacao') || '',
        }
      })

      return e.json(200, {
        colecao_alvo: colecaoAlvo,
        filtro_aplicado: pbFilter,
        total_encontrados: total,
        amostra: amostra,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao gerar prévia da operação em bloco: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 6. Endpoint de Execução Segura de Operação em Bloco com Auditoria e Snapshot
routerAdd(
  'POST',
  '/backend/v1/assistente/bloco/executar',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const userRole = e.auth?.getString('role') || 'comercial'
      if (userRole !== 'admin' && userRole !== 'financeiro') {
        return e.forbiddenError(
          'Apenas Administrador ou Financeiro podem executar alterações em lote.',
        )
      }

      const body = e.requestInfo().body || {}
      const proposta = body.proposta || {}
      const colecaoAlvo = proposta.colecao_alvo
      const alteracoes = proposta.alteracoes || {}
      const filtro = proposta.filtro || {}

      const colecoesPermitidas = ['contas_pagar', 'contas_receber', 'extratos_transacoes']
      if (!colecoesPermitidas.includes(colecaoAlvo)) {
        return e.badRequestError('Coleção alvo não autorizada para escrita em lote.')
      }

      const campoAlterar = alteracoes.campo ? String(alteracoes.campo).trim() : ''
      const valorNovo = alteracoes.valor_novo !== undefined ? alteracoes.valor_novo : null

      if (!campoAlterar) {
        return e.badRequestError('Campo a ser alterado não foi especificado.')
      }

      // Validação de campos permitidos para alteração
      const camposPermitidosPorColecao = {
        contas_pagar: [
          'categoria',
          'credor',
          'conta_bancaria',
          'status',
          'plano_contas_codigo',
          'plano_contas_nome',
        ],
        contas_receber: [
          'categoria',
          'conta_bancaria',
          'status',
          'plano_contas_codigo',
          'plano_contas_nome',
        ],
        extratos_transacoes: ['status_conciliacao', 'observacoes'],
      }

      const camposValidos = camposPermitidosPorColecao[colecaoAlvo] || []
      if (!camposValidos.includes(campoAlterar)) {
        return e.badRequestError(
          `O campo '${campoAlterar}' não pode ser alterado em bloco por motivos de segurança.`,
        )
      }

      // Reexecuta o filtro server-side
      let pbFilter = 'id != ""'
      const fCampo = filtro.campo ? String(filtro.campo).trim() : ''
      const fOperador = filtro.operador || 'contains'
      const fValor =
        filtro.valor !== undefined && filtro.valor !== null ? String(filtro.valor).trim() : ''

      if (fCampo && fValor) {
        const valSan = fValor.replace(/'/g, "\\'")
        if (fOperador === 'equals') {
          pbFilter = `${fCampo} = '${valSan}'`
        } else if (fOperador === 'contains') {
          pbFilter = `${fCampo} ~ '${valSan}'`
        }
      }

      // Limite de segurança: máximo 100 registros por lote
      const MAX_LOTE = 100
      const registros = $app.findRecordsByFilter(colecaoAlvo, pbFilter, '-created', MAX_LOTE, 0)

      if (registros.length === 0) {
        return e.json(200, {
          sucesso: true,
          total_afetados: 0,
          total_falhas: 0,
          mensagem: 'Nenhum registro encontrado correspondente ao critério.',
        })
      }

      // Snapshots dos valores anteriores para auditoria e reversão (Desfazer)
      const snapshots = []
      let totalAfetados = 0
      let totalFalhas = 0

      for (let i = 0; i < registros.length; i++) {
        const rec = registros[i]
        try {
          const snapshotItem = {
            id: rec.id,
            campo: campoAlterar,
            valor_anterior: rec.get(campoAlterar),
            campos_adicionais: {},
          }

          // Se tiver campos adicionais na proposta (ex: plano_contas_nome junto com codigo)
          if (alteracoes.campos_adicionais && typeof alteracoes.campos_adicionais === 'object') {
            const chaves = Object.keys(alteracoes.campos_adicionais)
            for (let k = 0; k < chaves.length; k++) {
              const extraKey = chaves[k]
              if (camposValidos.includes(extraKey)) {
                snapshotItem.campos_adicionais[extraKey] = rec.get(extraKey)
                rec.set(extraKey, alteracoes.campos_adicionais[extraKey])
              }
            }
          }

          rec.set(campoAlterar, valorNovo)
          $app.save(rec)
          snapshots.push(snapshotItem)
          totalAfetados++
        } catch (updateErr) {
          totalFalhas++
          console.log(`Erro ao atualizar registro ${rec.id} em bloco:`, updateErr.message)
        }
      }

      // Grava registro de auditoria
      let auditId = ''
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_operacoes_bloco')
        const auditRec = new Record(auditCol)
        auditRec.set('usuario', userId)
        auditRec.set('tipo_operacao', proposta.tipo_operacao || 'correcao_em_bloco')
        auditRec.set('colecao_alvo', colecaoAlvo)
        auditRec.set(
          'descricao',
          proposta.descricao_resumo || `Alteração em bloco de '${campoAlterar}' em ${colecaoAlvo}`,
        )
        auditRec.set('criterio_filtro', filtro)
        auditRec.set('alteracoes_solicitadas', alteracoes)
        auditRec.set('total_registros_afetados', totalAfetados)
        auditRec.set('total_falhas', totalFalhas)
        auditRec.set('snapshot_anterior', snapshots)
        auditRec.set('desfeito', false)
        $app.save(auditRec)
        auditId = auditRec.id
      } catch (auditErr) {
        console.log('Erro ao salvar auditoria de bloco:', auditErr.message)
      }

      return e.json(200, {
        sucesso: true,
        audit_id: auditId,
        colecao_alvo: colecaoAlvo,
        campo_alterado: campoAlterar,
        total_afetados: totalAfetados,
        total_falhas: totalFalhas,
        mensagem: `${totalAfetados} registro(s) alterado(s) com sucesso${totalFalhas > 0 ? ` (${totalFalhas} falhas)` : ''}.`,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao executar correção em bloco: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 7. Endpoint de Desfazer Última Correção em Bloco
routerAdd(
  'POST',
  '/backend/v1/assistente/bloco/desfazer',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const userRole = e.auth?.getString('role') || 'comercial'
      if (userRole !== 'admin' && userRole !== 'financeiro') {
        return e.forbiddenError(
          'Apenas Administrador ou Financeiro podem reverter alterações em bloco.',
        )
      }

      const body = e.requestInfo().body || {}
      let auditRecord = null

      if (body.audit_id) {
        try {
          auditRecord = $app.findRecordById('auditoria_operacoes_bloco', body.audit_id)
        } catch (_) {}
      } else {
        // Busca a última operação não desfeita criada por este usuário ou geral
        try {
          const recs = $app.findRecordsByFilter(
            'auditoria_operacoes_bloco',
            'desfeito = false',
            '-created',
            1,
            0,
          )
          if (recs.length > 0) auditRecord = recs[0]
        } catch (_) {}
      }

      if (!auditRecord) {
        return e.notFoundError('Nenhuma operação reversível encontrada.')
      }

      if (auditRecord.getBool('desfeito')) {
        return e.badRequestError('Esta operação já foi desfeita anteriormente.')
      }

      const colecaoAlvo = auditRecord.getString('colecao_alvo')
      const tipoOperacao = auditRecord.getString('tipo_operacao')
      let snapshots = []
      try {
        const raw = auditRecord.getString('snapshot_anterior')
        snapshots = raw ? JSON.parse(raw) : []
      } catch (_) {
        snapshots = []
      }

      let totalRestaurados = 0
      let totalFalhas = 0

      // Caso 1: Criação de registro (ex: criar_conta_plano ou criar_credor) -> Reversão exclui o registro criado
      if (tipoOperacao === 'criar_conta_plano' || tipoOperacao === 'criar_credor') {
        for (let i = 0; i < snapshots.length; i++) {
          const item = snapshots[i]
          try {
            const targetId = item.id || item.registro_id
            if (targetId) {
              const rec = $app.findRecordById(colecaoAlvo, targetId)
              $app.delete(rec)
              totalRestaurados++
            }
          } catch (delErr) {
            totalFalhas++
            console.log(`Erro ao reverter criação na coleção ${colecaoAlvo}:`, delErr.message)
          }
        }
      } else {
        // Caso 2: Atualização / Reclassificação -> Restaura valores anteriores do snapshot
        if (!Array.isArray(snapshots) || snapshots.length === 0) {
          return e.badRequestError(
            'Não há snapshot anterior disponível para reverter esta operação.',
          )
        }

        for (let i = 0; i < snapshots.length; i++) {
          const item = snapshots[i]
          try {
            const rec = $app.findRecordById(colecaoAlvo, item.id)
            if (item.campo) {
              rec.set(item.campo, item.valor_anterior)
            }

            if (item.campos_adicionais && typeof item.campos_adicionais === 'object') {
              const chaves = Object.keys(item.campos_adicionais)
              for (let k = 0; k < chaves.length; k++) {
                const extraKey = chaves[k]
                rec.set(extraKey, item.campos_adicionais[extraKey])
              }
            }

            $app.save(rec)
            totalRestaurados++
          } catch (resErr) {
            totalFalhas++
            console.log(`Erro ao restaurar registro ${item.id}:`, resErr.message)
          }
        }
      }

      // Marca a auditoria como desfeita
      auditRecord.set('desfeito', true)
      auditRecord.set('data_desfeito', new Date().toISOString())
      auditRecord.set('desfeito_por', userId)
      $app.save(auditRecord)

      return e.json(200, {
        sucesso: true,
        audit_id: auditRecord.id,
        total_restaurados: totalRestaurados,
        total_falhas: totalFalhas,
        descricao: auditRecord.getString('descricao'),
        mensagem: `Operação desfeita com sucesso: ${totalRestaurados} registro(s) restaurado(s) para o estado anterior.`,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao desfazer operação em bloco: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
