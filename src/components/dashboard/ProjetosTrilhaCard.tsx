import { memo } from 'react'
import { Progress } from '@/components/ui/progress'
import { trailLabels } from '@/lib/crm'
import type { ProjetoRecord } from '@/types/crm'

interface ProjetosTrilhaCardProps {
  projects: ProjetoRecord[]
  loading?: boolean
}

export const ProjetosTrilhaCard = memo(function ProjetosTrilhaCard({
  projects,
  loading = false,
}: ProjetosTrilhaCardProps) {
  return (
    <section className="crm-card p-5">
      <p className="technical-label">ENTREGA</p>
      <h2 className="text-lg font-bold text-[#4B4B4B]">Projetos por trilha</h2>

      {loading && !projects.length ? (
        <div className="mt-5 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
              <div className="h-2 w-full animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {(['opea', 'registro', 'demais'] as const).map((trail) => {
            const rows = projects.filter((item) => item.trilha === trail)
            const active = rows.filter((item) => item.status === 'ativo').length
            return (
              <div key={trail}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 ${
                        trail === 'opea'
                          ? 'bg-[#FF6A13]'
                          : trail === 'registro'
                            ? 'bg-emerald-600'
                            : 'bg-[#737373]'
                      }`}
                    />
                    <span className="text-sm font-semibold">{trailLabels[trail]}</span>
                  </div>
                  <span className="mono-value text-lg font-bold">{rows.length}</span>
                </div>
                <Progress value={rows.length ? (active / rows.length) * 100 : 0} className="h-2" />
                <p className="mt-1 text-[11px] text-[#8A8A8A]">{active} ativo(s)</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
})
