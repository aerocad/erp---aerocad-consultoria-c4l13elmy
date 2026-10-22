// @ts-nocheck
/**
 * Hook de Detecção e Exclusão Segura de Notas Fiscais em Duplicidade no CRM AEROCAD
 * Rotas:
 * 1. GET /backend/v1/nfse/duplicadas - Localiza grupos de notas fiscais duplicadas
 * 2. POST /backend/v1/nfse/excluir-duplicadas - Exclusão em lote com verificação admin e auditoria
 */

routerAdd(
  'GET',
  '/backend/v1/nfse/duplicadas',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      // Buscar parcelas que contenham dados fiscais de NFS-e
      const records = $app.findRecordsByFilter(
        'parcelas',
        "nf_numero != '' || nfse_chave != ''",
        'created',
        5000,
        0,
      )

      const gruposMap = new Map()

      for (const p of records) {
        const nfNumero = (p.getString('nf_numero') || '').trim()
        const nfseChave = (p.getString('nfse_chave') || '').trim()
        let prestador = 'aerocad'
        let tomadorDoc = ''
        let dataEmissao = ''
        let codigoVerificacao = ''

        const rawDados = p.getString('nfse_dados')
        if (rawDados) {
          try {
            const parsed = typeof rawDados === 'string' ? JSON.parse(rawDados) : rawDados
            if (parsed) {
              if (parsed.prestadorCnpjCpf)
                prestador = String(parsed.prestadorCnpjCpf).replace(/\D/g, '')
              if (parsed.tomadorCnpjCpf)
                tomadorDoc = String(parsed.tomadorCnpjCpf).replace(/\D/g, '')
              if (parsed.dataEmissao) dataEmissao = String(parsed.dataEmissao).slice(0, 10)
              if (parsed.codigoVerificacao)
                codigoVerificacao = String(parsed.codigoVerificacao).trim()
            }
          } catch (_) {}
        }

        // Chave de comparação robusta:
        // Se houver código de verificação/chave única de acesso da NFS-e, compõe a identidade primária
        let chave = ''
        if (codigoVerificacao && codigoVerificacao.length >= 6) {
          chave = `cod_${codigoVerificacao.toLowerCase()}_${prestador}`
        } else if (nfNumero) {
          // Número da NF + Prestador (CNPJ) + Tomador (CNPJ)
          chave = `nf_${nfNumero.toLowerCase()}_${prestador}`
          if (tomadorDoc) {
            chave += `_tom_${tomadorDoc}`
          }
        } else if (nfseChave) {
          chave = `chave_${nfseChave.toLowerCase()}`
        }

        if (!chave) continue

        if (!gruposMap.has(chave)) {
          gruposMap.set(chave, [])
        }

        gruposMap.get(chave).push({
          id: p.id,
          numero: nfNumero || p.getString('nfse_chave'),
          chave,
          descricao: p.getString('descricao'),
          valor: p.getFloat('valor'),
          valor_recebido: p.getFloat('valor_recebido'),
          vencimento: p.getString('vencimento'),
          data_faturamento: p.getString('data_faturamento'),
          data_pagamento: p.getString('data_pagamento'),
          status: p.getString('status'),
          status_pagamento: p.getString('status_pagamento'),
          origem: p.getString('origem'),
          projeto_id: p.getString('projeto'),
          cliente_id: p.getString('cliente'),
          created: p.getString('created'),
          nfse_dados: rawDados,
        })
      }

      // Filtrar apenas grupos com 2 ou mais notas (duplicadas reais)
      const grupos = []
      for (const [chave, lista] of gruposMap.entries()) {
        if (lista.length > 1) {
          // Ordena por created crescente (a mais antiga é a original provável)
          lista.sort((a, b) => (a.created > b.created ? 1 : -1))

          // Calcula completude
          const listaComScore = lista.map((item, index) => {
            let score = 0
            if (item.projeto_id) score += 10
            if (item.cliente_id) score += 5
            if (item.status === 'paga' || item.data_pagamento) score += 8
            if (item.nfse_dados && item.nfse_dados.length > 30) score += 4
            if (item.valor_recebido > 0) score += 2
            return {
              ...item,
              score,
              is_original_sugerida: index === 0,
            }
          })

          grupos.push({
            chave,
            numero: lista[0].numero,
            total_notas: lista.length,
            notas: listaComScore,
          })
        }
      }

      return e.json(200, {
        sucesso: true,
        total_grupos: grupos.length,
        total_duplicatas: grupos.reduce((acc, g) => acc + (g.notas.length - 1), 0),
        grupos,
      })
    } catch (err) {
      console.log('Erro ao listar duplicadas:', err.message)
      return e.json(500, {
        sucesso: false,
        error: 'Erro ao buscar notas fiscais duplicadas: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/nfse/excluir-duplicadas',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      // Segurança: somente administradores podem excluir notas duplicadas
      const role = authUser.getString('role')
      const roles = authUser.getStringSlice('roles') || []
      const isAdmin = role === 'admin' || roles.indexOf('admin') !== -1

      if (!isAdmin) {
        return e.forbiddenError(
          'Permissão negada: apenas administradores (Cleyton) possuem permissão para excluir notas fiscais em duplicidade.',
        )
      }

      const body = e.requestInfo().body || {}
      const idsParaExcluir = body.idsParaExcluir || []
      const manterId = body.manterId || ''
      const justificativa =
        body.justificativa || 'Deduplicação de notas fiscais pelo painel financeiro'

      if (!Array.isArray(idsParaExcluir) || idsParaExcluir.length === 0) {
        return e.badRequestError('Nenhum identificador de nota fornecido para exclusão.')
      }

      const snapshotAnterior = []
      const excluidas = []
      const falhas = []

      for (const id of idsParaExcluir) {
        if (id === manterId) {
          // Não apagar a nota que foi indicada para ser mantida
          continue
        }

        try {
          const parcela = $app.findRecordById('parcelas', id)
          if (!parcela) continue

          const dadosSnapshot = {
            id: parcela.id,
            nf_numero: parcela.getString('nf_numero'),
            nfse_chave: parcela.getString('nfse_chave'),
            descricao: parcela.getString('descricao'),
            valor: parcela.getFloat('valor'),
            status: parcela.getString('status'),
            origem: parcela.getString('origem'),
            projeto: parcela.getString('projeto'),
            cliente: parcela.getString('cliente'),
            created: parcela.getString('created'),
            nfse_dados: parcela.getString('nfse_dados'),
          }
          snapshotAnterior.push(dadosSnapshot)

          const isGatilho = parcela.getString('origem') === 'gatilho'

          if (isGatilho) {
            // Parcela de gatilho contratual: desvincula dados da NFS-e e reabre com segurança
            const now = new Date()
            const vencStr = parcela.getString('vencimento')
            const venc = vencStr ? new Date(vencStr) : now
            const novoStatus = venc < now ? 'vencida' : 'pendente'

            parcela.set('nf_numero', '')
            parcela.set('nfse_chave', '')
            parcela.set('nfse_dados', null)
            parcela.set('data_faturamento', null)
            parcela.set('data_pagamento', null)
            parcela.set('valor_recebido', 0)
            parcela.set('status', novoStatus)
            parcela.set('status_pagamento', 'Pendente (Duplicata NFS-e removida)')
            const obsAntiga = parcela.getString('observacoes') || ''
            parcela.set(
              'observacoes',
              `${obsAntiga}\n[AUDITORIA DEDUPLICAÇÃO] NFS-e duplicada desvinculada por ${authUser.getString('name') || 'Admin'} em ${now.toISOString()}. Parcela contratual preservada e reaberta.`,
            )
            $app.save(parcela)
          } else {
            // Parcela gerada puramente por importação manual da duplicata: excluir o registro órfão/duplicado
            $app.delete(parcela)
          }

          excluidas.push(id)
        } catch (itemErr) {
          console.log(`Falha ao excluir parcela duplicada ${id}:`, itemErr.message)
          falhas.push({ id, erro: itemErr.message })
        }
      }

      // Gravar auditoria em auditoria_operacoes_bloco e importacoes_log
      try {
        const auditCol = $app.findCollectionByNameOrId('auditoria_operacoes_bloco')
        const auditRec = new Record(auditCol)
        auditRec.set('usuario', authUser.id)
        auditRec.set('tipo_operacao', 'exclusao_duplicadas_nfse')
        auditRec.set('colecao_alvo', 'parcelas')
        auditRec.set(
          'descricao',
          `Exclusão de ${excluidas.length} nota(s) fiscal(is) em duplicidade. Justificativa: ${justificativa}`,
        )
        auditRec.set('criterio_filtro', { idsParaExcluir, manterId })
        auditRec.set('alteracoes_solicitadas', { acao: 'excluir_duplicadas', manterId })
        auditRec.set('total_registros_afetados', excluidas.length)
        auditRec.set('total_falhas', falhas.length)
        auditRec.set('snapshot_anterior', snapshotAnterior)
        auditRec.set('desfeito', false)
        $app.save(auditRec)
      } catch (auditErr) {
        console.log('Aviso ao registrar auditoria de operacoes em bloco:', auditErr.message)
      }

      try {
        const logCol = $app.findCollectionByNameOrId('importacoes_log')
        const logRec = new Record(logCol)
        logRec.set(
          'arquivo_nome',
          `AUDITORIA_DEDUPLICACAO_NFSE_${new Date().toISOString().slice(0, 10)}.json`,
        )
        logRec.set('tamanho_bytes', 0)
        logRec.set('usuario', authUser.id)
        logRec.set('total_clientes', 0)
        logRec.set('total_projetos', 0)
        logRec.set('total_financeiro', excluidas.length)
        logRec.set('total_comunicacoes', 0)
        logRec.set('resumo', {
          tipo: 'exclusao_duplicadas_nfse',
          totalExcluidas: excluidas.length,
          totalFalhas: falhas.length,
          justificativa,
          manterId,
          snapshot: snapshotAnterior,
        })
        $app.save(logRec)
      } catch (logErr) {
        console.log('Aviso ao salvar importacoes_log:', logErr.message)
      }

      return e.json(200, {
        sucesso: true,
        total_solicitadas: idsParaExcluir.length,
        total_excluidas: excluidas.length,
        total_falhas: falhas.length,
        excluidas,
        falhas,
      })
    } catch (err) {
      console.log('Erro ao processar exclusão de duplicadas:', err.message)
      return e.json(500, {
        sucesso: false,
        error: 'Erro no servidor ao excluir duplicadas: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)
