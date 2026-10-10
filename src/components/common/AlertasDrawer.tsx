import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Filter,
  Info,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { dispensarAlerta, reabrirAlertaDispensado } from '@/services/alertas'
import type { AlertaDispensadoRecord, AlertaItem, AlertaSeveridade, AlertaTipo } from '@/types/crm'

interface AlertasDrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  alertas: AlertaItem[]
  dispensados: AlertaDispensadoRecord[]
  onReload: () => void
  trigger?: React.ReactNode
}

export function AlertasDrawer({
  open,
  onOpenChange,
  alertas,
  dispensados,
  onReload,
  trigger,
}: AlertasDrawerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<'ativos' | 'dispensados'>('ativos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [dispensandoId, setDispensandoId] = useState<string | null>(null)

  const handleDispensar = async (alerta: AlertaItem) => {
    if (!user?.id) return
    try {
      setDispensandoId(alerta.chave)
      await dispensarAlerta(alerta, user.id)
      toast({
        title: 'Alerta dispensado',
        description: 'Ele não aparecerá mais, exceto se a severidade piorar.',
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

  const handleReabrir = async (chaveUnica: string) => {
    if (!user?.id) return
    try {
      setDispensandoId(chaveUnica)
      await reabrirAlertaDispensado(chaveUnica, user.id)
      toast({
        title: 'Alerta reaberto',
        description: 'O alerta voltou para a lista de alertas ativos.',
      })
      onReload()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao reabrir',
        description: 'Não foi possível remover o status de dispensa.',
      })
    } finally {
      setDispensandoId(null)
    }
  }

  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set(alertas.map((a) => a.tipo))
    return Array.from(tipos)
  }, [alertas])

  const alertasFiltrados = useMemo(() => {
    return alertas.filter((a) => {
      if (filtroCategoria !== 'todos' && a.categoria !== filtroCategoria) return false
      if (filtroSeveridade !== 'todos' && a.severidade !== filtroSeveridade) return false
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false
      return true
    })
  }, [alertas, filtroCategoria, filtroSeveridade, filtroTipo])

  const contagemCriticos = alertas.filter((a) => a.severidade === 'critico').length
  const contagemAtencao = alertas.filter((a) => a.severidade === 'atencao').length
  const contagemInfo = alertas.filter((a) => a.severidade === 'informativo').length

  const getTipoLabel = (tipo: AlertaTipo | string) => {
    switch (tipo) {
      case 'proposta_sem_retorno':
        return 'Proposta sem retorno'
      case 'proposta_expirada':
        return 'Proposta expirada'
      case 'exigencia_prazo':
        return 'Exigência de prazo'
      case 'exigencia_sem_envio':
        return 'Exigência não protocolada'
      case 'parcela_vencida':
        return 'Parcela vencida'
      case 'os_sem_resposta':
        return 'OS sem aceite'
      case 'os_prazo':
        return 'Prazo de OS de terceiro'
      case 'os_pendente_validacao':
        return 'OS pendente validação'
      case 'processo_orgao_sem_parecer':
        return 'Acompanhamento de Órgão'
      case 'projeto_sem_movimentacao':
        return 'Projeto sem movimentação'
      default:
        return tipo
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl bg-[#FBFBFB]">
        <SheetHeader className="border-b bg-white p-5 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="technical-label">CONTROLE OPERACIONAL</p>
              <SheetTitle className="text-xl font-bold text-[#333]">
                Central de Alertas por Prazo
              </SheetTitle>
            </div>
          </div>
          <SheetDescription className="mt-1 text-xs text-[#737373]">
            Monitoramento de propostas sem retorno, exigências de órgãos, OS de terceiros e parcelas
            em atraso.
          </SheetDescription>

          <div className="mt-4 flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              {contagemCriticos} Crítico(s)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {contagemAtencao} Atenção
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <span className="h-2 w-2 rounded-full bg-neutral-500" />
              {contagemInfo} Informativo
            </span>
          </div>
        </SheetHeader>

        {/* Abas e Filtros */}
        <div className="border-b bg-white px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'ativos' | 'dispensados')}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ativos" className="text-xs">
                  Ativos ({alertas.length})
                </TabsTrigger>
                <TabsTrigger value="dispensados" className="text-xs">
                  Dispensados ({dispensados.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {tab === 'ativos' && (
              <div className="flex flex-wrap items-center gap-2">
                {user?.role === 'admin' && (
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="h-8 text-xs w-[120px] bg-neutral-50">
                      <SelectValue placeholder="Área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas áreas</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="tecnico">Técnico</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
                  <SelectTrigger className="h-8 text-xs w-[130px] bg-neutral-50">
                    <SlidersHorizontal className="mr-1.5 h-3 w-3 text-[#737373]" />
                    <SelectValue placeholder="Severidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas severidades</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="atencao">Atenção</SelectItem>
                    <SelectItem value="informativo">Informativo</SelectItem>
                  </SelectContent>
                </Select>

                {tiposDisponiveis.length > 1 && (
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-8 text-xs w-[160px] bg-neutral-50">
                      <Filter className="mr-1.5 h-3 w-3 text-[#737373]" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {tiposDisponiveis.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {getTipoLabel(tipo)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo / Lista de Alertas */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'ativos' ? (
            alertasFiltrados.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#dedede] bg-white p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#424242]">Nenhum alerta pendente</h3>
                <p className="mt-1 max-w-sm text-xs text-[#737373]">
                  {filtroSeveridade !== 'todos' || filtroTipo !== 'todos'
                    ? 'Nenhum alerta corresponde aos filtros aplicados.'
                    : 'Todas as propostas, prazos de exigências, OS e parcelas estão em dia para o seu perfil.'}
                </p>
                {(filtroSeveridade !== 'todos' ||
                  filtroTipo !== 'todos' ||
                  filtroCategoria !== 'todos') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs"
                    onClick={() => {
                      setFiltroCategoria('todos')
                      setFiltroSeveridade('todos')
                      setFiltroTipo('todos')
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {alertasFiltrados.map((alerta) => {
                  const isCritico = alerta.severidade === 'critico'
                  const isAtencao = alerta.severidade === 'atencao'

                  const corBorda = isCritico
                    ? 'border-l-4 border-l-red-600 border-red-200 bg-red-50/20'
                    : isAtencao
                      ? 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/20'
                      : 'border-l-4 border-l-blue-400 border-neutral-200 bg-white'

                  const corBadge = isCritico
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : isAtencao
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200'

                  const Icone = isCritico ? AlertTriangle : isAtencao ? AlertCircle : Info

                  return (
                    <div
                      key={alerta.chave}
                      className={`crm-card p-4 transition-all hover:shadow-md ${corBorda}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isCritico ? 'bg-red-100 text-red-600' : isAtencao ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-600'}`}
                          >
                            <Icone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${corBadge}`}
                              >
                                {alerta.severidade}
                              </span>
                              <span className="text-[11px] font-semibold text-[#8A8A8A]">
                                {getTipoLabel(alerta.tipo)}
                              </span>
                            </div>
                            <h4 className="mt-1 text-sm font-bold text-[#333] leading-snug">
                              {alerta.titulo}
                            </h4>
                          </div>
                        </div>

                        {/* Botão de Dispensar (Snooze) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 text-xs text-[#737373] hover:text-[#333]"
                          disabled={dispensandoId === alerta.chave}
                          onClick={() => handleDispensar(alerta)}
                          title="Dispensar alerta (snooze até piorar severidade)"
                        >
                          <EyeOff className="mr-1 h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Dispensar</span>
                        </Button>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-[#595959] pl-9">
                        {alerta.descricao}
                      </p>

                      <div className="mt-3 flex items-center justify-between border-t border-[#F0F0F0] pt-2.5 pl-9">
                        <span className="text-[11px] text-[#8A8A8A]">
                          Área: <strong className="capitalize">{alerta.categoria}</strong>
                        </span>

                        <Link
                          to={alerta.link}
                          className="inline-flex items-center text-xs font-bold text-[#FF6A13] hover:underline hover:text-[#E85B06]"
                          onClick={() => onOpenChange?.(false)}
                        >
                          {alerta.linkTexto}
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : dispensados.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#dedede] bg-white p-6 text-center">
              <EyeOff className="h-8 w-8 text-[#8A8A8A]" />
              <h3 className="mt-3 text-sm font-bold text-[#424242]">Nenhum alerta dispensado</h3>
              <p className="mt-1 max-w-sm text-xs text-[#737373]">
                Quando você dispensa um alerta, ele é listado aqui e só reaparece se a severidade se
                agravar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dispensados.map((disp) => (
                <div
                  key={disp.id}
                  className="crm-card flex items-center justify-between gap-3 p-4 bg-neutral-50/70 border-neutral-200"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#555]">
                        {disp.chave_unica}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        Severidade dispensada: {disp.severidade_dispensada}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#737373]">
                      Dispensado em{' '}
                      {disp.data_dispensa
                        ? new Date(disp.data_dispensa).toLocaleDateString('pt-BR')
                        : 'data não registrada'}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0 text-[#FF6A13] border-[#FFD2B3] hover:bg-orange-50"
                    disabled={dispensandoId === disp.chave_unica}
                    onClick={() => handleReabrir(disp.chave_unica)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Reabrir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
