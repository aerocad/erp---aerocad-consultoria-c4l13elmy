/**
 * Motor de Inferência Heurística de Categoria e Plano de Contas
 * Baseado no Nome Fantasia, Razão Social, Palavras-chave e CNAE/Segmento do Estabelecimento.
 *
 * Plano de Contas Oficial AEROCAD:
 * - 3.1.5 Combustível, Pedágios e Locação de Veículos (despesas_operacionais)
 * - 3.1.4 Viagens, Hospedagem e Diárias em Campo / Alimentação (despesas_operacionais)
 * - 3.1.1 Despesas Administrativas Gerais & Escritório / Material de Consumo (despesas_operacionais)
 * - 3.1.2 Softwares, Licenças CAD/GIS, Servidores & TI (equipamentos)
 * - 3.1.3 Serviços Contábeis, Jurídicos e Auditoria (despesas_operacionais / terceirizados)
 * - 3.2.1 Honorários de Engenharia e Subcontratação Técnica (terceirizados)
 * - 3.3.1 Tributos Municipais / Taxas Aeroportuárias / GRU (impostos)
 * - 3.3.2 Tributos Federais (impostos)
 * - 3.4.1 Folha de Pagamento e Encargos Trabalhistas (folha)
 * - 3.5.1 Despesas Financeiras, Tarifas Bancárias, IOF (outros)
 * - 3.6.1 Aquisição de Ativos e Investimentos Patrimoniais (equipamentos)
 */

import type { CategoriaContaPagar } from '@/types/crm'

export interface RegraSegmentoInferido {
  segmento: string
  descricaoProdutoInferido: string
  categoria: CategoriaContaPagar
  planoContasCodigo: string
  planoContasNome: string
  palavrasChave: string[]
  prefixosCnpjCnae?: string[] // Prefixos de classes CNAE comuns se disponíveis
}

export interface ResultadoInferenciaCategoria {
  sucesso: boolean
  segmento: string
  descricaoProdutoInferido: string
  categoria: CategoriaContaPagar
  planoContasCodigo: string
  planoContasNome: string
  termoDetectado?: string
  confianca: 'alta' | 'media' | 'baixa'
  ehModoEssencial?: boolean
}

/**
 * Mapeamento exaustivo cobrindo mais de 15 segmentos da rotina operacional e corporativa:
 * 1. Postos de Combustíveis / Lubrificantes
 * 2. Alimentação / Restaurantes / Lanchonetes / Fast Food
 * 3. Supermercados / Hipermercados / Mercados / Mercearias
 * 4. Panificadoras / Padarias / Confeitarias / Cafés
 * 5. Farmácias / Drogarias / Saúde básica
 * 6. Estacionamentos / Garagens
 * 7. Pedágios / Concessionárias de Rodovias / Sem Parar
 * 8. Papelarias / Livrarias / Material de Escritório e Consumo
 * 9. Hotéis / Pousadas / Hospedagem
 * 10. Companhias Aéreas / Passagens Aéreas / Aeroportos
 * 11. Locadoras de Veículos / Frotas
 * 12. Táxi / Uber / 99 / Transporte Urbano
 * 13. Gráficas / Cópias / Plotagens Técnicas
 * 14. Ferramentas / Ferragens / Materiais de Construção / EPIs
 * 15. Equipamentos de TI / Informática / Eletrônicos
 * 16. Softwares / SaaS / Cloud / Hospedagem Web
 * 17. Cartórios / Tabelionatos / Registro de Imóveis
 * 18. Órgãos Públicos / Tarifas Regulatórias / ANAC / DECEA
 * 19. Telecomunicações / Telefonia / Internet Fibra
 * 20. Lavanderias / Conservação
 */
