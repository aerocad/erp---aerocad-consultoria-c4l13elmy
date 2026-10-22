import pb from '@/lib/pocketbase/client'
import type {
  ContaPagarRecord,
  ContaReceberRecord,
  ParcelaRecord,
  ProjetoRecord,
  ClienteRecord,
  CredorRecord,
  ContaBancariaRecord,
} from '@/types/crm'
import {
  obterDocumentosSegregados,
  type DocumentoSegregadoVisualizacao,
} from './documentosContasPagar'

export type TipoDocumentoFinanceiro = 'nota_fiscal' | 'boleto' | 'comprovante' | 'todos'

export interface DocumentoFinanceiroItem {
  id: string // Identificador único na visualização
  registroId: string // ID do registro original na coleção
  colecaoOrigem: 'parcelas' | 'contas_pagar' | 'contas_receber' | 'orfas'
  tipo: 'nota_fiscal' | 'boleto' | 'comprovante'
  subtipo: string // Ex: 'NFS-e', 'Boleto Bancário', 'Comprovante PIX/TED', 'Recibo'
  identificador: string // Ex: 'NFS-e nº 94', 'Boleto (0779...)', 'Comprovante 1792...'
  numeroDoc?: string
  codigoBarras?: string
  descricao: string
  valor: number
  dataReferencia: string // Vencimento / Pagamento / Emissão
  dataFaturamentoOuPagamento?: string
  status: string // 'paga', 'pendente', 'vencida', 'pago', 'recebido', etc.
  origemModulo: string // 'Parcelas de Projetos', 'Contas a Pagar', 'Contas a Receber', 'Notas Órfãs'

  // Vinculações
  entidadeNome: string // Nome do tomador, fornecedor, credor ou cliente
  entidadeCnpjCpf?: string
  projetoId?: string
  projetoNumero?: string
  clienteId?: string
  credorId?: string
  contaBancariaId?: string
  contaBancariaNome?: string
  planoContasCodigo?: string
  planoContasNome?: string
  transacaoExtratoId?: string

  // Arquivos & Evidências
  arquivoUrl?: string
  arquivoNome?: string
  isPdf?: boolean
  isImage?: boolean
  dadosCompletos?: any
}

export interface HistoricoExclusaoItem {
  id: string
  created: string
  usuarioNome?: string
  usuarioId?: string
  tipoOperacao: string
  colecaoAlvo: string
  descricao: string
  totalRegistros: number
  desfeito: boolean
  dataDesfeito?: string
  snapshotAnterior?: any[]
  detalhesDoc?: any
}

/**
 * Coleta e indexa todos os documentos financeiros em memória para pesquisa instantânea
 */
