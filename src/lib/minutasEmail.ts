import { INSTITUTIONAL_DATA } from './documentCatalogo'
import { formatCurrencyRaw, formatDateBrasilia } from './format'
import { montarSaudacao } from './saudacao'
import type {
  ClienteRecord,
  ExigenciaRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
} from '@/types/crm'

export type ModeloMinutaTipo =
  | 'proposta'
  | 'cobranca_medicao'
  | 'cobranca_nfse'
  | 'followup_processo'

export interface MinutaEmailContexto {
  tipo: ModeloMinutaTipo
  cliente?: ClienteRecord | null
  contatoNome?: string | null
  contatoEmail?: string | null
  projeto?: ProjetoRecord | null
  proposta?: PropostaRecord | null
  parcela?: ParcelaRecord | null
  processo?: ProcessoRecord | null
  exigencias?: ExigenciaRecord[] | null
  linkDriveArquivo?: string | null
}

export interface MinutaEmailGerada {
  tipo: ModeloMinutaTipo
  tituloModelo: string
  destinatario: string
  assunto: string
  corpo: string
}

/**
 * Assinatura institucional padrão da AEROCAD para rodapés de e-mail.
 */
export function gerarAssinaturaPadraoAerocad(): string {
  return [
    '---',
    'Atenciosamente,',
    '',
    INSTITUTIONAL_DATA.nomeComercial,
    INSTITUTIONAL_DATA.razaoSocial,
    `CNPJ: ${INSTITUTIONAL_DATA.cnpj}`,
    INSTITUTIONAL_DATA.endereco,
    `Telefone: ${INSTITUTIONAL_DATA.telefone}`,
    `E-mail: ${INSTITUTIONAL_DATA.email} · Website: ${INSTITUTIONAL_DATA.website}`,
  ].join('\n')
}

/**
 * Modelo 1: PROPOSTA ENVIADA
 * Assunto: AEROCAD — Proposta Comercial PC nº N/AAAA — [Cliente/Serviço]
 */
export function gerarMinutaProposta(ctx: MinutaEmailContexto): MinutaEmailGerada {
  const { cliente, contatoNome, contatoEmail, proposta, projeto, linkDriveArquivo } = ctx

  const clienteNome = cliente?.razao_social || projeto?.expand?.cliente?.razao_social || '[Cliente]'
  const destinatario = contatoEmail || cliente?.email || ''
  const nomeCumprimento = contatoNome || cliente?.razao_social || ''
  const saudacao = montarSaudacao(nomeCumprimento, { incluirEquipeFallback: true })

  const numeroProposta = proposta?.numero || projeto?.numero_pc_pt || 'PC [preencher nº/ano]'
  const revisao = proposta?.revisao ? ` (${proposta.revisao})` : ''
  const servicoDesc =
    projeto?.tipo_servico ||
    projeto?.nome ||
    proposta?.expand?.oportunidade?.tipo_servico ||
    proposta?.expand?.oportunidade?.titulo ||
    '[Serviço/Objeto]'

  const assunto = `AEROCAD — Proposta Comercial ${numeroProposta}${revisao} — ${clienteNome} / ${servicoDesc}`

  const dataProposta = proposta?.data_envio
    ? formatDateBrasilia(proposta.data_envio)
    : formatDateBrasilia(new Date())

  const valorFormatado = proposta?.valor_total
    ? formatCurrencyRaw(proposta.valor_total)
    : projeto?.valor_global
      ? formatCurrencyRaw(projeto.valor_global)
      : '[R$ preencher valor]'

  const validade = proposta?.validade_dias
    ? `${proposta.validade_dias} (trinta) dias`
    : '30 (trinta) dias'

  const condicoes = proposta?.condicoes_pagamento
    ? proposta.condicoes_pagamento
    : 'Conforme marcos de entrega técnica e aprovação regulatória detalhados no instrumento.'

  const linkDrive = linkDriveArquivo || proposta?.link_drive || projeto?.pasta_drive_url || ''

  const blocoArquivo = linkDrive
    ? `A proposta técnica-comercial completa com o cronograma e o detalhamento das etapas está disponível para consulta e download no seguinte link seguro:\n👉 ${linkDrive}`
    : 'A proposta técnica-comercial completa com o cronograma e o detalhamento das etapas segue em anexo a esta mensagem [anexar arquivo PDF].'

  const corpo = [
    `${saudacao},`,
    '',
    `Temos a satisfação de apresentar a Proposta Comercial ${numeroProposta}${revisao} da AEROCAD CONSULTORIA & AEROPORTOS, referente aos serviços especializados de engenharia aeroportuária para ${clienteNome}.`,
    '',
    'RESUMO DA PROPOSTA:',
    `• Proposta: ${numeroProposta}${revisao}`,
    `• Data de emissão: ${dataProposta}`,
    `• Objeto / Escopo: ${servicoDesc}`,
    `• Valor global: ${valorFormatado}`,
    `• Condições comerciais: ${condicoes}`,
    `• Validade da proposta: ${validade}`,
    '',
    blocoArquivo,
    '',
    'Permanecemos à inteira disposição para dirimir eventuais dúvidas técnicas, realizar reuniões de alinhamento ou ajustar quaisquer premissas necessárias para o início dos trabalhos.',
    '',
    gerarAssinaturaPadraoAerocad(),
  ].join('\n')

  return {
    tipo: 'proposta',
    tituloModelo: 'Proposta Comercial Enviada',
    destinatario,
    assunto,
    corpo,
  }
}

