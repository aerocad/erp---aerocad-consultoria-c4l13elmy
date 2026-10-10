import pb from '@/lib/pocketbase/client'
import type { ClienteRecord, ParcelaRecord, ProjetoRecord } from '@/types/crm'
import { limparDocumento, normalizarChave } from './importacaoParser'
import type { NfseDadoExtraido } from './nfseParser'

export type StatusCorrelacao = 'CORRELACIONADA' | 'AMBÍGUA' | 'NÃO ENCONTRADA'

export interface ParcelaCandidata {
  parcela: ParcelaRecord
  projeto?: ProjetoRecord
  cliente?: ClienteRecord
  score: number
  motivosMatch: string[]
}

export interface NotaCorrelacionada {
  nota: NfseDadoExtraido
  status: StatusCorrelacao
  candidatas: ParcelaCandidata[]
  parcelaSelecionadaId?: string
  jaImportada?: boolean // Se a nota já está vinculada a essa parcela no banco
  chaveUnica: string
  acao: 'vincular' | 'ignorar'
  avisos: string[]
}

// Calcula similaridade simples entre duas strings normalizadas (0 a 1)
export function calcularSimilaridadeTexto(a: string, b: string): number {
  const normA = normalizarChave(a)
  const normB = normalizarChave(b)
  if (!normA || !normB) return 0
  if (normA === normB) return 1
  if (normA.includes(normB) || normB.includes(normA)) {
    const menor = Math.min(normA.length, normB.length)
    const maior = Math.max(normA.length, normB.length)
    return menor / maior
  }

  // Token matching (palavras em comum, ex: "AGROVALE", "AEROCAD", etc.)
  const tokensA = (a || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  const tokensB = (b || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (!tokensA.length || !tokensB.length) return 0

  let matches = 0
  for (const t of tokensA) {
    if (tokensB.some((tb) => tb.includes(t) || t.includes(tb))) {
      matches++
    }
  }
  return matches / Math.max(tokensA.length, tokensB.length)
}

// Compara valores com tolerância de R$ 1,00
export function valoresAproximados(val1: number, val2: number, tolerancia = 1.0): boolean {
  return Math.abs(val1 - val2) <= tolerancia
}

// Compara proximidade de datas em dias
export function diasEntreDatas(dataIso1?: string, dataIso2?: string): number {
  if (!dataIso1 || !dataIso2) return 9999
  const d1 = new Date(dataIso1).getTime()
  const d2 = new Date(dataIso2).getTime()
  if (isNaN(d1) || isNaN(d2)) return 9999
  return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)))
}

export interface ContextoCorrelacaoDb {
  parcelas: ParcelaRecord[]
  projetos: ProjetoRecord[]
  clientes: ClienteRecord[]
}

// Carrega dados necessários do PocketBase para a correlação
export async function carregarContextoCorrelacao(): Promise<ContextoCorrelacaoDb> {
  const [parcelas, projetos, clientes] = await Promise.all([
    pb.collection('parcelas').getFullList<ParcelaRecord>({
      sort: '-vencimento',
      expand: 'projeto,cliente',
      requestKey: null,
    }),
    pb.collection('projetos').getFullList<ProjetoRecord>({
      fields: 'id,numero,nome,cliente,id_planilha,numero_pc_pt,valor_global',
      requestKey: null,
    }),
    pb.collection('clientes').getFullList<ClienteRecord>({
      fields: 'id,razao_social,cnpj_cpf',
      requestKey: null,
    }),
  ])

  return { parcelas, projetos, clientes }
}

