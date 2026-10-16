migrate(
  (app) => {
    // 1. Coleção extratos: adiciona hash_arquivo (SHA-256 do conteúdo do arquivo)
    const extratosCol = app.findCollectionByNameOrId('extratos')
    let extratosModified = false

    if (!extratosCol.fields.getByName('hash_arquivo')) {
      extratosCol.fields.add(
        new TextField({
          name: 'hash_arquivo',
          required: false,
        }),
      )
      extratosModified = true
    }

    if (extratosModified) {
      app.save(extratosCol)
    }

    // 2. Coleção extratos_transacoes: adiciona fingerprint (hash determinístico de conta + data + valor + documento/fitid)
    const txCol = app.findCollectionByNameOrId('extratos_transacoes')
    let txModified = false

    if (!txCol.fields.getByName('fingerprint')) {
      txCol.fields.add(
        new TextField({
          name: 'fingerprint',
          required: false,
        }),
      )
      txModified = true
    }

    if (txModified) {
      app.save(txCol)
    }

    // 3. Adiciona índice de busca rápida em fingerprint
    try {
      txCol.addIndex('idx_extratos_transacoes_fingerprint', false, 'fingerprint', '')
      app.save(txCol)
    } catch (_) {
      // Ignora caso índice já exista
    }

    try {
      extratosCol.addIndex('idx_extratos_hash_arquivo', false, 'hash_arquivo', '')
      app.save(extratosCol)
    } catch (_) {
      // Ignora caso índice já exista
    }
  },
  (app) => {
    try {
      const txCol = app.findCollectionByNameOrId('extratos_transacoes')
      txCol.removeIndex('idx_extratos_transacoes_fingerprint')
      const fpField = txCol.fields.getByName('fingerprint')
      if (fpField) {
        txCol.fields.removeByName('fingerprint')
      }
      app.save(txCol)
    } catch (_) {}

    try {
      const extratosCol = app.findCollectionByNameOrId('extratos')
      extratosCol.removeIndex('idx_extratos_hash_arquivo')
      const hashField = extratosCol.fields.getByName('hash_arquivo')
      if (hashField) {
        extratosCol.fields.removeByName('hash_arquivo')
      }
      app.save(extratosCol)
    } catch (_) {}
  },
)
