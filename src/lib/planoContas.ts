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
    descricao: 'Saldos em contas correntes e aplicações de liquidez imediata PJ',
  },
  {
    codigo: '1.1.2',
    nome: 'Contas a Receber de Clientes (Projetos em Andamento)',
    natureza: 'ativo',
    grupo: 'Ativo Circulante',
    descricao: 'Faturamento emitido e medições pendentes de liquidação',
  },
  {
    codigo: '1.1.3',
    nome: 'Adiantamentos a Fornecedores e Equipe',
    natureza: 'ativo',
    grupo: 'Ativo Circulante',
    descricao: 'Adiantamentos operacionais para diárias de campo e compras',
  },
  {
    codigo: '1.2.1',
    nome: 'Equipamentos Topográficos e Geodésicos',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'Estações totais, receptores GNSS/RTK, níveis e miras',
  },
  {
    codigo: '1.2.2',
    nome: 'Drones e Aeronaves Remotamente Pilotadas',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'VANTs, drones de aerolevantamento e baterias homologadas',
  },
  {
    codigo: '1.2.3',
    nome: 'Hardware e Computadores de Alta Performance',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'Workstations de engenharia, servidores locais e monitores técnicos',
  },
  {
    codigo: '1.2.4',
    nome: 'Veículos e Frotas Operacionais de Campo',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'Veículos utilitários e caminhonetes de vistoria aeroportuária',
  },
  {
    codigo: '1.2.5',
    nome: 'Bens Imóveis e Instalações',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'Sede corporativa, salas comerciais e benfeitorias',
  },
  {
    codigo: '1.2.6',
    nome: 'Mobiliário e Equipamentos de Escritório',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Imobilizado',
    descricao: 'Mesas, cadeiras ergonômicas, ar-condicionado e copa',
  },
  // Subgrupo: Ativo Não Circulante / Ativo Intangível (CPC 04 / NBC TG 04)
  {
    codigo: '1.2.7',
    nome: 'Marcas e Patentes (Taxas de Registro e Concessão INPI)',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
    descricao:
      'Capitalização de taxas federais do INPI para registro, depósito, concessão e prorrogação de marcas e patentes da AEROCAD',
  },
  {
    codigo: '1.2.8',
    nome: 'Software e Programas Proprietários (Desenvolvimento AEGIS)',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
    descricao:
      'Custos capitalizados de desenvolvimento e evolução do software proprietário AEGIS e ferramentas internas AEROCAD',
  },
  {
    codigo: '1.2.9',
    nome: 'Softwares Técnicos, Licenças Perpétuas CAD/BIM e Sistemas',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
    descricao:
      'Licenças de uso perpétuas, softwares CAD/GIS/BIM e sistemas operacionais permanentes ativados',
  },
  {
    codigo: '1.2.10',
    nome: 'Direitos Autorais e Propriedade Intelectual',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
    descricao:
      'Direitos patrimoniais sobre metodologias técnicas, acervo intelectual e publicações consultivas protegidas',
  },
  {
    codigo: '1.2.11',
    nome: 'Fundo de Comércio / Goodwill e Outros Intangíveis',
    natureza: 'ativo',
    grupo: 'Ativo Não Circulante / Intangível',
    descricao:
      'Ágio por expectativa de rentabilidade futura, carteira de clientes adquirida e outros ativos intangíveis',
  },

  // 2. PASSIVO
  {
    codigo: '2.1.1',
    nome: 'Fornecedores e Subcontratados a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Obrigações com prestadores, empréstimos operacionais e parcelamentos',
  },
  {
    codigo: '2.1.2',
    nome: 'Honorários Técnicos Terceirizados a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Subcontratações especializadas e consultores associados',
  },
  {
    codigo: '2.1.3',
    nome: 'Tributos e Encargos a Recolher (ISS, IRRF, PIS/COFINS, Simples/Presumido)',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Retenções e guias fiscais municipais e federais a recolher',
  },
  {
    codigo: '2.1.4',
    nome: 'Folha, Pró-Labore e Encargos Sociais',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Salários, pró-labore societário, FGTS e INSS',
  },
  {
    codigo: '2.1.5',
    nome: 'Contas de Consumo e Tarifas a Pagar',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Energia (CEB/Neoenergia), água, telecomunicações e condomínios',
  },
  {
    codigo: '2.1.6',
    nome: 'Empréstimos Bancários a Pagar (Passivo Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao: 'Parcelas e amortizações de empréstimos bancários com vencimento em até 12 meses',
  },
  {
    codigo: '2.1.7',
    nome: 'Financiamentos de Veículos e Frotas a Pagar (Passivo Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao:
      'Parcelas de financiamento de veículos e equipamentos com vencimento em até 12 meses',
  },
  {
    codigo: '2.1.8',
    nome: '(-) Encargos Financeiros a Apropriar (Conta Redutora do Passivo Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Circulante',
    descricao:
      'Juros contratuais pré-fixados a incorrer no curto prazo (conta retificadora/redutora)',
  },
  {
    codigo: '2.2.1',
    nome: 'Empréstimos Bancários a Pagar (Passivo Não Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Não Circulante',
    descricao: 'Dívidas bancárias de longo prazo com vencimento após 12 meses',
  },
  {
    codigo: '2.2.2',
    nome: 'Financiamentos de Veículos a Pagar (Passivo Não Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Não Circulante',
    descricao: 'Financiamentos de bens e frotas de longo prazo com vencimento após 12 meses',
  },
  {
    codigo: '2.2.3',
    nome: '(-) Encargos Financeiros a Apropriar (Conta Redutora do Passivo Não Circulante)',
    natureza: 'passivo',
    grupo: 'Passivo Não Circulante',
    descricao: 'Juros pré-fixados a incorrer no longo prazo após os próximos 12 meses',
  },

  // 3. DESPESAS E CUSTOS (DRE / PONTO DE EQUILÍBRIO)
  {
    codigo: '3.1.1',
    nome: 'Despesas Administrativas Gerais & Escritório',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
    descricao: 'Aluguel comercial, condomínio, materiais de escritório e cartórios',
  },
  {
    codigo: '3.1.2',
    nome: 'Softwares, Licenças CAD/GIS, Servidores & TI',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
    descricao: 'Assinaturas de software técnico, nuvem, hospedagem e internet corporativa',
  },
  {
    codigo: '3.1.3',
    nome: 'Serviços Contábeis, Jurídicos e Auditoria',
    natureza: 'despesa',
    grupo: 'Despesas Operacionais Fixas',
    fixoOuVariavel: 'fixo',
    descricao: 'Honorários contábeis mensais, assessorias e certidões',
  },
  {
    codigo: '3.1.4',
    nome: 'Viagens, Hospedagem e Diárias em Campo',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
    descricao: 'Alimentação em viagem, hotéis, passagens e diárias da equipe técnica',
  },
  {
    codigo: '3.1.5',
    nome: 'Combustível, Pedágios e Locação de Veículos',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
    descricao: 'Postos de combustível (Cascol, Petrobras, Shell), pedágios e locações',
  },
  {
    codigo: '3.2.1',
    nome: 'Honorários de Engenharia e Subcontratação Técnica (Topografia/Sondagem)',
    natureza: 'despesa',
    grupo: 'Custos Diretos dos Projetos',
    fixoOuVariavel: 'variavel',
    descricao: 'Levantamentos topográficos de terceiros, sondagens SPT e laudos laboratoriais',
  },
  {
    codigo: '3.3.1',
    nome: 'Tributos Municipais (ISS / Taxas Aeroportuárias)',
    natureza: 'despesa',
    grupo: 'Deduções e Impostos',
    fixoOuVariavel: 'variavel',
    descricao: 'ISSQN incidente sobre notas fiscais de serviços e taxas locais',
  },
  {
    codigo: '3.3.2',
    nome: 'Tributos Federais (IRPJ, CSLL, PIS, COFINS ou DAS Simples)',
    natureza: 'despesa',
    grupo: 'Deduções e Impostos',
    fixoOuVariavel: 'variavel',
    descricao: 'Guias DARF federais e tributos sobre faturamento bruto',
  },
  {
    codigo: '3.4.1',
    nome: 'Folha de Pagamento e Encargos Trabalhistas',
    natureza: 'despesa',
    grupo: 'Pessoal & Encargos',
    fixoOuVariavel: 'fixo',
    descricao: 'Salários de analistas, desenhistas e encargos sociais CLT',
  },
  {
    codigo: '3.4.2',
    nome: 'Pró-Labore de Sócios e Diretores',
    natureza: 'despesa',
    grupo: 'Pessoal & Encargos',
    fixoOuVariavel: 'fixo',
    descricao: 'Remuneração societária e antecipação de lucros formalizada',
  },
  {
    codigo: '3.5.1',
    nome: 'Despesas Financeiras (Tarifas Bancárias, IOF, Juros Boletos)',
    natureza: 'despesa',
    grupo: 'Despesas Financeiras',
    fixoOuVariavel: 'fixo',
    descricao: 'Tarifas de manutenção, TAR PIX, boletos, IOF e juros de mora',
  },
  {
    codigo: '3.5.2',
    nome: 'Despesas com Juros de Empréstimos e Financiamentos (Resultado / DRE)',
    natureza: 'despesa',
    grupo: 'Despesas Financeiras',
    fixoOuVariavel: 'fixo',
    descricao: 'Juros contratuais apropriados mensalmente pelo regime de competência contábil',
  },
  {
    codigo: '3.6.1',
    nome: 'Aquisição de Ativos e Investimentos Patrimoniais',
    natureza: 'despesa',
    grupo: 'Investimentos',
    fixoOuVariavel: 'fixo',
    descricao: 'Investimentos em infraestrutura, modernização e reformas',
  },

  // 4. RECEITAS (DRE)
  {
    codigo: '4.1.1',
    nome: 'Receita de Projetos OPEA e Planos Diretores',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
    descricao: 'Contratos principais de Plano Diretor Aeroportuário e OPEA',
  },
  {
    codigo: '4.1.2',
    nome: 'Receita de Registro e Homologação de Aeródromos / Helipontos',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
    descricao: 'Processos ANAC/DECEA de helipontos, pistas privadas e aeródromos',
  },
  {
    codigo: '4.1.3',
    nome: 'Consultorias Técnicas e Pareceres Avulsos',
    natureza: 'receita',
    grupo: 'Receita Operacional Bruta',
    fixoOuVariavel: 'variavel',
    descricao: 'Estudos de viabilidade aeronáutica, consultorias e laudos avulsos',
  },
  {
    codigo: '4.2.1',
    nome: 'Rendimentos de Aplicações Financeiras PJ',
    natureza: 'receita',
    grupo: 'Receitas Financeiras',
    fixoOuVariavel: 'fixo',
    descricao: 'Resgates e rendimentos de CDB, fundos e juros sobre capital',
  },
]

