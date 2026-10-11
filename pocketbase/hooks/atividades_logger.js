onRecordAfterCreateSuccess(
  (e) => {
    e.next()
    try {
      const record = e.record
      const name = record.collection().name
      let text = ''
      if (name === 'oportunidades') text = 'Oportunidade criada: ' + record.getString('titulo')
      if (name === 'projetos') text = 'Projeto criado: ' + record.getString('numero')
      if (name === 'processos')
        text =
          'Processo regulatório criado: ' +
          (record.getString('numero_protocolo') || 'sem protocolo')
      if (name === 'exigencias') text = 'Exigência registrada: ' + record.getString('descricao')
      if (name === 'parcelas') text = 'Parcela criada: ' + record.getString('descricao')
      if (!text) return

      let user = ''
      try {
        if (e.auth && e.auth.id) {
          user = e.auth.id
        }
      } catch (_) {}

      if (!user) {
        user = record.getString('responsavel') || record.getString('responsavel_tecnico')
      }

      if (!user) {
        try {
          user = $app.findFirstRecordByData('users', 'role', 'admin').id
        } catch (_) {
          return
        }
      }
      const activity = new Record($app.findCollectionByNameOrId('atividades'))
      activity.set('usuario', user)
      activity.set('texto', text)
      if (name === 'oportunidades') {
        activity.set('oportunidade', record.id)
        activity.set('cliente', record.getString('cliente'))
      }
      if (name === 'projetos') {
        activity.set('projeto', record.id)
        activity.set('cliente', record.getString('cliente'))
        activity.set('oportunidade', record.getString('oportunidade'))
      }
      if (name === 'processos') {
        activity.set('processo', record.id)
        activity.set('projeto', record.getString('projeto'))
      }
      if (name === 'exigencias') activity.set('processo', record.getString('processo'))
      if (name === 'parcelas') {
        activity.set('projeto', record.getString('projeto'))
        activity.set('cliente', record.getString('cliente'))
      }
      $app.save(activity)
    } catch (error) {
      console.error('Falha ao registrar atividade', error)
    }
  },
  'oportunidades',
  'projetos',
  'processos',
  'exigencias',
  'parcelas',
)

