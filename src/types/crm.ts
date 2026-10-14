import type { RecordModel } from 'pocketbase'

export type Role = 'admin' | 'comercial' | 'tecnico' | 'financeiro' | 'terceiro'
export type Trail = 'opea' | 'registro' | 'demais'

export interface UserRecord extends RecordModel {
  name: string
  email: string
  avatar: string
  role: Role
}

export type OrdemServicoStatus =
  | 'atribuida'
  | 'em_execucao'
  | 'concluida'
  | 'recusada'
  | 'cancelada'
  | 'rascunho'
  | 'emitida'

export interface OrdemServicoRecord extends RecordModel {
  projeto: string
  prestador_usuario?: string
  prestador?: string
  titulo?: string
  descricao: string
  prazo?: string
  data_conclusao?: string
  valor_interno?: number
  observacoes?: string
  status: OrdemServicoStatus
  expand?: {
    projeto?: ProjetoRecord
    prestador_usuario?: UserRecord
  }
}

export interface ClienteRecord extends RecordModel {
  tipo: 'pj' | 'pf'
  razao_social: string
  cnpj_cpf: string
  segmento: string
  municipio: string
  uf: string
  telefone: string
  email: string
  endereco: string
  origem: string
  status: 'prospect' | 'cliente' | 'inativo'
  recorrente: boolean
  observacoes: string
}

export interface OportunidadeRecord extends RecordModel {
  cliente: string
  titulo: string
  tipo_servico: string
  servico_nome?: string
  etapa: 'lead' | 'qualificacao' | 'proposta_enviada' | 'negociacao' | 'ganho' | 'perdido'
  valor_estimado: number
  probabilidade: number
  data_prevista_fechamento: string
  data_fechamento: string
  motivo_perda: string
  responsavel: string
  responsavel_colaborador?: string
  trilha_prevista: Trail
  trilha_prevista_nome?: string
  observacoes: string
  origem_canal?: 'whatsapp' | 'site' | 'indicacao' | 'email' | 'outro'
  whatsapp_remetente?: string
  whatsapp_mensagem?: string
  expand?: {
    cliente?: ClienteRecord
    responsavel?: UserRecord
    responsavel_colaborador?: ColaboradorRecord
    tipo_servico?: ServiceRecord
  }
}

export type WhatsAppProvider = 'meta' | 'zapi' | 'outro'

export interface WhatsAppConfigRecord extends RecordModel {
  chave: string
  provider: WhatsAppProvider
  webhook_secret: string
  auto_resposta_ativa: boolean
  mensagem_auto_resposta: string
  numero_empresa: string
  observacoes?: string
}

export interface ProjetoRecord extends RecordModel {
  numero: string
  nome: string
  cliente: string
  empreendimento: string
  oportunidade: string
  contrato: string
  trilha: Trail
  fase: string
  status: 'ativo' | 'suspenso' | 'concluido' | 'cancelado'
  responsavel_tecnico: string
  art: string
  pasta_drive_url: string
  data_inicio: string
  prazo: string
  percentual_concluido: number
  observacoes: string
  id_planilha?: string
  numero_pc_pt?: string
  tipo_servico?: string
  escopo_resumido?: string
  municipio_uf?: string
  aerodromo?: string
  data_proposta?: string
  data_aceite?: string
  prazo_dias?: number
  valor_global?: number
  marco_fase_atual?: string
  proxima_entrega?: string
  pendente_orgao?: string
  status_planilha?: string
  origem_importacao?: boolean
  arquivado?: boolean
  data_arquivamento?: string
  sort_order?: number
  prioridade?: 'alta' | 'normal' | 'baixa'
  coordenador_colaborador?: string
  analista_colaborador?: string
  rts_colaboradores?: string[]
  rts_usuarios?: string[]
  expand?: {
    cliente?: ClienteRecord
    responsavel_tecnico?: UserRecord
    oportunidade?: OportunidadeRecord
    coordenador_colaborador?: ColaboradorRecord
    analista_colaborador?: ColaboradorRecord
    rts_colaboradores?: ColaboradorRecord[]
  }
}

export type ProcessoOrgao =
  | 'DECEA-CINDACTA'
  | 'COMAER'
  | 'ANAC'
  | 'DECEA'
  | 'CINDACTA'
  | 'SAC'
  | 'Prefeitura / Órgão Municipal'
  | 'Outro'