export function unificarDocumentosFinanceiros(params: {
  parcelas: ParcelaRecord[]
  contasPagar: ContaPagarRecord[]
  contasReceber: ContaReceberRecord[]
  notasOrfas?: any[]
  projetosMap?: Map<string, ProjetoRecord>
  clientesMap?: Map<string, ClienteRecord>
  credoresMap?: Map<string, CredorRecord>
  contasBancariasMap?: Map<string, ContaBancariaRecord>
}): DocumentoFinanceiroItem[] {
  const {
    parcelas = [],
    contasPagar = [],
    contasReceber = [],
    notasOrfas = [],
    projetosMap = new Map(),
    clientesMap = new Map(),
    credoresMap = new Map(),
    contasBancariasMap = new Map(),
  } = params

  const itens: DocumentoFinanceiroItem[] = []

  // 1. NFS-e presentes em parcelas
  for (const p of parcelas) {
    const temNf =
      Boolean(p.nf_numero?.trim()) ||
      Boolean(p.nfse_chave?.trim()) ||
      Boolean((p as any).nfse_dados)
    if (!temNf) continue

    const numero = p.nf_numero?.trim() || p.nfse_chave?.trim() || 'S/N'
    let tomador = p.expand?.cliente?.razao_social || ''
    if (!tomador && p.cliente) {
      tomador = clientesMap.get(p.cliente)?.razao_social || ''
    }

    let tomadorCnpj = p.expand?.cliente?.cnpj_cpf || ''
    if (!tomadorCnpj && p.cliente) {
      tomadorCnpj = clientesMap.get(p.cliente)?.cnpj_cpf || ''
    }

    const projNum =
      p.expand?.projeto?.numero || (p.projeto ? projetosMap.get(p.projeto)?.numero : '') || ''
    const contaBanc = p.conta_bancaria ? contasBancariasMap.get(p.conta_bancaria)?.apelido : ''

    itens.push({
      id: `parc_nfse_${p.id}`,
      registroId: p.id,
      colecaoOrigem: 'parcelas',
      tipo: 'nota_fiscal',
      subtipo: 'NFS-e (Serviços)',
      identificador: `NFS-e nº ${numero}`,
      numeroDoc: numero,
      descricao: p.descricao || `NFS-e nº ${numero}`,
      valor: p.valor_recebido || p.valor || 0,
      dataReferencia: p.data_faturamento || p.vencimento || p.created || '',
      dataFaturamentoOuPagamento: p.data_pagamento || p.data_faturamento,
      status: p.status || 'pendente',
      origemModulo: 'Parcelas de Projetos (Faturamento)',
      entidadeNome: tomador || 'Tomador / Cliente não informado',
      entidadeCnpjCpf: tomadorCnpj,
      projetoId: p.projeto,
      projetoNumero: projNum,
      clienteId: p.cliente,
      contaBancariaId: p.conta_bancaria,
      contaBancariaNome: contaBanc,
      planoContasCodigo: p.plano_contas_codigo,
      planoContasNome: p.plano_contas_nome,
      dadosCompletos: p,
    })
  }

  // 2. Notas Órfãs em sessão
  for (const o of notasOrfas) {
    const num = o.numero || o.idTemp || 'S/N'
    itens.push({
      id: `orfa_${o.idTemp || num}`,
      registroId: o.idTemp || num,
      colecaoOrigem: 'orfas',
      tipo: 'nota_fiscal',
      subtipo: 'NFS-e (Órfã / Não vinculada)',
      identificador: `NFS-e nº ${num} [Órfã]`,
      numeroDoc: num,
      descricao: o.descricaoServico || `NFS-e nº ${num} importada sem correlação automática`,
      valor: o.valor || 0,
      dataReferencia: o.dataEmissao || o.dataRecebimento || '',
      status: 'orfa',
      origemModulo: 'Central de Notas Órfãs',
      entidadeNome: o.tomadorNome || 'Tomador desconhecido',
      entidadeCnpjCpf: o.tomadorCnpjCpf || '',
      dadosCompletos: o,
    })
  }

  // 3. Contas a Pagar: Boletos, Comprovantes, NF-e/NFS-e anexadas
  for (const cp of contasPagar) {
    if (cp.status === 'cancelado') continue

    const fornecedorNome =
      cp.fornecedor ||
      cp.expand?.credor?.nome_razao_social ||
      (cp.credor ? credoresMap.get(cp.credor)?.nome_razao_social : '') ||
      'Fornecedor / Favorecido'
    const fornecedorCnpj =
      cp.cnpj_cpf_beneficiario ||
      cp.expand?.credor?.cnpj_cpf ||
      (cp.credor ? credoresMap.get(cp.credor)?.cnpj_cpf : '') ||
      ''
    const projNum =
      cp.expand?.projeto?.numero || (cp.projeto ? projetosMap.get(cp.projeto)?.numero : '') || ''
    const contaBanc = cp.conta_bancaria ? contasBancariasMap.get(cp.conta_bancaria)?.apelido : ''

    const docsSegregados = obterDocumentosSegregados(cp)

    // Se possui código de barras ou forma de pagamento boleto
    const temBoletoExplícito =
      Boolean(cp.codigo_barras_linha_digitavel?.trim()) ||
      cp.forma_pagamento === 'boleto' ||
      docsSegregados.some((d) => d.tipo === 'boleto')

    if (temBoletoExplícito) {
      const docBoleto = docsSegregados.find((d) => d.tipo === 'boleto')
      itens.push({
        id: `cp_bol_${cp.id}`,
        registroId: cp.id,
        colecaoOrigem: 'contas_pagar',
        tipo: 'boleto',
        subtipo: 'Boleto Bancário (Cobrança)',
        identificador: cp.numero_documento
          ? `Boleto doc. ${cp.numero_documento}`
          : `Boleto - ${fornecedorNome}`,
        numeroDoc: cp.numero_documento,
        codigoBarras: cp.codigo_barras_linha_digitavel,
        descricao: cp.descricao || `Boleto de ${fornecedorNome}`,
        valor: cp.valor || 0,
        dataReferencia: cp.data_vencimento || cp.data_pagamento || cp.created || '',
        dataFaturamentoOuPagamento: cp.data_pagamento,
        status: cp.status || 'pendente',
        origemModulo: 'Contas a Pagar (Despesas)',
        entidadeNome: fornecedorNome,
        entidadeCnpjCpf: fornecedorCnpj,
        projetoId: cp.projeto,
        projetoNumero: projNum,
        credorId: cp.credor,
        contaBancariaId: cp.conta_bancaria,
        contaBancariaNome: contaBanc,
        planoContasCodigo: cp.plano_contas_codigo,
        planoContasNome: cp.plano_contas_nome,
        arquivoUrl: docBoleto?.url,
        arquivoNome: docBoleto?.nomeOriginal,
        isPdf: docBoleto?.isPdf,
        isImage: docBoleto?.isImage,
        dadosCompletos: cp,
      })
    }

    // Comprovantes de quitação (PIX, TED, Recibo ou comprovante anexado)
    const comprovantes = docsSegregados.filter(
      (d) =>
        d.tipo === 'comprovante_pix' ||
        d.tipo === 'recibo' ||
        (d.tipo === 'outro' && cp.status === 'pago'),
    )

    if (comprovantes.length > 0) {
      comprovantes.forEach((comp, idx) => {
        itens.push({
          id: `cp_comp_${cp.id}_${idx}`,
          registroId: cp.id,
          colecaoOrigem: 'contas_pagar',
          tipo: 'comprovante',
          subtipo: comp.tipo === 'recibo' ? 'Recibo de Quitação' : 'Comprovante PIX / TED',
          identificador: `Comprovante: ${comp.nomeOriginal}`,
          numeroDoc: cp.numero_documento,
          descricao: cp.descricao || `Pagamento para ${fornecedorNome}`,
          valor: cp.valor || 0,
          dataReferencia: cp.data_pagamento || cp.data_vencimento || cp.created || '',
          dataFaturamentoOuPagamento: cp.data_pagamento,
          status: cp.status || 'pago',
          origemModulo: 'Contas a Pagar (Liquidação)',
          entidadeNome: fornecedorNome,
          entidadeCnpjCpf: fornecedorCnpj,
          projetoId: cp.projeto,
          projetoNumero: projNum,
          credorId: cp.credor,
          contaBancariaId: cp.conta_bancaria,
          contaBancariaNome: contaBanc,
          planoContasCodigo: cp.plano_contas_codigo,
          planoContasNome: cp.plano_contas_nome,
          arquivoUrl: comp.url,
          arquivoNome: comp.nomeOriginal,
          isPdf: comp.isPdf,
          isImage: comp.isImage,
          dadosCompletos: cp,
        })
      })
    } else if (cp.status === 'pago' && !temBoletoExplícito) {
      // Conta já liquidada mesmo sem anexo digital
      itens.push({
        id: `cp_comp_reg_${cp.id}`,
        registroId: cp.id,
        colecaoOrigem: 'contas_pagar',
        tipo: 'comprovante',
        subtipo: 'Liquidação Bancária Registrada',
        identificador: `Quitação - ${fornecedorNome}`,
        numeroDoc: cp.numero_documento,
        descricao: cp.descricao || `Despesa paga a ${fornecedorNome}`,
        valor: cp.valor || 0,
        dataReferencia: cp.data_pagamento || cp.data_vencimento || '',
        dataFaturamentoOuPagamento: cp.data_pagamento,
        status: 'pago',
        origemModulo: 'Contas a Pagar',
        entidadeNome: fornecedorNome,
        entidadeCnpjCpf: fornecedorCnpj,
        projetoId: cp.projeto,
        projetoNumero: projNum,
        credorId: cp.credor,
        contaBancariaId: cp.conta_bancaria,
        contaBancariaNome: contaBanc,
        planoContasCodigo: cp.plano_contas_codigo,
        planoContasNome: cp.plano_contas_nome,
        dadosCompletos: cp,
      })
    }

    // Se houver nota fiscal de fornecedor (NF-e de compras/serviços recebidos)
    const nfs = docsSegregados.filter((d) => d.tipo === 'nota_fiscal')
    nfs.forEach((nf, idx) => {
      itens.push({
        id: `cp_nf_${cp.id}_${idx}`,
        registroId: cp.id,
        colecaoOrigem: 'contas_pagar',
        tipo: 'nota_fiscal',
        subtipo: 'Nota Fiscal do Prestador / DANFE',
        identificador: `NF Despesa: ${nf.nomeOriginal}`,
        numeroDoc: cp.numero_documento,
        descricao: cp.descricao || `NF Prestador ${fornecedorNome}`,
        valor: cp.valor || 0,
        dataReferencia: cp.data_vencimento || cp.data_pagamento || '',
        status: cp.status || 'pendente',
        origemModulo: 'Contas a Pagar (Documento Fiscal)',
        entidadeNome: fornecedorNome,
        entidadeCnpjCpf: fornecedorCnpj,
        projetoId: cp.projeto,
        projetoNumero: projNum,
        credorId: cp.credor,
        planoContasCodigo: cp.plano_contas_codigo,
        planoContasNome: cp.plano_contas_nome,
        arquivoUrl: nf.url,
        arquivoNome: nf.nomeOriginal,
        isPdf: nf.isPdf,
        isImage: nf.isImage,
        dadosCompletos: cp,
      })
    })
  }

  // 4. Contas a Receber Avulsas (Comprovantes / Boletos recebidos)
  for (const cr of contasReceber) {
    if (cr.status === 'cancelado') continue

    const clienteNome = cr.cliente_nome || cr.expand?.cliente?.razao_social || 'Cliente Avulso'
    const projNum =
      cr.expand?.projeto?.numero || (cr.projeto ? projetosMap.get(cr.projeto)?.numero : '') || ''
    const contaBanc = cr.conta_bancaria ? contasBancariasMap.get(cr.conta_bancaria)?.apelido : ''

    if (cr.comprovante) {
      itens.push({
        id: `cr_comp_${cr.id}`,
        registroId: cr.id,
        colecaoOrigem: 'contas_receber',
        tipo: 'comprovante',
        subtipo: 'Comprovante de Recebimento',
        identificador: `Comprovante - ${clienteNome}`,
        numeroDoc: cr.numero_documento,
        descricao: cr.descricao || `Receita avulsa de ${clienteNome}`,
        valor: cr.valor_recebido || cr.valor || 0,
        dataReferencia: cr.data_recebimento || cr.data_vencimento || '',
        dataFaturamentoOuPagamento: cr.data_recebimento,
        status: cr.status || 'recebido',
        origemModulo: 'Contas a Receber (Receitas Avulsas)',
        entidadeNome: clienteNome,
        projetoId: cr.projeto,
        projetoNumero: projNum,
        clienteId: cr.cliente,
        contaBancariaId: cr.conta_bancaria,
        contaBancariaNome: contaBanc,
        arquivoUrl: pb.files.getURL(cr, cr.comprovante as string),
        arquivoNome: typeof cr.comprovante === 'string' ? cr.comprovante : 'comprovante.pdf',
        isPdf: typeof cr.comprovante === 'string' && cr.comprovante.toLowerCase().endsWith('.pdf'),
        isImage:
          typeof cr.comprovante === 'string' &&
          ['.png', '.jpg', '.jpeg', '.webp'].some((e) =>
            (cr.comprovante as string).toLowerCase().endsWith(e),
          ),
        dadosCompletos: cr,
      })
    }
  }

  return itens
}

