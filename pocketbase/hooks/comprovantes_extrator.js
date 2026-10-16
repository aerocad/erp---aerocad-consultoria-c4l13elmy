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

      // Leitura de metadados de pré-processamento enviados pelo cliente
      let preProcessado = false
      let dimensoesInfo = ''
      try {
        const body = e.requestInfo().body || {}
        if (body.pre_processado === 'true' || body.pre_processado === true) {
          preProcessado = true
        }
        if (body.dimensoes_originais) {
          dimensoesInfo =
            typeof body.dimensoes_originais === 'string'
              ? body.dimensoes_originais
              : JSON.stringify(body.dimensoes_originais)
        }
      } catch (_) {}

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
      const contextoOtimizacao = preProcessado
        ? ` (Imagem pré-processada com realce de contraste +12% e redimensionamento para leitura de documento fiscal/cupom${dimensoesInfo ? ', dimensões originais: ' + dimensoesInfo : ''})`
        : ''

      if (rawContent && rawContent.trim().length > 0) {
        promptMessage = `Analise o seguinte conteúdo extraído do documento fiscal (${fileName}${contextoOtimizacao}).
Pode ser um DANFE (NF-e formato A4), um Cupom Fiscal (NFC-e/SAT) ou outro comprovante fiscal:
- Se for DANFE NF-e: extraia Emitente, CNPJ, Destinatário, Número, Série, Chave de Acesso de 44 dígitos, Data de Emissão, Valor Total, Impostos, Itens e condições de pagamento.
- Se for Cupom Fiscal (NFC-e/SAT): extraia Estabelecimento, CNPJ, Número/Extrato, Chave de Acesso de 44 dígitos se houver, Itens, Valor Total e Forma de Pagamento.
Classifique contabilmente no Plano de Contas AEROCAD e retorne o JSON estruturado puro conforme suas instruções:\n\n${rawContent.slice(0, 4500)}`
      } else {
        promptMessage = `Analise a foto/digitalização do documento fiscal anexado (${fileName}${contextoOtimizacao}).
Pode ser um DANFE (Nota Fiscal Eletrônica NF-e em folha A4), Cupom Fiscal Eletrônico (NFC-e / SAT-CF-e / ECF) ou Recibo:
1. Identifique o tipo de documento: "nfe" (se for DANFE em papel A4), "cupom_fiscal" (se for cupom térmico NFC-e/SAT) ou outro.
2. Fornecedor / Razão Social e Nome Fantasia do emitente.
3. CNPJ do emitente (14 dígitos formatados).
4. Destinatário / Tomador (razão social e CNPJ/CPF se houver).
5. Data de emissão (AAAA-MM-DD).
6. Número do documento (NF-e nº, Cupom nº, Extrato nº) e série se constar.
7. Chave de acesso de 44 dígitos (leia com extrema atenção no cabeçalho ou rodapé do documento).
8. Valor total da nota / valor pago (R$) e impostos destacados.
9. Forma de pagamento sugerida (pix, boleto, cartao_credito, cartao_debito, dinheiro, ted_doc, outro).
10. Descrição sucinta dos itens e lista detalhada se visível.
11. Categoria AEROCAD (despesas_operacionais, terceirizados, impostos, equipamentos, folha, outros) e código do Plano de Contas (ex: 3.1.4 para despesas de campo/viagem, 3.2.1 para terceiros de engenharia, 3.1.1 administrativo, 3.4.1 equipamentos).
Retorne EXCLUSIVAMENTE o JSON estruturado puro.`
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
        const systemPrompt = `Você é um auditor contábil e fiscal do CRM AEROCAD especializado em cupons fiscais (NFC-e, SAT), comprovantes PIX, recibos e notas fiscais.
Analise a imagem/documento e retorne EXCLUSIVAMENTE um JSON puro:
{
  "sucesso": true,
  "tipo_documento": "cupom_fiscal",
  "fornecedor": "Razão Social ou Nome do Estabelecimento",
  "cnpj_cpf": "00.000.000/0000-00",
  "data_emissao": "AAAA-MM-DD",
  "numero_documento": "COO/CCF ou NFC-e nº",
  "valor_total": 0.0,
  "valor_impostos": null,
  "forma_pagamento_sugerida": "pix",
  "categoria_sugerida": "despesas_operacionais",
  "plano_contas_codigo": "3.1.4",
  "plano_contas_nome": "Despesas de Viagens e Campo",
  "descricao_itens": "Resumo claro dos itens (ex: Abastecimento Gasolina Comum)",
  "observacoes": "Chave de acesso se houver ou detalhes adicionais",
  "confianca": "alta"
}
Se os dados não puderem ser identificados, defina sucesso=false, fornecedor="", valor_total=0 e erro="Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF".`

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
            'Não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF.',
          confianca: 'baixa',
          erro: 'não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF',
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

// 1.1 CONSULTA DE QR CODE FISCAL (SEFAZ / SAT / NFC-E / DANFE)
routerAdd(
  'POST',
  '/backend/v1/fiscal/consultar-qr',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.forbiddenError(
          'Apenas usuários Administrador ou Financeiro podem processar consultas fiscais',
        )
      }

      const body = e.requestInfo().body || {}
      const qrRaw = (body.qr_content || body.url || '').trim()

      if (!qrRaw) {
        return e.badRequestError('Conteúdo do QR code não informado (qr_content)')
      }

      // Função utilitária para extrair chave de 44 dígitos
      function extrairChave44(texto) {
        if (!texto) return ''
        // Tenta achar 44 dígitos contínuos
        const matchContinuo = texto.match(/\b\d{44}\b/)
        if (matchContinuo) return matchContinuo[0]

        // Tenta achar em query param: chNFe=..., p=..., chave=...
        const paramMatch = texto.match(/(?:chNFe|chave|p|C)=([0-9]{44})/i)
        if (paramMatch) return paramMatch[1]

        // Procura padrão SEFAZ versão 2 onde p=35...|2|1|1|...
        const pMatch = texto.match(/[?&]p=([0-9]{44})[|%7C]/i)
        if (pMatch) return pMatch[1]

        return ''
      }

      // Decompõe a chave de 44 dígitos se encontrada
      function decomporChave(chave) {
        if (!chave || chave.length !== 44) return null
        const ufs = {
          11: 'RO',
          12: 'AC',
          13: 'AM',
          14: 'RR',
          15: 'PA',
          16: 'AP',
          17: 'TO',
          21: 'MA',
          22: 'PI',
          23: 'CE',
          24: 'RN',
          25: 'PB',
          26: 'PE',
          27: 'AL',
          28: 'SE',
          29: 'BA',
          31: 'MG',
          32: 'ES',
          33: 'RJ',
          35: 'SP',
          41: 'PR',
          42: 'SC',
          43: 'RS',
          50: 'MS',
          51: 'MT',
          52: 'GO',
          53: 'DF',
        }
        const cUF = chave.substring(0, 2)
        const aamm = chave.substring(2, 6)
        const ano = '20' + aamm.substring(0, 2)
        const mes = aamm.substring(2, 4)
        const cnpjCru = chave.substring(6, 20)
        const modelo = chave.substring(20, 22)
        const serie = chave.substring(22, 25).replace(/^0+/, '') || '1'
        const nNF = chave.substring(25, 34).replace(/^0+/, '') || ''

        const cnpjFmt = cnpjCru.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        const tipoDoc = modelo === '65' ? 'cupom_fiscal' : modelo === '59' ? 'cupom_fiscal' : 'nfe'

        return {
          chave,
          uf: ufs[cUF] || cUF,
          ano_mes: `${ano}-${mes}`,
          data_aproximada: `${ano}-${mes}-01`,
          cnpj_emitente: cnpjFmt,
          cnpj_cru: cnpjCru,
          modelo,
          tipo_documento: tipoDoc,
          serie,
          numero_documento: nNF,
        }
      }

      // Análise do QR code (pode ser SAT pipe ou URL SEFAZ)
      const chaveDetectada = extrairChave44(qrRaw)
      const decomposicao = chaveDetectada ? decomporChave(chaveDetectada) : null

      // Se for padrão SAT CF-e (pipe: chave|datahora|valor|cpf...)
      if (qrRaw.includes('|') && !qrRaw.startsWith('http')) {
        const partes = qrRaw.split('|')
        const chaveSat = partes[0] ? extrairChave44(partes[0]) : ''
        const dataHoraStr = partes[1] || '' // AAAAMMDDHHMMSS
        const valorSatStr = partes[2] || ''
        const cpfCnpjDest = partes[3] || ''

        let dataEmissaoSat = new Date().toISOString().slice(0, 10)
        if (dataHoraStr.length >= 8) {
          dataEmissaoSat = `${dataHoraStr.substring(0, 4)}-${dataHoraStr.substring(4, 6)}-${dataHoraStr.substring(6, 8)}`
        }

        const valorTotalNum = parseFloat(valorSatStr.replace(',', '.')) || 0
        const decompostoSat = chaveSat ? decomporChave(chaveSat) : null

        return e.json(200, {
          sucesso: true,
          origem: 'sat_qrcode_pipe',
          chave_acesso: chaveSat,
          dados: {
            tipo_documento: 'cupom_fiscal',
            fornecedor: decompostoSat ? `Fornecedor CNPJ ${decompostoSat.cnpj_emitente}` : '',
            cnpj_cpf: decompostoSat ? decompostoSat.cnpj_emitente : '',
            data_emissao: dataEmissaoSat,
            numero_documento: decompostoSat ? decompostoSat.numero_documento : '',
            serie: decompostoSat ? decompostoSat.serie : '',
            chave_acesso: chaveSat,
            destinatario: cpfCnpjDest ? `Destinatário doc ${cpfCnpjDest}` : '',
            cnpj_destinatario: cpfCnpjDest,
            valor_total: valorTotalNum,
            valor_impostos: null,
            forma_pagamento_sugerida: 'pix',
            categoria_sugerida: 'despesas_operacionais',
            plano_contas_codigo: '3.1.4',
            plano_contas_nome: 'Despesas de Viagens e Campo',
            descricao_itens: 'Despesa Cupom Fiscal Eletrônico SAT (Extrato)',
            observacoes: `Chave SAT: ${chaveSat}`,
            confianca: 'alta',
          },
          portal_consultado: false,
          mensagem: 'Dados fiscais decodificados diretamente da estrutura oficial do QR Code SAT.',
        })
      }

      // Se o QR Code for uma URL
      const isUrl = qrRaw.startsWith('http://') || qrRaw.startsWith('https://')
      let dadosFinais = {
        tipo_documento: decomposicao ? decomposicao.tipo_documento : 'cupom_fiscal',
        fornecedor: decomposicao ? `Fornecedor CNPJ ${decomposicao.cnpj_emitente}` : '',
        cnpj_cpf: decomposicao ? decomposicao.cnpj_emitente : '',
        data_emissao: decomposicao
          ? decomposicao.data_aproximada
          : new Date().toISOString().slice(0, 10),
        numero_documento: decomposicao ? decomposicao.numero_documento : '',
        serie: decomposicao ? decomposicao.serie : '',
        chave_acesso: chaveDetectada,
        destinatario: '',
        cnpj_destinatario: '',
        valor_total: 0,
        valor_impostos: null,
        forma_pagamento_sugerida: 'pix',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.4',
        plano_contas_nome: 'Despesas de Viagens e Campo',
        descricao_itens: decomposicao
          ? `Nota Fiscal ${decomposicao.modelo === '65' ? 'NFC-e' : 'NF-e'} nº ${decomposicao.numero_documento}`
          : 'Documento Fiscal lido por QR Code',
        observacoes: chaveDetectada ? `Chave de Acesso: ${chaveDetectada}` : '',
        confianca: chaveDetectada ? 'media' : 'baixa',
      }

      let portalAcessado = false
      let portalErro = null
      let htmlPublico = ''

      // Tentativa de consulta no portal público com timeout curto
      if (isUrl) {
        try {
          const httpRes = $http.send({
            url: qrRaw,
            method: 'GET',
            timeout: 5, // 5 segundos
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          })

          if (httpRes && httpRes.statusCode >= 200 && httpRes.statusCode < 300 && httpRes.raw) {
            portalAcessado = true
            htmlPublico = (httpRes.raw || '').slice(0, 8000)
          } else {
            portalErro = `Portal SEFAZ retornou status HTTP ${httpRes ? httpRes.statusCode : 'sem resposta'}`
          }
        } catch (fetchErr) {
          portalErro = `Não foi possível acessar diretamente o portal SEFAZ (${fetchErr.message || 'tempo limite excedido ou bloqueio de bot/captcha'})`
        }
      }

      // Se conseguimos obter o HTML público da SEFAZ, usamos a IA para extrair Razão Social, Itens e Valores
      if (portalAcessado && htmlPublico.trim().length > 100) {
        try {
          const promptSefaz = `Você é o Auditor Fiscal do CRM AEROCAD. Analise este trecho HTML retornado da consulta pública de NFC-e/NF-e da SEFAZ e extraia os dados da nota:
${htmlPublico}

Chave de acesso conhecida: ${chaveDetectada || 'não informada'}
Retorne EXCLUSIVAMENTE um JSON puro:
{
  "sucesso": true,
  "tipo_documento": "cupom_fiscal",
  "fornecedor": "Razão Social do Emitente",
  "cnpj_cpf": "CNPJ formatado",
  "data_emissao": "AAAA-MM-DD",
  "numero_documento": "Número da nota",
  "serie": "Série",
  "valor_total": 0.0,
  "valor_impostos": 0.0,
  "forma_pagamento_sugerida": "pix",
  "descricao_itens": "Resumo dos itens principais faturados",
  "observacoes": "Chave de acesso e informações SEFAZ"
}`
          const aiReply = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content: 'Você extrai dados fiscais de páginas públicas SEFAZ. Retorne JSON puro.',
              },
              { role: 'user', content: promptSefaz },
            ],
          })

          if (aiReply && aiReply.choices && aiReply.choices[0]) {
            const replyText = aiReply.choices[0].message.content.trim()
            const match = replyText.match(/\{[\s\S]*\}/)
            if (match) {
              const dadosParseados = JSON.parse(match[0])
              if (dadosParseados && dadosParseados.sucesso !== false) {
                dadosFinais = {
                  ...dadosFinais,
                  ...dadosParseados,
                  chave_acesso: chaveDetectada || dadosParseados.chave_acesso || '',
                  confianca: 'alta',
                }
              }
            }
          }
        } catch (aiErr) {
          console.log('Falha na interpretação do HTML SEFAZ por IA:', aiErr.message)
        }
      }

      // Monta mensagem amigável explicando o que foi lido e se o portal precisou de conferência manual
      let mensagemRetorno = ''
      if (
        chaveDetectada &&
        portalAcessado &&
        dadosFinais.fornecedor &&
        dadosFinais.valor_total > 0
      ) {
        mensagemRetorno =
          'Dados fiscais completos extraídos da consulta pública da SEFAZ via QR Code!'
      } else if (chaveDetectada) {
        mensagemRetorno = `Chave de acesso de 44 dígitos (${chaveDetectada.slice(0, 4)}...${chaveDetectada.slice(-4)}) e dados estruturais identificados pelo QR Code. ${portalErro ? 'O portal da SEFAZ requer conferência manual (' + portalErro + ').' : 'Confira os campos antes de salvar.'}`
      } else {
        mensagemRetorno =
          'QR Code lido, mas não foi possível extrair a chave de 44 dígitos da SEFAZ. Faça a conferência manual dos dados.'
      }

      return e.json(200, {
        sucesso: true,
        origem: 'qrcode_sefaz',
        chave_acesso: chaveDetectada,
        portal_consultado: portalAcessado,
        aviso_portal: portalErro,
        dados: dadosFinais,
        mensagem: mensagemRetorno,
      })
    } catch (err) {
      console.log('Erro no endpoint /backend/v1/fiscal/consultar-qr:', err.message)
      return e.json(500, {
        error: 'Erro ao consultar QR code fiscal: ' + (err.message || 'desconhecido'),
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

      // Leitura de metadados de pré-processamento
      let preProcessadoBoleto = false
      try {
        const body = e.requestInfo().body || {}
        if (body.pre_processado === 'true' || body.pre_processado === true) {
          preProcessadoBoleto = true
        }
      } catch (_) {}

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
      const obsOtimizacao = preProcessadoBoleto
        ? ' (Foto pré-processada com otimização de contraste)'
        : ''
      if (rawContent && rawContent.trim().length > 0) {
        userMsg = `Conteúdo extraído do boleto (${fileName}${obsOtimizacao}):\n\n${rawContent.slice(0, 4000)}`
      } else {
        userMsg = `Analise este arquivo de boleto bancário (${fileName}${obsOtimizacao}). Extraia linha digitável de 47/48 dígitos, beneficiário, CNPJ, vencimento, valor e juros/multa.`
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
          erro: 'não foi possível ler o boleto — aproxime a câmera, garanta boa iluminação ou anexe o PDF com código de barras nítido',
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
