migrate(
  (app) => {
    // 0039_funnel_services_trails_collaborators.js
    // 1. Tornar campo trilha_prevista de oportunidades do tipo text (ou garantir que aceite qualquer trilha customizada)
    const oportunidadesCol = app.findCollectionByNameOrId('oportunidades')
    const colaboradoresCol = app.findCollectionByNameOrId('colaboradores')

    // Se o campo responsavel_colaborador não existir na oportunidade, adicionar para vincular diretamente aos colaboradores de /pessoal
    if (!oportunidadesCol.fields.getByName('responsavel_colaborador')) {
      oportunidadesCol.fields.add(
        new RelationField({
          name: 'responsavel_colaborador',
          type: 'relation',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Se o campo trilha_prevista_nome não existir, adicionar como campo texto para suportar trilhas customizadas livres
    if (!oportunidadesCol.fields.getByName('trilha_prevista_nome')) {
      oportunidadesCol.fields.add(
        new TextField({
          name: 'trilha_prevista_nome',
          type: 'text',
          required: false,
        }),
      )
    }

    // Se o campo servico_nome não existir, adicionar campo de texto complementar para guardar o nome do serviço caso digitado livremente
    if (!oportunidadesCol.fields.getByName('servico_nome')) {
      oportunidadesCol.fields.add(
        new TextField({
          name: 'servico_nome',
          type: 'text',
          required: false,
        }),
      )
    }

    app.save(oportunidadesCol)

    // 2. Localizar usuários do sistema fictícios/semeados que não correspondem a pessoas reais
    // Rafael Duarte (s59vb0tn34737vp) e Paula Ribeiro (t2xnbh69o0w8sgz) foram nomes de exemplo/placeholder
    // criados no seed inicial e que NÃO existem na coleção colaboradores reais de /pessoal.
    // Localizar Cleyton Saraiva (usuário admin real) ou Jaqueline Mota (comercial real) para reatribuição segura
    let cleytonUser = null
    try {
      cleytonUser = app.findAuthRecordByEmail('_pb_users_auth_', 'cleytonsaraiva@aerocad.com.br')
    } catch (_) {}

    const fakeEmails = ['rafaelduarte@aerocad.com.br', 'paularibeiro@aerocad.com.br']
    const fakeUserIds = []

    for (const email of fakeEmails) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', email)
        fakeUserIds.push(u.id)
      } catch (_) {}
    }

    // Se alguma oportunidade referenciar fakeUserIds, reatribuir para Cleyton Saraiva
    if (fakeUserIds.length > 0 && cleytonUser) {
      try {
        const opps = app.findRecordsByFilter('oportunidades', '', '-created', 1000, 0)
        for (const opp of opps) {
          const resp = opp.getString('responsavel')
          if (fakeUserIds.includes(resp)) {
            opp.set('responsavel', cleytonUser.id)
            app.save(opp)
          }
        }
      } catch (err) {
        console.warn('Erro ao reatribuir oportunidades:', err)
      }

      // Desvincular de tarefas ou outras entidades se houver
      try {
        const tarefas = app.findRecordsByFilter('tarefas', '', '-created', 1000, 0)
        for (const t of tarefas) {
          const resp = t.getString('responsavel')
          if (fakeUserIds.includes(resp)) {
            t.set('responsavel', cleytonUser.id)
            app.save(t)
          }
        }
      } catch (_) {}

      // Projetos: checar se algum apontava para os fakes
      try {
        const projs = app.findRecordsByFilter('projetos', '', '-created', 1000, 0)
        for (const p of projs) {
          const resp = p.getString('responsavel_tecnico')
          if (fakeUserIds.includes(resp)) {
            p.set('responsavel_tecnico', cleytonUser.id)
            app.save(p)
          }
        }
      } catch (_) {}

      // Agora remover os registros de usuários fictícios da coleção users
      for (const fId of fakeUserIds) {
        try {
          const rec = app.findFirstRecordByData('_pb_users_auth_', 'id', fId)
          app.delete(rec)
          console.log('Usuário placeholder removido:', fId)
        } catch (e) {
          console.warn('Não foi possível remover usuário fake:', e)
        }
      }
    }

    // 3. Vincular oportunidades existentes ao colaborador correspondente de /pessoal
    // Cleyton Saraiva no colaboradores tem id: 58m1dmclp210v73
    // Jaqueline Mota no colaboradores tem id: 35uz0l32jou8txe
    try {
      let colabCleyton = null
      let colabJaqueline = null
      try {
        colabCleyton = app.findFirstRecordByData(
          'colaboradores',
          'email',
          'cleytonsaraiva@aerocad.com.br',
        )
      } catch (_) {}
      try {
        colabJaqueline = app.findFirstRecordByData(
          'colaboradores',
          'email',
          'jaquelinemota@aerocad.com.br',
        )
      } catch (_) {}

      const opps = app.findRecordsByFilter('oportunidades', '', '-created', 1000, 0)
      for (const opp of opps) {
        const respUser = opp.getString('responsavel')
        const currentColab = opp.getString('responsavel_colaborador')
        if (!currentColab) {
          if (cleytonUser && respUser === cleytonUser.id && colabCleyton) {
            opp.set('responsavel_colaborador', colabCleyton.id)
            app.save(opp)
          } else if (colabJaqueline) {
            // Se for Jaqueline ou padrão
            opp.set('responsavel_colaborador', colabJaqueline.id)
            app.save(opp)
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao vincular colaborador inicial em oportunidades:', e)
    }
  },
  (app) => {
    try {
      const oportunidadesCol = app.findCollectionByNameOrId('oportunidades')
      if (oportunidadesCol.fields.getByName('responsavel_colaborador')) {
        oportunidadesCol.fields.removeByName('responsavel_colaborador')
      }
      if (oportunidadesCol.fields.getByName('trilha_prevista_nome')) {
        oportunidadesCol.fields.removeByName('trilha_prevista_nome')
      }
      if (oportunidadesCol.fields.getByName('servico_nome')) {
        oportunidadesCol.fields.removeByName('servico_nome')
      }
      app.save(oportunidadesCol)
    } catch (_) {}
  },
)