/**
 * Modelo 2: COBRANÇA DE MEDIÇÃO
 * Assunto: AEROCAD — Medição [nº] — Projeto [número/nome]
 */
export function gerarMinutaCobrancaMedicao(ctx: MinutaEmailContexto): MinutaEmailGerada {
  const { cliente, contatoNome, contatoEmail, projeto, parcela } = ctx

  const clienteNome =
    cliente?.razao_social ||
    projeto?.expand?.cliente?.razao_social ||
    parcela?.expand?.cliente?.razao_social ||
    '[Cliente]'
  const destinatario = contatoEmail || cliente?.email || ''
  const nomeCumprimento = contatoNome || cliente?.razao_social || ''
  const saudacao = montarSaudacao(nomeCumprimento, { incluirEquipeFallback: true })

  const numeroProjeto = projeto?.numero || parcela?.expand?.projeto?.numero || '[AAAA-NNN]'
  const nomeProjeto = projeto?.nome || parcela?.expand?.projeto?.nome || '[Nome do Projeto]'

  const numeroMedicao =
    parcela?.numero_parcela_marco ||
    (parcela?.descricao?.match(/medi[çc][ãa]o\s*(\d+)/i)?.[1]
      ? `nº ${parcela.descricao.match(/medi[çc][ãa]o\s*(\d+)/i)?.[1]}`
      : parcela?.descricao || 'nº [preencher]')

  const assunto = `AEROCAD — Medição ${numeroMedicao} — Projeto ${numeroProjeto} — ${clienteNome}`

  const valorFormatado = parcela?.valor ? formatCurrencyRaw(parcela.valor) : '[R$ preencher valor]'

  const vencimento = parcela?.vencimento
    ? formatDateBrasilia(parcela.vencimento)
    : '[preencher data]'

  const competenciaOuPeriodo = parcela?.data_faturamento
    ? formatDateBrasilia(parcela.data_faturamento)
    : parcela?.created
      ? formatDateBrasilia(parcela.created)
      : formatDateBrasilia(new Date())

  const eventoMarco =
    parcela?.evento_comprobatorio ||
    parcela?.descricao ||
    'Cumprimento do marco técnico contratual / protocolo perante órgão regulador.'

  const corpo = [
    `${saudacao},`,
    '',
    `Vimos por meio deste apresentar a medição de serviços técnicos referente ao Projeto ${numeroProjeto} (${nomeProjeto}), executado pela AEROCAD em favor de ${clienteNome}.`,
    '',
    'DADOS DA MEDIÇÃO REALIZADA:',
    `• Projeto: ${numeroProjeto} · ${nomeProjeto}`,
    `• Medição / Parcela: ${numeroMedicao}`,
    `• Marco / Evento comprobatório: ${eventoMarco}`,
    `• Competência / Data de referência: ${competenciaOuPeriodo}`,
    `• Valor líquido: ${valorFormatado}`,
    `• Vencimento previsto: ${vencimento}`,
    '',
    'Solicitamos a gentileza da análise, aprovação e liberação desta medição para fins de faturamento e liquidação financeira.',
    '',
    'DADOS BANCÁRIOS INSTITUCIONAIS DA AEROCAD PARA DEPÓSITO / PIX:',
    `• Banco: ${INSTITUTIONAL_DATA.banco}`,
    `• Agência: ${INSTITUTIONAL_DATA.agencia}`,
    `• Conta Corrente: ${INSTITUTIONAL_DATA.contaCorrente}`,
    `• Favorecida: ${INSTITUTIONAL_DATA.favorecida}`,
    `• CNPJ: ${INSTITUTIONAL_DATA.cnpj}`,
    `• CHAVE PIX (CNPJ): ${INSTITUTIONAL_DATA.chavePix}`,
    '',
    'Caso necessitem do envio de relatório comprobatório ou evidências adicionais das entregas, favor nos informar.',
    '',
    gerarAssinaturaPadraoAerocad(),
  ].join('\n')

  return {
    tipo: 'cobranca_medicao',
    tituloModelo: 'Cobrança de Medição de Serviços',
    destinatario,
    assunto,
    corpo,
  }
}

