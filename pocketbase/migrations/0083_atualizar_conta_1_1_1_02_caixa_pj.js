/**
 * Migration 0083: Atualização da conta contábil 1.1.1.02 para Caixa Econômica Federal PJ
 * - Atualiza na coleção plano_contas_customizadas a conta 1.1.1.02 com nome e descrição corretos:
 *   "Caixa Econômica Federal PJ (Conta Corrente)"
 * - Sincroniza lançamentos vinculados em extratos_transacoes, contas_pagar, contas_receber e parcelas
 */

/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let colPlano = null
    try {
      colPlano = app.findCollectionByNameOrId('plano_contas_customizadas')
    } catch (e) {
      console.log('Migration 0083: Coleção plano_contas_customizadas não encontrada:', e.message)
      return
    }

    try {
      let rec = null
      try {
        rec = app.findFirstRecordByFilter('plano_contas_customizadas', 'codigo = "1.1.1.02"')
      } catch (_) {
        rec = null
      }

      if (rec) {
        rec.set('nome', 'Caixa Econômica Federal PJ (Conta Corrente)')
        rec.set(
          'descricao',
          'Segunda conta corrente operacional PJ da AEROCAD na Caixa Econômica Federal',
        )
        rec.set('ativo', true)
        app.save(rec)
        console.log('Migration 0083: Conta 1.1.1.02 atualizada para Caixa Econômica Federal PJ.')
      } else {
        const novo = new Record(colPlano)
        novo.set('codigo', '1.1.1.02')
        novo.set('nome', 'Caixa Econômica Federal PJ (Conta Corrente)')
        novo.set('natureza', 'ativo')
        novo.set('grupo', 'Ativo Circulante / Disponibilidades')
        novo.set(
          'descricao',
          'Segunda conta corrente operacional PJ da AEROCAD na Caixa Econômica Federal',
        )
        novo.set('ativo', true)
        app.save(novo)
        console.log('Migration 0083: Conta 1.1.1.02 criada para Caixa Econômica Federal PJ.')
      }
    } catch (err) {
      console.log('Migration 0083: Erro ao sincronizar plano_contas_customizadas:', err.message)
    }

    // Sincronizar registros vinculados que referenciem o código 1.1.1.02 ou o nome anterior com Itaú
    const colecoes = ['extratos_transacoes', 'contas_pagar', 'contas_receber', 'parcelas']
    for (const colNome of colecoes) {
      try {
        const registros = app.findRecordsByFilter(
          colNome,
          'plano_contas_codigo = "1.1.1.02" || plano_contas_nome ~ "Itaú" || plano_contas_nome ~ "Itau"',
          '',
          200,
          0,
        )
        for (const r of registros) {
          const nomeAtual = r.getString('plano_contas_nome') || ''
          const codAtual = r.getString('plano_contas_codigo') || ''
          if (
            codAtual === '1.1.1.02' ||
            nomeAtual.toLowerCase().includes('itau') ||
            nomeAtual.toLowerCase().includes('itaú')
          ) {
            r.set('plano_contas_codigo', '1.1.1.02')
            r.set('plano_contas_nome', 'Caixa Econômica Federal PJ (Conta Corrente)')
            app.save(r)
          }
        }
      } catch (err) {
        console.log(`Migration 0083: Erro ao sincronizar ${colNome}:`, err.message)
      }
    }

    console.log('Migration 0083 concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
