/**
 * Modelo de Avaliação Econômica e Premissas do AEGIS
 * AEROCAD Consultoria & Aeroportos
 *
 * Produto proprietário: plataforma plugin QGIS para automação de cálculo de superfícies
 * aeronáuticas de proteção conforme ICA 11-408/2020 DECEA, plantas DXF, KMZ 3D, laudos e OPEA.
 *
 * Todas as premissas são editáveis pela administração — nunca valores fixos e imutáveis.
 */

export type NivelClassificacao = 'baixo' | 'medio' | 'alto'

export interface AegisSegmentoMercado {
  id: string
  nome: string
  descricao: string
  quantidadeTotal: number // Ex: 500 consultores, 400 prefeituras, etc.
  precoAssentoAno: number // Em R$
}

export interface AegisPremissasMercado {
  // Situação territorial e dados do setor
  totalSitiosBrasil: number // Padrão: 5.900 (4.186 aeródromos + 1.725 helipontos/helidecks)
  totalEstadosIcao: number // Padrão: 193
  fatorMultiplicadorLatam: number // Padrão: 5.0 (TAM LATAM ≈ 5x SAM Brasil)

  // Segmentos formadores do SAM Brasil
  consultores: AegisSegmentoMercado // 500 consultores * 12k = 6.000.000
  prefeituras: AegisSegmentoMercado // 400 prefeituras * 20k = 8.000.000
  construtoras: AegisSegmentoMercado // 200 construtoras * 6k = 1.200.000
  operadores: AegisSegmentoMercado // 50 operadores * 40k = 2.000.000
}

export interface AegisCenarioProjecao {
  nome: string
  percentualCapturaSam: number // Ex: 15% conservador, 30% base, 55% otimista
  horizonteAnos: number // 3 ou 5 anos
  taxaChurnAnual: number // Padrão 0.01 ou 0.02 (churn próximo a 0 por força de lei)
  multiploArr: number // 5x a 8x
  fatorDescontoRiscoEstagio: number // Desconto por estágio inicial / risco (ex: 40% no estágio inicial)
}

export interface AegisDriverValor {
  id: string
  titulo: string
  descricao: string
  impacto: 'baixo' | 'medio' | 'alto'
  categoria: 'regulatorio' | 'comercial' | 'tecnologico' | 'estrategico'
}

export interface AegisRisco {
  id: string
  titulo: string
  descricao: string
  severidade: 'baixo' | 'medio' | 'alto'
  mitigacao: string
}

export interface AegisConfiguracaoCompleta {
  premissasMercado: AegisPremissasMercado
  multiploArrPadraoMin: number // 5.0
  multiploArrPadraoMax: number // 8.0
  descontoEstagioInicial: number // Fator de desconto para valuation hoje (ex: 0.50 a 0.70)

  // Cenários para projeção de escala (ARR)
  cenarioConservador: AegisCenarioProjecao
  cenarioBase: AegisCenarioProjecao
  cenarioOtimista: AegisCenarioProjecao

  // Drivers e riscos avaliados qualitativamente
  drivers: AegisDriverValor[]
  riscos: AegisRisco[]
}

export interface AegisCenarioResultado {
  arrProjetado: number
  valuationBrutoMultiplo: number
  valuationComDescontoEstagio: number
  percentualCapturaSam: number
  multiploAplicado: number
  fatorDesconto: number
}

export interface AegisValuationResultado {
  // Dimensionamento do mercado (R$)
  samBrasilTotal: number
  tamLatamTotal: number
  segmentosDetalhados: Array<{
    id: string
    nome: string
    quantidade: number
    precoAno: number
    potencialAnual: number
    participacaoSam: number
  }>

  // Valuation Hoje (Estágio Inicial / MVP validado / primeiras licenças)
  valuationHoje: {
    minimo: number // Ordem de R$ 3 mi
    referencia: number // Ordem de R$ 6-7 mi
    maximo: number // Ordem de R$ 12 mi
    faixaFormatada: string
    descricao: string
  }

  // Valuation em Escala (3 a 5 anos / múltiplo de ARR)
  cenariosEscala: {
    conservador: AegisCenarioResultado
    base: AegisCenarioResultado
    otimista: AegisCenarioResultado
    faixaEmEscalaMin: number // Ex: ~R$ 26 mi
    faixaEmEscalaMax: number // Ex: ~R$ 66 mi
    faixaFormatada: string
  }

  // Índice de Confiança do Ativo AEGIS (0 a 100) baseado no balanço de drivers vs riscos
  indiceConfianca: {
    score: number
    nivel: 'baixo' | 'moderado' | 'alto'
    driversPositivosQtd: number
    riscosAltosQtd: number
    justificativa: string
  }
}

