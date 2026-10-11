import pb from '@/lib/pocketbase/client'
import type {
  AlertaDispensadoRecord,
  AlertaItem,
  AlertaSeveridade,
  AtividadeRecord,
  ExigenciaRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
  Role,
} from '@/types/crm'

export interface MotorAlertasParams {
  role?: Role
  userId?: string
  propostas?: PropostaRecord[]
  exigencias?: ExigenciaRecord[]
  parcelas?: ParcelaRecord[]
  ordensServico?: OrdemServicoRecord[]
  processos?: ProcessoRecord[]
  projetos?: ProjetoRecord[]
  atividades?: AtividadeRecord[]
  dispensados?: AlertaDispensadoRecord[]
  diasOrgaoSemParecer?: number
}

// Ordem numérica de severidade: informativo (1) < atencao (2) < critico (3)
const severidadePeso: Record<AlertaSeveridade, number> = {
  informativo: 1,
  atencao: 2,
  critico: 3,
}

export function isSeveridadePior(atual: AlertaSeveridade, dispensada: AlertaSeveridade): boolean {
  return severidadePeso[atual] > severidadePeso[dispensada]
}

function parseDateOnly(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d
}

function getDiffDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const utc1 = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utc2 = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((utc2 - utc1) / msPerDay)
}

/**
 * Deriva a lista de alertas a partir dos dados existentes.
 * Regras:
 * - Proposta enviada sem retorno há mais de 3 / 7 / 15 dias (D+3 leve/informativo, D+7 médio/atenção, D+15 crítico).
 * - Proposta expirada (passou a validade de 30/90 dias e continua sem status aceita/recusada).
 * - Exigência de processo regulatório com prazo de resposta vencendo (próximos 3 dias) ou vencida.
 * - Exigência respondida mas sem registro de resposta enviada.
 * - Parcela financeira vencida (data de vencimento passada e não paga).
 * - OS de terceiro:
 *     * atribuída sem resposta do prestador há mais de 2 dias (D+2);
 *     * em execução com prazo vencendo (próximos 3 dias) ou vencida;
 *     * concluída mas pendente de validação interna.
 * - Processo protocolado no órgão há mais de X dias sem parecer (padrão 30) — lembrete de acompanhamento "prazo do órgão", nunca como prazo AEROCAD.
 * - Projeto sem movimentação/atividade registrada há 15 dias.
 *
 * Filtro por perfil:
 * - comercial: propostas
 * - tecnico: exigências, OS, processos, projetos
 * - financeiro: parcelas
 * - admin: vê tudo
 * - terceiro: nenhum alerta
 */
