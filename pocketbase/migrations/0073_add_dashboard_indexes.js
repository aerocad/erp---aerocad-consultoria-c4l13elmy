migrate(
  (app) => {
    // 1. Índices para parcelas: status, vencimento e ordenação composta
    const parcelasCol = app.findCollectionByNameOrId('parcelas')
    parcelasCol.addIndex('idx_parcelas_status_venc', false, 'status, vencimento', '')
    app.save(parcelasCol)

    // 2. Índices para ordens_servico: status, prazo
    const ordensCol = app.findCollectionByNameOrId('ordens_servico')
    ordensCol.addIndex('idx_ordens_status_prazo', false, 'status, prazo', '')
    app.save(ordensCol)

    // 3. Índices para exigencias: status, prazo
    const exigenciasCol = app.findCollectionByNameOrId('exigencias')
    exigenciasCol.addIndex('idx_exigencias_status_prazo', false, 'status, prazo', '')
    app.save(exigenciasCol)

    // 4. Índices para projetos: status, created
    const projetosCol = app.findCollectionByNameOrId('projetos')
    projetosCol.addIndex('idx_projetos_status_trilha', false, 'status, trilha', '')
    app.save(projetosCol)
  },
  (app) => {
    try {
      const parcelasCol = app.findCollectionByNameOrId('parcelas')
      parcelasCol.removeIndex('idx_parcelas_status_venc')
      app.save(parcelasCol)
    } catch (_) {}

    try {
      const ordensCol = app.findCollectionByNameOrId('ordens_servico')
      ordensCol.removeIndex('idx_ordens_status_prazo')
      app.save(ordensCol)
    } catch (_) {}

    try {
      const exigenciasCol = app.findCollectionByNameOrId('exigencias')
      exigenciasCol.removeIndex('idx_exigencias_status_prazo')
      app.save(exigenciasCol)
    } catch (_) {}

    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      projetosCol.removeIndex('idx_projetos_status_trilha')
      app.save(projetosCol)
    } catch (_) {}
  },
)