/**
 * Composição da Aerocad: Serviços + Ativo AEGIS
 */
export interface ComposicaoServicosAegis {
  valorServicosBase: number // Média dos 4 métodos de serviços
  valorAegisHoje: number // Valor do AEGIS no estágio atual
  valorAegisEscala: number // Valor do AEGIS no cenário base em escala

  // Visão 1: Somente Serviços
  visaoSomenteServicos: {
    conservador: number
    base: number
    otimista: number
  }

  // Visão 2: Serviços + AEGIS (Hoje / Situação Base)
  visaoServicosMaisAegisBase: {
    conservador: number
    base: number
    otimista: number
    ganhoPercentualSobreServicos: number
  }

  // Visão 3: Cenário de Escala (Serviços + AEGIS em Escala)
  visaoCenarioEscala: {
    conservador: number
    base: number
    otimista: number
    ganhoPercentualSobreServicos: number
    multiplicadorTotalSobreServicos: number
  }

  // Ponderações configuráveis na consolidação
  pesoServicos: number // Ex: 0.60
  pesoAegis: number // Ex: 0.40
}

/**
 * Premissas padrão extraídas do documento de referência do AEGIS (v1.9.384)
 */
export const AEGIS_CONFIG_PADRAO: AegisConfiguracaoCompleta = {
  premissasMercado: {
    totalSitiosBrasil: 5900,
    totalEstadosIcao: 193,
    fatorMultiplicadorLatam: 5.0,
    consultores: {
      id: 'consultores',
      nome: 'Consultores de Engenharia Aeroportuária',
      descricao: 'Engenheiros e consultorias independentes de projetos de proteção',
      quantidadeTotal: 500,
      precoAssentoAno: 12000,
    },
    prefeituras: {
      id: 'prefeituras',
      nome: 'Prefeituras Prioritárias & Órgãos de Urbanismo',
      descricao: 'Municípios com sítios aeroportuários e zonas de proteção ativas',
      quantidadeTotal: 400,
      precoAssentoAno: 20000,
    },
    construtoras: {
      id: 'construtoras',
      nome: 'Construtoras & Incorporadoras Imobiliárias',
      descricao: 'Mercado de construção civil com estudos de viabilidade OPEA',
      quantidadeTotal: 200,
      precoAssentoAno: 6000,
    },
    operadores: {
      id: 'operadores',
      nome: 'Operadores de Aeródromos e Helipontos',
      descricao: 'Concessionárias e operadores privados/públicos de infraestrutura',
      quantidadeTotal: 50,
      precoAssentoAno: 40000,
    },
  },
  multiploArrPadraoMin: 5.0,
  multiploArrPadraoMax: 8.0,
  descontoEstagioInicial: 0.6, // 60% de desconto por estágio inicial no cálculo de piso

  cenarioConservador: {
    nome: 'Conservador',
    percentualCapturaSam: 0.1, // 10% do SAM
    horizonteAnos: 3,
    taxaChurnAnual: 0.02,
    multiploArr: 5.0,
    fatorDescontoRiscoEstagio: 0.4,
  },
  cenarioBase: {
    nome: 'Base (Equilibrado)',
    percentualCapturaSam: 0.25, // 25% do SAM
    horizonteAnos: 5,
    taxaChurnAnual: 0.01,
    multiploArr: 6.5,
    fatorDescontoRiscoEstagio: 0.25,
  },
  cenarioOtimista: {
    nome: 'Otimista / Acelerado',
    percentualCapturaSam: 0.45, // 45% do SAM
    horizonteAnos: 5,
    taxaChurnAnual: 0.005,
    multiploArr: 8.0,
    fatorDescontoRiscoEstagio: 0.1,
  },

  drivers: [
    {
      id: 'driver_recorrencia_lei',
      titulo: 'Demanda Compulsória por Força de Lei',
      descricao:
        'Obrigatoriedade legal ICAO/DECEA para PBZPA e OPEA gera churn estruturalmente próximo de zero.',
      impacto: 'alto',
      categoria: 'regulatorio',
    },
    {
      id: 'driver_baixa_elasticidade',
      titulo: 'Baixa Elasticidade de Preço',
      descricao:
        'O custo de um laudo indeferido ou embargo de obra imobiliária supera em ordens de grandeza a assinatura anual.',
      impacto: 'alto',
      categoria: 'comercial',
    },
    {
      id: 'driver_barreira_regulatoria',
      titulo: 'Barreira Regulatória & ICA 11-408 Codificada',
      descricao:
        'Mais de 44 mil linhas codificando superfícies, tabelas oficiais e lógica tridimensional do DECEA.',
      impacto: 'alto',
      categoria: 'regulatorio',
    },
    {
      id: 'driver_opcionalidade_esri_evtol',
      titulo: 'Opcionalidade (Parceria Esri & Vetor eVTOL/AAM)',
      descricao:
        'Potencial de distribuição global e novos sítios de mobilidade aérea avançada sem alterar o motor central.',
      impacto: 'medio',
      categoria: 'estrategico',
    },
    {
      id: 'driver_arquitetura_saas',
      titulo: 'Arquitetura com Motor Desacoplado (Pronta p/ SaaS)',
      descricao:
        'Motor em Python puro independente do QGIS permite migração ágil para nuvem e proteção de propriedade intelectual.',
      impacto: 'alto',
      categoria: 'tecnologico',
    },
    {
      id: 'driver_canal_aerocad',
      titulo: 'Aerocad como Canal de Vendas e Laboratório',
      descricao:
        'A própria operação de consultoria valida o software em projetos reais e funciona como vitrine setorial.',
      impacto: 'alto',
      categoria: 'comercial',
    },
    {
      id: 'driver_ativos_acumulados',
      titulo: 'Ativos Acumulados & Integrações Nativas',
      descricao:
        'Conexão nativa com base ANAC (~4.283 aeródromos), AISWEB, Portal AGA e SRTM/Copernicus.',
      impacto: 'medio',
      categoria: 'tecnologico',
    },
  ],

  riscos: [
    {
      id: 'risco_nicho_absoluto',
      titulo: 'Nicho Pequeno em Número Absoluto',
      descricao:
        'Total de consultores e operadores aeroportuários é limitado em contagem absoluta de clientes.',
      severidade: 'medio',
      mitigacao:
        'Expansão via módulo OPEA para construção civil, incorporadoras e prefeituras, multiplicando o mercado.',
    },
    {
      id: 'risco_estagio_inicial',
      titulo: 'Estágio Inicial (Receita a Comprovar)',
      descricao:
        'Produto funcional e em uso real, mas com tração comercial de SaaS ainda no início da curva.',
      severidade: 'alto',
      mitigacao:
        'Monetização inicial via serviço produtizado na Aerocad e pilotos pagos com consultorias parceiras.',
    },
    {
      id: 'risco_pessoa_chave',
      titulo: 'Dependência de Pessoa-Chave Técnica',
      descricao:
        'Concentração inicial do conhecimento de desenvolvimento aeronáutico e arquitetura algorítmica.',
      severidade: 'alto',
      mitigacao:
        'Documentação extensiva, suíte pytest automatizada e expansão planejada do time de engenharia de software.',
    },
    {
      id: 'risco_mudanca_normativa',
      titulo: 'Mudanças Normativas DECEA / ANAC',
      descricao:
        'Alteração futura nas tabelas ou portarias da ICA 11-408 pode exigir refatoração de superfícies.',
      severidade: 'baixo',
      mitigacao:
        'Arquitetura modular orientada a tabelas normativas desacopladas, facilitando parametrizações.',
    },
    {
      id: 'risco_internacionalizacao',
      titulo: 'Custo de Internacionalização (LATAM)',
      descricao:
        'Adaptação a normas locais de outros países da América Latina fora do escopo brasileiro inicial.',
      severidade: 'medio',
      mitigacao:
        'Aderência central já existente ao Anexo 14 da ICAO (193 Estados), reduzindo customizações regionais.',
    },
  ],
}