export type ProcessoStatus =
  | 'nao_protocolado'
  | 'protocolado'
  | 'em_analise'
  | 'em_exigencia'
  | 'deferido'
  | 'indeferido'
  | 'arquivado'

export interface ProcessoRecord extends RecordModel {
  projeto: string
  orgao: ProcessoOrgao
  numero_protocolo: string
  data_protocolo: string
  status: ProcessoStatus
  prazo_orgao: string
  parecer: 'favoravel' | 'favoravel_com_restricoes' | 'desfavoravel' | 'pendente'
  data_parecer: string
  link_sysaga: string
  link_ambiente: string
  link_drive: string
  link_emails: string
  observacoes: string
  coordenador_colaborador?: string
  analista_colaborador?: string
  rts_colaboradores?: string[]
  rts_usuarios?: string[]
  expand?: {
    projeto?: ProjetoRecord
    coordenador_colaborador?: ColaboradorRecord
    analista_colaborador?: ColaboradorRecord
    rts_colaboradores?: ColaboradorRecord[]
  }
}

export interface ExigenciaRecord extends RecordModel {
  processo: string
  descricao: string
  prazo: string
  status: 'pendente' | 'atendida' | 'dispensada'
  responsavel: string
  data_resposta: string
  resposta: string
  historico_respostas: Array<{ data: string; texto: string; usuario: string }>
  expand?: { processo?: ProcessoRecord; responsavel?: UserRecord }
}

export interface ParcelaRecord extends RecordModel {
  projeto: string
  cliente: string
  descricao: string
  valor: number
  gatilho: 'assinatura' | 'protocolo' | 'entrega' | 'medicao' | 'manual'
  nf_numero: string
  vencimento: string
  status: 'pendente' | 'paga' | 'vencida'
  data_pagamento: string
  valor_recebido: number
  retencoes: string
  observacoes: string
  origem: 'manual' | 'gatilho'
  id_lancamento?: string
  numero_parcela_marco?: string
  percentual_contrato?: number
  evento_comprobatorio?: string
  data_prevista?: string
  data_faturamento?: string
  status_pagamento?: string
  origem_importacao?: boolean
  nfse_chave?: string
  nfse_dados?: Record<string, unknown>
  expand?: { projeto?: ProjetoRecord; cliente?: ClienteRecord }
}

export interface DocumentoRecord extends RecordModel {
  nome: string
  tipo: string
  modelo: string
  projeto: string
  processo: string
  cliente: string
  versao: string
  status: 'rascunho' | 'gerado' | 'enviado_assinatura' | 'assinado'
  link_assinatura: string
  link_arquivo: string
  arquivo: string
  gerado_de_template: boolean
  conteudo: string
  expand?: {
    projeto?: ProjetoRecord
    processo?: ProcessoRecord
    cliente?: ClienteRecord
    modelo?: ModeloRecord
  }
}

export interface ModeloRecord extends RecordModel {
  nome: string
  categoria: string
  corpo: string
}

export interface AtividadeRecord extends RecordModel {
  usuario: string
  texto: string
  cliente: string
  oportunidade: string
  projeto: string
  processo: string
  expand?: { usuario?: UserRecord }
}

export interface ServiceRecord extends RecordModel {
  codigo: string
  nome: string
  descricao: string
  prazo_tipico: string
  faixa_min: number
  faixa_max: number
  preco_padrao: number
  base_normativa: string
  desconto_pacote_percentual: number
  ativo: boolean
}

export interface SequenciaRecord extends RecordModel {
  chave: string
  atual: number
  ano: number
}

export interface PropostaRecord extends RecordModel {
  oportunidade: string
  tipo: 'comercial' | 'tecnica'
  numero: string
  revisao: string
  valor_total: number
  condicoes_pagamento: string
  validade_dias: number
  status: string
  data_envio: string
  link_drive: string
  expand?: { oportunidade?: OportunidadeRecord }
}

export interface ContratoRecord extends RecordModel {
  proposta?: string
  cliente?: string
  fornecedor?: string
  projeto?: string
  numero: string
  titulo?: string
  tipo_contrato?: 'cliente' | 'prestador_fornecedor' | 'parceria_tecnica' | 'outro'
  partes_envolvidas?: string
  objeto?: string
  valor_global?: number
  forma_pagamento_texto?: string
  parcelamento?: any
  po_cliente?: string
  link_documento_assinado?: string
  arquivo_pdf?: string
  data_assinatura?: string
  data_inicio_vigencia?: string
  data_termino_vigencia?: string
  indice_reajuste?: string
  garante_fiador?: string
  dados_extracao_ia?: any
  observacoes?: string
  expand?: {
    proposta?: PropostaRecord
    cliente?: ClienteRecord
    fornecedor?: FornecedorRecord
    projeto?: ProjetoRecord
  }
}

