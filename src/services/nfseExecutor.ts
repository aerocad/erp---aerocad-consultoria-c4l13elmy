import pb from '@/lib/pocketbase/client'
import type { NotaCorrelacionada } from './nfseCorrelacionador'
import type { NfseDadoExtraido } from './nfseParser'

export interface ProgressoNfse {
  etapaAtual: string
  percentual: number
  total: number
  processadas: number
  vinculadas: number
  atualizadas: number
  ignoradas: number
  erros: number
}

export interface NfseExecucaoResultado {
  totalNotas: number
  vinculadas: number
  atualizadas: number
  orfas: NotaCorrelacionada[]
  erros: string[]
  logId?: string
}

export async function executarGravacaoNfse(
  notasCorrelacionadas: NotaCorrelacionada[],
  opcoes: {
    arquivoNome: string
    tamanhoBytes: number
    atualizarExistentes?: boolean
  },
  onProgress?: (p: ProgressoNfse) => void,
): Promise<NfseExecucaoResultado> {
  const currentUserId = pb.authStore.record?.id || ''

  const resultado: NfseExecucaoResultado = {
    totalNotas: notasCorrelacionadas.length,
    vinculadas: 0,
    atualizadas: 0,
    orfas: [],
    erros: [],
  }

  const total = notasCorrelacionadas.length
  let processadas = 0

  const reportar = (etapa: string) => {
    if (!onProgress) return
    const perc = total > 0 ? Math.round((processadas / total) * 100) : 100
    onProgress({
      etapaAtual: etapa,
      percentual: Math.min(100, Math.max(0, perc)),
      total,
      processadas,
      vinculadas: resultado.vinculadas,
      atualizadas: resultado.atualizadas,
      ignoradas: resultado.orfas.length,
      erros: resultado.erros.length,
    })
  }

  for (const item of notasCorrelacionadas) {
    processadas++
    const { nota, parcelaSelecionadaId, acao, jaImportada } = item

    if (acao === 'ignorar' || !parcelaSelecionadaId) {
      resultado.orfas.push(item)
      reportar(`NFS-e ${nota.numero} mantida como órfã`)
      continue
    }

    if (jaImportada && !opcoes.atualizarExistentes) {
      reportar(`NFS-e ${nota.numero} já cadastrada (ignorada)`)
      continue
    }

    try {
      // 1. Carregar parcela atual para manter dados e verificar projeto/cliente
      const parcelaDb = await pb.collection('parcelas').getOne(parcelaSelecionadaId, {
        expand: 'projeto,cliente',
      })

      // 2. Determinar novos status e datas
      const estaPaga =
        nota.situacao === 'paga' || Boolean(nota.dataRecebimento) || parcelaDb.status === 'paga'

      const dataPagamentoFinal =
        nota.dataRecebimento ||
        parcelaDb.data_pagamento ||
        (estaPaga ? nota.dataEmissao : undefined)

      const valorRecebidoFinal = estaPaga
        ? Number(nota.valorLiquido || nota.valorBruto || parcelaDb.valor)
        : parcelaDb.valor_recebido

      // 3. Montar payload da parcela
      const payloadParcela: Record<string, unknown> = {
        nf_numero: nota.numero,
        nfse_chave: item.chaveUnica,
        data_faturamento: nota.dataEmissao || parcelaDb.data_faturamento,
        retencoes: nota.retencoesTexto || parcelaDb.retencoes || '',
        nfse_dados: {
          serie: nota.serie || '',
          codigoVerificacao: nota.codigoVerificacao || '',
          valorBruto: nota.valorBruto,
          valorLiquido: nota.valorLiquido,
          retencoesTexto: nota.retencoesTexto,
          tomadorRazao: nota.tomadorRazao,
          tomadorCnpjCpf: nota.tomadorCnpjCpf,
          origemArquivo: nota.origemArquivo,
          dataEmissao: nota.dataEmissao,
          dataRecebimento: nota.dataRecebimento,
          situacao: nota.situacao,
          importadoEm: new Date().toISOString(),
          importadoPor: currentUserId,
        },
      }

      if (estaPaga) {
        payloadParcela.status = 'paga'
        payloadParcela.status_pagamento = 'Recebido (NFS-e)'
        if (dataPagamentoFinal) payloadParcela.data_pagamento = dataPagamentoFinal
        if (valorRecebidoFinal !== undefined) payloadParcela.valor_recebido = valorRecebidoFinal
      } else {
        payloadParcela.status_pagamento = 'Faturado com NFS-e'
      }

      await pb.collection('parcelas').update(parcelaSelecionadaId, payloadParcela)

      if (jaImportada) {
        resultado.atualizadas++
      } else {
        resultado.vinculadas++
      }

      // 4. Registrar atividade na timeline do projeto (se houver projeto vinculado)
      if (parcelaDb.projeto) {
        try {
          const valorFormatado = (nota.valorLiquido || nota.valorBruto).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
          const textoAtividade = estaPaga
            ? `NFS-e nº ${nota.numero} recebida/paga (${valorFormatado}). Tomador: ${nota.tomadorRazao}. Parcela: ${parcelaDb.descricao}.`
            : `NFS-e nº ${nota.numero} emitida/faturada (${valorFormatado}). Tomador: ${nota.tomadorRazao}. Parcela: ${parcelaDb.descricao}.`

          await pb.collection('atividades').create({
            usuario: currentUserId || null,
            projeto: parcelaDb.projeto,
            cliente: parcelaDb.cliente || null,
            texto: textoAtividade,
            tipo: 'financeiro',
            data_hora: nota.dataRecebimento || nota.dataEmissao || new Date().toISOString(),
            origem_importacao: true,
          })
        } catch (errAtiv) {
          console.warn('Não foi possível gravar atividade da NFS-e na timeline:', errAtiv)
        }
      }

      reportar(`NFS-e ${nota.numero} vinculada com sucesso`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      resultado.erros.push(`Erro ao gravar NFS-e nº ${nota.numero}: ${msg}`)
      reportar(`Falha ao gravar NFS-e ${nota.numero}`)
    }
  }

  // 5. Registrar no log de importações (coleção importacoes_log, tipo "nfse")
  try {
    const logRecord = await pb.collection('importacoes_log').create({
      arquivo_nome: opcoes.arquivoNome,
      tamanho_bytes: opcoes.tamanhoBytes,
      usuario: currentUserId || null,
      total_clientes: 0,
      total_projetos: 0,
      total_financeiro: resultado.vinculadas + resultado.atualizadas,
      total_comunicacoes: resultado.vinculadas + resultado.atualizadas, // atividades geradas
      resumo: {
        tipo: 'nfse',
        totalNotas: resultado.totalNotas,
        vinculadas: resultado.vinculadas,
        atualizadas: resultado.atualizadas,
        orfas: resultado.orfas.length,
        erros: resultado.erros,
      },
    })
    resultado.logId = logRecord.id
  } catch (errLog) {
    console.warn('Erro ao salvar importacoes_log para NFS-e:', errLog)
  }

  reportar('Importação de NFS-e concluída!')
  return resultado
}

// Vincula manualmente uma nota órfã a uma parcela existente
export async function vincularNotaOrfaAParcela(
  nota: NfseDadoExtraido,
  parcelaId: string,
): Promise<void> {
  const currentUserId = pb.authStore.record?.id || ''
  const parcelaDb = await pb.collection('parcelas').getOne(parcelaId)

  const estaPaga =
    nota.situacao === 'paga' || Boolean(nota.dataRecebimento) || parcelaDb.status === 'paga'

  const dataPagamentoFinal =
    nota.dataRecebimento || parcelaDb.data_pagamento || (estaPaga ? nota.dataEmissao : undefined)

  const valorRecebidoFinal = estaPaga
    ? Number(nota.valorLiquido || nota.valorBruto || parcelaDb.valor)
    : parcelaDb.valor_recebido

  const chaveUnica = `${nota.numero}_${nota.prestadorCnpjCpf || 'aerocad'}`

  const payload: Record<string, unknown> = {
    nf_numero: nota.numero,
    nfse_chave: chaveUnica,
    data_faturamento: nota.dataEmissao || parcelaDb.data_faturamento,
    retencoes: nota.retencoesTexto || parcelaDb.retencoes || '',
    nfse_dados: {
      ...nota,
      vinculadoManualmenteEm: new Date().toISOString(),
      vinculadoPor: currentUserId,
    },
  }

  if (estaPaga) {
    payload.status = 'paga'
    payload.status_pagamento = 'Recebido (NFS-e)'
    if (dataPagamentoFinal) payload.data_pagamento = dataPagamentoFinal
    if (valorRecebidoFinal !== undefined) payload.valor_recebido = valorRecebidoFinal
  } else {
    payload.status_pagamento = 'Faturado com NFS-e'
  }

  await pb.collection('parcelas').update(parcelaId, payload)

  if (parcelaDb.projeto) {
    try {
      const valorFormatado = (nota.valorLiquido || nota.valorBruto).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      await pb.collection('atividades').create({
        usuario: currentUserId || null,
        projeto: parcelaDb.projeto,
        cliente: parcelaDb.cliente || null,
        texto: `NFS-e nº ${nota.numero} (${valorFormatado}) vinculada manualmente à parcela "${parcelaDb.descricao}".`,
        tipo: 'financeiro',
        data_hora: new Date().toISOString(),
        origem_importacao: true,
      })
    } catch {
      // Ignorar falha secundária de atividade
    }
  }
}
