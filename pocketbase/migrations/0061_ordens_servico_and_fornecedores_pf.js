migrate(
  (app) => {
    // 1. Atualizar coleção fornecedores para suportar PF e PJ
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')

    if (!fornecedoresCol.fields.getByName('tipo_pessoa')) {
      fornecedoresCol.fields.add(
        new SelectField({
          name: 'tipo_pessoa',
          required: false,
          maxSelect: 1,
          values: ['pj', 'pf'],
        }),
      )
    }

    if (!fornecedoresCol.fields.getByName('nome_completo')) {
      fornecedoresCol.fields.add(
        new TextField({
          name: 'nome_completo',
          max: 200,
        }),
      )
    }

    if (!fornecedoresCol.fields.getByName('cpf')) {
      fornecedoresCol.fields.add(
        new TextField({
          name: 'cpf',
          max: 20,
        }),
      )
    }

    app.save(fornecedoresCol)

    // Backfill registros existentes de fornecedores para tipo_pessoa = 'pj' caso nulo
    app
      .db()
      .newQuery(
        "UPDATE fornecedores SET tipo_pessoa = 'pj' WHERE tipo_pessoa IS NULL OR tipo_pessoa = ''",
      )
      .execute()

    // 2. Atualizar coleção ordens_servico com novos campos solicitados
    const ordensCol = app.findCollectionByNameOrId('ordens_servico')
    const colaboradoresCol = app.findCollectionByNameOrId('colaboradores')

    // prestador_tipo: colaborador | fornecedor | terceiro_usuario | outro
    if (!ordensCol.fields.getByName('prestador_tipo')) {
      ordensCol.fields.add(
        new SelectField({
          name: 'prestador_tipo',
          required: false,
          maxSelect: 1,
          values: ['colaborador', 'fornecedor', 'terceiro_usuario', 'outro'],
        }),
      )
    }

    // colaborador: relação opcional com colaboradores
    if (!ordensCol.fields.getByName('colaborador')) {
      ordensCol.fields.add(
        new RelationField({
          name: 'colaborador',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
        }),
      )
    }

    // fornecedor: relação opcional com fornecedores
    if (!ordensCol.fields.getByName('fornecedor')) {
      ordensCol.fields.add(
        new RelationField({
          name: 'fornecedor',
          collectionId: fornecedoresCol.id,
          maxSelect: 1,
        }),
      )
    }

    // tipo_servico: tipo selecionável da lista AEROCAD
    if (!ordensCol.fields.getByName('tipo_servico')) {
      ordensCol.fields.add(
        new TextField({
          name: 'tipo_servico',
          max: 500,
        }),
      )
    }

    // tipo_servico_outro: caso o usuário digite um novo tipo não listado
    if (!ordensCol.fields.getByName('tipo_servico_outro')) {
      ordensCol.fields.add(
        new TextField({
          name: 'tipo_servico_outro',
          max: 500,
        }),
      )
    }

    // valor: valor do serviço (R$)
    if (!ordensCol.fields.getByName('valor')) {
      ordensCol.fields.add(
        new NumberField({
          name: 'valor',
          min: 0,
        }),
      )
    }

    // forma_pagamento
    if (!ordensCol.fields.getByName('forma_pagamento')) {
      ordensCol.fields.add(
        new TextField({
          name: 'forma_pagamento',
          max: 150,
        }),
      )
    }

    // prazo_execucao: texto ou data do prazo de execução acordado
    if (!ordensCol.fields.getByName('prazo_execucao')) {
      ordensCol.fields.add(
        new TextField({
          name: 'prazo_execucao',
          max: 150,
        }),
      )
    }

    // anexos: arquivos anexados à OS
    if (!ordensCol.fields.getByName('anexos')) {
      ordensCol.fields.add(
        new FileField({
          name: 'anexos',
          maxSelect: 10,
          maxSize: 20971520, // 20MB
        }),
      )
    }

    app.save(ordensCol)
  },
  (app) => {
    // Rollback defensivo
    try {
      const ordensCol = app.findCollectionByNameOrId('ordens_servico')
      const fieldsToRemove = [
        'prestador_tipo',
        'colaborador',
        'fornecedor',
        'tipo_servico',
        'tipo_servico_outro',
        'valor',
        'forma_pagamento',
        'prazo_execucao',
        'anexos',
      ]
      for (const f of fieldsToRemove) {
        const field = ordensCol.fields.getByName(f)
        if (field) ordensCol.fields.remove(field)
      }
      app.save(ordensCol)
    } catch (_) {}

    try {
      const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')
      const fPessoa = fornecedoresCol.fields.getByName('tipo_pessoa')
      if (fPessoa) fornecedoresCol.fields.remove(fPessoa)
      const fNome = fornecedoresCol.fields.getByName('nome_completo')
      if (fNome) fornecedoresCol.fields.remove(fNome)
      const fCpf = fornecedoresCol.fields.getByName('cpf')
      if (fCpf) fornecedoresCol.fields.remove(fCpf)
      app.save(fornecedoresCol)
    } catch (_) {}
  },
)
