import { useState } from 'react'
import {
  FileCheck,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Link2,
  Plus,
  Printer,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatDate } from '@/lib/format'
import { DOCUMENT_FAMILIES } from '@/lib/documentCatalogo'
import type { DocumentoRecord } from '@/types/crm'

export default function DocumentsPage() {
  const records = useCrmData<DocumentoRecord>('documentos', {
    expand: 'projeto,processo,cliente,modelo',
    sort: '-created',
  })

  const [query, setQuery] = useState('')
  const [familyFilter, setFamilyFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState('todos')

  const rows = records.data.filter((item) => {
    const matchesQuery =
      !query ||
      `${item.nome} ${item.tipo} ${item.expand?.projeto?.numero || ''} ${item.expand?.cliente?.razao_social || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())

    const matchesFamily = familyFilter === 'todas' || item.tipo === familyFilter
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter

    return matchesQuery && matchesFamily && matchesStatus
  })

  if (records.loading) return <PageLoading />
  if (records.error) return <ErrorState onRetry={() => void records.reload()} />

  return (
    <div>
      <SectionHeader
        eyebrow="REPOSITÓRIO TÉCNICO E CONTRATUAL"
        title="Documentos e Modelos AEROCAD"
        description="Geração automatizada de Propostas Comerciais, Propostas Técnicas, Contratos, OS e Peças Regulatórias A4."
        actions={
          <div className="flex gap-2">
            <Button asChild className="bg-[#FF6A13] hover:bg-[#E85B06]">
              <Link to="/documentos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Gerar Novo Documento
              </Link>
            </Button>
          </div>
        }
      />

      {/* Barra de estatísticas e famílias rápidas */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="crm-card p-3 text-center">
          <p className="text-[10px] font-bold text-[#888]">TOTAL GERADOS</p>
          <p className="text-xl font-bold text-[#333]">{records.data.length}</p>
        </div>
        <div className="crm-card p-3 text-center border-l-4 border-l-[#FF6A13]">
          <p className="text-[10px] font-bold text-[#888]">PROPOSTAS (PC/PT)</p>
          <p className="text-xl font-bold text-[#FF6A13]">
            {
              records.data.filter((d) => d.tipo === 'proposta' || d.tipo === 'proposta_tecnica')
                .length
            }
          </p>
        </div>
        <div className="crm-card p-3 text-center">
          <p className="text-[10px] font-bold text-[#888]">CONTRATOS</p>
          <p className="text-xl font-bold text-[#333]">
            {records.data.filter((d) => d.tipo === 'contrato').length}
          </p>
        </div>
        <div className="crm-card p-3 text-center">
          <p className="text-[10px] font-bold text-[#888]">ORDENS DE SERVIÇO</p>
          <p className="text-xl font-bold text-[#333]">
            {records.data.filter((d) => d.tipo === 'ordem_servico').length}
          </p>
        </div>
        <div className="crm-card p-3 text-center">
          <p className="text-[10px] font-bold text-[#888]">EM ASSINATURA</p>
          <p className="text-xl font-bold text-amber-600">
            {records.data.filter((d) => d.status === 'enviado_assinatura').length}
          </p>
        </div>
        <div className="crm-card p-3 text-center">
          <p className="text-[10px] font-bold text-[#888]">ASSINADOS</p>
          <p className="text-xl font-bold text-emerald-600">
            {records.data.filter((d) => d.status === 'assinado').length}
          </p>
        </div>
      </div>

      {/* Filtros de busca */}
      <div className="mb-5 flex flex-wrap gap-3 rounded-xl border bg-white p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9 h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, cliente, código ou projeto..."
          />
        </div>

        <div className="w-[200px]">
          <Select value={familyFilter} onValueChange={setFamilyFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas as famílias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as famílias</SelectItem>
              <SelectItem value="proposta">PC — Proposta Comercial</SelectItem>
              <SelectItem value="proposta_tecnica">PT — Proposta Técnica</SelectItem>
              <SelectItem value="contrato">CT — Contratos</SelectItem>
              <SelectItem value="ordem_servico">OS — Ordens de Serviço</SelectItem>
              <SelectItem value="procuracao">PR — Procurações</SelectItem>
              <SelectItem value="fatura">FT — Faturas</SelectItem>
              <SelectItem value="recibo">RB — Recibos</SelectItem>
              <SelectItem value="ata_reuniao">AT — Atas de Reunião</SelectItem>
              <SelectItem value="requerimento">RQ — Requerimentos</SelectItem>
              <SelectItem value="nota_tecnica">NT — Notas Técnicas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[170px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="gerado">Gerado</SelectItem>
              <SelectItem value="enviado_assinatura">Em Assinatura</SelectItem>
              <SelectItem value="assinado">Assinado</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          title="Nenhum documento encontrado"
          description="Nenhum documento gerado corresponde aos filtros selecionados. Abra o gerador para criar um novo documento fiel à identidade AEROCAD."
          action={
            <Button asChild className="bg-[#FF6A13] hover:bg-[#E85B06]">
              <Link to="/documentos/novo">Abrir Gerador de Documentos</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <article key={item.id} className="crm-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
                    {item.status === 'assinado' ? (
                      <FileSignature className="h-5 w-5 text-emerald-600" />
                    ) : item.tipo === 'proposta_tecnica' ? (
                      <FileSpreadsheet className="h-5 w-5" />
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

                <h2 className="mt-4 font-bold text-[#333] text-sm leading-snug line-clamp-2">
                  {item.nome}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                    {item.tipo.toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono text-[#888]">
                    {item.versao || 'REV001'}
                  </span>
                </div>

                <div className="mt-4 border-t pt-3 text-xs text-[#666] space-y-1">
                  <p className="font-semibold text-[#444] truncate">
                    {item.expand?.cliente?.razao_social || 'Cliente não vinculado'}
                  </p>
                  <p className="font-mono text-[11px] text-[#777]">
                    Projeto: {item.expand?.projeto?.numero || '—'}
                  </p>
                  <p className="text-[11px] text-[#888]">Gerado em {formatDate(item.created)}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                  <Link
                    to={`/documentos/novo?projeto=${item.projeto || ''}&processo=${item.processo || ''}`}
                  >
                    Abrir no Gerador
                  </Link>
                </Button>

                {item.link_assinatura && (
                  <Button asChild size="sm" variant="ghost" className="text-xs text-[#FF6A13]">
                    <a
                      href={item.link_assinatura}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir link de assinatura"
                    >
                      <Link2 className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