// Cache local em memória de contas extras registradas dinamicamente
let contasExtrasEmMemoria: ItemPlanoContas[] = []

export function registrarContasExtrasPlano(contas: ItemPlanoContas[]) {
  contasExtrasEmMemoria = contas
}

export function removerContaExtraPlano(codigoOuId: string): void {
  contasExtrasEmMemoria = contasExtrasEmMemoria.filter(
    (c) => c.codigo !== codigoOuId && (c as any).id !== codigoOuId,
  )
}

export function obterItemPlanoContasPorCodigo(codigo?: string): ItemPlanoContas | undefined {
  if (!codigo) return undefined
  const limpo = codigo.trim()
  const todas = [...PLANO_CONTAS_AEROCAD, ...contasExtrasEmMemoria]
  return (
    todas.find((item) => item.codigo === limpo) ||
    todas.find((item) => item.codigo.startsWith(limpo)) ||
    todas.find((item) => limpo.startsWith(item.codigo))
  )
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

/**
 * Representação padronizada de um lançamento mapeado no Plano de Contas
 */
export interface LancamentoMapeado {
  id: string
  origem: 'extrato' | 'conta_pagar' | 'parcela' | 'conta_receber' | 'ativo' | 'conta_bancaria'
  origemLabel: string
  codigoConta: string
  nomeConta: string
  natureza: TipoNaturezaConta
  descricao: string
  entidade?: string
  data: string
  valor: number
  tipoMovimento: 'debito' | 'credito'
  status?: string
  documentoRef?: string
  observacoes?: string
  registroIdOriginal?: string
  classificacaoManual?: boolean
}

function normalizarTextoComparacao(texto?: string): string {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Classifica uma movimentação de extrato bancário (.RET, OFX, CSV, PDF) em uma conta do Plano AEROCAD
 */
export function classificarTransacaoExtrato(tx: {
  plano_contas_codigo?: string
  descricao?: string
  observacoes?: string
  tipo?: 'entrada' | 'saida' | string
  valor?: number
  documento_ref?: string
}): ItemPlanoContas {
  // Se já possui conta contábil explícita (definida ou reclassificada manualmente), prioriza-a
  if (tx.plano_contas_codigo) {
    const achado = obterItemPlanoContasPorCodigo(tx.plano_contas_codigo)
    if (achado) return achado
  }
  const descNorm = normalizarTextoComparacao(tx.descricao)
  const obsNorm = normalizarTextoComparacao(tx.observacoes)
  const texto = `${descNorm} ${obsNorm}`.trim()
  const isEntrada = tx.tipo === 'entrada'

  // Regras de Entradas (Receitas e Rendimentos)
  if (isEntrada) {
    if (
      texto.includes('cdb') ||
      texto.includes('resgate') ||
      texto.includes('rendimento') ||
      texto.includes('aplicacao') ||
      texto.includes('banco inter s a')
    ) {
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.2.1')!
    }
    if (
      texto.includes('heliponto') ||
      texto.includes('aerodromo') ||
      texto.includes('homologacao') ||
      texto.includes('registro') ||
      texto.includes('cni') ||
      texto.includes('paulo victor')
    ) {
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.2')!
    }
    if (texto.includes('opea') || texto.includes('plano diretor')) {
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.1')!
    }
    // Padrão para recebimentos gerais / consultorias
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.3')!
  }

  // Regras de Saídas (Despesas, Custos e Passivo)

  // 1. Pró-labore e sócios
  if (
    texto.includes('cleyton borges saraiva') ||
    texto.includes('antecipacao de lucros') ||
    texto.includes('pro-labore') ||
    texto.includes('pro labore') ||
    texto.includes('retirada socio') ||
    texto.includes('distribuicao de lucros')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.4.2')!
  }

  // 2. Combustível e veículos
  if (
    texto.includes('combustivel') ||
    texto.includes('gasolina') ||
    texto.includes('etanol') ||
    texto.includes('diesel') ||
    texto.includes('cascol') ||
    texto.includes('ranoni') ||
    texto.includes('cruzeiro combustiveis') ||
    texto.includes('posto') ||
    texto.includes('lubrificante') ||
    texto.includes('pedagio') ||
    texto.includes('sem parar')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.5')!
  }

  // 3. Tarifas bancárias
  if (
    texto.includes('tar pix') ||
    texto.includes('tar man cc') ||
    texto.includes('tarifa') ||
    texto.includes('despesas bancarias') ||
    texto.includes('iof') ||
    texto.includes('juros') ||
    texto.includes('anuidade') ||
    texto.includes('ted/doc') ||
    texto.includes('manutencao conta')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.5.1')!
  }

  // 4. Tributos e Impostos
  if (
    texto.includes('receita federal') ||
    texto.includes('imposto a pagar') ||
    texto.includes('darf') ||
    texto.includes('das simples') ||
    texto.includes('simples nacional') ||
    texto.includes('tributo') ||
    texto.includes('irrf') ||
    texto.includes('pis') ||
    texto.includes('cofins')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.3.2')!
  }
  if (
    texto.includes('iss') ||
    texto.includes('prefeitura') ||
    texto.includes('taxa aeroportuaria') ||
    texto.includes('decea') ||
    texto.includes('anac')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.3.1')!
  }

  // 5. Empréstimos e Financiamentos (Passivo)
  if (
    texto.includes('pag fin veiculo') ||
    texto.includes('fin veiculo') ||
    texto.includes('bv financeira') ||
    texto.includes('pan financiamentos') ||
    texto.includes('santander fin')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '2.1.7')!
  }

  if (
    texto.includes('pronampe') ||
    texto.includes('prest emp') ||
    texto.includes('emprestimo') ||
    texto.includes('financiamento') ||
    texto.includes('amort emp')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '2.1.6')!
  }

  // 5.1 Taxas e Ativos Intangíveis (INPI / Marcas / Patentes / AEGIS)
  if (
    texto.includes('inpi') ||
    texto.includes('marca') ||
    texto.includes('marcas') ||
    texto.includes('patente') ||
    texto.includes('patentes') ||
    texto.includes('taxa inpi') ||
    texto.includes('registro de marca') ||
    texto.includes('deposito de marca') ||
    texto.includes('concessao de marca') ||
    texto.includes('taxa de patente')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.7')!
  }

  if (
    texto.includes('aegis') ||
    texto.includes('desenvolvimento aegis') ||
    texto.includes('software proprio') ||
    texto.includes('desenvolvimento de software')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.8')!
  }

  if (
    texto.includes('direito autoral') ||
    texto.includes('direitos autorais') ||
    texto.includes('propriedade intelectual')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.10')!
  }

  // 6. Contas de consumo (energia, condomínio, telecom)
  if (
    texto.includes('ceb brasilia') ||
    texto.includes('neoenergia') ||
    texto.includes('energia') ||
    texto.includes('luz') ||
    texto.includes('caesb') ||
    texto.includes('agua')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '2.1.5')!
  }

  // 7. Telecomunicações e Software/TI
  if (
    texto.includes('radnet') ||
    texto.includes('telecom') ||
    texto.includes('internet') ||
    texto.includes('software') ||
    texto.includes('licenca') ||
    texto.includes('autodesk') ||
    texto.includes('cad') ||
    texto.includes('chatgpt') ||
    texto.includes('aws') ||
    texto.includes('google')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.2')!
  }

  // 8. Serviços Contábeis e Jurídicos
  if (
    texto.includes('conseg') ||
    texto.includes('contabilidade') ||
    texto.includes('contador') ||
    texto.includes('juridico') ||
    texto.includes('advoc') ||
    texto.includes('auditoria')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.3')!
  }

  // 9. Aluguel de Escritório e Salas
  if (
    texto.includes('broffices') ||
    texto.includes('aluguel') ||
    texto.includes('alugueis') ||
    texto.includes('ok office tower') ||
    texto.includes('condominio')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.1')!
  }

  // 10. Folha de Pagamento e Terceiros
  if (
    texto.includes('ian santos silva') ||
    texto.includes('folha') ||
    texto.includes('salario') ||
    texto.includes('colaborador') ||
    texto.includes('remuneracao')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.4.1')!
  }

  if (
    texto.includes('topografia') ||
    texto.includes('sondagem') ||
    texto.includes('laudo tecnico') ||
    texto.includes('geotecnia') ||
    texto.includes('subcontrat')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.2.1')!
  }

  // 11. Refeição e Hospedagem
  if (
    texto.includes('restaurante') ||
    texto.includes('refeicao') ||
    texto.includes('hotel') ||
    texto.includes('hospedagem') ||
    texto.includes('diaria')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.4')!
  }

  // Fallback padrão: Despesas Administrativas Gerais
  return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.1')!
}

