migrate(
  (app) => {
    // 0019_deduplicate_nfse_records.js
    // Saneamento e deduplicação de NFS-e / parcelas duplicadas no banco PocketBase
    // Regra: para cada grupo duplicado (nº NFS-e + CNPJ prestador), manter apenas UM registro (o mais completo).
    // Reatribuir referências filhas (atividades vinculadas) para a nota mantida antes de excluir.
    // NÃO tocar em valores nem em notas não duplicadas.

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
      console.log('Erro ao buscar parcelas para deduplicacao:', err)
      return
    }

    if (!parcelas || parcelas.length === 0) {
      console.log('Nenhuma parcela encontrada para deduplicacao.')
      return
    }

    const totalInicial = parcelas.length

    // Agrupar parcelas pela chave única normalizada: numeroNf_cnpjPrestador
    const grupos = new Map()

    for (const p of parcelas) {
      const nfNumero = (p.getString('nf_numero') || '').trim().replace(/^0+/, '')
      const nfseChave = (p.getString('nfse_chave') || '').trim()

      let prestador = ''
      const rawDados = p.getString('nfse_dados')
      if (rawDados) {
        try {
          const parsed = JSON.parse(rawDados)
          if (parsed && parsed.prestadorCnpjCpf) {
            prestador = String(parsed.prestadorCnpjCpf).replace(/\D/g, '')
          }
        } catch (_) {}
      }

      // Se não encontrou prestador no JSON, tentar extrair da nfse_chave (formato NUM_CNPJ)
      if (!prestador && nfseChave.includes('_')) {
        const partes = nfseChave.split('_')
        if (partes.length >= 2 && partes[1]) {
          prestador = partes[1].replace(/\D/g, '')
        }
      }

      // Se ainda não tiver prestador, usa fallback padronizado 'aerocad'
      if (!prestador) prestador = 'aerocad'

      // Se nfNumero estiver em branco mas tiver nfse_chave, deduz do início da chave ou usa a chave
      const numFinal = nfNumero || nfseChave.split('_')[0] || nfseChave
      if (!numFinal) continue

      const chaveComposta = `${numFinal.toLowerCase()}_${prestador.toLowerCase()}`

      if (!grupos.has(chaveComposta)) {
        grupos.set(chaveComposta, [])
      }
      grupos.get(chaveComposta).push(p)
    }

    let totalGruposDuplicados = 0
    let totalNotasRemovidas = 0

    // Para cada grupo com mais de 1 registro:
    for (const [chave, lista] of grupos.entries()) {
      if (lista.length <= 1) continue

      totalGruposDuplicados++

      // Calcular score de completude para cada cópia
      // Prioridade:
      // 1. Tem projeto vinculado (+100)
      // 2. Tem cliente vinculado (+50)
      // 3. Mais campos preenchidos / dados de tomador e impostos (+score proporcional)
      // 4. Data de recebimento / status paga (+10)
      // 5. Mais antigo (created crescente / id)
      const scored = lista.map((p) => {
        let score = 0
        if (p.getString('projeto')) score += 100
        if (p.getString('cliente')) score += 50
        if (p.getString('status') === 'paga' || p.getString('data_pagamento')) score += 10

        const dadosRaw = p.getString('nfse_dados')
        if (dadosRaw) {
          try {
            const parsed = JSON.parse(dadosRaw)
            if (parsed) {
              if (parsed.tomadorCnpjCpf) score += 15
              if (
                parsed.tomadorRazao &&
                !parsed.tomadorRazao.toLowerCase().includes('não informado')
              )
                score += 10
              if (parsed.dataRecebimento) score += 10
              if (parsed.codigoVerificacao) score += 5
              if (parsed.descricaoServico && parsed.descricaoServico.length > 10) score += 5
              if (parsed.valorLiquido) score += 3
            }
          } catch (_) {}
        }

        if (p.getString('retencoes')) score += 5
        if (p.getString('observacoes') && p.getString('observacoes').length > 10) score += 2

        const createdStr = p.getString('created') || ''
        return { record: p, score, createdStr, id: p.id }
      })

      // Ordena decrescente pelo score; empate pelo created mais antigo (crescente)
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

      // Se a nota mantida não tiver algum campo relevante mas uma descartada tiver, enriquecer mantido
      let mantidoAtualizado = false
      for (const desc of descartar) {
        if (!mantido.getString('projeto') && desc.getString('projeto')) {
          mantido.set('projeto', desc.getString('projeto'))
          mantidoAtualizado = true
        }
        if (!mantido.getString('cliente') && desc.getString('cliente')) {
          mantido.set('cliente', desc.getString('cliente'))
          mantidoAtualizado = true
        }
        if (!mantido.getString('retencoes') && desc.getString('retencoes')) {
          mantido.set('retencoes', desc.getString('retencoes'))
          mantidoAtualizado = true
        }
        if (
          (!mantido.getString('data_pagamento') || mantido.getString('status') !== 'paga') &&
          (desc.getString('status') === 'paga' || desc.getString('data_pagamento'))
        ) {
          mantido.set('status', 'paga')
          if (desc.getString('data_pagamento'))
            mantido.set('data_pagamento', desc.getString('data_pagamento'))
          if (desc.getFloat('valor_recebido') > 0)
            mantido.set('valor_recebido', desc.getFloat('valor_recebido'))
          mantidoAtualizado = true
        }
      }
      if (mantidoAtualizado) {
        try {
          app.save(mantido)
        } catch (eSave) {
          console.log(`Erro ao enriquecer nota mantida ${mantido.id}:`, eSave)
        }
      }

      // Reatribuir referências filhas e remover duplicatas
      for (const desc of descartar) {
        const descId = desc.id
        const descDescricao = desc.getString('descricao') || ''

        // 1. Reatribuir atividades que façam referência ao id descartado
        try {
          const atividadesPorId = app.findRecordsByFilter(
            'atividades',
            `texto ~ '${descId}'`,
            '',
            100,
            0,
          )
          for (const ativ of atividadesPorId) {
            const txt = ativ.getString('texto')
            ativ.set('texto', txt.replace(descId, mantido.id))
            app.save(ativ)
          }
        } catch (_) {}

        // 2. Se houver atividades duplicadas idênticas criadas para a mesma nota descartada
        // (ex.: "Parcela criada: NFS-e nº XX ...")
        // Como o extrator criou uma atividade para cada parcela inserida no lote,
        // limpamos as atividades redundantes das cópias descartadas para não poluir o histórico do projeto.
        if (descDescricao) {
          try {
            const ativsComDesc = app.findRecordsByFilter(
              'atividades',
              `texto ~ '${descDescricao.replace(/'/g, "\\'")}'`,
              'created',
              50,
              0,
            )
            // Se houver mais de uma atividade com esse texto exato, remover as excedentes
            if (ativsComDesc.length > 1) {
              const descartarAtivs = ativsComDesc.slice(1)
              for (const a of descartarAtivs) {
                try {
                  app.delete(a)
                } catch (_) {}
              }
            }
          } catch (_) {}
        }

        // 3. Excluir a parcela duplicada
        try {
          app.delete(desc)
          totalNotasRemovidas++
        } catch (delErr) {
          console.log(`Erro ao deletar parcela duplicada ${desc.id}:`, delErr)
        }
      }
    }

    const totalRestante = totalInicial - totalNotasRemovidas
    console.log(
      `Deduplicacao concluida: ${totalGruposDuplicados} grupos duplicados processados. ` +
        `${totalNotasRemovidas} notas removidas. ${totalRestante} notas permaneceram no banco.`,
    )
  },
  (_app) => {
    // Reversão no-op
  },
)
