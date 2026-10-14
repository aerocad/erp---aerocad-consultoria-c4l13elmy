/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook HTTP para Processamento Contábil e Documental com IA Skip Cloud:
 * 1. POST /backend/v1/comprovantes/extrair (comprovantes fiscais, recibos, despesas)
 * 2. POST /backend/v1/boletos/extrair (boletos bancários em PDF ou foto JPG/PNG)
 * 3. POST /backend/v1/contratos/extrair (contratos de prestação de serviços / subcontratação em PDF)
 */

// 1. EXTRAÇÃO DE COMPROVANTES GERAIS
routerAdd(
  'POST',
  '/backend/v1/comprovantes/extrair',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

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
      const isPdf = ext === 'pdf'
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)

      if (!isPdf && !isImage) {
        return e.badRequestError(
          'Formato de arquivo não suportado. Envie uma foto (JPG, PNG, WEBP) ou PDF.',
        )
      }

      if (isPdf) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          if (docRes && docRes.markdown) {
            rawContent = docRes.markdown
          }
        } catch (docErr) {
          console.log('Tentativa de leitura de PDF via toMarkdown:', docErr.message)
        }
      }

      let promptMessage = ''
      if (rawContent && rawContent.trim().length > 0) {
        promptMessage = `Analise o seguinte conteúdo extraído do documento/comprovante fiscal (${fileName}) e retorne o JSON estruturado conforme as instruções do seu sistema:\n\n${rawContent.slice(0, 4000)}`
      } else {
        promptMessage = `Analise a foto/digitalização do comprovante fiscal anexado (${fileName}). Extraia fornecedor/razão social, CNPJ/CPF, data de emissão, número/série se houver, valor total, impostos destacados se houver, categoria sugerida de conta a pagar (despesas_operacionais, terceirizados, impostos, equipamentos, folha, outros), plano de contas sugerido, forma de pagamento e descrição resumida dos itens. Retorne em formato JSON conforme as diretrizes do sistema.`
      }

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
        const systemPrompt = `Você é um auditor contábil e fiscal do CRM AEROCAD. Analise o comprovante e retorne EXCLUSIVAMENTE um JSON puro no formato:
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
  "plano_contas_codigo": "3.1.4",
  "plano_contas_nome": "Despesas de Viagens e Campo",
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
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0])
          } catch (parseErr) {
            console.log('Falha ao parsear JSON retornado pelo agente:', parseErr.message)
          }
        }
      }

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
          plano_contas_codigo: '3.1.1',
          plano_contas_nome: 'Despesas Administrativas Gerais',
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
      return e.json(500, {
        error: 'Erro ao processar comprovante: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)

// 2. EXTRAÇÃO DE BOLETOS BANCÁRIOS (PDF ou FOTO JPG/PNG)
routerAdd(
  'POST',
  '/backend/v1/boletos/extrair',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.forbiddenError(
          'Apenas usuários Administrador ou Financeiro podem processar boletos bancários',
        )
      }

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Nenhum arquivo enviado para análise')
      }

      const file = files[0]
      const fileName = file.originalName || 'boleto'
      const ext = fileName.split('.').pop().toLowerCase()

      let rawContent = ''
      const isPdf = ext === 'pdf'
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)

      if (!isPdf && !isImage) {
        return e.badRequestError(
          'Formato de arquivo não suportado. Envie boleto em PDF ou foto (JPG/PNG).',
        )
      }

      if (isPdf) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          if (docRes && docRes.markdown) {
            rawContent = docRes.markdown
          }
        } catch (docErr) {
          console.log('Tentativa de leitura de Boleto PDF via toMarkdown:', docErr.message)
        }
      }

      const promptInstrucoes = `Você é o Auditor Financeiro da AEROCAD Engenharia e Consultoria Aeroportuária.
