/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0070:
 * Torna opcionais (required = false) os campos relacionais que apontam para a coleção 'users',
 * permitindo que a exclusão definitiva de contas de usuário (ex: colaboradores desligados,
 * contas inativas) seja concluída sem o erro de integridade referencial do PocketBase:
 * "Failed to delete record. Make sure that the record is not part of a required relation reference."
 *
 * Preserva integralmente o histórico de negócio (mensagens trocadas, anexos, atividades,
 * tarefas, logs de auditoria e links externos criados).
 */
migrate(
  (app) => {
    const collectionsToUpdate = [
      { name: 'mensagens', fields: ['remetente', 'destinatario'] },
      { name: 'atividades', fields: ['usuario'] },
      { name: 'anexos', fields: ['usuario'] },
      { name: 'links_externos', fields: ['criado_por'] },
      { name: 'tarefas', fields: ['responsavel'] },
      { name: 'auditoria_operacoes_bloco', fields: ['usuario'] },
      { name: 'alertas_dispensados', fields: ['usuario'] },
    ]

    for (const item of collectionsToUpdate) {
      try {
        const col = app.findCollectionByNameOrId(item.name)
        let modified = false
        for (const fieldName of item.fields) {
          const field = col.fields.getByName(fieldName)
          if (field && field.required) {
            field.required = false
            modified = true
          }
        }
        if (modified) {
          app.save(col)
          console.log(`Migration 0070: Campos opcionais atualizados em '${item.name}'`)
        }
      } catch (err) {
        console.log(`Aviso ao atualizar coleção '${item.name}' na migration 0070:`, err)
      }
    }
  },
  (app) => {
    const collectionsToRevert = [
      { name: 'mensagens', fields: ['remetente', 'destinatario'] },
      { name: 'atividades', fields: ['usuario'] },
      { name: 'anexos', fields: ['usuario'] },
      { name: 'links_externos', fields: ['criado_por'] },
      { name: 'tarefas', fields: ['responsavel'] },
      { name: 'auditoria_operacoes_bloco', fields: ['usuario'] },
      { name: 'alertas_dispensados', fields: ['usuario'] },
    ]
    for (const item of collectionsToRevert) {
      try {
        const col = app.findCollectionByNameOrId(item.name)
        let modified = false
        for (const fieldName of item.fields) {
          const field = col.fields.getByName(fieldName)
          if (field && !field.required) {
            field.required = true
            modified = true
          }
        }
        if (modified) {
          app.save(col)
        }
      } catch (_) {}
    }
  },
)
