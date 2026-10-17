migrate(
  (app) => {
    // 1. Adicionar campos de plano de contas e flag de override manual em extratos_transacoes
    if (app.hasTable('extratos_transacoes')) {
      const colExtratos = app.findCollectionByNameOrId('extratos_transacoes')
      let changedExtratos = false

      if (!colExtratos.fields.getByName('plano_contas_codigo')) {
        colExtratos.fields.add(
          new TextField({
            name: 'plano_contas_codigo',
            required: false,
          }),
        )
        changedExtratos = true
      }
      if (!colExtratos.fields.getByName('plano_contas_nome')) {
        colExtratos.fields.add(
          new TextField({
            name: 'plano_contas_nome',
            required: false,
          }),
        )
        changedExtratos = true
      }
      if (!colExtratos.fields.getByName('classificacao_manual')) {
        colExtratos.fields.add(
          new BoolField({
            name: 'classificacao_manual',
            required: false,
          }),
        )
        changedExtratos = true
      }

      if (changedExtratos) {
        app.save(colExtratos)
        console.log(
          "Migration 0063: Campos de classificação contábil adicionados em 'extratos_transacoes'.",
        )
      }
    }

    // 2. Adicionar campos em parcelas
    if (app.hasTable('parcelas')) {
      const colParcelas = app.findCollectionByNameOrId('parcelas')
      let changedParcelas = false

      if (!colParcelas.fields.getByName('plano_contas_codigo')) {
        colParcelas.fields.add(
          new TextField({
            name: 'plano_contas_codigo',
            required: false,
          }),
        )
        changedParcelas = true
      }
      if (!colParcelas.fields.getByName('plano_contas_nome')) {
        colParcelas.fields.add(
          new TextField({
            name: 'plano_contas_nome',
            required: false,
          }),
        )
        changedParcelas = true
      }
      if (!colParcelas.fields.getByName('classificacao_manual')) {
        colParcelas.fields.add(
          new BoolField({
            name: 'classificacao_manual',
            required: false,
          }),
        )
        changedParcelas = true
      }

      if (changedParcelas) {
        app.save(colParcelas)
        console.log("Migration 0063: Campos de classificação contábil adicionados em 'parcelas'.")
      }
    }

    // 3. Adicionar classificacao_manual em contas_pagar e contas_receber
    if (app.hasTable('contas_pagar')) {
      const colCp = app.findCollectionByNameOrId('contas_pagar')
      if (!colCp.fields.getByName('classificacao_manual')) {
        colCp.fields.add(
          new BoolField({
            name: 'classificacao_manual',
            required: false,
          }),
        )
        app.save(colCp)
      }
    }

    if (app.hasTable('contas_receber')) {
      const colCr = app.findCollectionByNameOrId('contas_receber')
      if (!colCr.fields.getByName('classificacao_manual')) {
        colCr.fields.add(
          new BoolField({
            name: 'classificacao_manual',
            required: false,
          }),
        )
        app.save(colCr)
      }
    }
  },
  (app) => {
    // Reversão defensiva
    try {
      const colExtratos = app.findCollectionByNameOrId('extratos_transacoes')
      colExtratos.fields.removeByName('classificacao_manual')
      colExtratos.fields.removeByName('plano_contas_codigo')
      colExtratos.fields.removeByName('plano_contas_nome')
      app.save(colExtratos)
    } catch (_) {}

    try {
      const colParcelas = app.findCollectionByNameOrId('parcelas')
      colParcelas.fields.removeByName('classificacao_manual')
      colParcelas.fields.removeByName('plano_contas_codigo')
      colParcelas.fields.removeByName('plano_contas_nome')
      app.save(colParcelas)
    } catch (_) {}
  },
)