onRecordAfterUpdateSuccess(
  (e) => {
    e.next()
    try {
      const record = e.record
      const name = record.collection().name
      let text = ''
      let multiTexts = []

      let userName = ''
      try {
        if (e.auth && e.auth.id) {
          userName = e.auth.getString('name') || e.auth.getString('email') || ''
        }
      } catch (_) {}

      if (
        name === 'oportunidades' &&
        record.getString('etapa') !== record.original().getString('etapa')
      )
        text = 'Oportunidade movida para ' + record.getString('etapa')

      if (name === 'projetos') {
        const orig = record.original()
        const byUser = userName ? ' por ' + userName : ''

        // 1. Arquivamento
        const oldArquivado = orig.getBool('arquivado')
        const newArquivado = record.getBool('arquivado')
        if (oldArquivado !== newArquivado) {
          multiTexts.push(
            newArquivado ? 'Projeto arquivado' + byUser : 'Projeto desarquivado' + byUser,
          )
        }

        // 2. Nome
        const oldName = orig.getString('nome')
        const newName = record.getString('nome')
        if (newName && oldName && newName !== oldName) {
          multiTexts.push(
            'Nome do projeto alterado de "' + oldName + '" para "' + newName + '"' + byUser,
          )
        }

        // 3. Valor global
        const oldValor = orig.getFloat('valor_global')
        const newValor = record.getFloat('valor_global')
        if (oldValor !== newValor) {
          const fmtBRL = (val) => {
            try {
              return (
                'R$ ' +
                Number(val || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              )
            } catch (_) {
              return 'R$ ' + (val || 0)
            }
          }
          multiTexts.push(
            'Valor global alterado de ' + fmtBRL(oldValor) + ' para ' + fmtBRL(newValor) + byUser,
          )
        }

        // 4. Trilha
        const oldTrilha = orig.getString('trilha')
        const newTrilha = record.getString('trilha')
        if (newTrilha && oldTrilha && newTrilha !== oldTrilha) {
          multiTexts.push(
            'Trilha alterada de ' +
              oldTrilha.toUpperCase() +
              ' para ' +
              newTrilha.toUpperCase() +
              byUser,
          )
        }

        // 5. Fase
        const oldFase = orig.getString('fase')
        const newFase = record.getString('fase')
        if (newFase && oldFase && newFase !== oldFase) {
          multiTexts.push('Fase alterada de "' + oldFase + '" para "' + newFase + '"' + byUser)
        }

        // 6. Status
        const oldStatus = orig.getString('status')
        const newStatus = record.getString('status')
        if (newStatus && oldStatus && newStatus !== oldStatus) {
          multiTexts.push(
            'Status do projeto alterado de ' + oldStatus + ' para ' + newStatus + byUser,
          )
        }

        // 7. Prioridade
        const oldPrioridade = orig.getString('prioridade') || 'normal'
        const newPrioridade = record.getString('prioridade') || 'normal'
        if (oldPrioridade !== newPrioridade) {
          multiTexts.push(
            'Prioridade alterada de ' +
              oldPrioridade.toUpperCase() +
              ' para ' +
              newPrioridade.toUpperCase() +
              byUser,
          )
        }

        // 8. Prazo interno
        const oldPrazo = orig.getString('prazo')
        const newPrazo = record.getString('prazo')
        if (oldPrazo !== newPrazo) {
          const fmtDate = (d) => (d ? d.slice(0, 10) : 'vazio')
          multiTexts.push(
            'Prazo interno alterado de ' +
              fmtDate(oldPrazo) +
              ' para ' +
              fmtDate(newPrazo) +
              byUser,
          )
        }

        // 9. Datas de início / proposta / aceite
        const oldInicio = orig.getString('data_inicio')
        const newInicio = record.getString('data_inicio')
        if (oldInicio !== newInicio) {
          multiTexts.push('Data de início alterada' + byUser)
        }

        // 10. Cliente
        const oldCliente = orig.getString('cliente')
        const newCliente = record.getString('cliente')
        if (newCliente && oldCliente && newCliente !== oldCliente) {
          multiTexts.push('Cliente do projeto alterado' + byUser)
        }

        // 11. Escopo / Tipo de serviço
        const oldEscopo = orig.getString('escopo_resumido')
        const newEscopo = record.getString('escopo_resumido')
        if (oldEscopo !== newEscopo) {
          multiTexts.push('Escopo resumido do projeto atualizado' + byUser)
        }

        const oldTipoServico = orig.getString('tipo_servico')
        const newTipoServico = record.getString('tipo_servico')
        if (oldTipoServico !== newTipoServico) {
          multiTexts.push(
            'Tipo de serviço alterado para "' + (newTipoServico || 'nenhum') + '"' + byUser,
          )
        }

        // 12. Equipe Técnica (Coordenador, Analista, RTs)
        const oldCoord = orig.getString('coordenador_colaborador')
        const newCoord = record.getString('coordenador_colaborador')
        if (oldCoord !== newCoord) {
          let coordNome = 'nenhum'
          try {
            if (newCoord) {
              const c = $app.findRecordById('colaboradores', newCoord)
              coordNome = c.getString('nome_completo')
            }
          } catch (_) {}
          multiTexts.push('Coordenador alterado para ' + coordNome + byUser)
        }

        const oldAnalista = orig.getString('analista_colaborador')
        const newAnalista = record.getString('analista_colaborador')
        if (oldAnalista !== newAnalista) {
          let analistaNome = 'nenhum'
          try {
            if (newAnalista) {
              const c = $app.findRecordById('colaboradores', newAnalista)
              analistaNome = c.getString('nome_completo')
            }
          } catch (_) {}
          multiTexts.push('Analista alterado para ' + analistaNome + byUser)
        }

        // RTs colaboradores
        try {
          const oldRts = (orig.getStringSlice('rts_colaboradores') || []).slice().sort().join(',')
          const newRts = (record.getStringSlice('rts_colaboradores') || []).slice().sort().join(',')
          if (oldRts !== newRts) {
            multiTexts.push('Responsáveis Técnicos (RTs) atualizados' + byUser)
          }
        } catch (_) {}

        // Se houver múltiplas alterações registradas, combinar em texto único ou primeiro
        if (multiTexts.length > 0) {
          text = multiTexts.join(' · ')
        }
      }

      if (
        name === 'processos' &&
        record.getString('status') !== record.original().getString('status')
      )
        text = 'Processo atualizado para ' + record.getString('status')

      if (
        name === 'exigencias' &&
        record.getString('status') !== record.original().getString('status')
      )
        text = 'Exigência atualizada para ' + record.getString('status')

      if (
        name === 'parcelas' &&
        record.getString('status') !== record.original().getString('status')
      )
        text = 'Parcela atualizada para ' + record.getString('status')

      if (!text) return

      let user = ''
      try {
        if (e.auth && e.auth.id) {
          user = e.auth.id
        }
      } catch (_) {}

      if (!user) {
        user = record.getString('responsavel') || record.getString('responsavel_tecnico')
      }
      if (!user) {
        try {
          user = $app.findFirstRecordByData('users', 'role', 'admin').id
        } catch (_) {
          return
        }
      }
      const activity = new Record($app.findCollectionByNameOrId('atividades'))
      activity.set('usuario', user)
      activity.set('texto', text)
      if (name === 'oportunidades') {
        activity.set('oportunidade', record.id)
        activity.set('cliente', record.getString('cliente'))
      }
      if (name === 'projetos') {
        activity.set('projeto', record.id)
        activity.set('cliente', record.getString('cliente'))
      }
      if (name === 'processos') {
        activity.set('processo', record.id)
        activity.set('projeto', record.getString('projeto'))
      }
      if (name === 'exigencias') activity.set('processo', record.getString('processo'))
      if (name === 'parcelas') {
        activity.set('projeto', record.getString('projeto'))
        activity.set('cliente', record.getString('cliente'))
      }
      $app.save(activity)
    } catch (error) {
      console.error('Falha ao registrar atividade', error)
    }
  },
  'oportunidades',
  'projetos',
  'processos',
  'exigencias',
  'parcelas',
)
