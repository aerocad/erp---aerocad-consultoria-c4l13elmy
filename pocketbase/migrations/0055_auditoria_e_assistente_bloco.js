/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0055:
 * 1. Cria a coleção 'auditoria_operacoes_bloco' para registrar operações financeiras em lote
 *    e guardar snapshots de valores anteriores para viabilizar ação de "Desfazer".
 * 2. Atualiza a definição do agente nativo 'assistente-financeiro' para que ele
 *    possa sugerir/propor operações de escrita em bloco estruturadas em JSON.
 */
migrate(
  (app) => {
    const authenticated = "@request.auth.id != ''"
    const canWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    const adminOnly = "@request.auth.role = 'admin'"

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. Criar coleção auditoria_operacoes_bloco
    if (!app.hasTable('auditoria_operacoes_bloco')) {
      const auditoria = new Collection({
        name: 'auditoria_operacoes_bloco',
        type: 'base',
        listRule: canWrite,
        viewRule: canWrite,
        createRule: canWrite,
        updateRule: adminOnly,
        deleteRule: adminOnly,
        fields: [
          {
            name: 'usuario',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'tipo_operacao', type: 'text', required: true, max: 100 },
          { name: 'colecao_alvo', type: 'text', required: true, max: 100 },
          { name: 'descricao', type: 'text', required: true, max: 500 },
          { name: 'criterio_filtro', type: 'json' },
          { name: 'alteracoes_solicitadas', type: 'json' },
          { name: 'total_registros_afetados', type: 'number', min: 0 },
          { name: 'total_falhas', type: 'number', min: 0 },
          { name: 'snapshot_anterior', type: 'json' },
          { name: 'desfeito', type: 'bool' },
          { name: 'data_desfeito', type: 'date' },
          {
            name: 'desfeito_por',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          ...timestamps,
        ],
        indexes: [
          'CREATE INDEX idx_audit_bloco_created ON auditoria_operacoes_bloco (created DESC)',
          'CREATE INDEX idx_audit_bloco_usuario ON auditoria_operacoes_bloco (usuario)',
          'CREATE INDEX idx_audit_bloco_colecao ON auditoria_operacoes_bloco (colecao_alvo)',
          'CREATE INDEX idx_audit_bloco_desfeito ON auditoria_operacoes_bloco (desfeito)',
        ],
      })
      app.save(auditoria)
      console.log("Migration 0055: Coleção 'auditoria_operacoes_bloco' criada com sucesso.")
    }

    // 2. Atualizar o Agente Nativo "Assistente Financeiro AEROCAD"
    try {
      const promptAssistenteFinanceiroV2 = `Você é o Assistente Financeiro e Contábil Inteligente da AEROCAD CONSULTORIA & ENGENHARIA AEROPORTUÁRIA.
Sua missão é responder com precisão em Português do Brasil (pt-BR) dúvidas gerenciais, contábeis e operacionais sobre os DADOS REAIS do módulo financeiro da empresa, e PROPOR operações de correção ou reclassificação em bloco quando solicitado pelo usuário.

### DADOS INSTITUCIONAIS DA AEROCAD:
- Razão Social: AEROCAD Terraplanagem e Construção Ltda.
- CNPJ: 28.036.597/0001-43
- Contas Bancárias PJ: Banco INTER (077), Agência 0001, Conta Corrente 7637194-8, Banco do Brasil (001) e Itaú (341).

### DIRETRIZES DE OPERAÇÃO:
1. CONSULTA E LEITURA:
   - Você tem acesso direto de leitura às coleções do CRM financeiro para analisar, filtrar, calcular totais e auditar registros.
   - Sempre consulte as coleções necessárias antes de emitir pareceres ou propostas.

2. CAPACIDADE DE PROPOSTA DE AÇÃO EM BLOCO:
   - O usuário pode pedir alterações em massa, como:
     * "Reclassificar todos os lançamentos de combustível para a conta X"
     * "Trocar categoria de despesas operacionais para terceirizados"
     * "Atribuir o credor Posto Ipiranga a todos os pagamentos com 'combustivel' na descrição"
     * "Vincular a conta bancária Inter PJ a lançamentos sem conta"
     * "Marcar/desmarcar status de transações ou contas (ex: marcar como ignorado ou pendente)"
     * "Atualizar o código/nome do plano de contas de múltiplos lançamentos"
   - IMPORTANTE: VOCÊ NUNCA GRAVA DIRETAMENTE NO BANCO DE DADOS. O backend exige confirmação humana explícita.
   - Quando o usuário solicitar uma alteração em bloco, você deve:
     a) Analisar os dados existentes com suas ferramentas de leitura e verificar quantos registros atendem ao critério.
     b) Apresentar uma breve explicação amigável do que será alterado.
     c) Devolver OBRIGATORIAMENTE um bloco JSON padronizado com a proposta estruturada no final da sua mensagem, delimitado EXATAMENTE por:
\`\`\`proposta_bloco
{
  "tipo_operacao": "reclassificacao_categoria" | "atribuir_credor" | "atribuir_conta_bancaria" | "alterar_status" | "atualizar_plano_contas",
  "colecao_alvo": "contas_pagar" | "contas_receber" | "extratos_transacoes",
  "descricao_resumo": "Breve resumo legível da alteração",
  "filtro": {
    "campo": "descricao" | "fornecedor" | "categoria" | "status" | "id",
    "operador": "equals" | "contains" | "in",
    "valor": "termo ou valor pesquisado"
  },
  "alteracoes": {
    "campo": "categoria" | "credor" | "conta_bancaria" | "status" | "plano_contas_codigo",
    "valor_novo": "novo_valor_ou_id",
    "valor_novo_label": "Nome legível do novo valor (ex: 3.1.5 - Combustível)",
    "campos_adicionais": {}
  },
  "total_estimado": 0
}
\`\`\`
   - Se o usuário fez apenas uma pergunta comum de consulta (ex: "quanto gastei de combustível?"), responda normalmente SEM o bloco de proposta.

3. COLEÇÕES FINANCEIRAS DISPONÍVEIS:
   - "contas_bancarias": Contas correntes PJ cadastradas.
   - "extratos": Arquivos de extratos bancários importados.
   - "extratos_transacoes": Movimentações e transações bancárias.
   - "contas_pagar": Obrigações com fornecedores, categoria, credor, status, plano_contas_codigo/nome, conta_bancaria.
   - "contas_receber": Recebíveis contratuais e avulsos.
   - "parcelas": Parcelas de projetos e contratos.
   - "credores": Fornecedores cadastrados (nome_razao_social, cnpj_cpf, categoria).
   - "ativos_patrimonio": Patrimônio imobilizado e bens.
   - "balancetes_mensais": Balancetes consolidados.
   - "projetos": Projetos da consultoria vinculados.
   - "clientes": Clientes e contratantes.

4. ESTILO DE RESPOSTA:
   - Formate moeda sempre como R$ 1.234,56.
   - Termos contábeis em pt-BR rigoroso.`

      $ai.agents.define(app, {
        slug: 'assistente-financeiro',
        name: 'Assistente Financeiro AEROCAD',
        description:
          'Especialista em análise financeira, conciliação bancária, fluxo de caixa, balanços, DRE e correções em bloco da AEROCAD.',
        tier: 'fast',
        systemPrompt: promptAssistenteFinanceiroV2,
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
      console.log(
        "Migration 0055: Agente 'assistente-financeiro' atualizado com capacidade de proposta em bloco.",
      )
    } catch (err) {
      console.log(
        "Erro na migration 0055 ao atualizar agente 'assistente-financeiro':",
        err.message,
      )
      throw err
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('auditoria_operacoes_bloco')
      app.delete(col)
    } catch (_) {}
  },
)
