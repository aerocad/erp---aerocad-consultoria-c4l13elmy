/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0057: Adicionar forma_aquisicao e quantidade_parcelas na coleção ativos_patrimonio
 * - forma_aquisicao: select (a_vista | financiamento | parcelamento), default "a_vista"
 * - quantidade_parcelas: number (inteiro, min 1 quando financiamento/parcelamento)
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ativos_patrimonio')
    if (!col) return

    // 1. Campo forma_aquisicao
    const campoForma = col.fields.getByName('forma_aquisicao')
    if (!campoForma) {
      col.fields.add(
        new SelectField({
          name: 'forma_aquisicao',
          maxSelect: 1,
          values: ['a_vista', 'financiamento', 'parcelamento'],
        }),
      )
    }

    // 2. Campo quantidade_parcelas
    const campoParcelas = col.fields.getByName('quantidade_parcelas')
    if (!campoParcelas) {
      col.fields.add(
        new NumberField({
          name: 'quantidade_parcelas',
          min: 1,
          onlyInt: true,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('ativos_patrimonio')
    if (!col) return

    const campoForma = col.fields.getByName('forma_aquisicao')
    if (campoForma) col.fields.removeByName('forma_aquisicao')

    const campoParcelas = col.fields.getByName('quantidade_parcelas')
    if (campoParcelas) col.fields.removeByName('quantidade_parcelas')

    app.save(col)
  },
)
