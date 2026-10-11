migrate(
  (app) => {
    // 1. Reforçar deleteRule para exclusivo de admin em 'clientes'
    const clientesCol = app.findCollectionByNameOrId('clientes')
    clientesCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(clientesCol)

    // 2. Garantir deleteRule exclusivo de admin em 'projetos'
    const projetosCol = app.findCollectionByNameOrId('projetos')
    projetosCol.deleteRule = "@request.auth.role = 'admin'"
    app.save(projetosCol)
  },
  (app) => {
    try {
      const clientesCol = app.findCollectionByNameOrId('clientes')
      clientesCol.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'comercial'"
      app.save(clientesCol)
    } catch (_) {}
  },
)
