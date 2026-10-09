onRecordEnrich((e) => {
  if (
    !e.requestInfo.hasSuperuserAuth() &&
    (!e.requestInfo.auth || e.requestInfo.auth.getString('role') !== 'admin')
  ) {
    e.record.hide('valor_interno')
  }
  e.next()
}, 'ordens_servico')
