cronAdd('parcelas-marcar-vencidas', '0 6 * * *', () => {
  const today = new Date().toISOString().slice(0, 10) + ' 00:00:00.000Z'
  const records = $app.findRecordsByFilter(
    'parcelas',
    "status = 'pendente' && vencimento < '" + today + "'",
    'vencimento',
    500,
    0,
  )
  for (const record of records) {
    record.set('status', 'vencida')
    $app.save(record)
  }
})
