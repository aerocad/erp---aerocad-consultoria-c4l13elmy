import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ParcelaRecord, ProjetoRecord } from '@/types/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { pb } from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { vincularNotaOrfaAParcela } from '@/services/nfseExecutor'
import { NfseDadoExtraido } from '@/services/nfseParser'
import {
  Search,
  Link as LinkIcon,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export interface VincularNfseProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord
  parcelasExistentes: ParcelaRecord[]
  onSuccess: () => void
}

interface NotaCandidata {
  tipo: 'cadastrada' | 'orfa'
  id: string
  numero: string
  valor: number
  dataEmissao?: string
  tomadorRazao?: string
  descricaoServico?: string
  parcelaVinculada?: ParcelaRecord
  notaOrfaOriginal?: NfseDadoExtraido
}

export function VincularNfseProjetoModal({
  open,
  onOpenChange,
  projeto,
  parcelasExistentes,
  onSuccess,
}: VincularNfseProjetoModalProps) {
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [todasNotas, setTodasNotas] = useState<NotaCandidata[]>([])
  const [carregouNotas, setCarregouNotas] = useState(false)

  // Seleção
  const [notaSelecionada, setNotaSelecionada] = useState<NotaCandidata | null>(null)
  const [destinoParcela, setDestinoParcela] = useState<'existente' | 'nova'>('nova')
  const [parcelaSelecionadaId, setParcelaSelecionadaId] = useState<string>('')
  const [descricaoVinculo, setDescricaoVinculo] = useState<string>('')
  const [salvando, setSalvando] = useState(false)

  // Ao abrir o modal, carregar as notas cadastradas no sistema e as notas órfãs da sessão
  const carregarNotas = async () => {
    setLoading(true)
    try {
      const lista: NotaCandidata[] = []
      const numerosVistos = new Set<string>()

      // 1. Parcelas que possuem NFS-e (todas da base)
      const parcelasComNf = await pb
        .collection('parcelas')
        .getFullList<ParcelaRecord>({
          filter: "nf_numero != '' && nf_numero != null",
          sort: '-data_faturamento,-created',
          expand: 'projeto,cliente',
        })
        .catch(() => [])

      for (const p of parcelasComNf) {
        if (!p.nf_numero) continue
        const chave = `${p.nf_numero}-${p.id}`
        numerosVistos.add(p.nf_numero)
        lista.push({
          tipo: 'cadastrada',
          id: p.id,
          numero: p.nf_numero,
          valor: p.valor_recebido || p.valor,
          dataEmissao: p.data_faturamento || p.vencimento,
          tomadorRazao: p.expand?.cliente?.razao_social || 'Tomador cadastrado',
          descricaoServico: p.descricao,
          parcelaVinculada: p,
        })
      }

      // 2. Notas órfãs do sessionStorage (aba Notas Órfãs)
      try {
        const stored = sessionStorage.getItem('aerocad_nfse_orfas')
        if (stored) {
          const orfas: NfseDadoExtraido[] = JSON.parse(stored)
          for (const o of orfas) {
            // Se já não estiver na lista
            lista.push({
              tipo: 'orfa',
              id: o.idTemp,
              numero: o.numero,
              valor: o.valorLiquido || o.valorBruto,
              dataEmissao: o.dataEmissao,
              tomadorRazao: o.tomadorRazao,
              descricaoServico: o.descricaoServico,
              notaOrfaOriginal: o,
            })
          }
        }
      } catch {
        // silencioso
      }

      setTodasNotas(lista)
      setCarregouNotas(true)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao listar notas fiscais do sistema.')
    } finally {
      setLoading(false)
    }
  }

  // Prepara quando o modal abre
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !carregouNotas) {
      void carregarNotas()
    }
    if (!isOpen) {
      setNotaSelecionada(null)
      setDescricaoVinculo('')
      setParcelaSelecionadaId('')
      setDestinoParcela('nova')
      setBusca('')
    }
    onOpenChange(isOpen)
  }

  const notasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return todasNotas.slice(0, 30)
    return todasNotas
      .filter(
        (n) =>
          n.numero.toLowerCase().includes(termo) ||
          (n.tomadorRazao && n.tomadorRazao.toLowerCase().includes(termo)) ||
          (n.descricaoServico && n.descricaoServico.toLowerCase().includes(termo)),
      )
      .slice(0, 30)
  }, [todasNotas, busca])

  const parcelasDoProjeto = useMemo(() => {
    return parcelasExistentes.filter((p) => !p.nf_numero || p.nf_numero.trim() === '')
  }, [parcelasExistentes])

  const handleSelecionarNota = (nota: NotaCandidata) => {
    setNotaSelecionada(nota)
    // Sugere descrição inicial
    if (nota.descricaoServico) {
      setDescricaoVinculo(nota.descricaoServico.slice(0, 60))
    } else {
      setDescricaoVinculo(`NFS-e nº ${nota.numero}`)
    }
    // Se houver parcela livre no projeto, permite escolher
    if (parcelasDoProjeto.length > 0) {
      setParcelaSelecionadaId(parcelasDoProjeto[0].id)
    } else {
      setDestinoParcela('nova')
    }
  }

  const handleConfirmar = async () => {
    if (!notaSelecionada) return
    setSalvando(true)
    try {
      const descFinal = descricaoVinculo.trim() || `NFS-e nº ${notaSelecionada.numero}`

      if (notaSelecionada.tipo === 'orfa' && notaSelecionada.notaOrfaOriginal) {
        // É uma nota órfã
        let targetParcelaId = parcelaSelecionadaId
        if (destinoParcela === 'nova' || !targetParcelaId) {
          // Criar uma nova parcela para o projeto
          const nova = await pb.collection('parcelas').create({
            projeto: projeto.id,
            cliente: projeto.cliente,
            descricao: descFinal,
            valor: notaSelecionada.valor,
            vencimento: notaSelecionada.dataEmissao || new Date().toISOString().slice(0, 10),
            status: 'paga',
            status_pagamento: 'Recebido (NFS-e)',
            data_pagamento: notaSelecionada.dataEmissao || new Date().toISOString().slice(0, 10),
            valor_recebido: notaSelecionada.valor,
          })
          targetParcelaId = nova.id
        }

        await vincularNotaOrfaAParcela(
          notaSelecionada.notaOrfaOriginal,
          targetParcelaId,
          { modo: 'manter_atual' },
          descFinal,
        )

        // Remove do sessionStorage de órfãs
        try {
          const stored = sessionStorage.getItem('aerocad_nfse_orfas')
          if (stored) {
            const orfas: NfseDadoExtraido[] = JSON.parse(stored)
            const filtradas = orfas.filter((o) => o.idTemp !== notaSelecionada.id)
            sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(filtradas))
          }
        } catch {
          // ignore
        }
      } else if (notaSelecionada.parcelaVinculada) {
        // É uma parcela já cadastrada no sistema: vincula ou move ela para este projeto
        const targetParcela = notaSelecionada.parcelaVinculada
        await pb.collection('parcelas').update(targetParcela.id, {
          projeto: projeto.id,
          cliente: projeto.cliente || targetParcela.cliente,
          descricao: descFinal,
          observacoes: targetParcela.observacoes
            ? `${targetParcela.observacoes}\nVinculada ao projeto ${projeto.numero}: ${descFinal}`
            : `Vinculada ao projeto ${projeto.numero}: ${descFinal}`,
        })

        // Cria log de atividade no projeto
        try {
          await pb.collection('atividades').create({
            usuario: pb.authStore.record?.id || null,
            projeto: projeto.id,
            cliente: projeto.cliente || null,
            texto: `NFS-e nº ${notaSelecionada.numero} (${formatCurrency(notaSelecionada.valor)}) vinculada com descrição "${descFinal}".`,
            tipo: 'financeiro',
            data_hora: new Date().toISOString(),
          })
        } catch {
          // ignore
        }
      }

      toast.success(`NFS-e nº ${notaSelecionada.numero} vinculada ao projeto com sucesso!`)
      handleOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao vincular nota: ' + msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-800">
            <FileSpreadsheet className="h-5 w-5 text-[#FF6A13]" />
            Vincular NFS-e ao Projeto {projeto.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!notaSelecionada ? (
            <>
              <div className="rounded-lg bg-orange-50/70 border border-[#FFD2B3] p-3 text-xs text-neutral-700">
                Selecione uma nota fiscal NFS-e do sistema ou das Notas Órfãs importadas para
                vincular a este projeto ({projeto.nome}).
              </div>

              {/* Busca / Autocomplete */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Buscar por número da NFS-e, tomador ou descrição..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Carregando notas fiscais disponíveis...
                </div>
              ) : notasFiltradas.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 space-y-1">
                  <p className="font-semibold">
                    Nenhuma nota fiscal encontrada com o termo pesquisado.
                  </p>
                  <p>
                    Você pode importar novas notas pela tela do Financeiro (Importar NFS-e em lotes
                    / ZIP).
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-lg border max-h-72 overflow-y-auto bg-white">
                  {notasFiltradas.map((item) => (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => handleSelecionarNota(item)}
                      className="p-3 text-xs flex items-center justify-between hover:bg-orange-50/60 cursor-pointer transition"
                    >
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#D65100]">
                            NFS-e nº {item.numero}
                          </span>
                          {item.tipo === 'orfa' ? (
                            <span className="rounded bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.2 font-semibold">
                              Nota Órfã
                            </span>
                          ) : (
                            <span className="rounded bg-neutral-100 text-neutral-700 text-[10px] px-1.5 py-0.2">
                              {item.parcelaVinculada?.expand?.projeto
                                ? `Proj: ${item.parcelaVinculada.expand.projeto.numero}`
                                : 'Sem projeto'}
                            </span>
                          )}
                          {item.dataEmissao && (
                            <span className="text-[10px] text-neutral-400">
                              {formatDate(item.dataEmissao)}
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-700 font-medium truncate">
                          {item.tomadorRazao || 'Tomador não identificado'}
                        </p>
                        {item.descricaoServico && (
                          <p className="text-neutral-500 text-[11px] truncate italic">
                            {item.descricaoServico}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="mono-value font-bold text-[#1F1F1F]">
                          {formatCurrency(item.valor)}
                        </span>
                        <div className="text-[10px] text-[#FF6A13] font-semibold flex items-center justify-end gap-1 mt-0.5">
                          <LinkIcon className="h-3 w-3" />
                          Selecionar
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {/* Resumo da Nota Selecionada */}
              <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-[#D65100]">
                    NFS-e nº {notaSelecionada.numero}
                  </span>
                  <span className="mono-value font-bold text-sm text-neutral-800">
                    {formatCurrency(notaSelecionada.valor)}
                  </span>
                </div>
                <p className="text-neutral-700">
                  <strong>Tomador:</strong> {notaSelecionada.tomadorRazao}
                </p>
                {notaSelecionada.dataEmissao && (
                  <p className="text-neutral-500">
                    <strong>Emissão:</strong> {formatDate(notaSelecionada.dataEmissao)}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNotaSelecionada(null)}
                  className="h-6 text-[11px] text-[#D65100] hover:text-[#B23B00] px-1 hover:bg-transparent"
                >
                  ← Trocar nota selecionada
                </Button>
              </div>

              {/* Campo de DESCRIÇÃO (pedido explicitamente pelo usuário) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-800">
                  Descrição / Medição da Nota *
                </Label>
                <Input
                  value={descricaoVinculo}
                  onChange={(e) => setDescricaoVinculo(e.target.value)}
                  placeholder="Ex: 1ª medição, Medição final, Entrada 50%, Protocolo no DECEA"
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-neutral-500">
                  Esta descrição será exibida na lista de faturamentos/parcelas do projeto e na aba
                  de notas.
                </p>
              </div>

              {/* Destino da Parcela no Projeto */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold text-neutral-800">
                  Como deseja vincular ao projeto?
                </Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDestinoParcela('nova')}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      destinoParcela === 'nova'
                        ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                        : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-bold">
                      <Plus className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Criar nova parcela/faturamento
                    </div>
                    <span className="text-[11px] text-neutral-500 font-normal">
                      Registra um novo faturamento quitado no projeto no valor da nota.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={parcelasDoProjeto.length === 0}
                    onClick={() => setDestinoParcela('existente')}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      parcelasDoProjeto.length === 0
                        ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-neutral-200'
                        : destinoParcela === 'existente'
                          ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                          : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-bold">
                      <LinkIcon className="h-3.5 w-3.5 text-[#FF6A13]" />
                      Vincular a parcela existente
                    </div>
                    <span className="text-[11px] text-neutral-500 font-normal">
                      {parcelasDoProjeto.length > 0
                        ? `${parcelasDoProjeto.length} parcela(s) sem nota disponíveis.`
                        : 'Não há parcelas pendentes de nota neste projeto.'}
                    </span>
                  </button>
                </div>

                {destinoParcela === 'existente' && parcelasDoProjeto.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <Label className="text-[11px] text-neutral-600">
                      Selecione a parcela do projeto {projeto.numero}:
                    </Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm"
                      value={parcelaSelecionadaId}
                      onChange={(e) => setParcelaSelecionadaId(e.target.value)}
                    >
                      {parcelasDoProjeto.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.descricao} — {formatCurrency(p.valor)} ({p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>
          {notaSelecionada && (
            <Button
              onClick={handleConfirmar}
              disabled={salvando || !descricaoVinculo.trim()}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {salvando ? 'Vinculando NFS-e...' : 'Confirmar Vínculo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
