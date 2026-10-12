migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    const regimeField = col.fields.getByName('regime_contratacao')
    if (regimeField) {
      regimeField.values = ['pf_clt', 'pf_autonomo', 'pj', 'socio']
      regimeField.maxSelect = 1
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    const regimeField = col.fields.getByName('regime_contratacao')
    if (regimeField) {
      regimeField.values = ['pf_clt', 'pf_autonomo', 'pj']
      regimeField.maxSelect = 1
    }
    app.save(col)
  },
)
