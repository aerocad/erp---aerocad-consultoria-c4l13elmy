import { firstName } from './crm'

export const FUSO_HORARIO_BRASILIA = 'America/Sao_Paulo'

export type SaudacaoPeriodo = 'Bom dia' | 'Boa tarde' | 'Boa noite'

/**
 * Obtém a hora atual (0 a 23) no fuso horário oficial de Brasília (America/Sao_Paulo),
 * independentemente do fuso horário configurado no dispositivo do usuário.
 */
export function obterHoraBrasilia(referencia: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_HORARIO_BRASILIA,
      hour: 'numeric',
      hourCycle: 'h23',
    })
    const parts = formatter.formatToParts(referencia)
    const hourPart = parts.find((p) => p.type === 'hour')
    if (hourPart) {
      const parsed = parseInt(hourPart.value, 10)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
    const formatted = formatter.format(referencia)
    const fallbackParsed = parseInt(formatted, 10)
    return Number.isNaN(fallbackParsed) ? referencia.getHours() : fallbackParsed
  } catch {
    // Fallback defensivo em caso de runtime sem suporte ao fuso
    return referencia.getHours()
  }
}

/**
 * Retorna a saudação de acordo com o fuso horário de Brasília (America/Sao_Paulo):
 * - "Bom dia" das 05:00 às 11:59 (hora 5 a 11)
 * - "Boa tarde" das 12:00 às 17:59 (hora 12 a 17)
 * - "Boa noite" das 18:00 às 04:59 (hora 18 a 23 e 0 a 4)
 *
 * @param referencia Date opcional para cálculo (útil para testes ou simulações)
 */
export function saudacaoPorHora(referencia: Date = new Date()): SaudacaoPeriodo {
  const hora = obterHoraBrasilia(referencia)
  if (hora >= 5 && hora < 12) {
    return 'Bom dia'
  }
  if (hora >= 12 && hora < 18) {
    return 'Boa tarde'
  }
  return 'Boa noite'
}

/**
 * Monta a frase completa de saudação com o nome do usuário.
 * Exemplo:
 * - montarSaudacao('Cleyton Saraiva') -> "Bom dia, Cleyton"
 * - montarSaudacao('') -> "Bom dia" ou "Bom dia, equipe" conforme fallback
 *
 * @param name Nome completo ou parcial do usuário
 * @param options Opções adicionais (usarPrimeiroNome, fallbackSemNome, dataReferencia)
 */
export function montarSaudacao(
  name?: string | null,
  options?: {
    referencia?: Date
    usarPrimeiroNome?: boolean
    incluirEquipeFallback?: boolean
  },
): string {
  const { referencia, usarPrimeiroNome = true, incluirEquipeFallback = false } = options || {}
  const saudacao = saudacaoPorHora(referencia)

  if (!name || !name.trim()) {
    return incluirEquipeFallback ? `${saudacao}, equipe` : saudacao
  }

  const nomeFormatado = usarPrimeiroNome ? firstName(name) : name.trim()
  return `${saudacao}, ${nomeFormatado}`
}
