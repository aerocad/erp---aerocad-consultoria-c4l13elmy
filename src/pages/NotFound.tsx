import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="auth-grid flex min-h-screen items-center justify-center bg-[#FFF6EC] p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-9 text-center shadow-xl">
        <div className="flex justify-center">
          <AerocadLogo className="h-10 w-auto max-w-[240px] object-contain" />
        </div>
        <Compass className="mx-auto mt-8 h-12 w-12 text-[#FF6A13]" />
        <p className="mono-value mt-4 text-5xl font-black text-[#4B4B4B]">404</p>
        <h1 className="mt-3 text-xl font-bold">Coordenada não encontrada</h1>
        <p className="mt-2 text-sm text-[#737373]">
          Esta área não existe ou foi movida para outra rota do CRM.
        </p>
        <Button asChild className="mt-6 bg-[#FF6A13] hover:bg-[#E85B06]">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    </main>
  )
}
