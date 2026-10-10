migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const ordensCol = app.findCollectionByNameOrId('ordens_servico')
    const projetosCol = app.findCollectionByNameOrId('projetos')

    // 1. Criar/garantir usuário terceiro de teste
    // Prestador João Valmir Bigattão
    let terceiroUser
    try {
      terceiroUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'joao.bigattao@prestador.aerocad.com.br',
      )
      terceiroUser.set('name', 'João Valmir Bigattão')
      terceiroUser.set('role', 'terceiro')
      terceiroUser.setVerified(true)
      app.save(terceiroUser)
    } catch (_) {
      terceiroUser = new Record(usersCol)
      terceiroUser.setEmail('joao.bigattao@prestador.aerocad.com.br')
      terceiroUser.setPassword('Skip@Pass')
      terceiroUser.setVerified(true)
      terceiroUser.set('name', 'João Valmir Bigattão')
      terceiroUser.set('role', 'terceiro')
      app.save(terceiroUser)
    }

    // 2. Localizar um projeto existente para vincular a OS de teste
    let projeto
    try {
      projeto = app.findFirstRecordByData('projetos', 'numero', '2026-232')
    } catch (_) {
      try {
        const projs = app.findRecordsByFilter('projetos', "status = 'ativo'", '-created', 1, 0)
        if (projs.length > 0) projeto = projs[0]
      } catch (_) {}
    }

    if (projeto && terceiroUser) {
      // Criar OS de teste para João Valmir Bigattão se não existir
      try {
        app.findFirstRecordByData(
          'ordens_servico',
          'titulo',
          'Levantamento Altimétrico e Modelagem de Superfícies OLS',
        )
      } catch (_) {
        const os1 = new Record(ordensCol)
        os1.set('projeto', projeto.id)
        os1.set('prestador_usuario', terceiroUser.id)
        os1.set('prestador', 'João Valmir Bigattão')
        os1.set('titulo', 'Levantamento Altimétrico e Modelagem de Superfícies OLS')
        os1.set(
          'descricao',
          'Executar a checagem altimétrica e modelagem das superfícies limitadoras de obstáculos segundo a ICA 11-408 para o empreendimento Reservatório Norte.',
        )
        os1.set('valor_interno', 3500)
        os1.set('status', 'atribuida')
        const prazoDate = new Date()
        prazoDate.setDate(prazoDate.getDate() + 15)
        os1.set('prazo', prazoDate.toISOString().split('T')[0] + ' 18:00:00.000Z')
        app.save(os1)
      }
    }
  },
  (app) => {
    try {
      const u = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'joao.bigattao@prestador.aerocad.com.br',
      )
      app.delete(u)
    } catch (_) {}
  },
)
