migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const authenticated = "@request.auth.id != ''"
    const admin = "@request.auth.role = 'admin'"
    const commercial = "@request.auth.role = 'admin' || @request.auth.role = 'comercial'"
    const technical =
      "@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial'"
    const financialRead =
      "@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial'"
    const financialWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const clientes = new Collection({
      name: 'clientes',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: commercial,
      deleteRule: commercial,
      fields: [
        { name: 'tipo', type: 'select', required: true, maxSelect: 1, values: ['pj', 'pf'] },
        { name: 'razao_social', type: 'text', required: true, max: 220 },
        { name: 'cnpj_cpf', type: 'text', max: 24 },
        { name: 'segmento', type: 'text', max: 160 },
        { name: 'municipio', type: 'text', max: 120 },
        { name: 'uf', type: 'text', max: 2 },
        { name: 'telefone', type: 'text', max: 32 },
        { name: 'email', type: 'email' },
        { name: 'endereco', type: 'text', max: 500 },
        { name: 'origem', type: 'text', max: 120 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['prospect', 'cliente', 'inativo'],
        },
        { name: 'recorrente', type: 'bool' },
        { name: 'observacoes', type: 'editor', maxSize: 200000 },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clientes_documento ON clientes (cnpj_cpf) WHERE cnpj_cpf != ''",
        'CREATE INDEX idx_clientes_razao ON clientes (razao_social)',
        'CREATE INDEX idx_clientes_status ON clientes (status)',
      ],
    })
    app.save(clientes)

    const contatos = new Collection({
      name: 'contatos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: commercial,
      deleteRule: commercial,
      fields: [
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'nome', type: 'text', required: true, max: 180 },
        { name: 'cargo', type: 'text', max: 120 },
        { name: 'email', type: 'email' },
        { name: 'telefone_whatsapp', type: 'text', max: 32 },
        {
          name: 'papel',
          type: 'select',
          maxSelect: 1,
          values: ['decisor', 'tecnico', 'financeiro', 'juridico'],
        },
        ...timestamps,
      ],
      indexes: ['CREATE INDEX idx_contatos_cliente ON contatos (cliente)'],
    })
    app.save(contatos)

    const empreendimentos = new Collection({
      name: 'empreendimentos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: technical,
      deleteRule: admin,
      fields: [
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'nome', type: 'text', required: true, max: 220 },
        { name: 'endereco', type: 'text', max: 500 },
        { name: 'coordenadas', type: 'text', max: 120 },
        { name: 'kmz_link', type: 'url' },
        { name: 'altura_pretendida', type: 'number', min: 0 },
        { name: 'aerodromo_referencia', type: 'text', max: 4 },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['edificio', 'galpao', 'torre', 'usina_fv', 'aerodromo', 'heliponto'],
        },
        ...timestamps,
      ],
      indexes: ['CREATE INDEX idx_empreendimentos_cliente ON empreendimentos (cliente)'],
    })
    app.save(empreendimentos)

    const servicos = new Collection({
      name: 'servicos_catalogo',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: admin,
      updateRule: admin,
      deleteRule: admin,
      fields: [
        { name: 'codigo', type: 'text', required: true, max: 32 },
        { name: 'nome', type: 'text', required: true, max: 220 },
        { name: 'descricao', type: 'editor', maxSize: 200000 },
        { name: 'prazo_tipico', type: 'text', max: 120 },
        { name: 'faixa_min', type: 'number', min: 0 },
        { name: 'faixa_max', type: 'number', min: 0 },
        { name: 'preco_padrao', type: 'number', min: 0 },
        { name: 'base_normativa', type: 'text', max: 500 },
        { name: 'vigencia_inicio', type: 'date' },
        { name: 'desconto_pacote_percentual', type: 'number', min: 0, max: 100 },
        { name: 'ativo', type: 'bool' },
        ...timestamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_servicos_codigo ON servicos_catalogo (codigo)'],
    })
    app.save(servicos)

    const oportunidades = new Collection({
      name: 'oportunidades',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: commercial,
      deleteRule: commercial,
      fields: [
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true, max: 220 },
        { name: 'tipo_servico', type: 'relation', collectionId: servicos.id, maxSelect: 1 },
        {
          name: 'etapa',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['lead', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'],
        },
        { name: 'valor_estimado', type: 'number', min: 0 },
        { name: 'probabilidade', type: 'number', min: 0, max: 100 },
        { name: 'data_prevista_fechamento', type: 'date' },
        { name: 'data_fechamento', type: 'date' },
        {
          name: 'motivo_perda',
          type: 'select',
          maxSelect: 1,
          values: ['preco', 'prazo', 'concorrente', 'desistencia_obra', 'sem_retorno', 'outro'],
        },
        { name: 'responsavel', type: 'relation', collectionId: usersId, maxSelect: 1 },
        {
          name: 'trilha_prevista',
          type: 'select',
          maxSelect: 1,
          values: ['opea', 'registro', 'demais'],
        },
        { name: 'observacoes', type: 'editor', maxSize: 200000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_oportunidades_etapa ON oportunidades (etapa)',
        'CREATE INDEX idx_oportunidades_cliente ON oportunidades (cliente)',
        'CREATE INDEX idx_oportunidades_responsavel ON oportunidades (responsavel)',
      ],
    })
    app.save(oportunidades)

    const modelos = new Collection({
      name: 'modelos_documentos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: admin,
      updateRule: admin,
      deleteRule: admin,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 220 },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'contrato',
            'proposta',
            'ordem_servico',
            'oficio',
            'procuracao',
            'requerimento',
            'recibo',
            'outro',
          ],
        },
        { name: 'corpo', type: 'editor', required: true, maxSize: 1000000 },
        ...timestamps,
      ],
      indexes: ['CREATE INDEX idx_modelos_categoria ON modelos_documentos (categoria)'],
    })
    app.save(modelos)

    const propostas = new Collection({
      name: 'propostas',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: commercial,
      deleteRule: admin,
      fields: [
        {
          name: 'oportunidade',
          type: 'relation',
          required: true,
          collectionId: oportunidades.id,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['comercial', 'tecnica'],
        },
        { name: 'numero', type: 'text', max: 40 },
        { name: 'revisao', type: 'text', max: 12 },
        { name: 'itens', type: 'json', maxSize: 500000 },
        { name: 'valor_total', type: 'number', min: 0 },
        { name: 'condicoes_pagamento', type: 'text', max: 1000 },
        { name: 'configuracao_gatilhos', type: 'json', maxSize: 100000 },
        { name: 'validade_dias', type: 'number', min: 1, max: 365, onlyInt: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rascunho', 'enviada', 'aceita', 'recusada', 'expirada'],
        },
        { name: 'data_envio', type: 'date' },
        { name: 'link_drive', type: 'url' },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_propostas_numero ON propostas (numero) WHERE numero != ''",
        'CREATE INDEX idx_propostas_oportunidade ON propostas (oportunidade)',
        'CREATE INDEX idx_propostas_status ON propostas (status)',
      ],
    })
    app.save(propostas)

    const contratos = new Collection({
      name: 'contratos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: commercial,
      updateRule: commercial,
      deleteRule: admin,
      fields: [
        {
          name: 'proposta',
          type: 'relation',
          required: true,
          collectionId: propostas.id,
          maxSelect: 1,
        },
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
        },
        { name: 'numero', type: 'text', required: true, max: 80 },
        { name: 'data_assinatura', type: 'date' },
        { name: 'valor_global', type: 'number', min: 0 },
        { name: 'parcelamento', type: 'json', maxSize: 200000 },
        { name: 'po_cliente', type: 'text', max: 120 },
        { name: 'link_documento_assinado', type: 'url' },
        ...timestamps,
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_contratos_numero ON contratos (numero)',
        'CREATE INDEX idx_contratos_cliente ON contratos (cliente)',
      ],
    })
    app.save(contratos)

    const sequencias = new Collection({
      name: 'sequencias',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'chave', type: 'text', required: true, max: 80 },
        { name: 'atual', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'ano', type: 'number', required: true, min: 2020, onlyInt: true },
        ...timestamps,
      ],
      indexes: ['CREATE UNIQUE INDEX idx_sequencias_chave_ano ON sequencias (chave, ano)'],
    })
    app.save(sequencias)

    const projetos = new Collection({
      name: 'projetos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: technical,
      updateRule: technical,
      deleteRule: admin,
      fields: [
        { name: 'numero', type: 'text', max: 40 },
        { name: 'nome', type: 'text', required: true, max: 220 },
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
        },
        {
          name: 'empreendimento',
          type: 'relation',
          collectionId: empreendimentos.id,
          maxSelect: 1,
        },
        { name: 'oportunidade', type: 'relation', collectionId: oportunidades.id, maxSelect: 1 },
        { name: 'contrato', type: 'relation', collectionId: contratos.id, maxSelect: 1 },
        {
          name: 'trilha',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['opea', 'registro', 'demais'],
        },
        { name: 'fase', type: 'text', required: true, max: 180 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativo', 'suspenso', 'concluido', 'cancelado'],
        },
        { name: 'responsavel_tecnico', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'art', type: 'text', max: 120 },
        { name: 'pasta_drive_url', type: 'url' },
        { name: 'data_inicio', type: 'date' },
        { name: 'prazo', type: 'date' },
        { name: 'percentual_concluido', type: 'number', min: 0, max: 100 },
        { name: 'observacoes', type: 'editor', maxSize: 200000 },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_projetos_numero ON projetos (numero) WHERE numero != ''",
        'CREATE INDEX idx_projetos_trilha ON projetos (trilha)',
        'CREATE INDEX idx_projetos_status ON projetos (status)',
        'CREATE INDEX idx_projetos_cliente ON projetos (cliente)',
      ],
    })
    app.save(projetos)

    const processos = new Collection({
      name: 'processos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: technical,
      updateRule: technical,
      deleteRule: admin,
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          required: true,
          collectionId: projetos.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'orgao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['DECEA-CINDACTA', 'COMAER', 'ANAC'],
        },
        { name: 'numero_protocolo', type: 'text', max: 120 },
        { name: 'data_protocolo', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'nao_protocolado',
            'protocolado',
            'em_exigencia',
            'deferido',
            'indeferido',
            'arquivado',
          ],
        },
        { name: 'prazo_orgao', type: 'date' },
        {
          name: 'parecer',
          type: 'select',
          maxSelect: 1,
          values: ['favoravel', 'favoravel_com_restricoes', 'desfavoravel', 'pendente'],
        },
        { name: 'data_parecer', type: 'date' },
        { name: 'link_sysaga', type: 'url' },
        { name: 'link_ambiente', type: 'url' },
        { name: 'link_drive', type: 'url' },
        { name: 'link_emails', type: 'url' },
        { name: 'observacoes', type: 'editor', maxSize: 200000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_processos_projeto ON processos (projeto)',
        'CREATE INDEX idx_processos_status ON processos (status)',
        'CREATE INDEX idx_processos_prazo ON processos (prazo_orgao)',
      ],
    })
    app.save(processos)

    const exigencias = new Collection({
      name: 'exigencias',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'tecnico'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'tecnico'",
      deleteRule: admin,
      fields: [
        {
          name: 'processo',
          type: 'relation',
          required: true,
          collectionId: processos.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'descricao', type: 'text', required: true, max: 1000 },
        { name: 'prazo', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'atendida', 'dispensada'],
        },
        { name: 'responsavel', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'data_resposta', type: 'date' },
        { name: 'resposta', type: 'editor', maxSize: 300000 },
        { name: 'historico_respostas', type: 'json', maxSize: 500000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_exigencias_processo ON exigencias (processo)',
        'CREATE INDEX idx_exigencias_status ON exigencias (status)',
        'CREATE INDEX idx_exigencias_prazo ON exigencias (prazo)',
      ],
    })
    app.save(exigencias)

    const tarefas = new Collection({
      name: 'tarefas',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: authenticated,
      updateRule: authenticated,
      deleteRule: authenticated,
      fields: [
        { name: 'titulo', type: 'text', required: true, max: 220 },
        {
          name: 'responsavel',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date' },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['ligacao', 'reuniao', 'envio', 'elaboracao', 'protocolo'],
        },
        { name: 'oportunidade', type: 'relation', collectionId: oportunidades.id, maxSelect: 1 },
        { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1 },
        { name: 'concluida', type: 'bool' },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_tarefas_responsavel ON tarefas (responsavel)',
        'CREATE INDEX idx_tarefas_prazo ON tarefas (prazo)',
      ],
    })
    app.save(tarefas)

    const parcelas = new Collection({
      name: 'parcelas',
      type: 'base',
      listRule: financialRead,
      viewRule: financialRead,
      createRule: financialWrite,
      updateRule: financialWrite,
      deleteRule: financialWrite,
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          required: true,
          collectionId: projetos.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'cliente',
          type: 'relation',
          required: true,
          collectionId: clientes.id,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true, max: 220 },
        { name: 'valor', type: 'number', required: true, min: 0 },
        {
          name: 'gatilho',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['assinatura', 'protocolo', 'entrega', 'medicao', 'manual'],
        },
        { name: 'nf_numero', type: 'text', max: 80 },
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'paga', 'vencida'],
        },
        { name: 'data_pagamento', type: 'date' },
        { name: 'valor_recebido', type: 'number', min: 0 },
        { name: 'retencoes', type: 'text', max: 1000 },
        { name: 'observacoes', type: 'editor', maxSize: 200000 },
        {
          name: 'origem',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['manual', 'gatilho'],
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_parcelas_projeto ON parcelas (projeto)',
        'CREATE INDEX idx_parcelas_cliente ON parcelas (cliente)',
        'CREATE INDEX idx_parcelas_status ON parcelas (status)',
        'CREATE INDEX idx_parcelas_vencimento ON parcelas (vencimento)',
      ],
    })
    app.save(parcelas)

    const ordens = new Collection({
      name: 'ordens_servico',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: admin,
      updateRule: admin,
      deleteRule: admin,
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          required: true,
          collectionId: projetos.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'prestador', type: 'text', required: true, max: 220 },
        { name: 'descricao', type: 'text', required: true, max: 1000 },
        { name: 'valor_interno', type: 'number', min: 0 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rascunho', 'emitida', 'concluida', 'cancelada'],
        },
        ...timestamps,
      ],
      indexes: ['CREATE INDEX idx_ordens_projeto ON ordens_servico (projeto)'],
    })
    app.save(ordens)

    const documentos = new Collection({
      name: 'documentos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: authenticated,
      updateRule: authenticated,
      deleteRule: admin,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 220 },
        { name: 'tipo', type: 'text', required: true, max: 100 },
        { name: 'modelo', type: 'relation', collectionId: modelos.id, maxSelect: 1 },
        { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1 },
        { name: 'processo', type: 'relation', collectionId: processos.id, maxSelect: 1 },
        { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1 },
        { name: 'versao', type: 'text', max: 30 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rascunho', 'gerado', 'enviado_assinatura', 'assinado'],
        },
        { name: 'link_assinatura', type: 'url' },
        { name: 'link_arquivo', type: 'url' },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf'],
        },
        { name: 'gerado_de_template', type: 'bool' },
        { name: 'conteudo', type: 'editor', maxSize: 2000000 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_documentos_projeto ON documentos (projeto)',
        'CREATE INDEX idx_documentos_cliente ON documentos (cliente)',
        'CREATE INDEX idx_documentos_status ON documentos (status)',
      ],
    })
    app.save(documentos)

    const links = new Collection({
      name: 'links_externos',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: authenticated,
      updateRule: authenticated,
      deleteRule: authenticated,
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['drive', 'email', 'assinatura', 'orgao', 'outro'],
        },
        { name: 'url', type: 'url', required: true },
        { name: 'titulo', type: 'text', required: true, max: 220 },
        { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1 },
        { name: 'processo', type: 'relation', collectionId: processos.id, maxSelect: 1 },
        { name: 'documento', type: 'relation', collectionId: documentos.id, maxSelect: 1 },
        { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1 },
        {
          name: 'criado_por',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
        },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_links_projeto ON links_externos (projeto)',
        'CREATE INDEX idx_links_processo ON links_externos (processo)',
        'CREATE INDEX idx_links_documento ON links_externos (documento)',
        'CREATE INDEX idx_links_cliente ON links_externos (cliente)',
      ],
    })
    app.save(links)

    const atividades = new Collection({
      name: 'atividades',
      type: 'base',
      listRule: authenticated,
      viewRule: authenticated,
      createRule: authenticated,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'usuario', type: 'relation', required: true, collectionId: usersId, maxSelect: 1 },
        { name: 'texto', type: 'text', required: true, max: 1000 },
        { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1 },
        { name: 'oportunidade', type: 'relation', collectionId: oportunidades.id, maxSelect: 1 },
        { name: 'projeto', type: 'relation', collectionId: projetos.id, maxSelect: 1 },
        { name: 'processo', type: 'relation', collectionId: processos.id, maxSelect: 1 },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_atividades_cliente ON atividades (cliente)',
        'CREATE INDEX idx_atividades_oportunidade ON atividades (oportunidade)',
        'CREATE INDEX idx_atividades_projeto ON atividades (projeto)',
        'CREATE INDEX idx_atividades_processo ON atividades (processo)',
        'CREATE INDEX idx_atividades_created ON atividades (created DESC)',
      ],
    })
    app.save(atividades)
  },
  (app) => {
    const names = [
      'atividades',
      'links_externos',
      'documentos',
      'ordens_servico',
      'parcelas',
      'tarefas',
      'exigencias',
      'processos',
      'projetos',
      'sequencias',
      'contratos',
      'propostas',
      'modelos_documentos',
      'oportunidades',
      'servicos_catalogo',
      'empreendimentos',
      'contatos',
      'clientes',
    ]
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
