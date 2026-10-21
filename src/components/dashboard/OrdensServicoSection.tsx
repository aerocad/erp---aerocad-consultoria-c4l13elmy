import { memo } from 'react'
import { Link } from 'react-router-dom'
import { UserCheck } from 'lucide-react'
import { osStatusColors, osStatusLabels } from '@/lib/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import type { OrdemServicoRecord } from '@/types/crm'

interface OrdensServicoSectionProps {
  ordensServico: OrdemServicoRecord[]
  isAdmin: boolean
  loading?: boolean
}

export const OrdensServicoSection = memo(function OrdensServicoSection({
  ordensServico,
  isAdmin,
  loading = false,
}: OrdensServicoSectionProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const osPendentesAceite = ordensServico.filter((o) =>
    ['atribuida', 'emitida', 'rascunho'].includes(o.status),
  )
  const osEmExecucao = ordensServico.filter((o) => o.status === 'em_execucao')
  const osVencidas = ordensServico.filter((o) => {
    if (['concluida', 'cancelada', 'recusada'].includes(o.status)) return false
    if (!o.prazo) return false
    return new Date(o.prazo) < today
  })
  const totalCustoTerceiros = isAdmin
    ? ordensServico
        .filter((o) => o.status !== 'cancelada' && o.status !== 'recusada')
        .reduce((sum, o) => sum + (Number(o.valor_interno) || 0), 0)
    : 0

  return (
    <section className="crm-card overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <p className="technical-label flex items-center gap-1.5 text-[#FF6A13]">
            <UserCheck className="h-3.5 w-3.5" />
            PRESTADORES TERCEIRIZADOS
          </p>
          <h2 className="text-lg font-bold text-[#4B4B4B]">Ordens de Serviço em Campo</h2>
        </div>
        {isAdmin && (
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              Valores Confidenciais (Admin)
            </span>
            <p className="font-mono text-sm font-bold text-amber-900 mt-0.5">
              Total Alocado: {formatCurrency(totalCustoTerceiros)}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 border-b bg-neutral-50/50">
        <div className="p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
            Pendentes de Aceite
          </span>
          <p className="font-mono text-2xl font-bold text-blue-900 mt-1">
            {loading && !ordensServico.length ? '—' : osPendentesAceite.length}
          </p>
          <p className="text-xs text-[#737373] mt-0.5">Aguardando início do prestador</p>
        </div>
        <div className="p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Em Execução
          </span>
          <p className="font-mono text-2xl font-bold text-amber-900 mt-1">
            {loading && !ordensServico.length ? '—' : osEmExecucao.length}
          </p>
          <p className="text-xs text-[#737373] mt-0.5">Trabalhos em andamento</p>
        </div>
        <div className="p-4 text-center sm:text-left">
          <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
            Prazos Vencidos / Alerta
          </span>
          <p className="font-mono text-2xl font-bold text-rose-900 mt-1">
            {loading && !ordensServico.length ? '—' : osVencidas.length}
          </p>
          <p className="text-xs text-[#737373] mt-0.5">Requerem cobrança técnica</p>
        </div>
      </div>

      <div className="divide-y">
        {loading && !ordensServico.length ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : (
          ordensServico.slice(0, 6).map((os) => {
            const statusCfg = osStatusColors[os.status] || {
              bg: 'bg-neutral-100',
              text: 'text-neutral-700',
              border: 'border-neutral-200',
            }
            const prestadorDisplay =
              os.expand?.prestador_usuario?.name || os.prestador || 'Prestador não alocado'
            const isVencida =
              !['concluida', 'cancelada', 'recusada'].includes(os.status) &&
              os.prazo &&
              new Date(os.prazo) < today

            return (
              <div
                key={os.id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-[#FFF6EC]/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#D65100]">
                      {os.expand?.projeto?.numero || 'AEROCAD OS'}
                    </span>
                    <span className="text-sm font-semibold text-[#333]">
                      {os.titulo || os.descricao.slice(0, 60)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      {osStatusLabels[os.status] || os.status}
                    </span>
                    {isVencida && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Vencida
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-[#666]">
                    Prestador: <strong className="text-[#333]">{prestadorDisplay}</strong>
                    {os.expand?.projeto?.nome && ` · Projeto: ${os.expand.projeto.nome}`}
                    {os.prazo && ` · Prazo: ${formatDate(os.prazo)}`}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {isAdmin && os.valor_interno !== undefined && os.valor_interno !== null && (
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-amber-900">
                        {formatCurrency(os.valor_interno)}
                      </p>
                      <p className="text-[10px] text-amber-700 uppercase font-semibold">
                        Custo interno
                      </p>
                    </div>
                  )}
                  {os.projeto && (
                    <Link
                      to={`/projetos/${os.projeto}`}
                      className="text-xs font-semibold text-[#FF6A13] hover:underline"
                    >
                      Ver no projeto →
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
        {!loading && !ordensServico.length && (
          <p className="p-8 text-center text-sm text-[#8A8A8A]">
            Nenhuma ordem de serviço interna de terceiros cadastrada no momento.
          </p>
        )}
      </div>
    </section>
  )
})
