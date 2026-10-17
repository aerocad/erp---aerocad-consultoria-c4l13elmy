/**
 * Base de Conhecimento Oficial AEROCAD® 2026
 * Consolidada a partir do pacote completo:
 * - AEROCAD_Pacote_Completo / README, FUNCIONALIDADES, INSTALAÇÃO, CATALOGO_TEMPLATES
 * - SKILL: aerocad-projetos, aerocad-pdir, aerocad-rg-cni
 * - 12 Scripts Python com aerocad_base.py
 */

export interface ServicoSkillAerocad {
  codigo: string
  servico: string
  prazo: string
  faixaPreco: string
  norma: string
  descricao: string
}

export const SERVICOS_SKILL_AEROCAD: ServicoSkillAerocad[] = [
  {
    codigo: 'OPEA',
    servico: 'Objeto Projetado no Espaço Aéreo',
    prazo: '20 dias',
    faixaPreco: 'R$ 5.000 – R$ 8.500',
    norma: 'ICA 11-408',
    descricao:
      'Pré-análise e protocolo COMAER/CINDACTA para edificações, torres, antenas e instalações solares.',
  },
  {
    codigo: 'HEL-SOLO',
    servico: 'Heliponto no Solo — Completo',
    prazo: '180 dias',
    faixaPreco: 'R$ 55.000 – R$ 75.000',
    norma: 'RBAC 155',
    descricao:
      'Estudo preliminar, anteprojeto, projeto executivo e processo de registro COMAER/ANAC.',
  },
  {
    codigo: 'HEL-ELEV',
    servico: 'Heliponto Elevado (Rooftop)',
    prazo: '180 dias',
    faixaPreco: 'R$ 25.000 – R$ 35.000',
    norma: 'RBAC 155',
    descricao:
      'Sinalização horizontal, equipamentos operacionais, manual de operações e registro COMAER/ANAC.',
  },
  {
    codigo: 'EVA',
    servico: 'Estudo de Viabilidade Aeronáutica',
    prazo: '30 dias',
    faixaPreco: 'R$ 10.000 – R$ 18.000',
    norma: 'RBAC 153',
    descricao:
      'Levantamento de sítio, restrições ao espaço aéreo, PBZPA/PZPANA, altura máxima e parecer conclusivo.',
  },
  {
    codigo: 'REG-AD',
    servico: 'Registro de Aeródromo Privado (Regularização)',
    prazo: '180 dias',
    faixaPreco: 'R$ 15.000 – R$ 45.000',
    norma: 'RBAC 153 · RBAC 157',
    descricao:
      'Documentação técnica, levantamento, PBZPA, processo de abertura ao tráfego aéreo e homologação.',
  },
  {
    codigo: 'PBZPA',
    servico: 'PBZPA + PZPANA Regional',
    prazo: '90 dias',
    faixaPreco: 'R$ 35.000 – R$ 55.000',
    norma: 'RBAC 161',
    descricao:
      'Pistas de 1.500 m a 2.800 m, cálculo de superfícies limitadoras, cadastro de obstáculos e protocolo.',
  },
  {
    codigo: 'PBZPA-I',
    servico: 'PBZPA + PZPANA Internacional',
    prazo: '90 dias',
    faixaPreco: 'R$ 80.000 – R$ 120.000',
    norma: 'RBAC 161',
    descricao:
      'Pistas > 2.800 m, superfícies de aproximação IFR de precisão, auxílios rádio ILS/VOR/RADAR.',
  },
  {
    codigo: 'PDIR',
    servico: 'Plano Diretor Regional',
    prazo: '60 dias',
    faixaPreco: 'R$ 45.000 – R$ 65.000',
    norma: 'RBAC 153',
    descricao:
      'Aeroportos até 5 Mpax/ano, relatório consolidado, pranchas de implantação e zoneamento.',
  },
  {
    codigo: 'PDIR-I',
    servico: 'Plano Diretor Internacional',
    prazo: '90 dias',
    faixaPreco: 'R$ 52.000 – R$ 95.000',
    norma: 'RBAC 153',
    descricao:
      'Aeroportos > 5 Mpax/ano, horizontes de 5, 10 e 20 anos, pranchas A0 e compatibilização PGI.',
  },
  {
    codigo: 'PDIR-PACK',
    servico: 'Pacote Integrado PDIR + PBZPA + PZPANA',
    prazo: '90 – 120 dias',
    faixaPreco: 'R$ 70.000 – R$ 220.000',
    norma: 'RBAC 153 + 161',
    descricao:
      'Pacote técnico completo integrado para operadores aeroportuários (ex.: SBSG R$ 83,2k, SBFL R$ 188,2k).',
  },
  {
    codigo: 'EST-AERO',
    servico: 'Estudo Aeronáutico',
    prazo: '30 – 45 dias',
    faixaPreco: 'R$ 6.000 – R$ 25.000',
    norma: 'DECEA / SITAR',
    descricao:
      'Avaliação de impacto operacional para helipontos, aeródromos ou operação de aeronaves de grande porte.',
  },
  {
    codigo: 'SDIA',
    servico: 'Cancelamento de Obstáculos / Atualização SDIA',
    prazo: '10 dias',
    faixaPreco: 'R$ 4.000 – R$ 22.500',
    norma: 'SDIA / DECEA',
    descricao:
      'Supressão de obstáculos cadastrados no SDIA, laudos técnicos, ART e requerimentos DECEA.',
  },
  {
    codigo: 'DOC-TEC',
    servico: 'Documento Técnico / Ofício de Anuência',
    prazo: '10 dias',
    faixaPreco: 'R$ 10.000 – R$ 15.000',
    norma: 'ANAC / Prefeitura',
    descricao:
      'Ofício técnico fundamentado perante prefeituras ou órgãos reguladores para anuência de edificações.',
  },
  {
    codigo: 'MOPS',
    servico: 'Manual de Operações Aeroportuárias',
    prazo: '45 dias',
    faixaPreco: 'R$ 12.000 – R$ 20.000',
    norma: 'RBAC 153',
    descricao: 'Procedimentos operacionais do aeródromo, mapas de emergência e submissão à ANAC.',
  },
  {
    codigo: 'PAC-CT',
    servico: 'Plano de Ação de Contingência',
    prazo: '60 dias',
    faixaPreco: 'R$ 15.000 – R$ 25.000',
    norma: 'ICA 63-17',
    descricao:
      'Identificação de riscos operacionais, procedimentos de contingência e fluxogramas de emergência.',
  },
  {
    codigo: 'HOMO',
    servico: 'Homologação de Aeródromo',
    prazo: '180 dias',
    faixaPreco: 'R$ 60.000 – R$ 120.000',
    norma: 'RBAC 153',
    descricao:
      'Projeto global de grande porte, atendimento a requisitos de segurança e certificação operacional.',
  },
]