/**
 * Classifica uma conta a pagar no Plano de Contas
 */
export function classificarContaPagar(cp: {
  plano_contas_codigo?: string
  categoria?: string
  fornecedor?: string
  descricao?: string
  observacoes?: string
}): ItemPlanoContas {
  if (cp.plano_contas_codigo) {
    const achado = obterItemPlanoContasPorCodigo(cp.plano_contas_codigo)
    if (achado) return achado
  }

  const texto = `${cp.descricao || ''} ${cp.fornecedor || ''} ${cp.observacoes || ''}`
  const achadoTx = classificarTransacaoExtrato({
    descricao: texto,
    observacoes: cp.observacoes,
    tipo: 'saida',
  })

  if (achadoTx && achadoTx.codigo !== '3.1.1') {
    return achadoTx
  }

  if (cp.categoria) {
    return sugerirPlanoContasPorCategoria(cp.categoria)
  }

  return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '3.1.1')!
}

/**
 * Classifica uma receita avulsa no Plano de Contas
 */
export function classificarContaReceber(cr: {
  plano_contas_codigo?: string
  categoria?: string
  descricao?: string
  cliente_nome?: string
}): ItemPlanoContas {
  if (cr.plano_contas_codigo) {
    const achado = obterItemPlanoContasPorCodigo(cr.plano_contas_codigo)
    if (achado) return achado
  }

  if (cr.categoria === 'rendimento_aplicacao') {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.2.1')!
  }
  if (cr.categoria === 'servico_tecnico') {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.1')!
  }

  const texto = normalizarTextoComparacao(`${cr.descricao || ''} ${cr.cliente_nome || ''}`)
  if (texto.includes('heliponto') || texto.includes('aerodromo') || texto.includes('cni')) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.2')!
  }

  return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.3')!
}

