import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ProjetoDialog } from '@/components/forms/ProjetoDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { formatDate } from '@/lib/format'
import type { ProjetoRecord } from '@/types/crm'

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const projects = useCrmData<ProjetoRecord>('projetos', {
    expand: 'cliente,responsavel_tecnico',
    sort: '-numero',
    realtime: true,
  })
  const [query, setQuery] = useState('')
  const [trail, setTrail] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [dialog, setDialog] = useState(params.get('novo') === '1')
  useEffect(() => {
    if (params.get('novo') === '1') setDialog(true)
  }, [params])
  const canWrite = ['admin', 'comercial', 'tecnico'].includes(user?.role || '')
  const rows = useMemo(
    () =>
      projects.data.filter(
        (item) =>
          (trail === 'todos' || item.trilha === trail) &&
          (status === 'todos' || item.status === status) &&
          (!query ||
            `${item.numero} ${item.nome} ${item.expand?.cliente?.razao_social}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [projects.data, query, trail, status],
  )
  if (projects.loading) return <PageLoading />
  if (projects.error) return <ErrorState onRetry={() => void projects.reload()} />
  return (
    <div>
      <SectionHeader
        eyebrow="ENTREGA TÉCNICA"
        title="Projetos"
        description="Trilhas, fases e prazos sob controle AEROCAD."
        actions={
          <Button
            disabled={!canWrite}
            onClick={() => setDialog(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo projeto
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            placeholder="Buscar número, nome ou cliente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={trail} onValueChange={setTrail}>
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as trilhas</SelectItem>
            <SelectItem value="opea">OPEA</SelectItem>
            <SelectItem value="registro">Registro</SelectItem>
            <SelectItem value="demais">Demais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!rows.length ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description="Crie um projeto ou ajuste os filtros."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/projetos/${item.id}`)}
              className="crm-card p-5 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="mono-value text-base font-black text-[#D65100]">
                  {item.numero}
                </span>
                <CrmBadge
                  tone={
                    item.trilha === 'registro'
                      ? 'green'
                      : item.trilha === 'opea'
                        ? 'orange'
                        : 'gray'
                  }
                >
                  {item.trilha.toUpperCase()}
                </CrmBadge>
              </div>
              <h2 className="mt-3 font-bold text-[#4B4B4B]">{item.nome}</h2>
              <p className="mt-1 text-sm text-[#737373]">{item.expand?.cliente?.razao_social}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded bg-[#F2F2F2]">
                <div
                  className="h-full bg-[#FF6A13]"
                  style={{ width: `${item.percentual_concluido}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-[#8A8A8A]">
                <span>{item.fase}</span>
                <span className="mono-value">{item.percentual_concluido}%</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <CrmBadge tone={item.status === 'ativo' ? 'green' : 'gray'}>{item.status}</CrmBadge>
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(item.prazo)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <ProjetoDialog
        open={dialog}
        onOpenChange={(value) => {
          setDialog(value)
          if (!value && params.has('novo')) {
            params.delete('novo')
            setParams(params, { replace: true })
          }
        }}
        onSaved={(record) => navigate(`/projetos/${record.id}`)}
      />
    </div>
  )
}
