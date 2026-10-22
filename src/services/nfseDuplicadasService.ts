import pb from '@/lib/pocketbase/client'
import type { ParcelaRecord } from '@/types/crm'
import type { NfseDadoExtraido } from './nfseParser'

export interface ItemNotaDuplicada {
  id: string
  origem: 'parcela' | 'orfa'
  numero: string
  chave: string
  descricao: string
  valor: number
  valorRecebido?: number
  vencimento?: string
  dataEmissao?: string
  dataPagamento?: string
  status: string
  origemRegistro?: string
  isGatilho?: boolean
  projetoId?: string
  projetoNumero?: string
  clienteId?: string
  clienteNome?: string
  tomadorRazao?: string
  tomadorCnpjCpf?: string
  prestadorCnpjCpf?: string
  codigoVerificacao?: string
  created?: string
  scoreCompletude: number
  isOriginalSugerida: boolean
  rawParcela?: ParcelaRecord
  rawOrfa?: NfseDadoExtraido
}

export interface GrupoNotasDuplicadas {
  chave: string
  numeroNf: string
  prestador: string
  tomadorRazaoOuDoc: string
  valorPadrao: number
  totalNotas: number
  valorTotalDuplicado: number // Soma das duplicatas além da primeira mantida
  notas: ItemNotaDuplicada[]
}

export interface ResumoDeduplicacao {
  totalGrupos: number
  totalDuplicatas: number
  valorTotalDuplicado: number
  grupos: GrupoNotasDuplicadas[]
}

/**
 * Normaliza CNPJ ou CPF para dígitos limpos
 */
function limparDoc(doc?: string | null): string {
  if (!doc) return ''
  return String(doc).replace(/\D/g, '')
}

/**
 * Extrai metadados estruturados da NFS-e (a partir de nfse_dados ou do registro)
 */
function extrairDadosNfse(p: ParcelaRecord): {
  prestadorCnpjCpf: string
  tomadorCnpjCpf: string
  tomadorRazao: string
  codigoVerificacao: string
  dataEmissao: string
  valorBruto?: number
  valorLiquido?: number
} {
  let prestadorCnpjCpf = 'aerocad'
  let tomadorCnpjCpf = ''
  let tomadorRazao = ''
  let codigoVerificacao = ''
  let dataEmissao = p.data_faturamento ? p.data_faturamento.slice(0, 10) : ''
  let valorBruto: number | undefined
  let valorLiquido: number | undefined

  const raw = (p as any).nfse_dados
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed) {
        if (parsed.prestadorCnpjCpf)
          prestadorCnpjCpf = limparDoc(parsed.prestadorCnpjCpf) || 'aerocad'
        if (parsed.tomadorCnpjCpf) tomadorCnpjCpf = limparDoc(parsed.tomadorCnpjCpf)
        if (parsed.tomadorRazao) tomadorRazao = String(parsed.tomadorRazao).trim()
        if (parsed.codigoVerificacao) codigoVerificacao = String(parsed.codigoVerificacao).trim()
        if (parsed.dataEmissao) dataEmissao = String(parsed.dataEmissao).slice(0, 10)
        if (parsed.valorBruto) valorBruto = Number(parsed.valorBruto)
        if (parsed.valorLiquido) valorLiquido = Number(parsed.valorLiquido)
      }
    } catch {
      /* parse silencioso */
    }
  }

  return {
    prestadorCnpjCpf,
    tomadorCnpjCpf,
    tomadorRazao,
    codigoVerificacao,
    dataEmissao,
    valorBruto,
    valorLiquido,
  }
}

/**
 * Gera chave de comparação robusta:
 * Prioridade:
 * 1. Código de Verificação único da NFS-e (se >= 6 chars) + prestador
 * 2. Número da NF + Prestador (CNPJ) + Tomador (CNPJ se existir)
 * 3. Chave única NFS-e (se preenchida)
 */
export function gerarChaveComparacaoRobusta(
  numeroNf: string,
  prestadorDoc?: string,
  tomadorDoc?: string,
  codigoVerificacao?: string,
  nfseChave?: string,
): string {
  const prestadorLimpo = limparDoc(prestadorDoc) || 'aerocad'
  const tomadorLimpo = limparDoc(tomadorDoc)
  const codLimpo = (codigoVerificacao || '').trim().toLowerCase()

  if (codLimpo && codLimpo.length >= 6) {
    return `cod_${codLimpo}_${prestadorLimpo}`
  }

  const numNorm =
    (numeroNf || '').trim().toLowerCase().replace(/^0+/, '') ||
    (numeroNf || '').trim().toLowerCase()

  if (numNorm) {
    let chave = `nf_${numNorm}_${prestadorLimpo}`
    if (tomadorLimpo) {
      chave += `_tom_${tomadorLimpo}`
    }
    return chave
  }

  if (nfseChave) {
    return `chave_${nfseChave.trim().toLowerCase()}`
  }

  return ''
}

