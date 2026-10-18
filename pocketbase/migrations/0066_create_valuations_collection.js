migrate(
  (app) => {
    if (!app.hasTable('valuations')) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

      const valuationsCol = new Collection({
        name: 'valuations',
        type: 'base',
        // Acesso restrito a usuários admin e financeiro
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'titulo', type: 'text', required: true, max: 255 },
          { name: 'data_avaliacao', type: 'date', required: true },
          { name: 'periodo_referencia', type: 'text', max: 64 },
          {
            name: 'metodo_principal',
            type: 'select',
            values: ['multiplos_ebitda', 'multiplos_receita', 'patrimonial', 'combinado'],
            maxSelect: 1,
          },
          {
            name: 'multiplos_usados',
            type: 'json',
            maxSize: 1048576, // 1MB
          },
          {
            name: 'ajustes_subjetivos',
            type: 'json',
            maxSize: 1048576, // 1MB
          },
          {
            name: 'resultado_consolidado',
            type: 'json',
            maxSize: 2097152, // 2MB
          },
          {
            name: 'indicadores_apoio',
            type: 'json',
            maxSize: 1048576, // 1MB
          },
          {
            name: 'confiabilidade_dados',
            type: 'json',
            maxSize: 1048576, // 1MB
          },
          {
            name: 'usuario_criador',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'usuario_nome', type: 'text', max: 255 },
          { name: 'observacoes', type: 'editor', maxSize: 50000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_valuations_data ON valuations (data_avaliacao DESC)',
          'CREATE INDEX idx_valuations_criador ON valuations (usuario_criador)',
        ],
      })

      app.save(valuationsCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('valuations')
      app.delete(col)
    } catch (_) {}
  },
)
