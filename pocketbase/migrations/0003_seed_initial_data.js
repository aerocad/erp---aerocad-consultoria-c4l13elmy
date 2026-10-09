migrate(
  (app) => {
    const now = new Date()
    const year = now.getFullYear()
    const isoDate = (offsetDays) => {
      const date = new Date(now.getTime() + offsetDays * 86400000)
      return date.toISOString()
    }
    const setFields = (record, data) => {
      for (const key in data) record.set(key, data[key])
    }
    const ensureUser = (email, name, role) => {
      try {
        const existing = app.findAuthRecordByEmail('_pb_users_auth_', email)
        existing.set('name', name)
        existing.set('role', role)
        existing.setVerified(true)
        app.save(existing)
        return existing
      } catch (_) {
        const record = new Record(app.findCollectionByNameOrId('_pb_users_auth_'))
        record.setEmail(email)
        record.setPassword('Skip@Pass')
        record.setVerified(true)
        record.set('name', name)
        record.set('role', role)
        app.save(record)
        return record
      }
    }
    const ensure = (collectionName, field, value, data) => {
      try {
        return app.findFirstRecordByData(collectionName, field, value)
      } catch (_) {
        const record = new Record(app.findCollectionByNameOrId(collectionName))
        setFields(record, data)
        app.save(record)
        return record
      }
    }

    const admin = ensureUser('cleytonsaraiva@aerocad.com.br', 'Cleyton Saraiva', 'admin')
    const comercial = ensureUser('jaquelinemota@aerocad.com.br', 'Jaqueline Mota', 'comercial')
    const tecnico = ensureUser('rafaelduarte@aerocad.com.br', 'Rafael Duarte', 'tecnico')
    ensureUser('paularibeiro@aerocad.com.br', 'Paula Ribeiro', 'financeiro')

    const services = [
      ['OPEA', 'Processo OPEA', 8320, 8320, 8320, 'ICA 11-408', '45 a 90 dias'],
      [
        'REG-AER',
        'Registro de aeródromo privado',
        15000,
        22000,
        18500,
        'RBAC 153/154/155',
        '90 a 180 dias',
      ],
      ['AER-NOVO', 'Aeródromo novo', 25000, 45000, 35000, 'RBAC 154/155', '120 a 240 dias'],
      ['HEL-SOLO', 'Heliponto no solo', 55000, 75000, 65000, 'RBAC 155', '120 a 240 dias'],
      ['HEL-ELEV', 'Heliponto elevado', 25000, 35000, 30000, 'RBAC 155', '90 a 180 dias'],
      [
        'EVA',
        'Estudo de viabilidade aeroportuária',
        10000,
        18000,
        14000,
        'ICA 11-408',
        '30 a 60 dias',
      ],
      ['PBZPA', 'PBZPA regional', 35000, 55000, 45000, 'ICA 11-408', '90 a 180 dias'],
      ['PDIR', 'PDIR regional', 45000, 65000, 55000, 'RBAC 154', '120 a 240 dias'],
      ['SDIA', 'SDIA por obstáculo', 4000, 6000, 5000, 'ICA 63-19', '20 a 45 dias'],
      [
        'DOC-TEC',
        'Documentação técnica',
        10000,
        15000,
        12500,
        'Referência configurável',
        '30 a 60 dias',
      ],
      ['MOPS', 'Manual de operações', 12000, 20000, 16000, 'RBAC 153', '45 a 90 dias'],
      ['PAC', 'Plano de ação corretiva', 15000, 25000, 20000, 'RBAC 153/161', '30 a 75 dias'],
    ]
    const serviceRecords = {}
    for (const row of services) {
      serviceRecords[row[0]] = ensure('servicos_catalogo', 'codigo', row[0], {
        codigo: row[0],
        nome: row[1],
        faixa_min: row[2],
        faixa_max: row[3],
        preco_padrao: row[4],
        base_normativa: row[5],
        prazo_tipico: row[6],
        desconto_pacote_percentual: 8,
        ativo: true,
        vigencia_inicio: row[0] === 'OPEA' ? year + '-10-01 00:00:00.000Z' : '',
        descricao:
          'Serviço aeronáutico com escopo e condições ajustáveis conforme o empreendimento.',
      })
    }

    const cliente1 = ensure('clientes', 'cnpj_cpf', '12.345.678/0001-90', {
      tipo: 'pj',
      razao_social: 'Águas do Cerrado S.A.',
      cnpj_cpf: '12.345.678/0001-90',
      segmento: 'Saneamento',
      municipio: 'Brasília',
      uf: 'DF',
      telefone: '+55 61 3030-2040',
      email: 'engenharia@aguasdocerrado.com.br',
      endereco: 'SIA Trecho 3, Brasília-DF',
      origem: 'Indicação',
      status: 'cliente',
      recorrente: true,
      observacoes: 'Cliente com empreendimentos de infraestrutura no Distrito Federal.',
    })
    const cliente2 = ensure('clientes', 'cnpj_cpf', '23.456.789/0001-01', {
      tipo: 'pj',
      razao_social: 'Shopping Planalto Empreendimentos',
      cnpj_cpf: '23.456.789/0001-01',
      segmento: 'Shopping center',
      municipio: 'Goiânia',
      uf: 'GO',
      telefone: '+55 62 3110-4400',
      email: 'obras@shoppingplanalto.com.br',
      endereco: 'Av. T-10, Setor Bueno, Goiânia-GO',
      origem: 'Site',
      status: 'prospect',
      recorrente: false,
    })
    const cliente3 = ensure('clientes', 'cnpj_cpf', '34.567.890/0001-12', {
      tipo: 'pj',
      razao_social: 'Agrovale Bioenergia Ltda.',
      cnpj_cpf: '34.567.890/0001-12',
      segmento: 'Agroindústria',
      municipio: 'Rio Verde',
      uf: 'GO',
      telefone: '+55 64 3221-7720',
      email: 'projetos@agrovale.com.br',
      endereco: 'Rodovia GO-174, km 12, Rio Verde-GO',
      origem: 'Evento',
      status: 'cliente',
      recorrente: true,
    })

    ensure('contatos', 'email', 'marcos.silva@aguasdocerrado.com.br', {
      cliente: cliente1.id,
      nome: 'Marcos Silva',
      cargo: 'Gerente de Engenharia',
      email: 'marcos.silva@aguasdocerrado.com.br',
      telefone_whatsapp: '+55 61 99820-1130',
      papel: 'decisor',
    })
    ensure('contatos', 'email', 'renata.alves@agrovale.com.br', {
      cliente: cliente3.id,
      nome: 'Renata Alves',
      cargo: 'Coordenadora de Projetos',
      email: 'renata.alves@agrovale.com.br',
      telefone_whatsapp: '+55 64 99710-2244',
      papel: 'tecnico',
    })

    const empreendimento = ensure('empreendimentos', 'nome', 'Reservatório Norte — Etapa 2', {
      cliente: cliente1.id,
      nome: 'Reservatório Norte — Etapa 2',
      endereco: 'Sobradinho, Brasília-DF',
      coordenadas: '-15.6501, -47.7922',
      altura_pretendida: 42,
      aerodromo_referencia: 'SBBR',
      tipo: 'torre',
    })

    const oportunidade1 = ensure('oportunidades', 'titulo', 'OPEA — Reservatório Norte', {
      cliente: cliente1.id,
      titulo: 'OPEA — Reservatório Norte',
      tipo_servico: serviceRecords.OPEA.id,
      etapa: 'negociacao',
      valor_estimado: 16640,
      probabilidade: 75,
      data_prevista_fechamento: isoDate(14),
      responsavel: comercial.id,
      trilha_prevista: 'opea',
      observacoes: 'Pacote com dois processos OPEA; condição comercial em negociação.',
    })
    ensure('oportunidades', 'titulo', 'Registro do aeródromo Agrovale', {
      cliente: cliente3.id,
      titulo: 'Registro do aeródromo Agrovale',
      tipo_servico: serviceRecords['REG-AER'].id,
      etapa: 'proposta_enviada',
      valor_estimado: 21800,
      probabilidade: 55,
      data_prevista_fechamento: isoDate(30),
      responsavel: comercial.id,
      trilha_prevista: 'registro',
    })

    ensure('sequencias', 'chave', 'projeto', { chave: 'projeto', atual: 233, ano: year })
    ensure('sequencias', 'chave', 'proposta_comercial', {
      chave: 'proposta_comercial',
      atual: 12,
      ano: year,
    })
    ensure('sequencias', 'chave', 'proposta_tecnica', {
      chave: 'proposta_tecnica',
      atual: 4,
      ano: year,
    })

    const projeto1 = ensure('projetos', 'numero', year + '-232', {
      numero: year + '-232',
      nome: 'OPEA Reservatório Norte',
      cliente: cliente1.id,
      empreendimento: empreendimento.id,
      oportunidade: oportunidade1.id,
      trilha: 'opea',
      fase: 'Protocolo SYSAGA',
      status: 'ativo',
      responsavel_tecnico: tecnico.id,
      art: 'ART-0720260012345',
      data_inicio: isoDate(-35),
      prazo: isoDate(55),
      percentual_concluido: 62,
      observacoes: 'Processo protocolado; acompanhamento de exigências em andamento.',
    })
    const projeto2 = ensure('projetos', 'numero', year + '-233', {
      numero: year + '-233',
      nome: 'Registro Aeródromo Agrovale',
      cliente: cliente3.id,
      trilha: 'registro',
      fase: 'Processo ANAC',
      status: 'ativo',
      responsavel_tecnico: tecnico.id,
      data_inicio: isoDate(-20),
      prazo: isoDate(100),
      percentual_concluido: 48,
    })

    const processo = ensure('processos', 'numero_protocolo', 'OPEA-DF-' + year + '-0187', {
      projeto: projeto1.id,
      orgao: 'DECEA-CINDACTA',
      numero_protocolo: 'OPEA-DF-' + year + '-0187',
      data_protocolo: isoDate(-18),
      status: 'em_exigencia',
      prazo_orgao: isoDate(45),
      parecer: 'pendente',
      observacoes: 'Aguardando atendimento das exigências emitidas pelo órgão.',
    })
    ensure('processos', 'numero_protocolo', 'ANAC-' + year + '-0042', {
      projeto: projeto2.id,
      orgao: 'ANAC',
      numero_protocolo: 'ANAC-' + year + '-0042',
      data_protocolo: isoDate(-5),
      status: 'protocolado',
      prazo_orgao: isoDate(80),
      parecer: 'pendente',
    })

    ensure(
      'exigencias',
      'descricao',
      'Apresentar memorial descritivo revisado com coordenadas SIRGAS 2000.',
      {
        processo: processo.id,
        descricao: 'Apresentar memorial descritivo revisado com coordenadas SIRGAS 2000.',
        prazo: isoDate(10),
        status: 'pendente',
        responsavel: tecnico.id,
        historico_respostas: [],
      },
    )
    ensure(
      'exigencias',
      'descricao',
      'Complementar prancha de implantação com cotas altimétricas.',
      {
        processo: processo.id,
        descricao: 'Complementar prancha de implantação com cotas altimétricas.',
        prazo: isoDate(-6),
        status: 'atendida',
        responsavel: tecnico.id,
        data_resposta: isoDate(-8),
        resposta: 'Prancha revisada anexada ao protocolo complementar.',
        historico_respostas: [
          {
            data: isoDate(-8),
            texto: 'Prancha revisada anexada ao protocolo complementar.',
            usuario: tecnico.id,
          },
        ],
      },
    )

    ensure('parcelas', 'descricao', 'Entrada — OPEA Reservatório Norte', {
      projeto: projeto1.id,
      cliente: cliente1.id,
      descricao: 'Entrada — OPEA Reservatório Norte',
      valor: 8320,
      gatilho: 'assinatura',
      vencimento: isoDate(-28),
      status: 'paga',
      data_pagamento: isoDate(-27),
      valor_recebido: 8320,
      origem: 'gatilho',
    })
    ensure('parcelas', 'descricao', 'Protocolo — OPEA Reservatório Norte', {
      projeto: projeto1.id,
      cliente: cliente1.id,
      descricao: 'Protocolo — OPEA Reservatório Norte',
      valor: 8320,
      gatilho: 'protocolo',
      vencimento: isoDate(12),
      status: 'pendente',
      origem: 'gatilho',
    })
    ensure('parcelas', 'descricao', 'Entrada — Registro Aeródromo Agrovale', {
      projeto: projeto2.id,
      cliente: cliente3.id,
      descricao: 'Entrada — Registro Aeródromo Agrovale',
      valor: 8720,
      gatilho: 'assinatura',
      vencimento: isoDate(5),
      status: 'pendente',
      origem: 'gatilho',
    })

    const company =
      'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA, CNPJ 28.036.597/0001-43, SBS Quadra 2, Sala 206, Sobreloja, Ed. Prime Business Convenience, Asa Sul, Brasília-DF, CEP 70.070-120.'
    const templates = [
      [
        'Proposta Comercial',
        'proposta',
        '<h1>PROPOSTA COMERCIAL</h1><p>À <strong>{{cliente.razao_social}}</strong>, inscrita sob {{cliente.cnpj_cpf}}.</p><p>Apresentamos proposta para <strong>{{projeto.nome}}</strong>, referência {{projeto.numero}}, no valor de <strong>{{valor_contrato}}</strong>.</p><p>Brasília, {{data_hoje}}.</p><p>' +
          company +
          '</p>',
      ],
      [
        'Contrato de Prestação de Serviços',
        'contrato',
        '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1><p>CONTRATANTE: {{cliente.razao_social}}, {{cliente.cnpj_cpf}}, com endereço em {{cliente.endereco}}.</p><p>CONTRATADA: ' +
          company +
          '</p><p>Objeto: serviços relativos ao projeto {{projeto.numero}} — {{projeto.nome}}.</p><p>Valor: {{valor_contrato}}.</p><p>Brasília, {{data_hoje}}.</p>',
      ],
      [
        'Ordem de Serviço Interna',
        'ordem_servico',
        '<h1>ORDEM DE SERVIÇO</h1><p>Projeto: {{projeto.numero}} — {{projeto.nome}}</p><p>Cliente: {{cliente.razao_social}}</p><p>Escopo: {{escopo}}</p><p>Responsável: {{responsavel}}</p><p>Data: {{data_hoje}}</p>',
      ],
      [
        'Ofício',
        'oficio',
        '<h1>OFÍCIO Nº {{numero_oficio}}</h1><p>Ao {{orgao}}</p><p>Assunto: {{assunto}}</p><p>{{texto}}</p><p>Brasília, {{data_hoje}}.</p>',
      ],
      [
        'Procuração',
        'procuracao',
        '<h1>PROCURAÇÃO</h1><p>{{cliente.razao_social}}, {{cliente.cnpj_cpf}}, nomeia a AEROCAD como sua procuradora para representar o empreendimento {{projeto.nome}} perante {{orgao}}.</p><p>Brasília, {{data_hoje}}.</p>',
      ],
      [
        'Requerimento ANAC/DECEA',
        'requerimento',
        '<h1>REQUERIMENTO</h1><p>Ao {{orgao}}</p><p>{{cliente.razao_social}} requer a análise do processo referente ao projeto {{projeto.numero}} — {{projeto.nome}}.</p><p>Protocolo: {{processo.numero_protocolo}}</p><p>Brasília, {{data_hoje}}.</p>',
      ],
      [
        'Recibo',
        'recibo',
        '<h1>RECIBO</h1><p>Recebemos de {{cliente.razao_social}}, {{cliente.cnpj_cpf}}, a quantia de {{valor_contrato}}, referente ao projeto {{projeto.numero}}.</p><p>Brasília, {{data_hoje}}.</p>',
      ],
    ]
    for (const tpl of templates)
      ensure('modelos_documentos', 'nome', tpl[0], {
        nome: tpl[0],
        categoria: tpl[1],
        corpo: tpl[2],
      })

    ensure(
      'atividades',
      'texto',
      'Projeto ' + projeto1.getString('numero') + ' protocolado no DECEA-CINDACTA',
      {
        usuario: tecnico.id,
        texto: 'Projeto ' + projeto1.getString('numero') + ' protocolado no DECEA-CINDACTA',
        cliente: cliente1.id,
        projeto: projeto1.id,
        processo: processo.id,
      },
    )
    ensure('atividades', 'texto', 'Oportunidade OPEA movida para Negociação', {
      usuario: comercial.id,
      texto: 'Oportunidade OPEA movida para Negociação',
      cliente: cliente1.id,
      oportunidade: oportunidade1.id,
    })
    ensure('atividades', 'texto', 'Cleyton Saraiva revisou o escopo comercial', {
      usuario: admin.id,
      texto: 'Cleyton Saraiva revisou o escopo comercial',
      cliente: cliente1.id,
      oportunidade: oportunidade1.id,
    })
  },
  (app) => {
    const seededEmails = [
      'cleytonsaraiva@aerocad.com.br',
      'jaquelinemota@aerocad.com.br',
      'rafaelduarte@aerocad.com.br',
      'paularibeiro@aerocad.com.br',
    ]
    for (const email of seededEmails) {
      try {
        app.delete(app.findAuthRecordByEmail('_pb_users_auth_', email))
      } catch (_) {}
    }
  },
)
