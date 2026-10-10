import pb from '@/lib/pocketbase/client'
import {
  formatarDocumento,
  limparDocumento,
  mapearStatusProjeto,
  parseDataISO,
  parseNumero,
  tratarValor,
  deduzirTrilha,
  type ItemValidado,
  type ValidacaoResultado,
} from './importacaoParser'

export interface ClienteMapeado extends Record<string, unknown> {
  id_planilha: string
  razao_social: string
  cnpj_cpf: string
  tipo: 'pj' | 'pf'
  segmento: string
  municipio_uf: string
  municipio: string
  uf: string
  contato_principal: string
  cargo: string
  email: string
  telefone: string
  contato_secundario: string
  primeira_contratacao: string
  observacoes: string
}

export interface ProjetoMapeado extends Record<string, unknown> {
  id_planilha: string
  id_cliente: string
  cliente_ref: string
  numero_pc_pt: string
  tipo_servico: string
  escopo_resumido: string
  municipio_uf: string
  aerodromo: string
  data_proposta: string
  data_aceite: string
  prazo_dias: number
  valor_global: number
  status_planilha: string
  status_crm: 'ativo' | 'suspenso' | 'concluido' | 'cancelado'
  fase_crm: string
  marco_fase_atual: string
  proxima_entrega: string
  pendente_orgao: string
  observacoes: string
  cliente_id_vinculado?: string
}

export interface FinanceiroMapeado extends Record<string, unknown> {
  id_lancamento: string
  id_projeto: string
  projeto_ref: string
  numero_parcela_marco: string
  percentual_contrato: number
  valor: number
  evento_comprobatorio: string
  data_prevista: string
  data_faturamento: string
  nf_numero: string
  vencimento: string
  data_pagamento: string
  status_pagamento: string
  observacoes: string
  projeto_id_vinculado?: string
  cliente_id_vinculado?: string
}

export interface ComunicacaoMapeada extends Record<string, unknown> {
  id_planilha: string
  id_cliente: string
  cliente_ref: string
  data_hora: string
  tipo: string
  texto: string
  usuario: string
  observacoes: string
  cliente_id_vinculado?: string
}

