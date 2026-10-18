import pb from '@/lib/pocketbase/client'
import { invalidateApiCache } from '@/services/api'
import {
  PLANO_CONTAS_AEROCAD,
  obterItemPlanoContasPorCodigo,
  ItemPlanoContas,
} from '@/lib/planoContas'
import {
  consolidarBalanceteMensal,
  MESES_NOMES,
} from '@/services/balanceteMensalDetalhamentoService'
import type {
  BalanceteMensalRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
  UserRecord,
} from '@/types/crm'

export type ColecaoReclassificavel =
  | 'extratos_transacoes'
  | 'contas_pagar'
  | 'contas_receber'
  | 'parcelas'

export interface ReclassificarParametros {
  colecao: ColecaoReclassificavel
  id: string
  codigoNovo: string
  nomeNovo?: string
  codigoAnterior?: string
  nomeAnterior?: string
  descricaoRegistro?: string
  dataRegistro?: string
  observacoes?: string
  user: UserRecord | null
  aplicarEmBlocoMesmaDescricao?: boolean
}

export interface ReclassificarResultado {
  sucesso: boolean
  codigo: string
  nome: string
  balanceteDesatualizadoReferencia?: string
  balanceteRegenerado?: boolean
  balanceteReferencia?: string
  balanceteReferenciaFormatada?: string
  balanceteErro?: string
  totalAfetados?: number
  competenciasAfetadas?: string[]
}

export interface DetalhesTransacoesMesmaDescricao {
  total: number
  outrosIds: string[]
  competencias: string[] // ex: ['2025-01', '2025-02']
  competenciasFormatadas: string[] // ex: ['01/2025', '02/2025']
  amostraRegistros: Array<{ id: string; data?: string; descricao: string; valor?: number }>
}

/**
 * Regenera um balancete mensal específico (estritamente a competência YYYY-MM)
 * após uma reclassificação contábil, mantendo o escopo restrito à competência afetada
 * e nunca varrendo o ano inteiro.
 */
