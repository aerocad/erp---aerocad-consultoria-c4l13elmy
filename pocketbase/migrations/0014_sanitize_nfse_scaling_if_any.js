migrate(
  (app) => {
    // Migração de saneamento defensivo para valores de parcelas com nfse_chave ou nfse_dados
    // Caso alguma parcela tenha sido gravada com fator 100x maior (ex: valor_recebido > 100000 e valor normal ~1000)
    // Se não houver registros afetados, a consulta apenas verifica e conclui com segurança.
    const parcelas = app.findRecordsByFilter('parcelas', "nfse_chave != ''", '', 500, 0)
    for (const p of parcelas) {
      let mudou = false
      const nfseDadosRaw = p.getString('nfse_dados')
      if (nfseDadosRaw) {
        try {
          const parsed = JSON.parse(nfseDadosRaw)
          if (parsed && typeof parsed === 'object') {
            // Se o valorBruto no JSON estiver 100x maior que a parcela de referência
            if (p.getFloat('valor') > 0 && parsed.valorBruto >= p.getFloat('valor') * 90) {
              parsed.valorBruto = parsed.valorBruto / 100
              if (parsed.valorLiquido) parsed.valorLiquido = parsed.valorLiquido / 100
              p.set('nfse_dados', parsed)
              mudou = true
            }
          }
        } catch (_) {
          // ignora erro de parse em dados legados
        }
      }

      // Se valor_recebido foi gravado com fator 100x maior que valor da parcela
      const vRec = p.getFloat('valor_recebido')
      const vNominal = p.getFloat('valor')
      if (vNominal > 0 && vRec >= vNominal * 90) {
        p.set('valor_recebido', vRec / 100)
        mudou = true
      }

      if (mudou) {
        app.save(p)
      }
    }
  },
  (_app) => {
    // Reversão no-op
  },
)
