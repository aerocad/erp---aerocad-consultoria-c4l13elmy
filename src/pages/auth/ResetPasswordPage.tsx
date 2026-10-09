import { useState, type FormEvent } from 'react'
import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import logo from '@/assets/aerocad-logo.svg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!token) return setError('Link inválido ou incompleto.')
    if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    try {
      await pb
        .collection('users')
        .confirmPasswordReset(token, password, confirm, { requestKey: null })
      setDone(true)
      toast.success('Senha redefinida com sucesso')
    } catch {
      setError('Este link é inválido ou expirou. Solicite um novo link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-grid flex min-h-screen items-center justify-center bg-[#FFF6EC] p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl">
        <img src={logo} alt="AEROCAD" className="mx-auto w-48" />
        {done ? (
          <div className="mt-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-bold text-[#4B4B4B]">Senha redefinida</h1>
            <p className="mt-2 text-sm text-[#737373]">Use sua nova senha para entrar no CRM.</p>
            <Button asChild className="mt-6 w-full bg-[#FF6A13] hover:bg-[#E85B06]">
              <Link to="/login">Ir para o login</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-7 text-2xl font-bold text-[#4B4B4B]">Criar nova senha</h1>
            <p className="mt-2 text-sm text-[#737373]">
              Use 8 ou mais caracteres e evite dados fáceis de adivinhar.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-[#9A9A9A]" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="h-11"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="h-11 w-full bg-[#FF6A13] hover:bg-[#E85B06]" disabled={loading}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