export async function validarClientes(
  linhas: Record<string, unknown>[],
  mapa: Record<string, string>,
): Promise<ValidacaoResultado<ClienteMapeado>> {
  // Carregar todos os clientes do PocketBase para detecção de duplicidade por CNPJ/CPF ou Razão Social
  const clientesExistentes = await pb.collection('clientes').getFullList({
    fields: 'id,razao_social,cnpj_cpf,tipo,segmento',
    requestKey: null,
  })

  const mapaExistentesDoc = new Map<string, string>() // docLimpo -> id
  const mapaExistentesNome = new Map<string, string>() // nomeNormalizado -> id

  for (const c of clientesExistentes) {
    const doc = limparDocumento(c.cnpj_cpf)
    if (doc) mapaExistentesDoc.set(doc, c.id)
    if (c.razao_social) {
      mapaExistentesNome.set(c.razao_social.trim().toLowerCase(), c.id)
    }
  }

  const itens: ItemValidado<ClienteMapeado>[] = []
  const docsNoArquivo = new Set<string>()

  linhas.forEach((row, idx) => {
    const getVal = (campo: string) => {
      const colName = mapa[campo]
      return colName ? row[colName] : ''
    }

    const { valor: razao, pendente: razaoPendente } = tratarValor(getVal('razao_social'))
    const { valor: docRaw, pendente: docPendente } = tratarValor(getVal('cnpj_cpf'))
    const { valor: tipoRaw, pendente: tipoPendente } = tratarValor(getVal('tipo'))
    const { valor: segmento, pendente: segmentoPendente } = tratarValor(getVal('segmento'))
    const { valor: munUf, pendente: munUfPendente } = tratarValor(getVal('municipio_uf'))
    const { valor: contato, pendente: contatoPendente } = tratarValor(getVal('contato_principal'))
    const { valor: cargo, pendente: cargoPendente } = tratarValor(getVal('cargo'))
    const { valor: email, pendente: emailPendente } = tratarValor(getVal('email'))
    const { valor: tel, pendente: telPendente } = tratarValor(getVal('telefone'))
    const { valor: contato2, pendente: contato2Pendente } = tratarValor(
      getVal('contato_secundario'),
    )
    const { valor: primContr, pendente: primContrPendente } = tratarValor(
      getVal('primeira_contratacao'),
    )
    const { valor: obs } = tratarValor(getVal('observacoes'))
    const { valor: idPlanilha } = tratarValor(getVal('id_planilha'))

    // Ignorar linha totalmente vazia
    if (!razao && !docRaw && !idPlanilha) {
      return
    }

    const docLimpo = limparDocumento(docRaw)
    const avisos: string[] = []
    const erros: string[] = []
    const camposAValidar: string[] = []

    if (razaoPendente) camposAValidar.push('Razão Social')
    if (docPendente) camposAValidar.push('CNPJ/CPF')
    if (tipoPendente) camposAValidar.push('Tipo')
    if (segmentoPendente) camposAValidar.push('Segmento')
    if (munUfPendente) camposAValidar.push('Município/UF')
    if (contatoPendente) camposAValidar.push('Contato principal')
    if (cargoPendente) camposAValidar.push('Cargo')
    if (emailPendente) camposAValidar.push('E-mail')
    if (telPendente) camposAValidar.push('Telefone')
    if (contato2Pendente) camposAValidar.push('Contato secundário')
    if (primContrPendente) camposAValidar.push('Primeira contratação')

    if (!razao) {
      erros.push('Razão Social / Nome é obrigatório')
    }

    // Tipo PJ ou PF
    let tipo: 'pj' | 'pf' = 'pj'
    if (tipoRaw) {
      const t = tipoRaw.toLowerCase()
      if (t.includes('pf') || t.includes('física') || t.includes('fisica')) {
        tipo = 'pf'
      }
    } else if (docLimpo.length === 11) {
      tipo = 'pf'
    }

    // Parse de Município e UF
    let municipio = ''
    let uf = ''
    if (munUf) {
      const match = munUf.match(/^(.*?)\s*[/-]\s*([A-Za-z]{2})(?:\s*\(.*?\))?$/)
      if (match) {
        municipio = match[1].trim()
        uf = match[2].trim().toUpperCase()
      } else {
        municipio = munUf
      }
    }

    // Validação de duplicação dentro do arquivo
    if (docLimpo) {
      if (docsNoArquivo.has(docLimpo)) {
        avisos.push(`CNPJ/CPF duplicado dentro do arquivo: ${formatarDocumento(docLimpo)}`)
      }
      docsNoArquivo.add(docLimpo)
    }

    // Identificar conflito com o banco
    let acao: 'criar' | 'atualizar' | 'ignorar' = 'criar'
    let idExistente: string | undefined
    let conflitoDescricao: string | undefined

    if (docLimpo && mapaExistentesDoc.has(docLimpo)) {
      idExistente = mapaExistentesDoc.get(docLimpo)
      acao = 'atualizar'
      conflitoDescricao = `Cliente já cadastrado no banco com este documento (${formatarDocumento(docLimpo)}). Será atualizado.`
    } else if (razao && mapaExistentesNome.has(razao.trim().toLowerCase())) {
      idExistente = mapaExistentesNome.get(razao.trim().toLowerCase())
      acao = 'atualizar'
      conflitoDescricao = `Cliente já cadastrado com esta Razão Social ("${razao}"). Será atualizado.`
    }

    const dadosMapeados: ClienteMapeado = {
      id_planilha: idPlanilha,
      razao_social: razao,
      cnpj_cpf: docLimpo ? formatarDocumento(docLimpo) : '',
      tipo,
      segmento,
      municipio_uf: munUf,
      municipio,
      uf,
      contato_principal: contato,
      cargo,
      email,
      telefone: tel,
      contato_secundario: contato2,
      primeira_contratacao: primContr,
      observacoes: obs,
    }

    itens.push({
      linhaOriginal: idx + 2, // Excel 1-based + cabeçalho
      dadosBrutos: row,
      dadosMapeados,
      avisos,
      erros,
      camposAValidar,
      acao,
      idExistente,
      conflitoDescricao,
    })
  })

  return {
    aba: 'Clientes',
    itens,
    totalLinhas: itens.length,
    totalCriar: itens.filter((i) => i.acao === 'criar' && i.erros.length === 0).length,
    totalAtualizar: itens.filter((i) => i.acao === 'atualizar' && i.erros.length === 0).length,
    totalIgnorar: itens.filter((i) => i.acao === 'ignorar' || i.erros.length > 0).length,
    totalErros: itens.filter((i) => i.erros.length > 0).length,
    totalComAvisos: itens.filter((i) => i.avisos.length > 0 || i.camposAValidar.length > 0).length,
  }
}

