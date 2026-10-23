/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Criar collection lancamentos_contabeis_manuais se não existir
    try {
      const existing = app.findCollectionByNameOrId('lancamentos_contabeis_manuais')
      if (existing) {
        return
      }
    } catch (_) {
      // prosseguir com criação
    }

    const collection = new Collection({
      name: 'lancamentos_contabeis_manuais',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: null, // Proibida exclusão física conforme especificação (apenas estorno)
      fields: [
        {
          name: 'data_lancamento',
          type: 'date',
          required: true,
        },
        {
          name: 'historico',
          type: 'text',
          required: true,
        },
        {
          name: 'linhas_partidas',
          type: 'json',
          required: true,
        },
        {
          name: 'valor_total',
          type: 'number',
          required: true,
        },
        {
          name: 'tipo_fato',
          type: 'text',
          required: false,
        },
        {
          name: 'socio',
          type: 'text',
          required: false,
        },
        {
          name: 'anexo',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640,
          required: false,
        },
        {
          name: 'estornado',
          type: 'bool',
          required: false,
        },
        {
          name: 'estorno_de_id',
          type: 'text',
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
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('lancamentos_contabeis_manuais')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
