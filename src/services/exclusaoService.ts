import pb from '@/lib/pocketbase/client'
import type {
  AnexoRecord,
  AtividadeRecord,
  ClienteRecord,
  ContratoRecord,
  DocumentoRecord,
  ExigenciaRecord,
  OportunidadeRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
  TarefaRecord,
} from '@/types/crm'
import type { NfseDadoExtraido } from './nfseParser'

export interface DetalhesImpactoProjeto {
  parcelas: ParcelaRecord[]
  notasFiscais: ParcelaRecord[] // parcelas com nf_numero ou nfse_chave ou nfse_dados
  processos: ProcessoRecord[]
  exigencias: ExigenciaRecord[]
  documentos: DocumentoRecord[]
  anexos: AnexoRecord[]
  atividades: AtividadeRecord[]
  oportunidades: OportunidadeRecord[]
  ordensServico: OrdemServicoRecord[]
  tarefas: TarefaRecord[]
  linksExternos: any[]
}

export interface DetalhesImpactoCliente {
  projetos: ProjetoRecord[]
  oportunidades: OportunidadeRecord[]
  propostas: PropostaRecord[]
  contratos: ContratoRecord[]
  contatos: any[]
  empreendimentos: any[]
  documentos: DocumentoRecord[]
  anexos: AnexoRecord[]
  atividades: AtividadeRecord[]
  parcelas: ParcelaRecord[]
  notasFiscais: ParcelaRecord[]
}

const STORAGE_KEY_ORPHANS = 'aerocad_nfse_orfas'

/**
 * Adiciona notas extraídas das parcelas apagadas/desvinculadas de volta ao sessionStorage
 * para ficarem imediatamente disponíveis na aba "Notas Órfãs" do Financeiro
 */
