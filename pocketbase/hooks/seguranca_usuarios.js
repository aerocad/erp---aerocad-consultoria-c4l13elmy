/**
 * Hook de proteção de perfis na coleção users:
 * 1. Impede que um usuário altere seu próprio perfil (auto-rebaixamento/auto-mudança de role/roles).
 * 2. Impede que uma alteração ou exclusão deixe o CRM sem nenhum usuário com perfil "admin".
 * 3. Mantém sincronia bidirecional entre role (legado/principal) e roles (múltiplos perfis).
 */

onRecordCreate((e) => {
  // Sincronizar role e roles na criação
  const role = e.record.getString('role')
  let roles = []
  try {
    roles = e.record.getStringSlice('roles') || []
  } catch (_) {}

  if (roles.length > 0 && !role) {
    e.record.set('role', roles[0])
  } else if (role && roles.length === 0) {
    e.record.set('roles', [role])
  } else if (role && !roles.includes(role)) {
    e.record.set('roles', [role, ...roles])
  }

  e.next()
}, 'users')

onRecordUpdate((e) => {
  const orig = e.record.original()
  const oldRole = orig.getString('role')
  const newRole = e.record.getString('role')
  const oldRoles = orig.getStringSlice('roles') || []
  const newRoles = e.record.getStringSlice('roles') || []

  const oldRolesKey = [...oldRoles].sort().join(',')
  const newRolesKey = [...newRoles].sort().join(',')
  const roleChanged = oldRole !== newRole || oldRolesKey !== newRolesKey

  // Manter sincronia entre role (legado) e roles (múltiplos)
  if (newRoles.length > 0 && (!newRole || !newRoles.includes(newRole))) {
    e.record.set('role', newRoles[0])
  } else if (newRole && newRoles.length === 0) {
    e.record.set('roles', [newRole])
  }

  // Se o role está sendo alterado
  if (roleChanged) {
    const authId =
      (e.auth && e.auth.id) || (e.requestInfo && e.requestInfo.auth && e.requestInfo.auth.id)

    // Se o usuário logado está tentando alterar seu próprio perfil
    if (authId && authId === e.record.id) {
      throw new BadRequestError(
        'Operação bloqueada: você não pode alterar seu próprio perfil de acesso.',
      )
    }

    // Se um usuário que era admin está deixando de ter admin
    const wasAdmin = oldRole === 'admin' || (oldRoles && oldRoles.indexOf('admin') !== -1)
    const willBeAdmin =
      e.record.getString('role') === 'admin' ||
      (e.record.getStringSlice('roles') && e.record.getStringSlice('roles').indexOf('admin') !== -1)

    if (wasAdmin && !willBeAdmin) {
      const remainingAdmins = $app.findRecordsByFilter(
        'users',
        '(role = "admin" || roles ~ "admin") && id != {:targetId}',
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
  const roles = e.record.getStringSlice('roles') || []
  const isAdmin = role === 'admin' || (roles && roles.indexOf('admin') !== -1)

  if (isAdmin) {
    const remainingAdmins = $app.findRecordsByFilter(
      'users',
      '(role = "admin" || roles ~ "admin") && id != {:targetId}',
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
