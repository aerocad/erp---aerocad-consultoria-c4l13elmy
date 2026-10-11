migrate(
  (app) => {
    const projetos = app.findCollectionByNameOrId('projetos')

    // 1. Adicionar campo 'arquivado' (bool) se não existir
    if (!projetos.fields.getByName('arquivado')) {
      projetos.fields.add(
        new BoolField({
          name: 'arquivado',
          required: false,
        }),
      )
    }

    // 2. Adicionar campo 'data_arquivamento' (date) se não existir
    if (!projetos.fields.getByName('data_arquivamento')) {
      projetos.fields.add(
        new DateField({
          name: 'data_arquivamento',
          required: false,
        }),
      )
    }

    // 3. Regra de atualização:
    // Apenas admin e tecnico podem alterar nome e arquivamento (arquivado / data_arquivamento).
    // O campo numero AAAA-NNN continua estritamente intocável (@request.body.numero:changed = false).
    // Comercial e financeiro podem atualizar dados operacionais contanto que nome, arquivado e data_arquivamento não mudem.
    const safeUpdateRule =
      "(@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || ((@request.auth.role = 'comercial' || @request.auth.role = 'financeiro') && @request.body.nome:changed = false && @request.body.arquivado:changed = false && @request.body.data_arquivamento:changed = false)) && @request.body.numero:changed = false"

    projetos.updateRule = safeUpdateRule

    // 4. Índice para agilizar consultas por projetos arquivados
    projetos.addIndex('idx_projetos_arquivado', false, 'arquivado', '')

    app.save(projetos)
  },
  (app) => {
    try {
      const projetos = app.findCollectionByNameOrId('projetos')
      projetos.removeIndex('idx_projetos_arquivado')
      projetos.fields.removeByName('arquivado')
      projetos.fields.removeByName('data_arquivamento')
      projetos.updateRule =
        "(@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || ((@request.auth.role = 'comercial' || @request.auth.role = 'financeiro') && @request.body.nome:changed = false)) && @request.body.numero:changed = false"
      app.save(projetos)
    } catch (_) {}
  },
)