export function devolverNotasParaOrfas(parcelasComNfse: ParcelaRecord[]): number {
  if (!parcelasComNfse || parcelasComNfse.length === 0) return 0

  let orfasAtuais: NfseDadoExtraido[] = []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ORPHANS)
    orfasAtuais = raw ? JSON.parse(raw) : []
  } catch {
    orfasAtuais = []
  }

  const existentesMap = new Set(
    orfasAtuais.map(
      (o) =>
        `${(o.numero || '').trim().toLowerCase()}_${(o.prestadorCnpjCpf || '').trim().toLowerCase()}`,
    ),
  )

  let adicionadas = 0

  for (const p of parcelasComNfse) {
    const rawDados = (p as any).nfse_dados
    let parsedDados: any = null
    if (rawDados) {
      parsedDados = typeof rawDados === 'string' ? JSON.parse(rawDados) : rawDados
    }

    const numeroNota = p.nf_numero || parsedDados?.numero || ''
    if (!numeroNota) continue

    const prestador = parsedDados?.prestadorCnpjCpf || 'aerocad'
    const chaveUnica = `${numeroNota.trim().toLowerCase()}_${prestador.trim().toLowerCase()}`

    // Reconstrói o objeto NfseDadoExtraido para a central de órfãs
    const notaRecuperada: NfseDadoExtraido = {
      idTemp: `orfa_recup_${p.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      numero: numeroNota,
      serie: parsedDados?.serie || '',
      codigoVerificacao: parsedDados?.codigoVerificacao || '',
      dataEmissao:
        p.data_faturamento || parsedDados?.dataEmissao || p.vencimento || new Date().toISOString(),
      dataRecebimento: p.data_pagamento || parsedDados?.dataRecebimento,
      valorBruto: parsedDados?.valorBruto || p.valor || 0,
      valorLiquido: parsedDados?.valorLiquido || p.valor_recebido || p.valor || 0,
      retencoesTexto: p.retencoes || parsedDados?.retencoesTexto || '',
      tomadorRazao:
        parsedDados?.tomadorRazao ||
        p.expand?.cliente?.razao_social ||
        'Cliente / Tomador do projeto excluído',
      tomadorCnpjCpf: parsedDados?.tomadorCnpjCpf || p.expand?.cliente?.cnpj_cpf || '',
      tomadorEndereco: parsedDados?.tomadorEndereco,
      tomadorMunicipio: parsedDados?.tomadorMunicipio,
      tomadorUf: parsedDados?.tomadorUf,
      tomadorEmail: parsedDados?.tomadorEmail,
      tomadorTelefone: parsedDados?.tomadorTelefone,
      prestadorRazao: parsedDados?.prestadorRazao || 'AEROCAD ENGENHARIA E CONSULTORIA LTDA',
      prestadorCnpjCpf: parsedDados?.prestadorCnpjCpf || '',
      descricaoServico: parsedDados?.descricaoServico || p.descricao,
      situacao: p.status === 'paga' ? 'paga' : 'emitida',
      projetoIdMencionado: undefined, // Desvinculada de projeto!
      origemArquivo: parsedDados?.origemArquivo || 'planilha',
      raw: parsedDados?.raw || {},
    }

    // Se já estiver na lista de órfãs, atualiza/substitui ou adiciona
    if (!existentesMap.has(chaveUnica)) {
      orfasAtuais.push(notaRecuperada)
      existentesMap.add(chaveUnica)
      adicionadas++
    }
  }

  try {
    sessionStorage.setItem(STORAGE_KEY_ORPHANS, JSON.stringify(orfasAtuais))
  } catch (err) {
    console.warn('Erro ao salvar notas órfãs devolvidas em sessionStorage:', err)
  }

  return adicionadas
}

/**
 * Consulta em detalhe os registros dependentes de um projeto para exibir no modal de confirmação
 */
export async function obterImpactoExclusaoProjeto(
  projetoId: string,
): Promise<DetalhesImpactoProjeto> {
  const [
    parcelas,
    processos,
    documentos,
    anexos,
    atividades,
    oportunidades,
    ordensServico,
    tarefas,
    linksExternos,
  ] = await Promise.all([
    pb
      .collection('parcelas')
      .getFullList<ParcelaRecord>({
        filter: `projeto = '${projetoId}'`,
        expand: 'cliente',
      })
      .catch(() => []),
    pb
      .collection('processos')
      .getFullList<ProcessoRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('documentos')
      .getFullList<DocumentoRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('anexos')
      .getFullList<AnexoRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('atividades')
      .getFullList<AtividadeRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('oportunidades')
      .getFullList<OportunidadeRecord>({
        filter: `id != ''`, // Oportunidade vinculada diretamente pelo projeto
      })
      .catch(() => []),
    pb
      .collection('ordens_servico')
      .getFullList<OrdemServicoRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('tarefas')
      .getFullList<TarefaRecord>({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
    pb
      .collection('links_externos')
      .getFullList({
        filter: `projeto = '${projetoId}'`,
      })
      .catch(() => []),
  ])

  // Exigências vinculadas aos processos deste projeto
  let exigencias: ExigenciaRecord[] = []
  if (processos.length > 0) {
    const procIds = processos.map((p) => p.id)
    const procFilter = procIds.map((id) => `processo = '${id}'`).join(' || ')
    exigencias = await pb
      .collection('exigencias')
      .getFullList<ExigenciaRecord>({
        filter: procFilter,
      })
      .catch(() => [])
  }

  // Filtrar oportunidades que apontam ou pertencem ao projeto
  const projRecord = await pb
    .collection('projetos')
    .getOne<ProjetoRecord>(projetoId)
    .catch(() => null)
  let opsFiltradas: OportunidadeRecord[] = []
  if (projRecord?.oportunidade) {
    opsFiltradas = oportunidades.filter((o) => o.id === projRecord.oportunidade)
  }

  // Identifica parcelas com notas fiscais reais associadas
  const notasFiscais = parcelas.filter(
    (p) =>
      Boolean(p.nf_numero?.trim()) ||
      Boolean(p.nfse_chave?.trim()) ||
      Boolean((p as any).nfse_dados),
  )

  return {
    parcelas,
    notasFiscais,
    processos,
    exigencias,
    documentos,
    anexos,
    atividades,
    oportunidades: opsFiltradas,
    ordensServico,
    tarefas,
    linksExternos,
  }
}

/**
 * Executa a exclusão de um projeto em cascata com ordem correta (filhos antes do pai),
 * preservando as NFS-e fiscais reais na central de Notas Órfãs e gerando log de auditoria.
 */
export async function excluirProjetoEmCascata(
  projeto: ProjetoRecord,
  usuarioNome: string,
  usuarioId: string,
): Promise<{ notasOrfasDevolvidas: number }> {
  const projetoId = projeto.id
  const impacto = await obterImpactoExclusaoProjeto(projetoId)

  // 1. Preservar as notas fiscais NFS-e na central de Notas Órfãs antes de apagar as parcelas
  const notasOrfasDevolvidas = devolverNotasParaOrfas(impacto.notasFiscais)

  // 2. Apagar exigências dos processos do projeto
  for (const ex of impacto.exigencias) {
    try {
      await pb.collection('exigencias').delete(ex.id)
    } catch (e) {
      console.warn(`Erro ao excluir exigência ${ex.id}:`, e)
    }
  }

  // 3. Apagar processos regulatórios vinculados ao projeto
  for (const proc of impacto.processos) {
    try {
      await pb.collection('processos').delete(proc.id)
    } catch (e) {
      console.warn(`Erro ao excluir processo ${proc.id}:`, e)
    }
  }

  // 4. Apagar ordens de serviço (OS) de terceiros
  for (const os of impacto.ordensServico) {
    try {
      await pb.collection('ordens_servico').delete(os.id)
    } catch (e) {
      console.warn(`Erro ao excluir ordem de serviço ${os.id}:`, e)
    }
  }

  // 5. Apagar tarefas vinculadas ao projeto
  for (const t of impacto.tarefas) {
    try {
      await pb.collection('tarefas').delete(t.id)
    } catch (e) {
      console.warn(`Erro ao excluir tarefa ${t.id}:`, e)
    }
  }

  // 6. Apagar parcelas financeiras do projeto
  for (const p of impacto.parcelas) {
    try {
      await pb.collection('parcelas').delete(p.id)
    } catch (e) {
      console.warn(`Erro ao excluir parcela ${p.id}:`, e)
    }
  }

  // 7. Apagar documentos gerados vinculados ao projeto
  for (const doc of impacto.documentos) {
    try {
      await pb.collection('documentos').delete(doc.id)
    } catch (e) {
      console.warn(`Erro ao excluir documento ${doc.id}:`, e)
    }
  }

  // 8. Apagar anexos de arquivos vinculados ao projeto
  for (const a of impacto.anexos) {
    try {
      await pb.collection('anexos').delete(a.id)
    } catch (e) {
      console.warn(`Erro ao excluir anexo ${a.id}:`, e)
    }
  }

  // 9. Apagar links externos vinculados ao projeto
  for (const l of impacto.linksExternos) {
    try {
      await pb.collection('links_externos').delete(l.id)
    } catch (e) {
      console.warn(`Erro ao excluir link externo ${l.id}:`, e)
    }
  }

  // 10. Apagar atividades da timeline vinculadas ao projeto
  for (const ativ of impacto.atividades) {
    try {
      await pb.collection('atividades').delete(ativ.id)
    } catch (e) {
      console.warn(`Erro ao excluir atividade ${ativ.id}:`, e)
    }
  }

  // 11. Se houver oportunidade vinculada ao projeto, desvincula o projeto ou mantém histórico
  // (a oportunidade é do cliente, não precisa ser deletada compulsoriamente)

  // 12. Apagar o registro do projeto
  await pb.collection('projetos').delete(projetoId)

  // 13. Registrar auditoria na coleção de atividades do cliente (se cliente ainda existir) e no importacoes_log
  try {
    const resumoAuditoria = {
      acao: 'exclusao_projeto',
      projetoNumero: projeto.numero,
      projetoNome: projeto.nome,
      projetoId: projeto.id,
      clienteId: projeto.cliente,
      usuarioId: usuarioId || null,
      usuarioNome: usuarioNome || 'Administrador',
      dataHora: new Date().toISOString(),
      itensRemovidos: {
        parcelas: impacto.parcelas.length,
        notasFiscaisPreservadasOrfas: impacto.notasFiscais.length,
        processos: impacto.processos.length,
        exigencias: impacto.exigencias.length,
        ordensServico: impacto.ordensServico.length,
        documentos: impacto.documentos.length,
        anexos: impacto.anexos.length,
        atividades: impacto.atividades.length,
        tarefas: impacto.tarefas.length,
      },
    }

    // Grava atividade na timeline do cliente (se cliente existir)
    if (projeto.cliente) {
      await pb
        .collection('atividades')
        .create({
          usuario: usuarioId || null,
          cliente: projeto.cliente,
          texto: `[AUDITORIA] Projeto nº ${projeto.numero} ("${projeto.nome}") foi excluído permanentemente pelo administrador ${usuarioNome}. ${impacto.parcelas.length} parcelas e ${impacto.processos.length} processos foram removidos. ${impacto.notasFiscais.length} notas NFS-e foram devolvidas para a central de Notas Órfãs.`,
          tipo: 'auditoria',
          data_hora: new Date().toISOString(),
        })
        .catch(() => null)
    }

    // Grava também no log geral de operações/importações
    await pb
      .collection('importacoes_log')
      .create({
        arquivo_nome: `AUDITORIA_EXCLUSAO_PROJETO_${projeto.numero}.json`,
        tamanho_bytes: 0,
        usuario: usuarioId || null,
        total_clientes: 0,
        total_projetos: 1,
        total_financeiro: impacto.parcelas.length,
        total_comunicacoes: impacto.atividades.length,
        resumo: resumoAuditoria,
      })
      .catch(() => null)
  } catch (errLog) {
    console.warn('Falha secundária ao registrar auditoria de exclusão:', errLog)
  }

  return { notasOrfasDevolvidas }
}

/**
 * Consulta detalhes e projetos vinculados ao cliente antes de exclusão
 */
export async function obterImpactoExclusaoCliente(
  clienteId: string,
): Promise<DetalhesImpactoCliente> {
  const [
    projetos,
    oportunidades,
    propostas,
    contratos,
    contatos,
    empreendimentos,
    documentos,
    anexos,
    atividades,
    parcelas,
  ] = await Promise.all([
    pb
      .collection('projetos')
      .getFullList<ProjetoRecord>({
        filter: `cliente = '${clienteId}'`,
        sort: '-created',
      })
      .catch(() => []),
    pb
      .collection('oportunidades')
      .getFullList<OportunidadeRecord>({
        filter: `cliente = '${clienteId}'`,
        sort: '-created',
      })
      .catch(() => []),
    pb
      .collection('propostas')
      .getFullList<PropostaRecord>({
        filter: `oportunidade.cliente = '${clienteId}'`,
        sort: '-created',
      })
      .catch(() => []),
    pb
      .collection('contratos')
      .getFullList<ContratoRecord>({
        filter: `cliente = '${clienteId}'`,
        sort: '-created',
      })
      .catch(() => []),
    pb
      .collection('contatos')
      .getFullList({
        filter: `cliente = '${clienteId}'`,
      })
      .catch(() => []),
    pb
      .collection('empreendimentos')
      .getFullList({
        filter: `cliente = '${clienteId}'`,
      })
      .catch(() => []),
    pb
      .collection('documentos')
      .getFullList<DocumentoRecord>({
        filter: `cliente = '${clienteId}'`,
      })
      .catch(() => []),
    pb
      .collection('anexos')
      .getFullList<AnexoRecord>({
        filter: `cliente = '${clienteId}'`,
      })
      .catch(() => []),
    pb
      .collection('atividades')
      .getFullList<AtividadeRecord>({
        filter: `cliente = '${clienteId}'`,
      })
      .catch(() => []),
    pb
      .collection('parcelas')
      .getFullList<ParcelaRecord>({
        filter: `cliente = '${clienteId}'`,
        expand: 'cliente',
      })
      .catch(() => []),
  ])

  const notasFiscais = parcelas.filter(
    (p) =>
      Boolean(p.nf_numero?.trim()) ||
      Boolean(p.nfse_chave?.trim()) ||
      Boolean((p as any).nfse_dados),
  )

  return {
    projetos,
    oportunidades,
    propostas,
    contratos,
    contatos,
    empreendimentos,
    documentos,
    anexos,
    atividades,
    parcelas,
    notasFiscais,
  }
}

/**
 * Exclui cliente e seus anexos/documentos/contatos vinculados.
 * NOTA DE SEGURANÇA: Bloqueia exclusão se o cliente tiver projetos cadastrados,
 * forçando a exclusão prévia consciente de cada projeto.
 * NFS-e ligadas a parcelas diretas perdem vínculo e vão para a central de Notas Órfãs.
 */
export async function excluirCliente(
  cliente: ClienteRecord,
  usuarioNome: string,
  usuarioId: string,
): Promise<{ notasOrfasDevolvidas: number }> {
  const clienteId = cliente.id
  const impacto = await obterImpactoExclusaoCliente(clienteId)

  if (impacto.projetos.length > 0) {
    throw new Error(
      `O cliente possui ${impacto.projetos.length} projeto(s) ativo(s) ou cadastrado(s). Exclua ou desvincule os projetos primeiro antes de remover o cliente.`,
    )
  }

  // 1. Devolver notas fiscais do cliente para a central de Notas Órfãs
  const notasOrfasDevolvidas = devolverNotasParaOrfas(impacto.notasFiscais)

  // 2. Apagar parcelas que estavam ligadas diretamente ao cliente
  for (const p of impacto.parcelas) {
    try {
      await pb.collection('parcelas').delete(p.id)
    } catch (e) {
      console.warn(`Erro ao excluir parcela ${p.id}:`, e)
    }
  }

  // 3. Apagar contratos do cliente
  for (const c of impacto.contratos) {
    try {
      await pb.collection('contratos').delete(c.id)
    } catch (e) {
      console.warn(`Erro ao excluir contrato ${c.id}:`, e)
    }
  }

  // 4. Apagar propostas do cliente
  for (const prop of impacto.propostas) {
    try {
      await pb.collection('propostas').delete(prop.id)
    } catch (e) {
      console.warn(`Erro ao excluir proposta ${prop.id}:`, e)
    }
  }

  // 5. Apagar oportunidades do cliente
  for (const op of impacto.oportunidades) {
    try {
      await pb.collection('oportunidades').delete(op.id)
    } catch (e) {
      console.warn(`Erro ao excluir oportunidade ${op.id}:`, e)
    }
  }

  // 6. Apagar anexos vinculados ao cliente
  for (const an of impacto.anexos) {
    try {
      await pb.collection('anexos').delete(an.id)
    } catch (e) {
      console.warn(`Erro ao excluir anexo ${an.id}:`, e)
    }
  }

  // 7. Apagar documentos vinculados ao cliente
  for (const doc of impacto.documentos) {
    try {
      await pb.collection('documentos').delete(doc.id)
    } catch (e) {
      console.warn(`Erro ao excluir documento ${doc.id}:`, e)
    }
  }

  // 8. Apagar contatos do cliente (caso cascadeDelete não tenha rodado)
  for (const ct of impacto.contatos) {
    try {
      await pb.collection('contatos').delete(ct.id)
    } catch (e) {
      console.warn(`Erro ao excluir contato ${ct.id}:`, e)
    }
  }

  // 9. Apagar empreendimentos do cliente
  for (const emp of impacto.empreendimentos) {
    try {
      await pb.collection('empreendimentos').delete(emp.id)
    } catch (e) {
      console.warn(`Erro ao excluir empreendimento ${emp.id}:`, e)
    }
  }

  // 10. Apagar atividades do cliente
  for (const ativ of impacto.atividades) {
    try {
      await pb.collection('atividades').delete(ativ.id)
    } catch (e) {
      console.warn(`Erro ao excluir atividade ${ativ.id}:`, e)
    }
  }

  // 11. Apagar o registro do cliente
  await pb.collection('clientes').delete(clienteId)

  // 12. Gravar auditoria no log do sistema
  try {
    await pb
      .collection('importacoes_log')
      .create({
        arquivo_nome: `AUDITORIA_EXCLUSAO_CLIENTE_${cliente.razao_social.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.json`,
        tamanho_bytes: 0,
        usuario: usuarioId || null,
        total_clientes: 1,
        total_projetos: 0,
        total_financeiro: impacto.parcelas.length,
        total_comunicacoes: impacto.atividades.length,
        resumo: {
          acao: 'exclusao_cliente',
          clienteId: cliente.id,
          razaoSocial: cliente.razao_social,
          cnpjCpf: cliente.cnpj_cpf,
          usuarioId: usuarioId || null,
          usuarioNome: usuarioNome || 'Administrador',
          dataHora: new Date().toISOString(),
          itensRemovidos: {
            oportunidades: impacto.oportunidades.length,
            propostas: impacto.propostas.length,
            contratos: impacto.contratos.length,
            contatos: impacto.contatos.length,
            empreendimentos: impacto.empreendimentos.length,
            anexos: impacto.anexos.length,
            documentos: impacto.documentos.length,
            parcelas: impacto.parcelas.length,
            notasFiscaisPreservadasOrfas: impacto.notasFiscais.length,
          },
        },
      })
      .catch(() => null)
  } catch (errLog) {
    console.warn('Falha ao registrar auditoria de exclusão de cliente:', errLog)
  }

  return { notasOrfasDevolvidas }
}
