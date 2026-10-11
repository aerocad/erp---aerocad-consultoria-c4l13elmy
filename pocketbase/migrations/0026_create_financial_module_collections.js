migrate(
  (app) => {
    const authenticated = "@request.auth.id != ''"
    const canWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"

    const clientesCol = app.findCollectionByNameOrId('clientes')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. contas_pagar
    const contasPagar = new Collection({
      name: 'contas_pagar',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: canWrite,
      fields: [
        { name: 'descricao', type: 'text', required: true, max: 250 },
        { name: 'fornecedor', type: 'text', required: true, max: 250 },
        {
          name: 'cliente_fornecedor',
          type: 'relation',
          collectionId: clientesCol.id,
          maxSelect: 1,
        },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'impostos',
            'folha',
            'terceirizados',
            'despesas_operacionais',
            'equipamentos',
            'outros',
          ],
        },
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'data_pagamento', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'pago', 'cancelado'],
        },
        {
          name: 'forma_pagamento',
          type: 'select',
          maxSelect: 1,
          values: [
            'pix',
            'ted_doc',
            'boleto',
            'cartao_credito',
            'cartao_debito',
            'dinheiro',
            'outro',
          ],
        },
        { name: 'numero_documento', type: 'text', max: 100 },
        {
          name: 'projeto',
          type: 'relation',
          collectionId: projetosCol.id,
          maxSelect: 1,
        },
        {
          name: 'comprovante',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400, // 25 MB
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
        'CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar (data_vencimento)',
        'CREATE INDEX idx_contas_pagar_status ON contas_pagar (status)',
        'CREATE INDEX idx_contas_pagar_categoria ON contas_pagar (categoria)',
        'CREATE INDEX idx_contas_pagar_projeto ON contas_pagar (projeto)',
        'CREATE INDEX idx_contas_pagar_created ON contas_pagar (created DESC)',
      ],
    })
    app.save(contasPagar)

    // 2. contas_receber (receitas avulsas não ligadas diretamente a projeto / consultorias extras)
    const contasReceber = new Collection({
      name: 'contas_receber',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: canWrite,
      fields: [
        { name: 'descricao', type: 'text', required: true, max: 250 },
        { name: 'cliente_nome', type: 'text', required: true, max: 250 },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: clientesCol.id,
          maxSelect: 1,
        },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'consultoria_avulsa',
            'servico_tecnico',
            'honorarios',
            'reembolso',
            'rendimento_aplicacao',
            'outros',
          ],
        },
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'valor_recebido', type: 'number', min: 0 },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'data_recebimento', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'recebido', 'cancelado'],
        },
        {
          name: 'forma_recebimento',
          type: 'select',
          maxSelect: 1,
          values: [
            'pix',
            'ted_doc',
            'boleto',
            'cartao_credito',
            'cartao_debito',
            'dinheiro',
            'outro',
          ],
        },
        { name: 'numero_documento', type: 'text', max: 100 },
        {
          name: 'projeto',
          type: 'relation',
          collectionId: projetosCol.id,
          maxSelect: 1,
        },
        {
          name: 'comprovante',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400,
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
        'CREATE INDEX idx_contas_receber_vencimento ON contas_receber (data_vencimento)',
        'CREATE INDEX idx_contas_receber_status ON contas_receber (status)',
        'CREATE INDEX idx_contas_receber_categoria ON contas_receber (categoria)',
        'CREATE INDEX idx_contas_receber_cliente ON contas_receber (cliente)',
        'CREATE INDEX idx_contas_receber_projeto ON contas_receber (projeto)',
        'CREATE INDEX idx_contas_receber_created ON contas_receber (created DESC)',
      ],
    })
    app.save(contasReceber)

    // 3. extratos (arquivos de extrato bancário importados)
    const extratos = new Collection({
      name: 'extratos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: canWrite,
      fields: [
        { name: 'nome_arquivo', type: 'text', required: true, max: 250 },
        {
          name: 'formato',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ofx', 'csv', 'xlsx'],
        },
        { name: 'banco', type: 'text', max: 100 },
        { name: 'conta', type: 'text', max: 100 },
        { name: 'data_inicio', type: 'date' },
        { name: 'data_fim', type: 'date' },
        { name: 'total_transacoes', type: 'number', min: 0 },
        { name: 'total_entradas', type: 'number', min: 0 },
        { name: 'total_saidas', type: 'number', min: 0 },
        { name: 'saldo_final', type: 'number' },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400,
        },
        {
          name: 'usuario',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_extratos_created ON extratos (created DESC)',
        'CREATE INDEX idx_extratos_banco ON extratos (banco)',
      ],
    })
    app.save(extratos)

    // 4. extratos_transacoes (linhas/transações do extrato importado para conciliação)
    const extratosTransacoes = new Collection({
      name: 'extratos_transacoes',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: canWrite,
      updateRule: canWrite,
      deleteRule: canWrite,
      fields: [
        {
          name: 'extrato',
          type: 'relation',
          required: true,
          collectionId: extratos.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'descricao', type: 'text', required: true, max: 500 },
        { name: 'valor', type: 'number', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['entrada', 'saida'],
        },
        { name: 'documento_ref', type: 'text', max: 100 },
        { name: 'fitid', type: 'text', max: 150 },
        {
          name: 'status_conciliacao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'conciliado', 'ignorado'],
        },
        {
          name: 'vinculo_tipo',
          type: 'select',
          maxSelect: 1,
          values: ['parcela', 'conta_pagar', 'conta_receber'],
        },
        { name: 'vinculo_id', type: 'text', max: 50 },
        { name: 'data_conciliacao', type: 'date' },
        { name: 'observacoes', type: 'text', max: 500 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_extratos_transacoes_extrato ON extratos_transacoes (extrato)',
        'CREATE INDEX idx_extratos_transacoes_data ON extratos_transacoes (data DESC)',
        'CREATE INDEX idx_extratos_transacoes_status ON extratos_transacoes (status_conciliacao)',
        'CREATE INDEX idx_extratos_transacoes_tipo ON extratos_transacoes (tipo)',
      ],
    })
    app.save(extratosTransacoes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('extratos_transacoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('extratos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_receber'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_pagar'))
    } catch (_) {}
  },
)
