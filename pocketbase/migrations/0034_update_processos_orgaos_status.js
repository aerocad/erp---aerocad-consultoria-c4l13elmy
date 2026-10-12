migrate(
  (app) => {
    const processosCol = app.findCollectionByNameOrId('processos')

    // 1. Expandir 'orgao' em processos para incluir:
    // 'DECEA-CINDACTA', 'COMAER', 'ANAC', 'DECEA', 'CINDACTA', 'SAC', 'Prefeitura / Órgão Municipal', 'Outro'
    const orgaoField = processosCol.fields.getByName('orgao')
    if (orgaoField) {
      orgaoField.values = [
        'DECEA-CINDACTA',
        'COMAER',
        'ANAC',
        'DECEA',
        'CINDACTA',
        'SAC',
        'Prefeitura / Órgão Municipal',
        'Outro',
      ]
    }

    // 2. Expandir 'status' em processos para incluir 'em_analise':
    // 'nao_protocolado', 'protocolado', 'em_analise', 'em_exigencia', 'deferido', 'indeferido', 'arquivado'
    const statusField = processosCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'nao_protocolado',
        'protocolado',
        'em_analise',
        'em_exigencia',
        'deferido',
        'indeferido',
        'arquivado',
      ]
    }

    app.save(processosCol)
  },
  (app) => {
    try {
      const processosCol = app.findCollectionByNameOrId('processos')
      const orgaoField = processosCol.fields.getByName('orgao')
      if (orgaoField) {
        orgaoField.values = ['DECEA-CINDACTA', 'COMAER', 'ANAC']
      }
      const statusField = processosCol.fields.getByName('status')
      if (statusField) {
        statusField.values = [
          'nao_protocolado',
          'protocolado',
          'em_exigencia',
          'deferido',
          'indeferido',
          'arquivado',
        ]
      }
      app.save(processosCol)
    } catch (_) {}
  },
)
