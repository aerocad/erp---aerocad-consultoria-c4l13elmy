import { AlertCircle, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PageLoading({ label = 'Carregando dados...' }: { label?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-[#737373]">
      <LoaderCircle className="h-7 w-7 animate-spin text-[#FF6A13]" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50/40 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <div>
        <p className="font-semibold text-[#595959]">Não foi possível carregar os dados</p>
        <p className="mt-1 text-sm text-[#737373]">Verifique sua conexão e tente novamente.</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="blueprint-grid flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[#FFB27B] p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center border border-[#FF6A13] text-2xl font-bold text-[#FF6A13]">
        ＋
      </div>
      <p className="font-semibold text-[#595959]">{title}</p>
      <p className="mt-1 max-w-md text-sm text-[#737373]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
