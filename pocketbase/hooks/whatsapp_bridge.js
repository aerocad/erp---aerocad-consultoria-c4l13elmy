/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook HTTP: Integração Artesanal WhatsApp (AEROCAD)
 * Todas as funções auxiliares são declaradas dentro dos callbacks para atender ao scoping do PocketBase JSVM.
 */

// 1. GET: Verificação de Webhook (Meta Hub Challenge ou ping)
routerAdd('GET', '/backend/v1/whatsapp/webhook', (e) => {
  const query = e.requestInfo().query || {}
  const hubMode = query['hub.mode']
  const hubChallenge = query['hub.challenge']
  const verifyToken = query['hub.verify_token']

  let expectedToken = ''
  try {
    const configRec = $app.findFirstRecordByData('whatsapp_config', 'chave', 'default')
    if (configRec) {
      expectedToken = configRec.getString('webhook_secret')
    }
  } catch (_) {}

  if (!expectedToken) {
    expectedToken = $os.getenv('WHATSAPP_WEBHOOK_SECRET') || ''
  }

  // Caso da Meta Webhook Verification
  if (hubMode === 'subscribe' && hubChallenge) {
    if (expectedToken && verifyToken !== expectedToken) {
      return e.forbiddenError('Token de verificação inválido')
    }
    return e.string(200, hubChallenge)
  }

  // Ping de status simples
  return e.json(200, {
    status: 'online',
    service: 'AEROCAD WhatsApp Webhook Bridge',
    time: new Date().toISOString(),
  })
})

