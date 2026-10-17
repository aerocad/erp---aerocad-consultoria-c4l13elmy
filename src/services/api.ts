import type { RecordListOptions, RecordModel } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

// Cache em memória com TTL curto (15 segundos) e deduplicação de requisições em voo (in-flight)
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const inFlightRequests = new Map<string, Promise<unknown>>()
const DEFAULT_CACHE_TTL_MS = 15_000 // 15 segundos

function serializeCacheKey(collection: string, method: string, params: unknown): string {
  try {
    return `${collection}:${method}:${JSON.stringify(params)}`
  } catch {
    return `${collection}:${method}`
  }
}

export function invalidateApiCache(collection?: string) {
  if (!collection) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`${collection}:`)) {
      memoryCache.delete(key)
    }
  }
}

export async function listAll<T extends RecordModel>(
  collection: string,
  options: RecordListOptions & { bypassCache?: boolean; ttlMs?: number } = {},
): Promise<T[]> {
  const { bypassCache = false, ttlMs = DEFAULT_CACHE_TTL_MS, ...pbOptions } = options
  const cacheKey = serializeCacheKey(collection, 'listAll', pbOptions)
  const now = Date.now()

  if (!bypassCache) {
    const cached = memoryCache.get(cacheKey)
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.data as T[]
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T[]>
    }
  }

  const reqPromise = pb
    .collection<T>(collection)
    .getFullList({ requestKey: null, ...pbOptions })
    .then((results) => {
      memoryCache.set(cacheKey, { data: results, timestamp: Date.now() })
      inFlightRequests.delete(cacheKey)
      return results
    })
    .catch((err) => {
      inFlightRequests.delete(cacheKey)
      throw err
    })

  inFlightRequests.set(cacheKey, reqPromise)
  return reqPromise
}

export async function listPage<T extends RecordModel>(
  collection: string,
  page = 1,
  perPage = 50,
  options: RecordListOptions & { bypassCache?: boolean; ttlMs?: number } = {},
): Promise<{ items: T[]; totalItems: number; totalPages: number; page: number; perPage: number }> {
  const { bypassCache = false, ttlMs = DEFAULT_CACHE_TTL_MS, ...pbOptions } = options
  const cacheKey = serializeCacheKey(collection, `listPage:${page}:${perPage}`, pbOptions)
  const now = Date.now()

  if (!bypassCache) {
    const cached = memoryCache.get(cacheKey)
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.data as {
        items: T[]
        totalItems: number
        totalPages: number
        page: number
        perPage: number
      }
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<{
        items: T[]
        totalItems: number
        totalPages: number
        page: number
        perPage: number
      }>
    }
  }

  const reqPromise = pb
    .collection<T>(collection)
    .getList(page, perPage, { requestKey: null, ...pbOptions })
    .then((results) => {
      memoryCache.set(cacheKey, { data: results, timestamp: Date.now() })
      inFlightRequests.delete(cacheKey)
      return results
    })
    .catch((err) => {
      inFlightRequests.delete(cacheKey)
      throw err
    })

  inFlightRequests.set(cacheKey, reqPromise)
  return reqPromise
}

export async function getOne<T extends RecordModel>(
  collection: string,
  id: string,
  options: RecordListOptions = {},
) {
  return pb.collection<T>(collection).getOne(id, { requestKey: null, ...options })
}

export async function createOne<T extends RecordModel>(
  collection: string,
  data: Record<string, unknown>,
) {
  invalidateApiCache(collection)
  return pb.collection<T>(collection).create(data, { requestKey: null })
}

export async function updateOne<T extends RecordModel>(
  collection: string,
  id: string,
  data: Record<string, unknown>,
) {
  invalidateApiCache(collection)
  return pb.collection<T>(collection).update(id, data, { requestKey: null })
}

export async function deleteOne(collection: string, id: string) {
  invalidateApiCache(collection)
  return pb.collection(collection).delete(id, { requestKey: null })
}
