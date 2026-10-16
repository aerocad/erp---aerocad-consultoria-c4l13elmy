import pb from '@/lib/pocketbase/client'
import { createOne, getOne, updateOne } from '@/services/api'
import type { OportunidadeRecord, ProjetoRecord, Trail, UserRecord } from '@/types/crm'

export interface ConversaoProjetoOportunidadeParams {
  projetoId: string
  usuarioAtual: UserRecord
  tituloCustomizado?: string
  valorEstimado?: number
  observacoesAdicionais?: string
}

export interface ConversaoOportunidadeProjetoParams {
  oportunidadeId: string
  usuarioAtual: UserRecord
  nomeCustomizado?: string
  prazo?: string
  observacoesAdicionais?: string
}

/**
 * Normaliza trilha técnica para Trail válida ('opea' | 'registro' | 'demais')
 */
export function normalizarTrilha(trilhaInput?: string): Trail {
  if (!trilhaInput) return 'opea'
  const t = trilhaInput.toLowerCase().trim()
  if (t === 'opea') return 'opea'
  if (
    t === 'registro' ||
    t.includes('registro') ||
    t.includes('heliponto') ||
    t.includes('aerodromo')
  ) {
    return 'registro'
  }
  return 'demais'
}

/**
 * Converte um Projeto em Oportunidade (Projeto -> Oportunidade)
 * Idempotente: se já houver oportunidade vinculada ao projeto, retorna a existente.
 */
export async function converterProjetoEmOportunidade({
  projetoId,
  usuarioAtual,
  tituloCustomizado,
  valorEstimado,
  observacoesAdicionais,
}: ConversaoProjetoOportunidadeParams): Promise<{
  oportunidade: OportunidadeRecord
  recemCriada: boolean
}> {
  // 1. Carregar projeto atual
  const projeto = await getOne<ProjetoRecord>('projetos', projetoId, {
    expand: 'cliente,responsavel_tecnico,coordenador_colaborador,analista_colaborador,oportunidade',
  })

  // 2. Trava de Idempotência: verificar se já possui oportunidade vinculada
  if (projeto.oportunidade) {
    try {
      const oppExistente = await getOne<OportunidadeRecord>('oportunidades', projeto.oportunidade, {
        expand: 'cliente,projeto',
      })
      // Garante que o vínculo bidirecional esteja consistente
      if (!oppExistente.projeto || oppExistente.projeto !== projeto.id) {
        await updateOne('oportunidades', oppExistente.id, { projeto: projeto.id })
      }
      return { oportunidade: oppExistente, recemCriada: false }
    } catch {
      // Se não encontrou o registro referenciado, segue para criar nova
    }
  }

  // Verificar se há alguma oportunidade que já aponte para este projeto
  try {
    const oppJaVinculada = await pb
      .collection('oportunidades')
      .getFirstListItem<OportunidadeRecord>(`projeto = "${projeto.id}"`, {
        expand: 'cliente,projeto',
      })
    if (oppJaVinculada) {
      if (!projeto.oportunidade || projeto.oportunidade !== oppJaVinculada.id) {
        await updateOne('projetos', projeto.id, { oportunidade: oppJaVinculada.id })
      }
      return { oportunidade: oppJaVinculada, recemCriada: false }
    }
  } catch {
    // nenhuma encontrada, segue criação
  }

  // 3. Montar dados herdados do projeto
  const trilha = normalizarTrilha(projeto.trilha)
  const valor = valorEstimado !== undefined ? valorEstimado : Number(projeto.valor_global || 0)
  const titulo = tituloCustomizado?.trim() || `${projeto.numero} — ${projeto.nome}`

  let responsavelUserId = usuarioAtual.id
  let responsavelColabId: string | null = null

  if (projeto.coordenador_colaborador) {
    responsavelColabId = projeto.coordenador_colaborador
  } else if (projeto.analista_colaborador) {
    responsavelColabId = projeto.analista_colaborador
  } else if (projeto.responsavel_tecnico) {
    responsavelUserId = projeto.responsavel_tecnico
  }

  const observacoesHTML = [
    projeto.observacoes || '',
    observacoesAdicionais
      ? `<p><strong>Nota de conversão:</strong> ${observacoesAdicionais}</p>`
      : '',
    `<p><small>Oportunidade originada a partir do Projeto ${projeto.numero} (${projeto.nome}) em ${new Date().toLocaleDateString('pt-BR')} por ${usuarioAtual.name || usuarioAtual.email}.</small></p>`,
  ]
    .filter(Boolean)
    .join('')

  // 4. Criar a oportunidade com o vínculo ao projeto
  const novaOportunidade = await createOne<OportunidadeRecord>('oportunidades', {
    cliente: projeto.cliente,
    titulo,
    tipo_servico: null,
    servico_nome: projeto.tipo_servico || '',
    etapa: 'lead',
    valor_estimado: valor,
    probabilidade: 30,
    data_prevista_fechamento: projeto.prazo || '',
    responsavel: responsavelUserId,
    responsavel_colaborador: responsavelColabId,
    trilha_prevista: trilha,
    trilha_prevista_nome:
      projeto.trilha === 'registro'
        ? 'Registro de aeródromo / heliponto'
        : projeto.trilha === 'opea'
          ? 'OPEA (Processo Aeroportuário / Obstáculos)'
          : 'Demais projetos aeronáuticos',
    observacoes: observacoesHTML,
    origem_canal: 'outro',
    projeto: projeto.id,
  })

  // 5. Vincular a oportunidade no projeto
  await updateOne('projetos', projeto.id, {
    oportunidade: novaOportunidade.id,
  })

  // 6. Registrar auditoria nas atividades
  try {
    await createOne('atividades', {
      usuario: usuarioAtual.id,
      texto: `Conversão: Projeto ${projeto.numero} transformado na oportunidade "${novaOportunidade.titulo}" (ID ${novaOportunidade.id}).`,
      cliente: projeto.cliente,
      projeto: projeto.id,
      oportunidade: novaOportunidade.id,
      tipo: 'conversao_projeto_oportunidade',
    })
  } catch (err) {
    console.warn('Aviso ao registrar atividade de auditoria:', err)
  }

  return { oportunidade: novaOportunidade, recemCriada: true }
}