export async function validarProjetos(
  linhas: Record<string, unknown>[],
  mapa: Record<string, string>,
  clientesValidados?: ItemValidado<ClienteMapeado>[],
): Promise<ValidacaoResultado<ProjetoMapeado>> {
  // Carregar clientes do banco para resolução de ID
  const clientesDb = await pb.collection('clientes').getFullList({
    fields: 'id,razao_social,cnpj_cpf',
    requestKey: null,
  })

  // Carregar projetos existentes para idempotência (evitar duplicações)
  const projetosDb = await pb.collection('projetos').getFullList({
    fields: 'id,numero,nome,cliente,id_planilha',
    requestKey: null,
  })

  // Criar mapas de resolução de clientes
  const mapClientePorDoc = new Map<string, string>() // docLimpo -> id
  const mapClientePorNome = new Map<string, string>() // nomeLimpo -> id
  const mapClientePorIdPlanilha = new Map<string, string>() // ID Planilha -> id (ou nome)

  for (const c of clientesDb) {
    const d = limparDocumento(c.cnpj_cpf)
    if (d) mapClientePorDoc.set(d, c.id)
    if (c.razao_social) mapClientePorNome.set(c.razao_social.trim().toLowerCase(), c.id)
  }

  // Se houver clientes validados na mesma importação, registrar também
  if (clientesValidados) {
    for (const cv of clientesValidados) {
      if (cv.dadosMapeados.id_planilha) {
        mapClientePorIdPlanilha.set(
          cv.dadosMapeados.id_planilha.trim().toLowerCase(),
          cv.dadosMapeados.razao_social,
        )
      }
      if (cv.dadosMapeados.cnpj_cpf) {
        const d = limparDocumento(cv.dadosMapeados.cnpj_cpf)
        if (d) mapClientePorDoc.set(d, cv.idExistente || `temp_${cv.dadosMapeados.razao_social}`)
      }
      if (cv.dadosMapeados.razao_social) {
        mapClientePorNome.set(
          cv.dadosMapeados.razao_social.trim().toLowerCase(),
          cv.idExistente || `temp_${cv.dadosMapeados.razao_social}`,
        )
      }
    }
  }

  const itens: ItemValidado<ProjetoMapeado>[] = []

  linhas.forEach((row, idx) => {
    const getVal = (campo: string) => {
      const colName = mapa[campo]
      return colName ? row[colName] : ''
    }

    const { valor: idPlanilha } = tratarValor(getVal('id_planilha'))
    const { valor: idCliente } = tratarValor(getVal('id_cliente'))
    const { valor: clienteRef, pendente: clienteRefPendente } = tratarValor(getVal('cliente_ref'))
    const { valor: numPcPt, pendente: numPcPtPendente } = tratarValor(getVal('numero_pc_pt'))
    const { valor: tipoServico, pendente: tipoServicoPendente } = tratarValor(
      getVal('tipo_servico'),
    )
    const { valor: escopo, pendente: escopoPendente } = tratarValor(getVal('escopo_resumido'))
    const { valor: munUf, pendente: munUfPendente } = tratarValor(getVal('municipio_uf'))
    const { valor: aerodromo, pendente: aerodromoPendente } = tratarValor(getVal('aerodromo'))
    const { valor: dtPropRaw, pendente: dtPropPendente } = tratarValor(getVal('data_proposta'))
    const { valor: dtAceiteRaw, pendente: dtAceitePendente } = tratarValor(getVal('data_aceite'))
    const { valor: prazoRaw, pendente: prazoPendente } = tratarValor(getVal('prazo_dias'))
    const { valor: valGlobalRaw, pendente: valGlobalPendente } = tratarValor(getVal('valor_global'))
    const { valor: statusRaw, pendente: statusPendente } = tratarValor(getVal('status'))
    const { valor: marcoAtual, pendente: marcoAtualPendente } = tratarValor(
      getVal('marco_fase_atual'),
    )
    const { valor: proxEntrega, pendente: proxEntregaPendente } = tratarValor(
      getVal('proxima_entrega'),
    )
    const { valor: pendOrgao, pendente: pendOrgaoPendente } = tratarValor(getVal('pendente_orgao'))
    const { valor: obs } = tratarValor(getVal('observacoes'))

    // Ignorar linha vazia
    if (!idPlanilha && !clienteRef && !tipoServico && !escopo) {
      return
    }

    const avisos: string[] = []
    const erros: string[] = []
    const camposAValidar: string[] = []

    if (clienteRefPendente) camposAValidar.push('Cliente (ref.)')
    if (numPcPtPendente) camposAValidar.push('Nº PC/PT')
    if (tipoServicoPendente) camposAValidar.push('Tipo de serviço')
    if (escopoPendente) camposAValidar.push('Escopo resumido')
    if (munUfPendente) camposAValidar.push('Município/UF')
    if (aerodromoPendente) camposAValidar.push('Aeródromo')
    if (dtPropPendente) camposAValidar.push('Data da proposta')
    if (dtAceitePendente) camposAValidar.push('Data de aceite')
    if (prazoPendente) camposAValidar.push('Prazo')
    if (valGlobalPendente) camposAValidar.push('Valor global')
    if (statusPendente) camposAValidar.push('Status')
    if (marcoAtualPendente) camposAValidar.push('Marco/fase atual')
    if (proxEntregaPendente) camposAValidar.push('Próxima entrega')
    if (pendOrgaoPendente) camposAValidar.push('Pendente de órgão')

    const valorGlobal = parseNumero(valGlobalRaw)
    const prazoDias = parseInt(prazoRaw, 10) || 0
    const dataProposta = parseDataISO(dtPropRaw)
    const dataAceite = parseDataISO(dtAceiteRaw)

    // Status mapeado para CRM
    const { statusCrm, faseCrm } = mapearStatusProjeto(statusRaw)

    // Tentar resolver cliente
    let clienteResolvidoId: string | undefined

    // 1. Por ID do Cliente da planilha
    if (idCliente) {
      const matchDoc = mapClientePorDoc.get(limparDocumento(idCliente))
      if (matchDoc) clienteResolvidoId = matchDoc
      const matchIdPlan = mapClientePorIdPlanilha.get(idCliente.trim().toLowerCase())
      if (!clienteResolvidoId && matchIdPlan) {
        // Tentar resolver pelo nome correspondente
        const matchPorNome = mapClientePorNome.get(matchIdPlan.trim().toLowerCase())
        if (matchPorNome) clienteResolvidoId = matchPorNome
      }
    }

    // 2. Por CNPJ/CPF no clienteRef ou idCliente
    if (!clienteResolvidoId && clienteRef) {
      const docRef = limparDocumento(clienteRef)
      if (docRef.length === 11 || docRef.length === 14) {
        clienteResolvidoId = mapClientePorDoc.get(docRef)
      }
    }

    // 3. Por similaridade de nome
    if (!clienteResolvidoId && clienteRef) {
      const nomeLimpo = clienteRef.trim().toLowerCase()
      // Exato
      if (mapClientePorNome.has(nomeLimpo)) {
        clienteResolvidoId = mapClientePorNome.get(nomeLimpo)
      } else {
        // Busca parcial nas chaves
        for (const [k, v] of mapClientePorNome.entries()) {
          if (nomeLimpo.includes(k) || k.includes(nomeLimpo)) {
            clienteResolvidoId = v
            break
          }
        }
      }
    }

    if (!clienteResolvidoId && !clienteRef && !idCliente) {
      erros.push('Projeto sem referência de cliente')
    } else if (!clienteResolvidoId) {
      avisos.push(
        `Cliente "${clienteRef || idCliente}" não encontrado diretamente no banco; será associado durante a importação da aba Clientes.`,
      )
    }

    // Idempotência: verificar se projeto com este id_planilha já existe
    let acao: 'criar' | 'atualizar' | 'ignorar' = 'criar'
    let idExistente: string | undefined
    let conflitoDescricao: string | undefined

    if (idPlanilha) {
      const projExistente = projetosDb.find((p) => p.id_planilha === idPlanilha)
      if (projExistente) {
        idExistente = projExistente.id
        acao = 'atualizar'
        conflitoDescricao = `Projeto com ID ${idPlanilha} (${projExistente.numero || projExistente.nome}) já existe. Será atualizado.`
      }
    }

    const dadosMapeados: ProjetoMapeado = {
      id_planilha: idPlanilha,
      id_cliente: idCliente,
      cliente_ref: clienteRef,
      numero_pc_pt: numPcPt,
      tipo_servico: tipoServico,
      escopo_resumido: escopo,
      municipio_uf: munUf,
      aerodromo,
      data_proposta: dataProposta,
      data_aceite: dataAceite,
      prazo_dias: prazoDias,
      valor_global: valorGlobal,
      status_planilha: statusRaw,
      status_crm: statusCrm,
      fase_crm: faseCrm,
      marco_fase_atual: marcoAtual,
      proxima_entrega: proxEntrega,
      pendente_orgao: pendOrgao,
      observacoes: obs,
      cliente_id_vinculado: clienteResolvidoId,
    }

    itens.push({
      linhaOriginal: idx + 2,
      dadosBrutos: row,
      dadosMapeados,
      avisos,
      erros,
      camposAValidar,
      acao,
      idExistente,
      conflitoDescricao,
    })
  })

  return {
    aba: 'Projetos',
    itens,
    totalLinhas: itens.length,
    totalCriar: itens.filter((i) => i.acao === 'criar' && i.erros.length === 0).length,
    totalAtualizar: itens.filter((i) => i.acao === 'atualizar' && i.erros.length === 0).length,
    totalIgnorar: itens.filter((i) => i.acao === 'ignorar' || i.erros.length > 0).length,
    totalErros: itens.filter((i) => i.erros.length > 0).length,
    totalComAvisos: itens.filter((i) => i.avisos.length > 0 || i.camposAValidar.length > 0).length,
  }
}

