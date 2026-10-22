import pb from '@/lib/pocketbase/client'
import type { ClienteRecord } from '@/types/crm'
import { formatarDocumento, limparDocumento } from './importacaoParser'
import type { TomadorExtraidoNfse } from './nfseClienteCorrelacionador'
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
  clientesCriados?: number
  clientesAtualizados?: number
}

export interface NfseExecucaoResultado {
  totalNotas: number
  vinculadas: number
  atualizadas: number
  duplicadasPuladas: number
  orfas: NotaCorrelacionada[]
  clientesCriados: number
  clientesAtualizados: number
  erros: string[]
  logId?: string
}

export interface OpcoesGravacaoNfse {
  arquivoNome: string
  tamanhoBytes: number
  atualizarExistentes?: boolean
  tomadoresConfigurados?: TomadorExtraidoNfse[]
}

/**
 * Cria ou atualiza clientes com base nos tomadores extraídos das notas fiscais
 */
export async function processarClientesTomadores(
  tomadores: TomadorExtraidoNfse[],
  onStatus?: (msg: string) => void,
): Promise<{
  mapaTomadorParaClienteId: Map<string, string>
  clientesCriados: number
  clientesAtualizados: number
  errosClientes: string[]
}> {
  const mapa = new Map<string, string>()
  let criados = 0
  let atualizados = 0
  const erros: string[] = []

  for (const tomador of tomadores) {
    const { acao, chaveGrupo, clienteIdDestino, atualizarDadosFaltantes } = tomador

    if (acao === 'ignorar') {
      continue
    }

    // Ação 1: Criar novo cliente
    if (acao === 'criar') {
      try {
        onStatus?.(`Criando cliente "${tomador.razaoSocial}"...`)
        const docFormatado = formatarDocumento(tomador.cnpjCpf)

        // Monta município/uf amigável
        let munUf = ''
        if (tomador.municipio && tomador.uf) {
          munUf = `${tomador.municipio}/${tomador.uf}`
        } else if (tomador.municipio) {
          munUf = tomador.municipio
        } else if (tomador.uf) {
          munUf = tomador.uf
        }

        const payload: Record<string, unknown> = {
          tipo: tomador.tipo,
          razao_social: tomador.razaoSocial,
          cnpj_cpf: docFormatado,
          endereco: tomador.endereco || '',
          municipio: tomador.municipio || '',
          uf: tomador.uf || '',
          municipio_uf: munUf,
          email: tomador.email || '',
          telefone: tomador.telefone || '',
          origem: 'NFS-e',
          origem_importacao: true,
          status: 'cliente',
          segmento: tomador.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física',
          recorrente: tomador.qtdNotas > 1,
          observacoes: `<p>Cliente criado a partir de lote de NFS-e (${tomador.qtdNotas} nota(s) no valor total de R$ ${tomador.valorTotal.toFixed(2)}).</p>`,
        }

        const novoCliente = await pb.collection('clientes').create<ClienteRecord>(payload)
        criados++
        mapa.set(chaveGrupo, novoCliente.id)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        erros.push(`Erro ao criar cliente "${tomador.razaoSocial}": ${msg}`)
      }
      continue
    }

    // Ação 2: Vincular ao cliente existente (com ou sem atualização de dados cadastrais faltantes)
    if (acao === 'vincular' && clienteIdDestino) {
      mapa.set(chaveGrupo, clienteIdDestino)

      if (atualizarDadosFaltantes) {
        try {
          const cliAtual = await pb.collection('clientes').getOne<ClienteRecord>(clienteIdDestino)
          const updates: Record<string, unknown> = {}

          if (!cliAtual.endereco && tomador.endereco) {
            updates.endereco = tomador.endereco
          }
          if (!cliAtual.municipio && tomador.municipio) {
            updates.municipio = tomador.municipio
          }
          if (!cliAtual.uf && tomador.uf) {
            updates.uf = tomador.uf
          }
          if (!cliAtual.municipio_uf && (tomador.municipio || tomador.uf)) {
            updates.municipio_uf =
              tomador.municipio && tomador.uf
                ? `${tomador.municipio}/${tomador.uf}`
                : tomador.municipio || tomador.uf
          }
          if (!cliAtual.email && tomador.email) {
            updates.email = tomador.email
          }
          if (!cliAtual.telefone && tomador.telefone) {
            updates.telefone = tomador.telefone
          }
          if (!cliAtual.cnpj_cpf && tomador.cnpjCpf) {
            updates.cnpj_cpf = formatarDocumento(tomador.cnpjCpf)
          }

          if (Object.keys(updates).length > 0) {
            onStatus?.(`Atualizando dados cadastrais de "${cliAtual.razao_social}"...`)
            await pb.collection('clientes').update(clienteIdDestino, updates)
            atualizados++
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          erros.push(`Aviso ao atualizar dados cadastrais do cliente ${clienteIdDestino}: ${msg}`)
        }
      }
    }
  }

  return {
    mapaTomadorParaClienteId: mapa,
    clientesCriados: criados,
    clientesAtualizados: atualizados,
    errosClientes: erros,
  }
}

export async function executarGravacaoNfse(
  notasCorrelacionadas: NotaCorrelacionada[],
  opcoes: OpcoesGravacaoNfse,
  onProgress?: (p: ProgressoNfse) => void,
): Promise<NfseExecucaoResultado> {
  const currentUserId = pb.authStore.record?.id || ''

  const resultado: NfseExecucaoResultado = {
    totalNotas: notasCorrelacionadas.length,
    vinculadas: 0,
    atualizadas: 0,
    duplicadasPuladas: 0,
    orfas: [],
    clientesCriados: 0,
    clientesAtualizados: 0,
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
      clientesCriados: resultado.clientesCriados,
      clientesAtualizados: resultado.clientesAtualizados,
    })
  }

  // 1. Processar tomadores se foram informados na conferência/prévia
  let mapaTomadorId = new Map<string, string>()
  if (opcoes.tomadoresConfigurados && opcoes.tomadoresConfigurados.length > 0) {
    reportar('Processando e correlacionando clientes a partir das notas...')
    const resTomadores = await processarClientesTomadores(opcoes.tomadoresConfigurados, (msg) =>
      reportar(msg),
    )
    mapaTomadorId = resTomadores.mapaTomadorParaClienteId
    resultado.clientesCriados = resTomadores.clientesCriados
    resultado.clientesAtualizados = resTomadores.clientesAtualizados
    if (resTomadores.errosClientes.length > 0) {
      resultado.erros.push(...resTomadores.errosClientes)
    }
  }

  // 2. Gravar notas e atualizar parcelas
  for (const item of notasCorrelacionadas) {
    processadas++
    const { nota, parcelaSelecionadaId, acao, jaImportada } = item

    // Descobre o clienteId do tomador (se foi criado ou vinculado nas ações do tomador)
    const docLimpo = limparDocumento(nota.tomadorCnpjCpf)
    const chaveDoc = docLimpo ? `doc_${docLimpo}` : ''
    const chaveRazao = `razao_${nota.tomadorRazao.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const clienteTomadorId =
      (chaveDoc && mapaTomadorId.get(chaveDoc)) || mapaTomadorId.get(chaveRazao)

    if (acao === 'ignorar' || !parcelaSelecionadaId) {
      resultado.orfas.push(item)
      reportar(`NFS-e ${nota.numero} mantida como órfã`)
      continue
    }

    if (jaImportada && !opcoes.atualizarExistentes) {
      resultado.duplicadasPuladas++
      reportar(`NFS-e ${nota.numero} já cadastrada (pulada por duplicidade)`)
      continue
    }

    try {
      // 2.1 Carregar parcela atual para manter dados e verificar projeto/cliente
      const parcelaDb = await pb.collection('parcelas').getOne(parcelaSelecionadaId, {
        expand: 'projeto,cliente',
      })

      // 2.2 Determinar novos status e datas
      const estaPaga =
        nota.situacao === 'paga' || Boolean(nota.dataRecebimento) || parcelaDb.status === 'paga'

      const dataPagamentoFinal =
        nota.dataRecebimento ||
        parcelaDb.data_pagamento ||
        (estaPaga ? nota.dataEmissao : undefined)

      const valorRecebidoFinal = estaPaga
        ? Number(nota.valorLiquido || nota.valorBruto || parcelaDb.valor)
        : parcelaDb.valor_recebido

      // 2.3 Montar payload da parcela, vinculando também ao cliente se identificado
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
          tomadorEndereco: nota.tomadorEndereco,
          tomadorMunicipio: nota.tomadorMunicipio,
          tomadorUf: nota.tomadorUf,
          tomadorEmail: nota.tomadorEmail,
          tomadorTelefone: nota.tomadorTelefone,
          origemArquivo: nota.origemArquivo,
          dataEmissao: nota.dataEmissao,
          dataRecebimento: nota.dataRecebimento,
          situacao: nota.situacao,
          clienteVinculadoId: clienteTomadorId || parcelaDb.cliente || null,
          importadoEm: new Date().toISOString(),
          importadoPor: currentUserId,
        },
      }

      // Se a parcela não tinha cliente preenchido ou temos o cliente do tomador confirmado
      if (clienteTomadorId && (!parcelaDb.cliente || parcelaDb.cliente === '')) {
        payloadParcela.cliente = clienteTomadorId
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

      // 2.4 Registrar atividade na timeline do projeto (se houver projeto vinculado)
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
            cliente: clienteTomadorId || parcelaDb.cliente || null,
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

  // 3. Registrar no log de importações
  try {
    const logRecord = await pb.collection('importacoes_log').create({
      arquivo_nome: opcoes.arquivoNome,
      tamanho_bytes: opcoes.tamanhoBytes,
      usuario: currentUserId || null,
      total_clientes: resultado.clientesCriados + resultado.clientesAtualizados,
      total_projetos: 0,
      total_financeiro: resultado.vinculadas + resultado.atualizadas,
      total_comunicacoes: resultado.vinculadas + resultado.atualizadas,
      resumo: {
        tipo: 'nfse',
        totalNotas: resultado.totalNotas,
        vinculadas: resultado.vinculadas,
        atualizadas: resultado.atualizadas,
        duplicadasPuladas: resultado.duplicadasPuladas,
        clientesCriados: resultado.clientesCriados,
        clientesAtualizados: resultado.clientesAtualizados,
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

/**
 * Vincula manualmente uma nota órfã a uma parcela existente com opção de criar ou vincular cliente
 */
export async function vincularNotaOrfaAParcela(
  nota: NfseDadoExtraido,
  parcelaId: string,
  clienteOpcao?: {
    modo: 'existente' | 'novo' | 'manter_atual'
    clienteId?: string
    novoClienteDados?: {
      razaoSocial: string
      cnpjCpf: string
      endereco?: string
      municipio?: string
      uf?: string
      email?: string
      telefone?: string
    }
  },
  descricaoPersonalizada?: string,
): Promise<void> {
  const currentUserId = pb.authStore.record?.id || ''
  const parcelaDb = await pb.collection('parcelas').getOne(parcelaId)

  let clienteFinalId = parcelaDb.cliente || null

  // Processa ação de cliente se especificada
  if (clienteOpcao?.modo === 'novo' && clienteOpcao.novoClienteDados) {
    const dados = clienteOpcao.novoClienteDados
    const cleanDoc = limparDocumento(dados.cnpjCpf)
    const docFormatado = formatarDocumento(cleanDoc)

    let munUf = ''
    if (dados.municipio && dados.uf) munUf = `${dados.municipio}/${dados.uf}`
    else if (dados.municipio) munUf = dados.municipio
    else if (dados.uf) munUf = dados.uf

    const novoCliente = await pb.collection('clientes').create<ClienteRecord>({
      tipo: cleanDoc.length === 11 ? 'pf' : 'pj',
      razao_social: dados.razaoSocial,
      cnpj_cpf: docFormatado,
      endereco: dados.endereco || '',
      municipio: dados.municipio || '',
      uf: dados.uf || '',
      municipio_uf: munUf,
      email: dados.email || '',
      telefone: dados.telefone || '',
      origem: 'NFS-e',
      origem_importacao: true,
      status: 'cliente',
      segmento: cleanDoc.length === 11 ? 'Pessoa Física' : 'Pessoa Jurídica',
      recorrente: false,
      observacoes: `<p>Cliente criado a partir de vinculação da NFS-e nº ${nota.numero}.</p>`,
    })
    clienteFinalId = novoCliente.id
  } else if (clienteOpcao?.modo === 'existente' && clienteOpcao.clienteId) {
    clienteFinalId = clienteOpcao.clienteId
  }

  const estaPaga =
    nota.situacao === 'paga' || Boolean(nota.dataRecebimento) || parcelaDb.status === 'paga'

  const dataPagamentoFinal =
    nota.dataRecebimento || parcelaDb.data_pagamento || (estaPaga ? nota.dataEmissao : undefined)

  const valorRecebidoFinal = estaPaga
    ? Number(nota.valorLiquido || nota.valorBruto || parcelaDb.valor)
    : parcelaDb.valor_recebido

  const chaveUnica = `${nota.numero}_${nota.prestadorCnpjCpf || 'aerocad'}`

  const descFinal = descricaoPersonalizada?.trim() || parcelaDb.descricao

  const payload: Record<string, unknown> = {
    descricao: descFinal,
    nf_numero: nota.numero,
    nfse_chave: chaveUnica,
    data_faturamento: nota.dataEmissao || parcelaDb.data_faturamento,
    retencoes: nota.retencoesTexto || parcelaDb.retencoes || '',
    cliente: clienteFinalId || parcelaDb.cliente,
    nfse_dados: {
      ...nota,
      descricaoVinculo: descricaoPersonalizada?.trim() || undefined,
      clienteVinculadoId: clienteFinalId,
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
        cliente: clienteFinalId || null,
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
