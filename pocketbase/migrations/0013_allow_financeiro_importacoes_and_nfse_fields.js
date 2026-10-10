migrate(
  (app) => {
    // 1. Atualizar regras de importacoes_log para permitir financeiro visualizar e registrar importações
    const importacoesLog = app.findCollectionByNameOrId('importacoes_log')
    const adminOrFin = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    importacoesLog.listRule = adminOrFin
    importacoesLog.viewRule = adminOrFin
    importacoesLog.createRule = adminOrFin
    importacoesLog.updateRule = adminOrFin
    importacoesLog.deleteRule = "@request.auth.role = 'admin'"
    app.save(importacoesLog)

    // 2. Garantir campos complementares na coleção parcelas para NFS-e
    const parcelas = app.findCollectionByNameOrId('parcelas')
    if (!parcelas.fields.getByName('nfse_chave')) {
      parcelas.fields.add(new TextField({ name: 'nfse_chave', max: 120 }))
    }
    if (!parcelas.fields.getByName('nfse_dados')) {
      parcelas.fields.add(new JSONField({ name: 'nfse_dados', maxSize: 50000 }))
    }
    app.save(parcelas)
  },
  (app) => {
    try {
      const importacoesLog = app.findCollectionByNameOrId('importacoes_log')
      const admin = "@request.auth.role = 'admin'"
      importacoesLog.listRule = admin
      importacoesLog.viewRule = admin
      importacoesLog.createRule = admin
      importacoesLog.updateRule = admin
      importacoesLog.deleteRule = admin
      app.save(importacoesLog)

      const parcelas = app.findCollectionByNameOrId('parcelas')
      const chave = parcelas.fields.getByName('nfse_chave')
      if (chave) parcelas.fields.remove(chave)
      const dados = parcelas.fields.getByName('nfse_dados')
      if (dados) parcelas.fields.remove(dados)
      app.save(parcelas)
    } catch (_) {}
  },
)
