import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  LogOut,
  PlayCircle,
  RefreshCw,
  XCircle,
  AlertCircle,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'

import { AerocadLogo } from '@/components/common/AerocadLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { osStatusColors, osStatusLabels } from '@/lib/crm'
import { formatDate, initials } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import type { OrdemServicoRecord, OrdemServicoStatus } from '@/types/crm'

export default function TerceiroPortalPage() {
  const { user, logout } = useAuth()
  const [ordens, setOrdens] = useState<OrdemServicoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'todas' | 'pendentes' | 'concluidas'>('todas')
  const [selectedOS, setSelectedOS] = useState<OrdemServicoRecord | null>(null)
  const [modalAction, setModalAction] = useState<'execucao' | 'concluir' | 'recusar' | null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  const loadOrdens = async () => {
    setLoading(true)
    try {
      // Regras de RLS no backend já garantem que terceiro só lista as suas
      const records = await pb.collection<OrdemServicoRecord>('ordens_servico').getFullList({
        sort: '-created',
        expand: 'projeto',
        requestKey: null,
      })
      setOrdens(records)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar as ordens de serviço.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrdens()
  }, [])

  const handleUpdateStatus = async (
    os: OrdemServicoRecord,
    novoStatus: OrdemServicoStatus,
    observacaoAdicional?: string,
  ) => {
    setSaving(true)
    try {
      const payload: Partial<OrdemServicoRecord> = {
        status: novoStatus,
      }
      if (novoStatus === 'concluida') {
        payload.data_conclusao = new Date().toISOString()
      }
      if (observacaoAdicional && observacaoAdicional.trim()) {
        const timestamp = new Date().toLocaleString('pt-BR')
        const novaLinha = `<p><strong>[${timestamp} - ${user?.name || 'Prestador'}]:</strong> ${observacaoAdicional.trim()}</p>`
        payload.observacoes = (os.observacoes || '') + novaLinha
      }

      await pb.collection('ordens_servico').update(os.id, payload)
      toast.success(
        novoStatus === 'em_execucao'
          ? 'OS marcada como Em Execução!'
          : novoStatus === 'concluida'
            ? 'OS concluída com sucesso!'
            : novoStatus === 'recusada'
              ? 'OS marcada como Recusada.'
              : 'Status da OS atualizado.',
      )
      setModalAction(null)
      setSelectedOS(null)
      setNota('')
      void loadOrdens()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status da Ordem de Serviço.')
    } finally {
      setSaving(false)
    }
  }

  const filteredOrdens = ordens.filter((item) => {
    if (statusFilter === 'pendentes') {
      return ['atribuida', 'em_execucao', 'emitida', 'rascunho'].includes(item.status)
    }
    if (statusFilter === 'concluidas') {
      return item.status === 'concluida'
    }
    return true
  })

  const countPendentes = ordens.filter((o) =>
    ['atribuida', 'em_execucao', 'emitida', 'rascunho'].includes(o.status),
  ).length
  const countConcluidas = ordens.filter((o) => o.status === 'concluida').length

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#333]">
      {/* Topo minimalista institucional */}
      <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <AerocadLogo className="h-7 w-auto max-w-[170px] object-contain" />
            <div className="hidden border-l border-neutral-300 pl-3 sm:block">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF6A13]">
                Portal do Prestador
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border border-[#FF6A13]/20">
                <AvatarFallback className="bg-[#FFF0E5] text-xs font-bold text-[#FF6A13]">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-[#2D2D2D]">{user?.name}</p>
                <p className="text-[11px] text-[#737373]">Prestador Terceirizado</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-[#737373] hover:bg-neutral-100 hover:text-red-600"
              title="Encerrar sessão"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Banner de Boas-vindas */}
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="inline-block rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D65100]">
                Painel Restrito
              </span>
              <h1 className="mt-1 text-2xl font-bold text-[#222]">Ordens de Serviço Designadas</h1>
              <p className="mt-1 text-sm text-[#666]">
                Consulte as atividades técnicas atribuídas a você pela engenharia da AEROCAD,
                atualize o progresso de execução e envie apontamentos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadOrdens()}
              disabled={loading}
              className="self-start border-neutral-300 sm:self-auto"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Filtros em abas rápidas */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            <button
              onClick={() => setStatusFilter('todas')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'todas'
                  ? 'bg-[#FF6A13] text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Todas ({ordens.length})
            </button>
            <button
              onClick={() => setStatusFilter('pendentes')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'pendentes'
                  ? 'bg-[#FF6A13] text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Em aberto / Em andamento ({countPendentes})
            </button>
            <button
              onClick={() => setStatusFilter('concluidas')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'concluidas'
                  ? 'bg-[#FF6A13] text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Concluídas ({countConcluidas})
            </button>
          </div>
        </div>

        {/* Lista de Ordens de Serviço */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-[#FF6A13]" />
            <p className="mt-3 text-sm text-[#666]">Carregando suas ordens de serviço...</p>
          </div>
        ) : filteredOrdens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-neutral-300" />
            <h3 className="mt-3 text-base font-bold text-[#444]">
              Nenhuma Ordem de Serviço encontrada
            </h3>
            <p className="mt-1 text-xs text-[#777]">
              {statusFilter !== 'todas'
                ? 'Nenhuma OS neste filtro. Alterne para a aba "Todas".'
                : 'Você não possui ordens de serviço pendentes ou designadas no momento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrdens.map((os) => {
              const statusCfg = osStatusColors[os.status] || {
                bg: 'bg-neutral-100',
                text: 'text-neutral-700',
                border: 'border-neutral-200',
              }
              const isPendente = ['atribuida', 'emitida', 'rascunho'].includes(os.status)
              const isEmExecucao = os.status === 'em_execucao'
              const isConcluida = os.status === 'concluida'

              return (
                <Card
                  key={os.id}
                  className="overflow-hidden border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <CardHeader className="bg-neutral-50/50 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#D65100]">
                          {os.expand?.projeto?.numero || 'AEROCAD OS'}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {osStatusLabels[os.status] || os.status}
                        </span>
                      </div>
                      <CardTitle className="mt-1 text-base font-bold text-[#222]">
                        {os.titulo || os.descricao.slice(0, 70)}
                      </CardTitle>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs text-[#666] sm:mt-0">
                      {os.prazo && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-[#FF6A13]" />
                          <span>Prazo: {formatDate(os.prazo)}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    {/* Projeto Vinculado */}
                    {os.expand?.projeto && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-[#555]">
                        <Briefcase className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="font-semibold">Projeto associado:</span>
                        <span>
                          {os.expand.projeto.numero} — {os.expand.projeto.nome}
                        </span>
                      </div>
                    )}

                    {/* Escopo da OS */}
                    <div className="rounded-lg bg-neutral-50 p-3.5 text-xs leading-relaxed text-[#333]">
                      <p className="font-semibold text-neutral-500 uppercase text-[10px] tracking-wide mb-1">
                        Descrição do Escopo / Atividades:
                      </p>
                      <p className="whitespace-pre-line">{os.descricao}</p>
                    </div>

                    {/* Histórico / Observações se existirem */}
                    {os.observacoes && (
                      <div className="mt-3 rounded-lg border border-neutral-100 bg-[#FFFBF7] p-3 text-xs text-[#555]">
                        <p className="font-semibold text-[#FF6A13] text-[10px] uppercase mb-1">
                          Apontamentos & Histórico:
                        </p>
                        <div
                          className="prose prose-xs max-w-none"
                          dangerouslySetInnerHTML={{ __html: os.observacoes }}
                        />
                      </div>
                    )}

                    {/* Ações disponíveis para o terceiro */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                      <div className="text-[11px] text-[#888]">
                        Emitida em: {formatDate(os.created)}
                        {os.data_conclusao && ` · Concluída em: ${formatDate(os.data_conclusao)}`}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isPendente && (
                          <>
                            <Button
                              size="sm"
                              className="bg-[#FF6A13] font-semibold text-white hover:bg-[#E85B06]"
                              onClick={() => {
                                setSelectedOS(os)
                                setModalAction('execucao')
                              }}
                            >
                              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                              Iniciar Execução
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-neutral-600 hover:text-red-600 hover:border-red-200"
                              onClick={() => {
                                setSelectedOS(os)
                                setModalAction('recusar')
                              }}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Recusar OS
                            </Button>
                          </>
                        )}

                        {isEmExecucao && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                              onClick={() => {
                                setSelectedOS(os)
                                setModalAction('concluir')
                              }}
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Marcar como Concluída
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedOS(os)
                                setModalAction('execucao')
                              }}
                            >
                              Adicionar Apontamento
                            </Button>
                          </>
                        )}

                        {isConcluida && (
                          <span className="flex items-center text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Entrega Concluída
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal de Ação / Confirmação */}
      <Dialog
        open={Boolean(selectedOS && modalAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOS(null)
            setModalAction(null)
            setNota('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalAction === 'execucao' && 'Iniciar / Atualizar Execução'}
              {modalAction === 'concluir' && 'Concluir Ordem de Serviço'}
              {modalAction === 'recusar' && 'Recusar Ordem de Serviço'}
            </DialogTitle>
            <DialogDescription>
              {modalAction === 'execucao' &&
                'A OS será marcada como "Em execução", informando aos coordenadores da AEROCAD que você iniciou o trabalho.'}
              {modalAction === 'concluir' &&
                'A OS será marcada como "Concluída". Insira observações sobre os arquivos entregues ou links, se houver.'}
              {modalAction === 'recusar' &&
                'Por favor, justifique o motivo da recusa desta Ordem de Serviço para a equipe AEROCAD.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs font-semibold text-[#555]">
              OS: {selectedOS?.titulo || selectedOS?.expand?.projeto?.numero || selectedOS?.id}
            </p>
            <div>
              <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
                {modalAction === 'recusar'
                  ? 'Justificativa da Recusa *'
                  : 'Apontamento / Mensagem (Opcional)'}
              </label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder={
                  modalAction === 'recusar'
                    ? 'Explique o motivo (prazo exíguo, indisponibilidade técnica, etc.)...'
                    : 'Ex.: Desenhos técnicos finalizados e enviados ao coordenador por link...'
                }
                className="mt-1 min-h-[90px] text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setSelectedOS(null)
                setModalAction(null)
                setNota('')
              }}
            >
              Cancelar
            </Button>
            {modalAction === 'execucao' && (
              <Button
                disabled={saving}
                className="bg-[#FF6A13] text-white hover:bg-[#E85B06]"
                onClick={() => {
                  if (selectedOS) {
                    void handleUpdateStatus(selectedOS, 'em_execucao', nota)
                  }
                }}
              >
                {saving ? 'Gravando...' : 'Confirmar Início'}
              </Button>
            )}
            {modalAction === 'concluir' && (
              <Button
                disabled={saving}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  if (selectedOS) {
                    void handleUpdateStatus(selectedOS, 'concluida', nota)
                  }
                }}
              >
                {saving ? 'Gravando...' : 'Confirmar Conclusão'}
              </Button>
            )}
            {modalAction === 'recusar' && (
              <Button
                disabled={saving || !nota.trim()}
                variant="destructive"
                onClick={() => {
                  if (selectedOS) {
                    void handleUpdateStatus(selectedOS, 'recusada', nota)
                  }
                }}
              >
                {saving ? 'Gravando...' : 'Recusar OS'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