/**
 * Converte Oportunidade em Projeto (Oportunidade -> Projeto)
 * Idempotente: se já houver projeto vinculado à oportunidade, retorna o existente sem duplicar.
 * Utiliza o backend PocketBase (onRecordCreate em 'projetos') para numeração sequencial AAAA-NNN única.
 */
export async function converterOportunidadeEmProjeto({
  oportunidadeId,
  usuarioAtual,
  nomeCustomizado,
  prazo,
  observacoesAdicionais,
}: ConversaoOportunidadeProjetoParams): Promise<{
  projeto: ProjetoRecord
  recemCriado: boolean
}> {
  // 1. Carregar oportunidade
  const oportunidade = await getOne<OportunidadeRecord>('oportunidades', oportunidadeId, {
    expand: 'cliente,responsavel,responsavel_colaborador,tipo_servico,projeto',
  })

  // 2. Trava de Idempotência: verificar se já possui projeto vinculado
  if (oportunidade.projeto) {
    try {
      const projExistente = await getOne<ProjetoRecord>('projetos', oportunidade.projeto, {
        expand: 'cliente,oportunidade',
      })
      if (!projExistente.oportunidade || projExistente.oportunidade !== oportunidade.id) {
        await updateOne('projetos', projExistente.id, { oportunidade: oportunidade.id })
      }
      return { projeto: projExistente, recemCriado: false }
    } catch {
      // Se não achou, prossegue
    }
  }

  // Verificar se há algum projeto apontando para esta oportunidade
  try {
    const projJaVinculado = await pb
      .collection('projetos')
      .getFirstListItem<ProjetoRecord>(`oportunidade = "${oportunidade.id}"`, {
        expand: 'cliente,oportunidade',
      })
    if (projJaVinculado) {
      if (!oportunidade.projeto || oportunidade.projeto !== projJaVinculado.id) {
        await updateOne('oportunidades', oportunidade.id, { projeto: projJaVinculado.id })
      }
      return { projeto: projJaVinculado, recemCriado: false }
    }
  } catch {
    // nenhum encontrado, prossegue criação
  }

  // 3. Montar dados herdados da oportunidade
  const trilha = normalizarTrilha(oportunidade.trilha_prevista || oportunidade.trilha_prevista_nome)
  const nome = nomeCustomizado?.trim() || oportunidade.titulo
  const tipoServico =
    oportunidade.servico_nome ||
    oportunidade.expand?.tipo_servico?.nome ||
    (trilha === 'opea'
      ? 'OPEA — Objeto Projetado no Espaço Aéreo'
      : trilha === 'registro'
        ? 'Registro e Homologação de Aeródromo / Heliponto'
        : 'Consultoria e Projetos Aeronáuticos')

  const fasesPadrao: Record<Trail, string> = {
    opea: 'Análise de Viabilidade',
    registro: 'Levantamento Cadastral',
    demais: 'Briefing e Alinhamento',
  }

  const observacoesHTML = [
    oportunidade.observacoes || '',
    observacoesAdicionais
      ? `<p><strong>Nota de conversão:</strong> ${observacoesAdicionais}</p>`
      : '',
    `<p><small>Projeto criado por conversão direta da oportunidade "${oportunidade.titulo}" (ID ${oportunidade.id}) em ${new Date().toLocaleDateString('pt-BR')} por ${usuarioAtual.name || usuarioAtual.email}.</small></p>`,
  ]
    .filter(Boolean)
    .join('')

  // 4. Criar projeto (o backend PocketBase atribui numero AAAA-NNN sequencial global único)
  const novoProjeto = await createOne<ProjetoRecord>('projetos', {
    nome,
    cliente: oportunidade.cliente,
    oportunidade: oportunidade.id,
    trilha,
    fase: fasesPadrao[trilha],
    status: 'ativo',
    tipo_servico: tipoServico,
    valor_global: Number(oportunidade.valor_estimado || 0),
    data_inicio: new Date().toISOString().slice(0, 10),
    prazo: prazo ? `${prazo} 12:00:00.000Z` : oportunidade.data_prevista_fechamento || '',
    coordenador_colaborador: oportunidade.responsavel_colaborador || null,
    responsavel_tecnico:
      oportunidade.responsavel || (usuarioAtual.role === 'tecnico' ? usuarioAtual.id : null),
    observacoes: observacoesHTML,
    percentual_concluido: 0,
    prioridade: 'normal',
  })

  // 5. Atualizar oportunidade vinculando ao projeto e marcando etapa como ganha
  await updateOne('oportunidades', oportunidade.id, {
    projeto: novoProjeto.id,
    etapa: 'ganho',
    data_fechamento: new Date().toISOString(),
  })

  // 6. Registrar auditoria nas atividades
  try {
    await createOne('atividades', {
      usuario: usuarioAtual.id,
      texto: `Conversão: Oportunidade "${oportunidade.titulo}" transformada no Projeto ${novoProjeto.numero} (${novoProjeto.nome}).`,
      cliente: oportunidade.cliente,
      projeto: novoProjeto.id,
      oportunidade: oportunidade.id,
      tipo: 'conversao_oportunidade_projeto',
    })
  } catch (err) {
    console.warn('Aviso ao registrar atividade de auditoria:', err)
  }

  return { projeto: novoProjeto, recemCriado: true }
}