export async function validarFinanceiro(
  linhas: Record<string, unknown>[],
  mapa: Record<string, string>,
  projetosValidados?: ItemValidado<ProjetoMapeado>[],
): Promise<ValidacaoResultado<FinanceiroMapeado>> {
  const parcelasDb = await pb.collection('parcelas').getFullList({
    fields: 'id,id_lancamento,descricao,projeto,valor',
    requestKey: null,
  })

  const projetosDb = await pb.collection('projetos').getFullList({
    fields: 'id,numero,nome,id_planilha,cliente',
    requestKey: null,
  })

  const mapProjetosPorIdPlanilha = new Map<string, { id: string; cliente: string }>()
  for (const p of projetosDb) {
    if (p.id_planilha) {
      mapProjetosPorIdPlanilha.set(p.id_planilha.trim().toLowerCase(), {
        id: p.id,
        cliente: p.cliente,
      })
    }
  }

  // Mapa de parcelas existentes por id_lancamento
  const mapParcelasExistentes = new Map<string, string>()
  for (const p of parcelasDb) {
    if (p.id_lancamento) {
      mapParcelasExistentes.set(p.id_lancamento.trim().toLowerCase(), p.id)
    }
  }

  const itens: ItemValidado<FinanceiroMapeado>[] = []

  linhas.forEach((row, idx) => {
    const getVal = (campo: string) => {
      const colName = mapa[campo]
      return colName ? row[colName] : ''
    }

    const { valor: idLancamento } = tratarValor(getVal('id_lancamento'))
    const { valor: idProjeto } = tratarValor(getVal('id_projeto'))
    const { valor: projRef, pendente: projRefPendente } = tratarValor(getVal('projeto_ref'))
    const { valor: numParcela, pendente: numParcelaPendente } = tratarValor(
      getVal('numero_parcela_marco'),
    )
    const { valor: percRaw, pendente: percPendente } = tratarValor(getVal('percentual_contrato'))
    const { valor: valRaw, pendente: valPendente } = tratarValor(getVal('valor'))
    const { valor: evento, pendente: eventoPendente } = tratarValor(getVal('evento_comprobatorio'))
    const { valor: dtPrevRaw, pendente: dtPrevPendente } = tratarValor(getVal('data_prevista'))
    const { valor: dtFatRaw, pendente: dtFatPendente } = tratarValor(getVal('data_faturamento'))
    const { valor: nfNumero, pendente: nfNumeroPendente } = tratarValor(getVal('nf_numero'))
    const { valor: dtVencRaw, pendente: dtVencPendente } = tratarValor(getVal('vencimento'))
    const { valor: dtRecRaw, pendente: dtRecPendente } = tratarValor(getVal('data_pagamento'))
    const { valor: stPagto, pendente: stPagtoPendente } = tratarValor(getVal('status_pagamento'))
    const { valor: obs } = tratarValor(getVal('observacoes'))

    // Ignorar vazias
    if (!idLancamento && !idProjeto && !projRef && !valRaw) {
      return
    }

    const avisos: string[] = []
    const erros: string[] = []
    const camposAValidar: string[] = []

    if (projRefPendente) camposAValidar.push('Projeto (ref.)')
    if (numParcelaPendente) camposAValidar.push('Nº da parcela / marco')
    if (percPendente) camposAValidar.push('% do contrato')
    if (valPendente) camposAValidar.push('Valor (R$)')
    if (eventoPendente) camposAValidar.push('Evento comprobatório')
    if (dtPrevPendente) camposAValidar.push('Data prevista')
    if (dtFatPendente) camposAValidar.push('Data de faturamento')
    if (nfNumeroPendente) camposAValidar.push('Nº NFS-e')
    if (dtVencPendente) camposAValidar.push('Data de vencimento')
    if (dtRecPendente) camposAValidar.push('Data de recebimento')
    if (stPagtoPendente) camposAValidar.push('Status pagamento')

    const valor = parseNumero(valRaw)
    let percentual = parseNumero(percRaw)
    // Se digitado como 0.45 em vez de 45%, converte para 45
    if (percentual > 0 && percentual <= 1) {
      percentual = percentual * 100
    }

    const dtPrevista = parseDataISO(dtPrevRaw)
    const dtFaturamento = parseDataISO(dtFatRaw)
    const dtVencimento = parseDataISO(dtVencRaw)
    const dtRecebimento = parseDataISO(dtRecRaw)

    // Resolução de projeto
    let projetoIdVinculado: string | undefined
    let clienteIdVinculado: string | undefined

    if (idProjeto) {
      const match = mapProjetosPorIdPlanilha.get(idProjeto.trim().toLowerCase())
      if (match) {
        projetoIdVinculado = match.id
        clienteIdVinculado = match.cliente
      }
    }

    if (!projetoIdVinculado && !idProjeto && !projRef) {
      erros.push('Lançamento sem identificação de projeto')
    } else if (!projetoIdVinculado) {
      avisos.push(`Projeto "${idProjeto || projRef}" será vinculado na importação combinada.`)
    }

    // Idempotência
    let acao: 'criar' | 'atualizar' | 'ignorar' = 'criar'
    let idExistente: string | undefined
    let conflitoDescricao: string | undefined

    if (idLancamento && mapParcelasExistentes.has(idLancamento.trim().toLowerCase())) {
      idExistente = mapParcelasExistentes.get(idLancamento.trim().toLowerCase())
      acao = 'atualizar'
      conflitoDescricao = `Lançamento ${idLancamento} já cadastrado no banco. Será atualizado.`
    }

    const dadosMapeados: FinanceiroMapeado = {
      id_lancamento: idLancamento,
      id_projeto: idProjeto,
      projeto_ref: projRef,
      numero_parcela_marco: numParcela || 'Parcela',
      percentual_contrato: percentual,
      valor,
      evento_comprobatorio: evento,
      data_prevista: dtPrevista,
      data_faturamento: dtFaturamento,
      nf_numero: nfNumero,
      vencimento: dtVencimento,
      data_pagamento: dtRecebimento,
      status_pagamento: stPagto,
      observacoes: obs,
      projeto_id_vinculado: projetoIdVinculado,
      cliente_id_vinculado: clienteIdVinculado,
    }

    itens.push({
      linhaOriginal: idx + 2,
      dadosBrutos: row,
      dadosMapeados,
      avisos,
      erros,
      camposAValidar,
      acao,
      idExistente,
      conflitoDescricao,
    })
  })

  return {
    aba: 'Financeiro',
    itens,
    totalLinhas: itens.length,
    totalCriar: itens.filter((i) => i.acao === 'criar' && i.erros.length === 0).length,
    totalAtualizar: itens.filter((i) => i.acao === 'atualizar' && i.erros.length === 0).length,
    totalIgnorar: itens.filter((i) => i.acao === 'ignorar' || i.erros.length > 0).length,
    totalErros: itens.filter((i) => i.erros.length > 0).length,
    totalComAvisos: itens.filter((i) => i.avisos.length > 0 || i.camposAValidar.length > 0).length,
  }
}