export function derivarAlertas(params: MotorAlertasParams): AlertaItem[] {
  const {
    role = 'admin',
    propostas = [],
    exigencias = [],
    parcelas = [],
    ordensServico = [],
    processos = [],
    projetos = [],
    atividades = [],
    dispensados = [],
    diasOrgaoSemParecer = 30,
  } = params

  if (role === 'terceiro') {
    return []
  }

  const verComercial = role === 'admin' || role === 'comercial'
  const verTecnico = role === 'admin' || role === 'tecnico'
  const verFinanceiro = role === 'admin' || role === 'financeiro'

  const hoje = new Date()
  const alertas: AlertaItem[] = []

  // 1. PROPOSTAS (Comercial)
  if (verComercial) {
    propostas.forEach((p) => {
      const dataEnvio = parseDateOnly(p.data_envio || p.created)
      const validadeDias = Number(p.validade_dias) || 30
      const link = p.oportunidade ? `/funil?oportunidade=${p.oportunidade}` : '/funil'
      const numProp = p.numero ? `Proposta ${p.numero}` : 'Proposta comercial'

      // Regra 1.1: Proposta enviada sem retorno há mais de 3 / 7 / 15 dias
      if (p.status === 'enviada' && dataEnvio) {
        const diasSemRetorno = getDiffDays(dataEnvio, hoje)
        if (diasSemRetorno >= 3) {
          let severidade: AlertaSeveridade = 'informativo'
          if (diasSemRetorno >= 15) {
            severidade = 'critico'
          } else if (diasSemRetorno >= 7) {
            severidade = 'atencao'
          }

          alertas.push({
            chave: `prop_sem_retorno_${p.id}`,
            tipo: 'proposta_sem_retorno',
            severidade,
            titulo: `${numProp} sem retorno há ${diasSemRetorno} dias`,
            descricao: `Enviada ao cliente em ${dataEnvio.toLocaleDateString('pt-BR')} e sem retorno registrado (${severidade === 'critico' ? 'D+15 crítico' : severidade === 'atencao' ? 'D+7 atenção' : 'D+3 acompanhamento'}).`,
            link,
            linkTexto: 'Ver oportunidade no funil',
            categoria: 'comercial',
            dataReferencia: p.data_envio || p.created,
            diasAtraso: diasSemRetorno,
            registroId: p.id,
            meta: { valor: p.valor_total, numero: p.numero },
          })
        }
      }

      // Regra 1.2: Proposta expirada (passou a validade de 30/90 dias e continua sem status aceita/recusada)
      if (dataEnvio && !['aceita', 'recusada'].includes(p.status)) {
        const dataExpiracao = new Date(dataEnvio)
        dataExpiracao.setDate(dataExpiracao.getDate() + validadeDias)
        const diasExpirado = getDiffDays(dataExpiracao, hoje)
        if (diasExpirado > 0) {
          alertas.push({
            chave: `prop_expirada_${p.id}`,
            tipo: 'proposta_expirada',
            severidade: 'atencao',
            titulo: `${numProp} expirada (validade de ${validadeDias} dias vencida)`,
            descricao: `Prazo de validade encerrou há ${diasExpirado} dia(s). Status atual: "${p.status}". Requer renovação comercial ou revalidação com cliente.`,
            link,
            linkTexto: 'Ver proposta no funil',
            categoria: 'comercial',
            dataReferencia: dataExpiracao.toISOString(),
            diasAtraso: diasExpirado,
            registroId: p.id,
          })
        }
      }
    })
  }

  // 2. EXIGÊNCIAS (Técnico)
  if (verTecnico) {
    exigencias.forEach((ex) => {
      const link = ex.processo ? `/processos/${ex.processo}` : '/processos'
      const procProtocolo = ex.expand?.processo?.numero_protocolo || 'Processo regulatório'
      const prazo = parseDateOnly(ex.prazo)

      // Regra 2.1: Prazo de resposta vencendo (próximos 3 dias) ou vencida
      if (ex.status === 'pendente' && prazo) {
        const diasAtePrazo = getDiffDays(hoje, prazo)
        if (diasAtePrazo < 0) {
          const diasVencido = Math.abs(diasAtePrazo)
          alertas.push({
            chave: `exigencia_vencida_${ex.id}`,
            tipo: 'exigencia_prazo',
            severidade: 'critico',
            titulo: `Exigência VENCIDA há ${diasVencido} dia(s) (${procProtocolo})`,
            descricao: `Prazo encerrou em ${prazo.toLocaleDateString('pt-BR')}. Resposta técnica pendente: "${ex.descricao.slice(0, 100)}". Risco de indeferimento no órgão!`,
            link,
            linkTexto: 'Responder no processo',
            categoria: 'tecnico',
            dataReferencia: ex.prazo,
            diasAtraso: diasVencido,
            registroId: ex.id,
          })
        } else if (diasAtePrazo <= 3) {
          alertas.push({
            chave: `exigencia_prazo_proximo_${ex.id}`,
            tipo: 'exigencia_prazo',
            severidade: diasAtePrazo <= 1 ? 'critico' : 'atencao',
            titulo: `Exigência vence em ${diasAtePrazo === 0 ? 'HOJE' : `${diasAtePrazo} dia(s)`} (${procProtocolo})`,
            descricao: `Prazo final para envio no órgão: ${prazo.toLocaleDateString('pt-BR')}. Descrição: "${ex.descricao.slice(0, 100)}".`,
            link,
            linkTexto: 'Acessar processo regulatório',
            categoria: 'tecnico',
            dataReferencia: ex.prazo,
            diasRestantes: diasAtePrazo,
            registroId: ex.id,
          })
        }
      }

      // Regra 2.2: Exigência com resposta rascunhada/preenchida mas sem data de envio registrada
      // (ex: tem texto em ex.resposta ou historico, mas status continua 'pendente' ou data_resposta vazia)
      const temTextoResposta =
        (ex.resposta && ex.resposta.trim().length > 0) ||
        (ex.historico_respostas && ex.historico_respostas.length > 0)
      if (temTextoResposta && ex.status === 'pendente' && !ex.data_resposta) {
        alertas.push({
          chave: `exigencia_sem_envio_${ex.id}`,
          tipo: 'exigencia_sem_envio',
          severidade: 'atencao',
          titulo: `Exigência respondida mas sem protocolo/envio registrado (${procProtocolo})`,
          descricao: `Há minuta de resposta preenchida na exigência, porém a data de envio/protocolo no órgão ainda não foi confirmada.`,
          link,
          linkTexto: 'Verificar e protocolar',
          categoria: 'tecnico',
          registroId: ex.id,
        })
      }
    })
  }

  // 3. PARCELAS FINANCEIRAS (Financeiro)
  if (verFinanceiro) {
    parcelas.forEach((parc) => {
      if (parc.status === 'paga') return
      const vencimento = parseDateOnly(parc.vencimento)
      if (!vencimento) return

      const diasAteVenc = getDiffDays(hoje, vencimento)
      const link = parc.projeto ? `/financeiro?projeto=${parc.projeto}` : '/financeiro'
      const projNome =
        parc.expand?.projeto?.numero || parc.expand?.cliente?.razao_social || 'AEROCAD'

      if (diasAteVenc < 0 || parc.status === 'vencida') {
        const diasVencido = Math.abs(diasAteVenc)
        let severidade: AlertaSeveridade = 'atencao'
        if (diasVencido >= 7 || parc.valor >= 5000) {
          severidade = 'critico'
        }

        alertas.push({
          chave: `parcela_vencida_${parc.id}`,
          tipo: 'parcela_vencida',
          severidade,
          titulo: `Parcela vencida há ${diasVencido} dia(s) · ${parc.descricao} (${projNome})`,
          descricao: `Vencimento original em ${vencimento.toLocaleDateString('pt-BR')} no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parc.valor)}. Cobrança financeira necessária.`,
          link,
          linkTexto: 'Abrir no financeiro',
          categoria: 'financeiro',
          dataReferencia: parc.vencimento,
          diasAtraso: diasVencido,
          registroId: parc.id,
          meta: { valor: parc.valor },
        })
      }
    })
  }

  // 4. ORDENS DE SERVIÇO DE TERCEIROS (Técnico / Admin)
  if (verTecnico) {
    ordensServico.forEach((os) => {
      const link = os.projeto ? `/projetos/${os.projeto}` : '/projetos'
      const projNum = os.expand?.projeto?.numero || 'OS'
      const prestador = os.expand?.prestador_usuario?.name || os.prestador || 'Prestador'
      const tituloOs = os.titulo || os.descricao.slice(0, 45)

      // Regra 4.1: OS atribuída sem resposta do prestador há mais de 2 dias (D+2)
      if (['atribuida', 'emitida'].includes(os.status)) {
        const dataAtribuicao = parseDateOnly(os.updated || os.created)
        if (dataAtribuicao) {
          const diasSemResposta = getDiffDays(dataAtribuicao, hoje)
          if (diasSemResposta >= 2) {
            alertas.push({
              chave: `os_sem_resposta_${os.id}`,
              tipo: 'os_sem_resposta',
              severidade: diasSemResposta >= 5 ? 'critico' : 'atencao',
              titulo: `OS sem aceite do prestador há ${diasSemResposta} dias (${projNum})`,
              descricao: `OS "${tituloOs}" designada para ${prestador} sem confirmação de aceite após ${diasSemResposta} dias de atribuição.`,
              link,
              linkTexto: 'Ver OS no projeto',
              categoria: 'tecnico',
              dataReferencia: os.updated || os.created,
              diasAtraso: diasSemResposta,
              registroId: os.id,
            })
          }
        }
      }

      // Regra 4.2: OS em execução com prazo vencendo (3 dias) ou vencida
      if (os.status === 'em_execucao' && os.prazo) {
        const prazoOs = parseDateOnly(os.prazo)
        if (prazoOs) {
          const diasAtePrazo = getDiffDays(hoje, prazoOs)
          if (diasAtePrazo < 0) {
            const diasVencida = Math.abs(diasAtePrazo)
            alertas.push({
              chave: `os_vencida_${os.id}`,
              tipo: 'os_prazo',
              severidade: 'critico',
              titulo: `OS de terceiro ATRASADA há ${diasVencida} dia(s) (${projNum})`,
              descricao: `OS "${tituloOs}" de ${prestador} com prazo final estourado em ${prazoOs.toLocaleDateString('pt-BR')}. Cobrar entrega técnica urgente.`,
              link,
              linkTexto: 'Ver OS no projeto',
              categoria: 'tecnico',
              dataReferencia: os.prazo,
              diasAtraso: diasVencida,
              registroId: os.id,
            })
          } else if (diasAtePrazo <= 3) {
            alertas.push({
              chave: `os_prazo_proximo_${os.id}`,
              tipo: 'os_prazo',
              severidade: 'atencao',
              titulo: `OS vence em ${diasAtePrazo === 0 ? 'HOJE' : `${diasAtePrazo} dia(s)`} · ${prestador} (${projNum})`,
              descricao: `OS "${tituloOs}" tem entrega prevista para ${prazoOs.toLocaleDateString('pt-BR')}. Confirmar andamento com o prestador.`,
              link,
              linkTexto: 'Ver OS no projeto',
              categoria: 'tecnico',
              dataReferencia: os.prazo,
              diasRestantes: diasAtePrazo,
              registroId: os.id,
            })
          }
        }
      }

      // Regra 4.3: OS concluída pelo prestador mas pendente de validação interna
      // Se prestador marcou concluída e tem data_conclusao recente ou observação de entrega
      if (os.status === 'concluida') {
        const dataConclusao = parseDateOnly(os.data_conclusao || os.updated)
        if (dataConclusao) {
          const diasDesdeConclusao = getDiffDays(dataConclusao, hoje)
          if (diasDesdeConclusao >= 1 && diasDesdeConclusao <= 30) {
            alertas.push({
              chave: `os_pendente_validacao_${os.id}`,
              tipo: 'os_pendente_validacao',
              severidade: diasDesdeConclusao >= 5 ? 'atencao' : 'informativo',
              titulo: `OS entregue pelo prestador · Validação interna pendente (${projNum})`,
              descricao: `O prestador ${prestador} concluiu "${tituloOs}" em ${dataConclusao.toLocaleDateString('pt-BR')}. Realizar conferência técnica para aprovação final.`,
              link,
              linkTexto: 'Validar entrega no projeto',
              categoria: 'tecnico',
              dataReferencia: os.data_conclusao || os.updated,
              diasAtraso: diasDesdeConclusao,
              registroId: os.id,
            })
          }
        }
      }
    })
  }

  // 5. PROCESSOS PROTOCOLADOS NO ÓRGÃO HÁ MAIS DE X DIAS SEM PARECER (Técnico)
  // Requisito: "Processo protocolado no órgão há mais de X dias sem parecer (X configurável, padrão 30) — lembrete de acompanhamento, sempre distinguido como 'prazo do órgão', nunca como prazo AEROCAD."
  if (verTecnico) {
    processos.forEach((proc) => {
      if (['deferido', 'indeferido', 'arquivado'].includes(proc.status)) return
      if (proc.status !== 'protocolado' && proc.status !== 'em_exigencia') return

      const dataProtocolo = parseDateOnly(proc.data_protocolo)
      if (!dataProtocolo) return

      const diasSemParecer = getDiffDays(dataProtocolo, hoje)
      if (diasSemParecer >= diasOrgaoSemParecer && (!proc.parecer || proc.parecer === 'pendente')) {
        const link = `/processos/${proc.id}`
        const numProt = proc.numero_protocolo || 'Protocolo'
        const orgao = proc.orgao || 'órgão regulador'

        alertas.push({
          chave: `processo_orgao_sem_parecer_${proc.id}`,
          tipo: 'processo_orgao_sem_parecer',
          severidade: diasSemParecer >= 60 ? 'atencao' : 'informativo',
          titulo: `[Prazo do órgão] Processo há ${diasSemParecer} dias sem parecer (${orgao})`,
          descricao: `Protocolado em ${dataProtocolo.toLocaleDateString('pt-BR')} sob nº ${numProt}. Lembrete de consulta e acompanhamento no ${orgao} (prazo externo do órgão, não imputável à AEROCAD).`,
          link,
          linkTexto: 'Consultar trâmite do processo',
          categoria: 'tecnico',
          dataReferencia: proc.data_protocolo,
          diasAtraso: diasSemParecer,
          registroId: proc.id,
          meta: { orgao: proc.orgao, numero_protocolo: proc.numero_protocolo },
        })
      }
    })
  }

  // 6. PROJETO SEM MOVIMENTAÇÃO / ATIVIDADE REGISTRADA HÁ 15 DIAS (Técnico)
  if (verTecnico) {
    // Mapeia última atividade por projeto
    const ultimaAtividadePorProjeto: Record<string, Date> = {}
    atividades.forEach((atv) => {
      if (!atv.projeto) return
      const dataAtv = parseDateOnly(atv.data_hora || atv.created)
      if (!dataAtv) return
      const atual = ultimaAtividadePorProjeto[atv.projeto]
      if (!atual || dataAtv > atual) {
        ultimaAtividadePorProjeto[atv.projeto] = dataAtv
      }
    })

    projetos.forEach((proj) => {
      if (proj.status !== 'ativo' || proj.arquivado) return
      const link = `/projetos/${proj.id}`
      const numProj = proj.numero || proj.nome

      const ultimaAtv = ultimaAtividadePorProjeto[proj.id]
      const dataRef =
        ultimaAtv ||
        parseDateOnly(proj.updated) ||
        parseDateOnly(proj.data_inicio) ||
        parseDateOnly(proj.created)
      if (!dataRef) return

      const diasSemMov = getDiffDays(dataRef, hoje)
      if (diasSemMov >= 15) {
        alertas.push({
          chave: `projeto_sem_mov_${proj.id}`,
          tipo: 'projeto_sem_movimentacao',
          severidade: diasSemMov >= 30 ? 'critico' : 'atencao',
          titulo: `Projeto ${numProj} sem atividade registrada há ${diasSemMov} dias`,
          descricao: `Última movimentação em ${dataRef.toLocaleDateString('pt-BR')}. Fase atual: "${proj.fase}". Verificar se há bloqueio ou registrar andamento.`,
          link,
          linkTexto: 'Ver detalhes do projeto',
          categoria: 'tecnico',
          dataReferencia: dataRef.toISOString(),
          diasAtraso: diasSemMov,
          registroId: proj.id,
        })
      }
    })
  }

  // Filtro de Alertas Dispensados (Snooze):
  // Se dispensado, só reaparece se a severidade piorar (ex: dispensou como atenção, mas agora virou crítico)
  const mapaDispensados: Record<string, AlertaDispensadoRecord> = {}
  dispensados.forEach((d) => {
    mapaDispensados[d.chave_unica] = d
  })

  const alertasFiltrados = alertas.filter((alerta) => {
    const disp = mapaDispensados[alerta.chave]
    if (!disp) return true
    // Se piorou a severidade em relação ao que foi dispensado, volta a exibir
    return isSeveridadePior(alerta.severidade, disp.severidade_dispensada)
  })

  // Ordenação: primeiro por severidade (crítico > atenção > informativo), depois por dias de atraso desc
  alertasFiltrados.sort((a, b) => {
    const pesoDiff = severidadePeso[b.severidade] - severidadePeso[a.severidade]
    if (pesoDiff !== 0) return pesoDiff
    const atrasoA = a.diasAtraso || 0
    const atrasoB = b.diasAtraso || 0
    return atrasoB - atrasoA
  })

  return alertasFiltrados
}

