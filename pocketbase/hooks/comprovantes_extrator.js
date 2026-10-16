/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook HTTP para Processamento Contábil e Documental com IA Skip Cloud:
 * 1. POST /backend/v1/comprovantes/extrair (comprovantes fiscais, recibos, despesas)
 * 2. POST /backend/v1/fiscal/consultar-qr (consulta SEFAZ / decodificação de QR code fiscal)
 * 3. POST /backend/v1/boletos/extrair (boletos bancários em PDF ou foto JPG/PNG)
 * 4. POST /backend/v1/contratos/extrair (contratos de prestação de serviços / subcontratação em PDF)
 *
 * REGRA CRÍTICA DO RUNTIME POCKETBASE (JSVM):
 * O PocketBase executa callbacks de rotas em pools isoladas de JSVM.
 * Funções e variáveis declaradas no escopo top-level NÃO são acessíveis em runtime dentro dos callbacks.
 * TODA a lógica, funções utilitárias e constantes auxiliares devem ser declaradas INLINE dentro do corpo
 * de cada callback registrado com routerAdd.
 */

// 1. EXTRAÇÃO DE COMPROVANTES GERAIS
routerAdd(
  'POST',
  '/backend/v1/comprovantes/extrair',
  (e) => {
    // Função utilitária inline de inferência de categoria por estabelecimento
    function inferirCategoriaEstabelecimento(nome, cnpj, descItens) {
      const texto = ((nome || '') + ' ' + (descItens || '')).toLowerCase()
      const regras = [
        {
          termos: [
            'posto',
            'combustivel',
            'gasolina',
            'etanol',
            'diesel',
            'ipiranga',
            'petrobras',
            'shell',
            'vibra',
            'raizen',
            'auto posto',
            'autoposto',
            'abastecedora',
          ],
          segmento: 'Combustíveis & Lubrificantes',
          produto: 'Combustíveis e abastecimento de veículos em campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'restaurante',
            'churrascaria',
            'pizzaria',
            'lanchonete',
            'refeicao',
            'refeicoes',
            'bife',
            'buffet',
            'bistro',
            'mcdonald',
            'burger king',
            'subway',
            'habib',
            'grill',
          ],
          segmento: 'Alimentação & Restaurantes',
          produto: 'Despesas com refeições e alimentação da equipe',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'supermercado',
            'mercado',
            'mercearia',
            'hipermercado',
            'atacadao',
            'assai',
            'carrefour',
            'pao de acucar',
            'extra',
            'muffato',
            'savegnago',
            'hortifruti',
          ],
          segmento: 'Alimentação / Supermercados',
          produto: 'Gêneros alimentícios e insumos de copa/campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'padaria',
            'panificadora',
            'panificacao',
            'confeitaria',
            'cafeteria',
            'cafe',
            'coffee',
          ],
          segmento: 'Panificação & Confeitaria',
          produto: 'Despesas com café da manhã e panificação em trânsito',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'farmacia',
            'drogaria',
            'drogasil',
            'raia',
            'pacheco',
            'pague menos',
            'panvel',
            'medicamentos',
          ],
          segmento: 'Saúde & Farmácia',
          produto: 'Medicamentos básicos, primeiros socorros e itens de higiene',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['estacionamento', 'garagem', 'park', 'parking', 'estapar', 'valet'],
          segmento: 'Estacionamento & Garagem',
          produto: 'Estacionamento de veículos técnicos / diárias em aeroportos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'pedagio',
            'sem parar',
            'conectcar',
            'veloe',
            'concessionaria de rodovias',
            'ccr',
            'ecorodovias',
            'arteris',
          ],
          segmento: 'Pedágio & Rodovias',
          produto: 'Tarifas de pedágio em deslocamento técnico rodoviário',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'papelaria',
            'kalunga',
            'livraria',
            'copiadora',
            'suprimentos',
            'materiais para escritorio',
          ],
          segmento: 'Material de Consumo & Escritório',
          produto: 'Material de consumo, papelaria técnica e suprimentos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'hotel',
            'hoteis',
            'pousada',
            'resort',
            'ibis',
            'accor',
            'mercure',
            'novotel',
            'hospedagem',
            'airbnb',
          ],
          segmento: 'Hospedagem & Hotelaria',
          produto: 'Diárias de hospedagem e hotel em missões de campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'latam',
            'gol linhas',
            'azul linhas',
            'voepass',
            'passagem aerea',
            'aeroporto',
            'infraero',
            'aena',
            'fraport',
            'zurich airport',
          ],
          segmento: 'Passagens & Transporte Aéreo',
          produto: 'Passagens aéreas, taxas aeroportuárias e despacho de bagagem técnica',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'localiza',
            'movida',
            'unidas',
            'locadora de veiculos',
            'aluguel de carros',
            'rent a car',
          ],
          segmento: 'Locação de Veículos',
          produto: 'Aluguel de veículos utilitários e 4x4 para vistoria em sítios aeroportuários',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['uber', '99 tecnologia', '99app', 'radiotaxi', 'taxi'],
          segmento: 'Transporte Urbano & Aplicativos',
          produto: 'Deslocamentos urbanos por aplicativo ou táxi',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['grafica', 'plotagem', 'ploter', 'reprografia', 'plantas tecnicas'],
          segmento: 'Gráfica & Plotagem Técnica',
          produto: 'Plotagem de pranchas CAD A0/A1 e encadernações técnicas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'ferragens',
            'ferramentas',
            'materiais de construcao',
            'leroy merlin',
            'tintas',
            'epi',
            'equipamentos de protecao',
          ],
          segmento: 'Ferramentas, EPI & Materiais',
          produto: 'Equipamentos de proteção individual (EPI), trenas e ferramentas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['kabum', 'dell', 'lenovo', 'computadores', 'informatica', 'hardware'],
          segmento: 'Equipamentos de TI & Hardware',
          produto: 'Hardware, periféricos e peças de computador de engenharia',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: [
            'autodesk',
            'microsoft',
            'google cloud',
            'aws',
            'software',
            'adobe',
            'chatgpt',
            'openai',
            'bentley',
            'trimble',
          ],
          segmento: 'Softwares & Licenças Técnicas',
          produto: 'Assinaturas de software CAD/BIM, nuvem e ferramentas de cálculo',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: ['cartorio', 'tabelionato', 'registro de imoveis', 'tabeliao'],
          segmento: 'Cartórios & Tabelionatos',
          produto: 'Autenticações, reconhecimento de firma e certidões imobiliárias',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'anac',
            'decea',
            'aeronautica',
            'receita federal',
            'prefeitura',
            'sefaz',
            'gru',
            'dam',
            'taxas',
          ],
          segmento: 'Taxas & Órgãos Reguladores',
          produto: 'Taxas de fiscalização ANAC, DECEA, GRU, prefeituras e órgãos ambientais',
          categoria: 'impostos',
          planoCodigo: '3.3.1',
          planoNome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
        },
        {
          termos: [
            'vivo',
            'telefonica',
            'claro',
            'tim',
            'telecomunicacoes',
            'provedor de internet',
            'fibra',
          ],
          segmento: 'Telecomunicações & Internet',
          produto: 'Internet banda larga, telefonia móvel e links de dados',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'engenharia consultiva',
            'geotecnia',
            'sondagens',
            'topografia',
            'ensaios de solo',
          ],
          segmento: 'Subcontratação Técnica de Engenharia',
          produto: 'Serviços terceirizados de sondagem SPT, ensaios geotécnicos e topografia',
          categoria: 'terceirizados',
          planoCodigo: '3.2.1',
          planoNome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
        },
      ]

      for (let i = 0; i < regras.length; i++) {
        const r = regras[i]
        for (let j = 0; j < r.termos.length; j++) {
          const t = r.termos[j]
          if (texto.indexOf(t) !== -1) {
            return {
              sucesso: true,
              segmento: r.segmento,
              produto: r.produto,
              categoria: r.categoria,
              planoCodigo: r.planoCodigo,
              planoNome: r.planoNome,
              termo: t,
            }
          }
        }
      }

      return {
        sucesso: false,
        segmento: 'Outros',
        produto: 'Despesa operacional geral',
        categoria: 'despesas_operacionais',
        planoCodigo: '3.1.1',
        planoNome: 'Despesas Administrativas Gerais & Escritório',
        termo: null,
      }
    }

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

      const diretrizModoEssencial = `
PADRÃO DE LEITURA ENXUTO - EXTRAIR ESTRITAMENTE 5 CAMPOS (IGNORAR DEMAIS INFORMAÇÕES):
1. NOME DO ESTABELECIMENTO (fornecedor): Razão social ou nome fantasia no cabeçalho.
2. CNPJ DO EMITENTE (cnpj_cpf): 14 dígitos formatados ou vazio se ausente.
3. DATA DA COMPRA/EMISSÃO (data_emissao): Formato ISO AAAA-MM-DD.
4. VALOR TOTAL (valor_total): Valor total pago/a pagar no rodapé, número decimal puro.
5. FORMA DE PAGAMENTO (forma_pagamento_sugerida): cartao_debito, cartao_credito, pix, dinheiro, boleto, ted_doc ou outro.
   Se cartão de crédito, informe credito_tipo ("a_vista" ou "parcelado") e num_parcelas (número de parcelas).
INFERÊNCIA OBRIGATÓRIA: Infira o produto e despesa pelo estabelecimento (posto -> combustíveis; supermercado/restaurante -> alimentação; farmácia -> saúde; pedágio/estacionamento -> transporte; etc.).
IGNORAR TOTALMENTE: itens detalhados da nota, chave de acesso de 44 dígitos, impostos, COO/CCF, etc.`

      if (rawContent && rawContent.trim().length > 0) {
        promptMessage = `Analise o seguinte conteúdo textual extraído do documento fiscal (${fileName}${contextoOtimizacao}).
${diretrizModoEssencial}

Classifique contabilmente no Plano de Contas AEROCAD e retorne EXCLUSIVAMENTE o JSON puro estruturado:\n\n${rawContent.slice(0, 4500)}`
      } else {
        promptMessage = `Analise com extremo rigor óptico a foto/digitalização do comprovante ou documento fiscal anexado (${fileName}${contextoOtimizacao}).
${diretrizModoEssencial}

Retorne EXCLUSIVAMENTE o JSON estruturado puro, sem blocos de texto adicionais fora do JSON.`
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
        const systemPrompt = `Você é o Extrator Fiscal Enxuto do CRM AEROCAD.
Extraia EXCLUSIVAMENTE:
1. Nome do estabelecimento (fornecedor)
2. CNPJ (cnpj_cpf)
3. Data (data_emissao AAAA-MM-DD)
4. Valor total (valor_total decimal)
5. Forma de pagamento (cartao_debito, cartao_credito [a_vista ou parcelado com num_parcelas], pix, dinheiro, boleto, outro)
Inferir produto/categoria pelo estabelecimento (posto -> combustíveis, restaurante/mercado -> alimentação).
IGNORAR chave 44, impostos, itens detalhados.
Retorne EXCLUSIVAMENTE um JSON puro estruturado com:
{
  "sucesso": true,
  "modo_essencial": true,
  "tipo_documento": "cupom_fiscal",
  "fornecedor": "Nome do Estabelecimento",
  "cnpj_cpf": "00.000.000/0000-00",
  "data_emissao": "AAAA-MM-DD",
  "valor_total": 0.0,
  "forma_pagamento_sugerida": "cartao_debito",
  "credito_tipo": "a_vista",
  "num_parcelas": 1,
  "categoria_sugerida": "despesas_operacionais",
  "plano_contas_codigo": "3.1.5",
  "plano_contas_nome": "Combustível, Pedágios e Locação de Veículos",
  "descricao_itens": "Combustíveis e abastecimento",
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

      // Segunda passada com $ai.chat focada em Cabeçalho e Rodapé se fornecedor ou valor vierem vazios
      if (
        extractedData &&
        extractedData.sucesso !== false &&
        (!extractedData.fornecedor || !extractedData.valor_total || extractedData.valor_total === 0)
      ) {
        try {
          const promptPassadaFoco = `ATENÇÃO: A leitura anterior do documento (${fileName}) deixou em branco o estabelecimento ou o valor total.
Foque estritamente em:
1. CABEÇALHO: Nome do estabelecimento e CNPJ.
2. RODAPÉ: Valor total da compra e data.
3. FORMA DE PAGAMENTO: Débito, Crédito (à vista ou parcelado), PIX ou Dinheiro.
Inferir categoria/produto pelo nome do estabelecimento (posto -> combustível, mercado/restaurante -> alimentação).
${rawContent ? 'Conteúdo:\n' + rawContent.slice(0, 3000) : ''}
Retorne EXCLUSIVAMENTE o JSON estruturado com fornecedor, cnpj_cpf, valor_total, data_emissao, forma_pagamento_sugerida, credito_tipo e num_parcelas.`

          const rescateReply = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Você é o especialista de resgate enxuto dos 5 campos essenciais. Retorne JSON puro.',
              },
              { role: 'user', content: promptPassadaFoco },
            ],
          })

          if (rescateReply && rescateReply.choices && rescateReply.choices[0]) {
            const rescateText = rescateReply.choices[0].message.content.trim()
            const matchRescate = rescateText.match(/\{[\s\S]*\}/)
            if (matchRescate) {
              const dadosResgate = JSON.parse(matchRescate[0])
              if (dadosResgate) {
                if (!extractedData.fornecedor && dadosResgate.fornecedor) {
                  extractedData.fornecedor = dadosResgate.fornecedor
                }
                if (
                  (!extractedData.valor_total || extractedData.valor_total === 0) &&
                  dadosResgate.valor_total
                ) {
                  extractedData.valor_total = Number(dadosResgate.valor_total) || 0
                }
                if (!extractedData.cnpj_cpf && dadosResgate.cnpj_cpf) {
                  extractedData.cnpj_cpf = dadosResgate.cnpj_cpf
                }
                if (!extractedData.data_emissao && dadosResgate.data_emissao) {
                  extractedData.data_emissao = dadosResgate.data_emissao
                }
                if (
                  (!extractedData.forma_pagamento_sugerida ||
                    extractedData.forma_pagamento_sugerida === 'outro') &&
                  dadosResgate.forma_pagamento_sugerida
                ) {
                  extractedData.forma_pagamento_sugerida = dadosResgate.forma_pagamento_sugerida
                }
                extractedData.modo_essencial = true
                extractedData.aviso_modo_essencial =
                  'Leitura parcial — dados essenciais extraídos, confira e complete o restante'
              }
            }
          }
        } catch (resgateErr) {
          console.log('Segunda passada de foco falhou:', resgateErr.message)
        }
      }

      // Se falhou parse ou veio incompleto, tentar extração essencial heurística
      if (!extractedData) {
        extractedData = {
          sucesso: false,
          modo_essencial: false,
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

      // Aplica enriquecimento de inferência de categoria pelo estabelecimento
      const inf = inferirCategoriaEstabelecimento(
        extractedData.fornecedor,
        extractedData.cnpj_cpf,
        extractedData.descricao_itens,
      )

      if (inf && inf.sucesso) {
        extractedData.inferencia_categoria = {
          segmento: inf.segmento,
          descricao_produto_inferido: inf.produto,
          categoria: inf.categoria,
          plano_contas_codigo: inf.planoCodigo,
          plano_contas_nome: inf.planoNome,
          termo_detectado: inf.termo,
        }
        // Se a IA não inferiu categoria ou deixou genérica
        if (!extractedData.categoria_sugerida || extractedData.categoria_sugerida === 'outros') {
          extractedData.categoria_sugerida = inf.categoria
        }
        if (!extractedData.plano_contas_codigo || extractedData.plano_contas_codigo === '3.1.1') {
          extractedData.plano_contas_codigo = inf.planoCodigo
          extractedData.plano_contas_nome = inf.planoNome
        }
        if (!extractedData.descricao_itens || extractedData.descricao_itens.length < 5) {
          extractedData.descricao_itens = inf.produto
        }
      }

      // Checa se caiu em Modo Essencial: quando tem campos vitais mas faltou dados acessórios,
      // ou se veio qualquer dado vital legível (estabelecimento, valor ou data)
      const temPeloMenosUmVital =
        Boolean(extractedData.fornecedor || extractedData.cnpj_cpf) ||
        (typeof extractedData.valor_total === 'number'
          ? extractedData.valor_total > 0
          : Boolean(extractedData.valor_total))

      const faltaDadosAcessorios =
        !extractedData.numero_documento ||
        !extractedData.chave_acesso ||
        !extractedData.itens_detalhados ||
        extractedData.itens_detalhados.length === 0

      if (
        extractedData.sucesso !== false &&
        (extractedData.modo_essencial || (temPeloMenosUmVital && faltaDadosAcessorios))
      ) {
        extractedData.modo_essencial = true
        extractedData.aviso_modo_essencial =
          'Leitura parcial — dados essenciais extraídos, confira e complete o restante'
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
    // Funções utilitárias inline
    function inferirCategoriaEstabelecimento(nome, cnpj, descItens) {
      const texto = ((nome || '') + ' ' + (descItens || '')).toLowerCase()
      const regras = [
        {
          termos: [
            'posto',
            'combustivel',
            'gasolina',
            'etanol',
            'diesel',
            'ipiranga',
            'petrobras',
            'shell',
            'vibra',
            'raizen',
            'auto posto',
            'autoposto',
            'abastecedora',
          ],
          segmento: 'Combustíveis & Lubrificantes',
          produto: 'Combustíveis e abastecimento de veículos em campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'restaurante',
            'churrascaria',
            'pizzaria',
            'lanchonete',
            'refeicao',
            'refeicoes',
            'bife',
            'buffet',
            'bistro',
            'mcdonald',
            'burger king',
            'subway',
            'habib',
            'grill',
          ],
          segmento: 'Alimentação & Restaurantes',
          produto: 'Despesas com refeições e alimentação da equipe',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'supermercado',
            'mercado',
            'mercearia',
            'hipermercado',
            'atacadao',
            'assai',
            'carrefour',
            'pao de acucar',
            'extra',
            'muffato',
            'savegnago',
            'hortifruti',
          ],
          segmento: 'Alimentação / Supermercados',
          produto: 'Gêneros alimentícios e insumos de copa/campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'padaria',
            'panificadora',
            'panificacao',
            'confeitaria',
            'cafeteria',
            'cafe',
            'coffee',
          ],
          segmento: 'Panificação & Confeitaria',
          produto: 'Despesas com café da manhã e panificação em trânsito',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'farmacia',
            'drogaria',
            'drogasil',
            'raia',
            'pacheco',
            'pague menos',
            'panvel',
            'medicamentos',
          ],
          segmento: 'Saúde & Farmácia',
          produto: 'Medicamentos básicos, primeiros socorros e itens de higiene',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['estacionamento', 'garagem', 'park', 'parking', 'estapar', 'valet'],
          segmento: 'Estacionamento & Garagem',
          produto: 'Estacionamento de veículos técnicos / diárias em aeroportos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'pedagio',
            'sem parar',
            'conectcar',
            'veloe',
            'concessionaria de rodovias',
            'ccr',
            'ecorodovias',
            'arteris',
          ],
          segmento: 'Pedágio & Rodovias',
          produto: 'Tarifas de pedágio em deslocamento técnico rodoviário',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'papelaria',
            'kalunga',
            'livraria',
            'copiadora',
            'suprimentos',
            'materiais para escritorio',
          ],
          segmento: 'Material de Consumo & Escritório',
          produto: 'Material de consumo, papelaria técnica e suprimentos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'hotel',
            'hoteis',
            'pousada',
            'resort',
            'ibis',
            'accor',
            'mercure',
            'novotel',
            'hospedagem',
            'airbnb',
          ],
          segmento: 'Hospedagem & Hotelaria',
          produto: 'Diárias de hospedagem e hotel em missões de campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'latam',
            'gol linhas',
            'azul linhas',
            'voepass',
            'passagem aerea',
            'aeroporto',
            'infraero',
            'aena',
            'fraport',
            'zurich airport',
          ],
          segmento: 'Passagens & Transporte Aéreo',
          produto: 'Passagens aéreas, taxas aeroportuárias e despacho de bagagem técnica',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'localiza',
            'movida',
            'unidas',
            'locadora de veiculos',
            'aluguel de carros',
            'rent a car',
          ],
          segmento: 'Locação de Veículos',
          produto: 'Aluguel de veículos utilitários e 4x4 para vistoria em sítios aeroportuários',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['uber', '99 tecnologia', '99app', 'radiotaxi', 'taxi'],
          segmento: 'Transporte Urbano & Aplicativos',
          produto: 'Deslocamentos urbanos por aplicativo ou táxi',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['grafica', 'plotagem', 'ploter', 'reprografia', 'plantas tecnicas'],
          segmento: 'Gráfica & Plotagem Técnica',
          produto: 'Plotagem de pranchas CAD A0/A1 e encadernações técnicas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'ferragens',
            'ferramentas',
            'materiais de construcao',
            'leroy merlin',
            'tintas',
            'epi',
            'equipamentos de protecao',
          ],
          segmento: 'Ferramentas, EPI & Materiais',
          produto: 'Equipamentos de proteção individual (EPI), trenas e ferramentas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['kabum', 'dell', 'lenovo', 'computadores', 'informatica', 'hardware'],
          segmento: 'Equipamentos de TI & Hardware',
          produto: 'Hardware, periféricos e peças de computador de engenharia',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: [
            'autodesk',
            'microsoft',
            'google cloud',
            'aws',
            'software',
            'adobe',
            'chatgpt',
            'openai',
            'bentley',
            'trimble',
          ],
          segmento: 'Softwares & Licenças Técnicas',
          produto: 'Assinaturas de software CAD/BIM, nuvem e ferramentas de cálculo',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: ['cartorio', 'tabelionato', 'registro de imoveis', 'tabeliao'],
          segmento: 'Cartórios & Tabelionatos',
          produto: 'Autenticações, reconhecimento de firma e certidões imobiliárias',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'anac',
            'decea',
            'aeronautica',
            'receita federal',
            'prefeitura',
            'sefaz',
            'gru',
            'dam',
            'taxas',
          ],
          segmento: 'Taxas & Órgãos Reguladores',
          produto: 'Taxas de fiscalização ANAC, DECEA, GRU, prefeituras e órgãos ambientais',
          categoria: 'impostos',
          planoCodigo: '3.3.1',
          planoNome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
        },
        {
          termos: [
            'vivo',
            'telefonica',
            'claro',
            'tim',
            'telecomunicacoes',
            'provedor de internet',
            'fibra',
          ],
          segmento: 'Telecomunicações & Internet',
          produto: 'Internet banda larga, telefonia móvel e links de dados',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'engenharia consultiva',
            'geotecnia',
            'sondagens',
            'topografia',
            'ensaios de solo',
          ],
          segmento: 'Subcontratação Técnica de Engenharia',
          produto: 'Serviços terceirizados de sondagem SPT, ensaios geotécnicos e topografia',
          categoria: 'terceirizados',
          planoCodigo: '3.2.1',
          planoNome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
        },
      ]

      for (let i = 0; i < regras.length; i++) {
        const r = regras[i]
        for (let j = 0; j < r.termos.length; j++) {
          const t = r.termos[j]
          if (texto.indexOf(t) !== -1) {
            return {
              sucesso: true,
              segmento: r.segmento,
              produto: r.produto,
              categoria: r.categoria,
              planoCodigo: r.planoCodigo,
              planoNome: r.planoNome,
              termo: t,
            }
          }
        }
      }

      return {
        sucesso: false,
        segmento: 'Outros',
        produto: 'Despesa operacional geral',
        categoria: 'despesas_operacionais',
        planoCodigo: '3.1.1',
        planoNome: 'Despesas Administrativas Gerais & Escritório',
        termo: null,
      }
    }

    function extrairChave44(texto) {
      if (!texto) return ''
      const matchContinuo = texto.match(/\b\d{44}\b/)
      if (matchContinuo) return matchContinuo[0]

      const paramMatch = texto.match(/(?:chNFe|chave|p|C)=([0-9]{44})/i)
      if (paramMatch) return paramMatch[1]

      const pMatch = texto.match(/[?&]p=([0-9]{44})[|%7C]/i)
      if (pMatch) return pMatch[1]

      return ''
    }

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

        const dadosSat = {
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
          plano_contas_codigo: '3.1.5',
          plano_contas_nome: 'Combustível, Pedágios e Locação de Veículos',
          descricao_itens: 'Despesa Cupom Fiscal Eletrônico SAT (Extrato)',
          observacoes: `Chave SAT: ${chaveSat}`,
          confianca: 'alta',
        }

        const infSat = inferirCategoriaEstabelecimento(
          dadosSat.fornecedor,
          dadosSat.cnpj_cpf,
          dadosSat.descricao_itens,
        )
        if (infSat && infSat.sucesso) {
          dadosSat.inferencia_categoria = {
            segmento: infSat.segmento,
            descricao_produto_inferido: infSat.produto,
            categoria: infSat.categoria,
            plano_contas_codigo: infSat.planoCodigo,
            plano_contas_nome: infSat.planoNome,
            termo_detectado: infSat.termo,
          }
          dadosSat.categoria_sugerida = infSat.categoria
          dadosSat.plano_contas_codigo = infSat.planoCodigo
          dadosSat.plano_contas_nome = infSat.planoNome
        }

        return e.json(200, {
          sucesso: true,
          origem: 'sat_qrcode_pipe',
          chave_acesso: chaveSat,
          dados: dadosSat,
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

      // Inferência para dados da SEFAZ
      const infSefaz = inferirCategoriaEstabelecimento(
        dadosFinais.fornecedor,
        dadosFinais.cnpj_cpf,
        dadosFinais.descricao_itens,
      )
      if (infSefaz && infSefaz.sucesso) {
        dadosFinais.inferencia_categoria = {
          segmento: infSefaz.segmento,
          descricao_produto_inferido: infSefaz.produto,
          categoria: infSefaz.categoria,
          plano_contas_codigo: infSefaz.planoCodigo,
          plano_contas_nome: infSefaz.planoNome,
          termo_detectado: infSefaz.termo,
        }
        dadosFinais.categoria_sugerida = infSefaz.categoria
        dadosFinais.plano_contas_codigo = infSefaz.planoCodigo
        dadosFinais.plano_contas_nome = infSefaz.planoNome
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
    // Função utilitária inline de inferência de categoria
    function inferirCategoriaEstabelecimento(nome, cnpj, descItens) {
      const texto = ((nome || '') + ' ' + (descItens || '')).toLowerCase()
      const regras = [
        {
          termos: [
            'posto',
            'combustivel',
            'gasolina',
            'etanol',
            'diesel',
            'ipiranga',
            'petrobras',
            'shell',
            'vibra',
            'raizen',
            'auto posto',
            'autoposto',
            'abastecedora',
          ],
          segmento: 'Combustíveis & Lubrificantes',
          produto: 'Combustíveis e abastecimento de veículos em campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'restaurante',
            'churrascaria',
            'pizzaria',
            'lanchonete',
            'refeicao',
            'refeicoes',
            'bife',
            'buffet',
            'bistro',
            'mcdonald',
            'burger king',
            'subway',
            'habib',
            'grill',
          ],
          segmento: 'Alimentação & Restaurantes',
          produto: 'Despesas com refeições e alimentação da equipe',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'supermercado',
            'mercado',
            'mercearia',
            'hipermercado',
            'atacadao',
            'assai',
            'carrefour',
            'pao de acucar',
            'extra',
            'muffato',
            'savegnago',
            'hortifruti',
          ],
          segmento: 'Alimentação / Supermercados',
          produto: 'Gêneros alimentícios e insumos de copa/campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'padaria',
            'panificadora',
            'panificacao',
            'confeitaria',
            'cafeteria',
            'cafe',
            'coffee',
          ],
          segmento: 'Panificação & Confeitaria',
          produto: 'Despesas com café da manhã e panificação em trânsito',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'farmacia',
            'drogaria',
            'drogasil',
            'raia',
            'pacheco',
            'pague menos',
            'panvel',
            'medicamentos',
          ],
          segmento: 'Saúde & Farmácia',
          produto: 'Medicamentos básicos, primeiros socorros e itens de higiene',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['estacionamento', 'garagem', 'park', 'parking', 'estapar', 'valet'],
          segmento: 'Estacionamento & Garagem',
          produto: 'Estacionamento de veículos técnicos / diárias em aeroportos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'pedagio',
            'sem parar',
            'conectcar',
            'veloe',
            'concessionaria de rodovias',
            'ccr',
            'ecorodovias',
            'arteris',
          ],
          segmento: 'Pedágio & Rodovias',
          produto: 'Tarifas de pedágio em deslocamento técnico rodoviário',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: [
            'papelaria',
            'kalunga',
            'livraria',
            'copiadora',
            'suprimentos',
            'materiais para escritorio',
          ],
          segmento: 'Material de Consumo & Escritório',
          produto: 'Material de consumo, papelaria técnica e suprimentos',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'hotel',
            'hoteis',
            'pousada',
            'resort',
            'ibis',
            'accor',
            'mercure',
            'novotel',
            'hospedagem',
            'airbnb',
          ],
          segmento: 'Hospedagem & Hotelaria',
          produto: 'Diárias de hospedagem e hotel em missões de campo',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'latam',
            'gol linhas',
            'azul linhas',
            'voepass',
            'passagem aerea',
            'aeroporto',
            'infraero',
            'aena',
            'fraport',
            'zurich airport',
          ],
          segmento: 'Passagens & Transporte Aéreo',
          produto: 'Passagens aéreas, taxas aeroportuárias e despacho de bagagem técnica',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.4',
          planoNome: 'Viagens, Hospedagem e Diárias em Campo',
        },
        {
          termos: [
            'localiza',
            'movida',
            'unidas',
            'locadora de veiculos',
            'aluguel de carros',
            'rent a car',
          ],
          segmento: 'Locação de Veículos',
          produto: 'Aluguel de veículos utilitários e 4x4 para vistoria em sítios aeroportuários',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['uber', '99 tecnologia', '99app', 'radiotaxi', 'taxi'],
          segmento: 'Transporte Urbano & Aplicativos',
          produto: 'Deslocamentos urbanos por aplicativo ou táxi',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.5',
          planoNome: 'Combustível, Pedágios e Locação de Veículos',
        },
        {
          termos: ['grafica', 'plotagem', 'ploter', 'reprografia', 'plantas tecnicas'],
          segmento: 'Gráfica & Plotagem Técnica',
          produto: 'Plotagem de pranchas CAD A0/A1 e encadernações técnicas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'ferragens',
            'ferramentas',
            'materiais de construcao',
            'leroy merlin',
            'tintas',
            'epi',
            'equipamentos de protecao',
          ],
          segmento: 'Ferramentas, EPI & Materiais',
          produto: 'Equipamentos de proteção individual (EPI), trenas e ferramentas',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: ['kabum', 'dell', 'lenovo', 'computadores', 'informatica', 'hardware'],
          segmento: 'Equipamentos de TI & Hardware',
          produto: 'Hardware, periféricos e peças de computador de engenharia',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: [
            'autodesk',
            'microsoft',
            'google cloud',
            'aws',
            'software',
            'adobe',
            'chatgpt',
            'openai',
            'bentley',
            'trimble',
          ],
          segmento: 'Softwares & Licenças Técnicas',
          produto: 'Assinaturas de software CAD/BIM, nuvem e ferramentas de cálculo',
          categoria: 'equipamentos',
          planoCodigo: '3.1.2',
          planoNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
        },
        {
          termos: ['cartorio', 'tabelionato', 'registro de imoveis', 'tabeliao'],
          segmento: 'Cartórios & Tabelionatos',
          produto: 'Autenticações, reconhecimento de firma e certidões imobiliárias',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'anac',
            'decea',
            'aeronautica',
            'receita federal',
            'prefeitura',
            'sefaz',
            'gru',
            'dam',
            'taxas',
          ],
          segmento: 'Taxas & Órgãos Reguladores',
          produto: 'Taxas de fiscalização ANAC, DECEA, GRU, prefeituras e órgãos ambientais',
          categoria: 'impostos',
          planoCodigo: '3.3.1',
          planoNome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
        },
        {
          termos: [
            'vivo',
            'telefonica',
            'claro',
            'tim',
            'telecomunicacoes',
            'provedor de internet',
            'fibra',
          ],
          segmento: 'Telecomunicações & Internet',
          produto: 'Internet banda larga, telefonia móvel e links de dados',
          categoria: 'despesas_operacionais',
          planoCodigo: '3.1.1',
          planoNome: 'Despesas Administrativas Gerais & Escritório',
        },
        {
          termos: [
            'engenharia consultiva',
            'geotecnia',
            'sondagens',
            'topografia',
            'ensaios de solo',
          ],
          segmento: 'Subcontratação Técnica de Engenharia',
          produto: 'Serviços terceirizados de sondagem SPT, ensaios geotécnicos e topografia',
          categoria: 'terceirizados',
          planoCodigo: '3.2.1',
          planoNome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
        },
      ]

      for (let i = 0; i < regras.length; i++) {
        const r = regras[i]
        for (let j = 0; j < r.termos.length; j++) {
          const t = r.termos[j]
          if (texto.indexOf(t) !== -1) {
            return {
              sucesso: true,
              segmento: r.segmento,
              produto: r.produto,
              categoria: r.categoria,
              planoCodigo: r.planoCodigo,
              planoNome: r.planoNome,
              termo: t,
            }
          }
        }
      }

      return {
        sucesso: false,
        segmento: 'Outros',
        produto: 'Despesa operacional geral',
        categoria: 'despesas_operacionais',
        planoCodigo: '3.1.1',
        planoNome: 'Despesas Administrativas Gerais & Escritório',
        termo: null,
      }
    }

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
          modo_essencial: false,
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

      // Aplica inferência de categoria pelo beneficiário do boleto
      if (extractedData.beneficiario_fornecedor) {
        const infBoleto = inferirCategoriaEstabelecimento(
          extractedData.beneficiario_fornecedor,
          extractedData.cnpj_cpf_beneficiario,
          extractedData.instrucoes_resumo,
        )
        if (infBoleto && infBoleto.sucesso) {
          extractedData.inferencia_categoria = {
            segmento: infBoleto.segmento,
            descricao_produto_inferido: infBoleto.produto,
            categoria: infBoleto.categoria,
            plano_contas_codigo: infBoleto.planoCodigo,
            plano_contas_nome: infBoleto.planoNome,
            termo_detectado: infBoleto.termo,
          }
          if (!extractedData.categoria_sugerida || extractedData.categoria_sugerida === 'outros') {
            extractedData.categoria_sugerida = infBoleto.categoria
          }
          if (!extractedData.plano_contas_codigo || extractedData.plano_contas_codigo === '3.1.1') {
            extractedData.plano_contas_codigo = infBoleto.planoCodigo
            extractedData.plano_contas_nome = infBoleto.planoNome
          }
        }
      }

      // Modo essencial em boleto se tiver dados mínimos
      const temCamposMinimosBoleto =
        Boolean(extractedData.beneficiario_fornecedor || extractedData.cnpj_cpf_beneficiario) &&
        (extractedData.valor_documento > 0 || extractedData.valor_cobrado > 0) &&
        Boolean(extractedData.data_vencimento)

      if (
        extractedData.sucesso !== false &&
        temCamposMinimosBoleto &&
        (!extractedData.linha_digitavel || extractedData.linha_digitavel.length < 20)
      ) {
        extractedData.modo_essencial = true
        extractedData.aviso_modo_essencial =
          'Leitura parcial — dados essenciais extraídos, confira e complete o restante'
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

// 4. EXTRAÇÃO DE EXTRATO BANCÁRIO EM PDF OU IMAGEM VIA IA
routerAdd(
  'POST',
  '/backend/v1/extratos/extrair-pdf',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.forbiddenError(
          'Apenas administradores e equipe financeira podem importar extratos bancários',
        )
      }

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Nenhum arquivo de extrato enviado')
      }

      const file = files[0]
      const fileName = file.originalName || 'extrato.pdf'
      const ext = fileName.split('.').pop().toLowerCase()
      const isPdf = ext === 'pdf'
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)

      if (!isPdf && !isImage) {
        return e.badRequestError(
          'Formato não suportado. Envie um extrato em PDF ou imagem (JPG/PNG).',
        )
      }

      let markdownContent = ''
      let isRasterizado = false

      // Lê campo body indicando texto bruto extraído de rasterização pelo cliente (se houver)
      try {
        const body = e.requestInfo().body || {}
        if (body.texto_pagina && typeof body.texto_pagina === 'string') {
          markdownContent = body.texto_pagina.trim()
          isRasterizado = true
        }
      } catch (_) {}

      // Se for PDF e ainda não veio texto de página rasterizada, tenta $documents.toMarkdown
      if (isPdf && !markdownContent) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          if (docRes && docRes.markdown) {
            markdownContent = docRes.markdown
          }
        } catch (docErr) {
          console.log(
            'toMarkdown falhou para extrato (pode ser PDF escaneado/imagem):',
            docErr.message,
          )
        }
      }

      // Prepara o prompt do extrator bancário com IA
      const promptSystem = `Você é o Auditor e Extrator Especialista em Conciliação Bancária da AEROCAD CONSULTORIA.
Sua missão é extrair rigorosamente todas as transações financeiras do extrato bancário (formato texto, tabela ou imagem).

DIRETRIZES DE EXTRAÇÃO:
1. IDENTIFICAÇÃO DO BANCO E CONTA:
   - Identificar o banco emissor (ex: "Banco Inter", "Banco do Brasil", "Itaú", "Caixa", "Santander", "Bradesco", "Sicoob").
   - Identificar agência e número de conta corrente se visíveis no cabeçalho.
   - Período coberto (data inicial e data final em formato AAAA-MM-DD).
   - Saldo final do período se informado.

2. TRANSAÇÕES E LANÇAMENTOS (ORDEM CRONOLÓGICA):
   - Extrair CADA movimentação individual do extrato:
     * "data": Formato ISO AAAA-MM-DD (ex: "2026-03-12"). NUNCA deixe vazio.
     * "descricao": Histórico completo da movimentação (ex: "PIX ENVIADO FULANO", "TARIFA BANCARIA", "RECEBIMENTO CLIENTE XYZ").
     * "valor": Número decimal absoluto SEMPRE POSITIVO (ex: 1500.50, 42.10).
     * "tipo": "entrada" (crédito, depósitos, pix recebidos) ou "saida" (débito, pagamentos, pix enviado, tarifas).
     * "documentoRef": Número do documento, controle, autenticação ou NSU se visível, senão string vazia "".
     * "saldoLinha": Saldo após a transação se constar, ou null.
   - IGNORAR linhas de cabeçalho, totais de páginas, resumo mensal e linhas que não representam movimentação financeira efetiva.

3. RETORNO OBRIGATÓRIO EM JSON PURO:
{
  "sucesso": true,
  "banco": "Banco Inter",
  "agencia": "0001",
  "conta": "7637194-8",
  "dataInicio": "2026-03-01",
  "dataFim": "2026-03-31",
  "saldoFinal": 45200.30,
  "totalTransacoes": 12,
  "transacoes": [
    {
      "data": "2026-03-05",
      "descricao": "PIX RECEBIDO - CONTRATO AEROCAD",
      "valor": 12500.00,
      "tipo": "entrada",
      "documentoRef": "E2603051020",
      "saldoLinha": 25000.00
    },
    {
      "data": "2026-03-08",
      "descricao": "PAGAMENTO BOLETO POSTO IPIRANGA",
      "valor": 280.40,
      "tipo": "saida",
      "documentoRef": "003928172",
      "saldoLinha": 24719.60
    }
  ],
  "linhasNaoInterpretadas": 0,
  "observacoes": "Extrato lido com sucesso."
}`

      let userText = `Nome do arquivo: ${fileName}\n\n`
      if (markdownContent && markdownContent.trim().length > 0) {
        userText += `CONTEÚDO/TEXTO DO EXTRATO BANCÁRIO:\n${markdownContent.slice(0, 16000)}`
      } else {
        userText += `DOCUMENTO ESCANEADO OU IMAGEM DO EXTRATO BANCÁRIO. Analise a imagem fornecida para extrair todas as linhas.`
      }

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
            console.log('Falha ao interpretar JSON do extrato bancário:', pErr.message)
          }
        }
      }

      if (!extracted || !Array.isArray(extracted.transacoes)) {
        return e.json(200, {
          sucesso: false,
          aviso:
            'Não foi possível interpretar automaticamente as transações deste PDF. Confira as transações na conferência ou importe o OFX/.RET do banco, que é mais preciso.',
          dados: {
            banco: '',
            agencia: '',
            conta: '',
            dataInicio: new Date().toISOString().slice(0, 10),
            dataFim: new Date().toISOString().slice(0, 10),
            saldoFinal: 0,
            totalTransacoes: 0,
            transacoes: [],
            linhasNaoInterpretadas: 1,
            observacoes: 'Leitura automática incompleta.',
          },
        })
      }

      // Validação e higienização das transações extraídas
      const transacoesHigienizadas = []
      let totalEntradas = 0
      let totalSaidas = 0

      for (let i = 0; i < extracted.transacoes.length; i++) {
        const tx = extracted.transacoes[i]
        if (!tx || !tx.descricao) continue

        let valorNum =
          typeof tx.valor === 'number'
            ? Math.abs(tx.valor)
            : parseFloat(
                String(tx.valor || '0')
                  .replace(/[^\d.,]/g, '')
                  .replace(',', '.'),
              )
        if (isNaN(valorNum) || valorNum <= 0) continue

        let dataStr = (tx.data || '').toString().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
          // Tenta normalizar DD/MM/AAAA
          const matchBr = String(tx.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
          if (matchBr) {
            dataStr = `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`
          } else {
            dataStr = new Date().toISOString().slice(0, 10)
          }
        }

        const tipoNormalizado =
          String(tx.tipo || 'saida')
            .toLowerCase()
            .includes('entrad') ||
          String(tx.tipo || '')
            .toLowerCase()
            .includes('credit')
            ? 'entrada'
            : 'saida'

        if (tipoNormalizado === 'entrada') totalEntradas += valorNum
        else totalSaidas += valorNum

        transacoesHigienizadas.push({
          data: dataStr,
          descricao: String(tx.descricao).trim(),
          valor: Number(valorNum.toFixed(2)),
          tipo: tipoNormalizado,
          documentoRef: String(tx.documentoRef || tx.documento || '').trim(),
          saldoLinha: typeof tx.saldoLinha === 'number' ? tx.saldoLinha : null,
          fitid: `PDF_${dataStr}_${i + 1}_${valorNum.toFixed(2)}`,
        })
      }

      extracted.transacoes = transacoesHigienizadas
      extracted.totalTransacoes = transacoesHigienizadas.length
      extracted.totalEntradas = Number(totalEntradas.toFixed(2))
      extracted.totalSaidas = Number(totalSaidas.toFixed(2))
      extracted.rasterizado = isRasterizado

      return e.json(200, {
        sucesso: transacoesHigienizadas.length > 0,
        aviso:
          transacoesHigienizadas.length === 0
            ? 'Nenhuma transação válida identificada. Confira as transações na conferência ou importe o OFX/.RET do banco, que é mais preciso.'
            : null,
        dados: extracted,
      })
    } catch (err) {
      console.log('Erro no endpoint /backend/v1/extratos/extrair-pdf:', err.message)
      return e.json(500, {
        error: 'Erro ao processar extrato PDF: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
