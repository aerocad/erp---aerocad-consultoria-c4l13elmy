migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const authenticated = "@request.auth.id != ''"
    const canCreate =
      "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro'"
    const canUpdate = "@request.auth.role = 'admin' || usuario = @request.auth.id"
    const canDelete = "@request.auth.role = 'admin' || usuario = @request.auth.id"

    const clientesCol = app.findCollectionByNameOrId('clientes')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const processosCol = app.findCollectionByNameOrId('processos')
    const oportunidadesCol = app.findCollectionByNameOrId('oportunidades')
    const propostasCol = app.findCollectionByNameOrId('propostas')

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const anexos = new Collection({
      name: 'anexos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canCreate,
      updateRule: canUpdate,
      deleteRule: canDelete,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 250 },
        { name: 'descricao', type: 'text', max: 1000 },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'orcamento',
            'planilha',
            'edital',
            'projeto_tecnico',
            'documento_cliente',
            'laudo_relatorio',
            'outro',
          ],
        },
        {
          name: 'arquivo',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 26214400, // 25 MB
          // Omit mimeTypes to allow PDF, TXT, DOCX, XLSX, DWG, DXF, images and all project document files
        },
        { name: 'tamanho_bytes', type: 'number', min: 0 },
        { name: 'extensao', type: 'text', max: 20 },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: clientesCol.id,
          maxSelect: 1,
        },
        {
          name: 'projeto',
          type: 'relation',
          collectionId: projetosCol.id,
          maxSelect: 1,
        },
        {
          name: 'processo',
          type: 'relation',
          collectionId: processosCol.id,
          maxSelect: 1,
        },
        {
          name: 'oportunidade',
          type: 'relation',
          collectionId: oportunidadesCol.id,
          maxSelect: 1,
        },
        {
          name: 'proposta',
          type: 'relation',
          collectionId: propostasCol.id,
          maxSelect: 1,
        },
        {
          name: 'usuario',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_anexos_cliente ON anexos (cliente)',
        'CREATE INDEX idx_anexos_projeto ON anexos (projeto)',
        'CREATE INDEX idx_anexos_processo ON anexos (processo)',
        'CREATE INDEX idx_anexos_oportunidade ON anexos (oportunidade)',
        'CREATE INDEX idx_anexos_categoria ON anexos (categoria)',
        'CREATE INDEX idx_anexos_usuario ON anexos (usuario)',
        'CREATE INDEX idx_anexos_created ON anexos (created DESC)',
      ],
    })

    app.save(anexos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('anexos'))
    } catch (_) {}
  },
)
