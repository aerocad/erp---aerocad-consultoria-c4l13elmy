migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')
    const credoresCol = app.findCollectionByNameOrId('credores')
    const ativosPatrimonioCol = app.findCollectionByNameOrId('ativos_patrimonio')

    const canWrite =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.roles ~ 'admin' || @request.auth.role = 'financeiro' || @request.auth.roles ~ 'financeiro')"
    const adminOnly =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.roles ~ 'admin')"

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. Criar coleção emprestimos_financiamentos
    if (!app.hasTable('emprestimos_financiamentos')) {
      const col = new Collection({
        name: 'emprestimos_financiamentos',
        type: 'base',
        listRule: canWrite,
        viewRule: canWrite,
        createRule: canWrite,
        updateRule: canWrite,
        deleteRule: adminOnly,
        fields: [
          { name: 'numero_contrato', type: 'text', required: true, max: 100 },
          { name: 'descricao', type: 'text', required: true, max: 250 },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['emprestimo_bancario', 'financiamento_veiculo', 'outras_modalidades'],
            maxSelect: 1,
          },
          {
            name: 'metodo_amortizacao',
            type: 'select',
            required: true,
            values: ['PRICE', 'SAC', 'PREFIXADO_MANUAL'],
            maxSelect: 1,
          },
          { name: 'credor', type: 'relation', collectionId: credoresCol.id, maxSelect: 1 },
          { name: 'banco_nome', type: 'text', max: 150 },
          { name: 'data_contratacao', type: 'date', required: true },
          { name: 'valor_total_divida', type: 'number', min: 0 },
          { name: 'valor_liquido_liberado', type: 'number', min: 0 },
          { name: 'total_juros_prefixados', type: 'number', min: 0 },
          { name: 'taxa_juros_mensal', type: 'number', min: 0 },
          { name: 'taxa_juros_anual', type: 'number', min: 0 },
          { name: 'quantidade_parcelas', type: 'number', min: 1, onlyInt: true },
          { name: 'valor_parcela', type: 'number', min: 0 },
          { name: 'data_primeira_parcela', type: 'date', required: true },
          {
            name: 'conta_bancaria_debito',
            type: 'relation',
            collectionId: contasBancariasCol.id,
            maxSelect: 1,
          },
          // Campos específicos de aquisição de veículo / imobilizado
          { name: 'bem_adquirido_descricao', type: 'text', max: 250 },
          { name: 'valor_total_bem', type: 'number', min: 0 },
          { name: 'valor_entrada', type: 'number', min: 0 },
          {
            name: 'ativo_patrimonio_vinculado',
            type: 'relation',
            collectionId: ativosPatrimonioCol.id,
            maxSelect: 1,
          },
          // Saldos e Acompanhamento
          { name: 'saldo_devedor_atual', type: 'number', min: 0 },
          { name: 'saldo_juros_a_apropriar', type: 'number', min: 0 },
          { name: 'saldo_circulante', type: 'number', min: 0 },
          { name: 'saldo_nao_circulante', type: 'number', min: 0 },
          { name: 'total_amortizado', type: 'number', min: 0 },
          { name: 'total_juros_pagos', type: 'number', min: 0 },
          { name: 'total_juros_apropriados', type: 'number', min: 0 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'quitado', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'observacoes', type: 'text', max: 1000 },
          { name: 'criado_por', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
          ...timestamps,
        ],
        indexes: [
          'CREATE INDEX idx_emp_fin_status ON emprestimos_financiamentos (status)',
          'CREATE INDEX idx_emp_fin_tipo ON emprestimos_financiamentos (tipo)',
          'CREATE INDEX idx_emp_fin_data ON emprestimos_financiamentos (data_contratacao DESC)',
        ],
      })
      app.save(col)
      console.log("Migration 0075: Coleção 'emprestimos_financiamentos' criada com sucesso.")
    }

    const empCol = app.findCollectionByNameOrId('emprestimos_financiamentos')

    // 2. Criar coleção emprestimos_parcelas
    if (!app.hasTable('emprestimos_parcelas')) {
      const colParc = new Collection({
        name: 'emprestimos_parcelas',
        type: 'base',
        listRule: canWrite,
        viewRule: canWrite,
        createRule: canWrite,
        updateRule: canWrite,
        deleteRule: adminOnly,
        fields: [
          {
            name: 'contrato',
            type: 'relation',
            collectionId: empCol.id,
            required: true,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'numero_parcela', type: 'number', required: true, min: 1, onlyInt: true },
          { name: 'competencia', type: 'text', required: true, max: 7 }, // Formato YYYY-MM
          { name: 'data_vencimento', type: 'date', required: true },
          { name: 'valor_parcela', type: 'number', required: false, min: 0 },
          { name: 'valor_principal', type: 'number', required: false, min: 0 },
          { name: 'valor_juros', type: 'number', required: false, min: 0 },
          { name: 'saldo_devedor_restante', type: 'number', min: 0 },
          {
            name: 'classificacao_passivo',
            type: 'select',
            required: true,
            values: ['circulante', 'nao_circulante'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'paga', 'atrasada'],
            maxSelect: 1,
          },
          { name: 'juros_apropriados', type: 'bool' },
          { name: 'data_apropriacao_juros', type: 'date' },
          { name: 'data_pagamento', type: 'date' },
          { name: 'valor_pago', type: 'number', min: 0 },
          {
            name: 'conta_bancaria',
            type: 'relation',
            collectionId: contasBancariasCol.id,
            maxSelect: 1,
          },
          { name: 'conta_pagar_id', type: 'text', max: 50 },
          { name: 'extrato_transacao_id', type: 'text', max: 50 },
          { name: 'observacoes', type: 'text', max: 500 },
          ...timestamps,
        ],
        indexes: [
          'CREATE INDEX idx_emp_parc_contrato ON emprestimos_parcelas (contrato)',
          'CREATE INDEX idx_emp_parc_vencimento ON emprestimos_parcelas (data_vencimento)',
          'CREATE INDEX idx_emp_parc_status ON emprestimos_parcelas (status)',
          'CREATE INDEX idx_emp_parc_comp ON emprestimos_parcelas (competencia)',
          'CREATE INDEX idx_emp_parc_aprop ON emprestimos_parcelas (juros_apropriados)',
        ],
      })
      app.save(colParc)
      console.log("Migration 0075: Coleção 'emprestimos_parcelas' criada com sucesso.")
    }
  },
  (app) => {
    try {
      const colParc = app.findCollectionByNameOrId('emprestimos_parcelas')
      app.delete(colParc)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('emprestimos_financiamentos')
      app.delete(col)
    } catch (_) {}
  },
)
