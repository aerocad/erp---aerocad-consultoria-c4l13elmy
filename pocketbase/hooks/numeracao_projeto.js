onRecordCreate((e) => {
  if (e.record.getString('numero')) return e.next()

  const year = new Date().getFullYear()
  let next = 1
  $app.runInTransaction((txApp) => {
    let sequence
    try {
      sequence = txApp.findFirstRecordByFilter('sequencias', "chave = 'projeto' && ano = " + year)
    } catch (_) {
      sequence = new Record(txApp.findCollectionByNameOrId('sequencias'))
      sequence.set('chave', 'projeto')
      sequence.set('ano', year)
      sequence.set('atual', 0)
    }
    next = sequence.getInt('atual') + 1
    sequence.set('atual', next)
    txApp.save(sequence)
  })
  e.record.set('numero', year + '-' + String(next).padStart(3, '0'))
  e.next()
}, 'projetos')
