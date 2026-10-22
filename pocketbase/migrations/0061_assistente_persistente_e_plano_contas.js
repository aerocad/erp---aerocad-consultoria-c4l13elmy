/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0061:
 * 1. Cria a coleção 'assistente_conversas' para persistência integral de conversas,
 *    histórico navegável, status de processamento assíncrono e exclusão manual exclusiva pelo usuário.
 * 2. Cria a coleção 'plano_contas_customizadas' para armazenar novas contas criadas no Plano de Contas
 *    pelo Assistente Financeiro ou pelo usuário, com suporte a auditoria e rollback.
 */
migrate(
  (app) => {
    // 1. Coleção 'assistente_conversas'
    try {
      const colConversas = new Collection({
        name: 'assistente_conversas',
        type: 'base',
        listRule: '@request.auth.id = usuario.id',
        viewRule: '@request.auth.id = usuario.id',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = usuario.id',
        deleteRule: '@request.auth.id = usuario.id',
        fields: [
          {
            name: 'usuario',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'agent_slug',
            type: 'text',
            required: true,
          },
          {
            name: 'contexto',
            type: 'text',
            required: false,
          },
          {
            name: 'titulo',
            type: 'text',
            required: false,
          },
          {
            name: 'mensagens',
            type: 'json',
            required: false,
          },
          {
            name: 'status_processamento',
            type: 'select',
            values: ['concluido', 'processando', 'pendente', 'erro'],
            maxSelect: 1,
            required: false,
          },
          {
            name: 'pergunta_pendente',
            type: 'text',
            required: false,
          },
          {
            name: 'ultima_auditoria_id',
            type: 'text',
            required: false,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ast_conv_usuario ON assistente_conversas (usuario, updated DESC)',
          'CREATE INDEX idx_ast_conv_slug ON assistente_conversas (agent_slug)',
        ],
      })
      app.save(colConversas)
      console.log("Migration 0061: Coleção 'assistente_conversas' criada com sucesso.")
    } catch (err) {
      console.log("Aviso ao criar 'assistente_conversas':", err.message)
    }

    // 2. Coleção 'plano_contas_customizadas'
    try {
      const colPlano = new Collection({
        name: 'plano_contas_customizadas',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "financeiro"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "financeiro"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "financeiro"',
        fields: [
          {
            name: 'codigo',
            type: 'text',
            required: true,
          },
          {
            name: 'nome',
            type: 'text',
            required: true,
          },
          {
            name: 'natureza',
            type: 'select',
            values: ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'despesa'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'grupo',
            type: 'text',
            required: true,
          },
          {
            name: 'fixoOuVariavel',
            type: 'select',
            values: ['fixo', 'variavel'],
            maxSelect: 1,
            required: false,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
          {
            name: 'criado_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_plano_codigo ON plano_contas_customizadas (codigo)'],
      })
      app.save(colPlano)
      console.log("Migration 0061: Coleção 'plano_contas_customizadas' criada com sucesso.")
    } catch (err) {
      console.log("Aviso ao criar 'plano_contas_customizadas':", err.message)
    }
  },
  (app) => {
    try {
      const col1 = app.findCollectionByNameOrId('assistente_conversas')
      app.delete(col1)
    } catch (_) {}
    try {
      const col2 = app.findCollectionByNameOrId('plano_contas_customizadas')
      app.delete(col2)
    } catch (_) {}
  },
)
