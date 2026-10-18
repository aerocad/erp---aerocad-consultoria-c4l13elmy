import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(() => {
    const navState = location.state as { email?: string; from?: string } | null
    return navState?.email?.trim() || ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/painel" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha para continuar.')
      return
    }
    setLoading(true)
    try {
      const loggedUser = await login(email.trim(), password)
      const isTerceiro = loggedUser?.role === 'terceiro'
      const destination = isTerceiro
        ? '/prestador'
        : (location.state as { from?: string } | null)?.from || '/painel'
      navigate(destination, { replace: true })
    } catch (requestError) {
      const message = getErrorMessage(requestError)
      setError(message.includes('Failed to authenticate') ? 'E-mail ou senha inválidos.' : message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-grid relative min-h-screen overflow-hidden bg-[#FFF6EC] px-4 py-10">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-[48px] border-[#FF6A13]/10" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-white/80 bg-white/95 p-7 shadow-[0_22px_70px_rgba(89,89,89,0.15)] sm:p-9">
          <div className="flex justify-center">
            <AerocadLogo className="h-12 w-auto max-w-[280px] object-contain" />
          </div>
          <div className="mt-7 border-l-2 border-[#FF6A13] pl-4">
            <p className="technical-label">CRM · CONSULTORIA & AEROPORTOS</p>
            <h1 className="mt-1 text-2xl font-bold text-[#4B4B4B]">Acesse sua prancheta</h1>
            <p className="mt-1 text-sm text-[#737373]">
              Projetos, processos e oportunidades em um só lugar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail profissional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-[#9A9A9A]" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 pl-10"
                  placeholder="nome@aerocad.com.br"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/recuperar-senha"
                  className="text-xs font-semibold text-[#E85B06] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-[#9A9A9A]" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 px-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-[#737373]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full bg-[#FF6A13] font-bold text-white hover:bg-[#E85B06]"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no CRM'}
            </Button>
          </form>
          <div className="mt-7 flex items-center justify-center gap-2 border-t pt-5 text-xs text-[#8A8A8A]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Ambiente seguro AEROCAD · Brasília-DF
          </div>
        </div>
      </div>
    </main>
  )
}
