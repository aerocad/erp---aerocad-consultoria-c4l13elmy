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
  etapa: 'lead' | 'qualificacao' | 'proposta_enviada' | 'negociacao' | 'ganho' | 'perdido'
  valor_estimado: number
  probabilidade: number
  data_prevista_fechamento: string
  data_fechamento: string
  motivo_perda: string
  responsavel: string
  trilha_prevista: Trail
  observacoes: string
  expand?: { cliente?: ClienteRecord; responsavel?: UserRecord; tipo_servico?: ServiceRecord }
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
  expand?: {
    cliente?: ClienteRecord
    responsavel_tecnico?: UserRecord
    oportunidade?: OportunidadeRecord
  }
}

export interface ProcessoRecord extends RecordModel {
  projeto: string
  orgao: 'DECEA-CINDACTA' | 'COMAER' | 'ANAC'
  numero_protocolo: string
  data_protocolo: string
  status:
    | 'nao_protocolado'
    | 'protocolado'
    | 'em_exigencia'
    | 'deferido'
    | 'indeferido'
    | 'arquivado'
  prazo_orgao: string
  parecer: 'favoravel' | 'favoravel_com_restricoes' | 'desfavoravel' | 'pendente'
  data_parecer: string
  link_sysaga: string
  link_ambiente: string
  link_drive: string
  link_emails: string
  observacoes: string
  expand?: { projeto?: ProjetoRecord }
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
  proposta: string
  cliente: string
  numero: string
  data_assinatura: string
  valor_global: number
  po_cliente: string
  link_documento_assinado: string
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
