// @ts-nocheck
/**
 * Hook PocketBase para Extração Inteligente de Contratos de Empréstimo, Financiamento e Carnês em PDF via IA
 * Rota: POST /backend/v1/emprestimos/extrair-pdf
 * Restrita exclusivamente a administradores do CRM AEROCAD
 */

routerAdd(
  'POST',
  '/backend/v1/emprestimos/extrair-pdf',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      const roles = authUser.getStringSlice('roles') || []
      const isAdmin = role === 'admin' || roles.indexOf('admin') !== -1
      if (!isAdmin) {
        return e.forbiddenError(
          'Apenas administradores possuem autorização para importar e extrair contratos ou carnês de empréstimos em PDF.',
        )
      }

      const files = e.findUploadedFiles('arquivo')
      if (!files || files.length === 0) {
        return e.badRequestError('Nenhum arquivo PDF de contrato ou carnê foi enviado.')
      }

      const file = files[0]
      const fileName = file.originalName || 'contrato_emprestimo.pdf'
      const ext = fileName.split('.').pop().toLowerCase()

      if (ext !== 'pdf') {
        return e.badRequestError('O arquivo enviado deve estar no formato PDF.')
      }

      let markdownContent = ''
      try {
        const docRes = $documents.toMarkdown({ file: file })
        if (docRes && docRes.markdown) {
          markdownContent = docRes.markdown
        }
      } catch (docErr) {
        console.log('toMarkdown falhou para contrato/carnê de empréstimo:', docErr.message)
      }

      if (!markdownContent || markdownContent.trim().length === 0) {
        return e.json(200, {
          sucesso: false,
          aviso:
            'Não foi possível extrair a camada de texto deste PDF (possível documento digitalizado ou imagem sem OCR). Preencha ou revise os dados na tela de conferência.',
          dados: {
            banco_nome: '',
            numero_contrato: '',
            tipo: 'emprestimo_bancario',
            metodo_amortizacao: 'PRICE',
            valor_total_divida: 0,
            valor_liquido_liberado: 0,
            total_juros_prefixados: 0,
            taxa_juros_mensal: 0,
            taxa_juros_anual: 0,
            quantidade_parcelas: 12,
            valor_parcela: 0,
            data_contratacao: new Date().toISOString().slice(0, 10),
            data_primeira_parcela: new Date().toISOString().slice(0, 10),
            bem_adquirido_descricao: '',
            valor_entrada: 0,
            parcelas: [],
            confianca: 'baixa',
          },
        })
      }

      const promptSystem = `Você é o Auditor Financeiro e Contábil Especialista da AEROCAD CONSULTORIA AEROPORTUÁRIA.
Sua missão é extrair com rigor máximo todos os parâmetros financeiros e contábeis deste contrato de empréstimo, financiamento bancário de veículo/equipamento ou carnê de parcelas.

DIRETRIZES DE EXTRAÇÃO:
1. IDENTIFICAÇÃO DO BANCO / CREDOR:
   - "banco_nome": Nome da instituição financeira credora (ex: "Banco Santander (Brasil) S.A.", "Banco do Brasil", "Itaú Unibanco", "Caixa Econômica Federal", "Banco Inter", "BV Financeira", "Banco Safra", "Bradesco", "Sicoob", "Sicredi").
   - "numero_contrato": Número oficial do contrato, cédula de crédito bancário (CCB) ou código do carnê.
   - "tipo": Classifique estritamente entre:
     * "financiamento_veiculo" (se envolver compra/alienação de veículo, frota, caminhão, utilitário, chassi ou automóvel)
     * "emprestimo_bancario" (capital de giro, mútuo bancário, limite fumaça, crédito rotativo, ccb sem veículo)
     * "outras_modalidades" (financiamento de máquinas, equipamentos ou outro).

2. VALORES FINANCEIROS (SEM CIFRÃO, FLOAT/NUMBER POSITIVO):
   - "valor_total_divida": Montante total devido somando principal e encargos/juros (float).
   - "valor_liquido_liberado": Valor do principal financiado ou crédito líquido liberado em conta (float).
   - "total_juros_prefixados": Total de juros e encargos financeiros prefixados (valor_total_divida - valor_liquido_liberado).
   - "taxa_juros_mensal": Taxa de juros mensal em percentual (% a.m., ex: 1.65). Se expressa ao ano, calcule ou estime a mensal.
   - "taxa_juros_anual": Taxa de juros anual (% a.a., ex: 21.60).
   - "quantidade_parcelas": Número inteiro total de parcelas (ex: 24, 36, 48, 60).
   - "valor_parcela": Valor unitário da prestação mensal regular (float, ex: 1450.80).
   - "valor_entrada": Valor de entrada pago na contratação (se houver, comum em financiamento de veículos).
   - "bem_adquirido_descricao": Modelo/marca do veículo ou bem adquirido se constar (ex: "Toyota Hilux CD 4x4", "Notebook Dell").

3. SISTEMA DE AMORTIZAÇÃO E DATAS:
   - "metodo_amortizacao": "PRICE" (parcelas fixas/iguais), "SAC" (amortização constante com prestações decrescentes) ou "PREFIXADO_MANUAL".
   - "data_contratacao": Data da assinatura ou emissão da cédula (AAAA-MM-DD).
   - "data_primeira_parcela": Data de vencimento da 1ª parcela (AAAA-MM-DD).

4. CRONOGRAMA DE PARCELAS / CARNÊ (SE CONSTANTE NO DOCUMENTO):
   - "parcelas": Array com as parcelas descritas no carnê/tabela:
     [
       {
         "numero_parcela": 1,
         "data_vencimento": "AAAA-MM-DD",
         "valor_parcela": 1450.80,
         "valor_principal": 1200.00,
         "valor_juros": 250.80
       }
     ]
   - Se o documento não trouxer a tabela detalhada linha por linha, retorne array vazio "parcelas": [].

5. RETORNO OBRIGATÓRIO EM JSON PURO SEM MARKDOWN EXTERNO:
{
  "sucesso": true,
  "banco_nome": "Banco Santander (Brasil) S.A.",
  "numero_contrato": "0033-98745612",
  "tipo": "financiamento_veiculo",
  "metodo_amortizacao": "PRICE",
  "valor_total_divida": 72540.00,
  "valor_liquido_liberado": 55000.00,
  "total_juros_prefixados": 17540.00,
  "taxa_juros_mensal": 1.49,
  "taxa_juros_anual": 19.42,
  "quantidade_parcelas": 36,
  "valor_parcela": 2015.00,
  "valor_entrada": 15000.00,
  "bem_adquirido_descricao": "Veículo Utilitário Frota Aerocad",
  "data_contratacao": "2026-02-10",
  "data_primeira_parcela": "2026-03-10",
  "parcelas": [],
  "confianca": "alta"
}`

      const userText = `Nome do arquivo: ${fileName}\n\nCONTEÚDO TEXTUAL DO DOCUMENTO (CONTRATO / CARNÊ DE EMPRÉSTIMO OU FINANCIAMENTO):\n${markdownContent.slice(0, 14000)}`

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
            console.log('Falha ao interpretar JSON de empréstimo:', pErr.message)
          }
        }
      }

      if (!extracted) {
        extracted = {
          sucesso: false,
          banco_nome: '',
          numero_contrato: '',
          tipo: 'emprestimo_bancario',
          metodo_amortizacao: 'PRICE',
          valor_total_divida: 0,
          valor_liquido_liberado: 0,
          total_juros_prefixados: 0,
          taxa_juros_mensal: 0,
          taxa_juros_anual: 0,
          quantidade_parcelas: 12,
          valor_parcela: 0,
          data_contratacao: new Date().toISOString().slice(0, 10),
          data_primeira_parcela: new Date().toISOString().slice(0, 10),
          bem_adquirido_descricao: '',
          valor_entrada: 0,
          parcelas: [],
          confianca: 'baixa',
          aviso:
            'A leitura automática foi parcial ou ambígua. Confira os campos na tela de conferência antes de confirmar a gravação.',
        }
      }

      // Higienização numérica
      const sanitizeNumber = (val) => {
        if (typeof val === 'number') return Math.max(0, val)
        const num = parseFloat(
          String(val || '0')
            .replace(/[^\d.,]/g, '')
            .replace(',', '.'),
        )
        return isNaN(num) ? 0 : Math.max(0, num)
      }

      extracted.valor_total_divida = sanitizeNumber(extracted.valor_total_divida)
      extracted.valor_liquido_liberado = sanitizeNumber(extracted.valor_liquido_liberado)
      extracted.total_juros_prefixados = sanitizeNumber(extracted.total_juros_prefixados)
      extracted.taxa_juros_mensal = sanitizeNumber(extracted.taxa_juros_mensal)
      extracted.taxa_juros_anual = sanitizeNumber(extracted.taxa_juros_anual)
      extracted.valor_parcela = sanitizeNumber(extracted.valor_parcela)
      extracted.valor_entrada = sanitizeNumber(extracted.valor_entrada)
      extracted.quantidade_parcelas = Math.max(
        1,
        parseInt(String(extracted.quantidade_parcelas || 1), 10) || 1,
      )

      if (extracted.valor_total_divida === 0 && extracted.valor_parcela > 0) {
        extracted.valor_total_divida = extracted.valor_parcela * extracted.quantidade_parcelas
      }
      if (
        extracted.valor_liquido_liberado === 0 &&
        extracted.valor_total_divida > 0 &&
        extracted.total_juros_prefixados > 0
      ) {
        extracted.valor_liquido_liberado = Math.max(
          0,
          extracted.valor_total_divida - extracted.total_juros_prefixados,
        )
      }
      if (
        extracted.total_juros_prefixados === 0 &&
        extracted.valor_total_divida > extracted.valor_liquido_liberado &&
        extracted.valor_liquido_liberado > 0
      ) {
        extracted.total_juros_prefixados =
          extracted.valor_total_divida - extracted.valor_liquido_liberado
      }

      if (!Array.isArray(extracted.parcelas)) {
        extracted.parcelas = []
      }

      return e.json(200, {
        sucesso: true,
        dados: extracted,
      })
    } catch (err) {
      console.log('Erro no endpoint /backend/v1/emprestimos/extrair-pdf:', err.message)
      return e.json(500, {
        error: 'Erro ao processar contrato/carnê PDF: ' + (err.message || 'desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
