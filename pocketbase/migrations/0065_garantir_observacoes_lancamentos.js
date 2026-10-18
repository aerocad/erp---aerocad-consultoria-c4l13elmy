migrate(
  (app) => {
    // 1. Garantir campo observacoes em extratos_transacoes
    if (app.hasTable('extratos_transacoes')) {
      const colExtratos = app.findCollectionByNameOrId('extratos_transacoes')
      if (!colExtratos.fields.getByName('observacoes')) {
        colExtratos.fields.add(
          new TextField({
            name: 'observacoes',
            required: false,
          }),
        )
        app.save(colExtratos)
        console.log("Migration 0065: Campo 'observacoes' adicionado em 'extratos_transacoes'.")
      }
    }

    // 2. Garantir campo observacoes em contas_pagar
    if (app.hasTable('contas_pagar')) {
      const colCp = app.findCollectionByNameOrId('contas_pagar')
      if (!colCp.fields.getByName('observacoes')) {
        colCp.fields.add(
          new TextField({
            name: 'observacoes',
            required: false,
          }),
        )
        app.save(colCp)
        console.log("Migration 0065: Campo 'observacoes' adicionado em 'contas_pagar'.")
      }
    }
  },
  (app) => {
    // Reversão defensiva (não remove se já existir)
  },
)
