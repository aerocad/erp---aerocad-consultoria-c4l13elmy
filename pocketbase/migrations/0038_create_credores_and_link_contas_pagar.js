migrate(
  (app) => {
    const authenticated = "@request.auth.id != ''"
    const canWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    const adminOnlyDelete = "@request.auth.role = 'admin'"

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. Criar coleção credores
    const credores = new Collection({
      name: 'credores',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: adminOnlyDelete,
      fields: [
        { name: 'nome_razao_social', type: 'text', required: true, max: 250 },
        { name: 'nome_fantasia', type: 'text', max: 250 },
        { name: 'cnpj_cpf', type: 'text', required: true, max: 30 },
        {
          name: 'tipo_pessoa',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pj', 'pf'],
        },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'fornecedor_servicos',
            'fornecedor_material',
            'locador',
            'condominio',
            'utilidades',
            'impostos_orgaos_publicos',
            'instituicao_financeira',
            'folha_encargos',
            'contador',
            'outros',
          ],
        },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text', max: 50 },
        { name: 'endereco', type: 'text', max: 300 },
        { name: 'cidade_uf', type: 'text', max: 100 },
        { name: 'banco_nome', type: 'text', max: 100 },
        { name: 'banco_agencia', type: 'text', max: 30 },
        { name: 'banco_conta', type: 'text', max: 40 },
        { name: 'chave_pix', type: 'text', max: 150 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativo', 'inativo'],
        },
        { name: 'observacoes', type: 'editor', maxSize: 50000 },
        {
          name: 'anexos',
          type: 'file',
          maxSelect: 10,
          maxSize: 31457280, // 30 MB
        },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_credores_cnpj_cpf ON credores (cnpj_cpf)',
        'CREATE INDEX idx_credores_nome ON credores (nome_razao_social)',
        'CREATE INDEX idx_credores_categoria ON credores (categoria)',
        'CREATE INDEX idx_credores_status ON credores (status)',
      ],
    })
    app.save(credores)

    const credoresCol = app.findCollectionByNameOrId('credores')

    // 2. Adicionar relação credor em contas_pagar
    const cpCol = app.findCollectionByNameOrId('contas_pagar')
    if (!cpCol.fields.getByName('credor')) {
      cpCol.fields.add(
        new RelationField({
          name: 'credor',
          collectionId: credoresCol.id,
          maxSelect: 1,
        }),
      )
      cpCol.addIndex('idx_contas_pagar_credor', false, 'credor', '')
      app.save(cpCol)
    }
  },
  (app) => {
    try {
      const cpCol = app.findCollectionByNameOrId('contas_pagar')
      if (cpCol.fields.getByName('credor')) {
        cpCol.removeIndex('idx_contas_pagar_credor')
        cpCol.fields.removeByName('credor')
        app.save(cpCol)
      }
    } catch (_) {}

    try {
      const credoresCol = app.findCollectionByNameOrId('credores')
      app.delete(credoresCol)
    } catch (_) {}
  },
)