export const TEXTO_APRESENTACAO_AEROCAD =
  'A AEROCAD® CONSULTORIA & AEROPORTOS foi fundada em 2017 com a missão de prestar serviços de engenharia consultiva e assessoria regulatória especializada para o setor de infraestrutura aeroportuária nacional. Com sede em Brasília/DF e atuação em todo o território brasileiro, assessoramos operadores públicos, privados e concessionários em todas as fases do ciclo regulatório e de engenharia junto à ANAC, ao COMAER e ao DECEA.'

export const TIPOS_SERVICO_ORDEM_SERVICO_PADRAO: string[] = [
  'Serviços Técnicos de Apoio na Elaboração de Planos e Estudos Relacionados a Segurança e Controle do Espaço Aéreo (Ex.: PBZPA/PZPANA/PDIR/Estudo Aeronáutico)',
  'Visita Técnica',
  'Serviços Técnicos de Apoio no Acompanhamento de Processos no âmbito do DECEA e da ANAC, no que couber',
  'Serviços Técnicos de Apoio na Elaboração de Projetos de Engenharia, Memoriais e Documentos correlatos',
  'Emissão de Anotação de Responsabilidade Técnica (ART) ou Relatório de Responsabilidade Técnica (RRT), conforme o caso',
]

export const CLAUSULAS_OBRIGATORIAS_ORDEM_SERVICO = [
  'O prestador será pago mediante a apresentação da nota fiscal emitida em favor do tomador (AEROCAD TERRAPLANAGEM E CONSTRUÇÃO LTDA).',
  'Os serviços serão ou são prestados de maneira eventual, mediante demanda, e a execução deles por tempo determinado não caracteriza, sob nenhuma hipótese, vínculo empregatício com a AEROCAD.',
]