/**
 * Classifica uma parcela de projeto no Plano de Contas
 */
export function classificarParcela(p: {
  plano_contas_codigo?: string
  descricao?: string
  expand?: {
    projeto?: { nome?: string; numero?: string; trilha?: string }
  }
}): ItemPlanoContas {
  // Se já possui conta contábil explícita (definida ou reclassificada manualmente), prioriza-a
  if (p.plano_contas_codigo) {
    const achado = obterItemPlanoContasPorCodigo(p.plano_contas_codigo)
    if (achado) return achado
  }
  const texto = normalizarTextoComparacao(
    `${p.descricao || ''} ${p.expand?.projeto?.nome || ''} ${p.expand?.projeto?.trilha || ''}`,
  )
  if (
    texto.includes('heliponto') ||
    texto.includes('aerodromo') ||
    texto.includes('registro') ||
    texto.includes('homologacao')
  ) {
    return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.2')!
  }
  return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '4.1.1')!
}

/**
 * Classifica um ativo patrimonial no Plano de Contas
 */
export function classificarAtivoPatrimonio(at: { categoria?: string }): ItemPlanoContas {
  switch (at.categoria) {
    case 'equipamento_topografico':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.1')!
    case 'drone_aeronave':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.2')!
    case 'computador_hardware':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.3')!
    case 'veiculo':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.4')!
    case 'imovel':
    case 'terreno':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.5')!
    case 'mobiliario':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.6')!
    case 'marca_patente':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.7')!
    case 'software_proprio_aegis':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.8')!
    case 'software_licenca':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.9')!
    case 'direito_autoral':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.10')!
    case 'goodwill_intangivel':
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.11')!
    case 'outro_ativo':
    default:
      return PLANO_CONTAS_AEROCAD.find((i) => i.codigo === '1.2.6')!
  }
}
