import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { PageLoading } from '@/components/common/States'
import { useAuth } from '@/contexts/AuthContext'
import { canAccess } from '@/lib/crm'

export function ProtectedRoute() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <PageLoading label="Validando acesso..." />
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function AreaGuard({ area }: { area: string }) {
  const { user, isSimulating } = useAuth()
  const allowed = Boolean(user && canAccess(user, area))
  useEffect(() => {
    if (!allowed) {
      if (isSimulating) {
        toast.error(
          `Acesso restrito: o perfil simulado (${user?.role}) não possui permissão para acessar "${area}".`,
        )
      } else {
        toast.error('Você não tem acesso a esta área')
      }
    }
  }, [allowed, isSimulating, user?.role, area])
  if (!allowed) {
    // Redireciona para /prestador apenas se o usuário tiver apenas o perfil terceiro; caso contrário /painel
    const roles = user?.roles && user.roles.length > 0 ? user.roles : user?.role ? [user.role] : []
    const isOnlyTerceiro = roles.length === 1 && roles[0] === 'terceiro'
    const fallback = isOnlyTerceiro ? '/prestador' : '/painel'
    return <Navigate to={fallback} replace />
  }
  return <Outlet />
}
