onRecordAfterUpdateSuccess((e) => {
  e.next()
  const oldPhase = e.record.original().getString('fase')
  const phase = e.record.getString('fase')
  if (!phase || phase === oldPhase) return

  const project = e.record
  const trail = project.getString('trilha')
  let description = ''
  let percentage = 0
  let trigger = 'entrega'
  if (phase === 'Kick-off/Documentação' || phase === 'Contrato') {
    description = 'Entrada — ' + project.getString('nome')
    percentage = trail === 'registro' ? 40 : 30
    trigger = 'assinatura'
  } else if (trail === 'opea' && phase === 'Entrega ao cliente') {
    description = 'Balanço — ' + project.getString('nome')
    percentage = 70
  } else if (trail === 'registro' && phase === 'Registro concluído') {
    description = 'Balanço — ' + project.getString('nome')
    percentage = 60
  } else if (trail === 'demais' && phase === 'Versão final') {
    description = 'Parcela 2 — ' + project.getString('nome')
    percentage = 40
  } else if (trail === 'demais' && phase === 'Aprovação') {
    description = 'Balanço — ' + project.getString('nome')
    percentage = 30
  }
  if (!description) return

  try {
    $app.findFirstRecordByFilter(
      'parcelas',
      "projeto = '" + project.id + "' && descricao = '" + description.replaceAll("'", "\\'") + "'",
    )
    return
  } catch (_) {}

  let total = 0
  const opportunityId = project.getString('oportunidade')
  if (opportunityId) {
    try {
      total = $app.findRecordById('oportunidades', opportunityId).getFloat('valor_estimado')
    } catch (_) {}
  }
  const date = new Date()
  date.setDate(date.getDate() + 10)
  const installment = new Record($app.findCollectionByNameOrId('parcelas'))
  installment.set('projeto', project.id)
  installment.set('cliente', project.getString('cliente'))
  installment.set('descricao', description)
  installment.set('valor', Math.round(total * percentage) / 100)
  installment.set('gatilho', trigger)
  installment.set('vencimento', date.toISOString())
  installment.set('status', 'pendente')
  installment.set('origem', 'gatilho')
  $app.save(installment)
}, 'projetos')

onRecordAfterUpdateSuccess((e) => {
  e.next()
  const oldStatus = e.record.original().getString('status')
  const status = e.record.getString('status')
  if (status !== 'protocolado' || oldStatus === 'protocolado') return

  try {
    const project = $app.findRecordById('projetos', e.record.getString('projeto'))
    const description = 'Protocolo — ' + project.getString('nome')
    try {
      $app.findFirstRecordByFilter(
        'parcelas',
        "projeto = '" +
          project.id +
          "' && descricao = '" +
          description.replaceAll("'", "\\'") +
          "'",
      )
      return
    } catch (_) {}
    let total = 0
    const opportunityId = project.getString('oportunidade')
    if (opportunityId) {
      try {
        total = $app.findRecordById('oportunidades', opportunityId).getFloat('valor_estimado')
      } catch (_) {}
    }
    const date = new Date()
    date.setDate(date.getDate() + 10)
    const installment = new Record($app.findCollectionByNameOrId('parcelas'))
    installment.set('projeto', project.id)
    installment.set('cliente', project.getString('cliente'))
    installment.set('descricao', description)
    installment.set('valor', Math.round(total * 50) / 100)
    installment.set('gatilho', 'protocolo')
    installment.set('vencimento', date.toISOString())
    installment.set('status', 'pendente')
    installment.set('origem', 'gatilho')
    $app.save(installment)
  } catch (error) {
    console.error('Falha ao criar parcela de protocolo', error)
  }
}, 'processos')
