migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Adicionar campo 'roles' (select multi-valor, maxSelect 5)
    if (!usersCol.fields.getByName('roles')) {
      usersCol.fields.add(
        new SelectField({
          name: 'roles',
          required: false,
          maxSelect: 5,
          values: ['admin', 'comercial', 'tecnico', 'financeiro', 'terceiro'],
        }),
      )
    }

    // Tornar o campo legado role não-obrigatório para permitir transição suave
    const oldRoleField = usersCol.fields.getByName('role')
    if (oldRoleField) {
      oldRoleField.required = false
    }

    // Atualizar regras de API da coleção users
    // Admin pode listar, visualizar, criar, atualizar e excluir
    // Usuários autenticados podem listar e ver seus colegas para chat/comunicações
    const adminCheck = "@request.auth.role = 'admin' || @request.auth.roles ~ 'admin'"
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = adminCheck
    usersCol.updateRule =
      "@request.auth.id != '' && (" +
      adminCheck +
      ' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.roles:changed = false && @request.body.ativo:changed = false))'
    usersCol.deleteRule = adminCheck

    app.save(usersCol)

    // 2. Backfill: popular 'roles' com [role] para todos os usuários existentes
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET roles = json_array(role) WHERE (roles IS NULL OR roles = '' OR roles = '[]') AND role IS NOT NULL AND role != ''",
        )
        .execute()
    } catch (e) {
      console.log('Aviso ao sincronizar roles:', e)
    }

    // 3. Atualizar regras de API das coleções principais para refletir múltiplos roles (roles ~ '...')
    const updateRuleWithRoles = (colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        let changed = false
        const replaceRules = (rule) => {
          if (!rule) return rule
          let updated = rule
          // Substituir comparações simples mantendo retrocompatibilidade
          if (
            updated.includes("@request.auth.role = 'admin'") &&
            !updated.includes("@request.auth.roles ~ 'admin'")
          ) {
            updated = updated
              .split("@request.auth.role = 'admin'")
              .join("(@request.auth.role = 'admin' || @request.auth.roles ~ 'admin')")
            changed = true
          }
          if (
            updated.includes("@request.auth.role = 'comercial'") &&
            !updated.includes("@request.auth.roles ~ 'comercial'")
          ) {
            updated = updated
              .split("@request.auth.role = 'comercial'")
              .join("(@request.auth.role = 'comercial' || @request.auth.roles ~ 'comercial')")
            changed = true
          }
          if (
            updated.includes("@request.auth.role = 'tecnico'") &&
            !updated.includes("@request.auth.roles ~ 'tecnico'")
          ) {
            updated = updated
              .split("@request.auth.role = 'tecnico'")
              .join("(@request.auth.role = 'tecnico' || @request.auth.roles ~ 'tecnico')")
            changed = true
          }
          if (
            updated.includes("@request.auth.role = 'financeiro'") &&
            !updated.includes("@request.auth.roles ~ 'financeiro'")
          ) {
            updated = updated
              .split("@request.auth.role = 'financeiro'")
              .join("(@request.auth.role = 'financeiro' || @request.auth.roles ~ 'financeiro')")
            changed = true
          }
          if (
            updated.includes("@request.auth.role = 'terceiro'") &&
            !updated.includes("@request.auth.roles ~ 'terceiro'")
          ) {
            updated = updated
              .split("@request.auth.role = 'terceiro'")
              .join("(@request.auth.role = 'terceiro' || @request.auth.roles ~ 'terceiro')")
            changed = true
          }
          return updated
        }

        col.listRule = replaceRules(col.listRule)
        col.viewRule = replaceRules(col.viewRule)
        col.createRule = replaceRules(col.createRule)
        col.updateRule = replaceRules(col.updateRule)
        col.deleteRule = replaceRules(col.deleteRule)

        if (changed) {
          app.save(col)
        }
      } catch (_) {}
    }

    const colecoes = [
      'clientes',
      'contatos',
      'empreendimentos',
      'servicos_catalogo',
      'oportunidades',
      'modelos_documentos',
      'propostas',
      'contratos',
      'sequencias',
      'projetos',
      'processos',
      'exigencias',
      'tarefas',
      'parcelas',
      'documentos',
      'links_externos',
      'atividades',
      'anexos',
      'ordens_servico',
      'importacoes_log',
      'colaboradores',
      'fornecedores',
      'balancetes_mensais',
      'contas_bancarias',
      'plano_contas',
      'contas_pagar',
      'credores',
      'extratos_bancarios',
      'extratos_transacoes',
      'ativos_patrimonio',
      'valuations',
      'empresa',
    ]

    for (const c of colecoes) {
      updateRuleWithRoles(c)
    }
  },
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (usersCol.fields.getByName('roles')) {
      usersCol.fields.removeByName('roles')
      app.save(usersCol)
    }
  },
)
