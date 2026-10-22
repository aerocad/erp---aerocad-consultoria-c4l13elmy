migrate(
  (app) => {
    // 1. Atualizar collection contas_pagar
    if (app.hasTable('contas_pagar')) {
      const colCp = app.findCollectionByNameOrId('contas_pagar')
      const empCol = app.hasTable('emprestimos_financiamentos')
        ? app.findCollectionByNameOrId('emprestimos_financiamentos')
        : null
      const empParcCol = app.hasTable('emprestimos_parcelas')
        ? app.findCollectionByNameOrId('emprestimos_parcelas')
        : null

      // Expandir valores permitidos de forma_pagamento
      const formaPagtoField = colCp.fields.getByName('forma_pagamento')
      if (formaPagtoField) {
        formaPagtoField.values = [
          'pix',
          'ted_doc',
          'boleto',
          'cartao_credito',
          'cartao_debito',
          'dinheiro',
          'debito_automatico',
          'outro',
        ]
        formaPagtoField.maxSelect = 1
      }

      // Adicionar relação opcional com emprestimos_financiamentos
      if (!colCp.fields.getByName('emprestimo_contrato_id')) {
        if (empCol) {
          colCp.fields.add(
            new RelationField({
              name: 'emprestimo_contrato_id',
              collectionId: empCol.id,
              required: false,
              maxSelect: 1,
            }),
          )
        } else {
          colCp.fields.add(
            new TextField({
              name: 'emprestimo_contrato_id',
              required: false,
              max: 50,
            }),
          )
        }
      }

      // Adicionar relação opcional com emprestimos_parcelas
      if (!colCp.fields.getByName('emprestimo_parcela_id')) {
        if (empParcCol) {
          colCp.fields.add(
            new RelationField({
              name: 'emprestimo_parcela_id',
              collectionId: empParcCol.id,
              required: false,
              maxSelect: 1,
            }),
          )
        } else {
          colCp.fields.add(
            new TextField({
              name: 'emprestimo_parcela_id',
              required: false,
              max: 50,
            }),
          )
        }
      }

      app.save(colCp)
      console.log(
        "Migration 0079: 'contas_pagar' atualizada com debito_automatico e vinculos de emprestimo.",
      )
    }
  },
  (app) => {
    if (app.hasTable('contas_pagar')) {
      const colCp = app.findCollectionByNameOrId('contas_pagar')
      const formaPagtoField = colCp.fields.getByName('forma_pagamento')
      if (formaPagtoField) {
        formaPagtoField.values = [
          'pix',
          'ted_doc',
          'boleto',
          'cartao_credito',
          'cartao_debito',
          'dinheiro',
          'outro',
        ]
        formaPagtoField.maxSelect = 1
      }
      if (colCp.fields.getByName('emprestimo_contrato_id')) {
        colCp.fields.removeByName('emprestimo_contrato_id')
      }
      if (colCp.fields.getByName('emprestimo_parcela_id')) {
        colCp.fields.removeByName('emprestimo_parcela_id')
      }
      app.save(colCp)
    }
  },
)