/**
 * Executa a exclusão segura admin-only no backend com gravação de snapshot
 */
export async function excluirDocumentoFinanceiro(params: {
  doc: DocumentoFinanceiroItem
  palavraChave: string
  justificativa?: string
  apenasAnexoNome?: string
}): Promise<{ sucesso: boolean; auditId: string; mensagem: string; impactoVinculos: string[] }> {
  const { doc, palavraChave, justificativa, apenasAnexoNome } = params

  if (palavraChave.trim().toUpperCase() !== 'EXCLUIR') {
    throw new Error('Confirmação inválida. Digite a palavra EXCLUIR para autorizar.')
  }

  // Se for nota órfã (em sessão), remove diretamente do storage
  if (doc.colecaoOrigem === 'orfas') {
    try {
      const stored = sessionStorage.getItem('aerocad_nfse_orfas')
      if (stored) {
        const orfas = JSON.parse(stored)
        const filtradas = orfas.filter(
          (o: any) => o.idTemp !== doc.registroId && o.numero !== doc.numeroDoc,
        )
        sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(filtradas))
      }
    } catch {
      /* intentionally ignored */
    }

    return {
      sucesso: true,
      auditId: 'local_orfa',
      mensagem: `Nota Fiscal Órfã nº ${doc.numeroDoc || doc.registroId} removida da central com sucesso.`,
      impactoVinculos: ['Nota desvinculada removida da memória de trabalho'],
    }
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/financeiro/documentos/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({
      colecaoOrigem: doc.colecaoOrigem,
      registroId: doc.registroId,
      tipoDocumento: doc.tipo,
      subtipo: doc.subtipo,
      palavraChave,
      justificativa: justificativa || `Exclusão solicitada para ${doc.identificador}`,
      apenasAnexoNome,
      detalhesDoc: {
        identificador: doc.identificador,
        entidadeNome: doc.entidadeNome,
        valor: doc.valor,
        origemModulo: doc.origemModulo,
      },
    }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || 'Erro ao processar exclusão no backend.')
  }

  return payload
}

