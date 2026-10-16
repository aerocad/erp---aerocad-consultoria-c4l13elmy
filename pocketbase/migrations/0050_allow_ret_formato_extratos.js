migrate(
  (app) => {
    const extratosCol = app.findCollectionByNameOrId('extratos')
    const formatoField = extratosCol.fields.getByName('formato')

    if (formatoField) {
      // Adiciona 'ret' aos valores permitidos no select formato
      const currentValues = Array.isArray(formatoField.values) ? formatoField.values : []
      if (!currentValues.includes('ret')) {
        formatoField.values = [...currentValues, 'ret']
        app.save(extratosCol)
      }
    }
  },
  (app) => {
    const extratosCol = app.findCollectionByNameOrId('extratos')
    const formatoField = extratosCol.fields.getByName('formato')
    if (formatoField && Array.isArray(formatoField.values)) {
      formatoField.values = formatoField.values.filter((v) => v !== 'ret')
      app.save(extratosCol)
    }
  },
)
