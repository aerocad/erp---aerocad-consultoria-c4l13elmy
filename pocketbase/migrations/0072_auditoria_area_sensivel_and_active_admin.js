/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0072:
 * 1. Garante que administradores principais estejam ativos (ativo = true)
 * 2. Atualiza createRule de 'auditoria_operacoes_bloco' para permitir registro de auditoria
 *    por qualquer usuário autenticado que receba liberação de área sensível por um administrador
 */
migrate(
  (app) => {
    // 1. Ativar administradores existentes
    try {
      const admins = app.findRecordsByFilter(
        '_pb_users_auth_',
        'role = "admin" || roles ~ "admin"',
        '',
        50,
        0,
      )
      for (const admin of admins) {
        if (!admin.getBool('ativo')) {
          admin.set('ativo', true)
          app.save(admin)
        }
      }
    } catch (errAdmins) {
      console.log('Aviso ao ativar administradores na migration 0072:', errAdmins)
    }

    // 2. Permitir que qualquer usuário autenticado crie registro de auditoria
    // (ex.: log de liberação de área sensível concedida por administrador)
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_operacoes_bloco')
      auditCol.createRule = "@request.auth.id != ''"
      app.save(auditCol)
    } catch (errCol) {
      console.log('Aviso ao atualizar createRule de auditoria_operacoes_bloco:', errCol)
    }
  },
  (app) => {
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_operacoes_bloco')
      auditCol.createRule = "@request.auth.role = 'admin' || @request.auth.role = 'financeiro'"
      app.save(auditCol)
    } catch (_) {}
  },
)
