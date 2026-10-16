import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CrmBadge } from '@/components/common/CrmBadge'
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ProcessDialog } from '@/components/forms/ProcessDialog'
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
import { processOrgaoList, processStatusLabels } from '@/lib/crm'
import { formatDate } from '@/lib/format'
import type { ProcessoRecord } from '@/types/crm'

const SUGESTOES_PROCESSOS = [
  'Quais exigências regulatórias estão pendentes ou com prazo crítico?',
  'Quais processos estão em análise no DECEA / CINDACTA?',
  'Quais processos tiveram parecer favorável ou deferimento recente?',
  'Quantos processos estão pendentes de protocolo nos órgãos?',
]

export default function ProcessesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const records = useCrmData<ProcessoRecord>('processos', {
    expand: 'projeto,projeto.cliente',
    sort: '-created',
    realtime: true,
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [orgao, setOrgao] = useState('todos')
  const [dialog, setDialog] = useState(params.get('novo') === '1')
  useEffect(() => {
    if (params.get('novo') === '1') setDialog(true)
  }, [params])
  const canWrite = ['admin', 'comercial', 'tecnico'].includes(user?.role || '')
  const rows = useMemo(
    () =>
      records.data.filter(
        (item) =>
          (status === 'todos' || item.status === status) &&
          (orgao === 'todos' || item.orgao === orgao) &&
          (!query ||
            `${item.numero_protocolo} ${item.expand?.projeto?.numero} ${item.expand?.projeto?.nome}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [records.data, status, orgao, query],
  )
  if (records.loading) return <PageLoading />
  if (records.error) return <ErrorState onRetry={() => void records.reload()} />
  return (
    <div>
      <SectionHeader
        eyebrow="REGULATÓRIO"
        title="Processos"
        description="Prazos dos órgãos, pareceres e exigências em trilha auditável."
        actions={
          <Button
            disabled={!canWrite}
            onClick={() => setDialog(true)}
            className="bg-[#FF6A13] hover:bg-[#E85B06]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo processo
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#9A9A9A]" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar protocolo ou projeto"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(processStatusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orgao} onValueChange={setOrgao}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os órgãos</SelectItem>
            {processOrgaoList.map((org) => (
              <SelectItem key={org} value={org}>
                {org}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!rows.length ? (
        <EmptyState
          title="Nenhum processo encontrado"
          description="Cadastre um processo regulatório ou ajuste os filtros."
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead className="border-b bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wider text-[#737373]">
                <tr>
                  <th className="px-5 py-3">Protocolo</th>
                  <th className="px-5 py-3">Projeto</th>
                  <th className="px-5 py-3">Órgão</th>
                  <th className="px-5 py-3">Protocolo em</th>
                  <th className="px-5 py-3">Prazo do órgão</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/processos/${item.id}`)}
                    className="cursor-pointer hover:bg-[#FFF6EC]"
                  >
                    <td className="mono-value px-5 py-4 font-bold">
                      {item.numero_protocolo || 'A protocolar'}
                    </td>
                    <td className="px-5 py-4">
                      <p className="mono-value text-xs text-[#D65100]">
                        {item.expand?.projeto?.numero}
                      </p>
                      <p className="text-sm font-semibold">{item.expand?.projeto?.nome}</p>
                    </td>
                    <td className="px-5 py-4 text-sm">{item.orgao}</td>
                    <td className="mono-value px-5 py-4 text-sm">
                      {formatDate(item.data_protocolo)}
                    </td>
                    <td className="mono-value px-5 py-4 text-sm">{formatDate(item.prazo_orgao)}</td>
                    <td className="px-5 py-4">
                      <CrmBadge
                        tone={
                          item.status === 'deferido'
                            ? 'green'
                            : item.status === 'em_exigencia' || item.status === 'em_analise'
                              ? 'amber'
                              : item.status === 'indeferido'
                                ? 'red'
                                : 'gray'
                        }
                      >
                        {processStatusLabels[item.status]}
                      </CrmBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {rows.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/processos/${item.id}`)}
                className="w-full p-4 text-left"
              >
                <div className="flex justify-between gap-3">
                  <p className="mono-value font-bold">{item.numero_protocolo || 'A protocolar'}</p>
                  <CrmBadge tone="gray">{processStatusLabels[item.status]}</CrmBadge>
                </div>
                <p className="mt-2 text-sm">
                  {item.expand?.projeto?.numero} · {item.expand?.projeto?.nome}
                </p>
                <p className="mt-2 text-xs text-[#737373]">
                  {item.orgao} · prazo {formatDate(item.prazo_orgao)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
      <ProcessDialog
        open={dialog}
        onOpenChange={(value) => {
          setDialog(value)
          if (!value && params.has('novo')) {
            params.delete('novo')
            setParams(params, { replace: true })
          }
        }}
        onSaved={(record) => navigate(`/processos/${record.id}`)}
      />

      {/* Assistente de IA Nativo da Seção Processos */}
      <AssistenteSecaoDrawer
        agentSlug="assistente-processos"
        titulo="Assistente de Processos"
        subtitulo="Regulação, protocolos nos órgãos, exigências e prazos"
        secaoNome="Processos Regulatórios"
        areaPermissao="processos"
        sugestoes={SUGESTOES_PROCESSOS}
        placeholder="Pergunte sobre protocolos, DECEA, ANAC, prazos ou exigências..."
        descricaoModo="consulta processos regulatórios e exigências em tempo real."
        floatingButtonLabel="Assistente de Processos"
      />
    </div>
  )
}
