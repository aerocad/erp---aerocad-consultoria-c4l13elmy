import {
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileArchive,
  File as FileIcon,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface FileTypeMeta {
  label: string
  color: string
  bg: string
  border: string
  Icon: ElementType
}

export function getFileTypeMeta(extension: string): FileTypeMeta {
  const ext = (extension || '').toLowerCase().replace('.', '')

  if (ext === 'dwg' || ext === 'dxf') {
    return {
      label: ext.toUpperCase(),
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      Icon: FileCode,
    }
  }

  if (ext === 'pdf') {
    return {
      label: 'PDF',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      Icon: FileText,
    }
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return {
      label: ext.toUpperCase(),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      Icon: FileSpreadsheet,
    }
  }

  if (ext === 'docx' || ext === 'doc' || ext === 'txt') {
    return {
      label: ext.toUpperCase(),
      color: 'text-sky-700',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      Icon: FileText,
    }
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      Icon: FileImage,
    }
  }

  if (['zip', 'rar', '7z', 'kmz', 'kml'].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      Icon: FileArchive,
    }
  }

  return {
    label: (ext || 'ARQ').toUpperCase(),
    color: 'text-neutral-700',
    bg: 'bg-neutral-100',
    border: 'border-neutral-200',
    Icon: FileIcon,
  }
}