/**
 * Calcula o Valuation e Métricas Econômicas do AEGIS
 */
export function calcularAegisValuation(config: AegisConfiguracaoCompleta): AegisValuationResultado {
  const { premissasMercado, cenarioConservador, cenarioBase, cenarioOtimista } = config

  // 1. Cálculo do SAM Brasil por Segmento
  const potConsultores =
    premissasMercado.consultores.quantidadeTotal * premissasMercado.consultores.precoAssentoAno
  const potPrefeituras =
    premissasMercado.prefeituras.quantidadeTotal * premissasMercado.prefeituras.precoAssentoAno
  const potConstrutoras =
    premissasMercado.construtoras.quantidadeTotal * premissasMercado.construtoras.precoAssentoAno
  const potOperadores =
    premissasMercado.operadores.quantidadeTotal * premissasMercado.operadores.precoAssentoAno

  const samBrasilTotal = potConsultores + potPrefeituras + potConstrutoras + potOperadores
  const tamLatamTotal = samBrasilTotal * (premissasMercado.fatorMultiplicadorLatam || 5.0)

  const segmentosDetalhados = [
    {
      id: premissasMercado.consultores.id,
      nome: premissasMercado.consultores.nome,
      quantidade: premissasMercado.consultores.quantidadeTotal,
      precoAno: premissasMercado.consultores.precoAssentoAno,
      potencialAnual: potConsultores,
      participacaoSam: samBrasilTotal > 0 ? (potConsultores / samBrasilTotal) * 100 : 0,
    },
    {
      id: premissasMercado.prefeituras.id,
      nome: premissasMercado.prefeituras.nome,
      quantidade: premissasMercado.prefeituras.quantidadeTotal,
      precoAno: premissasMercado.prefeituras.precoAssentoAno,
      potencialAnual: potPrefeituras,
      participacaoSam: samBrasilTotal > 0 ? (potPrefeituras / samBrasilTotal) * 100 : 0,
    },
    {
      id: premissasMercado.construtoras.id,
      nome: premissasMercado.construtoras.nome,
      quantidade: premissasMercado.construtoras.quantidadeTotal,
      precoAno: premissasMercado.construtoras.precoAssentoAno,
      potencialAnual: potConstrutoras,
      participacaoSam: samBrasilTotal > 0 ? (potConstrutoras / samBrasilTotal) * 100 : 0,
    },
    {
      id: premissasMercado.operadores.id,
      nome: premissasMercado.operadores.nome,
      quantidade: premissasMercado.operadores.quantidadeTotal,
      precoAno: premissasMercado.operadores.precoAssentoAno,
      potencialAnual: potOperadores,
      participacaoSam: samBrasilTotal > 0 ? (potOperadores / samBrasilTotal) * 100 : 0,
    },
  ]

  // 2. Cálculo dos Cenários em Escala (ARR e Múltiplos)
  const calcularCenario = (cenario: AegisCenarioProjecao): AegisCenarioResultado => {
    // ARR estimado = SAM * % captura * (1 - churn)
    const arr = samBrasilTotal * cenario.percentualCapturaSam * (1 - (cenario.taxaChurnAnual || 0))
    const valuationBruto = arr * cenario.multiploArr
    const valuationComDesconto = valuationBruto * (1 - (cenario.fatorDescontoRiscoEstagio || 0))

    return {
      arrProjetado: arr,
      valuationBrutoMultiplo: valuationBruto,
      valuationComDescontoEstagio: valuationComDesconto,
      percentualCapturaSam: cenario.percentualCapturaSam,
      multiploAplicado: cenario.multiploArr,
      fatorDesconto: cenario.fatorDescontoRiscoEstagio,
    }
  }

  const resConservador = calcularCenario(cenarioConservador)
  const resBase = calcularCenario(cenarioBase)
  const resOtimista = calcularCenario(cenarioOtimista)

  // Faixa em escala calculada a partir dos cenários
  const faixaEmEscalaMin = Math.round(resConservador.valuationComDescontoEstagio)
  const faixaEmEscalaMax = Math.round(resOtimista.valuationBrutoMultiplo)

  // 3. Valuation Hoje (Estágio Inicial / MVP Concluído / Ativo Estratégico)
  // Ancorado entre 3 milhões (piso conservador de reposição/potencial) e 12 milhões (teto pré-escala com PI e primeiros pilotos)
  // Ajustável pelas premissas de desconto de estágio
  const arrInicialEstimado = samBrasilTotal * 0.05 // 5% do SAM no curto prazo
  const valuationHojeMin = Math.max(
    3000000,
    Math.round(
      arrInicialEstimado * config.multiploArrPadraoMin * (1 - config.descontoEstagioInicial),
    ),
  )
  const valuationHojeRef = Math.max(
    6000000,
    Math.round(arrInicialEstimado * 6.5 * (1 - config.descontoEstagioInicial * 0.6)),
  )
  const valuationHojeMax = Math.max(
    12000000,
    Math.round(arrInicialEstimado * config.multiploArrPadraoMax * 1.5),
  )

  // 4. Índice de Confiança do Ativo
  let scorePontos = 50
  let driversPositivos = 0
  let riscosAltos = 0

  for (const d of config.drivers) {
    if (d.impacto === 'alto') {
      scorePontos += 7
      driversPositivos++
    } else if (d.impacto === 'medio') {
      scorePontos += 4
    }
  }

  for (const r of config.riscos) {
    if (r.severidade === 'alto') {
      scorePontos -= 8
      riscosAltos++
    } else if (r.severidade === 'medio') {
      scorePontos -= 4
    }
  }

  const scoreFinal = Math.min(95, Math.max(30, Math.round(scorePontos)))
  const nivelConfianca: 'baixo' | 'moderado' | 'alto' =
    scoreFinal >= 75 ? 'alto' : scoreFinal >= 55 ? 'moderado' : 'baixo'

  return {
    samBrasilTotal,
    tamLatamTotal,
    segmentosDetalhados,
    valuationHoje: {
      minimo: valuationHojeMin,
      referencia: valuationHojeRef,
      maximo: valuationHojeMax,
      faixaFormatada: `R$ ${(valuationHojeMin / 1000000).toFixed(1)} mi a R$ ${(valuationHojeMax / 1000000).toFixed(1)} mi`,
      descricao:
        'Valor de potencial inicial: produto funcional (v1.9.384), conformidade ICA 11-408 validada, fosso regulatório e liderança de nicho.',
    },
    cenariosEscala: {
      conservador: resConservador,
      base: resBase,
      otimista: resOtimista,
      faixaEmEscalaMin,
      faixaEmEscalaMax,
      faixaFormatada: `R$ ${(faixaEmEscalaMin / 1000000).toFixed(1)} mi a R$ ${(faixaEmEscalaMax / 1000000).toFixed(1)} mi`,
    },
    indiceConfianca: {
      score: scoreFinal,
      nivel: nivelConfianca,
      driversPositivosQtd: driversPositivos,
      riscosAltosQtd: riscosAltos,
      justificativa: `${driversPositivos} drivers de alto impacto compensam riscos de estágio inicial mediante mitigação técnica.`,
    },
  }
}