/**
 * Calcula a completude de dados de uma nota para sugerir a melhor instância
 */
function calcularScoreNota(item: {
  projetoId?: string
  clienteId?: string
  status?: string
  dataPagamento?: string
  valorRecebido?: number
  temDadosFiscais?: boolean
  isGatilho?: boolean
}): number {
  let score = 0
  if (item.projetoId) score += 10
  if (item.clienteId) score += 5
  if (item.status === 'paga' || Boolean(item.dataPagamento)) score += 8
  if (item.temDadosFiscais) score += 4
  if (item.valorRecebido && item.valorRecebido > 0) score += 3
  if (item.isGatilho) score += 5 // Parcelas contratuais são a base original
  return score
}

/**
 * Detecta notas duplicadas a partir da lista de parcelas do banco e/ou da lista de órfãs em sessão
 */
export function detectarGruposDuplicadas(
  parcelas: ParcelaRecord[],
  notasOrfas: NfseDadoExtraido[] = [],
): ResumoDeduplicacao {
  const mapaGrupos = new Map<string, ItemNotaDuplicada[]>()

  // 1. Processar parcelas registradas no banco que possuem NFS-e
  for (const p of parcelas) {
    const nfNumero = (p.nf_numero || '').trim()
    const nfseChave = (p.nfse_chave || '').trim()

    if (!nfNumero && !nfseChave) continue

    const metadados = extrairDadosNfse(p)
    const chave = gerarChaveComparacaoRobusta(
      nfNumero,
      metadados.prestadorCnpjCpf,
      metadados.tomadorCnpjCpf,
      metadados.codigoVerificacao,
      nfseChave,
    )

    if (!chave) continue

    const isGatilho = p.origem === 'gatilho'
    const clienteNome =
      p.expand?.cliente?.razao_social || metadados.tomadorRazao || 'Tomador não informado'

    const score = calcularScoreNota({
      projetoId: p.projeto,
      clienteId: p.cliente,
      status: p.status,
      dataPagamento: p.data_pagamento,
      valorRecebido: p.valor_recebido,
      temDadosFiscais: Boolean((p as any).nfse_dados),
      isGatilho,
    })

    const item: ItemNotaDuplicada = {
      id: p.id,
      origem: 'parcela',
      numero: nfNumero || nfseChave,
      chave,
      descricao: p.descricao,
      valor: p.valor,
      valorRecebido: p.valor_recebido,
      vencimento: p.vencimento,
      dataEmissao: metadados.dataEmissao || p.data_faturamento,
      dataPagamento: p.data_pagamento,
      status: p.status,
      origemRegistro: p.origem,
      isGatilho,
      projetoId: p.projeto,
      projetoNumero: p.expand?.projeto?.numero,
      clienteId: p.cliente,
      clienteNome,
      tomadorRazao: metadados.tomadorRazao,
      tomadorCnpjCpf: metadados.tomadorCnpjCpf,
      prestadorCnpjCpf: metadados.prestadorCnpjCpf,
      codigoVerificacao: metadados.codigoVerificacao,
      created: p.created,
      scoreCompletude: score,
      isOriginalSugerida: false,
      rawParcela: p,
    }

    if (!mapaGrupos.has(chave)) {
      mapaGrupos.set(chave, [])
    }
    mapaGrupos.get(chave)!.push(item)
  }

  // 2. Processar órfãs em sessão (se houver duplicatas entre órfãs ou contra parcelas)
  for (const o of notasOrfas) {
    const num = (o.numero || '').trim()
    if (!num) continue

    const prestadorLimpo = limparDoc(o.prestadorCnpjCpf) || 'aerocad'
    const tomadorLimpo = limparDoc(o.tomadorCnpjCpf)
    const chave = gerarChaveComparacaoRobusta(
      num,
      prestadorLimpo,
      tomadorLimpo,
      o.codigoVerificacao,
    )

    if (!chave) continue

    const score = calcularScoreNota({
      temDadosFiscais: true,
      status: o.situacao === 'paga' ? 'paga' : 'pendente',
    })

    const item: ItemNotaDuplicada = {
      id: o.idTemp,
      origem: 'orfa',
      numero: num,
      chave,
      descricao: o.descricaoServico || `NFS-e avulsa nº ${num}`,
      valor: o.valorBruto,
      valorRecebido: o.valorLiquido,
      dataEmissao: o.dataEmissao,
      dataPagamento: o.dataRecebimento,
      status: o.situacao || 'pendente',
      origemRegistro: 'importacao_orfa',
      clienteNome: o.tomadorRazao || 'Tomador não informado',
      tomadorRazao: o.tomadorRazao,
      tomadorCnpjCpf: tomadorLimpo,
      prestadorCnpjCpf: prestadorLimpo,
      codigoVerificacao: o.codigoVerificacao,
      scoreCompletude: score,
      isOriginalSugerida: false,
      rawOrfa: o,
    }

    if (!mapaGrupos.has(chave)) {
      mapaGrupos.set(chave, [])
    }
    mapaGrupos.get(chave)!.push(item)
  }

  // 3. Montar grupos reais (onde a chave se repete 2 ou mais vezes)
  const grupos: GrupoNotasDuplicadas[] = []
  let totalDuplicatas = 0
  let valorTotalDuplicado = 0

  for (const [chave, lista] of mapaGrupos.entries()) {
    if (lista.length > 1) {
      // Ordenação primária: a mais antiga por `created` ou a que for parcela contratual
      lista.sort((a, b) => {
        // Se uma for de gatilho de contrato e a outra não, favorece gatilho
        if (a.isGatilho && !b.isGatilho) return -1
        if (!a.isGatilho && b.isGatilho) return 1

        // Parcela do banco tem precedência sobre órfã em memória
        if (a.origem === 'parcela' && b.origem === 'orfa') return -1
        if (a.origem === 'orfa' && b.origem === 'parcela') return 1

        // Data de criação mais antiga
        if (a.created && b.created) {
          return a.created.localeCompare(b.created)
        }
        return b.scoreCompletude - a.scoreCompletude
      })

      // Marca a primeira como a original sugerida
      lista[0].isOriginalSugerida = true

      const duplicadasDoGrupo = lista.slice(1)
      totalDuplicatas += duplicadasDoGrupo.length

      const valorDuplicadoGrupo = duplicadasDoGrupo.reduce((acc, d) => acc + (d.valor || 0), 0)
      valorTotalDuplicado += valorDuplicadoGrupo

      const tomadorIdentificado =
        lista.find((n) => n.tomadorRazao || n.clienteNome)?.tomadorRazao ||
        lista.find((n) => n.clienteNome)?.clienteNome ||
        'Tomador não especificado'

      grupos.push({
        chave,
        numeroNf: lista[0].numero,
        prestador: lista[0].prestadorCnpjCpf || 'aerocad',
        tomadorRazaoOuDoc: tomadorIdentificado,
        valorPadrao: lista[0].valor,
        totalNotas: lista.length,
        valorTotalDuplicado: valorDuplicadoGrupo,
        notas: lista,
      })
    }
  }

  // Ordena grupos pelo valor duplicado decrescente
  grupos.sort((a, b) => b.valorTotalDuplicado - a.valorTotalDuplicado)

  return {
    totalGrupos: grupos.length,
    totalDuplicatas,
    valorTotalDuplicado,
    grupos,
  }
}

