/**
 * Migration 0076: Alinhar observações de reclassificação contábil com a conta real aplicada.
 *
 * Corrige transações em extratos_transacoes e contas_pagar onde o campo 'observacoes' cita
 * um código contábil diferente de 'plano_contas_codigo' (ex: observação citando 2.2.1 enquanto
 * a transação está efetivamente classificada na conta 2.1.6).
 *
 * Idempotente: atualiza apenas registros que possuem desalinhamento e regenera o texto
 * com o nome e código reais da conta cadastrada.
 */
migrate(
  (app) => {
    // 1. Corrigir extratos_transacoes com observação citando código incompatível
    if (app.hasTable('extratos_transacoes')) {
      try {
        const registros = app.findRecordsByFilter(
          'extratos_transacoes',
          "observacoes ~ 'Reclassificado para' && plano_contas_codigo != ''",
          '',
          500,
          0,
        )

        let totalCorrigidosExtrato = 0
        for (const r of registros) {
          const obs = r.getString('observacoes')
          const cod = r.getString('plano_contas_codigo')
          const nome = r.getString('plano_contas_nome') || 'Conta Contábil'

          // Verifica se a observação cita expressamente "(código X.X.X)" diferente de cod
          const matchCodigo = obs.match(/código\s+([0-9\.]+)/i)
          if (matchCodigo && matchCodigo[1] && matchCodigo[1] !== cod) {
            const novaObs = `Reclassificado para ${nome} (código ${cod})`
            r.set('observacoes', novaObs)
            app.save(r)
            totalCorrigidosExtrato++
          }
        }
        console.log(
          `Migration 0076: ${totalCorrigidosExtrato} registro(s) de extratos_transacoes tiveram observações alinhadas com plano_contas_codigo.`,
        )
      } catch (err) {
        console.warn('Aviso ao corrigir observações em extratos_transacoes:', err)
      }
    }

    // 2. Corrigir contas_pagar caso haja registros semelhantes
    if (app.hasTable('contas_pagar')) {
      try {
        const registrosCp = app.findRecordsByFilter(
          'contas_pagar',
          "observacoes ~ 'Reclassificado para' && plano_contas_codigo != ''",
          '',
          500,
          0,
        )

        let totalCorrigidosCp = 0
        for (const r of registrosCp) {
          const obs = r.getString('observacoes')
          const cod = r.getString('plano_contas_codigo')
          const nome = r.getString('plano_contas_nome') || 'Conta Contábil'

          const matchCodigo = obs.match(/código\s+([0-9\.]+)/i)
          if (matchCodigo && matchCodigo[1] && matchCodigo[1] !== cod) {
            const novaObs = `Reclassificado para ${nome} (código ${cod})`
            r.set('observacoes', novaObs)
            app.save(r)
            totalCorrigidosCp++
          }
        }
        console.log(
          `Migration 0076: ${totalCorrigidosCp} registro(s) de contas_pagar tiveram observações alinhadas.`,
        )
      } catch (errCp) {
        console.warn('Aviso ao corrigir observações em contas_pagar:', errCp)
      }
    }
  },
  (app) => {
    // Reversão não é necessária pois trata-se de saneamento de consistência textual idempotente
  },
)
