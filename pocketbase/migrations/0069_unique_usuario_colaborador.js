migrate(
  (app) => {
    // 1. Deduplicar caso algum usuário_sistema tenha sido associado a mais de um colaborador
    try {
      app
        .db()
        .newQuery(
          "UPDATE colaboradores SET usuario_sistema = '' WHERE usuario_sistema != '' AND id NOT IN (SELECT MIN(id) FROM colaboradores WHERE usuario_sistema != '' GROUP BY usuario_sistema)",
        )
        .execute()
    } catch (e) {
      console.log('Aviso ao deduplicar usuario_sistema:', e)
    }

    // 2. Adicionar índice único condicional em colaboradores (usuario_sistema) WHERE usuario_sistema != ''
    const col = app.findCollectionByNameOrId('colaboradores')
    col.addIndex(
      'idx_colaboradores_usuario_sistema_unique',
      true,
      'usuario_sistema',
      "usuario_sistema != ''",
    )
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('colaboradores')
      col.removeIndex('idx_colaboradores_usuario_sistema_unique')
      app.save(col)
    } catch (_) {}
  },
)
