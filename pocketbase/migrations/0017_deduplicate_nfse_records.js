migrate(
  (app) => {
    // 0017_deduplicate_nfse_records.js
    // Saneamento e deduplicação de NFS-e / parcelas no banco PocketBase
    // Chave única de deduplicação: número da NFS-e + CNPJ do prestador (ou nfse_chave)

    // 1. Carregar todas as parcelas que possuem nfse_chave ou nf_numero
    let parcelas = []
    try {
      parcelas = app.findRecordsByFilter(
        'parcelas',
        "nfse_chave != '' || nf_numero != ''",
        'created',
        5000,
        0,
      )
    } catch (err) {
      console.log('Erro ao buscar parcelas para deduplicacao:', err)
      return
    }

    if (!parcelas || parcelas.length === 0) {
      console.log('Nenhuma parcela com NFS-e encontrada para deduplicacao no banco.')
      return
    }

    // 2. Agrupar parcelas pela chave única de NFS-e
    // Chave padronizada: numero_prestador
    const grupos = new Map()

    for (const p of parcelas) {
      const nfseChave = (p.getString('nfse_chave') || '').trim().toLowerCase()
      const nfNumero = (p.getString('nf_numero') || '').trim().toLowerCase()

      let chave = nfseChave
      if (!chave && nfNumero) {
        let prestador = 'aerocad'
        const rawDados = p.getString('nfse_dados')
        if (rawDados) {
          try {
            const parsed = JSON.parse(rawDados)
            if (parsed && parsed.prestadorCnpjCpf) {
              prestador = String(parsed.prestadorCnpjCpf).replace(/\D/g, '') || 'aerocad'
            }
          } catch (_) {}
        }
        chave = `${nfNumero}_${prestador}`
      }

      if (!chave) continue

      if (!grupos.has(chave)) {
        grupos.set(chave, [])
      }
      grupos.get(chave).push(p)
    }

    // 3. Para cada grupo com duplicatas (> 1 registro):
    // Calcular score de completude e escolher o registro mantido:
    // Critérios:
    // +10 se tem projeto vinculado
    // +5 se tem cliente vinculado
    // +3 se status é paga
    // +2 se tem nfse_dados populado com tomador/valores
    // +1 se tem valor_recebido ou data_pagamento
    // Em caso de empate: o registro mais antigo (menor created / menor id)
    for (const [chave, lista] of grupos.entries()) {
      if (lista.length <= 1) continue

      const scored = lista.map((p) => {
        let score = 0
        if (p.getString('projeto')) score += 10
        if (p.getString('cliente')) score += 5
        if (p.getString('status') === 'paga') score += 3

        const dadosRaw = p.getString('nfse_dados')
        if (dadosRaw && dadosRaw.length > 10) score += 2

        if (p.getString('data_pagamento') || p.getFloat('valor_recebido') > 0) score += 1

        const createdStr = p.getString('created') || ''
        return { record: p, score, createdStr, id: p.id }
      })

      // Ordenar decrescente pelo score; em empate, pelo created mais antigo (crescente)
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.createdStr && b.createdStr) {
          if (a.createdStr < b.createdStr) return -1
          if (a.createdStr > b.createdStr) return 1
        }
        return a.id.localeCompare(b.id)
      })

      const mantido = scored[0].record
      const descartar = scored.slice(1).map((s) => s.record)

      console.log(
        `Deduplicando grupo ${chave}: mantendo parcela ${mantido.id} (score ${scored[0].score}), removendo ${descartar.length} duplicata(s)`,
      )

      // Reatribuir referências se necessário (ex: atividades vinculadas aos registros descartados)
      for (const desc of descartar) {
        try {
          // Reatribuir ou limpar atividades que mencionam a parcela antiga no texto
          const descId = desc.id
          try {
            const atividades = app.findRecordsByFilter(
              'atividades',
              `texto ~ '${descId}'`,
              '',
              100,
              0,
            )
            for (const ativ of atividades) {
              const textoAtual = ativ.getString('texto')
              ativ.set('texto', textoAtual.replace(descId, mantido.id))
              app.save(ativ)
            }
          } catch (_) {}

          // Se a parcela mantida não tem projeto e a descartada tinha, reatribuir
          if (!mantido.getString('projeto') && desc.getString('projeto')) {
            mantido.set('projeto', desc.getString('projeto'))
            if (!mantido.getString('cliente') && desc.getString('cliente')) {
              mantido.set('cliente', desc.getString('cliente'))
            }
            app.save(mantido)
          }

          // Excluir a parcela duplicada
          app.delete(desc)
        } catch (delErr) {
          console.log(`Erro ao excluir parcela duplicada ${desc.id}:`, delErr)
        }
      }
    }
  },
  (_app) => {
    // Reversão no-op: registros excluídos por duplicidade não são recriados
  },
)
