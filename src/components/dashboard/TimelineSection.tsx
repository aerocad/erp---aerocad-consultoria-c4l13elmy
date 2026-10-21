import { memo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials, relativeTime } from '@/lib/format'
import type { AtividadeRecord } from '@/types/crm'

interface TimelineSectionProps {
  activities: AtividadeRecord[]
  loading?: boolean
}

export const TimelineSection = memo(function TimelineSection({
  activities,
  loading = false,
}: TimelineSectionProps) {
  return (
    <section className="crm-card overflow-hidden">
      <div className="border-b px-5 py-4">
        <p className="technical-label">TIMELINE</p>
        <h2 className="text-lg font-bold text-[#4B4B4B]">Atividade recente</h2>
      </div>

      {loading && !activities.length ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                <div className="h-2 w-1/4 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y">
          {activities.slice(0, 8).map((activity) => (
            <div key={activity.id} className="flex gap-3 px-5 py-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#FFF0E5] text-[10px] font-bold text-[#D65100]">
                  {initials(activity.expand?.usuario?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs leading-relaxed text-[#595959]">{activity.texto}</p>
                <p className="mt-1 text-[10px] text-[#9A9A9A]">{relativeTime(activity.created)}</p>
              </div>
            </div>
          ))}
          {!activities.length && (
            <p className="p-8 text-center text-sm text-[#8A8A8A]">
              Nenhuma atividade registrada recentemente.
            </p>
          )}
        </div>
      )}
    </section>
  )
})
