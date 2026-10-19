import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tone = 'orange' | 'green' | 'red' | 'amber' | 'gray' | 'blue'

const tones: Record<Tone, string> = {
  orange: 'border-orange-200 bg-orange-50 text-[#D65100]',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  gray: 'border-[#D9D9D9] bg-[#F2F2F2] text-[#595959]',
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
}

export function CrmBadge({
  children,
  tone = 'gray',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap text-xs font-semibold px-2 py-0.5', tones[tone], className)}
    >
      {children}
    </Badge>
  )
}
