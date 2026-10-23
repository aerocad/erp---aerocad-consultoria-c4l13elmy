/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('extratos_transacoes')
    if (!col) return

    try {
      col.fields.add(
        new TextField({
          name: 'socio',
          required: false,
        }),
      )
      app.save(col)
    } catch (_) {}

    // Criação da collection saldos_abertura_contabeis se não existir
    try {
      const existing = app.findCollectionByNameOrId('saldos_abertura_contabeis')
      if (!existing) {
        const saCol = new Collection({
          name: 'saldos_abertura_contabeis',
          type: 'base',
          listRule: '@request.auth.id != ""',
          viewRule: '@request.auth.id != ""',
          createRule: '@request.auth.id != ""',
          updateRule: '@request.auth.id != ""',
          deleteRule: '@request.auth.id != ""',
          fields: [
            {
              name: 'ano_exercicio',
              type: 'number',
              required: true,
            },
            {
              name: 'data_abertura',
              type: 'date',
              required: true,
            },
            {
              name: 'status',
              type: 'text',
              required: false,
            },
            {
              name: 'contas_saldos',
              type: 'json',
              required: true,
            },
            {
              name: 'lucros_prejuizos_ajuste',
              type: 'number',
              required: false,
            },
            {
              name: 'observacoes',
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
        app.save(saCol)
      }
    } catch (_) {}
  },
  (app) => {
    // down
  },
)
