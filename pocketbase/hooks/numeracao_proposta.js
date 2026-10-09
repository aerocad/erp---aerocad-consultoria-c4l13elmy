onRecordCreate((e) => {
  if (e.record.getString('numero')) return e.next()

  const year = new Date().getFullYear()
  const type = e.record.getString('tipo') || 'comercial'
  const key = type === 'tecnica' ? 'proposta_tecnica' : 'proposta_comercial'
  const prefix = type === 'tecnica' ? 'PT' : 'PC'
  let next = 1
  $app.runInTransaction((txApp) => {
    let sequence
    try {
      sequence = txApp.findFirstRecordByFilter(
        'sequencias',
        "chave = '" + key + "' && ano = " + year,
      )
    } catch (_) {
      sequence = new Record(txApp.findCollectionByNameOrId('sequencias'))
      sequence.set('chave', key)
      sequence.set('ano', year)
      sequence.set('atual', 0)
    }
    next = sequence.getInt('atual') + 1
    sequence.set('atual', next)
    txApp.save(sequence)
  })
  e.record.set('numero', prefix + ' ' + String(next).padStart(3, '0') + '/' + year)
  if (!e.record.getString('revisao')) e.record.set('revisao', 'REV001')
  e.next()
}, 'propostas')
