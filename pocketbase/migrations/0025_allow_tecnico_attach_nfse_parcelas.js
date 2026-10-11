migrate(
  (app) => {
    // Permitir que o perfil 'tecnico' também crie e atualize parcelas para poder anexar NFS-e ao projeto
    const parcelasCol = app.findCollectionByNameOrId('parcelas')
    const canWriteParcelas =
      "@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'tecnico'"
    parcelasCol.createRule = canWriteParcelas
    parcelasCol.updateRule = canWriteParcelas
    // deleteRule permanece exclusivo para admin e financeiro
    parcelasCol.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    app.save(parcelasCol)
  },
  (app) => {
    try {
      const parcelasCol = app.findCollectionByNameOrId('parcelas')
      const financialWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
      parcelasCol.createRule = financialWrite
      parcelasCol.updateRule = financialWrite
      parcelasCol.deleteRule = financialWrite
      app.save(parcelasCol)
    } catch (_) {}
  },
)
