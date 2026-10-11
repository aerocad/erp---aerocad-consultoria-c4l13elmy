migrate(
  (app) => {
    // 1. Atualizar regras de update e campos na coleção projetos:
    // Apenas admin e tecnico podem atualizar o nome do projeto (e outros campos técnicos).
    // O campo numero AAAA-NNN é numeração sequencial global protegida e NÃO pode ser alterado por usuários comuns.
    // Comercial e financeiro podem ter update em seus campos operacionais, mas alteração do nome é restrita a admin e tecnico.
    const projetos = app.findCollectionByNameOrId('projetos')

    // Regra de update:
    // Se o nome foi alterado (@request.body.nome:changed = true), o usuário DEVE ser admin ou tecnico.
    // O número sequencial (@request.body.numero:changed) NUNCA pode ser alterado por ninguém via API (apenas gerado na criação).
    // Usuários com perfil admin ou tecnico têm permissão plena de update (exceto numero).
    // Usuários com perfil comercial ou financeiro podem atualizar somente se nome e numero não foram alterados.
    const safeUpdateRule =
      "(@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || ((@request.auth.role = 'comercial' || @request.auth.role = 'financeiro') && @request.body.nome:changed = false)) && @request.body.numero:changed = false"

    projetos.updateRule = safeUpdateRule
    app.save(projetos)
  },
  (app) => {
    try {
      const projetos = app.findCollectionByNameOrId('projetos')
      projetos.updateRule =
        "@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"
      app.save(projetos)
    } catch (_) {}
  },
)
