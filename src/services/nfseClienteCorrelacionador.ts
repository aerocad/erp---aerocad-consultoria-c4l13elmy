import type { ClienteRecord } from '@/types/crm'
import { formatarDocumento, limparDocumento, normalizarChave } from './importacaoParser'
import { calcularSimilaridadeTexto } from './nfseCorrelacionador'
import type { NfseDadoExtraido } from './nfseParser'

export type StatusClienteNfse = 'existente' | 'novo' | 'conflito'

export type AcaoClienteNfse = 'vincular' | 'criar' | 'ignorar'

export interface TomadorExtraidoNfse {
  // Chave identificadora única no lote (CNPJ/CPF limpo ou razão social normalizada)
  chaveGrupo: string
  cnpjCpf: string
  cnpjCpfFormatado: string
  razaoSocial: string
  tipo: 'pj' | 'pf'
  endereco: string
  municipio: string
  uf: string
  email: string
  telefone: string
  // Quantitativos no lote
  qtdNotas: number
  valorTotal: number
  numerosNotas: string[]
  // Correlação com clientes do CRM
  status: StatusClienteNfse
  clienteExistente?: ClienteRecord
  motivoStatus: string
  // Ação configurada pelo usuário
  acao: AcaoClienteNfse
  clienteIdDestino?: string
  atualizarDadosFaltantes: boolean
}

/**
 * Agrupa notas por tomador e correlaciona com a lista existente de clientes do CRM
 */
