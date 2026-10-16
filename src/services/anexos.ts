import pb from '@/lib/pocketbase/client'
import type { AnexoCategoria, AnexoRecord } from '@/types/crm'

export const ANEXO_CATEGORIAS: Array<{ value: AnexoCategoria; label: string }> = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'planilha', label: 'Planilha / Cálculo' },
  { value: 'edital', label: 'Edital / Termo de Referência' },
  { value: 'projeto_tecnico', label: 'Projeto Técnico / DWG / DXF' },
  { value: 'documento_cliente', label: 'Documento do Cliente' },
  { value: 'laudo_relatorio', label: 'Laudo / Relatório Técnico' },
  { value: 'outro', label: 'Outro' },
]

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'txt',
  'docx',
  'doc',
  'xlsx',
  'xls',
  'csv',
  'ofx',
  'ret',
  'dwg',
  'dxf',
  'kml',
  'kmz',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'zip',
]

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  if (parts.length < 2) return ''
  return parts.pop()?.toLowerCase() || ''
}

export function getFileUrl(record: AnexoRecord, filename?: string): string {
  const file = filename || record.arquivo
  if (!file) return ''
  return pb.files.getURL(record, file)
}

export async function uploadAnexo(
  file: File,
  data: {
    nome: string
    descricao?: string
    categoria: AnexoCategoria
    usuarioId: string
    clienteId?: string
    projetoId?: string
    processoId?: string
    oportunidadeId?: string
    propostaId?: string
  },
): Promise<AnexoRecord> {
  const ext = getFileExtension(file.name)
  const formData = new FormData()

  formData.append('arquivo', file)
  formData.append('nome', data.nome.trim() || file.name)
  if (data.descricao?.trim()) formData.append('descricao', data.descricao.trim())
  formData.append('categoria', data.categoria)
  formData.append('tamanho_bytes', String(file.size))
  formData.append('extensao', ext)
  formData.append('usuario', data.usuarioId)

  if (data.clienteId) formData.append('cliente', data.clienteId)
  if (data.projetoId) formData.append('projeto', data.projetoId)
  if (data.processoId) formData.append('processo', data.processoId)
  if (data.oportunidadeId) formData.append('oportunidade', data.oportunidadeId)
  if (data.propostaId) formData.append('proposta', data.propostaId)

  return pb.collection('anexos').create<AnexoRecord>(formData, { requestKey: null })
}

export async function deleteAnexo(id: string): Promise<boolean> {
  return pb.collection('anexos').delete(id, { requestKey: null })
}
