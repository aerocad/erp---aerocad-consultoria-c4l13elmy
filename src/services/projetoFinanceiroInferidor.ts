import type { ParcelaRecord, ProjetoRecord } from '@/types/crm'

export type StatusFinanceiroProjeto =
  | 'faturamento_integral' // Soma das notas >= valor global (tolerância de centavos R$ 0.05)
  | 'pagamento_parcial' // 0 < soma das notas < valor global
  | 'sem_nfse' // Nenhuma nota vinculada (ou soma == 0)

export interface ResumoFinanceiroProjeto {
  projetoId: string
  valorGlobalContratado: number // Valor global do projeto (ou soma das parcelas se projeto.valor_global não estiver preenchido)
  totalFaturadoNfse: number // Soma dos valores nominais das notas fiscais vinculadas
  saldoAFaturar: number // Math.max(0, valorGlobalContratado - totalFaturadoNfse)
  percentualFaturado: number // 0 a 100 (ou mais se notas > valor global)
  statusFinanceiro: StatusFinanceiroProjeto
  quantidadeNotas: number
  numerosNotas: string[]
  totalParcelas: number
  totalRecebido: number
}

// Tolerância em reais para considerar faturamento integral (arredondamento/centavos)
const TOLERANCIA_CENTAVOS = 0.05

/**
 * Calcula o resumo financeiro de um único projeto com base em suas parcelas e notas vinculadas.
 */
export function calcularResumoFinanceiroProjeto(
  projeto: ProjetoRecord,
  parcelasDoProjeto: ParcelaRecord[],
): ResumoFinanceiroProjeto {
  // 1. Identificar o valor global contratado
  // Prioridade: projeto.valor_global se > 0; senão a soma dos valores das parcelas cadastradas
  const valorGlobalDefinido = Number(projeto.valor_global) || 0
  const somaParcelas = parcelasDoProjeto.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
  const valorGlobalContratado = valorGlobalDefinido > 0 ? valorGlobalDefinido : somaParcelas

  // 2. Coletar parcelas que possuem NFS-e vinculada
  // Uma parcela tem NFS-e se possui nf_numero ou nfse_chave ou nfse_dados preenchidos
  const parcelasComNota = parcelasDoProjeto.filter(
    (p) => Boolean(p.nf_numero?.trim()) || Boolean(p.nfse_chave?.trim()) || Boolean(p.nfse_dados),
  )

  const numerosNotasSet = new Set<string>()
  parcelasComNota.forEach((p) => {
    if (p.nf_numero?.trim()) {
      numerosNotasSet.add(p.nf_numero.trim())
    }
  })

  // 3. Somar valor nominal faturado nas notas vinculadas
  // Se nfse_dados contiver valorBruto/valorLiquido usamos, senão o valor da parcela faturada
  const totalFaturadoNfse = parcelasComNota.reduce((acc, p) => {
    let valorNota = Number(p.valor) || 0
    if (p.nfse_dados && typeof p.nfse_dados === 'object') {
      const vb = (p.nfse_dados as Record<string, unknown>).valorBruto
      if (typeof vb === 'number' && vb > 0) {
        valorNota = vb
      }
    }
    return acc + valorNota
  }, 0)

  // 4. Total recebido (baixas)
  const totalRecebido = parcelasDoProjeto
    .filter((p) => p.status === 'paga')
    .reduce((acc, p) => acc + (Number(p.valor_recebido) || Number(p.valor) || 0), 0)

  // 5. Percentual faturado
  const percentualFaturado =
    valorGlobalContratado > 0
      ? Math.round((totalFaturadoNfse / valorGlobalContratado) * 100)
      : totalFaturadoNfse > 0
        ? 100
        : 0

  // 6. Classificar status financeiro / conclusão
  let statusFinanceiro: StatusFinanceiroProjeto = 'sem_nfse'

  if (parcelasComNota.length === 0 || totalFaturadoNfse <= 0) {
    statusFinanceiro = 'sem_nfse'
  } else if (
    valorGlobalContratado > 0 &&
    totalFaturadoNfse >= valorGlobalContratado - TOLERANCIA_CENTAVOS
  ) {
    statusFinanceiro = 'faturamento_integral'
  } else if (valorGlobalContratado === 0 && totalFaturadoNfse > 0) {
    // Se não havia valor global prévio mas há notas faturadas
    statusFinanceiro = 'faturamento_integral'
  } else {
    statusFinanceiro = 'pagamento_parcial'
  }

  const saldoAFaturar = Math.max(0, valorGlobalContratado - totalFaturadoNfse)

  return {
    projetoId: projeto.id,
    valorGlobalContratado,
    totalFaturadoNfse,
    saldoAFaturar,
    percentualFaturado,
    statusFinanceiro,
    quantidadeNotas: parcelasComNota.length,
    numerosNotas: Array.from(numerosNotasSet),
    totalParcelas: parcelasDoProjeto.length,
    totalRecebido,
  }
}

/**
 * Mapeia múltiplos projetos para seus respectivos resumos financeiros
 */
export function calcularResumoFinanceiroTodosProjetos(
  projetos: ProjetoRecord[],
  todasParcelas: ParcelaRecord[],
): Map<string, ResumoFinanceiroProjeto> {
  const parcelasPorProjeto = new Map<string, ParcelaRecord[]>()

  for (const parcela of todasParcelas) {
    if (!parcela.projeto) continue
    const lista = parcelasPorProjeto.get(parcela.projeto) || []
    lista.push(parcela)
    parcelasPorProjeto.set(parcela.projeto, lista)
  }

  const resultado = new Map<string, ResumoFinanceiroProjeto>()

  for (const projeto of projetos) {
    const parcelas = parcelasPorProjeto.get(projeto.id) || []
    resultado.set(projeto.id, calcularResumoFinanceiroProjeto(projeto, parcelas))
  }

  return resultado
}

/**
 * Retorna configurações visuais de badge para o status financeiro de um projeto
 */
export function getStatusFinanceiroBadgeConfig(resumo?: ResumoFinanceiroProjeto): {
  label: string
  sublabel?: string
  tone: 'green' | 'orange' | 'gray' | 'red'
  badgeClass: string
  descricao: string
} {
  if (!resumo || resumo.statusFinanceiro === 'sem_nfse') {
    return {
      label: 'Sem NFS-e',
      tone: 'gray',
      badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      descricao: 'Nenhuma nota fiscal emitida ou vinculada até o momento',
    }
  }

  if (resumo.statusFinanceiro === 'faturamento_integral') {
    return {
      label: 'Faturado 100%',
      sublabel: 'Integral',
      tone: 'green',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
      descricao: 'Valor contratado integralmente coberto por notas fiscais vinculadas',
    }
  }

  return {
    label: `Parcial ${resumo.percentualFaturado}%`,
    sublabel: 'Faturamento parcial',
    tone: 'orange',
    badgeClass: 'bg-orange-50 text-[#D65100] border-[#FFD2B3] font-semibold',
    descricao: `Faturamento parcial cobrindo ${resumo.percentualFaturado}% do valor global`,
  }
}
