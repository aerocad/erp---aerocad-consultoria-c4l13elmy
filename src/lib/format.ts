export const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const VALOR_MASCARADO = 'R$ •••••'

// Estado global de ocultação de valores financeiros (inicia true por padrão no app)
let _globalOcultarValores = true
// Controle de permissão de visualização de valores financeiros (admin/comercial/financeiro = true)
let _globalPodeVerValores = true
const _listeners = new Set<(ocultar: boolean) => void>()

/**
 * Retorna se os valores devem ser mascarados.
 * Mascaramento efetivo = falta de permissão OU toggle oculto.
 */
export function isValoresOcultos(): boolean {
  if (!_globalPodeVerValores) {
    return true
  }
  return _globalOcultarValores
}

export function setGlobalPodeVerValores(podeVer: boolean): void {
  if (_globalPodeVerValores !== podeVer) {
    _globalPodeVerValores = podeVer
    const efetivo = !_globalPodeVerValores || _globalOcultarValores
    _listeners.forEach((listener) => {
      try {
        listener(efetivo)
      } catch {
        // Ignora erros de listeners
      }
    })
  }
}

export function isPodeVerValores(): boolean {
  return _globalPodeVerValores
}

export function setGlobalOcultarValores(ocultar: boolean): void {
  if (_globalOcultarValores !== ocultar) {
    _globalOcultarValores = ocultar
    const efetivo = !_globalPodeVerValores || _globalOcultarValores
    _listeners.forEach((listener) => {
      try {
        listener(efetivo)
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
  // Se o usuário não pode ver valores, forceShow é ignorado a menos que seja explicitamente liberado
  const ocultar = !_globalPodeVerValores || (_globalOcultarValores && !options?.forceShow)
  if (ocultar) {
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

export const FUSO_HORARIO_BRASILIA = 'America/Sao_Paulo'

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

/**
 * Formata a data atual em formato de Brasília (America/Sao_Paulo) para exibição simples (ex.: 24/02/2026).
 */
export function formatDateBrasilia(value: Date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO_BRASILIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value)
}

/**
 * Formata a data por extenso usando estritamente o fuso horário oficial de Brasília (America/Sao_Paulo),
 * garantindo que usuários em outros fusos vejam o dia correto de Brasília.
 * Exemplo: "segunda-feira, 24 de fevereiro de 2026"
 */
export function formatDateLong(value: Date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO_BRASILIA,
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
