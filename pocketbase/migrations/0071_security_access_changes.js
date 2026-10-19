/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0071:
 * 1. Adiciona campo 'primeiro_acesso' (bool) na coleção 'users' para fluxo de primeiro login
 * 2. Adiciona campo 'menus_visiveis' (json) na coleção 'users' para controle fino de visibilidade pelo admin
 * 3. Garante regras de deleção estritas a administradores em projetos, users, colaboradores e fornecedores
 */
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Campo primeiro_acesso (bool)
    if (!usersCol.fields.getByName('primeiro_acesso')) {
      usersCol.fields.add(
        new BoolField({
          name: 'primeiro_acesso',
          required: false,
        }),
      )
    }

    // 2. Campo menus_visiveis (json)
    if (!usersCol.fields.getByName('menus_visiveis')) {
      usersCol.fields.add(
        new JSONField({
          name: 'menus_visiveis',
          required: false,
        }),
      )
    }

    // Atualizar regra de update de users permitindo ao próprio usuário desativar seu primeiro_acesso
    const adminCheck = "@request.auth.role = 'admin' || @request.auth.roles ~ 'admin'"
    usersCol.updateRule =
      "@request.auth.id != '' && (" +
      adminCheck +
      ' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.roles:changed = false && @request.body.ativo:changed = false && @request.body.menus_visiveis:changed = false))'

    usersCol.deleteRule = adminCheck
    app.save(usersCol)

    // 3. Garantir deleteRule restrita a admin nas 4 coleções
    const colecoesAdminDelete = ['projetos', 'colaboradores', 'fornecedores']
    for (const nome of colecoesAdminDelete) {
      try {
        const c = app.findCollectionByNameOrId(nome)
        c.deleteRule = adminCheck
        app.save(c)
      } catch (err) {
        console.log(`Aviso ao atualizar deleteRule de ${nome}:`, err)
      }
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('primeiro_acesso')) {
        usersCol.fields.removeByName('primeiro_acesso')
      }
      if (usersCol.fields.getByName('menus_visiveis')) {
        usersCol.fields.removeByName('menus_visiveis')
      }
      app.save(usersCol)
    } catch (_) {}
  },
)
