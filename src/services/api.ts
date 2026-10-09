import type { RecordListOptions, RecordModel } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

export async function listAll<T extends RecordModel>(
  collection: string,
  options: RecordListOptions = {},
) {
  return pb.collection<T>(collection).getFullList({ requestKey: null, ...options })
}

export async function listPage<T extends RecordModel>(
  collection: string,
  page = 1,
  perPage = 50,
  options: RecordListOptions = {},
) {
  return pb.collection<T>(collection).getList(page, perPage, { requestKey: null, ...options })
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
  return pb.collection<T>(collection).create(data, { requestKey: null })
}

export async function updateOne<T extends RecordModel>(
  collection: string,
  id: string,
  data: Record<string, unknown>,
) {
  return pb.collection<T>(collection).update(id, data, { requestKey: null })
}

export async function deleteOne(collection: string, id: string) {
  return pb.collection(collection).delete(id, { requestKey: null })
}
