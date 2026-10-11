migrate(
  (app) => {
    const colaboradoresCol = app.findCollectionByNameOrId('colaboradores')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const processosCol = app.findCollectionByNameOrId('processos')

    // 1. Ampliar campos em 'colaboradores' para pessoal técnico e RT
    // - eh_tecnico: bool (indica se é do corpo técnico)
    // - eh_rt: bool (indica se é Responsável Técnico legal habilitado)
    // - registro_profissional_tipo: select (CREA, CAU, CFT, CRQ, OUTRO)
    // - registro_profissional_numero: text
    // - registro_profissional_uf: text
    // - formacao_academica: text
    // - area_atuacao: text
    // - rrt_art_padrao: text
    if (!colaboradoresCol.fields.getByName('eh_tecnico')) {
      colaboradoresCol.fields.add(new BoolField({ name: 'eh_tecnico' }))
    }
    if (!colaboradoresCol.fields.getByName('eh_rt')) {
      colaboradoresCol.fields.add(new BoolField({ name: 'eh_rt' }))
    }
    if (!colaboradoresCol.fields.getByName('registro_profissional_tipo')) {
      colaboradoresCol.fields.add(
        new SelectField({
          name: 'registro_profissional_tipo',
          values: ['CREA', 'CAU', 'CFT', 'CRQ', 'OUTRO'],
          maxSelect: 1,
        }),
      )
    }
    if (!colaboradoresCol.fields.getByName('registro_profissional_numero')) {
      colaboradoresCol.fields.add(new TextField({ name: 'registro_profissional_numero', max: 50 }))
    }
    if (!colaboradoresCol.fields.getByName('registro_profissional_uf')) {
      colaboradoresCol.fields.add(new TextField({ name: 'registro_profissional_uf', max: 2 }))
    }
    if (!colaboradoresCol.fields.getByName('formacao_academica')) {
      colaboradoresCol.fields.add(new TextField({ name: 'formacao_academica', max: 200 }))
    }
    if (!colaboradoresCol.fields.getByName('area_atuacao')) {
      colaboradoresCol.fields.add(new TextField({ name: 'area_atuacao', max: 200 }))
    }
    if (!colaboradoresCol.fields.getByName('rrt_art_padrao')) {
      colaboradoresCol.fields.add(new TextField({ name: 'rrt_art_padrao', max: 100 }))
    }
    colaboradoresCol.addIndex('idx_colaboradores_eh_tecnico', false, 'eh_tecnico', '')
    colaboradoresCol.addIndex('idx_colaboradores_eh_rt', false, 'eh_rt', '')
    app.save(colaboradoresCol)

    // 2. Ampliar 'projetos' com equipe técnica: coordenador, analista, rts_colaboradores (relação múltiplos)
    // e rts_usuarios (relação múltiplos com users para regras de permissão)
    if (!projetosCol.fields.getByName('coordenador_colaborador')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'coordenador_colaborador',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!projetosCol.fields.getByName('analista_colaborador')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'analista_colaborador',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!projetosCol.fields.getByName('rts_colaboradores')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'rts_colaboradores',
          collectionId: colaboradoresCol.id,
          maxSelect: 20,
        }),
      )
    }
    if (!projetosCol.fields.getByName('rts_usuarios')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'rts_usuarios',
          collectionId: usersCol.id,
          maxSelect: 20,
        }),
      )
    }
    projetosCol.addIndex('idx_projetos_coordenador', false, 'coordenador_colaborador', '')
    projetosCol.addIndex('idx_projetos_analista', false, 'analista_colaborador', '')
    app.save(projetosCol)

    // 3. Ampliar 'processos' com equipe técnica do processo:
    // coordenador_colaborador, analista_colaborador, rts_colaboradores, rts_usuarios
    if (!processosCol.fields.getByName('coordenador_colaborador')) {
      processosCol.fields.add(
        new RelationField({
          name: 'coordenador_colaborador',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!processosCol.fields.getByName('analista_colaborador')) {
      processosCol.fields.add(
        new RelationField({
          name: 'analista_colaborador',
          collectionId: colaboradoresCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!processosCol.fields.getByName('rts_colaboradores')) {
      processosCol.fields.add(
        new RelationField({
          name: 'rts_colaboradores',
          collectionId: colaboradoresCol.id,
          maxSelect: 20,
        }),
      )
    }
    if (!processosCol.fields.getByName('rts_usuarios')) {
      processosCol.fields.add(
        new RelationField({
          name: 'rts_usuarios',
          collectionId: usersCol.id,
          maxSelect: 20,
        }),
      )
    }
    processosCol.addIndex('idx_processos_coordenador', false, 'coordenador_colaborador', '')
    processosCol.addIndex('idx_processos_analista', false, 'analista_colaborador', '')
    app.save(processosCol)

    // 4. Semeadura de colaboradores técnicos iniciais a partir dos usuários existentes se a coleção colaboradores estiver vazia
    // Isso garante que haja opções imediatas de Coordenador, Analista e RT para seleção!
    try {
      const totalColab = app.countRecords('colaboradores')
      if (totalColab === 0) {
        // Cleyton Saraiva (Admin / RT Engenheiro)
        try {
          const cleytonUser = app.findFirstRecordByData(
            'users',
            'email',
            'cleytonsaraiva@aerocad.com.br',
          )
          const c1 = new Record(colaboradoresCol)
          c1.set('nome_completo', 'Cleyton Saraiva')
          c1.set('cpf_cnpj', '000.000.000-01')
          c1.set('cargo', 'Diretor Técnico / Engº Cartógrafo')
          c1.set('funcao', 'Responsável Técnico Principal')
          c1.set('regime_contratacao', 'pj')
          c1.set('usuario_sistema', cleytonUser.id)
          c1.set('email', 'cleytonsaraiva@aerocad.com.br')
          c1.set('telefone', '(61) 99999-0001')
          c1.set('data_admissao', '2020-01-01 12:00:00.000Z')
          c1.set('situacao', 'ativo')
          c1.set('eh_tecnico', true)
          c1.set('eh_rt', true)
          c1.set('registro_profissional_tipo', 'CREA')
          c1.set('registro_profissional_numero', '12345/D')
          c1.set('registro_profissional_uf', 'DF')
          c1.set('formacao_academica', 'Engenharia Cartográfica e de Agrimensura')
          c1.set('area_atuacao', 'Espaço Aéreo, OPEA, PBZPA e Infraestrutura Aeroportuária')
          c1.set('criado_por', cleytonUser.id)
          app.save(c1)
        } catch (_) {}

        // Rafael Duarte (Técnico / Analista)
        try {
          const rafaelUser = app.findFirstRecordByData(
            'users',
            'email',
            'rafaelduarte@aerocad.com.br',
          )
          const c2 = new Record(colaboradoresCol)
          c2.set('nome_completo', 'Rafael Duarte')
          c2.set('cpf_cnpj', '000.000.000-02')
          c2.set('cargo', 'Analista de Projetos Sênior')
          c2.set('funcao', 'Elaboração Técnica & Processamento SIG/CAD')
          c2.set('regime_contratacao', 'pf_clt')
          c2.set('usuario_sistema', rafaelUser.id)
          c2.set('email', 'rafaelduarte@aerocad.com.br')
          c2.set('telefone', '(61) 99999-0002')
          c2.set('data_admissao', '2021-03-15 12:00:00.000Z')
          c2.set('situacao', 'ativo')
          c2.set('eh_tecnico', true)
          c2.set('eh_rt', true)
          c2.set('registro_profissional_tipo', 'CREA')
          c2.set('registro_profissional_numero', '67890/D')
          c2.set('registro_profissional_uf', 'DF')
          c2.set('formacao_academica', 'Engenharia Civil / Especialista Aeronáutico')
          c2.set('area_atuacao', 'Plantas de Zona de Proteção, Planimetria e Requerimentos DECEA')
          app.save(c2)
        } catch (_) {}

        // Jaqueline Mota (Comercial / Coordenadora)
        try {
          const jaquelineUser = app.findFirstRecordByData(
            'users',
            'email',
            'jaquelinemota@aerocad.com.br',
          )
          const c3 = new Record(colaboradoresCol)
          c3.set('nome_completo', 'Jaqueline Mota')
          c3.set('cpf_cnpj', '000.000.000-03')
          c3.set('cargo', 'Coordenadora de Atendimento e Contratos')
          c3.set('funcao', 'Coordenação Operacional & Interface com Clientes')
          c3.set('regime_contratacao', 'pf_clt')
          c3.set('usuario_sistema', jaquelineUser.id)
          c3.set('email', 'jaquelinemota@aerocad.com.br')
          c3.set('telefone', '(61) 99999-0003')
          c3.set('data_admissao', '2021-06-01 12:00:00.000Z')
          c3.set('situacao', 'ativo')
          c3.set('eh_tecnico', false)
          c3.set('eh_rt', false)
          app.save(c3)
        } catch (_) {}

        // Paula Ribeiro (Financeiro)
        try {
          const paulaUser = app.findFirstRecordByData(
            'users',
            'email',
            'paularibeiro@aerocad.com.br',
          )
          const c4 = new Record(colaboradoresCol)
          c4.set('nome_completo', 'Paula Ribeiro')
          c4.set('cpf_cnpj', '000.000.000-04')
          c4.set('cargo', 'Gestora Financeira')
          c4.set('funcao', 'Faturamento & Conciliação NFS-e')
          c4.set('regime_contratacao', 'pf_clt')
          c4.set('usuario_sistema', paulaUser.id)
          c4.set('email', 'paularibeiro@aerocad.com.br')
          c4.set('telefone', '(61) 99999-0004')
          c4.set('data_admissao', '2022-01-10 12:00:00.000Z')
          c4.set('situacao', 'ativo')
          c4.set('eh_tecnico', false)
          c4.set('eh_rt', false)
          app.save(c4)
        } catch (_) {}
      }
    } catch (seedErr) {
      console.warn('Aviso ao semear colaboradores técnicos:', seedErr)
    }

    // 5. Atualizar regras de API para anexos e documentos de forma a aceitar tanto o responsavel_tecnico legado quanto rts_usuarios
    const anexosCol = app.findCollectionByNameOrId('anexos')
    const staffRead =
      "@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'"
    const tecnicoAllowedExt =
      "(extensao = 'docx' || extensao = 'pdf' || extensao = 'dwg' || extensao = 'dxf')"
    const tecnicoProjectCompetence =
      '(projeto.responsavel_tecnico = @request.auth.id || projeto.rts_usuarios ?= @request.auth.id || processo.projeto.responsavel_tecnico = @request.auth.id || processo.projeto.rts_usuarios ?= @request.auth.id || processo.rts_usuarios ?= @request.auth.id || usuario = @request.auth.id)'
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
    app.save(anexosCol)

    const documentosCol = app.findCollectionByNameOrId('documentos')
    const tecnicoDocCompetence =
      "(@request.auth.role = 'tecnico' && (projeto.responsavel_tecnico = @request.auth.id || projeto.rts_usuarios ?= @request.auth.id || processo.projeto.responsavel_tecnico = @request.auth.id || processo.projeto.rts_usuarios ?= @request.auth.id || processo.rts_usuarios ?= @request.auth.id))"

    documentosCol.listRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoDocCompetence + ')'
    documentosCol.viewRule =
      "@request.auth.id != '' && (" + staffRead + ' || ' + tecnicoDocCompetence + ')'
    app.save(documentosCol)
  },
  (app) => {
    // Reverter campos se necessário
    try {
      const colaboradoresCol = app.findCollectionByNameOrId('colaboradores')
      const fieldsToRemove = [
        'eh_tecnico',
        'eh_rt',
        'registro_profissional_tipo',
        'registro_profissional_numero',
        'registro_profissional_uf',
        'formacao_academica',
        'area_atuacao',
        'rrt_art_padrao',
      ]
      for (const f of fieldsToRemove) {
        try {
          colaboradoresCol.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(colaboradoresCol)
    } catch (_) {}

    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      const pFields = [
        'coordenador_colaborador',
        'analista_colaborador',
        'rts_colaboradores',
        'rts_usuarios',
      ]
      for (const f of pFields) {
        try {
          projetosCol.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(projetosCol)
    } catch (_) {}

    try {
      const processosCol = app.findCollectionByNameOrId('processos')
      const prFields = [
        'coordenador_colaborador',
        'analista_colaborador',
        'rts_colaboradores',
        'rts_usuarios',
      ]
      for (const f of prFields) {
        try {
          processosCol.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(processosCol)
    } catch (_) {}
  },
)