/**
 * Calcula a Composição da Aerocad: Operação de Serviços + Ativo AEGIS
 */
export function calcularComposicaoAerocadAegis(params: {
  valorServicosConservador: number
  valorServicosBase: number
  valorServicosOtimista: number
  aegisResultado: AegisValuationResultado
  pesoServicos?: number
  pesoAegis?: number
}): ComposicaoServicosAegis {
  const {
    valorServicosConservador,
    valorServicosBase,
    valorServicosOtimista,
    aegisResultado,
    pesoServicos = 0.6,
    pesoAegis = 0.4,
  } = params

  const valorAegisHoje = aegisResultado.valuationHoje.referencia
  const valorAegisEscala = aegisResultado.cenariosEscala.base.valuationBrutoMultiplo

  // Visão 1: Somente Serviços
  const visaoSomenteServicos = {
    conservador: valorServicosConservador,
    base: valorServicosBase,
    otimista: valorServicosOtimista,
  }

  // Visão 2: Serviços + AEGIS (Hoje)
  // Soma a operação existente com o ativo de software no estágio inicial
  const baseMaisHoje = valorServicosBase + valorAegisHoje
  const consMaisHoje = valorServicosConservador + aegisResultado.valuationHoje.minimo
  const otimMaisHoje = valorServicosOtimista + aegisResultado.valuationHoje.maximo

  const ganhoBasePercentual =
    valorServicosBase > 0 ? ((baseMaisHoje - valorServicosBase) / valorServicosBase) * 100 : 0

  // Visão 3: Cenário de Escala (Serviços + AEGIS em escala 3 a 5 anos)
  const baseMaisEscala = valorServicosBase + valorAegisEscala
  const consMaisEscala =
    valorServicosConservador + aegisResultado.cenariosEscala.conservador.valuationComDescontoEstagio
  const otimMaisEscala =
    valorServicosOtimista + aegisResultado.cenariosEscala.otimista.valuationBrutoMultiplo

  const ganhoEscalaPercentual =
    valorServicosBase > 0 ? ((baseMaisEscala - valorServicosBase) / valorServicosBase) * 100 : 0
  const multiplicadorEscala = valorServicosBase > 0 ? baseMaisEscala / valorServicosBase : 1

  return {
    valorServicosBase,
    valorAegisHoje,
    valorAegisEscala,
    visaoSomenteServicos,
    visaoServicosMaisAegisBase: {
      conservador: Math.round(consMaisHoje),
      base: Math.round(baseMaisHoje),
      otimista: Math.round(otimMaisHoje),
      ganhoPercentualSobreServicos: ganhoBasePercentual,
    },
    visaoCenarioEscala: {
      conservador: Math.round(consMaisEscala),
      base: Math.round(baseMaisEscala),
      otimista: Math.round(otimMaisEscala),
      ganhoPercentualSobreServicos: ganhoEscalaPercentual,
      multiplicadorTotalSobreServicos: multiplicadorEscala,
    },
    pesoServicos,
    pesoAegis,
  }
}
