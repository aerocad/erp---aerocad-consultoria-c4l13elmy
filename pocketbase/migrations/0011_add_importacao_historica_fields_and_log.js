migrate(
  (app) => {
    const admin = "@request.auth.role = 'admin'"
    const authenticated = "@request.auth.id != ''"
    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. Criar coleção importacoes_log
    const importacoesLog = new Collection({
      name: 'importacoes_log',
      type: 'base',
      listRule: admin,
      viewRule: admin,
      createRule: admin,
      updateRule: admin,
      deleteRule: admin,
      fields: [
        { name: 'arquivo_nome', type: 'text', required: true, max: 255 },
        { name: 'tamanho_bytes', type: 'number', min: 0 },
        {
          name: 'usuario',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'total_clientes', type: 'number', min: 0 },
        { name: 'total_projetos', type: 'number', min: 0 },
        { name: 'total_financeiro', type: 'number', min: 0 },
        { name: 'total_comunicacoes', type: 'number', min: 0 },
        { name: 'resumo', type: 'json', maxSize: 500000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_importacoes_log_created ON importacoes_log (created DESC)',
        'CREATE INDEX idx_importacoes_log_usuario ON importacoes_log (usuario)',
      ],
    })
    app.save(importacoesLog)

    // 2. Adicionar campos complementares à coleção clientes
    const clientes = app.findCollectionByNameOrId('clientes')
    if (!clientes.fields.getByName('municipio_uf')) {
      clientes.fields.add(new TextField({ name: 'municipio_uf', max: 150 }))
    }
    if (!clientes.fields.getByName('primeira_contratacao')) {
      clientes.fields.add(new TextField({ name: 'primeira_contratacao', max: 50 }))
    }
    if (!clientes.fields.getByName('origem_importacao')) {
      clientes.fields.add(new BoolField({ name: 'origem_importacao' }))
    }
    app.save(clientes)

    // 3. Adicionar campos complementares à coleção projetos
    const projetos = app.findCollectionByNameOrId('projetos')
    if (!projetos.fields.getByName('id_planilha')) {
      projetos.fields.add(new TextField({ name: 'id_planilha', max: 64 }))
    }
    if (!projetos.fields.getByName('numero_pc_pt')) {
      projetos.fields.add(new TextField({ name: 'numero_pc_pt', max: 120 }))
    }
    if (!projetos.fields.getByName('tipo_servico')) {
      projetos.fields.add(new TextField({ name: 'tipo_servico', max: 255 }))
    }
    if (!projetos.fields.getByName('escopo_resumido')) {
      projetos.fields.add(new TextField({ name: 'escopo_resumido', max: 1000 }))
    }
    if (!projetos.fields.getByName('municipio_uf')) {
      projetos.fields.add(new TextField({ name: 'municipio_uf', max: 150 }))
    }
    if (!projetos.fields.getByName('aerodromo')) {
      projetos.fields.add(new TextField({ name: 'aerodromo', max: 40 }))
    }
    if (!projetos.fields.getByName('data_proposta')) {
      projetos.fields.add(new DateField({ name: 'data_proposta' }))
    }
    if (!projetos.fields.getByName('data_aceite')) {
      projetos.fields.add(new DateField({ name: 'data_aceite' }))
    }
    if (!projetos.fields.getByName('prazo_dias')) {
      projetos.fields.add(new NumberField({ name: 'prazo_dias', min: 0 }))
    }
    if (!projetos.fields.getByName('valor_global')) {
      projetos.fields.add(new NumberField({ name: 'valor_global', min: 0 }))
    }
    if (!projetos.fields.getByName('marco_fase_atual')) {
      projetos.fields.add(new TextField({ name: 'marco_fase_atual', max: 255 }))
    }
    if (!projetos.fields.getByName('proxima_entrega')) {
      projetos.fields.add(new TextField({ name: 'proxima_entrega', max: 255 }))
    }
    if (!projetos.fields.getByName('pendente_orgao')) {
      projetos.fields.add(new TextField({ name: 'pendente_orgao', max: 120 }))
    }
    if (!projetos.fields.getByName('status_planilha')) {
      projetos.fields.add(new TextField({ name: 'status_planilha', max: 64 }))
    }
    if (!projetos.fields.getByName('origem_importacao')) {
      projetos.fields.add(new BoolField({ name: 'origem_importacao' }))
    }
    app.save(projetos)

    // 4. Adicionar campos complementares à coleção parcelas (financeiro)
    const parcelas = app.findCollectionByNameOrId('parcelas')
    if (!parcelas.fields.getByName('id_lancamento')) {
      parcelas.fields.add(new TextField({ name: 'id_lancamento', max: 64 }))
    }
    if (!parcelas.fields.getByName('numero_parcela_marco')) {
      parcelas.fields.add(new TextField({ name: 'numero_parcela_marco', max: 120 }))
    }
    if (!parcelas.fields.getByName('percentual_contrato')) {
      parcelas.fields.add(new NumberField({ name: 'percentual_contrato', min: 0, max: 100 }))
    }
    if (!parcelas.fields.getByName('evento_comprobatorio')) {
      parcelas.fields.add(new TextField({ name: 'evento_comprobatorio', max: 500 }))
    }
    if (!parcelas.fields.getByName('data_prevista')) {
      parcelas.fields.add(new DateField({ name: 'data_prevista' }))
    }
    if (!parcelas.fields.getByName('data_faturamento')) {
      parcelas.fields.add(new DateField({ name: 'data_faturamento' }))
    }
    if (!parcelas.fields.getByName('status_pagamento')) {
      parcelas.fields.add(new TextField({ name: 'status_pagamento', max: 64 }))
    }
    if (!parcelas.fields.getByName('origem_importacao')) {
      parcelas.fields.add(new BoolField({ name: 'origem_importacao' }))
    }
    app.save(parcelas)

    // 5. Adicionar campos complementares à coleção atividades (comunicações)
    const atividades = app.findCollectionByNameOrId('atividades')
    if (!atividades.fields.getByName('tipo')) {
      atividades.fields.add(new TextField({ name: 'tipo', max: 50 }))
    }
    if (!atividades.fields.getByName('data_hora')) {
      atividades.fields.add(new DateField({ name: 'data_hora' }))
    }
    if (!atividades.fields.getByName('id_planilha')) {
      atividades.fields.add(new TextField({ name: 'id_planilha', max: 64 }))
    }
    if (!atividades.fields.getByName('origem_importacao')) {
      atividades.fields.add(new BoolField({ name: 'origem_importacao' }))
    }
    app.save(atividades)
  },
  (app) => {
    try {
      const log = app.findCollectionByNameOrId('importacoes_log')
      app.delete(log)
    } catch (_) {}
  },
)