/**
 * Restaura uma exclusão através da auditoria gravada
 */
export async function desfazerExclusaoDocumento(
  auditId: string,
): Promise<{ sucesso: boolean; mensagem: string }> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL
  const res = await fetch(`${baseUrl}/backend/v1/financeiro/documentos/desfazer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ auditId }),
  })

  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload?.error || 'Erro ao restaurar documento no backend.')
  }

  return payload
}

/**
 * Busca histórico de exclusões de documentos para a tela
 */
export async function buscarHistoricoExclusoesDocumentos(): Promise<HistoricoExclusaoItem[]> {
  try {
    const records = await pb.collection('auditoria_operacoes_bloco').getList(1, 30, {
      filter:
        "tipo_operacao = 'exclusao_documento_financeiro' || tipo_operacao = 'exclusao_duplicadas_nfse'",
      sort: '-created',
      expand: 'usuario',
    })

    return records.items.map((r: any) => {
      let snapshots = []
      try {
        const raw = r.snapshot_anterior
        snapshots = typeof raw === 'string' ? JSON.parse(raw) : raw || []
      } catch {
        snapshots = []
      }

      return {
        id: r.id,
        created: r.created,
        usuarioNome: r.expand?.usuario?.name || r.expand?.usuario?.email || 'Administrador',
        usuarioId: r.usuario,
        tipoOperacao: r.tipo_operacao,
        colecaoAlvo: r.colecao_alvo,
        descricao: r.descricao,
        totalRegistros: r.total_registros_afetados || 1,
        desfeito: Boolean(r.desfeito),
        dataDesfeito: r.data_desfeito,
        snapshotAnterior: snapshots,
        detalhesDoc: r.criterio_filtro?.detalhesDoc,
      }
    })
  } catch (err) {
    console.warn('Erro ao listar histórico de exclusões:', err)
    return []
  }
}
