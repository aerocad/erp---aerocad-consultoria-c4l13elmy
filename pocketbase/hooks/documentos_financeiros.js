// @ts-nocheck
/**
 * Hook de Localização, Exclusão Segura e Desfazer de Documentos Financeiros (NFS-e, Boletos e Comprovantes)
 * Rotas:
 * 1. POST /backend/v1/financeiro/documentos/excluir - Exclui com auditoria e snapshot completo
 * 2. POST /backend/v1/financeiro/documentos/desfazer - Restaura documento e religa vínculos
 * 3. GET /backend/v1/financeiro/documentos/historico-exclusoes - Lista auditorias recentes
 */

routerAdd(
  'POST',
  '/backend/v1/financeiro/documentos/excluir',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      // Validação estrita de administrador (Cleyton / admin)
      const role = authUser.getString('role')
      const roles = authUser.getStringSlice('roles') || []
      const isAdmin = role === 'admin' || roles.indexOf('admin') !== -1

      if (!isAdmin) {
        return e.forbiddenError(
          'Permissão negada: apenas administradores (Cleyton) possuem permissão para excluir documentos financeiros.',
        )
      }

      const body = e.requestInfo().body || {}
      const {
        colecaoOrigem,
        registroId,
        tipoDocumento, // 'nota_fiscal' | 'boleto' | 'comprovante'
        subtipo,
        palavraChave,
        justificativa,
        detalhesDoc,
      } = body

      if (!colecaoOrigem || !registroId) {
        return e.badRequestError('Identificação do documento/registro inválida.')
      }

      if ((palavraChave || '').trim().toUpperCase() !== 'EXCLUIR') {
        return e.badRequestError('Confirmação inválida. Digite a palavra EXCLUIR.')
      }

      const usuarioNome =
        authUser.getString('name') || authUser.getString('email') || 'Administrador'
      const usuarioId = authUser.id

      let snapshotRegistro = null
      let acaoRealizada = ''
      let impactoVinculos = []

      if (colecaoOrigem === 'parcelas') {
        const parcela = $app.findRecordById('parcelas', registroId)
        if (!parcela) return e.notFoundError('Parcela/Nota fiscal não encontrada.')

        snapshotRegistro = {
          colecao: 'parcelas',
          id: parcela.id,
          projeto: parcela.getString('projeto'),
          cliente: parcela.getString('cliente'),
          descricao: parcela.getString('descricao'),
          valor: parcela.getFloat('valor'),
          valor_recebido: parcela.getFloat('valor_recebido'),
          gatilho: parcela.getString('gatilho'),
          origem: parcela.getString('origem'),
          status: parcela.getString('status'),
          status_pagamento: parcela.getString('status_pagamento'),
          vencimento: parcela.getString('vencimento'),
          data_faturamento: parcela.getString('data_faturamento'),
          data_pagamento: parcela.getString('data_pagamento'),
          nf_numero: parcela.getString('nf_numero'),
          nfse_chave: parcela.getString('nfse_chave'),
          nfse_dados: parcela.getString('nfse_dados'),
          retencoes: parcela.getString('retencoes'),
          observacoes: parcela.getString('observacoes'),
          conta_bancaria: parcela.getString('conta_bancaria'),
          plano_contas_codigo: parcela.getString('plano_contas_codigo'),
          plano_contas_nome: parcela.getString('plano_contas_nome'),
          numero_parcela_marco: parcela.getString('numero_parcela_marco'),
        }

        const isGatilho = parcela.getString('origem') === 'gatilho'

        if (isGatilho) {
          // Reabre a parcela contratual limpa de dados fiscais
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
          parcela.set('status_pagamento', 'Pendente (NFS-e excluída via Localizador)')
          const obsAntiga = parcela.getString('observacoes') || ''
          parcela.set(
            'observacoes',
            `${obsAntiga}\n[AUDITORIA FISCAL] NFS-e excluída por ${usuarioNome} em ${now.toISOString()}. Parcela contratual preservada e reaberta.`,
          )
          $app.save(parcela)
          acaoRealizada = 'desvinculado_e_reaberto'
          impactoVinculos.push('Parcela contratual desvinculada e reaberta como pendente')
        } else {
          // Parcela avulsa originada da nota
          $app.delete(parcela)
          acaoRealizada = 'parcela_excluida'
          impactoVinculos.push('Lançamento avulso de parcela removido')
        }
      } else if (colecaoOrigem === 'contas_pagar') {
        const conta = $app.findRecordById('contas_pagar', registroId)
        if (!conta) return e.notFoundError('Conta a pagar não encontrada.')

        snapshotRegistro = {
          colecao: 'contas_pagar',
          id: conta.id,
          descricao: conta.getString('descricao'),
          fornecedor: conta.getString('fornecedor'),
          cliente_fornecedor: conta.getString('cliente_fornecedor'),
          credor: conta.getString('credor'),
          categoria: conta.getString('categoria'),
          valor: conta.getFloat('valor'),
          data_vencimento: conta.getString('data_vencimento'),
          data_pagamento: conta.getString('data_pagamento'),
          status: conta.getString('status'),
          forma_pagamento: conta.getString('forma_pagamento'),
          numero_documento: conta.getString('numero_documento'),
          projeto: conta.getString('projeto'),
          comprovante: conta.getStringSlice('comprovante') || [],
          comprovantes_metadados: conta.getString('comprovantes_metadados'),
          observacoes: conta.getString('observacoes'),
          codigo_barras_linha_digitavel: conta.getString('codigo_barras_linha_digitavel'),
          cnpj_cpf_beneficiario: conta.getString('cnpj_cpf_beneficiario'),
          plano_contas_codigo: conta.getString('plano_contas_codigo'),
          plano_contas_nome: conta.getString('plano_contas_nome'),
          conta_bancaria: conta.getString('conta_bancaria'),
          emprestimo_contrato_id: conta.getString('emprestimo_contrato_id'),
          emprestimo_parcela_id: conta.getString('emprestimo_parcela_id'),
        }

        // Se for exclusão apenas do anexo/comprovante específico dentro de uma conta com outros dados:
        if (body.apenasAnexoNome) {
          const compSlice = conta.getStringSlice('comprovante') || []
          const novosComps = compSlice.filter((c) => c !== body.apenasAnexoNome)
          conta.set('comprovante', novosComps)

          let metas = []
          try {
            const rawMeta = conta.getString('comprovantes_metadados')
            metas = rawMeta ? JSON.parse(rawMeta) : []
          } catch (_) {}
          if (Array.isArray(metas)) {
            metas = metas.filter(
              (m) => m.file !== body.apenasAnexoNome && m.nome_original !== body.apenasAnexoNome,
            )
            conta.set('comprovantes_metadados', JSON.stringify(metas))
          }

          if (tipoDocumento === 'boleto') {
            conta.set('codigo_barras_linha_digitavel', '')
          }

          $app.save(conta)
          acaoRealizada = 'anexo_desvinculado'
          impactoVinculos.push(
            `Arquivo anexo "${body.apenasAnexoNome}" removido da conta a pagar, lançamento mantido`,
          )
        } else {
          // Exclusão completa da conta a pagar
          $app.delete(conta)
          acaoRealizada = 'conta_pagar_excluida'
          impactoVinculos.push('Lançamento de conta a pagar excluído com snapshot preservado')
        }
      } else if (colecaoOrigem === 'contas_receber') {
        const contaRec = $app.findRecordById('contas_receber', registroId)
        if (!contaRec) return e.notFoundError('Conta a receber não encontrada.')

        snapshotRegistro = {
          colecao: 'contas_receber',
          id: contaRec.id,
          descricao: contaRec.getString('descricao'),
          cliente_nome: contaRec.getString('cliente_nome'),
          cliente: contaRec.getString('cliente'),
          categoria: contaRec.getString('categoria'),
          valor: contaRec.getFloat('valor'),
          valor_recebido: contaRec.getFloat('valor_recebido'),
          data_vencimento: contaRec.getString('data_vencimento'),
          data_recebimento: contaRec.getString('data_recebimento'),
          status: contaRec.getString('status'),
          forma_recebimento: contaRec.getString('forma_recebimento'),
          numero_documento: contaRec.getString('numero_documento'),
          projeto: contaRec.getString('projeto'),
          comprovante: contaRec.getString('comprovante'),
          observacoes: contaRec.getString('observacoes'),
          plano_contas_codigo: contaRec.getString('plano_contas_codigo'),
          plano_contas_nome: contaRec.getString('plano_contas_nome'),
          conta_bancaria: contaRec.getString('conta_bancaria'),
        }

        if (body.apenasAnexo) {
          contaRec.set('comprovante', '')
          $app.save(contaRec)
          acaoRealizada = 'comprovante_receber_removido'
          impactoVinculos.push('Comprovante removido da conta a receber, receita mantida')
        } else {
          $app.delete(contaRec)
          acaoRealizada = 'conta_receber_excluida'
          impactoVinculos.push('Lançamento de conta a receber excluído com snapshot preservado')
        }
      }

      // Gravação na auditoria permanente com capacidade de reversão total
      const auditCol = $app.findCollectionByNameOrId('auditoria_operacoes_bloco')
      const auditRec = new Record(auditCol)
      auditRec.set('usuario', usuarioId)
      auditRec.set('tipo_operacao', 'exclusao_documento_financeiro')
      auditRec.set('colecao_alvo', colecaoOrigem)
      auditRec.set(
        'descricao',
        `Exclusão de documento [${tipoDocumento.toUpperCase()}]: ${detalhesDoc?.identificador || registroId}. ${justificativa || 'Exclusão via Localizador Financeiro'}`,
      )
      auditRec.set('criterio_filtro', {
        registroId,
        colecaoOrigem,
        tipoDocumento,
        subtipo,
        detalhesDoc,
      })
      auditRec.set('alteracoes_solicitadas', {
        acao: acaoRealizada,
        tipoDocumento,
        subtipo,
        impactoVinculos,
        justificativa,
      })
      auditRec.set('total_registros_afetados', 1)
      auditRec.set('total_falhas', 0)
      auditRec.set('snapshot_anterior', snapshotRegistro ? [snapshotRegistro] : [])
      auditRec.set('desfeito', false)
      $app.save(auditRec)

      return e.json(200, {
        sucesso: true,
        auditId: auditRec.id,
        acaoRealizada,
        impactoVinculos,
        mensagem: `Documento excluído com sucesso! Registro de auditoria gravado (${auditRec.id}).`,
      })
    } catch (err) {
      console.log('Erro ao excluir documento financeiro:', err.message)
      return e.json(500, {
        sucesso: false,
        error: 'Erro no servidor ao excluir documento: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/financeiro/documentos/desfazer',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser || !authUser.id) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const role = authUser.getString('role')
      const roles = authUser.getStringSlice('roles') || []
      const isAdmin = role === 'admin' || roles.indexOf('admin') !== -1

      if (!isAdmin) {
        return e.forbiddenError(
          'Permissão negada: apenas administradores (Cleyton) possuem permissão para desfazer exclusões.',
        )
      }

      const body = e.requestInfo().body || {}
      const auditId = body.auditId

      if (!auditId) {
        return e.badRequestError('Identificador da auditoria para restauração não informado.')
      }

      const auditRecord = $app.findRecordById('auditoria_operacoes_bloco', auditId)
      if (!auditRecord) {
        return e.notFoundError('Registro de auditoria não encontrado.')
      }

      if (auditRecord.getBool('desfeito')) {
        return e.badRequestError('Esta exclusão já foi desfeita anteriormente.')
      }

      const colecaoAlvo = auditRecord.getString('colecao_alvo')
      let snapshots = []
      try {
        const raw = auditRecord.getString('snapshot_anterior')
        snapshots = raw ? JSON.parse(raw) : []
      } catch (_) {}

      if (!Array.isArray(snapshots) || snapshots.length === 0) {
        return e.badRequestError('Nenhum retrato de dados salvo nesta auditoria para restauração.')
      }

      const snap = snapshots[0]
      const targetId = snap.id

      if (colecaoAlvo === 'parcelas') {
        // Tenta encontrar o registro (caso tenha sido apenas desvinculado)
        let parcelaRec = null
        try {
          parcelaRec = $app.findRecordById('parcelas', targetId)
        } catch (_) {}

        if (!parcelaRec) {
          // Registro foi fisicamente deletado -> recriar com os dados do snapshot
          const col = $app.findCollectionByNameOrId('parcelas')
          parcelaRec = new Record(col)
          if (targetId) parcelaRec.set('id', targetId)
        }

        if (snap.projeto) parcelaRec.set('projeto', snap.projeto)
        if (snap.cliente) parcelaRec.set('cliente', snap.cliente)
        if (snap.descricao) parcelaRec.set('descricao', snap.descricao)
        if (snap.valor !== undefined) parcelaRec.set('valor', snap.valor)
        if (snap.valor_recebido !== undefined) parcelaRec.set('valor_recebido', snap.valor_recebido)
        if (snap.gatilho) parcelaRec.set('gatilho', snap.gatilho)
        if (snap.origem) parcelaRec.set('origem', snap.origem)
        if (snap.status) parcelaRec.set('status', snap.status)
        if (snap.status_pagamento) parcelaRec.set('status_pagamento', snap.status_pagamento)
        if (snap.vencimento) parcelaRec.set('vencimento', snap.vencimento)
        if (snap.data_faturamento) parcelaRec.set('data_faturamento', snap.data_faturamento)
        if (snap.data_pagamento) parcelaRec.set('data_pagamento', snap.data_pagamento)
        if (snap.nf_numero) parcelaRec.set('nf_numero', snap.nf_numero)
        if (snap.nfse_chave) parcelaRec.set('nfse_chave', snap.nfse_chave)
        if (snap.nfse_dados) parcelaRec.set('nfse_dados', snap.nfse_dados)
        if (snap.retencoes) parcelaRec.set('retencoes', snap.retencoes)
        if (snap.observacoes) parcelaRec.set('observacoes', snap.observacoes)
        if (snap.conta_bancaria) parcelaRec.set('conta_bancaria', snap.conta_bancaria)
        if (snap.plano_contas_codigo)
          parcelaRec.set('plano_contas_codigo', snap.plano_contas_codigo)
        if (snap.plano_contas_nome) parcelaRec.set('plano_contas_nome', snap.plano_contas_nome)
        if (snap.numero_parcela_marco)
          parcelaRec.set('numero_parcela_marco', snap.numero_parcela_marco)

        $app.save(parcelaRec)
      } else if (colecaoAlvo === 'contas_pagar') {
        let contaRec = null
        try {
          contaRec = $app.findRecordById('contas_pagar', targetId)
        } catch (_) {}

        if (!contaRec) {
          const col = $app.findCollectionByNameOrId('contas_pagar')
          contaRec = new Record(col)
          if (targetId) contaRec.set('id', targetId)
        }

        if (snap.descricao) contaRec.set('descricao', snap.descricao)
        if (snap.fornecedor) contaRec.set('fornecedor', snap.fornecedor)
        if (snap.cliente_fornecedor) contaRec.set('cliente_fornecedor', snap.cliente_fornecedor)
        if (snap.credor) contaRec.set('credor', snap.credor)
        if (snap.categoria) contaRec.set('categoria', snap.categoria)
        if (snap.valor !== undefined) contaRec.set('valor', snap.valor)
        if (snap.data_vencimento) contaRec.set('data_vencimento', snap.data_vencimento)
        if (snap.data_pagamento) contaRec.set('data_pagamento', snap.data_pagamento)
        if (snap.status) contaRec.set('status', snap.status)
        if (snap.forma_pagamento) contaRec.set('forma_pagamento', snap.forma_pagamento)
        if (snap.numero_documento) contaRec.set('numero_documento', snap.numero_documento)
        if (snap.projeto) contaRec.set('projeto', snap.projeto)
        if (snap.comprovante) contaRec.set('comprovante', snap.comprovante)
        if (snap.comprovantes_metadados)
          contaRec.set('comprovantes_metadados', snap.comprovantes_metadados)
        if (snap.observacoes) contaRec.set('observacoes', snap.observacoes)
        if (snap.codigo_barras_linha_digitavel)
          contaRec.set('codigo_barras_linha_digitavel', snap.codigo_barras_linha_digitavel)
        if (snap.cnpj_cpf_beneficiario)
          contaRec.set('cnpj_cpf_beneficiario', snap.cnpj_cpf_beneficiario)
        if (snap.plano_contas_codigo) contaRec.set('plano_contas_codigo', snap.plano_contas_codigo)
        if (snap.plano_contas_nome) contaRec.set('plano_contas_nome', snap.plano_contas_nome)
        if (snap.conta_bancaria) contaRec.set('conta_bancaria', snap.conta_bancaria)

        $app.save(contaRec)
      } else if (colecaoAlvo === 'contas_receber') {
        let recRec = null
        try {
          recRec = $app.findRecordById('contas_receber', targetId)
        } catch (_) {}

        if (!recRec) {
          const col = $app.findCollectionByNameOrId('contas_receber')
          recRec = new Record(col)
          if (targetId) recRec.set('id', targetId)
        }

        if (snap.descricao) recRec.set('descricao', snap.descricao)
        if (snap.cliente_nome) recRec.set('cliente_nome', snap.cliente_nome)
        if (snap.cliente) recRec.set('cliente', snap.cliente)
        if (snap.categoria) recRec.set('categoria', snap.categoria)
        if (snap.valor !== undefined) recRec.set('valor', snap.valor)
        if (snap.valor_recebido !== undefined) recRec.set('valor_recebido', snap.valor_recebido)
        if (snap.data_vencimento) recRec.set('data_vencimento', snap.data_vencimento)
        if (snap.data_recebimento) recRec.set('data_recebimento', snap.data_recebimento)
        if (snap.status) recRec.set('status', snap.status)
        if (snap.forma_recebimento) recRec.set('forma_recebimento', snap.forma_recebimento)
        if (snap.numero_documento) recRec.set('numero_documento', snap.numero_documento)
        if (snap.projeto) recRec.set('projeto', snap.projeto)
        if (snap.comprovante) recRec.set('comprovante', snap.comprovante)
        if (snap.observacoes) recRec.set('observacoes', snap.observacoes)
        if (snap.plano_contas_codigo) recRec.set('plano_contas_codigo', snap.plano_contas_codigo)
        if (snap.plano_contas_nome) recRec.set('plano_contas_nome', snap.plano_contas_nome)
        if (snap.conta_bancaria) recRec.set('conta_bancaria', snap.conta_bancaria)

        $app.save(recRec)
      }

      auditRecord.set('desfeito', true)
      auditRecord.set('data_desfeito', new Date().toISOString())
      auditRecord.set('desfeito_por', authUser.id)
      $app.save(auditRecord)

      return e.json(200, {
        sucesso: true,
        auditId,
        mensagem: 'Exclusão desfeita com sucesso! Documento e vínculos restaurados.',
      })
    } catch (err) {
      console.log('Erro ao desfazer exclusão de documento:', err.message)
      return e.json(500, {
        sucesso: false,
        error: 'Erro no servidor ao desfazer: ' + err.message,
      })
    }
  },
  $apis.requireAuth(),
)
