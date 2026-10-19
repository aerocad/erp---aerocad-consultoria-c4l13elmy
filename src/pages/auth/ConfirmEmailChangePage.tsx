import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'

export default function ConfirmEmailChangePage() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Confirmando a troca de e-mail...')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    const password = params.get('password') || ''
    if (!token) return setMessage('Link inválido ou incompleto.')
    pb.collection('users')
      .confirmEmailChange(token, password, { requestKey: null })
      .then(() => {
        pb.authStore.clear()
        setSuccess(true)
        setMessage('E-mail alterado. Entre novamente com o novo endereço.')
      })
      .catch(() =>
        setMessage('O link é inválido ou expirou. Solicite uma nova troca em Minha conta.'),
      )
  }, [params])

  return (
    <main className="auth-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex justify-center">
          <AerocadLogo className="h-10 w-auto max-w-[240px] object-contain" />
        </div>
        <h1 className="mt-8 text-2xl font-bold text-[#4B4B4B]">Troca de e-mail</h1>
        <p className="mt-3 text-sm text-[#737373]">{message}</p>
        <Button asChild className="mt-6 w-full bg-[#FF6A13] hover:bg-[#E85B06]">
          <Link to={success ? '/login' : '/painel'}>{success ? 'Entrar novamente' : 'Voltar'}</Link>
        </Button>
      </div>
    </main>
  )
}