/**
 * Dispensar (snooze) um alerta para o usuário autenticado.
 * Persiste na coleção alertas_dispensados do PocketBase.
 */
export async function dispensarAlerta(
  alerta: AlertaItem,
  userId: string,
  motivo?: string,
): Promise<AlertaDispensadoRecord> {
  const col = pb.collection<AlertaDispensadoRecord>('alertas_dispensados')

  // Verifica se já existe registro de dispensa
  try {
    const existente = await col.getFirstListItem(
      `usuario = '${userId}' && chave_unica = '${alerta.chave}'`,
      { requestKey: null },
    )
    // Atualiza a severidade dispensada
    return await col.update(
      existente.id,
      {
        severidade_dispensada: alerta.severidade,
        data_dispensa: new Date().toISOString(),
        motivo: motivo || 'Dispensado pelo usuário',
      },
      { requestKey: null },
    )
  } catch {
    // Cria novo registro
    return await col.create(
      {
        usuario: userId,
        chave_unica: alerta.chave,
        severidade_dispensada: alerta.severidade,
        data_dispensa: new Date().toISOString(),
        motivo: motivo || 'Dispensado pelo usuário',
      },
      { requestKey: null },
    )
  }
}

/**
 * Restaurar (reabrir) um alerta previamente dispensado.
 */
export async function reabrirAlertaDispensado(
  chaveUnica: string,
  userId: string,
): Promise<boolean> {
  const col = pb.collection<AlertaDispensadoRecord>('alertas_dispensados')
  try {
    const existente = await col.getFirstListItem(
      `usuario = '${userId}' && chave_unica = '${chaveUnica}'`,
      { requestKey: null },
    )
    await col.delete(existente.id, { requestKey: null })
    return true
  } catch {
    return false
  }
}
