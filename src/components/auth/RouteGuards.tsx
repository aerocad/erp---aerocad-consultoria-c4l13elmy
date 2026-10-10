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
  const { user } = useAuth()
  const allowed = Boolean(user && canAccess(user.role, area))
  useEffect(() => {
    if (!allowed) toast.error('Você não tem acesso a esta área')
  }, [allowed])
  if (!allowed) {
    const fallback = user?.role === 'terceiro' ? '/prestador' : '/painel'
    return <Navigate to={fallback} replace />
  }
  return <Outlet />
}
