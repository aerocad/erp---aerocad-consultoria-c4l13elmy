migrate(
  (app) => {
    // 1. Garantir que a coleção 'empresa' exista e possua o campo 'chave_pix'
    let empresaCol
    try {
      empresaCol = app.findCollectionByNameOrId('empresa')
    } catch (_) {
      empresaCol = new Collection({
        name: 'empresa',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          { name: 'chave', type: 'text', required: true, max: 64 },
          { name: 'razao_social', type: 'text', required: true, max: 255 },
          { name: 'nome_fantasia', type: 'text', max: 255 },
          { name: 'cnpj', type: 'text', required: true, max: 32 },
          { name: 'inscricao_estadual', type: 'text', max: 64 },
          { name: 'inscricao_municipal', type: 'text', max: 64 },
          { name: 'data_constituicao', type: 'text', max: 32 },
          { name: 'capital_social', type: 'number', min: 0 },
          { name: 'cnae_principal', type: 'text', max: 255 },
          { name: 'objeto_social', type: 'text', max: 10000 },
          { name: 'endereco', type: 'text', max: 500 },
          { name: 'cidade_uf', type: 'text', max: 100 },
          { name: 'cep', type: 'text', max: 20 },
          { name: 'telefone', type: 'text', max: 50 },
          { name: 'email', type: 'email' },
          { name: 'website', type: 'text', max: 100 },
          { name: 'banco_nome', type: 'text', max: 100 },
          { name: 'banco_agencia', type: 'text', max: 30 },
          { name: 'banco_conta', type: 'text', max: 30 },
          { name: 'chave_pix', type: 'text', max: 100 },
          { name: 'socios', type: 'json', maxSize: 2097152 },
          {
            name: 'contrato_social',
            type: 'file',
            maxSelect: 10,
            maxSize: 52428800,
            mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'observacoes', type: 'editor', maxSize: 50000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_empresa_chave ON empresa (chave)'],
      })
      app.save(empresaCol)
    }

    if (!empresaCol.fields.getByName('chave_pix')) {
      empresaCol.fields.add(new TextField({ name: 'chave_pix', max: 100 }))
      app.save(empresaCol)
    }

    // 2. Atualizar ou criar o registro oficial da AEROCAD na coleção empresa
    // Preservando socios e contrato_social se já cadastrados
    const DADOS_OFICIAIS = {
      chave: 'aerocad_principal',
      nome_fantasia: 'AEROCAD CONSULTORIA & AEROPORTOS',
      razao_social: 'AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA',
      cnpj: '28.036.597/0001-43',
      endereco:
        'SBS QUADRA 2 SALA 206 SOBRELOJA, ED. PRIME BUSINESS, ASA SUL, CEP.: 70.070-120, BRASÍLIA/DF.',
      chave_pix: '28036597000143',
      cidade_uf: 'Brasília/DF',
      cep: '70.070-120',
      telefone: '+55 61 9 8462-8800',
      email: 'contato@aerocad.com.br',
      website: 'www.aerocad.com.br',
      banco_nome: 'INTER (077)',
      banco_agencia: '0001',
      banco_conta: '7637194-8',
    }

    let empresaRecord = null
    try {
      empresaRecord = app.findFirstRecordByData('empresa', 'chave', 'aerocad_principal')
    } catch (_) {
      try {
        const todos = app.findRecordsByFilter('empresa', '', '-created', 1, 0)
        if (todos.length > 0) {
          empresaRecord = todos[0]
        }
      } catch (_) {}
    }

    if (!empresaRecord) {
      empresaRecord = new Record(empresaCol)
      empresaRecord.set('chave', DADOS_OFICIAIS.chave)
      empresaRecord.set('razao_social', DADOS_OFICIAIS.razao_social)
      empresaRecord.set('nome_fantasia', DADOS_OFICIAIS.nome_fantasia)
      empresaRecord.set('cnpj', DADOS_OFICIAIS.cnpj)
      empresaRecord.set('endereco', DADOS_OFICIAIS.endereco)
      empresaRecord.set('chave_pix', DADOS_OFICIAIS.chave_pix)
      empresaRecord.set('cidade_uf', DADOS_OFICIAIS.cidade_uf)
      empresaRecord.set('cep', DADOS_OFICIAIS.cep)
      empresaRecord.set('telefone', DADOS_OFICIAIS.telefone)
      empresaRecord.set('email', DADOS_OFICIAIS.email)
      empresaRecord.set('website', DADOS_OFICIAIS.website)
      empresaRecord.set('banco_nome', DADOS_OFICIAIS.banco_nome)
      empresaRecord.set('banco_agencia', DADOS_OFICIAIS.banco_agencia)
      empresaRecord.set('banco_conta', DADOS_OFICIAIS.banco_conta)
      empresaRecord.set('capital_social', 100000)
      empresaRecord.set('data_constituicao', '2017-06-26')
      empresaRecord.set(
        'cnae_principal',
        '71.12-0-00 - Serviços de engenharia aeroportuária e consultoria técnica',
      )
      empresaRecord.set(
        'objeto_social',
        'Serviços de engenharia aeroportuária, elaboração de planos de zona de proteção (PBZPA, PBZH, PZPANA, PBZR), estudos de viabilidade técnica aeronáutica (EVA/EVTEA), processos perante ANAC, DECEA e COMAER, projetos e consultoria técnica especializada.',
      )
      empresaRecord.set(
        'socios',
        JSON.stringify([
          {
            nome: 'Jaqueline Mota de Freitas Saraiva',
            cpf_cnpj: '005.417.801-07',
            qualificacao: 'Sócio-Administrador',
            percentual_participacao: 50.0,
          },
          {
            nome: 'Cleyton Borges Saraiva',
            cpf_cnpj: '619.274.492-00',
            qualificacao: 'Sócio-Administrador',
            percentual_participacao: 50.0,
          },
        ]),
      )
      app.save(empresaRecord)
    } else {
      // Atualizar dados oficiais preservando sócios e contratos já existentes
      empresaRecord.set('chave', DADOS_OFICIAIS.chave)
      empresaRecord.set('razao_social', DADOS_OFICIAIS.razao_social)
      empresaRecord.set('nome_fantasia', DADOS_OFICIAIS.nome_fantasia)
      empresaRecord.set('cnpj', DADOS_OFICIAIS.cnpj)
      empresaRecord.set('endereco', DADOS_OFICIAIS.endereco)
      empresaRecord.set('chave_pix', DADOS_OFICIAIS.chave_pix)
      if (!empresaRecord.getString('cidade_uf')) {
        empresaRecord.set('cidade_uf', DADOS_OFICIAIS.cidade_uf)
      }
      if (!empresaRecord.getString('email')) {
        empresaRecord.set('email', DADOS_OFICIAIS.email)
      }
      if (!empresaRecord.getString('telefone')) {
        empresaRecord.set('telefone', DADOS_OFICIAIS.telefone)
      }
      app.save(empresaRecord)
    }

    // 3. Varrer e atualizar modelos de documentos no banco se houver dados legados embutidos
    // Substituir menções ao CNPJ antigo ou formatos legados de endereço/razão social se encontrados
    if (app.hasTable('modelos_documentos')) {
      try {
        const modelos = app.findRecordsByFilter('modelos_documentos', '', 'id', 500, 0)
        for (let i = 0; i < modelos.length; i++) {
          const mod = modelos[i]
          let corpo = mod.getString('corpo')
          let modificado = false

          if (corpo && corpo.indexOf('19.822.868/0001-38') !== -1) {
            corpo = corpo.split('19.822.868/0001-38').join('28.036.597/0001-43')
            modificado = true
          }
          if (corpo && corpo.indexOf('19822868000138') !== -1) {
            corpo = corpo.split('19822868000138').join('28036597000143')
            modificado = true
          }
          if (corpo && corpo.indexOf('AEROCAD Terraplanagem e Construção Ltda.') !== -1) {
            corpo = corpo
              .split('AEROCAD Terraplanagem e Construção Ltda.')
              .join('AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA')
            modificado = true
          }

          if (modificado) {
            mod.set('corpo', corpo)
            app.save(mod)
          }
        }
      } catch (err) {
        console.log('Aviso ao sincronizar modelos_documentos:', err)
      }
    }

    // 4. Também checar se em documentos já emitidos/salvos há dados legados a corrigir
    if (app.hasTable('documentos')) {
      try {
        const docs = app.findRecordsByFilter('documentos', '', 'id', 500, 0)
        for (let j = 0; j < docs.length; j++) {
          const doc = docs[j]
          let conteudo = doc.getString('conteudo')
          let modificadoDoc = false

          if (conteudo && conteudo.indexOf('19.822.868/0001-38') !== -1) {
            conteudo = conteudo.split('19.822.868/0001-38').join('28.036.597/0001-43')
            modificadoDoc = true
          }
          if (conteudo && conteudo.indexOf('19822868000138') !== -1) {
            conteudo = conteudo.split('19822868000138').join('28036597000143')
            modificadoDoc = true
          }

          if (modificadoDoc) {
            doc.set('conteudo', conteudo)
            app.save(doc)
          }
        }
      } catch (err) {
        console.log('Aviso ao sincronizar documentos:', err)
      }
    }
  },
  (app) => {
    // Reversão segura (não apaga registros nem dados do usuário)
  },
)
