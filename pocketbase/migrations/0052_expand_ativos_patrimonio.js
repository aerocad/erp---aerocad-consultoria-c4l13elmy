migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ativos_patrimonio')
    let changed = false

    // 1. Atualizar select 'categoria' para incluir 'terreno' (e garantir 'veiculo')
    const catField = col.fields.getByName('categoria')
    if (catField) {
      const currentValues = catField.values || []
      const valuesToAdd = ['terreno', 'veiculo']
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

    // 2. Campo credor (relação com credores)
    if (!col.fields.getByName('credor')) {
      try {
        const credoresCol = app.findCollectionByNameOrId('credores')
        col.fields.add(
          new RelationField({
            name: 'credor',
            collectionId: credoresCol.id,
            maxSelect: 1,
          }),
        )
        changed = true
      } catch (_) {}
    }

    // 3. Campo anexos (múltiplos arquivos)
    if (!col.fields.getByName('anexos')) {
      col.fields.add(
        new FileField({
          name: 'anexos',
          maxSelect: 10,
          maxSize: 31457280, // 30 MB
        }),
      )
      changed = true
    }

    // 4. Campo anexos_metadados (json para tipos de documentos: comprovante, contrato, laudo, matrícula etc)
    if (!col.fields.getByName('anexos_metadados')) {
      col.fields.add(
        new JSONField({
          name: 'anexos_metadados',
          maxSize: 100000,
        }),
      )
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
