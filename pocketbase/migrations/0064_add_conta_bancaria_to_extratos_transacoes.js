migrate(
  (app) => {
    // 1. Adiciona o campo relation conta_bancaria em extratos_transacoes caso não exista
    if (app.hasTable('extratos_transacoes')) {
      const col = app.findCollectionByNameOrId('extratos_transacoes')
      if (!col.fields.getByName('conta_bancaria')) {
        const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')
        col.fields.add(
          new RelationField({
            name: 'conta_bancaria',
            collectionId: contasBancariasCol.id,
            required: false,
            maxSelect: 1,
          }),
        )
        app.save(col)
        console.log("Migration 0064: Campo 'conta_bancaria' adicionado em 'extratos_transacoes'.")
      }

      // 2. Backfill seguro: preenche conta_bancaria das transações existentes a partir do extrato pai
      try {
        app
          .db()
          .newQuery(`
          UPDATE extratos_transacoes
          SET conta_bancaria = (
            SELECT extratos.conta_bancaria
            FROM extratos
            WHERE extratos.id = extratos_transacoes.extrato
          )
          WHERE (conta_bancaria IS NULL OR conta_bancaria = '')
            AND extrato IS NOT NULL
        `)
          .execute()
        console.log(
          "Migration 0064: Backfill de 'conta_bancaria' em 'extratos_transacoes' concluído.",
        )
      } catch (errBackfill) {
        console.warn('Aviso no backfill de conta_bancaria em extratos_transacoes:', errBackfill)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('extratos_transacoes')
      col.fields.removeByName('conta_bancaria')
      app.save(col)
    } catch (_) {}
  },
)
