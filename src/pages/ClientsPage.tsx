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

  if (clients.loading || projects.loading) return <PageLoading />
  if (clients.error) return <ErrorState onRetry={() => void clients.reload()} />

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
          <div className="hidden overflow-hidden rounded-xl border bg-white md:block">
            <table className="w-full">
              <thead className="border-b bg-[#FAFAFA] text-left text-[11px] uppercase tracking-[.08em] text-[#737373]">
                <tr>
                  <th className="px-5 py-3">
                    <button
                      className="flex items-center gap-2"
                      onClick={() => setSortAsc((v) => !v)}
                    >
                      Cliente <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Localidade</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3 text-center">Projetos</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((item) => {
                  const count = projects.data.filter(
                    (project) => project.cliente === item.id,
                  ).length
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/clientes/${item.id}`)}
                      className="cursor-pointer hover:bg-[#FFF6EC]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#4B4B4B]">{item.razao_social}</p>
                          {item.origem === 'NFS-e' && (
                            <CrmBadge tone="orange" className="text-[10px] py-0 px-1.5">
                              NFS-e
                            </CrmBadge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[#8A8A8A]">
                          {item.segmento || 'Segmento não informado'}
                        </p>
                      </td>
                      <td className="mono-value px-5 py-4 text-sm">{item.cnpj_cpf || '—'}</td>
                      <td className="px-5 py-4 text-sm">
                        {item.municipio}
                        {item.uf ? ` / ${item.uf}` : ''}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#737373]">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {item.email || '—'}
                        </span>
                        <span className="mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {item.telefone || '—'}
                        </span>
                      </td>
                      <td className="mono-value px-5 py-4 text-center font-bold">{count}</td>
                      <td className="px-5 py-4">
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