export type AnexoCategoria =
  | 'orcamento'
  | 'planilha'
  | 'edital'
  | 'projeto_tecnico'
  | 'documento_cliente'
  | 'laudo_relatorio'
  | 'outro'

export interface AnexoRecord extends RecordModel {
  nome: string
  descricao: string
  categoria: AnexoCategoria
  arquivo: string
  tamanho_bytes: number
  extensao: string
  cliente: string
  projeto: string
  processo: string
  oportunidade: string
  proposta: string
  usuario: string
  expand?: {
    cliente?: ClienteRecord
    projeto?: ProjetoRecord
    processo?: ProcessoRecord
    oportunidade?: OportunidadeRecord
    proposta?: PropostaRecord
    usuario?: UserRecord
  }
}

export interface ImportacaoLogRecord extends RecordModel {
  arquivo_nome: string
  tamanho_bytes: number
  usuario: string
  total_clientes: number
  total_projetos: number
  total_financeiro: number
  total_comunicacoes: number
  resumo: {
    clientes: { criados: number; atualizados: number; ignorados: number; pendencias: number }
    projetos: { criados: number; atualizados: number; ignorados: number; pendencias: number }
    financeiro: { criados: number; atualizados: number; ignorados: number; pendencias: number }
    comunicacoes: { criados: number; atualizados: number; ignorados: number; pendencias: number }
    avisos: string[]
    erros: string[]
  }
  expand?: {
    usuario?: UserRecord
  }
}

export type AlertaSeveridade = 'critico' | 'atencao' | 'informativo'

export type AlertaTipo =
  | 'proposta_sem_retorno'
  | 'proposta_expirada'
  | 'exigencia_prazo'
  | 'exigencia_sem_envio'
  | 'parcela_vencida'
  | 'os_sem_resposta'
  | 'os_prazo'
  | 'os_pendente_validacao'
  | 'processo_orgao_sem_parecer'
  | 'projeto_sem_movimentacao'

export interface AlertaItem {
  chave: string
  tipo: AlertaTipo
  severidade: AlertaSeveridade
  titulo: string
  descricao: string
  link: string
  linkTexto: string
  categoria: 'comercial' | 'tecnico' | 'financeiro'
  dataReferencia?: string
  diasAtraso?: number
  diasRestantes?: number
  meta?: Record<string, unknown>
  registroId: string
}

export interface AlertaDispensadoRecord extends RecordModel {
  usuario: string
  chave_unica: string
  severidade_dispensada: 'critico' | 'atencao' | 'informativo'
  data_dispensa: string
  motivo?: string
}

export interface TarefaRecord extends RecordModel {
  titulo: string
  responsavel: string
  prazo?: string
  tipo?: 'ligacao' | 'reuniao' | 'envio' | 'elaboracao' | 'protocolo'
  oportunidade?: string
  projeto?: string
  concluida?: boolean
  expand?: { responsavel?: UserRecord; projeto?: ProjetoRecord; oportunidade?: OportunidadeRecord }
}

export type CategoriaContaPagar =
  | 'impostos'
  | 'folha'
  | 'terceirizados'
  | 'despesas_operacionais'
  | 'equipamentos'
  | 'outros'

export type StatusContaPagar = 'pendente' | 'pago' | 'cancelado'

export type FormaPagamentoFinanceiro =
  | 'pix'
  | 'ted_doc'
  | 'boleto'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'dinheiro'
  | 'outro'

export interface ContaBancariaRecord extends RecordModel {
  apelido: string
  banco_codigo?: string
  banco_nome: string
  agencia?: string
  numero_conta: string
  tipo_conta: 'corrente_pj' | 'poupanca_pj' | 'investimento_pj' | 'outro'
  chave_pix?: string
  saldo_inicial?: number
  ativo?: boolean
  cor_identificacao?: string
  observacoes?: string
}

export type CategoriaAtivoPatrimonial =
  | 'equipamento_topografico'
  | 'drone_aeronave'
  | 'computador_hardware'
  | 'software_licenca'
  | 'veiculo'
  | 'imovel'
  | 'mobiliario'
  | 'outro_ativo'