// 2. POST: Recebimento e processamento do webhook WhatsApp
routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  // Funções utilitárias locais inline no callback
  const sanitizePhone = (raw) => {
    if (!raw) return ''
    let cleaned = String(raw).replace(/\D/g, '')
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned
    }
    return cleaned
  }

  const parseIncomingWhatsAppPayload = (body) => {
    if (!body || typeof body !== 'object') {
      return null
    }

    // 1. Meta WhatsApp Cloud API
    if (Array.isArray(body.entry) && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            const val = change.value
            if (val && Array.isArray(val.messages) && val.messages.length > 0) {
              const msg = val.messages[0]
              const senderPhone = sanitizePhone(msg.from)
              let contactName = ''
              if (Array.isArray(val.contacts) && val.contacts.length > 0) {
                contactName = val.contacts[0].profile?.name || ''
              }
              let text = ''
              if (msg.type === 'text' && msg.text?.body) {
                text = msg.text.body
              } else if (msg.type === 'button' && msg.button?.text) {
                text = msg.button.text
              } else if (msg.type === 'interactive') {
                text =
                  msg.interactive?.button_reply?.title ||
                  msg.interactive?.list_reply?.title ||
                  'Interação WhatsApp'
              } else {
                text = '[Mensagem recebida: tipo ' + (msg.type || 'mídia') + ']'
              }

              return {
                provider: 'meta',
                senderPhone: senderPhone,
                senderName: contactName,
                messageText: text,
                messageId: msg.id || '',
                timestamp: msg.timestamp || String(Math.floor(Date.now() / 1000)),
              }
            }
          }
        }
      }
    }

    // 2. Z-API (on-message-received)
    if (body.phone || body.connectedPhone || body.instanceId) {
      if (body.fromMe === true) {
        return { ignore: true, reason: 'Mensagem enviada pelo próprio número (fromMe)' }
      }
      const senderPhone = sanitizePhone(body.phone || body.senderLid || '')
      const senderName = body.senderName || body.chatName || ''
      let text = ''

      if (body.text && typeof body.text === 'object') {
        text = body.text.message || body.text.body || ''
      } else if (typeof body.text === 'string') {
        text = body.text
      } else if (body.image) {
        text = body.image.caption ? '[Imagem] ' + body.image.caption : '[Imagem recebida]'
      } else if (body.document) {
        text = body.document.title
          ? '[Documento] ' + body.document.title
          : '[Documento/PDF recebido]'
      } else if (body.audio) {
        text = '[Áudio recebido]'
      } else if (body.buttonsResponseMessage) {
        text = body.buttonsResponseMessage.message || 'Resposta de botão'
      } else if (body.listResponseMessage) {
        text = body.listResponseMessage.title || body.listResponseMessage.message || 'Item de lista'
      } else {
        text = body.message || '[Mensagem recebida via WhatsApp]'
      }

      return {
        provider: 'zapi',
        senderPhone: senderPhone,
        senderName: senderName,
        messageText: text,
        messageId: body.messageId || '',
        timestamp: String(body.momment || Math.floor(Date.now() / 1000)),
      }
    }

    // 3. Genérico
    const senderPhone = sanitizePhone(body.from || body.phone || body.sender || body.contact?.phone)
    if (senderPhone) {
      const senderName = body.name || body.contact_name || body.senderName || ''
      const text =
        body.text ||
        body.message ||
        body.body ||
        body.content ||
        (typeof body.data === 'string' ? body.data : '[Mensagem genérica recebida]')
      return {
        provider: 'outro',
        senderPhone: senderPhone,
        senderName: senderName,
        messageText: String(text),
        messageId: body.id || body.message_id || '',
        timestamp: String(Date.now()),
      }
    }

    return null
  }

  const dispatchWhatsAppMessage = (toPhone, messageText) => {
    const provider = ($os.getenv('WHATSAPP_PROVIDER') || 'meta').toLowerCase().trim()
    const cleanTo = sanitizePhone(toPhone)
    if (!cleanTo || !messageText) {
      return { sent: false, reason: 'Telefone ou mensagem vazios' }
    }

    if (provider === 'meta') {
      const token = $os.getenv('WHATSAPP_API_TOKEN')
      const phoneId = $os.getenv('WHATSAPP_PHONE_ID')
      if (!token || !phoneId) {
        return {
          sent: false,
          reason: 'Segredos WHATSAPP_API_TOKEN ou WHATSAPP_PHONE_ID não configurados',
        }
      }

      try {
        const url = 'https://graph.facebook.com/v19.0/' + encodeURIComponent(phoneId) + '/messages'
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: { preview_url: false, body: messageText },
        }

        const res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify(payload),
          timeout: 15,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return { sent: true, provider: 'meta', response: res.json }
        }
        return { sent: false, statusCode: res.statusCode, raw: res.raw }
      } catch (err) {
        console.log('Erro ao disparar mensagem Meta WhatsApp:', err.message)
        return { sent: false, error: err.message }
      }
    }

    if (provider === 'zapi') {
      const instanceId = $os.getenv('WHATSAPP_INSTANCE_ID') || $os.getenv('WHATSAPP_PHONE_ID')
      const token = $os.getenv('WHATSAPP_API_TOKEN') || $os.getenv('WHATSAPP_CLIENT_TOKEN')
      if (!instanceId || !token) {
        return {
          sent: false,
          reason: 'Segredos WHATSAPP_INSTANCE_ID e WHATSAPP_API_TOKEN não configurados para Z-API',
        }
      }

      try {
        const url =
          'https://api.z-api.io/instances/' +
          encodeURIComponent(instanceId) +
          '/token/' +
          encodeURIComponent(token) +
          '/send-text'
        const payload = {
          phone: cleanTo,
          message: messageText,
        }

        const res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 15,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return { sent: true, provider: 'zapi', response: res.json }
        }
        return { sent: false, statusCode: res.statusCode, raw: res.raw }
      } catch (err) {
        console.log('Erro ao disparar mensagem Z-API:', err.message)
        return { sent: false, error: err.message }
      }
    }

    const genericUrl = $os.getenv('WHATSAPP_GENERIC_URL')
    if (genericUrl) {
      try {
        const apiKey = $os.getenv('WHATSAPP_API_TOKEN') || ''
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey
        const res = $http.send({
          url: genericUrl,
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ phone: cleanTo, message: messageText }),
          timeout: 15,
        })
        return { sent: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode }
      } catch (err) {
        return { sent: false, error: err.message }
      }
    }

    return {
      sent: false,
      reason: 'Provedor ' + provider + ' sem segredos/configurações de envio definidas',
    }
  }

  const generateSdrGreeting = (clientName, incomingMessage) => {
    const fallbackGreeting =
      'Olá' +
      (clientName ? ', ' + clientName : '') +
      '! Sou o assistente da AEROCAD Consultoria Aeronáutica. Obrigado por entrar em contato conosco! Recebemos sua mensagem sobre solicitação de cotação/orçamento. Você poderia nos dar mais detalhes sobre o serviço desejado (como OPEA, registro/homologação de aeródromo ou heliponto, ou outro estudo aeronáutico)? Em instantes nossa equipe comercial dará sequência ao seu atendimento.'

    try {
      const aiRes = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é o assistente virtual da AEROCAD Consultoria Aeronáutica (fundada pelo Cleyton Saraiva, especialista em OPEA, registro de aeródromos e helipontos no DECEA/ANAC). ' +
              'Regras OBRIGATÓRIAS:\n' +
              '1. NUNCA finja ser um atendente humano. Assine sempre como "Assistente da AEROCAD" ou "assistente virtual da AEROCAD".\n' +
              '2. Seja extremamente cordial, natural e profissional em português do Brasil.\n' +
              '3. Agradeça o contato, faça menção ao tipo de estudo que o cliente procura (OPEA, registro, heliponto etc.) e pergunte o município/estado ou detalhes técnicos do empreendimento.\n' +
              '4. NÃO prometa prazos exatos nem valores fechados.\n' +
              '5. Mantenha a resposta concisa (máximo 3 parágrafos curtos, ideal para WhatsApp).',
          },
          {
            role: 'user',
            content:
              'Nome do cliente: ' +
              (clientName || 'Não informado') +
              '\nMensagem recebida: ' +
              (incomingMessage || 'Olá, gostaria de um orçamento.'),
          },
        ],
      })

      if (
        aiRes &&
        aiRes.choices &&
        aiRes.choices[0] &&
        aiRes.choices[0].message &&
        aiRes.choices[0].message.content
      ) {
        const content = aiRes.choices[0].message.content.trim()
        if (content.length > 20) return content
      }
    } catch (err) {
      console.log('Geração IA do SDR não utilizada, aplicando fallback humanizado:', err.message)
    }

    return fallbackGreeting
  }

  const validateSecurityToken = () => {
    let expectedToken = ''
    try {
      const configRec = $app.findFirstRecordByData('whatsapp_config', 'chave', 'default')
      if (configRec) {
        expectedToken = configRec.getString('webhook_secret')
      }
    } catch (_) {}

    if (!expectedToken) {
      expectedToken = $os.getenv('WHATSAPP_WEBHOOK_SECRET') || ''
    }

    if (!expectedToken) return true

    const query = e.requestInfo().query || {}
    let headerToken = ''
    try {
      if (e.request && e.request.header) {
        if (typeof e.request.header.get === 'function') {
          headerToken =
            e.request.header.get('X-Webhook-Secret') ||
            e.request.header.get('X-Api-Key') ||
            e.request.header.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
            ''
        } else if (e.request.header['x-webhook-secret'] || e.request.header['X-Webhook-Secret']) {
          headerToken =
            e.request.header['x-webhook-secret'] ||
            e.request.header['X-Webhook-Secret'] ||
            e.request.header['x-api-key'] ||
            e.request.header['X-Api-Key'] ||
            ''
        }
      }
    } catch (_) {}

    try {
      const headersMap = e.requestInfo().headers || {}
      if (!headerToken) {
        headerToken =
          headersMap['x-webhook-secret'] ||
          headersMap['x_webhook_secret'] ||
          headersMap['x-api-key'] ||
          headersMap['authorization']?.replace(/^Bearer\s+/i, '') ||
          ''
      }
    } catch (_) {}

    const paramToken = query['token'] || query['secret'] || query['hub.verify_token'] || ''

    if (paramToken && paramToken === expectedToken) return true
    if (headerToken && headerToken === expectedToken) return true

    return false
  }

  try {
    // 1. Validação de token se configurado
    if (!validateSecurityToken()) {
      console.log('Webhook WhatsApp rejeitado: token de segurança inválido')
      return e.forbiddenError('Webhook secret inválido')
    }

    const body = e.requestInfo().body || {}
    const parsed = parseIncomingWhatsAppPayload(body)

    if (parsed && parsed.ignore) {
      return e.json(200, { status: 'ignored', reason: parsed.reason })
    }

    if (!parsed || !parsed.senderPhone) {
      return e.json(200, {
        status: 'received',
        note: 'Payload não continha mensagem de texto direta de cliente',
      })
    }

    const senderPhone = parsed.senderPhone
    const senderName = parsed.senderName ? parsed.senderName.trim() : ''
    const messageText = (parsed.messageText || '').trim()

    // 2. Localiza ou cria Cliente vinculado pelo telefone
    let clienteId = ''
    try {
      const foundClients = $app.findRecordsByFilter(
        'clientes',
        'telefone ~ {:phone}',
        '-created',
        1,
        0,
        { phone: senderPhone.slice(-8) },
      )
      if (foundClients && foundClients.length > 0) {
        clienteId = foundClients[0].id
      }
    } catch (findErr) {
      console.log('Aviso ao buscar cliente por telefone:', findErr.message)
    }

    if (!clienteId) {
      try {
        const clientCol = $app.findCollectionByNameOrId('clientes')
        const newClient = new Record(clientCol)
        newClient.set('tipo', 'pj')
        newClient.set(
          'razao_social',
          senderName ? senderName + ' (WhatsApp)' : 'Lead WhatsApp ' + senderPhone,
        )
        newClient.set('telefone', senderPhone)
        newClient.set('origem', 'WhatsApp')
        newClient.set('status', 'prospect')
        newClient.set('observacoes', '<p>Contato capturado via integração WhatsApp do site.</p>')
        $app.save(newClient)
        clienteId = newClient.id
      } catch (clientCreateErr) {
        console.log('Falha ao criar cliente automático:', clientCreateErr.message)
      }
    } else if (senderName) {
      // Se cliente já existia mas tinha nome provisório "Lead WhatsApp...", atualiza para o nome real recebido
      try {
        const existingClient = $app.findRecordById('clientes', clienteId)
        const currentName = existingClient.getString('razao_social')
        if (currentName.startsWith('Lead WhatsApp') && senderName) {
          existingClient.set('razao_social', senderName + ' (WhatsApp)')
          $app.save(existingClient)
        }
      } catch (_) {}
    }

    // 3. Localiza se já existe oportunidade aberta recente para esse cliente/telefone ou cria uma nova
    let oppId = ''
    let isExistingOpp = false
    try {
      if (clienteId) {
        const openOpps = $app.findRecordsByFilter(
          'oportunidades',
          'cliente = {:cid} && etapa != "ganho" && etapa != "perdido"',
          '-updated',
          1,
          0,
          { cid: clienteId },
        )
        if (openOpps && openOpps.length > 0) {
          oppId = openOpps[0].id
          isExistingOpp = true
        }
      }
    } catch (_) {}

    let responsavelId = ''
    try {
      const adminUser = $app.findFirstRecordByData('users', 'role', 'admin')
      responsavelId = adminUser.id
    } catch (_) {}

    if (!oppId) {
      try {
        const oppCol = $app.findCollectionByNameOrId('oportunidades')
        const newOpp = new Record(oppCol)
        newOpp.set('cliente', clienteId)
        newOpp.set(
          'titulo',
          'Solicitação WhatsApp: ' +
            (senderName || senderPhone) +
            (messageText ? ' — ' + messageText.slice(0, 50) : ''),
        )
        newOpp.set('etapa', 'lead')
        newOpp.set('origem_canal', 'whatsapp')
        newOpp.set('whatsapp_remetente', senderPhone)
        newOpp.set('whatsapp_mensagem', messageText)
        newOpp.set('trilha_prevista', 'opea')
        if (responsavelId) newOpp.set('responsavel', responsavelId)
        newOpp.set(
          'observacoes',
          '<p><strong>Demanda recebida via WhatsApp:</strong></p><p>' +
            messageText.replace(/\n/g, '<br/>') +
            '</p>',
        )
        $app.save(newOpp)
        oppId = newOpp.id
      } catch (oppCreateErr) {
        console.log('Erro ao criar nova oportunidade:', oppCreateErr.message)
      }
    } else {
      try {
        const existingOpp = $app.findRecordById('oportunidades', oppId)
        existingOpp.set('origem_canal', 'whatsapp')
        existingOpp.set('whatsapp_remetente', senderPhone)
        existingOpp.set('whatsapp_mensagem', messageText)
        $app.save(existingOpp)
      } catch (upErr) {
        console.log('Aviso ao atualizar oportunidade existente:', upErr.message)
      }
    }

    // 4. Registra no timeline / histórico de Atividades
    try {
      const ativCol = $app.findCollectionByNameOrId('atividades')
      const ativ = new Record(ativCol)
      ativ.set('usuario', responsavelId)
      ativ.set('tipo', 'whatsapp')
      ativ.set(
        'texto',
        'Mensagem WhatsApp recebida de ' +
          (senderName ? senderName + ' (' + senderPhone + ')' : senderPhone) +
          ': "' +
          (messageText.length > 200 ? messageText.slice(0, 197) + '...' : messageText) +
          '"',
      )
      if (clienteId) ativ.set('cliente', clienteId)
      if (oppId) ativ.set('oportunidade', oppId)
      $app.save(ativ)
    } catch (ativErr) {
      console.log('Aviso ao registrar atividade do WhatsApp:', ativErr.message)
    }

    // 5. Resposta Automática Humanizada (SDR)
    let autoReplyResult = { sent: false, skipped: true }
    let autoReplyActive = false
    let autoReplyCustom = ''

    try {
      const configRec = $app.findFirstRecordByData('whatsapp_config', 'chave', 'default')
      if (configRec) {
        autoReplyActive = configRec.getBool('auto_resposta_ativa')
        autoReplyCustom = configRec.getString('mensagem_auto_resposta')
      }
    } catch (_) {}

    if (autoReplyActive) {
      const textToSend =
        autoReplyCustom && autoReplyCustom.trim().length > 0
          ? autoReplyCustom
          : generateSdrGreeting(senderName, messageText)

      const dispatchRes = dispatchWhatsAppMessage(senderPhone, textToSend)
      autoReplyResult = dispatchRes

      if (dispatchRes.sent) {
        try {
          const ativCol = $app.findCollectionByNameOrId('atividades')
          const ativResposta = new Record(ativCol)
          ativResposta.set('usuario', responsavelId)
          ativResposta.set('tipo', 'whatsapp')
          ativResposta.set(
            'texto',
            'Resposta automática (SDR) enviada para ' +
              senderPhone +
              ': "' +
              textToSend.slice(0, 150) +
              '..."',
          )
          if (clienteId) ativResposta.set('cliente', clienteId)
          if (oppId) ativResposta.set('oportunidade', oppId)
          $app.save(ativResposta)
        } catch (_) {}
      }
    }

    return e.json(200, {
      status: 'success',
      cliente_id: clienteId,
      oportunidade_id: oppId,
      is_existente: isExistingOpp,
      remetente: senderPhone,
      auto_resposta: autoReplyResult,
    })
  } catch (err) {
    console.error('Erro crítico no webhook WhatsApp:', err.message)
    return e.json(200, {
      status: 'error_handled',
      error: err.message,
    })
  }
})

