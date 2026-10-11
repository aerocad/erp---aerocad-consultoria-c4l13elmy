migrate(
  (app) => {
    // 1. Restringir leitura e listagem de 'clientes' para excluir o perfil 'tecnico' e 'terceiro'
    // Apenas admin, comercial e financeiro podem listar ou visualizar clientes
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const canAccessClientes =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
    clientesCol.listRule = canAccessClientes
    clientesCol.viewRule = canAccessClientes
    app.save(clientesCol)

    // 2. Coleção 'parcelas' (onde residem as notas NFS-e emitidas, nf_numero, nfse_chave, nfse_dados):
    // Bloquear criação/edição pelo perfil tecnico (revoga migração 0025 que permitia anexar NFS-e ao técnico)
    // Leitura, criação e edição exclusivas de admin, comercial e financeiro.
    const parcelasCol = app.findCollectionByNameOrId('parcelas')
    const canReadParcelas =
      "@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial'"
    const canWriteParcelas = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"

    parcelasCol.listRule = canReadParcelas
    parcelasCol.viewRule = canReadParcelas
    parcelasCol.createRule = canWriteParcelas
    parcelasCol.updateRule = canWriteParcelas
    parcelasCol.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    app.save(parcelasCol)
  },
  (app) => {
    try {
      const clientesCol = app.findCollectionByNameOrId('clientes')
      clientesCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro')"
      clientesCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro')"
      app.save(clientesCol)

      const parcelasCol = app.findCollectionByNameOrId('parcelas')
      const canReadParcelas =
        "@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial'"
      const canWriteParcelas =
        "@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'tecnico'"
      parcelasCol.listRule = canReadParcelas
      parcelasCol.viewRule = canReadParcelas
      parcelasCol.createRule = canWriteParcelas
      parcelasCol.updateRule = canWriteParcelas
      parcelasCol.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
      app.save(parcelasCol)
    } catch (_) {}
  },
)
