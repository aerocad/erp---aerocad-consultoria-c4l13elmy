import { memo } from 'react'
import { FolderKanban, FileCheck2, AlertTriangle, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

interface KpiCardsSectionProps {
  openCount: number
  openValue: number
  sentCount: number
  sentValue: number
  dueRequirements: number
  monthReceivable: number
  monthCount: number
  loading?: boolean
}

export const KpiCardsSection = memo(function KpiCardsSection({
  openCount,
  openValue,
  sentCount,
  sentValue,
  dueRequirements,
  monthReceivable,
  monthCount,
  loading = false,
}: KpiCardsSectionProps) {
  const cards = [
    {
      label: 'Oportunidades abertas',
      value: String(openCount),
      sub: formatCurrency(openValue),
      icon: FolderKanban,
      tone: 'orange' as const,
    },
    {
      label: 'Propostas enviadas',
      value: String(sentCount),
      sub:
        sentValue > 0 ? `${formatCurrency(sentValue)} · aguardando retorno` : 'aguardando retorno',
      icon: FileCheck2,
      tone: 'gray' as const,
    },
    {
      label: 'Exigências em 7 dias',
      value: String(dueRequirements),
      sub: dueRequirements ? 'requerem atenção' : 'sem urgências',
      icon: AlertTriangle,
      tone: dueRequirements ? ('red' as const) : ('green' as const),
    },
    {
      label: 'Receber no mês',
      value: formatCurrency(monthReceivable),
      sub: `${monthCount} parcela(s)`,
      icon: Banknote,
      tone: 'green' as const,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="crm-card animate-blueprint-rise p-5"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-[.08em] text-[#737373]">
                {kpi.label}
              </p>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  kpi.tone === 'orange'
                    ? 'bg-orange-50 text-[#FF6A13]'
                    : kpi.tone === 'red'
                      ? 'bg-red-50 text-red-600'
                      : kpi.tone === 'green'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-[#F2F2F2] text-[#737373]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            {loading ? (
              <div className="mt-4 space-y-2">
                <div className="h-8 w-24 animate-pulse rounded bg-neutral-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
              </div>
            ) : (
              <>
                <p className="mono-value mt-4 text-2xl font-bold text-[#424242]">{kpi.value}</p>
                <p className="mt-1 text-xs text-[#8A8A8A]">{kpi.sub}</p>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
})
