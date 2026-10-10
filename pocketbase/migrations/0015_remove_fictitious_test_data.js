migrate(
  (app) => {
    // 0015_remove_fictitious_test_data.js
    // Exclui clientes fictícios de teste criados em seeds/testes iniciais e suas dependências em cascata,
    // preservando todos os clientes e dados reais importados da planilha (2020-2026).
    // Também remove o usuário de teste de prestador joao.bigattao@prestador.aerocad.com.br e a OS vinculada.

    // 1. IDs e e-mails dos clientes fictícios conhecidos
    const fictitiousClientEmails = [
      'engenharia@aguasdocerrado.com.br',
      'obras@shoppingplanalto.com.br',
      'projetos@agrovale.com.br',
      'cleytonsaraiva@gmail.com', // cadastrado no cliente de teste "Teste de CRM"
    ]

    const fictitiousClientCnpjs = [
      '12.345.678/0001-90',
      '23.456.789/0001-01',
      '34.567.890/0001-12',
      '11111111111111',
    ]

    const fictitiousClientNames = [
      'Águas do Cerrado S.A.',
      'Shopping Planalto Empreendimentos',
      'Agrovale Bioenergia Ltda.',
      'Teste de CRM',
    ]

    // Localizar clientes fictícios com segurança (NUNCA tocar em origem_importacao = true)
    const targetClientIds = new Set()

    try {
      const allClients = app.findRecordsByFilter('clientes', '', '-created', 1000, 0)
      for (const client of allClients) {
        // Se veio de importação de planilha, NUNCA remove
        if (client.getBool('origem_importacao')) {
          continue
        }

        const email = client.getString('email').trim().toLowerCase()
        const cnpj = client.getString('cnpj_cpf').trim()
        const razao = client.getString('razao_social').trim()

        if (
          fictitiousClientEmails.includes(email) ||
          fictitiousClientCnpjs.includes(cnpj) ||
          fictitiousClientNames.includes(razao)
        ) {
          targetClientIds.add(client.id)
        }
      }
    } catch (e) {
      console.log('Erro ao listar clientes para busca de ficticios:', e)
    }

    // Projetos fictícios específicos vinculados aos fictícios ou criados em seeds/testes:
    // 2026-232, 2026-233, 2026-234
    const fictitiousProjectNumbers = ['2026-232', '2026-233', '2026-234']
    const targetProjectIds = new Set()

    try {
      const allProjs = app.findRecordsByFilter('projetos', '', '-created', 1000, 0)
      for (const proj of allProjs) {
        if (proj.getBool('origem_importacao')) continue
        const num = proj.getString('numero').trim()
        const clientId = proj.getString('cliente')
        if (fictitiousProjectNumbers.includes(num) || targetClientIds.has(clientId)) {
          targetProjectIds.add(proj.id)
        }
      }
    } catch (e) {
      console.log('Erro ao buscar projetos ficticios:', e)
    }

    // Oportunidades fictícias:
    const targetOppIds = new Set()
    try {
      const allOpps = app.findRecordsByFilter('oportunidades', '', '-created', 1000, 0)
      for (const opp of allOpps) {
        const clientId = opp.getString('cliente')
        if (targetClientIds.has(clientId)) {
          targetOppIds.add(opp.id)
        }
      }
    } catch (e) {
      console.log('Erro ao buscar oportunidades ficticias:', e)
    }

    // Processos fictícios vinculados a projetos fictícios:
    const targetProcessIds = new Set()
    try {
      const allProc = app.findRecordsByFilter('processos', '', '-created', 1000, 0)
      for (const proc of allProc) {
        const projId = proc.getString('projeto')
        if (targetProjectIds.has(projId)) {
          targetProcessIds.add(proc.id)
        }
      }
    } catch (e) {
      console.log('Erro ao buscar processos ficticios:', e)
    }

    console.log(
      'Ficticios identificados para remocao: clientes=' +
        targetClientIds.size +
        ', projetos=' +
        targetProjectIds.size +
        ', oportunidades=' +
        targetOppIds.size +
        ', processos=' +
        targetProcessIds.size,
    )

    // Helper seguro para exclusão de lista de IDs de uma coleção
    const deleteRecordsById = (collectionName, idsSet) => {
      if (!idsSet || idsSet.size === 0) return
      for (const id of idsSet) {
        try {
          const rec = app.findFirstRecordByData(collectionName, 'id', id)
          app.delete(rec)
        } catch (_) {}
      }
    }

    // Helper para exclusão de registros que apontam para algum campo de relação
    const deleteMatchingRecords = (collectionName, relationField, idsSet) => {
      if (!idsSet || idsSet.size === 0) return
      try {
        const records = app.findRecordsByFilter(collectionName, '', '-created', 2000, 0)
        for (const rec of records) {
          const relVal = rec.getString(relationField)
          if (idsSet.has(relVal)) {
            try {
              app.delete(rec)
            } catch (_) {}
          }
        }
      } catch (e) {
        console.log('Erro em deleteMatchingRecords para ' + collectionName + ':', e)
      }
    }

    // =========================================================================
    // EXCLUSÃO EM CASCATA — COLEÇÕES MAIS PROFUNDAS PRIMEIRO
    // =========================================================================

    // 1. Exigências (filhas de processos)
    deleteMatchingRecords('exigencias', 'processo', targetProcessIds)

    // 2. Tarefas (ligadas a projetos ou oportunidades)
    deleteMatchingRecords('tarefas', 'projeto', targetProjectIds)
    deleteMatchingRecords('tarefas', 'oportunidade', targetOppIds)

    // 3. Ordens de Serviço (ligadas a projetos fictícios OU ao prestador de teste)
    let joaoUserId = null
    try {
      const joao = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'joao.bigattao@prestador.aerocad.com.br',
      )
      joaoUserId = joao.id
    } catch (_) {}

    try {
      const ordens = app.findRecordsByFilter('ordens_servico', '', '-created', 1000, 0)
      for (const os of ordens) {
        const projId = os.getString('projeto')
        const prestadorUser = os.getString('prestador_usuario')
        if (targetProjectIds.has(projId) || (joaoUserId && prestadorUser === joaoUserId)) {
          try {
            app.delete(os)
          } catch (_) {}
        }
      }
    } catch (e) {
      console.log('Erro ao remover ordens de servico:', e)
    }

    // 4. Parcelas (ligadas a projetos fictícios ou clientes fictícios)
    deleteMatchingRecords('parcelas', 'projeto', targetProjectIds)
    deleteMatchingRecords('parcelas', 'cliente', targetClientIds)

    // 5. Documentos gerados vinculados aos fictícios
    deleteMatchingRecords('documentos', 'projeto', targetProjectIds)
    deleteMatchingRecords('documentos', 'cliente', targetClientIds)
    deleteMatchingRecords('documentos', 'processo', targetProcessIds)

    // 6. Anexos vinculados aos fictícios
    deleteMatchingRecords('anexos', 'projeto', targetProjectIds)
    deleteMatchingRecords('anexos', 'cliente', targetClientIds)
    deleteMatchingRecords('anexos', 'processo', targetProcessIds)
    deleteMatchingRecords('anexos', 'oportunidade', targetOppIds)

    // 7. Links externos vinculados aos fictícios
    deleteMatchingRecords('links_externos', 'projeto', targetProjectIds)
    deleteMatchingRecords('links_externos', 'cliente', targetClientIds)
    deleteMatchingRecords('links_externos', 'processo', targetProcessIds)

    // 8. Atividades vinculadas aos fictícios
    deleteMatchingRecords('atividades', 'projeto', targetProjectIds)
    deleteMatchingRecords('atividades', 'cliente', targetClientIds)
    deleteMatchingRecords('atividades', 'processo', targetProcessIds)
    deleteMatchingRecords('atividades', 'oportunidade', targetOppIds)

    // 9. Contratos vinculados aos clientes fictícios
    deleteMatchingRecords('contratos', 'cliente', targetClientIds)

    // 10. Propostas comerciais/técnicas vinculadas às oportunidades fictícias
    deleteMatchingRecords('propostas', 'oportunidade', targetOppIds)

    // 11. Processos vinculados aos projetos fictícios
    deleteRecordsById('processos', targetProcessIds)

    // 12. Projetos fictícios
    deleteRecordsById('projetos', targetProjectIds)

    // 13. Oportunidades fictícias
    deleteRecordsById('oportunidades', targetOppIds)

    // 14. Empreendimentos fictícios vinculados aos clientes fictícios
    deleteMatchingRecords('empreendimentos', 'cliente', targetClientIds)

    // 15. Contatos vinculados aos clientes fictícios
    deleteMatchingRecords('contatos', 'cliente', targetClientIds)

    // 16. Clientes fictícios
    deleteRecordsById('clientes', targetClientIds)

    // 17. Remover o usuário de teste de prestador (joao.bigattao@prestador.aerocad.com.br)
    // Mantendo estritamente cleytonsaraiva@aerocad.com.br e os usuários da equipe interna
    if (joaoUserId) {
      try {
        const u = app.findFirstRecordByData('_pb_users_auth_', 'id', joaoUserId)
        app.delete(u)
        console.log('Usuario de teste joao.bigattao removido com sucesso.')
      } catch (e) {
        console.log('Erro ao remover usuario joao.bigattao:', e)
      }
    }

    // 18. Alertas dispensados antigos vinculados a IDs removidos (limpeza preventiva)
    try {
      const alertas = app.findRecordsByFilter('alertas_dispensados', '', '-created', 1000, 0)
      for (const al of alertas) {
        const chave = al.getString('chave_unica')
        let shouldRemove = false
        for (const cid of targetClientIds) {
          if (chave.indexOf(cid) !== -1) shouldRemove = true
        }
        for (const pid of targetProjectIds) {
          if (chave.indexOf(pid) !== -1) shouldRemove = true
        }
        if (shouldRemove) {
          try {
            app.delete(al)
          } catch (_) {}
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Reversão intencionalmente vazia (não recriamos dados de teste após expurgo)
  },
)
