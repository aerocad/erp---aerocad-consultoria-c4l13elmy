migrate(
  (app) => {
    // 1. Adicionar campo 'ativo' (bool) na coleção users se não existir
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
    }

    // Regra da coleção users:
    // Usuários comuns podem listar usuários se autenticados (necessário para o chat interno entre usuários)
    // List/View: @request.auth.id != ''
    // Create/Delete: @request.auth.role = 'admin'
    // Update: @request.auth.id != '' && (@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.ativo:changed = false))
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = "@request.auth.role = 'admin'"
    usersCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.ativo:changed = false))"
    usersCol.deleteRule = "@request.auth.role = 'admin'"

    app.save(usersCol)

    // Garantir que os usuários existentes fiquem com ativo = true
    app.db().newQuery('UPDATE users SET ativo = 1 WHERE ativo IS NULL').execute()

    // 2. Criar coleção 'mensagens' para troca de mensagens de texto 1:1 entre operadores
    if (!app.hasTable('mensagens')) {
      const mensagens = new Collection({
        name: 'mensagens',
        type: 'base',
        // listRule e viewRule: só remetente ou destinatário podem ler
        listRule:
          "@request.auth.id != '' && (remetente = @request.auth.id || destinatario = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (remetente = @request.auth.id || destinatario = @request.auth.id)",
        // createRule: autenticado e remetente deve ser o próprio autor autenticado
        createRule: "@request.auth.id != '' && @request.body.remetente = @request.auth.id",
        // updateRule: destinatário pode marcar como lido, ou remetente
        updateRule:
          "@request.auth.id != '' && (destinatario = @request.auth.id || remetente = @request.auth.id)",
        // deleteRule: apenas remetente ou admin
        deleteRule:
          "@request.auth.id != '' && (remetente = @request.auth.id || @request.auth.role = 'admin')",
        fields: [
          {
            name: 'remetente',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'destinatario',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'texto',
            type: 'text',
            required: true,
          },
          {
            name: 'lido',
            type: 'bool',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_mensagens_remetente ON mensagens (remetente)',
          'CREATE INDEX idx_mensagens_destinatario ON mensagens (destinatario)',
          'CREATE INDEX idx_mensagens_lido ON mensagens (lido)',
          'CREATE INDEX idx_mensagens_created ON mensagens (created)',
        ],
      })
      app.save(mensagens)
    }
  },
  (app) => {
    try {
      const mensagens = app.findCollectionByNameOrId('mensagens')
      app.delete(mensagens)
    } catch (_) {}

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (usersCol.fields.getByName('ativo')) {
      usersCol.fields.removeByName('ativo')
      app.save(usersCol)
    }
  },
)
