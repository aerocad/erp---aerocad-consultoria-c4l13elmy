import { useState, type FormEvent } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(email.trim(), { requestKey: null })
      setSent(true)
      toast.success('Enviamos as instruções para seu e-mail')
    } catch {
      toast.error('Não foi possível solicitar a recuperação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-grid flex min-h-screen items-center justify-center bg-[#FFF6EC] p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-xl">
        <div className="flex justify-center">
          <AerocadLogo className="h-10 w-auto max-w-[240px] object-contain" />
        </div>
        <h1 className="mt-7 text-2xl font-bold text-[#4B4B4B]">Recuperar senha</h1>
        <p className="mt-2 text-sm text-[#737373]">
          Informe seu e-mail para receber o link seguro de redefinição.
        </p>
        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            Se o endereço estiver cadastrado, as instruções chegarão em instantes. Verifique também
            a pasta de spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-[#9A9A9A]" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 pl-10"
                />
              </div>
            </div>
            <Button className="h-11 w-full bg-[#FF6A13] hover:bg-[#E85B06]" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </Button>
          </form>
        )}
        <Button asChild variant="ghost" className="mt-5 w-full">
          <Link to="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao login
          </Link>
        </Button>
      </div>
    </main>
  )
}
