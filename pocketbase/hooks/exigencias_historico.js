onRecordUpdate((e) => {
  const current = e.record.getString('resposta')
  const previous = e.record.original().getString('resposta')
  if (current && current !== previous) {
    let history = []
    try {
      history = JSON.parse(e.record.getString('historico_respostas')) || []
    } catch (_) {}
    history.push({
      data: new Date().toISOString(),
      texto: current,
      usuario: e.record.getString('responsavel'),
    })
    e.record.set('historico_respostas', history)
  }
  e.next()
}, 'exigencias')
