import { useEffect, useState } from 'react'
import { CheckCircle2, CircleX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token = params.get('token')
    if (!token) return setState('error')
    pb.collection('users')
      .confirmVerification(token, { requestKey: null })
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [params])

  return (
    <main className="auth-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex justify-center">
          <AerocadLogo className="h-10 w-auto max-w-[240px] object-contain" />
        </div>
        {state === 'loading' && (
          <>
            <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-4 border-[#FFD3B5] border-t-[#FF6A13]" />
            <p className="mt-4 text-sm text-[#737373]">Verificando seu e-mail...</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mt-8 h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-bold text-[#4B4B4B]">E-mail verificado</h1>
            <p className="mt-2 text-sm text-[#737373]">Sua conta está pronta para acessar o CRM.</p>
            <Button asChild className="mt-6 w-full bg-[#FF6A13] hover:bg-[#E85B06]">
              <Link to="/login">Entrar</Link>
            </Button>
          </>
        )}
        {state === 'error' && (
          <>
            <CircleX className="mx-auto mt-8 h-12 w-12 text-red-600" />
            <h1 className="mt-4 text-2xl font-bold text-[#4B4B4B]">Link inválido</h1>
            <p className="mt-2 text-sm text-[#737373]">O link expirou ou já foi utilizado.</p>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
