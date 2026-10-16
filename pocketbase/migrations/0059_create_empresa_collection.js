migrate(
  (app) => {
    // 1. Criar coleção empresa se não existir
    if (!app.hasTable('empresa')) {
      const empresaCol = new Collection({
        name: 'empresa',
        type: 'base',
        // Leitura para qualquer usuário autenticado; escrita restrita a admins
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
          {
            name: 'socios',
            type: 'json',
            maxSize: 2097152, // 2MB
          },
          {
            name: 'contrato_social',
            type: 'file',
            maxSelect: 10,
            maxSize: 52428800, // 50MB
            mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'observacoes', type: 'editor', maxSize: 50000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_empresa_chave ON empresa (chave)'],
      })
      app.save(empresaCol)

      // 2. Semear registro padrão da AEROCAD com dados institucionais conhecidos
      const rec = new Record(empresaCol)
      rec.set('chave', 'aerocad_principal')
      rec.set('razao_social', 'AEROCAD Terraplanagem e Construção Ltda.')
      rec.set('nome_fantasia', 'AEROCAD® CONSULTORIA & AEROPORTOS')
      rec.set('cnpj', '28.036.597/0001-43')
      rec.set('inscricao_estadual', '07.815.970/001-59')
      rec.set(
        'endereco',
        'SBS Quadra 2, Sala 206, Ed. Prime Business, Asa Sul, CEP 70.070-120, Brasília-DF',
      )
      rec.set('cidade_uf', 'Brasília / DF')
      rec.set('cep', '70.070-120')
      rec.set('telefone', '+55 61 9 8462-8800')
      rec.set('email', 'contato@aerocad.com.br')
      rec.set('website', 'www.aerocad.com.br')
      rec.set('banco_nome', 'INTER (077)')
      rec.set('banco_agencia', '0001')
      rec.set('banco_conta', '7637194-8')
      rec.set('chave_pix', '28.036.597/0001-43')
      rec.set('capital_social', 100000)
      rec.set('data_constituicao', '2017-06-26')
      rec.set(
        'cnae_principal',
        '71.12-0-00 - Serviços de engenharia aeroportuária e consultoria técnica',
      )
      rec.set(
        'objeto_social',
        'Serviços de engenharia aeroportuária, elaboração de planos de zona de proteção (PBZPA, PBZH, PZPANA, PBZR), estudos de viabilidade técnica aeronáutica (EVA/EVTEA), processos perante ANAC, DECEA e COMAER, projetos e consultoria técnica especializada.',
      )
      rec.set(
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
      app.save(rec)
    }
  },
  (app) => {
    try {
      const empresaCol = app.findCollectionByNameOrId('empresa')
      app.delete(empresaCol)
    } catch (_) {}
  },
)
