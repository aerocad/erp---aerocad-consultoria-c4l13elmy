import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CrmBadge } from '@/components/common/CrmBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import type { NfseDadoExtraido } from '@/services/nfseParser'
import type { ParcelaRecord } from '@/types/crm'
import {
  detectarGruposDuplicadas,
  excluirDuplicadasViaBackend,
  type GrupoNotasDuplicadas,
  type ItemNotaDuplicada,
} from '@/services/nfseDuplicadasService'
import {
  CopyX,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
  Trash2,
  ShieldAlert,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Hash,
} from 'lucide-react'

export interface ExcluirDuplicadasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notasOrfas?: NfseDadoExtraido[]
  parcelas?: ParcelaRecord[]
  onExcluirDuplicadas?: (idsParaExcluir: string[]) => void
  onSucessoExclusao?: () => void
}

export function ExcluirDuplicadasModal({
  open,
  onOpenChange,
  notasOrfas = [],
  parcelas = [],
  onExcluirDuplicadas,
  onSucessoExclusao,
}: ExcluirDuplicadasModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  // Verificação de perfil de administrador (Cleyton ou role admin)
  const isAdmin =
    user?.role === 'admin' ||
    (Array.isArray((user as any)?.roles) && (user as any).roles.includes('admin'))

  // 1. Detectar grupos de notas duplicadas (combinando parcelas do banco e órfãs)
  const resumo = useMemo(() => {
    return detectarGruposDuplicadas(parcelas, notasOrfas)
  }, [parcelas, notasOrfas])

  const grupos = resumo.grupos

  // 2. Estado de qual nota manter por grupo (por padrão, a primeira sugerida)
  const [mantidasPorGrupo, setMantidasPorGrupo] = useState<Record<string, string>>({})

  // 3. Ids selecionados para exclusão
  const [idsParaExcluir, setIdsParaExcluir] = useState<Set<string>>(new Set())

  // Modal secundário de confirmação com resumo e aviso de vínculos
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false)
  const [executandoExclusao, setExecutandoExclusao] = useState(false)

  // Inicializa a seleção padrão quando os grupos mudam
  useEffect(() => {
    const mapaMantidas: Record<string, string> = {}
    const selecionadas = new Set<string>()

    for (const g of grupos) {
      const mantidaId = mantidasPorGrupo[g.chave] || g.notas[0]?.id || ''
      mapaMantidas[g.chave] = mantidaId

      for (const n of g.notas) {
        if (n.id !== mantidaId) {
          selecionadas.add(n.id)
        }
      }
    }

    setMantidasPorGrupo(mapaMantidas)
    setIdsParaExcluir(selecionadas)
  }, [grupos])

  // Trocar qual nota deve ser mantida
  const handleDefinirMantida = (grupoChave: string, notaId: string) => {
    setMantidasPorGrupo((prev) => ({
      ...prev,
      [grupoChave]: notaId,
    }))

    setIdsParaExcluir((prev) => {
      const next = new Set(prev)
      next.delete(notaId) // A mantida não pode ser excluída

      const g = grupos.find((item) => item.chave === grupoChave)
      if (g) {
        for (const n of g.notas) {
          if (n.id !== notaId) {
            next.add(n.id)
          }
        }
      }
      return next
    })
  }

  // Alternar checkbox individual de exclusão de uma cópia
  const toggleSelecao = (notaId: string, grupoChave: string) => {
    const mantidaId = mantidasPorGrupo[grupoChave]
    if (notaId === mantidaId) {
      toast({
        title: 'Instância mantida',
        description:
          'Esta nota está definida como o registro a ser mantido. Defina outra nota do grupo como mantida antes de excluí-la.',
      })
      return
    }

    setIdsParaExcluir((prev) => {
      const next = new Set(prev)
      if (next.has(notaId)) {
        next.delete(notaId)
      } else {
        next.add(notaId)
      }
      return next
    })
  }

  // Marcar todas as duplicatas recomendadas
  const selecionarTodasRecomendadas = () => {
    const next = new Set<string>()
    for (const g of grupos) {
      const mantidaId = mantidasPorGrupo[g.chave] || g.notas[0]?.id
      for (const n of g.notas) {
        if (n.id !== mantidaId) {
          next.add(n.id)
        }
      }
    }
    setIdsParaExcluir(next)
  }

  // Desmarcar todas
  const desmarcarTodas = () => {
    setIdsParaExcluir(new Set())
  }

  // Dados calculados para o resumo da exclusão
  const notasMarcadasInfo = useMemo(() => {
    const todasNotas = grupos.flatMap((g) => g.notas)
    const marcadas = todasNotas.filter((n) => idsParaExcluir.has(n.id))
    const totalValor = marcadas.reduce((acc, n) => acc + (n.valor || 0), 0)
    const comGatilhoContratual = marcadas.filter((n) => n.isGatilho).length
    const comRecebimento = marcadas.filter((n) => n.status === 'paga' || n.valorRecebido).length
    const emContasReceber = marcadas.filter((n) => n.origem === 'parcela').length

    return {
      marcadas,
      totalValor,
      comGatilhoContratual,
      comRecebimento,
      emContasReceber,
    }
  }, [grupos, idsParaExcluir])

  // Executar exclusão definitiva
  const executarExclusaoConfirmada = async () => {
    if (!isAdmin) {
      toast({
        title: 'Ação restrita a administradores',
        description:
          'Somente o administrador Cleyton pode autorizar a exclusão fiscal de duplicatas.',
        variant: 'destructive',
      })
      return
    }

    const listaIds = Array.from(idsParaExcluir)
    if (listaIds.length === 0) return

    setExecutandoExclusao(true)
    try {
      // 1. Separar IDs de banco das IDs temporárias em memória
      const idsBanco = listaIds.filter((id) => !id.startsWith('orfa_') && !id.startsWith('temp_'))
      const idsOrfas = listaIds.filter((id) => id.startsWith('orfa_') || id.startsWith('temp_'))

      let totalApagadas = 0

      // Se houver parcelas no banco, chama a exclusão segura com auditoria
      if (idsBanco.length > 0) {
        const res = await excluirDuplicadasViaBackend(
          idsBanco,
          '',
          `Deduplicação de ${idsBanco.length} nota(s) em duplicidade realizada por ${user?.name || 'Administrador'}.`,
        )
        totalApagadas += res.total_excluidas
      }

      // Se houver órfãs em sessão na memória do front, notifica callback do pai
      if (idsOrfas.length > 0 && onExcluirDuplicadas) {
        onExcluirDuplicadas(idsOrfas)
        totalApagadas += idsOrfas.length
      } else if (idsBanco.length > 0 && onExcluirDuplicadas) {
        onExcluirDuplicadas(idsBanco)
      }

      toast({
        title: 'Notas duplicadas saneadas com sucesso',
        description: `${totalApagadas} registro(s) duplicado(s) removido(s). Integridade do contas a receber e auditoria registradas.`,
      })

      setConfirmacaoAberta(false)
      onOpenChange(false)
      if (onSucessoExclusao) {
        onSucessoExclusao()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Falha ao excluir duplicatas',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setExecutandoExclusao(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-6 font-sans">
          {/* Cabeçalho AEROCAD */}
          <DialogHeader>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13]">
                  <CopyX className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-[#1F1F1F]">
                    Localizar, Listar e Apagar Notas Fiscais em Duplicidade
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#737373]">
                    Compara notas por identidade fiscal (NFS-e + CNPJ prestador/tomador + valor +
                    emissão) para sanear o faturamento e contas a receber.
                  </DialogDescription>
                </div>
              </div>

              {isAdmin ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Admin: {user?.name || 'Cleyton'}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Modo Consulta (Exclusão restrita ao Admin)
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Conteúdo Principal */}
          {grupos.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-[#1F1F1F]">Nenhuma duplicidade detectada</h3>
              <p className="text-sm text-[#737373] max-w-lg mx-auto">
                Todas as notas fiscais no sistema possuem chaves e números únicos. As receitas e
                parcelas a receber estão consolidadas e sem registros duplicados.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mt-3">
              {/* Alerta Resumo */}
              <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-3.5 text-xs text-orange-950 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-[#FF6A13] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-[#D65100]">
                      {resumo.totalDuplicatas}{' '}
                      {resumo.totalDuplicatas === 1
                        ? 'nota duplicada detectada'
                        : 'notas duplicadas detectadas'}{' '}
                      em {resumo.totalGrupos} {resumo.totalGrupos === 1 ? 'grupo' : 'grupos'}.
                    </p>
                    <p className="text-neutral-700">
                      Impacto financeiro potencial de duplicidade inflada:{' '}
                      <strong className="font-mono text-[#D65100]">
                        {formatCurrency(resumo.valorTotalDuplicado)}
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selecionarTodasRecomendadas}
                      className="text-xs text-[#FF6A13] hover:underline font-bold"
                    >
                      Selecionar recomendadas
                    </button>
                    <span className="text-neutral-300">|</span>
                    <button
                      type="button"
                      onClick={desmarcarTodas}
                      className="text-xs text-neutral-600 hover:underline"
                    >
                      Desmarcar todas
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {idsParaExcluir.size} nota(s) selecionada(s) para remoção
                  </p>
                </div>
              </div>

              {/* Lista de Grupos de Duplicadas */}
              <div className="space-y-5">
                {grupos.map((grupo, gIdx) => {
                  const mantidaId = mantidasPorGrupo[grupo.chave] || grupo.notas[0]?.id

                  return (
                    <div
                      key={grupo.chave}
                      className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden"
                    >
                      {/* Topo do Grupo */}
                      <div className="bg-neutral-100/80 px-4 py-2.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#FF6A13] text-white text-[11px] font-bold">
                            {gIdx + 1}
                          </span>
                          <span className="font-mono font-bold text-sm text-[#FF6A13]">
                            NFS-e nº {grupo.numeroNf}
                          </span>
                          <span className="text-xs text-neutral-600">
                            • {grupo.tomadorRazaoOuDoc}
                          </span>
                          <span className="text-xs font-semibold text-neutral-500">
                            ({grupo.totalNotas} instâncias encontradas)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-neutral-500">
                            Duplicidade inflada:{' '}
                            <strong className="font-mono text-rose-600">
                              +{formatCurrency(grupo.valorTotalDuplicado)}
                            </strong>
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400 bg-white px-2 py-0.5 rounded border border-neutral-200">
                            ID Fiscal: {grupo.chave}
                          </span>
                        </div>
                      </div>

                      {/* Comparação Lado a Lado dos Registros do Grupo */}
                      <div className="p-3 bg-neutral-50/50">
                        <p className="text-[11px] text-neutral-500 mb-2 font-medium">
                          Comparação detalhada lado a lado — escolha qual registro preservar e quais
                          apagar:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {grupo.notas.map((nota) => {
                            const isMantida = nota.id === mantidaId
                            const isMarcadaExclusao = idsParaExcluir.has(nota.id)

                            return (
                              <div
                                key={nota.id}
                                className={`rounded-lg border p-3 flex flex-col justify-between transition-all ${
                                  isMantida
                                    ? 'bg-emerald-50/60 border-emerald-400 ring-1 ring-emerald-300'
                                    : isMarcadaExclusao
                                      ? 'bg-rose-50/40 border-rose-300'
                                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                                }`}
                              >
                                <div className="space-y-2">
                                  {/* Badge de status da decisão */}
                                  <div className="flex items-center justify-between gap-1">
                                    {isMantida ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                        <Sparkles className="h-3 w-3" />
                                        ORIGINAL MANTIDA
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                        <CopyX className="h-3 w-3" />
                                        DUPLICATA EXCEDENTE
                                      </span>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                      <Checkbox
                                        id={`check-${nota.id}`}
                                        checked={isMarcadaExclusao}
                                        disabled={isMantida}
                                        onCheckedChange={() => toggleSelecao(nota.id, grupo.chave)}
                                        aria-label={`Apagar nota ${nota.numero}`}
                                      />
                                      <span className="text-[10px] text-neutral-500 font-medium">
                                        {isMantida ? 'Preservar' : 'Apagar'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Valor e Data */}
                                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                                    <div className="space-y-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wide">
                                        Valor da Nota
                                      </span>
                                      <p className="mono-value font-bold text-sm text-[#1F1F1F]">
                                        {formatCurrency(nota.valor)}
                                      </p>
                                    </div>
                                    <div className="text-right space-y-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wide">
                                        Emissão
                                      </span>
                                      <p className="text-xs font-medium text-neutral-700">
                                        {formatDate(nota.dataEmissao)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Campos comparados destacados */}
                                  <div className="rounded bg-white/90 p-2 border border-neutral-200/80 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-neutral-500 text-[11px] flex items-center gap-1">
                                        <Building2 className="h-3 w-3 text-neutral-400" /> Tomador:
                                      </span>
                                      <span
                                        className="font-semibold text-neutral-800 truncate max-w-[140px]"
                                        title={nota.tomadorRazao || nota.clienteNome}
                                      >
                                        {nota.tomadorRazao ||
                                          nota.clienteNome ||
                                          'Não especificado'}
                                      </span>
                                    </div>

                                    {nota.tomadorCnpjCpf && (
                                      <div className="flex items-center justify-between gap-1 text-[10px]">
                                        <span className="text-neutral-500">CNPJ Tomador:</span>
                                        <span className="font-mono text-neutral-700">
                                          {nota.tomadorCnpjCpf}
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                      <span className="text-neutral-500">Origem:</span>
                                      <span className="font-medium text-neutral-800">
                                        {nota.isGatilho
                                          ? 'Gatilho de Contrato'
                                          : nota.origem === 'parcela'
                                            ? 'Parcela Avulsa'
                                            : 'Importação Órfã'}
                                      </span>
                                    </div>

                                    {nota.projetoNumero && (
                                      <div className="flex items-center justify-between gap-1 text-[10px]">
                                        <span className="text-neutral-500">Projeto:</span>
                                        <span className="font-bold text-[#FF6A13]">
                                          {nota.projetoNumero}
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between gap-1 text-[10px]">
                                      <span className="text-neutral-500">Status financeiro:</span>
                                      <CrmBadge
                                        tone={
                                          nota.status === 'paga'
                                            ? 'green'
                                            : nota.status === 'vencida'
                                              ? 'red'
                                              : 'orange'
                                        }
                                      >
                                        {nota.status.toUpperCase()}
                                      </CrmBadge>
                                    </div>

                                    {nota.created && (
                                      <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-400 pt-0.5 border-t border-neutral-100">
                                        <span>Cadastrada em:</span>
                                        <span>{formatDate(nota.created)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Botão para alternar a mantida */}
                                <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between">
                                  <span className="text-[10px] text-neutral-400">
                                    Score: {nota.scoreCompletude} pts
                                  </span>

                                  {!isMantida ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDefinirMantida(grupo.chave, nota.id)}
                                      className="text-xs text-[#FF6A13] hover:text-[#D65100] hover:underline font-bold"
                                    >
                                      Manter esta cópia
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Principal
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rodapé AEROCAD */}
          <DialogFooter className="mt-4 pt-3 border-t border-neutral-200 flex sm:justify-between items-center gap-3">
            <div className="text-xs text-neutral-600 hidden sm:block">
              {idsParaExcluir.size > 0 && (
                <span>
                  <strong>{idsParaExcluir.size}</strong> duplicata(s) marcada(s) para exclusão •
                  Total:{' '}
                  <strong className="text-rose-600 font-mono">
                    {formatCurrency(notasMarcadasInfo.totalValor)}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>

              <Button
                type="button"
                onClick={() => setConfirmacaoAberta(true)}
                disabled={idsParaExcluir.size === 0 || !isAdmin}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Apagar Duplicatas Selecionadas ({idsParaExcluir.size})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Padrão AEROCAD (Laranja #FF6A13, Arial, Segurança Admin & Auditoria) */}
      <Dialog open={confirmacaoAberta} onOpenChange={setConfirmacaoAberta}>
        <DialogContent className="max-w-lg p-6 font-sans">
          <DialogHeader>
            <div className="flex items-center gap-3 border-b pb-3 border-neutral-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#1F1F1F]">
                  Confirmação de Exclusão de Duplicatas Fiscais
                </DialogTitle>
                <DialogDescription className="text-xs text-[#737373]">
                  Ação administrativa irreversível com auditoria e preservação de integridade.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Resumo Numérico do que será apagado */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                  Quantidade a Apagar
                </span>
                <p className="font-mono font-bold text-lg text-rose-600 mt-0.5">
                  {idsParaExcluir.size} nota(s)
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                  Valor Total Reduzido
                </span>
                <p className="font-mono font-bold text-lg text-neutral-900 mt-0.5">
                  {formatCurrency(notasMarcadasInfo.totalValor)}
                </p>
              </div>
            </div>

            {/* Aviso sobre Vínculos Financeiros */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5 text-amber-950">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Segurança e Integridade do Contas a Receber:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-900">
                {notasMarcadasInfo.comGatilhoContratual > 0 && (
                  <li>
                    <strong>
                      {notasMarcadasInfo.comGatilhoContratual} parcela(s) vinculada(s) a contratos:
                    </strong>{' '}
                    As parcelas originais com gatilho serão <em>reabertas como pendentes</em> e os
                    dados fiscais duplicados desvinculados, preservando o saldo do contrato.
                  </li>
                )}
                <li>
                  <strong>
                    {notasMarcadasInfo.emContasReceber} registro(s) no Contas a Receber:
                  </strong>{' '}
                  Serão saneados para eliminar valores inflados na receita do CRM.
                </li>
                <li>
                  <strong>Auditoria com Rollback:</strong> Registrada na tabela de auditoria
                  permanente com usuário ({user?.name || 'Cleyton'}), data e snapshot anterior
                  completo.
                </li>
              </ul>
            </div>

            <div className="rounded-md bg-neutral-100 p-2.5 text-[11px] text-neutral-600">
              Esta ação só pode ser realizada pelo administrador com acesso total. Confirma a
              exclusão definitiva dessas duplicatas?
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-neutral-200 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={executandoExclusao}
              onClick={() => setConfirmacaoAberta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={executandoExclusao}
              onClick={executarExclusaoConfirmada}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {executandoExclusao ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Apagando duplicatas...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Confirmar e Apagar {idsParaExcluir.size} Duplicatas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