/**
 * Modelo 3: COBRANÇA DE NFS-E
 * Assunto: AEROCAD — Solicitação de emissão de NFS-e — Medição [nº]
 */
export function gerarMinutaCobrancaNfse(ctx: MinutaEmailContexto): MinutaEmailGerada {
  const { cliente, contatoNome, contatoEmail, projeto, parcela } = ctx

  const clienteNome =
    cliente?.razao_social ||
    projeto?.expand?.cliente?.razao_social ||
    parcela?.expand?.cliente?.razao_social ||
    '[Cliente]'
  const destinatario = contatoEmail || cliente?.email || ''
  const nomeCumprimento = contatoNome || cliente?.razao_social || ''
  const saudacao = montarSaudacao(nomeCumprimento, { incluirEquipeFallback: true })

  const numeroProjeto = projeto?.numero || parcela?.expand?.projeto?.numero || '[AAAA-NNN]'
  const nomeProjeto = projeto?.nome || parcela?.expand?.projeto?.nome || '[Nome do Projeto]'

  const numeroMedicao =
    parcela?.numero_parcela_marco ||
    (parcela?.descricao?.match(/medi[çc][ãa]o\s*(\d+)/i)?.[1]
      ? `nº ${parcela.descricao.match(/medi[çc][ãa]o\s*(\d+)/i)?.[1]}`
      : parcela?.descricao || 'nº [preencher]')

  const nfReferencia = parcela?.nf_numero ? ` (NFS-e nº ${parcela.nf_numero})` : ''

  const assunto = `AEROCAD — Solicitação de emissão de NFS-e — Medição ${numeroMedicao} — Projeto ${numeroProjeto}`

  const valorFormatado = parcela?.valor ? formatCurrencyRaw(parcela.valor) : '[R$ preencher valor]'

  const dataAprovacao = parcela?.data_faturamento
    ? formatDateBrasilia(parcela.data_faturamento)
    : formatDateBrasilia(new Date())

  const prazoEnvio = 'até 5 (cinco) dias úteis'

  const corpo = [
    `${saudacao},`,
    '',
    `Confirmamos a aprovação e aceite da medição de serviços ${numeroMedicao} referente ao Projeto ${numeroProjeto} (${nomeProjeto}), formalizada em ${dataAprovacao}.`,
    '',
    `Para prosseguirmos com os trâmites fiscais e financeiros, solicitamos a emissão da respectiva Nota Fiscal de Serviços eletrônica (NFS-e) no valor de ${valorFormatado}, no prazo de ${prazoEnvio}.`,
    '',
    'DADOS CADASTRAIS DO TOMADOR / PRESTADOR PARA EMISSÃO DA NOTA:',
    `• Razão Social: ${INSTITUTIONAL_DATA.razaoSocial}`,
    `• Nome Fantasia: ${INSTITUTIONAL_DATA.nomeComercial}`,
    `• CNPJ: ${INSTITUTIONAL_DATA.cnpj}`,
    `• Inscrição Estadual: ${INSTITUTIONAL_DATA.inscricaoEstadual}`,
    `• Endereço: ${INSTITUTIONAL_DATA.endereco}`,
    `• Cidade/UF: ${INSTITUTIONAL_DATA.cidadeUf} · CEP: ${INSTITUTIONAL_DATA.cep}`,
    `• E-mail fiscal: ${INSTITUTIONAL_DATA.email}`,
    `• Telefone: ${INSTITUTIONAL_DATA.telefone}`,
    '',
    'DADOS PARA LIQUIDAÇÃO / DEPÓSITO:',
    `• Banco: ${INSTITUTIONAL_DATA.banco}`,
    `• Agência: ${INSTITUTIONAL_DATA.agencia} · Conta Corrente: ${INSTITUTIONAL_DATA.contaCorrente}`,
    `• Favorecida: ${INSTITUTIONAL_DATA.favorecida}`,
    `• CHAVE PIX (CNPJ): ${INSTITUTIONAL_DATA.chavePix}`,
    '',
    'Pedimos a gentileza de encaminhar o arquivo XML e o DANFSE/PDF da nota fiscal emitida em resposta a este e-mail assim que disponível.',
    '',
    gerarAssinaturaPadraoAerocad(),
  ].join('\n')

  return {
    tipo: 'cobranca_nfse',
    tituloModelo: 'Solicitação de Emissão de NFS-e',
    destinatario,
    assunto,
    corpo,
  }
}

