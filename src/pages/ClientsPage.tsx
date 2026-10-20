import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Building2, Mail, MapPin, Phone, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ClienteDialog } from '@/components/forms/ClienteDialog'
import { AssistenteSecaoDrawer } from '@/components/chat/AssistenteSecaoDrawer'
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
import type { ClienteRecord, ProjetoRecord } from '@/types/crm'

const SUGESTOES_CLIENTES = [
  'Quais clientes possuem maior número de projetos ativos?',
  'Quais clientes foram cadastrados recentemente na base?',
  'Como buscar contatos e decisores de um cliente específico?',
  'Quantos clientes estão categorizados como PF vs PJ?',
]

export default function ClientsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const clients = useCrmData<ClienteRecord>('clientes', { sort: 'razao_social' })
  const projects = useCrmData<ProjetoRecord>('projetos', { sort: 'numero' })
  const [query, setQuery] = useState('')
  const [type, setType] = useState('todos')
  const [sortAsc, setSortAsc] = useState(true)
  const [dialog, setDialog] = useState(params.get('novo') === '1')
  const canWrite = user?.role === 'admin' || user?.role === 'comercial'
  useEffect(() => {
    if (params.get('novo') === '1') setDialog(true)
  }, [params])
  const rows = useMemo(
    () =>
      clients.data
        .filter(
          (item) =>
            (type === 'todos' || item.tipo === type) &&
            (!query ||
              `${item.razao_social} ${item.cnpj_cpf} ${item.municipio}`
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .sort((a, b) => (sortAsc ? 1 : -1) * a.razao_social.localeCompare(b.razao_social)),
    [clients.data, type, query, sortAsc],
  )

  const hasClientData = clients.data.length > 0
  if (clients.loading && !hasClientData) return <PageLoading label="Carregando clientes..." />
  if (clients.error && !hasClientData) return <ErrorState onRetry={() => void clients.reload()} />

  return (
    <div>
      <SectionHeader
        eyebrow="RELACIONAMENTO"
        title="Clientes"
        description={`${clients.data.length} registros na base AEROCAD`}
        actions={
          <Button
            onClick={() => setDialog(true)}
            disabled={!canWrite}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            placeholder="Buscar razão social, CNPJ/CPF ou município"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="pj">Pessoa jurídica</SelectItem>
            <SelectItem value="pf">Pessoa física</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!rows.length ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros ou cadastre um novo cliente."
        />
      ) : (
        <>
          <div className="crm-table-wrapper hidden md:block">
            <table className="crm-data-table">
              <thead className="border-b bg-neutral-50/95 text-neutral-600 font-bold text-left text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-2.5 py-2 min-w-[200px]">
                    <button
                      className="flex items-center gap-1.5 text-neutral-700 hover:text-[#FF6A13]"
                      onClick={() => setSortAsc((v) => !v)}
                    >
                      Cliente <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-2.5 py-2 whitespace-nowrap min-w-[120px]">Documento</th>
                  <th className="px-2.5 py-2 whitespace-nowrap min-w-[110px]">Localidade</th>
                  <th className="px-2.5 py-2 min-w-[160px]">Contato</th>
                  <th className="px-2.5 py-2 text-center whitespace-nowrap min-w-[80px]">
                    Projetos
                  </th>
                  <th className="px-2.5 py-2 whitespace-nowrap min-w-[90px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((item) => {
                  const count = projects.data.filter(
                    (project) => project.cliente === item.id,
                  ).length
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/clientes/${item.id}`)}
                      className="cursor-pointer hover:bg-[#FFF6EC]/50 transition-colors"
                    >
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <p
                            className="font-semibold text-neutral-900 text-xs truncate max-w-[240px]"
                            title={item.razao_social}
                          >
                            {item.razao_social}
                          </p>
                          {item.origem === 'NFS-e' && (
                            <CrmBadge tone="orange" className="text-[10px] py-0 px-1.5 shrink-0">
                              NFS-e
                            </CrmBadge>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate max-w-[240px]">
                          {item.segmento || 'Segmento não informado'}
                        </p>
                      </td>
                      <td className="mono-value font-mono tabular-nums px-2.5 py-2 text-xs whitespace-nowrap">
                        {item.cnpj_cpf || '—'}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-neutral-700 whitespace-nowrap">
                        {item.municipio}
                        {item.uf ? ` / ${item.uf}` : ''}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-neutral-600">
                        <span
                          className="flex items-center gap-1 truncate max-w-[180px]"
                          title={item.email}
                        >
                          <Mail className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span className="truncate">{item.email || '—'}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono tabular-nums text-[11px]">
                          <Phone className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span>{item.telefone || '—'}</span>
                        </span>
                      </td>
                      <td className="mono-value font-mono tabular-nums px-2.5 py-2 text-center font-bold text-neutral-900 text-xs">
                        {count}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <CrmBadge
                          tone={
                            item.status === 'cliente'
                              ? 'green'
                              : item.status === 'inativo'
                                ? 'gray'
                                : 'orange'
                          }
                        >
                          {item.status === 'cliente'
                            ? 'Cliente'
                            : item.status === 'prospect'
                              ? 'Prospect'
                              : 'Inativo'}
                        </CrmBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/clientes/${item.id}`)}
                className="crm-card min-h-24 p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Building2 className="mb-2 h-5 w-5 text-[#FF6A13]" />
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#4B4B4B]">{item.razao_social}</p>
                      {item.origem === 'NFS-e' && (
                        <CrmBadge tone="orange" className="text-[10px] py-0 px-1.5">
                          NFS-e
                        </CrmBadge>
                      )}
                    </div>
                    <p className="mono-value mt-1 text-xs text-[#737373]">{item.cnpj_cpf}</p>
                  </div>
                  <CrmBadge tone={item.status === 'cliente' ? 'green' : 'orange'}>
                    {item.status}
                  </CrmBadge>
                </div>
                <p className="mt-3 flex items-center gap-1 text-xs text-[#737373]">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.municipio} / {item.uf}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
      <ClienteDialog
        open={dialog}
        onOpenChange={(value) => {
          setDialog(value)
          if (!value && params.has('novo')) {
            params.delete('novo')
            setParams(params, { replace: true })
          }
        }}
        onSaved={() => void clients.reload()}
      />

      {/* Assistente de IA Nativo da Seção Clientes */}
      <AssistenteSecaoDrawer
        agentSlug="assistente-clientes"
        titulo="Assistente de Clientes"
        subtitulo="Base cadastral, contatos, empreendimentos e histórico"
        secaoNome="Clientes"
        areaPermissao="clientes"
        sugestoes={SUGESTOES_CLIENTES}
        placeholder="Pergunte sobre clientes, contatos, empreendimentos ou histórico..."
        descricaoModo="consulta dados cadastrais, histórico e empreendimentos em tempo real."
        floatingButtonLabel="Assistente de Clientes"
      />
    </div>
  )
}