export const REGRAS_SEGMENTOS_ESTABELECIMENTO: RegraSegmentoInferido[] = [
  // 1. Postos de Combustível
  {
    segmento: 'Combustíveis & Lubrificantes',
    descricaoProdutoInferido: 'Combustíveis e abastecimento de veículos em campo',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.5',
    planoContasNome: 'Combustível, Pedágios e Locação de Veículos',
    palavrasChave: [
      'posto',
      'postos',
      'combustivel',
      'combustiveis',
      'gasolina',
      'etanol',
      'diesel',
      'auto posto',
      'autoposto',
      'ipiranga',
      'petrobras',
      'shell',
      'vibra',
      'raizen',
      'alecsat',
      'dislub',
      'abastecedora',
      'derivados de petroleo',
      'lubrificante',
      'lubrificantes',
    ],
  },

  // 2. Restaurantes e Bares
  {
    segmento: 'Alimentação & Restaurantes',
    descricaoProdutoInferido: 'Despesas com refeições e alimentação da equipe',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.4',
    planoContasNome: 'Viagens, Hospedagem e Diárias em Campo',
    palavrasChave: [
      'restaurante',
      'restaurantes',
      'churrascaria',
      'pizzaria',
      'lanchonete',
      'bife',
      'buffet',
      'refeicoes',
      'refeicao',
      'gastronomia',
      'bistro',
      'cantina',
      'bar e restaurante',
      'grill',
      'steakhouse',
      'mcdonald',
      'burger king',
      'subway',
      'habib',
      'fast food',
    ],
  },

  // 3. Supermercados e Mercados
  {
    segmento: 'Alimentação / Supermercados',
    descricaoProdutoInferido: 'Gêneros alimentícios e insumos de copa/campo',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.4',
    planoContasNome: 'Viagens, Hospedagem e Diárias em Campo',
    palavrasChave: [
      'supermercado',
      'supermercados',
      'hipermercado',
      'mercado',
      'mercearia',
      'atacadista',
      'atacadao',
      'assaí',
      'assai',
      'carrefour',
      'pao de acucar',
      'extra',
      'muffato',
      'savegnago',
      'hortifruti',
      'sacolao',
      'emporio',
    ],
  },

  // 4. Padarias e Confeitarias
  {
    segmento: 'Panificação & Confeitaria',
    descricaoProdutoInferido: 'Despesas com café da manhã e panificação em trânsito',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.4',
    planoContasNome: 'Viagens, Hospedagem e Diárias em Campo',
    palavrasChave: [
      'padaria',
      'panificadora',
      'panificacao',
      'confeitaria',
      'delicatessen',
      'cafeteria',
      'cafe',
      'coffee',
      'casa de paes',
    ],
  },

  // 5. Farmácias e Drogarias
  {
    segmento: 'Saúde & Farmácia',
    descricaoProdutoInferido:
      'Medicamentos básicos, primeiros socorros e itens de higiene em viagem',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'farmacia',
      'drogaria',
      'drogasil',
      'raia',
      'droga raia',
      'pacheco',
      'sao paulo',
      'pague menos',
      'panvel',
      'araujo',
      'medicamentos',
    ],
  },

  // 6. Estacionamentos
  {
    segmento: 'Estacionamento & Garagem',
    descricaoProdutoInferido: 'Estacionamento de veículos técnicos / diárias em aeroportos',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.5',
    planoContasNome: 'Combustível, Pedágios e Locação de Veículos',
    palavrasChave: [
      'estacionamento',
      'garagem',
      'park',
      'parking',
      'estapar',
      'indigo',
      'pare bem',
      'valet',
    ],
  },

  // 7. Pedágios e Rodovias
  {
    segmento: 'Pedágio & Rodovias',
    descricaoProdutoInferido: 'Tarifas de pedágio em deslocamento técnico rodoviário',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.5',
    planoContasNome: 'Combustível, Pedágios e Locação de Veículos',
    palavrasChave: [
      'pedagio',
      'concessionaria de rodovias',
      'sem parar',
      'conectcar',
      'veloe',
      'taggy',
      'ccr',
      'ecorodovias',
      'arteris',
      'autoban',
      'rodonel',
      'viapaulista',
      'triunfo',
    ],
  },

  // 8. Papelarias, Livrarias e Material de Consumo
  {
    segmento: 'Material de Consumo & Escritório',
    descricaoProdutoInferido: 'Material de consumo, papelaria técnica e suprimentos',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'papelaria',
      'kalunga',
      'livraria',
      'copiadora',
      'artigos de escritorio',
      'suprimentos',
      'impressos',
      'materiais para escritorio',
    ],
  },

  // 9. Hotéis e Hospedagem
  {
    segmento: 'Hospedagem & Hotelaria',
    descricaoProdutoInferido: 'Diárias de hospedagem e hotel em missões de campo',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.4',
    planoContasNome: 'Viagens, Hospedagem e Diárias em Campo',
    palavrasChave: [
      'hotel',
      'hoteis',
      'pousada',
      'resort',
      'hostel',
      'flat',
      'inn',
      'ibis',
      'accor',
      'mercure',
      'novotel',
      'bourbon',
      'atlantic',
      'hospedagem',
      'airbnb',
    ],
  },

  // 10. Passagens Aéreas e Aeroportos
  {
    segmento: 'Passagens & Transporte Aéreo',
    descricaoProdutoInferido:
      'Passagens aéreas, taxas aeroportuárias e despacho de bagagem técnica',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.4',
    planoContasNome: 'Viagens, Hospedagem e Diárias em Campo',
    palavrasChave: [
      'latam',
      'gol linhas',
      'voepass',
      'passaredo',
      'azul linhas',
      'azul s.a',
      'tam linhas',
      'linha aerea',
      'linhas aereas',
      'aeroporto',
      'concessionaria aeroporto',
      'infraero',
      'aena',
      'fraport',
      'ccr aeroportos',
      'zurich airport',
      'passagem aerea',
    ],
  },

  // 11. Locação de Veículos
  {
    segmento: 'Locação de Veículos',
    descricaoProdutoInferido:
      'Aluguel de veículos utilitários e 4x4 para vistoria em sítios aeroportuários',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.5',
    planoContasNome: 'Combustível, Pedágios e Locação de Veículos',
    palavrasChave: [
      'localiza',
      'movida',
      'unidas',
      'locadora de veiculos',
      'aluguel de carros',
      'rent a car',
      'foco rent',
      'avis',
      'hertz',
    ],
  },

  // 12. Táxi e Aplicativos de Transporte
  {
    segmento: 'Transporte Urbano & Aplicativos',
    descricaoProdutoInferido: 'Deslocamentos urbanos por aplicativo ou táxi',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.5',
    planoContasNome: 'Combustível, Pedágios e Locação de Veículos',
    palavrasChave: [
      'uber',
      '99 tecnologia',
      '99app',
      'radiotaxi',
      'radio taxi',
      'coopertaxi',
      'cooperativa de taxi',
      'transporte por aplicativo',
    ],
  },

  // 13. Gráficas, Plotagens e Cópias Técnicas
  {
    segmento: 'Gráfica & Plotagem Técnica',
    descricaoProdutoInferido: 'Plotagem de pranchas CAD A0/A1 e encadernações técnicas',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'grafica',
      'plotagem',
      'ploter',
      'copiadora',
      'impressao digital',
      'reprografia',
      'encadernacao',
      'plantas tecnicas',
    ],
  },

  // 14. Ferramentas, Ferragens e Materiais de Construção / EPI
  {
    segmento: 'Ferramentas, EPI & Materiais',
    descricaoProdutoInferido:
      'Equipamentos de proteção individual (EPI), trenas, estacas e materiais de campo',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'ferragens',
      'ferramentas',
      'materiais de construcao',
      'leroy merlin',
      'c&c',
      'telhanorte',
      'tupã',
      'madeireira',
      'tintas',
      'epi',
      'equipamentos de protecao',
      'marreta',
      'estacas',
    ],
  },

  // 15. Informática, TI e Hardware
  {
    segmento: 'Equipamentos de TI & Hardware',
    descricaoProdutoInferido:
      'Hardware, periféricos, monitores, cabos e peças de computador de engenharia',
    categoria: 'equipamentos',
    planoContasCodigo: '3.1.2',
    planoContasNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
    palavrasChave: [
      'kabum',
      'pichau',
      'terabyte',
      'dell',
      'lenovo',
      'computadores',
      'informatica',
      'eletronicos',
      'fast shop',
      'magazine luiza',
      'mercado livre',
      'amazon servicos',
    ],
  },

  // 16. Softwares, Cloud e Licenças CAD/BIM
  {
    segmento: 'Softwares & Licenças Técnicas',
    descricaoProdutoInferido: 'Assinaturas de software CAD/BIM, nuvem e ferramentas de cálculo',
    categoria: 'equipamentos',
    planoContasCodigo: '3.1.2',
    planoContasNome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
    palavrasChave: [
      'autodesk',
      'bentley',
      'trimble',
      'topcon',
      'microsoft',
      'google cloud',
      'aws',
      'amazon web services',
      'hostgator',
      'locaweb',
      'chatgpt',
      'openai',
      'adobe',
      'canva',
      'software',
      'tecnologia da informacao',
    ],
  },

  // 17. Cartórios e Tabelionatos
  {
    segmento: 'Cartórios & Tabelionatos',
    descricaoProdutoInferido:
      'Autenticações, reconhecimento de firma e certidões imobiliárias de aeródromos',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'cartorio',
      'tabelionato',
      'tabeliao',
      'registro de imoveis',
      'registro de titulos',
      'oficio de registro',
      'notas e protesto',
    ],
  },

  // 18. Órgãos Públicos, Tarifas e Taxas Regulatórias
  {
    segmento: 'Taxas & Órgãos Reguladores',
    descricaoProdutoInferido:
      'Taxas de fiscalização ANAC, DECEA, GRU, prefeituras e órgãos ambientais',
    categoria: 'impostos',
    planoContasCodigo: '3.3.1',
    planoContasNome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
    palavrasChave: [
      'anac',
      'decea',
      'comando da aeronautica',
      'tesouro nacional',
      'receita federal',
      'prefeitura municipal',
      'secretaria da fazenda',
      'sefaz',
      'drem',
      'crea',
      'cau/br',
      'cft',
      'guia de recolhimento',
      'gru',
      'dam',
    ],
  },

  // 19. Telecomunicações e Internet
  {
    segmento: 'Telecomunicações & Internet',
    descricaoProdutoInferido: 'Internet banda larga, telefonia móvel corporativa e links de dados',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    palavrasChave: [
      'vivo',
      'telefônica',
      'claro',
      'tim s.a',
      'oi s.a',
      'algar telecom',
      'telecomunicacoes',
      'provedor de internet',
      'fibra optica',
    ],
  },

  // 20. Terceirizados de Engenharia / Geotecnia / Topografia
  {
    segmento: 'Subcontratação Técnica de Engenharia',
    descricaoProdutoInferido:
      'Serviços terceirizados de sondagem SPT, ensaios geotécnicos e levantamentos de campo',
    categoria: 'terceirizados',
    planoContasCodigo: '3.2.1',
    planoContasNome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
    palavrasChave: [
      'engenharia consultiva',
      'geotecnia',
      'sondagens',
      'topografia',
      'levantamento topografico',
      'ensaios de solo',
      'laboratorio de solos',
      'aerolevantamento',
      'geodesia',
    ],
  },
]