/**
 * Modelo 4: FOLLOW-UP DE PROCESSO NO ÓRGÃO
 * Assunto: AEROCAD — Acompanhamento do processo [nº do processo] — [órgão DECEA/ANAC]
 */
export function gerarMinutaFollowupProcesso(ctx: MinutaEmailContexto): MinutaEmailGerada {
  const { cliente, contatoNome, contatoEmail, projeto, processo, exigencias } = ctx

  const orgao = processo?.orgao || 'DECEA/ANAC'
  const protocolo = processo?.numero_protocolo || '[nº protocolo]'
  const numeroProjeto = projeto?.numero || processo?.expand?.projeto?.numero || '[AAAA-NNN]'
  const nomeProjeto = projeto?.nome || processo?.expand?.projeto?.nome || '[Nome do Projeto]'
  const clienteNome =
    cliente?.razao_social ||
    projeto?.expand?.cliente?.razao_social ||
    processo?.expand?.projeto?.expand?.cliente?.razao_social ||
    '[Cliente/Interessado]'

  const destinatario =
    processo?.link_emails ||
    contatoEmail ||
    cliente?.email ||
    (orgao.includes('DECEA')
      ? 'atendimento.sysaga@decea.mil.br'
      : orgao.includes('ANAC')
        ? 'protocolo@anac.gov.br'
        : '')

  const assunto = `AEROCAD — Acompanhamento do processo ${protocolo} — ${orgao}`

  const dataProtocolo = processo?.data_protocolo
    ? formatDateBrasilia(processo.data_protocolo)
    : '[Data do protocolo]'

  const prazoOrgao = processo?.prazo_orgao ? formatDateBrasilia(processo.prazo_orgao) : null

  const statusLabel =
    processo?.status === 'em_exigencia'
      ? 'Em Exigência Técnica'
      : processo?.status === 'em_analise'
        ? 'Em Análise Técnica'
        : processo?.status === 'protocolado'
          ? 'Protocolado / Aguardando Distribuição'
          : processo?.status === 'deferido'
            ? 'Deferido'
            : processo?.status === 'indeferido'
              ? 'Indeferido'
              : 'Em Andamento'

  // Exigências pendentes
  const exigenciasPendentes = (exigencias || []).filter((e) => e.status === 'pendente')
  let blocoExigencias = ''
  if (exigenciasPendentes.length > 0) {
    blocoExigencias = [
      '',
      `EXIGÊNCIAS TÉCNICAS EM ABERTO (${exigenciasPendentes.length}):`,
      ...exigenciasPendentes.map(
        (e, idx) =>
          `${idx + 1}. ${e.descricao}${e.prazo ? ` (Prazo: ${formatDateBrasilia(e.prazo)})` : ''}`,
      ),
    ].join('\n')
  }

  const corpo = [
    `Prezados Senhores da Seção Técnica / Protocolo do ${orgao},`,
    '',
    `A AEROCAD CONSULTORIA & AEROPORTOS, na qualidade de responsável técnica e procuradora designada para o Projeto ${numeroProjeto} (${nomeProjeto}) de titularidade de ${clienteNome}, vem por meio deste solicitar respeitosamente o posicionamento e andamento conclusivo acerca do processo regulatório em epígrafe.`,
    '',
    'DADOS DO PROCESSO REGULATÓRIO:',
    `• Órgão / Jurisdição: ${orgao}`,
    `• Número do Protocolo / Processo: ${protocolo}`,
    `• Data do Protocolo: ${dataProtocolo}`,
    `• Status atual registrado: ${statusLabel}`,
    prazoOrgao ? `• Prazo regulatório de resposta: ${prazoOrgao}` : null,
    `• Empreendimento / Interessado: ${clienteNome}`,
    `• Projeto AEROCAD: ${numeroProjeto} — ${nomeProjeto}`,
    blocoExigencias,
    '',
    'Ressaltamos a extrema relevância e tempestividade desta tramitação para o cumprimento rigoroso do cronograma de implantação/operação do aeródromo/heliponto, bem como para a preservação das garantias contratuais de nosso constituinte.',
    '',
    'Caso haja necessidade de complementação documental, esclarecimentos técnicos adicionais ou emissão de guias de custas/taxas, estamos plenamente à disposição para pronto atendimento imediato.',
    '',
    'Agradecemos antecipadamente pela atenção e presteza habitual.',
    '',
    gerarAssinaturaPadraoAerocad(),
  ]
    .filter((line) => line !== null)
    .join('\n')

  return {
    tipo: 'followup_processo',
    tituloModelo: 'Follow-up de Processo no Órgão',
    destinatario,
    assunto,
    corpo,
  }
}

/**
 * Gerador mestre que despacha para o modelo correspondente
 */
export function gerarMinutaEmail(ctx: MinutaEmailContexto): MinutaEmailGerada {
  switch (ctx.tipo) {
    case 'proposta':
      return gerarMinutaProposta(ctx)
    case 'cobranca_medicao':
      return gerarMinutaCobrancaMedicao(ctx)
    case 'cobranca_nfse':
      return gerarMinutaCobrancaNfse(ctx)
    case 'followup_processo':
      return gerarMinutaFollowupProcesso(ctx)
    default:
      return gerarMinutaProposta(ctx)
  }
}

/**
 * Cria URL mailto: segura com destinatário, assunto e corpo
 */
export function buildMailtoUrl(destinatario: string, assunto: string, corpo: string): string {
  const params: string[] = []
  if (assunto) params.push(`subject=${encodeURIComponent(assunto)}`)
  if (corpo) params.push(`body=${encodeURIComponent(corpo)}`)
  const query = params.length > 0 ? `?${params.join('&')}` : ''
  const dest = destinatario ? encodeURIComponent(destinatario) : ''
  return `mailto:${dest}${query}`
}