/**
 * Consulta a rota do backend para detecção de duplicadas via hook PocketBase
 */
export async function buscarDuplicadasNoBackend(): Promise<{
  sucesso: boolean
  total_grupos: number
  total_duplicatas: number
  grupos: any[]
}> {
  try {
    const res = await fetch('/backend/v1/nfse/duplicadas', {
      method: 'GET',
      headers: {
        Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
      },
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(errJson.error || `Erro HTTP ${res.status}`)
    }

    return await res.json()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('Fallback: consulta backend de duplicadas indisponível, usando motor local:', msg)
    return {
      sucesso: false,
      total_grupos: 0,
      total_duplicatas: 0,
      grupos: [],
    }
  }
}

/**
 * Chama o backend com segurança para exclusão em lote de notas fiscais duplicadas
 * Verifica role admin e registra auditoria completa com snapshot anterior
 */
export async function excluirDuplicadasViaBackend(
  idsParaExcluir: string[],
  manterId: string,
  justificativa: string,
): Promise<{
  sucesso: boolean
  total_excluidas: number
  total_falhas: number
  excluidas: string[]
  falhas: any[]
}> {
  const res = await fetch('/backend/v1/nfse/excluir-duplicadas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
    },
    body: JSON.stringify({
      idsParaExcluir,
      manterId,
      justificativa,
    }),
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    throw new Error(errJson.error || errJson.message || `Erro HTTP ${res.status}`)
  }

  return await res.json()
}
