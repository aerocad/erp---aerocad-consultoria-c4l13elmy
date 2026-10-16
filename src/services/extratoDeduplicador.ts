/**
 * Serviço de Deduplicação de Extratos Bancários e Arquivos de Retorno (.RET).
 *
 * Garante que:
 * 1. O MESMO arquivo reimportado acidentalmente seja detectado (por SHA-256 e/ou 100% de transações já existentes)
 *    e impeça a criação de lançamentos duplicados.
 * 2. Arquivos diferentes com lançamentos sobrepostos (ex.: .RET e OFX do mesmo período, ou dois extratos mensais sobrepostos)
 *    tenham suas duplicatas filtradas cirurgicamente, gravando apenas os lançamentos novos.
 * 3. Chave de fingerprint determinística baseada na conta bancária (ou identificador da conta),
 *    data (YYYY-MM-DD), valor em centavos fixos, tipo (entrada/saida) e identificador forte quando houver
 *    (nosso número, fitid estável, ou descrição normalizada).
 * 4. Idempotência e tolerância a pequenas variações de formatação de descrição.
 */

import type { ExtratoRecord, ExtratoTransacaoRecord } from '@/types/crm'

export interface TransacaoCandidataImportacao {
  data: string // YYYY-MM-DD ou ISO
  valor: number
  tipo: 'entrada' | 'saida'
  descricao: string
  documentoRef?: string
  fitid?: string
  nossoNumero?: string
  observacoes?: string
}

export interface ResultadoDeduplicacaoTransacao<T extends TransacaoCandidataImportacao> {
  item: T
  fingerprint: string
  isDuplicada: boolean
  motivoDuplicidade?: string
  transacaoExistenteId?: string
  extratoExistenteId?: string
}

export interface AnaliseDeduplicacaoArquivo<T extends TransacaoCandidataImportacao> {
  arquivoNome: string
  hashArquivo?: string
  arquivoJaImportado: boolean
  extratoExistenteCorrespondente?: ExtratoRecord
  totalCandidatas: number
  totalNovas: number
  totalDuplicadas: number
  totalEntradasNovas: number
  totalSaidasNovas: number
  itensNovos: Array<ResultadoDeduplicacaoTransacao<T>>
  itensDuplicados: Array<ResultadoDeduplicacaoTransacao<T>>
}

/**
 * Normaliza data para string YYYY-MM-DD
 */
export function normalizarDataChave(dataStr: string): string {
  if (!dataStr) return ''
  const limpo = dataStr.trim().replace(/T.*$/, '').replace(/\s.*$/, '')
  // Padrão YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    return limpo
  }
  // Padrão DD/MM/AAAA
  const brMatch = limpo.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
  }
  // Fallback extraindo os 10 primeiros caracteres caso seja ISO
  return dataStr.slice(0, 10)
}

/**
 * Normaliza descrição para comparação robusta
 * Remove acentos, pontuação, múltiplos espaços e converte para minúsculas
 */
