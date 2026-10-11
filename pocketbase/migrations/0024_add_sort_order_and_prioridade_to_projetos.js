migrate(
  (app) => {
    const projetos = app.findCollectionByNameOrId('projetos')

    // 1. Adicionar campo 'sort_order' (number) se não existir
    if (!projetos.fields.getByName('sort_order')) {
      projetos.fields.add(
        new NumberField({
          name: 'sort_order',
          required: false,
          onlyInt: true,
        }),
      )
    }

    // 2. Adicionar campo 'prioridade' (select: alta | normal | baixa) se não existir
    if (!projetos.fields.getByName('prioridade')) {
      projetos.fields.add(
        new SelectField({
          name: 'prioridade',
          required: false,
          values: ['alta', 'normal', 'baixa'],
          maxSelect: 1,
        }),
      )
    }

    // 3. Atualizar regras de update:
    // - admin tem acesso total a todos os campos (exceto numero sequencial imutável)
    // - tecnico pode editar dados técnicos e operacionais, status, datas, etc., bem como sort_order e prioridade
    // - comercial e financeiro: podem atualizar dados operacionais e sort_order/prioridade contanto que nome, arquivado, data_arquivamento permaneçam inalterados. Para valores globais sensíveis, apenas admin (ou financeiro se aplicável).
    // O campo numero AAAA-NNN continua estritamente imutável para TODOS via API.
    const safeUpdateRule =
      "(@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || ((@request.auth.role = 'comercial' || @request.auth.role = 'financeiro') && @request.body.nome:changed = false && @request.body.arquivado:changed = false && @request.body.data_arquivamento:changed = false)) && @request.body.numero:changed = false"

    projetos.updateRule = safeUpdateRule

    // 4. Índices
    projetos.addIndex('idx_projetos_sort_order', false, 'sort_order', '')
    projetos.addIndex('idx_projetos_prioridade', false, 'prioridade', '')

    app.save(projetos)

    // 5. Inicializar sort_order e prioridade padrão ('normal') para registros existentes que ainda não tenham
    try {
      app
        .db()
        .newQuery(
          "UPDATE projetos SET prioridade = 'normal' WHERE prioridade IS NULL OR prioridade = ''",
        )
        .execute()
      // Para sort_order inicial, usar a ordem cronológica decrescente dos IDs / criação para que venha ordenado
      app
        .db()
        .newQuery(`
        UPDATE projetos
        SET sort_order = (
          SELECT count(*) FROM projetos p2 WHERE p2.numero >= projetos.numero
        )
        WHERE sort_order IS NULL OR sort_order = 0
      `)
        .execute()
    } catch (err) {
      console.log('Aviso ao inicializar sort_order/prioridade:', err)
    }
  },
  (app) => {
    try {
      const projetos = app.findCollectionByNameOrId('projetos')
      projetos.removeIndex('idx_projetos_sort_order')
      projetos.removeIndex('idx_projetos_prioridade')
      projetos.fields.removeByName('sort_order')
      projetos.fields.removeByName('prioridade')
      app.save(projetos)
    } catch (_) {}
  },
)