export async function regenerarBalanceteCompetencia({
  referencia,
  user,
  registroOrigemId,
  colecaoOrigem,
}: {
  referencia: string
  user: UserRecord | null
  registroOrigemId?: string
  colecaoOrigem?: string
}): Promise<{ sucesso: boolean; balancete?: BalanceteMensalRecord; erro?: string }> {
  try {
    const balancetes = await pb
      .collection('balancetes_mensais')
      .getList<BalanceteMensalRecord>(1, 1, {
        filter: `referencia = "${referencia}"`,
      })

    if (!balancetes.items.length) {
      return { sucesso: false, erro: 'Nenhum balancete arquivado para esta competência.' }
    }

    const balanceteExistente = balancetes.items[0]
    const ano = balanceteExistente.ano
    const mes = balanceteExistente.mes
    const ref = referencia // YYYY-MM

    // 1. Parcelas da competência afetada (data.slice(0, 7))
    const parcelas = await pb
      .collection('parcelas')
      .getFullList<ParcelaRecord>({
        filter: `status = "paga" && (data_pagamento ~ "${ref}" || data_faturamento ~ "${ref}" || vencimento ~ "${ref}")`,
        expand: 'cliente,projeto',
      })
      .catch(() => [] as ParcelaRecord[])

    // 2. Contas a pagar da competência afetada
    const contasPagar = await pb
      .collection('contas_pagar')
      .getFullList<ContaPagarRecord>({
        filter: `status = "pago" && (data_pagamento ~ "${ref}" || data_vencimento ~ "${ref}")`,
      })
      .catch(() => [] as ContaPagarRecord[])

    // 3. Contas a receber da competência afetada
    const contasReceber = await pb
      .collection('contas_receber')
      .getFullList<ContaReceberRecord>({
        filter: `status = "recebido" && (data_recebimento ~ "${ref}" || data_vencimento ~ "${ref}")`,
        expand: 'cliente',
      })
      .catch(() => [] as ContaReceberRecord[])

    // 4. Extratos transações da competência afetada
    const extratosTransacoes = await pb
      .collection('extratos_transacoes')
      .getFullList<ExtratoTransacaoRecord>({
        filter: `data ~ "${ref}"`,
      })
      .catch(() => [] as ExtratoTransacaoRecord[])

    // Consolidar usando a rotina oficial de consolidação
    const consolidado = consolidarBalanceteMensal(ano, mes, {
      parcelas,
      contasPagar,
      contasReceber,
      extratosTransacoes,
    })

    // Preservar o acumulado dos meses anteriores (m < mes) sem recomputar o ano inteiro
    let totalRecAno = consolidado.receitas.total
    let totalDespAno = consolidado.despesas.total
    const mesesAnteriores = balanceteExistente.dados_consolidados?.acumuladoAno?.meses || []

    if (mesesAnteriores.length > 0) {
      let recAnteriores = 0
      let despAnteriores = 0
      for (const m of mesesAnteriores) {
        if (m.mes < mes) {
          recAnteriores += m.receita || 0
          despAnteriores += m.despesa || 0
        }
      }
      totalRecAno += recAnteriores
      totalDespAno += despAnteriores
    }

    const saldoAcumulado = totalRecAno - totalDespAno
    const mesNome = MESES_NOMES[mes - 1] || `Mês ${mes}`

    const payloadUpdate = {
      referencia: ref,
      ano,
      mes,
      titulo: balanceteExistente.titulo || `BALANCETE MENSAL — ${mesNome.toUpperCase()}/${ano}`,
      receita_total: consolidado.receitas.total,
      despesa_total: consolidado.despesas.total,
      saldo_mes: consolidado.receitas.total - consolidado.despesas.total,
      saldo_acumulado_ano: saldoAcumulado,
      total_receitas_ano: totalRecAno,
      total_despesas_ano: totalDespAno,
      dados_consolidados: consolidado,
      responsavel_emissao:
        user?.name || balanceteExistente.responsavel_emissao || 'Equipe Financeira AEROCAD',
      data_emissao: new Date().toISOString().slice(0, 10),
    }

    const balanceteAtualizado = await pb
      .collection('balancetes_mensais')
      .update<BalanceteMensalRecord>(balanceteExistente.id, payloadUpdate)

    invalidateApiCache('balancetes_mensais')

    // Gravar auditoria acao='regeneracao_automatica_balancete' em auditoria_operacoes_bloco
    try {
      await pb.collection('auditoria_operacoes_bloco').create({
        usuario: user?.id || null,
        tipo_operacao: 'regeneracao_automatica_balancete',
        colecao_alvo: 'balancetes_mensais',
        descricao: `Regeneração automática do balancete de ${ref} (${mesNome}/${ano}) após reclassificação contábil`,
        criterio_filtro: {
          referencia: ref,
          balancete_id: balanceteExistente.id,
        },
        alteracoes_solicitadas: {
          acao: 'regeneracao_automatica_balancete',
          referencia: ref,
          registro_origem_id: registroOrigemId || null,
          colecao_origem: colecaoOrigem || null,
          receita_total: consolidado.receitas.total,
          despesa_total: consolidado.despesas.total,
          saldo_mes: consolidado.receitas.total - consolidado.despesas.total,
        },
        total_registros_afetados: 1,
        total_falhas: 0,
        desfeito: false,
      })
    } catch (auditErr) {
      console.warn(
        'Aviso: Falha ao registrar log de auditoria da regeneração do balancete:',
        auditErr,
      )
    }

    // Notificar abas ativas
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aerocad:balancete_regenerado', {
          detail: { referencia: ref, balanceteId: balanceteAtualizado.id },
        }),
      )
    }

    return { sucesso: true, balancete: balanceteAtualizado }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Erro na regeneração automática do balancete:', err)
    return { sucesso: false, erro: msg }
  }
}

/**
 * Persiste a reclassificação contábil de um lançamento (extrato, conta_pagar, parcela, conta_receber)
 * Registra a auditoria na coleção auditoria_operacoes_bloco
 * Invalida o cache da API
 * Regenera automaticamente o balancete arquivado daquela competência com auditoria dedicada
 */
/**
 * Normaliza o texto de descrição para comparação exata case-insensitive e trim de espaços duplicados
 */
