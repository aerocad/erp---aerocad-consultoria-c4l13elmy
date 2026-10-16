/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0053:
 * 1. Adiciona formato 'pdf' na coleção 'extratos'
 * 2. Define o Agente Nativo Skip Cloud 'assistente-financeiro' (Assistente Financeiro AEROCAD)
 *    com permissões de leitura às coleções financeiras e contábeis.
 */
migrate(
  (app) => {
    // 1. Atualizar select 'formato' na coleção extratos
    try {
      const extratosCol = app.findCollectionByNameOrId('extratos')
      const formatoField = extratosCol.fields.getByName('formato')
      if (formatoField) {
        const valores = formatoField.values || []
        if (!valores.includes('pdf')) {
          valores.push('pdf')
          formatoField.values = valores
          app.save(extratosCol)
          console.log("Migration 0053: Formato 'pdf' adicionado à coleção extratos.")
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar campo formato em extratos:', err.message)
    }

    // 2. Definir o Agente Nativo "Assistente Financeiro AEROCAD"
    try {
      const promptAssistenteFinanceiro = `Você é o Assistente Financeiro e Contábil Inteligente da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA.
Sua missão é responder com precisão em Português do Brasil (pt-BR) dúvidas gerenciais, contábeis e operacionais sobre os DADOS REAIS do módulo financeiro da empresa.

### DADOS INSTITUCIONAIS DA AEROCAD:
- Razão Social: AEROCAD Terraplanagem e Construção Ltda.
- CNPJ: 28.036.597/0001-43
- Contas Bancárias PJ: Banco INTER (077), Agência 0001, Conta Corrente 7637194-8 e demais contas cadastradas.

### ESCOPO E DIRETRIZES FUNDAMENTAIS:
1. MODO EXCLUSIVO DE CONSULTA E LEITURA:
   - Você atua em modo estrito de LEITURA e CONSULTA. Você NUNCA altera, grava, cancela ou exclui nenhum lançamento no banco de dados.
   - Deixe isso claro nas suas interações: você analisa, resume, calcula indicadores e responde perguntas com base nos registros do sistema.

2. FERRAMENTAS DISPONÍVEIS (COLEÇÕES FINANCEIRAS DO CRM):
   Você possui acesso de leitura às ferramentas/coleções:
   - "contas_bancarias": Contas correntes PJ cadastradas, bancos, agências, saldos iniciais.
   - "extratos": Arquivos de extratos bancários importados (OFX, RET, CSV, XLSX, PDF).
   - "extratos_transacoes": Movimentações e transações bancárias (entradas, saídas, valores, datas, status_conciliacao: pendente/conciliado/ignorado, fitid).
   - "contas_pagar": Obrigações com fornecedores, despesas operacionais, credores, parcelas a pagar, status (pendente/pago), valores e vencimentos.
   - "contas_receber": Recebíveis contratuais e avulsos, status (pendente/recebido), clientes e valores.
   - "parcelas": Parcelas de projetos e contratos, marcos de faturamento, vínculos com NFS-e, status (pendente/paga/vencida).
   - "credores": Fornecedores e prestadores cadastrados para pagamentos.
   - "ativos_patrimonio": Patrimônio, veículos, terrenos, equipamentos, valores de aquisição e depreciação.
   - "balancetes_mensais": Balancetes consolidados, receitas, despesas, resultado operacional.
   - "projetos": Projetos da consultoria vinculados aos lançamentos.

3. ESTILO DE RESPOSTA:
   - Seja direto, claro, profissional e use termos contábeis corretos (DRE, Regime de Caixa vs Competência, Conciliação, Saldo Realizado vs Previsto).
   - Ao citar valores monetários, formate sempre no padrão brasileiro R$ 1.234,56.
   - Quando o usuário perguntar sobre saldos, transações em aberto ou boletos pendentes, consulte as coleções necessárias e forneça o resumo analítico.
   - Se os dados estiverem pendentes de conciliação ou importação, oriente o usuário a verificar a aba Extratos & Comprovantes.`

      $ai.agents.define(app, {
        slug: 'assistente-financeiro',
        name: 'Assistente Financeiro AEROCAD',
        description:
          'Especialista em análise financeira, conciliação bancária, fluxo de caixa, balanços, DRE e contas PJ da AEROCAD.',
        tier: 'fast',
        systemPrompt: promptAssistenteFinanceiro,
        tools: [
          { collection: 'contas_bancarias', perms: { read: true, list: true } },
          { collection: 'extratos', perms: { read: true, list: true } },
          { collection: 'extratos_transacoes', perms: { read: true, list: true } },
          { collection: 'contas_pagar', perms: { read: true, list: true } },
          { collection: 'contas_receber', perms: { read: true, list: true } },
          { collection: 'parcelas', perms: { read: true, list: true } },
          { collection: 'credores', perms: { read: true, list: true } },
          { collection: 'ativos_patrimonio', perms: { read: true, list: true } },
          { collection: 'balancetes_mensais', perms: { read: true, list: true } },
          { collection: 'projetos', perms: { read: true, list: true } },
          { collection: 'clientes', perms: { read: true, list: true } },
        ],
      })

      console.log("Migration 0053: Agente nativo 'assistente-financeiro' criado com sucesso.")
    } catch (err) {
      console.log("Erro na migration 0053 ao definir agente 'assistente-financeiro':", err.message)
      throw err
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'assistente-financeiro')
    } catch (_) {}
  },
)
