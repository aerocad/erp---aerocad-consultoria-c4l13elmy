/**
 * Plano de Contas Simplificado para Empresas de Engenharia & Arquitetura Consultiva
 * Adaptado especificamente às operações da AEROCAD Consultoria Aeroportuária.
 */

export type TipoNaturezaConta = 'ativo' | 'passivo' | 'patrimonio_liquido' | 'receita' | 'despesa'

export interface ItemPlanoContas {
  codigo: string
  nome: string
  natureza: TipoNaturezaConta
  grupo: string
  fixoOuVariavel?: 'fixo' | 'variavel'
  descricao?: string
}

export const PLANO_CONTAS_AEROCAD: ItemPlanoContas[] = [
  // 1. ATIVO
  {
    codigo: '1.1.1',
    nome: 'Disponibilidades (Bancos Conta Movimento PJ)',
    natureza: 'ativo',
    grupo: 'Ativo Circulante',
  },
  {
    codigo: '1.1.2',
    nome: 'Contas a Receber de Clientes (Projetos em Andamento)',
    natureza: 'ativo',
    grupo: 'Ativo Circulante',
  },
  {
    codigo: '1.1.3',
    nome: 'Adiantamentos a Fornecedores e Equipe',
    natureza: 'ativo',
    grupo: 'Ativo Circulante',
  },
  {
    codigo: '1.2.1',
    nome: 'Equipamentos Topográficos e Geodésicos',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },
  {
    codigo: '1.2.2',
    nome: 'Drones e Aeronaves Remotamente Pilotadas',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },
  {
    codigo: '1.2.3',
    nome: 'Hardware e Computadores de Alta Performance',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },
  {
    codigo: '1.2.4',
    nome: 'Softwares de Engenharia e Licenças CAD/BIM',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
  },
  {
    codigo: '1.2.5',
    nome: 'Veículos e Frotas Operacionais de Campo',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },
  {
    codigo: '1.2.6',
    nome: 'Bens Imóveis e Instalações',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },
  {
    codigo: '1.2.7',
    nome: 'Mobiliário e Equipamentos de Escritório',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
  },

  // 2. PASSIVO
  {
    codigo: '2.1.1',
    nome: 'Fornecedores e Subcontratados a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
  },
  {
    codigo: '2.1.2',
    nome: 'Honorários Técnicos Terceirizados a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
  },
  {
    codigo: '2.1.3',
    nome: 'Tributos e Encargos a Recolher (ISS, IRRF, PIS/COFINS, Simples/Presumido)',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
  },
  {
    codigo: '2.1.4',
    nome: 'Folha, Pró-Labore e Encargos Sociais',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
  },
  {
    codigo: '2.1.5',
    nome: 'Contas de Consumo e Tarifas a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
  },

  // 3. DESPESAS E CUSTOS (DRE / PONTO DE EQUILÍBRIO)
  {
    codigo: '3.1.1',
    nome: 'Despesas Administrativas Gerais & Escritório',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.1.2',
    nome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.1.3',
    nome: 'Serviços Contábeis, Jurídicos e Auditoria',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.1.4',
    nome: 'Viagens, Hospedagem e Diárias em Campo',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '3.1.5',
    nome: 'Combustível, Pedágios e Locação de Veículos',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '3.2.1',
    nome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '3.3.1',
    nome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
    natureza: 'despesa',
    grupo: 'Deduções e Impostos',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '3.3.2',
    nome: 'Tributos Federais (IRPJ, CSLL, PIS, COFINS ou DAS Simples)',
    natureza: 'despesa',
    grupo: 'Deduções e Impostos',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '3.4.1',
    nome: 'Folha de Pagamento e Encargos Trabalhistas',
    natureza: 'despesa',
    grupo: 'Pessoal & Encargos',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.4.2',
    nome: 'Pró-Labore de Sócios e Diretores',
    natureza: 'despesa',
    grupo: 'Pessoal & Encargos',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.5.1',
    nome: 'Despesas Financeiras (Tarifas Bancárias, IOF, Juros Boletos)',
    natureza: 'despesa',
    grupo: 'Despesas Financeiras',
    fixoOuVariavel: 'fixo',
  },
  {
    codigo: '3.6.1',
    nome: 'Aquisição de Ativos e Investimentos Patrimoniais',
    natureza: 'despesa',
    grupo: 'Investimentos',
    fixoOuVariavel: 'fixo',
  },

  // 4. RECEITAS (DRE)
  {
    codigo: '4.1.1',
    nome: 'Receita de Projetos OPEA e Planos Diretores',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '4.1.2',
    nome: 'Receita de Registro e Homologação de Aeródromos / Helipontos',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '4.1.3',
    nome: 'Consultorias Técnicas e Pareceres Avulsos',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
  },
  {
    codigo: '4.2.1',
    nome: 'Rendimentos de Aplicações Financeiras PJ',
    natureza: 'receita',
    grupo: 'Receitas Financeiras',
    fixoOuVariavel: 'fixo',
  },
]

export function obterItemPlanoContasPorCodigo(codigo?: string): ItemPlanoContas | undefined {
  if (!codigo) return undefined
  return PLANO_CONTAS_AEROCAD.find((item) => item.codigo === codigo)
}

export function sugerirPlanoContasPorCategoria(categoria: string): ItemPlanoContas {
  switch (categoria) {
    case 'impostos':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.3.2')!
    case 'folha':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.4.1')!
    case 'terceirizados':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.2.1')!
    case 'equipamentos':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.2')!
    case 'outros':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.5.1')!
    case 'despesas_operacionais':
    default:
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.1')!
  }
}
