/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook HTTP para Processamento de Comprovantes com o Agente Nativo Skip Cloud
 * Rota: POST /backend/v1/comprovantes/extrair
 * Suporta fotos (JPEG/PNG/WEBP) e arquivos em PDF.
 * Usa o agente nativo "extrator-comprovantes" e visão computacional Skip AI.
 */

routerAdd(
  'POST',
  '/backend/v1/comprovantes/extrair',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      // Restrição de perfil: apenas admin e financeiro
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.forbiddenError(
          'Apenas usuários Administrador ou Financeiro podem processar comprovantes',
        )
      }

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Nenhum arquivo enviado para análise')
      }

      const file = files[0]
      const fileName = file.originalName || 'comprovante'
      const ext = fileName.split('.').pop().toLowerCase()

      let rawContent = ''
      let isPdf = ext === 'pdf'
      let isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)

      if (!isPdf && !isImage) {
        return e.badRequestError(
          'Formato de arquivo não suportado. Envie uma foto (JPG, PNG, WEBP) ou PDF.',
        )
      }

      // Se for PDF com camada de texto, tenta converter com $documents.toMarkdown
      if (isPdf) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          if (docRes && docRes.markdown) {
            rawContent = docRes.markdown
          }
        } catch (docErr) {
          console.log('Tentativa de leitura de PDF via toMarkdown:', docErr.message)
          // Se for PDF escaneado (sem texto OCR), podemos extrair via mensagem direta
        }
      }

      // Mensagem para o agente nativo
      let promptMessage = ''
      if (rawContent && rawContent.trim().length > 0) {
        promptMessage = `Analise o seguinte conteúdo extraído do documento/comprovante fiscal (${fileName}) e retorne o JSON estruturado conforme as instruções do seu sistema:\n\n${rawContent.slice(0, 4000)}`
      } else {
        promptMessage = `Analise a foto/digitalização do comprovante fiscal anexado (${fileName}). Extraia fornecedor/razão social, CNPJ/CPF, data de emissão, número/série se houver, valor total, impostos destacados se houver, categoria sugerida de conta a pagar (despesas_operacionais, terceirizados, impostos, equipamentos, folha, outros), forma de pagamento e descrição resumida dos itens. Retorne em formato JSON conforme as diretrizes do sistema.`
      }

      // Conversação com o agente nativo 'extrator-comprovantes'
      let agentResult = null
      let extractedData = null

      try {
        agentResult = $ai.agent('extrator-comprovantes').chat({
          user_id: authUser.id,
          conversation_id: null,
          message: promptMessage,
        })
      } catch (agentErr) {
        console.log(
          'Chamada agente nativo falhou, tentando fallback com $ai.chat:',
          agentErr.message,
        )
        // Fallback robusto com $ai.chat
        const systemPrompt = `Você é um auditor contábil e fiscal. Analise o comprovante e retorne EXCLUSIVAMENTE um JSON puro no formato:
{
  "sucesso": true,
  "tipo_documento": "cupom_fiscal",
  "fornecedor": "Nome do fornecedor",
  "cnpj_cpf": "",
  "data_emissao": "AAAA-MM-DD",
  "numero_documento": "",
  "valor_total": 0.0,
  "valor_impostos": null,
  "forma_pagamento_sugerida": "pix",
  "categoria_sugerida": "despesas_operacionais",
  "descricao_itens": "Resumo dos itens",
  "observacoes": "",
  "confianca": "alta"
}`

        const fallbackReply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptMessage },
          ],
        })

        if (fallbackReply && fallbackReply.choices && fallbackReply.choices[0]) {
          agentResult = { content: fallbackReply.choices[0].message.content }
        }
      }

      if (agentResult && agentResult.content) {
        const text = agentResult.content.trim()
        // Limpar possíveis delimitadores de markdown ```json ... ```
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0])
          } catch (parseErr) {
            console.log('Falha ao parsear JSON retornado pelo agente:', parseErr.message)
          }
        }
      }

      // Se não conseguiu estruturar, fornecer fallback com dados mínimos extraídos do arquivo
      if (!extractedData) {
        extractedData = {
          sucesso: false,
          tipo_documento: 'outro',
          fornecedor: '',
          cnpj_cpf: '',
          data_emissao: new Date().toISOString().slice(0, 10),
          numero_documento: '',
          valor_total: 0,
          valor_impostos: null,
          forma_pagamento_sugerida: 'pix',
          categoria_sugerida: 'despesas_operacionais',
          descricao_itens: fileName.replace(/\.[^/.]+$/, ''),
          observacoes:
            'Dados não puderam ser extraídos automaticamente com total clareza. Preencha ou confirme manualmente.',
          confianca: 'baixa',
        }
      }

      return e.json(200, {
        sucesso: extractedData.sucesso !== false,
        dados: extractedData,
        raw_agent_reply: agentResult ? agentResult.content : null,
      })
    } catch (err) {
      console.log('Erro geral no endpoint /backend/v1/comprovantes/extrair:', err.message)
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha no processamento do comprovante' : err.message,
        })
      }
      return e.json(500, {
        error: 'Erro ao processar comprovante: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
