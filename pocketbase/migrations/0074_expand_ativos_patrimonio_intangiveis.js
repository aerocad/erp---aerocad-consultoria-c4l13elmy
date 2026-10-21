migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ativos_patrimonio')
    let changed = false

    // Atualizar select 'categoria' para incluir as categorias de Ativos Intangíveis
    // (marca_patente, software_proprio_aegis, direito_autoral, goodwill_intangivel)
    const catField = col.fields.getByName('categoria')
    if (catField) {
      const currentValues = catField.values || []
      const valuesToAdd = [
        'marca_patente',
        'software_proprio_aegis',
        'direito_autoral',
        'goodwill_intangivel',
      ]
      const mergedValues = [...currentValues]
      for (const v of valuesToAdd) {
        if (!mergedValues.includes(v)) {
          mergedValues.push(v)
        }
      }
      catField.values = mergedValues
      catField.maxSelect = 1
      changed = true
    }

    if (changed) {
      app.save(col)
    }
  },
  (app) => {
    // Revert opcional
  },
)
