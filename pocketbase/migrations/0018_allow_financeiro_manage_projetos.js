migrate(
  (app) => {
    // 1. Atualizar regras da coleção projetos para permitir que usuários com perfil 'financeiro'
    // também possam criar e atualizar projetos (necessário para extração/sugestão de projetos a partir de NFS-e)
    const projetos = app.findCollectionByNameOrId('projetos')
    const createUpdateRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"
    projetos.createRule = createUpdateRule
    projetos.updateRule = createUpdateRule
    app.save(projetos)
  },
  (app) => {
    try {
      const projetos = app.findCollectionByNameOrId('projetos')
      const originalRule =
        "@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial'"
      projetos.createRule = originalRule
      projetos.updateRule = originalRule
      app.save(projetos)
    } catch (_) {}
  },
)
