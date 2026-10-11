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

    // 1. fornecedores
    const fornecedores = new Collection({
      name: 'fornecedores',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: adminOnlyDelete,
      fields: [
        { name: 'razao_social', type: 'text', required: true, max: 250 },
        { name: 'nome_fantasia', type: 'text', max: 250 },
        { name: 'cnpj_cpf', type: 'text', required: true, max: 20 },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'terceirizados',
            'equipamentos',
            'despesas_operacionais',
            'folha',
            'impostos',
            'software_ti',
            'juridico_contabil',
            'outros',
          ],
        },
        { name: 'contato_nome', type: 'text', max: 150 },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text', max: 50 },
        { name: 'chave_pix', type: 'text', max: 150 },
        { name: 'dados_bancarios', type: 'text', max: 300 },
        { name: 'endereco', type: 'text', max: 300 },
        { name: 'municipio_uf', type: 'text', max: 100 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativo', 'inativo'],
        },
        { name: 'observacoes', type: 'editor', maxSize: 50000 },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_fornecedores_cnpj ON fornecedores (cnpj_cpf)',
        'CREATE INDEX idx_fornecedores_razao ON fornecedores (razao_social)',
        'CREATE INDEX idx_fornecedores_categoria ON fornecedores (categoria)',
        'CREATE INDEX idx_fornecedores_status ON fornecedores (status)',
      ],
    })
    app.save(fornecedores)

    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')

    // 2. colaboradores
    const colaboradores = new Collection({
      name: 'colaboradores',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: adminOnlyDelete,
      fields: [
        { name: 'nome_completo', type: 'text', required: true, max: 200 },
        { name: 'cpf_cnpj', type: 'text', required: true, max: 20 },
        { name: 'cargo', type: 'text', required: true, max: 150 },
        { name: 'funcao', type: 'text', required: true, max: 150 },
        {
          name: 'regime_contratacao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pf_clt', 'pf_autonomo', 'pj'],
        },
        { name: 'empresa_pj', type: 'text', max: 250 },
        {
          name: 'fornecedor_vinculado',
          type: 'relation',
          collectionId: fornecedoresCol.id,
          maxSelect: 1,
        },
        {
          name: 'usuario_sistema',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text', max: 50 },
        { name: 'data_admissao', type: 'date', required: true },
        { name: 'data_desligamento', type: 'date' },
        {
          name: 'situacao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativo', 'inativo'],
        },
        { name: 'remuneracao_base', type: 'number', min: 0 },
        { name: 'chave_pix', type: 'text', max: 150 },
        {
          name: 'foto',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'observacoes', type: 'editor', maxSize: 50000 },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_colaboradores_cpf ON colaboradores (cpf_cnpj)',
        'CREATE INDEX idx_colaboradores_nome ON colaboradores (nome_completo)',
        'CREATE INDEX idx_colaboradores_regime ON colaboradores (regime_contratacao)',
        'CREATE INDEX idx_colaboradores_situacao ON colaboradores (situacao)',
        'CREATE INDEX idx_colaboradores_cargo ON colaboradores (cargo)',
      ],
    })
    app.save(colaboradores)

    // 3. balancetes_mensais
    const balancetes = new Collection({
      name: 'balancetes_mensais',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: adminOnlyDelete,
      fields: [
        { name: 'referencia', type: 'text', required: true, max: 7 }, // Formato YYYY-MM ex: '2026-03'
        { name: 'ano', type: 'number', required: true, onlyInt: true },
        { name: 'mes', type: 'number', required: true, onlyInt: true },
        { name: 'titulo', type: 'text', required: true, max: 200 },
        { name: 'receita_total', type: 'number', required: true },
        { name: 'despesa_total', type: 'number', required: true },
        { name: 'saldo_mes', type: 'number', required: true },
        { name: 'saldo_acumulado_ano', type: 'number', required: true },
        { name: 'total_receitas_ano', type: 'number', required: true },
        { name: 'total_despesas_ano', type: 'number', required: true },
        { name: 'dados_consolidados', type: 'json', maxSize: 2000000 },
        { name: 'responsavel_emissao', type: 'text', max: 150 },
        { name: 'data_emissao', type: 'date', required: true },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'editor', maxSize: 50000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_balancetes_referencia ON balancetes_mensais (referencia)',
        'CREATE INDEX idx_balancetes_ano_mes ON balancetes_mensais (ano, mes DESC)',
      ],
    })
    app.save(balancetes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('balancetes_mensais'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('colaboradores'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('fornecedores'))
    } catch (_) {}
  },
)
