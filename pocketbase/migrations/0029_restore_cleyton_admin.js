migrate(
  (app) => {
    // 1. Localizar Cleyton Saraiva por email ou nome e restaurar role para 'admin'
    let cleyton = null
    try {
      cleyton = app.findAuthRecordByEmail('_pb_users_auth_', 'cleytonsaraiva@aerocad.com.br')
    } catch (_) {
      try {
        cleyton = app.findFirstRecordByData(
          '_pb_users_auth_',
          'email',
          'cleytonsaraiva@aerocad.com.br',
        )
      } catch (_) {
        const users = app.findRecordsByFilter(
          '_pb_users_auth_',
          'name ~ "Cleyton" || name ~ "Saraiva"',
          '',
          1,
          0,
        )
        if (users && users.length > 0) {
          cleyton = users[0]
        }
      }
    }

    if (cleyton) {
      cleyton.set('role', 'admin')
      app.save(cleyton)
    }

    // 2. Garantir que exista ao menos um usuário com role 'admin'
    const admins = app.findRecordsByFilter('_pb_users_auth_', 'role = "admin"', '', 10, 0)
    if (!admins || admins.length === 0) {
      if (cleyton) {
        cleyton.set('role', 'admin')
        app.save(cleyton)
      } else {
        const allUsers = app.findRecordsByFilter('_pb_users_auth_', '', 'created', 1, 0)
        if (allUsers && allUsers.length > 0) {
          allUsers[0].set('role', 'admin')
          app.save(allUsers[0])
        }
      }
    }
  },
  (app) => {
    // Reversão opcional (não rebaixa Cleyton se ele for o único admin)
  },
)
