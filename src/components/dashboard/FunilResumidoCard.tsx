import { memo } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { stageColors, stageLabels } from '@/lib/crm'
import { formatCurrency } from '@/lib/format'
import type { OportunidadeRecord } from '@/types/crm'

interface FunilResumidoCardProps {
  opportunities: OportunidadeRecord[]
  loading?: boolean
}

export const FunilResumidoCard = memo(function FunilResumidoCard({
  opportunities,
  loading = false,
}: FunilResumidoCardProps) {
  const navigate = useNavigate()

  const maxStage = Math.max(
    1,
    ...Object.keys(stageLabels).map(
      (stage) => opportunities.filter((item) => item.etapa === stage).length,
    ),
  )

  return (
    <section className="crm-card p-5 xl:col-span-2">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="technical-label">COMERCIAL</p>
          <h2 className="text-lg font-bold text-[#4B4B4B]">Funil resumido</h2>
        </div>
        <Link to="/funil" className="flex items-center text-xs font-bold text-[#E85B06]">
          Abrir funil <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && !opportunities.length ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-7 w-full animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(stageLabels).map(([stage, label]) => {
            const rows = opportunities.filter((item) => item.etapa === stage)
            const total = rows.reduce((sum, item) => sum + item.valor_estimado, 0)
            return (
              <button
                key={stage}
                type="button"
                onClick={() => navigate(`/funil?etapa=${stage}`)}
                className="grid w-full grid-cols-[120px_1fr_90px] items-center gap-3 text-left hover:opacity-90"
              >
                <span className="text-xs font-semibold text-[#595959]">{label}</span>
                <span className="h-7 overflow-hidden rounded bg-[#F2F2F2]">
                  <span
                    className="flex h-full items-center justify-end rounded px-2 text-[10px] font-bold text-white transition-[width] duration-500"
                    style={{
                      width: `${Math.max(rows.length ? 12 : 0, (rows.length / maxStage) * 100)}%`,
                      backgroundColor: stageColors[stage as keyof typeof stageLabels],
                    }}
                  >
                    {rows.length || ''}
                  </span>
                </span>
                <span className="mono-value text-right text-xs text-[#737373]">
                  {formatCurrency(total)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
})
