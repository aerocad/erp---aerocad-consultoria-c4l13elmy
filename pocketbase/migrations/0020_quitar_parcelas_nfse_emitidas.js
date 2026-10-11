migrate(
  (app) => {
    // 0020_quitar_parcelas_nfse_emitidas.js
    // Pedido do usuário: "todas as notas que foram emitidas já foram pagas, excluir pendências.. permitir fazer isso manualmente se necessário"
    // Atualiza todas as parcelas com NFS-e emitida (nf_numero != '' ou nfse_chave != '')
    // que estejam com status != 'paga' ou data_pagamento vazia.
    // Preenche:
    // - status = 'paga'
    // - data_pagamento = dataEmissao (se houver em nfse_dados ou data_faturamento) ou hoje
    // - valor_recebido = valor líquido (se houver em nfse_dados) ou valor da parcela
    // - status_pagamento = 'Recebido (NFS-e)'
    // Não toca em parcelas sem NFS-e.

    let parcelas = []
    try {
      parcelas = app.findRecordsByFilter(
        'parcelas',
        "nf_numero != '' || nfse_chave != ''",
        'created',
        10000,
        0,
      )
    } catch (err) {
      console.log('Erro ao buscar parcelas para quitação:', err)
      return
    }

    if (!parcelas || parcelas.length === 0) {
      console.log('Nenhuma parcela com NFS-e encontrada para quitação.')
      return
    }

    let quitadasCount = 0
    const hojeIso = new Date().toISOString().slice(0, 10) + ' 12:00:00.000Z'

    for (const p of parcelas) {
      const statusAtual = p.getString('status')
      const dataPagamentoAtual = p.getString('data_pagamento')

      // Determinar a data de pagamento adequada
      let dataPagamentoNova = dataPagamentoAtual
      let valorRecebidoNovo = p.getFloat('valor_recebido')
      const valorTotal = p.getFloat('valor')

      let dataEmissaoNf = ''
      let valorLiquidoNf = 0

      const rawDados = p.getString('nfse_dados')
      if (rawDados) {
        try {
          const parsed = JSON.parse(rawDados)
          if (parsed) {
            if (parsed.dataEmissao) {
              dataEmissaoNf = String(parsed.dataEmissao).slice(0, 10)
            }
            if (parsed.dataRecebimento) {
              dataEmissaoNf = String(parsed.dataRecebimento).slice(0, 10)
            }
            if (parsed.valorLiquido && Number(parsed.valorLiquido) > 0) {
              valorLiquidoNf = Number(parsed.valorLiquido)
            }
          }
        } catch (_) {}
      }

      if (!dataPagamentoNova) {
        const dataFat = p.getString('data_faturamento')
        if (dataFat) {
          dataPagamentoNova = dataFat.slice(0, 10) + ' 12:00:00.000Z'
        } else if (dataEmissaoNf) {
          dataPagamentoNova = dataEmissaoNf + ' 12:00:00.000Z'
        } else {
          const venc = p.getString('vencimento')
          if (venc) {
            dataPagamentoNova = venc.slice(0, 10) + ' 12:00:00.000Z'
          } else {
            dataPagamentoNova = hojeIso
          }
        }
      }

      if (!valorRecebidoNovo || valorRecebidoNovo <= 0) {
        valorRecebidoNovo = valorLiquidoNf > 0 ? valorLiquidoNf : valorTotal
      }

      p.set('status', 'paga')
      p.set('data_pagamento', dataPagamentoNova)
      p.set('valor_recebido', valorRecebidoNovo)
      p.set('status_pagamento', 'Recebido (NFS-e)')

      try {
        app.save(p)
        quitadasCount++
      } catch (saveErr) {
        console.log(`Erro ao quitar parcela ${p.id}:`, saveErr)
      }
    }

    console.log(`Migração 0020 concluída: ${quitadasCount} parcelas com NFS-e marcadas como pagas.`)
  },
  (_app) => {
    // Reversão no-op
  },
)
