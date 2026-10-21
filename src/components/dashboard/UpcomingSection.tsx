import { memo } from 'react'
import { Link } from 'react-router-dom'
import { CrmBadge } from '@/components/common/CrmBadge'

export interface UpcomingItem {
  id: string
  date: string
  title: string
  code: string
  path: string
  type: string
}

interface UpcomingSectionProps {
  items: UpcomingItem[]
  loading?: boolean
}

export const UpcomingSection = memo(function UpcomingSection({
  items,
  loading = false,
}: UpcomingSectionProps) {
  return (
    <section className="crm-card overflow-hidden xl:col-span-2">
      <div className="border-b px-5 py-4">
        <p className="technical-label">PRÓXIMOS 30 DIAS</p>
        <h2 className="text-lg font-bold text-[#4B4B4B]">Vencimentos e alertas</h2>
      </div>

      {loading && !items.length ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="divide-y">
          {items.map((item, index) => (
            <Link
              key={item.id}
              to={item.path}
              className="animate-blueprint-rise flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-[#FFF6EC]"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded border border-[#FFD2B3] bg-orange-50 font-mono text-[#D65100]">
                <span className="text-[10px] uppercase">
                  {new Date(item.date)
                    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                    .replace('.', '')}
                </span>
                <span className="text-base font-bold leading-none">
                  {new Date(item.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    timeZone: 'UTC',
                  })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#4B4B4B]">{item.title}</p>
                <p className="mono-value mt-0.5 text-xs text-[#8A8A8A]">{item.code}</p>
              </div>
              <CrmBadge tone={item.type === 'Exigência' ? 'amber' : 'green'}>{item.type}</CrmBadge>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-[#8A8A8A]">
          Nenhum vencimento nos próximos 30 dias.
        </p>
      )}
    </section>
  )
})
