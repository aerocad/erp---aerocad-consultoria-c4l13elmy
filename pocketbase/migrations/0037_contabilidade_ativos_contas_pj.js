/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const authenticated = "@request.auth.id != ''"
    const canWrite = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
    const canManageContratos =
      "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const fornecedoresCol = app.findCollectionByNameOrId('fornecedores')

    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    // 1. Coleção contas_bancarias (duas contas PJ da AEROCAD + cadastro extensível)
    if (!app.hasTable('contas_bancarias')) {
      const contasBancarias = new Collection({
        name: 'contas_bancarias',
        type: 'base',
        listRule: authenticated,
        viewRule: authenticated,
        createRule: canWrite,
        updateRule: canWrite,
        deleteRule: canWrite,
        fields: [
          { name: 'apelido', type: 'text', required: true, max: 120 },
          { name: 'banco_codigo', type: 'text', max: 20 },
          { name: 'banco_nome', type: 'text', required: true, max: 120 },
          { name: 'agencia', type: 'text', max: 30 },
          { name: 'numero_conta', type: 'text', required: true, max: 50 },
          {
            name: 'tipo_conta',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['corrente_pj', 'poupanca_pj', 'investimento_pj', 'outro'],
          },
          { name: 'chave_pix', type: 'text', max: 150 },
          { name: 'saldo_inicial', type: 'number' },
          { name: 'ativo', type: 'bool' },
          { name: 'cor_identificacao', type: 'text', max: 30 },
          { name: 'observacoes', type: 'editor', maxSize: 50000 },
          ...timestamps,
        ],
        indexes: [
          'CREATE INDEX idx_contas_bancarias_apelido ON contas_bancarias (apelido)',
          'CREATE INDEX idx_contas_bancarias_banco ON contas_bancarias (banco_nome)',
          'CREATE INDEX idx_contas_bancarias_ativo ON contas_bancarias (ativo)',
        ],
      })
      app.save(contasBancarias)

      // Seed das 2 contas bancárias PJ da AEROCAD
      const recConta1 = new Record(contasBancarias)
      recConta1.set('apelido', 'Banco do Brasil PJ (Principal)')
      recConta1.set('banco_codigo', '001')
      recConta1.set('banco_nome', 'Banco do Brasil S.A.')
      recConta1.set('agencia', '1607-1')
      recConta1.set('numero_conta', '34567-8')
      recConta1.set('tipo_conta', 'corrente_pj')
      recConta1.set('chave_pix', 'financeiro@aerocad.com.br')
      recConta1.set('saldo_inicial', 0)
      recConta1.set('ativo', true)
      recConta1.set('cor_identificacao', '#FF6A13')
      recConta1.set(
        'observacoes',
        '<p>Conta principal da AEROCAD Consultoria para recebimento de contratos e parcelas de projetos aeronáuticos.</p>',
      )
      app.save(recConta1)

      const recConta2 = new Record(contasBancarias)
      recConta2.set('apelido', 'Banco Itaú / Inter PJ (Operacional)')
      recConta2.set('banco_codigo', '341')
      recConta2.set('banco_nome', 'Itaú Unibanco PJ')
      recConta2.set('agencia', '0420')
      recConta2.set('numero_conta', '98765-4')
      recConta2.set('tipo_conta', 'corrente_pj')
      recConta2.set('chave_pix', 'pix-pj@aerocad.com.br')
      recConta2.set('saldo_inicial', 0)
      recConta2.set('ativo', true)
      recConta2.set('cor_identificacao', '#0284C7')
      recConta2.set(
        'observacoes',
        '<p>Segunda conta PJ para custeio operacional, pagamentos de terceiros e tarifas bancárias.</p>',
      )
      app.save(recConta2)
    }

    const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')

    // 2. Coleção ativos_patrimonio (Bens móveis, imóveis, veículos, drones, softwares e estações totais)
    if (!app.hasTable('ativos_patrimonio')) {
      const ativosCol = new Collection({
        name: 'ativos_patrimonio',
        type: 'base',
        listRule: authenticated,
        viewRule: authenticated,
        createRule: canWrite,
        updateRule: canWrite,
        deleteRule: canWrite,
        fields: [
          { name: 'identificador_codigo', type: 'text', max: 60 },
          { name: 'descricao', type: 'text', required: true, max: 300 },
          {
            name: 'categoria',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'equipamento_topografico',
              'drone_aeronave',
              'computador_hardware',
              'software_licenca',
              'veiculo',
              'imovel',
              'mobiliario',
              'outro_ativo',
            ],
          },
          { name: 'data_aquisicao', type: 'date', required: true },
          { name: 'valor_aquisicao', type: 'number', required: true, min: 0 },
          { name: 'vida_util_meses', type: 'number', min: 1 },
          { name: 'taxa_depreciacao_anual', type: 'number', min: 0 },
          { name: 'valor_residual', type: 'number', min: 0 },
          { name: 'valor_contabil_atual', type: 'number', min: 0 },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['ativo', 'em_manutencao', 'baixado_alienado', 'totalmente_depreciado'],
          },
          { name: 'numero_nf_registro', type: 'text', max: 120 },
          {
            name: 'fornecedor',
            type: 'relation',
            collectionId: fornecedoresCol.id,
            maxSelect: 1,
          },
          { name: 'fornecedor_nome', type: 'text', max: 200 },
          {
            name: 'documento_evidencia',
            type: 'file',
            maxSelect: 1,
            maxSize: 26214400, // 25 MB
          },
          { name: 'localizacao_responsavel', type: 'text', max: 200 },
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
          'CREATE INDEX idx_ativos_categoria ON ativos_patrimonio (categoria)',
          'CREATE INDEX idx_ativos_status ON ativos_patrimonio (status)',
          'CREATE INDEX idx_ativos_data_aquisicao ON ativos_patrimonio (data_aquisicao)',
          'CREATE INDEX idx_ativos_created ON ativos_patrimonio (created DESC)',
        ],
      })
      app.save(ativosCol)
    }

    // 3. Atualizar contas_pagar com campos contábeis, boletos e conta bancária
    const cpCol = app.findCollectionByNameOrId('contas_pagar')
    let cpModified = false
    if (!cpCol.fields.getByName('codigo_barras_linha_digitavel')) {
      cpCol.fields.add(
        new TextField({
          name: 'codigo_barras_linha_digitavel',
          max: 120,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('cnpj_cpf_beneficiario')) {
      cpCol.fields.add(
        new TextField({
          name: 'cnpj_cpf_beneficiario',
          max: 40,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('valor_desconto')) {
      cpCol.fields.add(
        new NumberField({
          name: 'valor_desconto',
          min: 0,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('valor_juros_multa')) {
      cpCol.fields.add(
        new NumberField({
          name: 'valor_juros_multa',
          min: 0,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('plano_contas_codigo')) {
      cpCol.fields.add(
        new TextField({
          name: 'plano_contas_codigo',
          max: 40,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('plano_contas_nome')) {
      cpCol.fields.add(
        new TextField({
          name: 'plano_contas_nome',
          max: 150,
        }),
      )
      cpModified = true
    }
    if (!cpCol.fields.getByName('conta_bancaria')) {
      cpCol.fields.add(
        new RelationField({
          name: 'conta_bancaria',
          collectionId: contasBancariasCol.id,
          maxSelect: 1,
        }),
      )
      cpModified = true
    }
    if (cpModified) {
      app.save(cpCol)
    }

    // 4. Atualizar contas_receber com plano de contas e conta bancária
    const crCol = app.findCollectionByNameOrId('contas_receber')
    let crModified = false
    if (!crCol.fields.getByName('plano_contas_codigo')) {
      crCol.fields.add(
        new TextField({
          name: 'plano_contas_codigo',
          max: 40,
        }),
      )
      crModified = true
    }
    if (!crCol.fields.getByName('plano_contas_nome')) {
      crCol.fields.add(
        new TextField({
          name: 'plano_contas_nome',
          max: 150,
        }),
      )
      crModified = true
    }
    if (!crCol.fields.getByName('conta_bancaria')) {
      crCol.fields.add(
        new RelationField({
          name: 'conta_bancaria',
          collectionId: contasBancariasCol.id,
          maxSelect: 1,
        }),
      )
      crModified = true
    }
    if (crModified) {
      app.save(crCol)
    }

    // 5. Atualizar parcelas com conta_bancaria
    const parcelasCol = app.findCollectionByNameOrId('parcelas')
    let parcelasModified = false
    if (!parcelasCol.fields.getByName('conta_bancaria')) {
      parcelasCol.fields.add(
        new RelationField({
          name: 'conta_bancaria',
          collectionId: contasBancariasCol.id,
          maxSelect: 1,
        }),
      )
      parcelasModified = true
    }
    if (parcelasModified) {
      app.save(parcelasCol)
    }

    // 6. Atualizar extratos com relação à conta bancária PJ cadastrada
    const extratosCol = app.findCollectionByNameOrId('extratos')
    let extratosModified = false
    if (!extratosCol.fields.getByName('conta_bancaria')) {
      extratosCol.fields.add(
        new RelationField({
          name: 'conta_bancaria',
          collectionId: contasBancariasCol.id,
          maxSelect: 1,
        }),
      )
      extratosModified = true
    }
    if (extratosModified) {
      app.save(extratosCol)
    }

    // 7. Atualizar contratos com arquivo PDF anexado, projeto vinculado, fornecedor e campos extraídos por IA
    const contratosCol = app.findCollectionByNameOrId('contratos')
    let contratosModified = false

    // Tornar cliente e proposta opcionais se for contrato com prestador/terceirizado
    const clienteField = contratosCol.fields.getByName('cliente')
    if (clienteField && clienteField.required) {
      clienteField.required = false
      contratosModified = true
    }
    const propostaField = contratosCol.fields.getByName('proposta')
    if (propostaField && propostaField.required) {
      propostaField.required = false
      contratosModified = true
    }

    if (!contratosCol.fields.getByName('tipo_contrato')) {
      contratosCol.fields.add(
        new SelectField({
          name: 'tipo_contrato',
          values: ['cliente', 'prestador_fornecedor', 'parceria_tecnica', 'outro'],
          maxSelect: 1,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('fornecedor')) {
      contratosCol.fields.add(
        new RelationField({
          name: 'fornecedor',
          collectionId: fornecedoresCol.id,
          maxSelect: 1,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('projeto')) {
      contratosCol.fields.add(
        new RelationField({
          name: 'projeto',
          collectionId: projetosCol.id,
          maxSelect: 1,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('arquivo_pdf')) {
      contratosCol.fields.add(
        new FileField({
          name: 'arquivo_pdf',
          maxSelect: 1,
          maxSize: 31457280, // 30 MB
          mimeTypes: ['application/pdf'],
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('titulo')) {
      contratosCol.fields.add(
        new TextField({
          name: 'titulo',
          max: 250,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('partes_envolvidas')) {
      contratosCol.fields.add(
        new TextField({
          name: 'partes_envolvidas',
          max: 500,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('objeto')) {
      contratosCol.fields.add(
        new EditorField({
          name: 'objeto',
          maxSize: 50000,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('forma_pagamento_texto')) {
      contratosCol.fields.add(
        new TextField({
          name: 'forma_pagamento_texto',
          max: 300,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('data_inicio_vigencia')) {
      contratosCol.fields.add(
        new DateField({
          name: 'data_inicio_vigencia',
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('data_termino_vigencia')) {
      contratosCol.fields.add(
        new DateField({
          name: 'data_termino_vigencia',
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('indice_reajuste')) {
      contratosCol.fields.add(
        new TextField({
          name: 'indice_reajuste',
          max: 100,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('garante_fiador')) {
      contratosCol.fields.add(
        new TextField({
          name: 'garante_fiador',
          max: 250,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('dados_extracao_ia')) {
      contratosCol.fields.add(
        new JSONField({
          name: 'dados_extracao_ia',
          maxSize: 100000,
        }),
      )
      contratosModified = true
    }
    if (!contratosCol.fields.getByName('observacoes')) {
      contratosCol.fields.add(
        new EditorField({
          name: 'observacoes',
          maxSize: 50000,
        }),
      )
      contratosModified = true
    }

    // Permitir que usuários de financeiro também gerenciem contratos
    contratosCol.createRule = canManageContratos
    contratosCol.updateRule = canManageContratos
    contratosModified = true

    if (contratosModified) {
      app.save(contratosCol)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('ativos_patrimonio'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_bancarias'))
    } catch (_) {}
  },
)
