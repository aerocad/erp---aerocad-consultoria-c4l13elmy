migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const ordensCol = app.findCollectionByNameOrId('ordens_servico')
    const clientesCol = app.findCollectionByNameOrId('clientes')
    const contatosCol = app.findCollectionByNameOrId('contatos')
    const empreendimentosCol = app.findCollectionByNameOrId('empreendimentos')
    const servicosCol = app.findCollectionByNameOrId('servicos_catalogo')
    const oportunidadesCol = app.findCollectionByNameOrId('oportunidades')
    const modelosCol = app.findCollectionByNameOrId('modelos_documentos')
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const sequenciasCol = app.findCollectionByNameOrId('sequencias')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const processosCol = app.findCollectionByNameOrId('processos')
    const exigenciasCol = app.findCollectionByNameOrId('exigencias')
    const tarefasCol = app.findCollectionByNameOrId('tarefas')
    const parcelasCol = app.findCollectionByNameOrId('parcelas')
    const documentosCol = app.findCollectionByNameOrId('documentos')
    const linksCol = app.findCollectionByNameOrId('links_externos')
    const atividadesCol = app.findCollectionByNameOrId('atividades')
    const anexosCol = app.findCollectionByNameOrId('anexos')

    // 1. Atualizar select role na coleção users para incluir 'terceiro'
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'comercial', 'tecnico', 'financeiro', 'terceiro']
    }
    app.save(usersCol)

    // 2. Expandir coleção ordens_servico com novos campos
    // - prestador_usuario (relation -> users)
    // - titulo (text)
    // - prazo (date)
    // - observacoes (editor)
    // - data_conclusao (date)
    // - status: expandir valores para incluir atribuida, em_execucao, concluida, cancelada, recusada
    if (!ordensCol.fields.getByName('prestador_usuario')) {
      ordensCol.fields.add(
        new RelationField({
          name: 'prestador_usuario',
          collectionId: usersCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!ordensCol.fields.getByName('titulo')) {
      ordensCol.fields.add(
        new TextField({
          name: 'titulo',
          max: 250,
        }),
      )
    }

    if (!ordensCol.fields.getByName('prazo')) {
      ordensCol.fields.add(
        new DateField({
          name: 'prazo',
        }),
      )
    }

    if (!ordensCol.fields.getByName('data_conclusao')) {
      ordensCol.fields.add(
        new DateField({
          name: 'data_conclusao',
        }),
      )
    }

    if (!ordensCol.fields.getByName('observacoes')) {
      ordensCol.fields.add(
        new EditorField({
          name: 'observacoes',
          maxSize: 300000,
        }),
      )
    }

    // Tornar o campo legado prestador opcional se antes era required
    const oldPrestadorField = ordensCol.fields.getByName('prestador')
    if (oldPrestadorField) {
      oldPrestadorField.required = false
    }

    const statusField = ordensCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'atribuida',
        'em_execucao',
        'concluida',
        'cancelada',
        'recusada',
        'rascunho',
        'emitida',
      ]
    }

    // Regras de acesso em ordens_servico:
    // Terceiro só lista e visualiza as OS onde prestador_usuario = @request.auth.id
    // Terceiro pode atualizar apenas status, observacoes e data_conclusao da sua própria OS
    // Internos (admin, comercial, tecnico) podem listar e ver
    // Admin e tecnico podem criar/editar
    // Terceiro NUNCA edita valor_interno (garantido por hook e por regra)
    ordensCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial' || (@request.auth.role = 'terceiro' && prestador_usuario = @request.auth.id))"
    ordensCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || @request.auth.role = 'comercial' || (@request.auth.role = 'terceiro' && prestador_usuario = @request.auth.id))"
    ordensCol.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'tecnico'"
    ordensCol.updateRule =
      "@request.auth.role = 'admin' || @request.auth.role = 'tecnico' || (@request.auth.role = 'terceiro' && prestador_usuario = @request.auth.id && @request.body.valor_interno:changed = false && @request.body.prestador_usuario:changed = false && @request.body.projeto:changed = false)"
    ordensCol.deleteRule = "@request.auth.role = 'admin'"

    ordensCol.addIndex('idx_ordens_prestador_usuario', false, 'prestador_usuario', '')
    ordensCol.addIndex('idx_ordens_status', false, 'status', '')
    app.save(ordensCol)

    // 3. Atualizar regras de API das demais coleções para blindar acesso a terceiros
    const internalStaff =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro')"

    // Clientes
    clientesCol.listRule = internalStaff
    clientesCol.viewRule = internalStaff
    app.save(clientesCol)

    // Contatos
    contatosCol.listRule = internalStaff
    contatosCol.viewRule = internalStaff
    app.save(contatosCol)

    // Empreendimentos
    empreendimentosCol.listRule = internalStaff
    empreendimentosCol.viewRule = internalStaff
    app.save(empreendimentosCol)

    // Servicos
    servicosCol.listRule = internalStaff
    servicosCol.viewRule = internalStaff
    app.save(servicosCol)

    // Oportunidades
    oportunidadesCol.listRule = internalStaff
    oportunidadesCol.viewRule = internalStaff
    app.save(oportunidadesCol)

    // Modelos
    modelosCol.listRule = internalStaff
    modelosCol.viewRule = internalStaff
    app.save(modelosCol)

    // Propostas
    propostasCol.listRule = internalStaff
    propostasCol.viewRule = internalStaff
    app.save(propostasCol)

    // Contratos
    contratosCol.listRule = internalStaff
    contratosCol.viewRule = internalStaff
    app.save(contratosCol)

    // Sequencias
    sequenciasCol.listRule = internalStaff
    sequenciasCol.viewRule = internalStaff
    app.save(sequenciasCol)

    // Projetos: terceiro pode apenas visualizar minimamente o projeto vinculado à sua OS (para expand de número/nome),
    // ou deixamos projetos estrito para equipe interna e na OS gravamos número/nome redundantes ou permitimos view do projeto da OS.
    // O requisito diz: "lista das ORDENS DE SERVIÇO designadas a ele (título, projeto associado sem dados sensíveis de cliente além do necessário, prazo, status)".
    // Permitir list/view de projetos somente para internos OU se for o projeto de uma OS designada a ele:
    projetosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro' || (@request.auth.role = 'terceiro' && @collection.ordens_servico.projeto.id ?= id && @collection.ordens_servico.prestador_usuario ?= @request.auth.id))"
    projetosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro' || (@request.auth.role = 'terceiro' && @collection.ordens_servico.projeto.id ?= id && @collection.ordens_servico.prestador_usuario ?= @request.auth.id))"
    app.save(projetosCol)

    // Processos
    processosCol.listRule = internalStaff
    processosCol.viewRule = internalStaff
    app.save(processosCol)

    // Exigencias
    exigenciasCol.listRule = internalStaff
    exigenciasCol.viewRule = internalStaff
    app.save(exigenciasCol)

    // Tarefas
    tarefasCol.listRule = internalStaff
    tarefasCol.viewRule = internalStaff
    app.save(tarefasCol)

    // Documentos
    documentosCol.listRule = internalStaff
    documentosCol.viewRule = internalStaff
    app.save(documentosCol)

    // Links externos
    linksCol.listRule = internalStaff
    linksCol.viewRule = internalStaff
    app.save(linksCol)

    // Atividades
    atividadesCol.listRule = internalStaff
    atividadesCol.viewRule = internalStaff
    app.save(atividadesCol)

    // Anexos
    anexosCol.listRule = internalStaff
    anexosCol.viewRule = internalStaff
    app.save(anexosCol)
  },
  (app) => {
    // Reverter
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const ordensCol = app.findCollectionByNameOrId('ordens_servico')
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'comercial', 'tecnico', 'financeiro']
      app.save(usersCol)
    }

    try {
      ordensCol.removeIndex('idx_ordens_prestador_usuario')
      ordensCol.removeIndex('idx_ordens_status')
      app.save(ordensCol)
    } catch (_) {}
  },
)