// 3. POST: Teste de envio autenticado pelo admin do CRM
routerAdd(
  'POST',
  '/backend/v1/whatsapp/test-send',
  (e) => {
    const sanitizePhone = (raw) => {
      if (!raw) return ''
      let cleaned = String(raw).replace(/\D/g, '')
      if (cleaned.length === 10 || cleaned.length === 11) {
        cleaned = '55' + cleaned
      }
      return cleaned
    }

    const dispatchWhatsAppMessage = (toPhone, messageText) => {
      const provider = ($os.getenv('WHATSAPP_PROVIDER') || 'meta').toLowerCase().trim()
      const cleanTo = sanitizePhone(toPhone)
      if (!cleanTo || !messageText) {
        return { sent: false, reason: 'Telefone ou mensagem vazios' }
      }

      if (provider === 'meta') {
        const token = $os.getenv('WHATSAPP_API_TOKEN')
        const phoneId = $os.getenv('WHATSAPP_PHONE_ID')
        if (!token || !phoneId) {
          return {
            sent: false,
            reason: 'Segredos WHATSAPP_API_TOKEN ou WHATSAPP_PHONE_ID não configurados no servidor',
          }
        }

        try {
          const url =
            'https://graph.facebook.com/v19.0/' + encodeURIComponent(phoneId) + '/messages'
          const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanTo,
            type: 'text',
            text: { preview_url: false, body: messageText },
          }

          const res = $http.send({
            url: url,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify(payload),
            timeout: 15,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            return { sent: true, provider: 'meta', response: res.json }
          }
          return { sent: false, statusCode: res.statusCode, raw: res.raw }
        } catch (err) {
          return { sent: false, error: err.message }
        }
      }

      if (provider === 'zapi') {
        const instanceId = $os.getenv('WHATSAPP_INSTANCE_ID') || $os.getenv('WHATSAPP_PHONE_ID')
        const token = $os.getenv('WHATSAPP_API_TOKEN') || $os.getenv('WHATSAPP_CLIENT_TOKEN')
        if (!instanceId || !token) {
          return {
            sent: false,
            reason:
              'Segredos WHATSAPP_INSTANCE_ID e WHATSAPP_API_TOKEN não configurados para Z-API',
          }
        }

        try {
          const url =
            'https://api.z-api.io/instances/' +
            encodeURIComponent(instanceId) +
            '/token/' +
            encodeURIComponent(token) +
            '/send-text'
          const payload = {
            phone: cleanTo,
            message: messageText,
          }

          const res = $http.send({
            url: url,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeout: 15,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            return { sent: true, provider: 'zapi', response: res.json }
          }
          return { sent: false, statusCode: res.statusCode, raw: res.raw }
        } catch (err) {
          return { sent: false, error: err.message }
        }
      }

      return {
        sent: false,
        reason:
          'Provedor ' +
          provider +
          ' sem segredos configurados (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_ID / WHATSAPP_INSTANCE_ID)',
      }
    }

    try {
      const authUser = e.auth || (e.requestInfo && e.requestInfo().auth)
      if (!authUser || !authUser.id) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const userRole = authUser.getString ? authUser.getString('role') : authUser.role
      if (userRole !== 'admin') {
        return e.json(403, { error: 'Apenas administradores podem testar o envio de WhatsApp' })
      }

      const body = e.requestInfo().body || {}
      const phone = sanitizePhone(body.phone)
      const message =
        body.message ||
        'Olá! Esta é uma mensagem de teste da integração artesanal WhatsApp da AEROCAD Consultoria.'

      if (!phone) {
        return e.json(400, { error: 'Número de telefone destinatário é obrigatório' })
      }

      const res = dispatchWhatsAppMessage(phone, message)
      return e.json(200, {
        resultado: res,
        destino: phone,
      })
    } catch (err) {
      return e.json(500, { error: err.message })
    }
  },
  $apis.requireAuth(),
)