Analise com extrema precisão este boleto bancário (título de cobrança ou DAM/DARF/GPS).
Extraia:
1. beneficiario_fornecedor: Razão social, nome fantasia ou órgão emitente do boleto/guia.
2. cnpj_cpf_beneficiario: CNPJ ou CPF do beneficiário.
3. pagador_sacado: Nome do pagador (geralmente AEROCAD CONSULTORIA ou sócio).
4. linha_digitavel: Linha digitável do boleto (47 ou 48 dígitos numéricos, com ou sem pontos/espaços).
5. codigo_barras: Código de barras numérico se identificado.
6. numero_documento: Seu número, nosso número ou identificador do título.
7. valor_documento: Valor nominal do boleto a pagar em número decimal (ex: 850.00).
8. valor_desconto: Descontos/abatimentos previstos até o vencimento (ou 0).
9. valor_juros_multa: Juros, mora ou multa calculada (ou 0).
10. valor_cobrado: Valor final líquido previsto a pagar.
11. data_vencimento: Data de vencimento no formato ISO AAAA-MM-DD.
12. data_documento: Data do documento ou processamento no formato ISO AAAA-MM-DD.
13. banco_emissor: Nome do banco (ex: Banco do Brasil, Bradesco, Itaú, Santander, Caixa).
14. categoria_sugerida: Uma de: 'despesas_operacionais', 'terceirizados', 'impostos', 'equipamentos', 'folha', 'outros'.
15. plano_contas_codigo: Código no plano de contas da engenharia (ex: '3.1.1' para taxas/cartório, '3.2.1' para honorários de terceiros, '3.3.1' para tributos federais, '3.4.1' para softwares/equipamentos).
16. plano_contas_nome: Nome da rubrica contábil.
17. instrucoes_resumo: Resumo das instruções de pagamento (ex: Não receber após o vencimento).

Responda EXCLUSIVAMENTE em formato JSON puro, sem markdown adicional:
{
  "sucesso": true,
  "beneficiario_fornecedor": "...",
  "cnpj_cpf_beneficiario": "...",
  "pagador_sacado": "...",
  "linha_digitavel": "...",
  "codigo_barras": "...",
  "numero_documento": "...",
  "valor_documento": 0.0,
  "valor_desconto": 0.0,
  "valor_juros_multa": 0.0,
  "valor_cobrado": 0.0,
  "data_vencimento": "AAAA-MM-DD",
  "data_documento": "AAAA-MM-DD",
  "banco_emissor": "...",
  "categoria_sugerida": "despesas_operacionais",
  "plano_contas_codigo": "3.1.1",
  "plano_contas_nome": "Despesas Administrativas",
  "instrucoes_resumo": "...",
  "confianca": "alta"
}`

      let userMsg = ''
      if (rawContent && rawContent.trim().length > 0) {
        userMsg = `Conteúdo extraído do boleto (${fileName}):\n\n${rawContent.slice(0, 4000)}`
      } else {
        userMsg = `Analise este arquivo de boleto bancário (${fileName}). Extraia linha digitável de 47/48 dígitos, beneficiário, CNPJ, vencimento, valor e juros/multa.`
      }

      let agentResult = null
      let extractedData = null

      try {
        agentResult = $ai.agent('extrator-comprovantes').chat({
          user_id: authUser.id,
          conversation_id: null,
          message: `${promptInstrucoes}\n\n${userMsg}`,
        })
      } catch (agentErr) {
        console.log('Agente falhou para boleto, usando fallback $ai.chat:', agentErr.message)
        const fallbackReply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: promptInstrucoes },
            { role: 'user', content: userMsg },
          ],
        })
        if (fallbackReply && fallbackReply.choices && fallbackReply.choices[0]) {
          agentResult = { content: fallbackReply.choices[0].message.content }
        }
      }

      if (agentResult && agentResult.content) {
        const text = agentResult.content.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0])
          } catch (pErr) {
            console.log('Falha ao parsear JSON boleto:', pErr.message)
          }
        }
      }

      if (!extractedData) {
        extractedData = {
          sucesso: false,
          beneficiario_fornecedor: '',
          cnpj_cpf_beneficiario: '',
          linha_digitavel: '',
          codigo_barras: '',
          numero_documento: '',
          valor_documento: 0,
          valor_desconto: 0,
          valor_juros_multa: 0,
          valor_cobrado: 0,
          data_vencimento: new Date().toISOString().slice(0, 10),
          data_documento: new Date().toISOString().slice(0, 10),
          banco_emissor: '',
          categoria_sugerida: 'despesas_operacionais',
          plano_contas_codigo: '3.1.1',
          plano_contas_nome: 'Despesas Administrativas Gerais',
          instrucoes_resumo: '',
          confianca: 'baixa',
        }
      }

      return e.json(200, {
        sucesso: extractedData.sucesso !== false,
        dados: extractedData,
      })
    } catch (err) {
      console.log('Erro no endpoint /backend/v1/boletos/extrair:', err.message)
      return e.json(500, {
        error: 'Erro ao processar boleto: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)

// 3. EXTRAÇÃO DE CONTRATOS EM PDF
routerAdd(
  'POST',
  '/backend/v1/contratos/extrair',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'financeiro' && role !== 'comercial') {
        return e.forbiddenError('Acesso restrito para processamento de contratos')
      }

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Nenhum arquivo de contrato enviado')
      }

      const file = files[0]
      const fileName = file.originalName || 'contrato.pdf'
      const ext = fileName.split('.').pop().toLowerCase()

      if (ext !== 'pdf') {
        return e.badRequestError('O contrato deve ser um arquivo em formato PDF.')
      }

      let markdownContent = ''
      try {
        const docRes = $documents.toMarkdown({ file: file })
        if (docRes && docRes.markdown) {
          markdownContent = docRes.markdown
        }
      } catch (docErr) {
        console.log('toMarkdown falhou para contrato:', docErr.message)
      }

      if (!markdownContent || markdownContent.trim().length === 0) {
        return e.json(200, {
          sucesso: false,
          aviso:
            'Não foi possível extrair a camada de texto do PDF (possível documento escaneado/imagem). Você pode preencher os dados manualmente na ficha do contrato.',
          dados: {
            numero: '',
            titulo: fileName.replace(/\.pdf$/i, ''),
            tipo_contrato: 'cliente',
            partes_envolvidas: '',
            objeto: '',
            valor_global: 0,
            forma_pagamento_texto: '',
            parcelas_sugeridas: [],
            data_assinatura: new Date().toISOString().slice(0, 10),
            data_inicio_vigencia: new Date().toISOString().slice(0, 10),
            data_termino_vigencia: '',
            indice_reajuste: 'IPCA / IBGE anual',
            garante_fiador: '',
            confianca: 'baixa',
          },
        })
      }

      const promptSystem = `Você é o Auditor Jurídico e Contábil da AEROCAD Consultoria Aeroportuária.