export function normalizarDescricaoComparacao(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Busca outras transações na mesma coleção (extratos_transacoes ou contas_pagar)
 * que possuam a mesma descrição normalizada (exato trim + lowercase).
 */
export async function buscarTransacoesMesmaDescricao({
  colecao,
  idAtual,
  descricao,
}: {
  colecao: ColecaoReclassificavel
  idAtual: string
  descricao: string
}): Promise<DetalhesTransacoesMesmaDescricao> {
  const norm = normalizarDescricaoComparacao(descricao)
  if (!norm || (colecao !== 'extratos_transacoes' && colecao !== 'contas_pagar')) {
    return {
      total: 0,
      outrosIds: [],
      competencias: [],
      competenciasFormatadas: [],
      amostraRegistros: [],
    }
  }

  try {
    // Buscar registros da coleção. Para limitar volume mas ser seguro, pegamos até 500 registros
    // usando busca ou filtro quando possível, ou comparando em memória
    // No PocketBase podemos filtrar por colecao com limite seguro
    const registros = await pb.collection(colecao).getFullList<{
      id: string
      descricao?: string
      data?: string
      data_vencimento?: string
      data_pagamento?: string
      valor?: number
    }>({
      fields: 'id,descricao,data,data_vencimento,data_pagamento,valor',
    })

    const outros: Array<{ id: string; data?: string; descricao: string; valor?: number }> = []
    const competenciasSet = new Set<string>()

    for (const r of registros) {
      if (r.id === idAtual) continue
      const rDescNorm = normalizarDescricaoComparacao(r.descricao)
      if (rDescNorm === norm) {
        const dataReg = r.data || r.data_pagamento || r.data_vencimento || ''
        if (dataReg && dataReg.length >= 7) {
          competenciasSet.add(dataReg.slice(0, 7))
        }
        outros.push({
          id: r.id,
          data: dataReg,
          descricao: r.descricao || '',
          valor: r.valor,
        })
      }
    }

    const competencias = Array.from(competenciasSet).sort()
    const competenciasFormatadas = competencias.map((c) => {
      const [ano, mes] = c.split('-')
      return `${mes}/${ano}`
    })

    return {
      total: outros.length,
      outrosIds: outros.map((o) => o.id),
      competencias,
      competenciasFormatadas,
      amostraRegistros: outros.slice(0, 5),
    }
  } catch (err) {
    console.warn('Erro ao buscar transações com a mesma descrição:', err)
    return {
      total: 0,
      outrosIds: [],
      competencias: [],
      competenciasFormatadas: [],
      amostraRegistros: [],
    }
  }
}

/**
 * Atualiza apenas o campo de observações de uma transação ou conta a pagar
 */
export async function salvarObservacoesLancamento({
  colecao,
  id,
  observacoes,
}: {
  colecao: ColecaoReclassificavel
  id: string
  observacoes: string
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    await pb.collection(colecao).update(id, {
      observacoes: observacoes.trim(),
    })
    invalidateApiCache(colecao)
    return { sucesso: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { sucesso: false, erro: msg }
  }
}

/**
 * Persiste a reclassificação contábil de um lançamento (extrato, conta_pagar, parcela, conta_receber)
 * Registra a auditoria na coleção auditoria_operacoes_bloco
 * Invalida o cache da API
 * Se solicitado (aplicarEmBlocoMesmaDescricao), reclassifica também em lote todas as outras transações com a mesma descrição
 * Regenera automaticamente os balancetes arquivados de TODAS as competências afetadas
 */
export async function reclassificarLancamentoContabil({
  colecao,
  id,
  codigoNovo,
  nomeNovo,
  codigoAnterior,
  nomeAnterior,
  descricaoRegistro,
  dataRegistro,
  observacoes,
  user,
  aplicarEmBlocoMesmaDescricao = false,
}: ReclassificarParametros): Promise<ReclassificarResultado> {
  const conta = obterItemPlanoContasPorCodigo(codigoNovo)
  const nomeFinal = nomeNovo || conta?.nome || 'Conta Contábil Personalizada'

  // 1. Atualizar registro principal no PocketBase
  const payloadUpdate: Record<string, unknown> = {
    plano_contas_codigo: codigoNovo,
    plano_contas_nome: nomeFinal,
    classificacao_manual: true,
  }

  if (observacoes !== undefined) {
    payloadUpdate.observacoes = observacoes.trim()
  }

  await pb.collection(colecao).update(id, payloadUpdate)

  const competenciasAfetadasSet = new Set<string>()
  if (dataRegistro && dataRegistro.length >= 7) {
    competenciasAfetadasSet.add(dataRegistro.slice(0, 7))
  }

  let totalAfetados = 1
  let idsAfetados: string[] = [id]

  // Se aplicar em bloco para a mesma descrição
  if (
    aplicarEmBlocoMesmaDescricao &&
    descricaoRegistro &&
    (colecao === 'extratos_transacoes' || colecao === 'contas_pagar')
  ) {
    try {
      const mesmaDesc = await buscarTransacoesMesmaDescricao({
        colecao,
        idAtual: id,
        descricao: descricaoRegistro,
      })

      if (mesmaDesc.total > 0) {
        for (const outId of mesmaDesc.outrosIds) {
          try {
            const payloadOutro: Record<string, unknown> = {
              plano_contas_codigo: codigoNovo,
              plano_contas_nome: nomeFinal,
              classificacao_manual: true,
            }
            await pb.collection(colecao).update(outId, payloadOutro)
            idsAfetados.push(outId)
            totalAfetados++
          } catch (errUpdateOutro) {
            console.warn(`Falha ao reclassificar item ${outId} em bloco:`, errUpdateOutro)
          }
        }

        // Adiciona as competências dos itens em bloco
        for (const c of mesmaDesc.competencias) {
          competenciasAfetadasSet.add(c)
        }
      }
    } catch (errBloco) {
      console.warn('Erro ao processar reclassificação em bloco:', errBloco)
    }
  }

  // Invalida o cache da coleção
  invalidateApiCache(colecao)

  // 2. Registrar na auditoria_operacoes_bloco
  try {
    const isBloco = totalAfetados > 1
    const auditoriaPayload = {
      usuario: user?.id || null,
      usuario_nome: user?.name || user?.email || 'Usuário AEROCAD',
      tipo_operacao: isBloco ? 'reclassificacao_por_descricao' : 'reclassificacao_contabil',
      colecao_alvo: colecao,
      descricao: isBloco
        ? `Reclassificação contábil em bloco por descrição ("${descricaoRegistro}") para ${totalAfetados} lançamentos com código [${codigoNovo} - ${nomeFinal}]`
        : `Reclassificação contábil de "${descricaoRegistro || id}" de [${codigoAnterior || 'Sem conta'} - ${nomeAnterior || 'Automático'}] para [${codigoNovo} - ${nomeFinal}]`,
      entidade: colecao,
      entidade_id: id,
      bloco_nome: 'plano_contas',
      total_registros_afetados: totalAfetados,
      total_falhas: 0,
      criterio_filtro: isBloco
        ? {
            descricao_normalizada: normalizarDescricaoComparacao(descricaoRegistro),
            descricao_original: descricaoRegistro,
            ids_afetados: idsAfetados,
          }
        : {
            id,
          },
      alteracoes_solicitadas: {
        colecao,
        codigo_novo: codigoNovo,
        nome_novo: nomeFinal,
        observacoes: observacoes?.trim() || null,
        total_afetados: totalAfetados,
      },
      detalhes_json: {
        colecao,
        registro_id: id,
        codigo_anterior: codigoAnterior || null,
        nome_anterior: nomeAnterior || null,
        codigo_novo: codigoNovo,
        nome_novo: nomeFinal,
        data_registro: dataRegistro || null,
        observacoes: observacoes?.trim() || null,
        total_afetados: totalAfetados,
        ids_afetados: idsAfetados,
      },
      dados_anteriores: {
        plano_contas_codigo: codigoAnterior || null,
        plano_contas_nome: nomeAnterior || null,
      },
      dados_novos: {
        plano_contas_codigo: codigoNovo,
        plano_contas_nome: nomeFinal,
        classificacao_manual: true,
        observacoes: observacoes?.trim() || null,
      },
      data_hora: new Date().toISOString(),
      sucesso: true,
      desfeito: false,
    }

    await pb.collection('auditoria_operacoes_bloco').create(auditoriaPayload)
  } catch (errAudit) {
    console.warn('Aviso: Falha ao registrar log de auditoria da reclassificação:', errAudit)
  }

  // 3. Regenerar balancetes de TODAS as competências afetadas
  let balanceteRegenerado = false
  let balanceteReferencia: string | undefined
  let balanceteReferenciaFormatada: string | undefined
  let balanceteErro: string | undefined
  let balanceteDesatualizadoReferencia: string | undefined

  const compsArray = Array.from(competenciasAfetadasSet).sort()

  for (const ref of compsArray) {
    const [anoStr, mesStr] = ref.split('-')
    balanceteReferencia = ref
    balanceteReferenciaFormatada = `${mesStr}/${anoStr}`

    try {
      const balancetes = await pb.collection('balancetes_mensais').getList(1, 1, {
        filter: `referencia = "${ref}"`,
      })

      if (balancetes.items.length > 0) {
        const regRes = await regenerarBalanceteCompetencia({
          referencia: ref,
          user,
          registroOrigemId: id,
          colecaoOrigem: colecao,
        })

        if (regRes.sucesso) {
          balanceteRegenerado = true
        } else {
          balanceteErro = regRes.erro || 'Falha ao regenerar balancete'
          balanceteDesatualizadoReferencia = ref
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('aerocad:balancete_desatualizado', {
                detail: { referencia: ref },
              }),
            )
          }
        }
      }
    } catch (errBal: unknown) {
      balanceteErro = errBal instanceof Error ? errBal.message : String(errBal)
      balanceteDesatualizadoReferencia = ref
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('aerocad:balancete_desatualizado', {
            detail: { referencia: ref },
          }),
        )
      }
    }
  }

  return {
    sucesso: true,
    codigo: codigoNovo,
    nome: nomeFinal,
    balanceteRegenerado,
    balanceteReferencia,
    balanceteReferenciaFormatada,
    balanceteErro,
    balanceteDesatualizadoReferencia,
    totalAfetados,
    competenciasAfetadas: compsArray,
  }
}