// Motor de correlação em cascata
export function correlacionarNotas(
  notas: NfseDadoExtraido[],
  contexto: ContextoCorrelacaoDb,
): NotaCorrelacionada[] {
  const { parcelas, projetos, clientes } = contexto

  // Mapas para busca rápida
  const mapProjetosPorId = new Map<string, ProjetoRecord>(projetos.map((p) => [p.id, p]))
  const mapClientesPorId = new Map<string, ClienteRecord>(clientes.map((c) => [c.id, c]))

  // Índices para busca em cascata
  // 1. Projeto por número AAAA-NNN (ex.: 2026-232)
  const mapProjetosPorNumero = new Map<string, ProjetoRecord>()
  projetos.forEach((p) => {
    if (p.numero) mapProjetosPorNumero.set(p.numero.trim().toUpperCase(), p)
  })

  // 2. Projeto por ID planilha (ex.: P001)
  const mapProjetosPorIdPlanilha = new Map<string, ProjetoRecord>()
  projetos.forEach((p) => {
    if (p.id_planilha) mapProjetosPorIdPlanilha.set(p.id_planilha.trim().toUpperCase(), p)
  })

  // 3. Propostas PC/PT
  const mapProjetosPorPcPt = new Map<string, ProjetoRecord>()
  projetos.forEach((p) => {
    if (p.numero_pc_pt) {
      const norm = normalizarChave(p.numero_pc_pt)
      if (norm) mapProjetosPorPcPt.set(norm, p)
    }
  })

  // 4. Clientes por CNPJ/CPF limpo
  const mapClientesPorDoc = new Map<string, ClienteRecord>()
  clientes.forEach((c) => {
    const doc = limparDocumento(c.cnpj_cpf)
    if (doc) mapClientesPorDoc.set(doc, c)
  })

  // Notas fiscais já registradas no banco (chave única: nf_numero ou nfse_chave)
  const parcelasComNf = new Map<string, ParcelaRecord>()
  parcelas.forEach((p) => {
    if (p.nf_numero) parcelasComNf.set(p.nf_numero.trim().toLowerCase(), p)
    if (p.nfse_chave) parcelasComNf.set(p.nfse_chave.trim().toLowerCase(), p)
  })

  const resultado: NotaCorrelacionada[] = []

  for (const nota of notas) {
    const avisos: string[] = []
    const chaveUnica = `${nota.numero}_${nota.prestadorCnpjCpf || 'aerocad'}`
    const candidatasComScore: ParcelaCandidata[] = []

    // Verificar se já existe parcela com esta nota
    const parcelaExistenteComNota =
      parcelasComNf.get(nota.numero.trim().toLowerCase()) ||
      parcelasComNf.get(chaveUnica.toLowerCase())

    // 1. Verificar menção direta de número de projeto na nota (ex.: 2026-001)
    let projetoMencionado: ProjetoRecord | undefined
    if (nota.projetoIdMencionado) {
      projetoMencionado =
        mapProjetosPorNumero.get(nota.projetoIdMencionado.toUpperCase()) ||
        mapProjetosPorIdPlanilha.get(nota.projetoIdMencionado.toUpperCase())
    }

    // 2. Verificar menção direta de proposta comercial/técnica
    let projetoPorProposta: ProjetoRecord | undefined
    if (nota.propostaMencionada) {
      const normProp = normalizarChave(nota.propostaMencionada)
      for (const [chavePcPt, proj] of mapProjetosPorPcPt.entries()) {
        if (normProp.includes(chavePcPt) || chavePcPt.includes(normProp)) {
          projetoPorProposta = proj
          break
        }
      }
    }

    // 3. Identificar cliente pelo CNPJ/CPF do tomador
    let clienteTomador: ClienteRecord | undefined
    if (nota.tomadorCnpjCpf) {
      clienteTomador = mapClientesPorDoc.get(nota.tomadorCnpjCpf)
    }

    // Avaliar cada parcela do banco contra esta nota
    for (const parc of parcelas) {
      const proj = parc.projeto ? mapProjetosPorId.get(parc.projeto) : undefined
      const cli = parc.cliente ? mapClientesPorId.get(parc.cliente) : undefined

      let score = 0
      const motivosMatch: string[] = []

      // (a) Se a parcela já tem exatamente essa NF
      if (
        (parc.nf_numero && parc.nf_numero.trim() === nota.numero.trim()) ||
        (parc.nfse_chave && parc.nfse_chave.trim() === chaveUnica)
      ) {
        score += 100
        motivosMatch.push(`NFS-e ${nota.numero} já associada a esta parcela no sistema`)
      }

      // (b) Match por Projeto AAAA-NNN ou ID Planilha
      if (projetoMencionado && proj && proj.id === projetoMencionado.id) {
        score += 45
        motivosMatch.push(`Projeto nº ${proj.numero} mencionado na nota`)
      }

      // (c) Match por Proposta PC/PT
      if (projetoPorProposta && proj && proj.id === projetoPorProposta.id) {
        score += 40
        motivosMatch.push(`Proposta ${proj.numero_pc_pt} identificada`)
      }

      // (d) Match por Cliente / Tomador
      // Por CNPJ/CPF exato
      if (
        clienteTomador &&
        cli &&
        (cli.id === clienteTomador.id ||
          limparDocumento(cli.cnpj_cpf) === limparDocumento(clienteTomador.cnpj_cpf))
      ) {
        score += 30
        motivosMatch.push(`CNPJ do tomador confere com o cliente (${cli.razao_social})`)
      } else if (cli && nota.tomadorRazao) {
        // Por similaridade de Razão Social
        const simRazao = calcularSimilaridadeTexto(cli.razao_social, nota.tomadorRazao)
        if (simRazao >= 0.75) {
          score += 25
          motivosMatch.push(
            `Razão Social coincidente (${Math.round(simRazao * 100)}%): ${cli.razao_social}`,
          )
        } else if (simRazao >= 0.45) {
          score += 15
          motivosMatch.push(`Nome do tomador similar: ${cli.razao_social}`)
        }
      }

      // (e) Match por Valor (± R$ 1,00)
      const mesmoValor = valoresAproximados(parc.valor, nota.valorBruto)
      const mesmoValorLiquido =
        nota.valorLiquido && valoresAproximados(parc.valor, nota.valorLiquido)
      if (mesmoValor || mesmoValorLiquido) {
        score += 30
        motivosMatch.push(
          `Valor da parcela coincide (R$ ${parc.valor.toFixed(2)} ≈ R$ ${nota.valorBruto.toFixed(2)})`,
        )
      } else if (valoresAproximados(parc.valor, nota.valorBruto, Math.max(50, parc.valor * 0.05))) {
        // Valor próximo (até 5% de tolerância para retenções não especificadas)
        score += 10
        motivosMatch.push(`Valor aproximado com tolerância de impostos/retenção`)
      }

      // (f) Proximidade de Data
      const refData = nota.dataRecebimento || nota.dataEmissao
      const diasVenc = diasEntreDatas(refData, parc.vencimento)
      const diasFat = diasEntreDatas(refData, parc.data_faturamento)
      const menorDias = Math.min(diasVenc, diasFat)

      if (menorDias <= 15) {
        score += 15
        motivosMatch.push(`Data próxima ao vencimento/faturamento (${menorDias} dias)`)
      } else if (menorDias <= 45) {
        score += 5
        motivosMatch.push(`Data no mesmo período do faturamento (${menorDias} dias)`)
      }

      // Se a parcela já estiver paga com outra nota diferente, reduz score ligeiramente
      if (parc.status === 'paga' && parc.nf_numero && parc.nf_numero !== nota.numero) {
        score -= 20
      }

      // Parcela só é considerada candidata se atingir score mínimo razoável
      if (score >= 35) {
        candidatasComScore.push({
          parcela: parc,
          projeto: proj,
          cliente: cli,
          score,
          motivosMatch,
        })
      }
    }

    // Ordenar candidatas pelo score decrescente
    candidatasComScore.sort((a, b) => b.score - a.score)

    // Classificação
    let statusCorrelacao: StatusCorrelacao = 'NÃO ENCONTRADA'
    let parcelaSelecionadaId: string | undefined
    let jaImportada = false

    if (parcelaExistenteComNota) {
      statusCorrelacao = 'CORRELACIONADA'
      parcelaSelecionadaId = parcelaExistenteComNota.id
      jaImportada = true
      avisos.push(`Nota já vinculada no banco à parcela "${parcelaExistenteComNota.descricao}".`)
    } else if (candidatasComScore.length === 1) {
      // Candidata única
      statusCorrelacao = 'CORRELACIONADA'
      parcelaSelecionadaId = candidatasComScore[0].parcela.id
    } else if (candidatasComScore.length > 1) {
      const top1 = candidatasComScore[0]
      const top2 = candidatasComScore[1]

      // Se a primeira tiver score muito superior (> 25 pts de diferença), correlaciona direto
      if (top1.score - top2.score >= 25) {
        statusCorrelacao = 'CORRELACIONADA'
        parcelaSelecionadaId = top1.parcela.id
      } else {
        // Ambiguidade real: usuário precisa escolher
        statusCorrelacao = 'AMBÍGUA'
        parcelaSelecionadaId = top1.parcela.id // Pré-seleciona a melhor, mas marca como ambígua
      }
    } else {
      statusCorrelacao = 'NÃO ENCONTRADA'
      avisos.push('Nenhuma parcela correspondente localizada com os critérios de busca.')
    }

    resultado.push({
      nota,
      status: statusCorrelacao,
      candidatas: candidatasComScore,
      parcelaSelecionadaId,
      jaImportada,
      chaveUnica,
      acao: statusCorrelacao === 'NÃO ENCONTRADA' ? 'ignorar' : 'vincular',
      avisos,
    })
  }

  return resultado
}
