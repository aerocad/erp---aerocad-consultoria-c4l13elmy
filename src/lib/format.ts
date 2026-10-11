export const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const VALOR_MASCARADO = 'R$ •••••'

// Estado global de ocultação de valores financeiros (inicia true por padrão no app)
let _globalOcultarValores = true
const _listeners = new Set<(ocultar: boolean) => void>()

export function isValoresOcultos(): boolean {
  return _globalOcultarValores
}

export function setGlobalOcultarValores(ocultar: boolean): void {
  if (_globalOcultarValores !== ocultar) {
    _globalOcultarValores = ocultar
    _listeners.forEach((listener) => {
      try {
        listener(ocultar)
      } catch {
        // Ignora erros de listeners
      }
    })
  }
}

export function subscribeFinanceiroVisibilidade(listener: (ocultar: boolean) => void): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

/**
 * Formata moeda em BRL (R$ 0,00).
 * Se ocultarValores estiver ativo e options.forceShow não for true, retorna 'R$ •••••'.
 */
export function formatCurrency(value?: number | null, options?: { forceShow?: boolean }) {
  if (_globalOcultarValores && !options?.forceShow) {
    return VALOR_MASCARADO
  }
  return currency.format(Number(value || 0))
}

/**
 * Retorna o valor cru formatado em moeda BRL ignorando o toggle de privacidade (ex.: geração de documentos).
 */
export function formatCurrencyRaw(value?: number | null) {
  return currency.format(Number(value || 0))
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

export function formatDateLong(value: Date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(value)
}

export function toInputDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function relativeTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  return formatter.format(days, 'day')
}

export function initials(name?: string) {
  return (name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function escapeFilter(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}
