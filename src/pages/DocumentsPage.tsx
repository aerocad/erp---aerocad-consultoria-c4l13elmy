import { FileSignature, FileText, Link2, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatDate } from '@/lib/format'
import type { DocumentoRecord } from '@/types/crm'
import { useState } from 'react'

export default function DocumentsPage() {
  const records = useCrmData<DocumentoRecord>('documentos', {
    expand: 'projeto,processo,cliente,modelo',
    sort: '-created',
  })
  const [query, setQuery] = useState('')
  const rows = records.data.filter(
    (i) =>
      !query ||
      `${i.nome} ${i.tipo} ${i.expand?.projeto?.numero}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  if (records.loading) return <PageLoading />
  if (records.error) return <ErrorState onRetry={() => void records.reload()} />
  return (
    <div>
      <SectionHeader
        eyebrow="DOCUMENTAÇÃO"
        title="Documentos"
        description="Geração A4, impressão em PDF e assinatura por link manual."
        actions={
          <Button asChild className="bg-[#FF6A13] hover:bg-[#E85B06]">
            <Link to="/documentos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Gerar documento
            </Link>
          </Button>
        }
      />
      <div className="mb-5 rounded-xl border bg-white p-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome, tipo ou projeto"
          />
        </div>
      </div>
      {!rows.length ? (
        <EmptyState
          title="Nenhum documento gerado"
          description="Escolha um modelo e gere o primeiro documento com a identidade AEROCAD."
          action={
            <Button asChild>
              <Link to="/documentos/novo">Abrir gerador</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <article key={item.id} className="crm-card p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
                  {item.status === 'assinado' ? (
                    <FileSignature className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </span>
                <CrmBadge
                  tone={
                    item.status === 'assinado'
                      ? 'green'
                      : item.status === 'enviado_assinatura'
                        ? 'amber'
                        : 'gray'
                  }
                >
                  {item.status.replaceAll('_', ' ')}
                </CrmBadge>
              </div>
              <h2 className="mt-4 font-bold text-[#4B4B4B]">{item.nome}</h2>
              <p className="mt-1 text-xs uppercase tracking-wide text-[#8A8A8A]">{item.tipo}</p>
              <div className="mt-4 border-t pt-3 text-xs text-[#737373]">
                <p className="mono-value">
                  {item.expand?.projeto?.numero ||
                    item.expand?.processo?.numero_protocolo ||
                    item.expand?.cliente?.razao_social ||
                    'Sem contexto'}
                </p>
                <p className="mt-1">Gerado em {formatDate(item.created)}</p>
              </div>
              {item.link_assinatura && (
                <Button asChild variant="outline" className="mt-4 w-full">
                  <a href={item.link_assinatura} target="_blank" rel="noreferrer">
                    <Link2 className="mr-2 h-4 w-4" />
                    Abrir assinatura
                  </a>
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
