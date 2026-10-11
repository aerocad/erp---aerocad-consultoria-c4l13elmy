migrate(
  (app) => {
    // 1. Atualizar regras da coleção 'anexos'
    // - Admin, comercial e financeiro mantêm acesso irrestrito de leitura e escrita
    // - Técnico e terceiro:
    //    Leitura apenas de extensões técnicas (.docx, .pdf, .dwg, .dxf)
    //    E apenas de processos/projetos de sua competência (onde é responsavel_tecnico no projeto vinculado, ou tem OS atribuída no caso de terceiro)
    //    Escrita (create): apenas extensões técnicas (.docx, .pdf, .dwg, .dxf)
    const anexosCol = app.findCollectionByNameOrId('anexos')

    const staffRead =
      "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"
    const tecnicoAllowedExt =
      "(extensao = 'docx' || extensao = 'pdf' || extensao = 'dwg' || extensao = 'dxf')"
    const tecnicoProjectCompetence =
      '(projeto.responsavel_tecnico = @request.auth.id || processo.projeto.responsavel_tecnico = @request.auth.id || usuario = @request.auth.id)'
    const terceiroProjectCompetence =
      '(@collection.ordens_servico.projeto ?= projeto && @collection.ordens_servico.prestador_usuario ?= @request.auth.id)'

    const tecnicoRead =
      "(@request.auth.role = 'tecnico' && " +
      tecnicoAllowedExt +
      ' && ' +
      tecnicoProjectCompetence +
      ')'
    const terceiroRead =
      "(@request.auth.role = 'terceiro' && " +
      tecnicoAllowedExt +
      ' && ' +
      terceiroProjectCompetence +
      ')'

    anexosCol.listRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoRead + ' || ' + terceiroRead + ')'
    anexosCol.viewRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoRead + ' || ' + terceiroRead + ')'

    // Create: admin/comercial/financeiro qualquer anexo permitido pelo sistema.
    // Tecnico/terceiro: apenas se a extensão for técnica (docx, pdf, dwg, dxf)
    const bodyAllowedExt =
      "(@request.body.extensao = 'docx' || @request.body.extensao = 'pdf' || @request.body.extensao = 'dwg' || @request.body.extensao = 'dxf')"
    anexosCol.createRule =
      "@request.auth.id != '' && (" +
      staffRead +
      " || ((@request.auth.role = 'tecnico' || @request.auth.role = 'terceiro') && " +
      bodyAllowedExt +
      '))'

    app.save(anexosCol)

    // 2. Atualizar regras da coleção 'documentos' (documentos gerados no sistema)
    // - Admin, comercial e financeiro mantêm leitura total
    // - Técnico: apenas documentos vinculados a projetos/processos sob sua responsabilidade técnica
    const documentosCol = app.findCollectionByNameOrId('documentos')
    const tecnicoDocCompetence =
      "(@request.auth.role = 'tecnico' && (projeto.responsavel_tecnico = @request.auth.id || processo.projeto.responsavel_tecnico = @request.auth.id))"

    documentosCol.listRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoDocCompetence + ')'
    documentosCol.viewRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoDocCompetence + ')'
    app.save(documentosCol)
  },
  (app) => {
    try {
      const anexosCol = app.findCollectionByNameOrId('anexos')
      const internalStaff =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro')"
      anexosCol.listRule = internalStaff
      anexosCol.viewRule = internalStaff
      anexosCol.createRule =
        "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'tecnico' || @request.auth.role = 'financeiro'"
      app.save(anexosCol)

      const documentosCol = app.findCollectionByNameOrId('documentos')
      documentosCol.listRule = internalStaff
      documentosCol.viewRule = internalStaff
      app.save(documentosCol)
    } catch (_) {}
  },
)