export const CLAUSULAS_PADRAO_AEROCAD = [
  {
    titulo: 'Confidencialidade',
    texto:
      'Sigilo absoluto sobre informações técnicas, operacionais e comerciais durante a vigência e pelo período mínimo de 5 (cinco) anos subsequentes ao término do contrato.',
  },
  {
    titulo: 'Propriedade Intelectual',
    texto:
      'Todos os produtos, relatórios, pranchas, memoriais e modelos desenvolvidos pela CONTRATADA constituem sua propriedade intelectual, restrita a utilização pelo CONTRATANTE exclusivamente para o objeto contratado.',
  },
  {
    titulo: 'Responsabilidade Técnica',
    texto:
      'A CONTRATADA responde pela precisão técnica e rigor normativo dos estudos, caracterizando-se a prestação de serviços como obrigação de meio em processos dependentes de deferimento discricionário dos órgãos reguladores.',
  },
  {
    titulo: 'Alterações de Escopo',
    texto:
      'Eventuais alterações de escopo, acréscimos quantitativos ou revisões decorrentes de modificações no programa de necessidades da CONTRATANTE serão formalizadas por termo aditivo prévio.',
  },
  {
    titulo: 'Rescisão e Multa',
    texto:
      'O descumprimento imotivado ensejará rescisão com aplicação de multa compensatória de 50% sobre as parcelas vincendas, corrigida pelo IGP-M/FGV e juros moratórios de 1% ao mês.',
  },
  {
    titulo: 'Foro de Eleição',
    texto:
      'Fica eleito o foro da circunscrição judiciária de Brasília, Distrito Federal, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
  },
  {
    titulo: 'Vigência e Aceite',
    texto:
      'O contrato entra em vigor a partir da manifestação inequívoca de concordância das partes (assinatura digital, aceite expresso ou confirmação formal por e-mail).',
  },
]

export const REGRAS_PDIR_AEROCAD = {
  nomenclaturaRelatorio: '[ICAO]-PDIR-YYYY-RELATÓRIO-REV00X-DDMMYY.docx',
  nomenclaturaPlantaAtual: '[ICAO]-PDIR-YYYY-PLANTA-CARAC-ATUAL-REV00X-DDMMYY.dxf',
  nomenclaturaPlantaFutura: '[ICAO]-PDIR-YYYY-PLANTA-FUT-HOR-YYYY-REV00X-DDMMYY.dxf',
  regrasFontes: [
    'Fotos in loco: "Fonte: Visita in loco"',
    'Tabelas e dados numéricos: "Fonte: [Operador]" ou "Fonte: PGI"',
    'Remover citações a EVTEA ou referências ao modelo de forma SBSG do texto do novo relatório',
    'Dados atuais devem ser conferidos com o PGI mais recente; ausência de dados implica supressão em vez de invenção',
    'Não conformidades: citar apenas as confirmadas pelo PGI/ACI atual (remover itens já sanados de PDIRs antigos)',
    'Pendências técnicas devem ser destacadas em vermelho (RGB #FF0000) para validação do cliente',
    'Norma ABNT NBR 14724: Arial, corpo 12, espaçamento 1,5, margens 3/3/2/2 cm, cantSplit em tabelas e títulos sem quebra órfã',
  ],
}