Analise o texto completo deste contrato de prestação de serviços ou subcontratação técnica.
Extraia com precisão e retorne EXCLUSIVAMENTE um JSON com os seguintes campos:
{
  "sucesso": true,
  "numero": "Número de identificação do contrato se houver (ex: CT-2026/042)",
  "titulo": "Título sucinto do contrato (ex: Contrato de Consultoria em Proteção ao Voo - Aeródromo X)",
  "tipo_contrato": "cliente" | "prestador_fornecedor" | "parceria_tecnica" | "outro",
  "partes_envolvidas": "Contratante e Contratada com CNPJs",
  "objeto": "Descrição clara do objeto contratual e escopo dos serviços",
  "valor_global": 0.0,
  "forma_pagamento_texto": "Descrição das condições de pagamento e parcelamento",
  "parcelas_sugeridas": [
    { "descricao": "Entrada / Assinatura", "valor": 0.0, "vencimento_dias": 15 },
    { "descricao": "Entrega Relatório Técnico", "valor": 0.0, "vencimento_dias": 45 }
  ],
  "data_assinatura": "AAAA-MM-DD",
  "data_inicio_vigencia": "AAAA-MM-DD",
  "data_termino_vigencia": "AAAA-MM-DD",
  "indice_reajuste": "Índice de reajuste (ex: IPCA/IBGE a cada 12 meses)",
  "garante_fiador": "Fiador ou garantia contratual se houver, ou vazio",
  "confianca": "alta"
}`

      const userText = `Texto do contrato (${fileName}):\n\n${markdownContent.slice(0, 8000)}`

      const aiReply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: userText },
        ],
      })

      let extracted = null
      if (aiReply && aiReply.choices && aiReply.choices[0]) {
        const text = aiReply.choices[0].message.content.trim()
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            extracted = JSON.parse(match[0])
          } catch (pErr) {
            console.log('Falha ao parsear JSON contrato:', pErr.message)
          }
        }
      }

      if (!extracted) {
        extracted = {
          sucesso: false,
          numero: '',
          titulo: fileName.replace(/\.pdf$/i, ''),
          tipo_contrato: 'cliente',
          partes_envolvidas: '',
          objeto: '',
          valor_global: 0,
          forma_pagamento_texto: '',
          parcelas_sugeridas: [],
          data_assinatura: new Date().toISOString().slice(0, 10),
          data_inicio_vigencia: new Date().toISOString().slice(0, 10),
          data_termino_vigencia: '',
          indice_reajuste: 'IPCA / IBGE anual',
          garante_fiador: '',
          confianca: 'baixa',
        }
      }

      return e.json(200, {
        sucesso: extracted.sucesso !== false,
        dados: extracted,
      })
    } catch (err) {
      console.log('Erro no endpoint /backend/v1/contratos/extrair:', err.message)
      return e.json(500, {
        error: 'Erro ao processar contrato: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