export type StatusAtivoPatrimonial =
  | 'ativo'
  | 'em_manutencao'
  | 'baixado_alienado'
  | 'totalmente_depreciado'

export interface AtivoPatrimonioRecord extends RecordModel {
  identificador_codigo?: string
  descricao: string
  categoria: CategoriaAtivoPatrimonial
  data_aquisicao: string
  valor_aquisicao: number
  vida_util_meses?: number
  taxa_depreciacao_anual?: number
  valor_residual?: number
  valor_contabil_atual?: number
  status: StatusAtivoPatrimonial
  numero_nf_registro?: string
  fornecedor?: string
  fornecedor_nome?: string
  documento_evidencia?: string
  localizacao_responsavel?: string
  observacoes?: string
  criado_por?: string
  expand?: {
    fornecedor?: FornecedorRecord
    criado_por?: UserRecord
  }
}

export type TipoPessoaCredor = 'pj' | 'pf'

export type CategoriaCredor =
  | 'fornecedor_servicos'
  | 'fornecedor_material'
  | 'locador'
  | 'condominio'
  | 'utilidades'
  | 'impostos_orgaos_publicos'
  | 'instituicao_financeira'
  | 'folha_encargos'
  | 'contador'
  | 'outros'

export interface CredorRecord extends RecordModel {
  nome_razao_social: string
  nome_fantasia?: string
  cnpj_cpf: string
  tipo_pessoa: TipoPessoaCredor
  categoria: CategoriaCredor
  email?: string
  telefone?: string
  endereco?: string
  cidade_uf?: string
  banco_nome?: string
  banco_agencia?: string
  banco_conta?: string
  chave_pix?: string
  status: 'ativo' | 'inativo'
  observacoes?: string
  anexos?: string[]
  criado_por?: string
  expand?: {
    criado_por?: UserRecord
  }
}

export interface ContaPagarRecord extends RecordModel {
  descricao: string
  fornecedor: string
  cliente_fornecedor?: string
  credor?: string
  categoria: CategoriaContaPagar
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: StatusContaPagar
  forma_pagamento?: FormaPagamentoFinanceiro
  numero_documento?: string
  projeto?: string
  comprovante?: string
  observacoes?: string
  criado_por?: string
  // Campos contábeis & boleto & conta bancária PJ
  codigo_barras_linha_digitavel?: string
  cnpj_cpf_beneficiario?: string
  valor_desconto?: number
  valor_juros_multa?: number
  plano_contas_codigo?: string
  plano_contas_nome?: string
  conta_bancaria?: string
  expand?: {
    cliente_fornecedor?: ClienteRecord
    credor?: CredorRecord
    projeto?: ProjetoRecord
    criado_por?: UserRecord
    conta_bancaria?: ContaBancariaRecord
  }
}

export type CategoriaContaReceber =
  | 'consultoria_avulsa'
  | 'servico_tecnico'
  | 'honorarios'
  | 'reembolso'
  | 'rendimento_aplicacao'
  | 'outros'

export type StatusContaReceber = 'pendente' | 'recebido' | 'cancelado'

export type CategoriaFornecedor =
  | 'terceirizados'
  | 'equipamentos'
  | 'despesas_operacionais'
  | 'folha'
  | 'impostos'
  | 'software_ti'
  | 'juridico_contabil'
  | 'outros'

export interface FornecedorRecord extends RecordModel {
  razao_social: string
  nome_fantasia?: string
  cnpj_cpf: string
  categoria: CategoriaFornecedor
  contato_nome?: string
  email?: string
  telefone?: string
  chave_pix?: string
  dados_bancarios?: string
  endereco?: string
  municipio_uf?: string
  status: 'ativo' | 'inativo'
  observacoes?: string
  criado_por?: string
  expand?: {
    criado_por?: UserRecord
  }
}

export type RegimeContratacao = 'pf_clt' | 'pf_autonomo' | 'pj' | 'socio'

export type RegistroProfissionalTipo = 'CREA' | 'CAU' | 'CFT' | 'CRQ' | 'OUTRO'

