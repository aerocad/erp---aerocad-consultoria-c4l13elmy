import { useCallback, useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'

import { useRealtime } from '@/hooks/use-realtime'
import { listAll } from '@/services/api'

type UseCrmDataOptions = {
  sort?: string
  filter?: string
  expand?: string
  realtime?: boolean
  enabled?: boolean
  ttlMs?: number
  bypassCache?: boolean
}

export function useCrmData<T extends RecordModel>(
  collection: string,
  options: UseCrmDataOptions = {},
) {
  const { sort, filter, expand, realtime = false, enabled = true, ttlMs, bypassCache } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const records = await listAll<T>(collection, {
        sort,
        filter,
        expand,
        ttlMs,
        bypassCache,
      })
      setData(records)
      setError(null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [collection, expand, filter, sort, ttlMs, bypassCache, enabled])

  useEffect(() => {
    if (enabled) {
      void load()
    } else {
      setLoading(false)
    }
  }, [enabled, load])

  useRealtime<T>(
    collection,
    () => {
      // Quando há evento realtime, revalida forçando atualização se habilitado
      if (enabled) {
        void load()
      }
    },
    realtime && enabled,
  )

  return { data, loading, error, reload: load, setData }
}
