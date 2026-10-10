migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const authenticated = "@request.auth.id != ''"
    const ownerOnly = "@request.auth.id != '' && usuario = @request.auth.id"

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const alertasDispensados = new Collection({
      name: 'alertas_dispensados',
      type: 'base',
      listRule: ownerOnly,
      viewRule: ownerOnly,
      createRule: ownerOnly,
      updateRule: ownerOnly,
      deleteRule: ownerOnly,
      fields: [
        {
          name: 'usuario',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'chave_unica', type: 'text', required: true, max: 200 },
        {
          name: 'severidade_dispensada',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['critico', 'atencao', 'informativo'],
        },
        { name: 'data_dispensa', type: 'date' },
        { name: 'motivo', type: 'text', max: 500 },
        ...timestamps,
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_alertas_disp_usuario_chave ON alertas_dispensados (usuario, chave_unica)',
        'CREATE INDEX idx_alertas_disp_usuario ON alertas_dispensados (usuario)',
      ],
    })
    app.save(alertasDispensados)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('alertas_dispensados')
      app.delete(col)
    } catch (_) {}
  },
)
