import { useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  Info,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { AlertasDrawer } from '@/components/common/AlertasDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { dispensarAlerta } from '@/services/alertas'
import type { AlertaDispensadoRecord, AlertaItem } from '@/types/crm'

interface AlertasWidgetProps {
  alertas: AlertaItem[]
  dispensados: AlertaDispensadoRecord[]
  onReload: () => void
  loading?: boolean
}

export function AlertasWidget({
  alertas,
  dispensados,
  onReload,
  loading = false,
}: AlertasWidgetProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dispensandoId, setDispensandoId] = useState<string | null>(null)
  const [filtroTab, setFiltroTab] = useState<'todos' | 'critico' | 'atencao' | 'informativo'>(
    'todos',
  )

  const criticos = alertas.filter((a) => a.severidade === 'critico')
  const atencao = alertas.filter((a) => a.severidade === 'atencao')
  const informativos = alertas.filter((a) => a.severidade === 'informativo')

  const totalAtencaoCriticos = criticos.length + atencao.length

  const handleDispensar = async (alerta: AlertaItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) return
    try {
      setDispensandoId(alerta.chave)
      await dispensarAlerta(alerta, user.id)
      toast({
        title: 'Alerta dispensado',
        description: 'Ele não aparecerá mais, a menos que a severidade piore.',
      })
      onReload()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao dispensar',
        description: 'Não foi possível salvar o estado do alerta.',
      })
    } finally {
      setDispensandoId(null)
    }
  }

  const alertasExibidos = (
    filtroTab === 'todos' ? alertas : alertas.filter((a) => a.severidade === filtroTab)
  ).slice(0, 6)

  return (
    <section className="crm-card overflow-hidden border-[#FF6A13]/25 bg-gradient-to-b from-[#FFFDFB] to-white shadow-sm">
      {/* Header do Widget */}
      <div className="flex flex-col justify-between gap-3 border-b border-[#F0E4D8] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#FF6A13] animate-pulse" />
            <p className="technical-label text-[#D65100]">MOTOR OPERACIONAL · PRAZOS</p>
          </div>
          <div className="flex items-center gap-2.5 mt-0.5">
            <h2 className="text-lg font-bold text-[#333]">Alertas por Prazo</h2>
            {totalAtencaoCriticos > 0 ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {totalAtencaoCriticos} pendência(s)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Prazos em dia
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor Rápido de Abas de Severidade */}
          <div className="flex items-center rounded-lg border bg-[#F9F9F9] p-0.5 text-xs font-medium">
            <button
              onClick={() => setFiltroTab('todos')}
              className={`rounded-md px-2.5 py-1 transition ${filtroTab === 'todos' ? 'bg-white font-bold text-[#333] shadow-xs' : 'text-[#737373] hover:text-[#333]'}`}
            >
              Todos ({alertas.length})
            </button>
            <button
              onClick={() => setFiltroTab('critico')}
              className={`rounded-md px-2.5 py-1 transition ${filtroTab === 'critico' ? 'bg-red-50 font-bold text-red-700 shadow-xs' : 'text-[#737373] hover:text-red-700'}`}
            >
              Crítico ({criticos.length})
            </button>
            <button
              onClick={() => setFiltroTab('atencao')}
              className={`rounded-md px-2.5 py-1 transition ${filtroTab === 'atencao' ? 'bg-amber-50 font-bold text-amber-800 shadow-xs' : 'text-[#737373] hover:text-amber-800'}`}
            >
              Atenção ({atencao.length})
            </button>
            <button
              onClick={() => setFiltroTab('informativo')}
              className={`rounded-md px-2.5 py-1 transition ${filtroTab === 'informativo' ? 'bg-neutral-200 font-bold text-neutral-800 shadow-xs' : 'text-[#737373] hover:text-[#333]'}`}
            >
              Info ({informativos.length})
            </button>
          </div>

          {/* Botão de Ver Todos / Drawer */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="border-[#FFD2B3] text-[#D65100] hover:bg-[#FFF6EC] hover:text-[#FF6A13]"
          >
            Ver todos <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Conteúdo dos Alertas */}
      <div className="divide-y divide-[#F2ECE4]">
        {alertasExibidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#424242]">
              {filtroTab === 'todos'
                ? 'Nenhum alerta pendente no momento!'
                : `Nenhum alerta com severidade "${filtroTab}".`}
            </p>
            <p className="mt-0.5 text-xs text-[#8A8A8A]">
              O motor de prazos está monitorando propostas, exigências, OS e parcelas ativas.
            </p>
          </div>
        ) : (
          alertasExibidos.map((alerta) => {
            const isCritico = alerta.severidade === 'critico'
            const isAtencao = alerta.severidade === 'atencao'
            const Icone = isCritico ? AlertTriangle : isAtencao ? AlertCircle : Info

            return (
              <div
                key={alerta.chave}
                className="group flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-[#FFF9F3] sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      isCritico
                        ? 'bg-red-100 text-red-600'
                        : isAtencao
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <Icone className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isCritico
                            ? 'bg-red-100 text-red-700'
                            : isAtencao
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {alerta.severidade}
                      </span>
                      <span className="text-[11px] font-medium text-[#737373]">
                        {alerta.categoria.toUpperCase()}
                      </span>
                    </div>

                    <h4 className="mt-1 text-sm font-bold text-[#333] leading-snug">
                      {alerta.titulo}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#666] line-clamp-2">{alerta.descricao}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2ECE4]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[#8A8A8A] hover:text-[#333]"
                    disabled={dispensandoId === alerta.chave}
                    onClick={(e) => handleDispensar(alerta, e)}
                    title="Dispensar alerta até que a severidade aumente"
                  >
                    <EyeOff className="mr-1 h-3.5 w-3.5" />
                    Dispensar
                  </Button>

                  <Link
                    to={alerta.link}
                    className="inline-flex items-center rounded-md bg-[#FFF0E5] px-3 py-1.5 text-xs font-bold text-[#D65100] transition hover:bg-[#FFE0CC]"
                  >
                    {alerta.linkTexto}
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Rodapé do Widget com Drawer acoplado */}
      {alertas.length > 6 && (
        <div className="border-t border-[#F0E4D8] bg-[#FFFBF8] px-5 py-3 text-center sm:text-right">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xs font-bold text-[#FF6A13] hover:underline"
          >
            Existem mais {alertas.length - 6} alerta(s) ativos na fila. Abrir Central Completa →
          </button>
        </div>
      )}

      {/* Drawer Completo de Alertas */}
      <AlertasDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        alertas={alertas}
        dispensados={dispensados}
        onReload={onReload}
      />
    </section>
  )
}
