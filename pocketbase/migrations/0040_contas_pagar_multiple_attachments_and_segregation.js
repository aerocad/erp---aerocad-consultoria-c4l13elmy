/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const cpCol = app.findCollectionByNameOrId('contas_pagar')

    // 1. Alterar comprovante para suportar múltiplos arquivos (maxSelect: 15, maxSize: 30MB)
    const comprovanteField = cpCol.fields.getByName('comprovante')
    if (comprovanteField) {
      comprovanteField.maxSelect = 15
      comprovanteField.maxSize = 31457280 // 30 MB
    }

    // 2. Adicionar campo json comprovantes_metadados para armazenar segregação e tipo de cada anexo
    // Exemplo do item: { file: "arquivo_xyz.pdf", tipo: "boleto", nome_original: "Boleto-01.pdf", tamanho: 102400 }
    if (!cpCol.fields.getByName('comprovantes_metadados')) {
      cpCol.fields.add(
        new JSONField({
          name: 'comprovantes_metadados',
          maxSize: 50000,
        }),
      )
    }

    app.save(cpCol)
  },
  (app) => {
    try {
      const cpCol = app.findCollectionByNameOrId('contas_pagar')
      if (cpCol.fields.getByName('comprovantes_metadados')) {
        cpCol.fields.removeByName('comprovantes_metadados')
      }
      const comprovanteField = cpCol.fields.getByName('comprovante')
      if (comprovanteField) {
        comprovanteField.maxSelect = 1
      }
      app.save(cpCol)
    } catch (_) {}
  },
)
