import { useCallback, useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'

import { useRealtime } from '@/hooks/use-realtime'
import { listAll } from '@/services/api'

type UseCrmDataOptions = {
  sort?: string
  filter?: string
  expand?: string
  realtime?: boolean
}

export function useCrmData<T extends RecordModel>(
  collection: string,
  options: UseCrmDataOptions = {},
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      const records = await listAll<T>(collection, options)
      setData(records)
      setError(null)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoading(false)
    }
  }, [collection, options.expand, options.filter, options.sort])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useRealtime<T>(collection, () => void load(), options.realtime ?? false)
  return { data, loading, error, reload: load, setData }
}
