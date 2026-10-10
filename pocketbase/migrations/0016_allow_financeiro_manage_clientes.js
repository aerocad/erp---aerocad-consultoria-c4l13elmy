migrate(
  (app) => {
    // 1. Atualizar regras da coleção clientes para permitir que usuários financeiro também criem e atualizem clientes
    // (necessário para a importação e vinculação de NFS-e por administradores e usuários financeiros)
    const clientes = app.findCollectionByNameOrId('clientes')
    const adminOrComOrFin =
      "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"
    clientes.createRule = adminOrComOrFin
    clientes.updateRule = adminOrComOrFin
    app.save(clientes)
  },
  (app) => {
    try {
      const clientes = app.findCollectionByNameOrId('clientes')
      const adminOrCom = "@request.auth.role = 'admin' || @request.auth.role = 'comercial'"
      clientes.createRule = adminOrCom
      clientes.updateRule = adminOrCom
      app.save(clientes)
    } catch (_) {}
  },
)