export function normalizarDescricaoComparacao(desc: string): string {
  if (!desc) return ''
  return desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza identificadores como Nosso Número ou Número de Documento (apenas dígitos/letras sem zeros à esquerda)
 */
export function normalizarIdentificador(idStr?: string): string {
  if (!idStr) return ''
  const limpo = idStr
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  // Remove zeros à esquerda apenas se for totalmente numérico e tiver tamanho > 1
  if (/^\d+$/.test(limpo)) {
    return limpo.replace(/^0+/, '') || '0'
  }
  return limpo
}

/**
 * Gera hash SHA-256 do conteúdo de um File ou string no navegador
 */
export async function calcularHashArquivo(conteudo: File | ArrayBuffer | string): Promise<string> {
  try {
    let buffer: ArrayBuffer
    if (typeof conteudo === 'string') {
      buffer = new TextEncoder().encode(conteudo).buffer
    } else if (conteudo instanceof File) {
      buffer = await conteudo.arrayBuffer()
    } else {
      buffer = conteudo
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch (err) {
    console.warn('Falha ao calcular SHA-256 via crypto.subtle, gerando hash fallback:', err)
  }

  // Fallback rápido baseado em string caso crypto.subtle não esteja disponível
  const str = typeof conteudo === 'string' ? conteudo : String(conteudo)
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return `hash_${Math.abs(h).toString(16)}`
}

/**
 * Calcula o Fingerprint determinístico de uma transação.
 * Estrutura da chave:
 * contaBancariaId + '|' + dataYYYY-MM-DD + '|' + valorCentavos + '|' + tipo + '|' + (idForte || descNormalizada)
 */
export function calcularFingerprintTransacao(
  tx: {
    data: string
    valor: number
    tipo: 'entrada' | 'saida'
    descricao: string
    documentoRef?: string
    nossoNumero?: string
    fitid?: string
  },
  contaIdOuNumero = 'geral',
): string {
  const conta = (contaIdOuNumero || 'geral').trim().toLowerCase()
  const data = normalizarDataChave(tx.data)
  const centavos = Math.round(Math.abs(tx.valor) * 100)
  const tipo = tx.tipo === 'saida' ? 'S' : 'E'

  // Identificador forte: se houver nosso número ou documento de referência
  const nossoNumNorm = normalizarIdentificador(tx.nossoNumero)
  const docRefNorm = normalizarIdentificador(tx.documentoRef)
  const idForte = nossoNumNorm || docRefNorm

  let elementoDistintivo = ''
  if (idForte && idForte.length >= 3) {
    // Usa o identificador do banco (nosso número / documento)
    elementoDistintivo = `id:${idForte}`
  } else {
    // Usa primeiros 32 caracteres da descrição normalizada
    const descNorm = normalizarDescricaoComparacao(tx.descricao).slice(0, 32)
    elementoDistintivo = `desc:${descNorm}`
  }

  return `fp_${conta}_${data}_${centavos}_${tipo}_${elementoDistintivo}`
}

/**
 * Calcula chave secundária para tolerância quando duas descrições variam levemente
 * mas pertencem à mesma conta, data, valor e sentido
 */
export function calcularChaveSecundaria(
  tx: {
    data: string
    valor: number
    tipo: 'entrada' | 'saida'
  },
  contaIdOuNumero = 'geral',
): string {
  const conta = (contaIdOuNumero || 'geral').trim().toLowerCase()
  const data = normalizarDataChave(tx.data)
  const centavos = Math.round(Math.abs(tx.valor) * 100)
  const tipo = tx.tipo === 'saida' ? 'S' : 'E'
  return `sec_${conta}_${data}_${centavos}_${tipo}`
}

/**
 * Analisa e deduplica uma lista de transações candidatas contra a base existente
 */
export function analisarDeduplicacao<T extends TransacaoCandidataImportacao>(params: {
  arquivoNome: string
  arquivoHash?: string
  contaBancariaId?: string
  contaNumero?: string
  transacoesCandidatas: T[]
  transacoesExistentes: ExtratoTransacaoRecord[]
  extratosExistentes?: ExtratoRecord[]
}): AnaliseDeduplicacaoArquivo<T> {
  const {
    arquivoNome,
    arquivoHash,
    contaBancariaId,
    contaNumero,
    transacoesCandidatas,
    transacoesExistentes,
    extratosExistentes = [],
  } = params

  const identificadorConta = contaBancariaId || contaNumero || 'geral'

  // 1. Verifica se o mesmo arquivo já foi importado por hash exato ou pelo nome
  let extratoCorrespondente: ExtratoRecord | undefined
  if (arquivoHash) {
    extratoCorrespondente = extratosExistentes.find(
      (e) => e.hash_arquivo && e.hash_arquivo === arquivoHash,
    )
  }
  if (!extratoCorrespondente) {
    extratoCorrespondente = extratosExistentes.find(
      (e) =>
        e.nome_arquivo === arquivoNome &&
        (!contaBancariaId || !e.conta_bancaria || e.conta_bancaria === contaBancariaId),
    )
  }

  // 2. Constrói índices em memória das transações existentes da mesma conta
  // Mapa por fingerprint primário
  const mapaExistentesPorFingerprint = new Map<string, ExtratoTransacaoRecord>()
  // Mapa por chave secundária (conta + data + valor + tipo) para transações existentes
  const mapaExistentesPorChaveSecundaria = new Map<string, ExtratoTransacaoRecord[]>()
  // Set de IDs de transações existentes já casadas nesta rodada para evitar colisão 1:N
  const transacoesExistentesUsadas = new Set<string>()

  // Filtra transações existentes para dar prioridade àquelas da mesma conta (se houver vínculo com o extrato)
  const extratosDaContaIds = new Set(
    extratosExistentes
      .filter((e) => {
        if (!contaBancariaId) return true
        return e.conta_bancaria === contaBancariaId || e.conta === contaNumero
      })
      .map((e) => e.id),
  )

  for (const exTx of transacoesExistentes) {
    // Se a transação pertence a um extrato de outra conta bancária totalmente diferente, pula
    if (contaBancariaId && exTx.extrato && !extratosDaContaIds.has(exTx.extrato)) {
      continue
    }

    // Fingerprint gravado no banco ou calculado on-the-fly
    const fp =
      exTx.fingerprint ||
      calcularFingerprintTransacao(
        {
          data: exTx.data,
          valor: exTx.valor,
          tipo: exTx.tipo,
          descricao: exTx.descricao,
          documentoRef: exTx.documento_ref,
          fitid: exTx.fitid,
        },
        identificadorConta,
      )

    mapaExistentesPorFingerprint.set(fp, exTx)

    const secKey = calcularChaveSecundaria(
      {
        data: exTx.data,
        valor: exTx.valor,
        tipo: exTx.tipo,
      },
      identificadorConta,
    )
    const lista = mapaExistentesPorChaveSecundaria.get(secKey) || []
    lista.push(exTx)
    mapaExistentesPorChaveSecundaria.set(secKey, lista)
  }

  // 3. Itera sobre cada transação candidata da importação
  // Também rastreia duplicatas internas dentro do próprio lote a ser importado
  const fingerprintsNoLote = new Set<string>()
  const chavesSecNoLote = new Map<string, number>()

  const itensNovos: Array<ResultadoDeduplicacaoTransacao<T>> = []
  const itensDuplicados: Array<ResultadoDeduplicacaoTransacao<T>> = []

  let totalEntradasNovas = 0
  let totalSaidasNovas = 0

  for (const item of transacoesCandidatas) {
    const fp = calcularFingerprintTransacao(item, identificadorConta)
    const secKey = calcularChaveSecundaria(item, identificadorConta)

    // A) Verifica se já duplicou dentro do próprio arquivo atual
    if (fingerprintsNoLote.has(fp)) {
      itensDuplicados.push({
        item,
        fingerprint: fp,
        isDuplicada: true,
        motivoDuplicidade: 'Transação idêntica duplicada dentro do próprio arquivo importado.',
      })
      continue
    }

    // B) Verifica se já existe por fingerprint exato no banco
    const existenteExato = mapaExistentesPorFingerprint.get(fp)
    if (existenteExato && !transacoesExistentesUsadas.has(existenteExato.id)) {
      transacoesExistentesUsadas.add(existenteExato.id)
      itensDuplicados.push({
        item,
        fingerprint: fp,
        isDuplicada: true,
        motivoDuplicidade: `Já registrado no banco (Extrato ref. ${existenteExato.extrato || 'anterior'}) em ${normalizarDataChave(existenteExato.data)}.`,
        transacaoExistenteId: existenteExato.id,
        extratoExistenteId: existenteExato.extrato,
      })
      continue
    }

    // C) Verifica se há correspondência na chave secundária (mesma data, mesmo valor centavos, mesmo tipo, descrição similar)
    const candidatosSec = mapaExistentesPorChaveSecundaria.get(secKey) || []
    const candidatoNaoUsado = candidatosSec.find((c) => !transacoesExistentesUsadas.has(c.id))

    if (candidatoNaoUsado) {
      // Se tiver mesmo documento/nosso número ou descrição muito similar
      const docItem = normalizarIdentificador(item.documentoRef || item.nossoNumero)
      const docExistente = normalizarIdentificador(
        candidatoNaoUsado.documento_ref || candidatoNaoUsado.fitid,
      )

      const descItemNorm = normalizarDescricaoComparacao(item.descricao)
      const descExNorm = normalizarDescricaoComparacao(candidatoNaoUsado.descricao)

      const matchDoc = docItem && docExistente && docItem === docExistente
      const matchDesc =
        descItemNorm === descExNorm ||
        (descItemNorm.length > 5 &&
          descExNorm.length > 5 &&
          (descItemNorm.includes(descExNorm) || descExNorm.includes(descItemNorm)))

      if (matchDoc || matchDesc) {
        transacoesExistentesUsadas.add(candidatoNaoUsado.id)
        itensDuplicados.push({
          item,
          fingerprint: fp,
          isDuplicada: true,
          motivoDuplicidade: `Lançamento coincidente no banco (mesma data ${normalizarDataChave(candidatoNaoUsado.data)}, valor R$ ${item.valor.toFixed(2)} e descrição equivalente).`,
          transacaoExistenteId: candidatoNaoUsado.id,
          extratoExistenteId: candidatoNaoUsado.extrato,
        })
        continue
      }
    }

    // D) Transação é genuinamente nova!
    fingerprintsNoLote.add(fp)
    chavesSecNoLote.set(secKey, (chavesSecNoLote.get(secKey) || 0) + 1)

    itensNovos.push({
      item,
      fingerprint: fp,
      isDuplicada: false,
    })

    if (item.tipo === 'entrada') {
      totalEntradasNovas += item.valor
    } else {
      totalSaidasNovas += item.valor
    }
  }

  // Determina se o arquivo é 100% duplicado (reimportação acidental)
  const arquivoJaImportado =
    (!!extratoCorrespondente && transacoesCandidatas.length > 0 && itensNovos.length === 0) ||
    (transacoesCandidatas.length > 0 && itensNovos.length === 0)

  return {
    arquivoNome,
    hashArquivo: arquivoHash,
    arquivoJaImportado,
    extratoExistenteCorrespondente: extratoCorrespondente,
    totalCandidatas: transacoesCandidatas.length,
    totalNovas: itensNovos.length,
    totalDuplicadas: itensDuplicados.length,
    totalEntradasNovas,
    totalSaidasNovas,
    itensNovos,
    itensDuplicados,
  }
}
