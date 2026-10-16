migrate(
  (app) => {
    const oportunidades = app.findCollectionByNameOrId('oportunidades')
    const projetos = app.findCollectionByNameOrId('projetos')

    // 1. Adicionar campo 'projeto' (relation -> projetos) se não existir na coleção oportunidades
    if (!oportunidades.fields.getByName('projeto')) {
      oportunidades.fields.add(
        new RelationField({
          name: 'projeto',
          type: 'relation',
          collectionId: projetos.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    oportunidades.addIndex('idx_oportunidades_projeto', false, 'projeto', '')
    app.save(oportunidades)

    // 2. Backfill bidirecional se já existirem projetos com campo oportunidade preenchido
    try {
      const projsComOpp = app.findRecordsByFilter(
        'projetos',
        "oportunidade != ''",
        '-created',
        500,
        0,
      )
      for (const p of projsComOpp) {
        const oppId = p.getString('oportunidade')
        if (oppId) {
          try {
            const opp = app.findRecordById('oportunidades', oppId)
            if (!opp.getString('projeto')) {
              opp.set('projeto', p.id)
              app.save(opp)
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.log('Aviso ao sincronizar oportunidades existentes:', e)
    }
  },
  (app) => {
    try {
      const oportunidades = app.findCollectionByNameOrId('oportunidades')
      oportunidades.removeIndex('idx_oportunidades_projeto')
      oportunidades.fields.removeByName('projeto')
      app.save(oportunidades)
    } catch (_) {}
  },
)
