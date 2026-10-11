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
      if (
        name === 'oportunidades' &&
        record.getString('etapa') !== record.original().getString('etapa')
      )
        text = 'Oportunidade movida para ' + record.getString('etapa')
      if (name === 'projetos') {
        const oldName = record.original().getString('nome')
        const newName = record.getString('nome')
        const oldFase = record.original().getString('fase')
        const newFase = record.getString('fase')

        if (newName && oldName && newName !== oldName) {
          text = 'Nome do projeto alterado de "' + oldName + '" para "' + newName + '"'
        } else if (newFase && oldFase && newFase !== oldFase) {
          text = 'Projeto avançou para ' + newFase
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

      let user = record.getString('responsavel') || record.getString('responsavel_tecnico')
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