export async function validarComunicacoes(
  linhas: Record<string, unknown>[],
  mapa: Record<string, string>,
): Promise<ValidacaoResultado<ComunicacaoMapeada>> {
  const atividadesDb = await pb.collection('atividades').getFullList({
    fields: 'id,id_planilha,texto,cliente',
    requestKey: null,
  })

  const mapAtividadesExistentes = new Map<string, string>()
  for (const a of atividadesDb) {
    if (a.id_planilha) {
      mapAtividadesExistentes.set(a.id_planilha.trim().toLowerCase(), a.id)
    }
  }

  const clientesDb = await pb.collection('clientes').getFullList({
    fields: 'id,razao_social,cnpj_cpf',
    requestKey: null,
  })
  const mapClientesNome = new Map<string, string>()
  for (const c of clientesDb) {
    if (c.razao_social) mapClientesNome.set(c.razao_social.trim().toLowerCase(), c.id)
  }

  const itens: ItemValidado<ComunicacaoMapeada>[] = []

  linhas.forEach((row, idx) => {
    const getVal = (campo: string) => {
      const colName = mapa[campo]
      return colName ? row[colName] : ''
    }

    const { valor: idPlanilha } = tratarValor(getVal('id_planilha'))
    const { valor: idCliente } = tratarValor(getVal('id_cliente'))
    const { valor: clienteRef, pendente: clienteRefPendente } = tratarValor(getVal('cliente_ref'))
    const { valor: dataHoraRaw, pendente: dataHoraPendente } = tratarValor(getVal('data_hora'))
    const { valor: tipoRaw, pendente: tipoPendente } = tratarValor(getVal('tipo'))
    const { valor: textoRaw, pendente: textoPendente } = tratarValor(getVal('texto'))
    const { valor: usuarioRaw } = tratarValor(getVal('usuario'))
    const { valor: obs } = tratarValor(getVal('observacoes'))

    if (!idPlanilha && !clienteRef && !textoRaw) return

    const avisos: string[] = []
    const erros: string[] = []
    const camposAValidar: string[] = []

    if (clienteRefPendente) camposAValidar.push('Cliente (ref.)')
    if (dataHoraPendente) camposAValidar.push('Data')
    if (tipoPendente) camposAValidar.push('Tipo')
    if (textoPendente) camposAValidar.push('Texto/Assunto')

    let clienteId: string | undefined
    if (clienteRef) {
      clienteId = mapClientesNome.get(clienteRef.trim().toLowerCase())
    }

    let acao: 'criar' | 'atualizar' | 'ignorar' = 'criar'
    let idExistente: string | undefined
    let conflitoDescricao: string | undefined

    if (idPlanilha && mapAtividadesExistentes.has(idPlanilha.trim().toLowerCase())) {
      idExistente = mapAtividadesExistentes.get(idPlanilha.trim().toLowerCase())
      acao = 'atualizar'
      conflitoDescricao = `Comunicação ${idPlanilha} já cadastrada. Será atualizada.`
    }

    const dadosMapeados: ComunicacaoMapeada = {
      id_planilha: idPlanilha,
      id_cliente: idCliente,
      cliente_ref: clienteRef,
      data_hora: parseDataISO(dataHoraRaw),
      tipo: tipoRaw || 'e-mail',
      texto: textoRaw || obs || 'Registro de comunicação',
      usuario: usuarioRaw,
      observacoes: obs,
      cliente_id_vinculado: clienteId,
    }

    itens.push({
      linhaOriginal: idx + 2,
      dadosBrutos: row,
      dadosMapeados,
      avisos,
      erros,
      camposAValidar,
      acao,
      idExistente,
      conflitoDescricao,
    })
  })

  return {
    aba: 'Comunicações',
    itens,
    totalLinhas: itens.length,
    totalCriar: itens.filter((i) => i.acao === 'criar' && i.erros.length === 0).length,
    totalAtualizar: itens.filter((i) => i.acao === 'atualizar' && i.erros.length === 0).length,
    totalIgnorar: itens.filter((i) => i.acao === 'ignorar' || i.erros.length > 0).length,
    totalErros: itens.filter((i) => i.erros.length > 0).length,
    totalComAvisos: itens.filter((i) => i.avisos.length > 0 || i.camposAValidar.length > 0).length,
  }
}
