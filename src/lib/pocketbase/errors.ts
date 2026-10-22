import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }

  const fieldErrors = extractFieldErrors(error)
  const entries = Object.entries(fieldErrors)
  if (entries.length > 0) {
    const detalhes = entries.map(([campo, msg]) => `${campo}: ${msg}`).join(' · ')
    return `${error.message || 'Erro na operação'}: ${detalhes}`
  }

  const resData = error.response?.data
  if (
    resData &&
    typeof resData === 'object' &&
    'message' in resData &&
    typeof (resData as { message: unknown }).message === 'string'
  ) {
    return (resData as { message: string }).message
  }

  return error.message || 'Ocorreu um erro inesperado na requisição.'
}
