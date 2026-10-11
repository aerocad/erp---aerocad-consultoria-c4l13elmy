/**
 * Hook de proteção de perfis na coleção users:
 * 1. Impede que um usuário altere seu próprio perfil (auto-rebaixamento/auto-mudança de role).
 * 2. Impede que uma alteração ou exclusão deixe o CRM sem nenhum usuário com perfil "admin".
 */

onRecordUpdate((e) => {
  const oldRole = e.record.original().getString('role')
  const newRole = e.record.getString('role')

  // Se o role está sendo alterado
  if (oldRole !== newRole) {
    const authId =
      (e.auth && e.auth.id) || (e.requestInfo && e.requestInfo.auth && e.requestInfo.auth.id)

    // Se o usuário logado está tentando alterar seu próprio perfil
    if (authId && authId === e.record.id) {
      throw new BadRequestError(
        'Operação bloqueada: você não pode alterar seu próprio perfil de acesso.',
      )
    }

    // Se um usuário que era admin está deixando de ser admin
    if (oldRole === 'admin') {
      const remainingAdmins = $app.findRecordsByFilter(
        'users',
        'role = "admin" && id != {:targetId}',
        '',
        1,
        0,
        { targetId: e.record.id },
      )
      if (!remainingAdmins || remainingAdmins.length === 0) {
        throw new BadRequestError(
          'Operação bloqueada: é necessário manter ao menos um administrador ativo no sistema.',
        )
      }
    }
  }

  e.next()
}, 'users')

onRecordDelete((e) => {
  const role = e.record.getString('role')
  if (role === 'admin') {
    const remainingAdmins = $app.findRecordsByFilter(
      'users',
      'role = "admin" && id != {:targetId}',
      '',
      1,
      0,
      { targetId: e.record.id },
    )
    if (!remainingAdmins || remainingAdmins.length === 0) {
      throw new BadRequestError(
        'Operação bloqueada: é necessário manter ao menos um administrador ativo no sistema.',
      )
    }
  }

  e.next()
}, 'users')