/**
 * Remove acentos e converte para minúsculas para comparação padronizada
 */
export function normalizarTextoComparacao(texto?: string): string {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Infere a categoria contábil e a rubrica do Plano de Contas AEROCAD com base no
 * nome do estabelecimento, razão social, CNPJ ou descrição do item.
 */
export function inferirCategoriaPorEstabelecimento(
  nomeEstabelecimento?: string,
  cnpj?: string,
  descricaoItens?: string,
): ResultadoInferenciaCategoria {
  const nomeNorm = normalizarTextoComparacao(nomeEstabelecimento)
  const descNorm = normalizarTextoComparacao(descricaoItens)
  const textoCompleto = `${nomeNorm} ${descNorm}`.trim()

  if (!textoCompleto) {
    return {
      sucesso: false,
      segmento: 'Outros / Não identificado',
      descricaoProdutoInferido: 'Despesas diversas ou avulsas',
      categoria: 'outros',
      planoContasCodigo: '3.5.1',
      planoContasNome: 'Despesas Financeiras (Tarifas Bancárias, IOF, Juros Boletos)',
      confianca: 'baixa',
    }
  }

  // Percorre as regras na ordem de especificidade
  for (const regra of REGRAS_SEGMENTOS_ESTABELECIMENTO) {
    for (const termo of regra.palavrasChave) {
      const termoNorm = normalizarTextoComparacao(termo)
      // Verifica correspondência de palavra inteira ou substring relevante
      const regexTermo = new RegExp(`\\b${termoNorm}\\b`, 'i')
      if (regexTermo.test(textoCompleto) || textoCompleto.includes(termoNorm)) {
        return {
          sucesso: true,
          segmento: regra.segmento,
          descricaoProdutoInferido: regra.descricaoProdutoInferido,
          categoria: regra.categoria,
          planoContasCodigo: regra.planoContasCodigo,
          planoContasNome: regra.planoContasNome,
          termoDetectado: termo,
          confianca: 'alta',
        }
      }
    }
  }

  // Fallback padrão seguro: Despesas Operacionais Gerais (3.1.1)
  return {
    sucesso: false,
    segmento: 'Outros / Comum',
    descricaoProdutoInferido: 'Despesa operacional geral AEROCAD',
    categoria: 'despesas_operacionais',
    planoContasCodigo: '3.1.1',
    planoContasNome: 'Despesas Administrativas Gerais & Escritório',
    confianca: 'baixa',
  }
}