export interface ColaboradorRecord extends RecordModel {
  nome_completo: string
  cpf_cnpj: string
  cargo: string
  funcao: string
  regime_contratacao: RegimeContratacao
  empresa_pj?: string
  fornecedor_vinculado?: string
  usuario_sistema?: string
  email?: string
  telefone?: string
  data_admissao: string
  data_desligamento?: string
  situacao: 'ativo' | 'inativo'
  remuneracao_base?: number
  chave_pix?: string
  foto?: string
  observacoes?: string
  criado_por?: string
  eh_tecnico?: boolean
  eh_rt?: boolean
  registro_profissional_tipo?: RegistroProfissionalTipo
  registro_profissional_numero?: string
  registro_profissional_uf?: string
  formacao_academica?: string
  area_atuacao?: string
  rrt_art_padrao?: string
  expand?: {
    fornecedor_vinculado?: FornecedorRecord
    usuario_sistema?: UserRecord
    criado_por?: UserRecord
  }
}

export interface BalanceteConsolidadoDados {
  ano: number
  mes: number
  referencia: string
  receitas: {
    total: number
    porCategoria: Record<string, number>
    porCliente: Array<{ clienteNome: string; total: number; qtdLancamentos: number }>
    itens: Array<{
      id: string
      data: string
      descricao: string
      clienteNome: string
      projetoNumero?: string
      valor: number
      origem: 'parcela' | 'receita_avulsa'
      nfNumero?: string
    }>
  }
  despesas: {
    total: number
    porCategoria: Record<string, number>
    porFornecedor: Array<{ fornecedorNome: string; total: number; qtdLancamentos: number }>
    itens: Array<{
      id: string
      data: string
      descricao: string
      fornecedor: string
      categoria: string
      valor: number
      numeroDocumento?: string
    }>
  }
  acumuladoAno: {
    receitasTotal: number
    despesasTotal: number
    saldoAcumulado: number
    meses: Array<{ mes: number; nomeMes: string; receita: number; despesa: number; saldo: number }>
  }
}

export interface BalanceteMensalRecord extends RecordModel {
  referencia: string // YYYY-MM
  ano: number
  mes: number
  titulo: string
  receita_total: number
  despesa_total: number
  saldo_mes: number
  saldo_acumulado_ano: number
  total_receitas_ano: number
  total_despesas_ano: number
  dados_consolidados: BalanceteConsolidadoDados
  responsavel_emissao?: string
  data_emissao: string
  criado_por?: string
  observacoes?: string
  expand?: {
    criado_por?: UserRecord
  }
}

export interface ContaReceberRecord extends RecordModel {
  descricao: string
  cliente_nome: string
  cliente?: string
  categoria: CategoriaContaReceber
  valor: number
  valor_recebido?: number
  data_vencimento: string
  data_recebimento?: string
  status: StatusContaReceber
  forma_recebimento?: FormaPagamentoFinanceiro
  numero_documento?: string
  projeto?: string
  comprovante?: string
  observacoes?: string
  criado_por?: string
  plano_contas_codigo?: string
  plano_contas_nome?: string
  conta_bancaria?: string
  expand?: {
    cliente?: ClienteRecord
    projeto?: ProjetoRecord
    criado_por?: UserRecord
    conta_bancaria?: ContaBancariaRecord
  }
}

export type ExtratoFormato = 'ofx' | 'csv' | 'xlsx'

export interface ExtratoRecord extends RecordModel {
  nome_arquivo: string
  formato: ExtratoFormato
  banco?: string
  conta?: string
  conta_bancaria?: string
  data_inicio?: string
  data_fim?: string
  total_transacoes: number
  total_entradas: number
  total_saidas: number
  saldo_final?: number
  arquivo?: string
  usuario?: string
  expand?: {
    usuario?: UserRecord
    conta_bancaria?: ContaBancariaRecord
  }
}

export type ExtratoTransacaoTipo = 'entrada' | 'saida'
export type ExtratoConciliacaoStatus = 'pendente' | 'conciliado' | 'ignorado'
export type ExtratoVinculoTipo = 'parcela' | 'conta_pagar' | 'conta_receber'

export interface ExtratoTransacaoRecord extends RecordModel {
  extrato: string
  data: string
  descricao: string
  valor: number
  tipo: ExtratoTransacaoTipo
  documento_ref?: string
  fitid?: string
  status_conciliacao: ExtratoConciliacaoStatus
  vinculo_tipo?: ExtratoVinculoTipo
  vinculo_id?: string
  data_conciliacao?: string
  observacoes?: string
  expand?: {
    extrato?: ExtratoRecord
  }
}