export function agruparECorrelacionarTomadores(
  notas: NfseDadoExtraido[],
  clientesExistentes: ClienteRecord[],
): TomadorExtraidoNfse[] {
  // Mapas para busca rápida
  const mapPorDoc = new Map<string, ClienteRecord>()
  const mapPorRazao = new Map<string, ClienteRecord>()

  for (const c of clientesExistentes) {
    const docLimpo = limparDocumento(c.cnpj_cpf)
    if (docLimpo) mapPorDoc.set(docLimpo, c)
    const normRazao = normalizarChave(c.razao_social)
    if (normRazao) mapPorRazao.set(normRazao, c)
  }

  // Agrupamento de notas por tomador (chave primária: CNPJ/CPF limpo; secundária: razão social)
  const grupos = new Map<
    string,
    {
      notas: NfseDadoExtraido[]
      cnpjCpf: string
      razaoSocial: string
      endereco: string
      municipio: string
      uf: string
      email: string
      telefone: string
    }
  >()

  for (const n of notas) {
    const doc = limparDocumento(n.tomadorCnpjCpf)
    const razao = (n.tomadorRazao || '').trim() || 'Tomador não informado'
    const chave = doc ? `doc_${doc}` : `razao_${normalizarChave(razao)}`

    let grp = grupos.get(chave)
    if (!grp) {
      grp = {
        notas: [],
        cnpjCpf: doc,
        razaoSocial: razao,
        endereco: n.tomadorEndereco || '',
        municipio: n.tomadorMunicipio || '',
        uf: n.tomadorUf || '',
        email: n.tomadorEmail || '',
        telefone: n.tomadorTelefone || '',
      }
      grupos.set(chave, grp)
    }

    grp.notas.push(n)
    // Complementa dados cadastrais caso venham em outra nota do mesmo tomador
    if (!grp.endereco && n.tomadorEndereco) grp.endereco = n.tomadorEndereco
    if (!grp.municipio && n.tomadorMunicipio) grp.municipio = n.tomadorMunicipio
    if (!grp.uf && n.tomadorUf) grp.uf = n.tomadorUf
    if (!grp.email && n.tomadorEmail) grp.email = n.tomadorEmail
    if (!grp.telefone && n.tomadorTelefone) grp.telefone = n.tomadorTelefone
    if (grp.razaoSocial === 'Tomador não informado' && razao !== 'Tomador não informado') {
      grp.razaoSocial = razao
    }
    if (!grp.cnpjCpf && doc) {
      grp.cnpjCpf = doc
    }
  }

  const resultado: TomadorExtraidoNfse[] = []

  for (const [chaveGrupo, dados] of grupos.entries()) {
    const docLimpo = dados.cnpjCpf
    const valorTotal = dados.notas.reduce((acc, cur) => acc + (cur.valorBruto || 0), 0)
    const numerosNotas = Array.from(new Set(dados.notas.map((n) => n.numero).filter(Boolean)))
    const tipo: 'pj' | 'pf' = docLimpo.length === 11 ? 'pf' : 'pj'
    const cnpjCpfFormatado = formatarDocumento(docLimpo)

    // Avaliação de correlação com base existente
    let status: StatusClienteNfse = 'novo'
    let clienteExistente: ClienteRecord | undefined
    let motivoStatus = 'Nenhum cliente correspondente encontrado no CRM (novo cliente potencial).'
    let acaoDefault: AcaoClienteNfse = 'criar'
    let clienteIdDestino: string | undefined

    // 1. Busca por documento
    if (docLimpo && mapPorDoc.has(docLimpo)) {
      const matchDoc = mapPorDoc.get(docLimpo)!
      clienteExistente = matchDoc
      clienteIdDestino = matchDoc.id

      // Verifica se a razão social difere de forma relevante
      const sim = calcularSimilaridadeTexto(matchDoc.razao_social, dados.razaoSocial)
      if (sim < 0.45 && dados.razaoSocial !== 'Tomador não informado') {
        status = 'conflito'
        motivoStatus = `Mesmo documento com razão social divergente: "${matchDoc.razao_social}" vs "${dados.razaoSocial}".`
        acaoDefault = 'vincular'
      } else {
        status = 'existente'
        motivoStatus = `Documento correspondente ao cliente cadastrado: "${matchDoc.razao_social}".`
        acaoDefault = 'vincular'
      }
    } else {
      // 2. Busca por Razão Social exata ou similaridade alta
      const normRazao = normalizarChave(dados.razaoSocial)
      if (normRazao && mapPorRazao.has(normRazao)) {
        const matchRazao = mapPorRazao.get(normRazao)!
        clienteExistente = matchRazao
        clienteIdDestino = matchRazao.id
        status = 'existente'
        motivoStatus = `Razão social coincide exatamente com "${matchRazao.razao_social}".`
        acaoDefault = 'vincular'
      } else if (normRazao && normRazao.length > 3) {
        // Busca similaridade
        let melhorMatch: { cliente: ClienteRecord; score: number } | null = null
        for (const c of clientesExistentes) {
          const sim = calcularSimilaridadeTexto(c.razao_social, dados.razaoSocial)
          if (sim >= 0.75 && (!melhorMatch || sim > melhorMatch.score)) {
            melhorMatch = { cliente: c, score: sim }
          }
        }
        if (melhorMatch) {
          clienteExistente = melhorMatch.cliente
          clienteIdDestino = melhorMatch.cliente.id
          status = 'existente'
          motivoStatus = `Nome muito similar (${Math.round(melhorMatch.score * 100)}%): "${melhorMatch.cliente.razao_social}".`
          acaoDefault = 'vincular'
        }
      }
    }

    resultado.push({
      chaveGrupo,
      cnpjCpf: docLimpo,
      cnpjCpfFormatado,
      razaoSocial: dados.razaoSocial,
      tipo,
      endereco: dados.endereco,
      municipio: dados.municipio,
      uf: dados.uf,
      email: dados.email,
      telefone: dados.telefone,
      qtdNotas: dados.notas.length,
      valorTotal,
      numerosNotas,
      status,
      clienteExistente,
      motivoStatus,
      acao: acaoDefault,
      clienteIdDestino,
      atualizarDadosFaltantes: true,
    })
  }

  // Ordena: conflitos primeiro, depois novos, depois existentes; dentro de cada categoria por valor total decrescente
  const ordemStatus: Record<StatusClienteNfse, number> = {
    conflito: 1,
    novo: 2,
    existente: 3,
  }

  return resultado.sort((a, b) => {
    const diffStatus = ordemStatus[a.status] - ordemStatus[b.status]
    if (diffStatus !== 0) return diffStatus
    return b.valorTotal - a.valorTotal
  })
}
