import { useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CopyX,
  FileSpreadsheet,
  FileText,
  FileUp,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CrmBadge } from '@/components/common/CrmBadge'
import { formatCurrency, formatDate } from '@/lib/format'
import type {
  AnaliseDeduplicacaoArquivo,
  ResultadoDeduplicacaoTransacao,
  TransacaoCandidataImportacao,
} from '@/services/extratoDeduplicador'
import type { ContaBancariaRecord } from '@/types/crm'

export interface PreviaImportacaoExtratoModalProps<T extends TransacaoCandidataImportacao> {
  open: boolean
  onOpenChange: (open: boolean) => void
  analise: AnaliseDeduplicacaoArquivo<T> | null
  formato: 'ofx' | 'csv' | 'xlsx' | 'ret'
  contaBancaria?: ContaBancariaRecord
  isGravando: boolean
  onConfirmarGravacao: () => Promise<void> | void
}

export function PreviaImportacaoExtratoModal<T extends TransacaoCandidataImportacao>({
  open,
  onOpenChange,
  analise,
  formato,
  contaBancaria,
  isGravando,
  onConfirmarGravacao,
}: PreviaImportacaoExtratoModalProps<T>) {
  const [abaExibicao, setAbaExibicao] = useState<'novas' | 'duplicadas'>('novas')

  if (!analise) return null

  const isTotalmenteDuplicado = analise.arquivoJaImportado || analise.totalNovas === 0
  const temDuplicadasParciais = analise.totalDuplicadas > 0 && analise.totalNovas > 0

  return (
    <Dialog open={open} onOpenChange={(o) => (!isGravando ? onOpenChange(o) : undefined)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <FileUp className="h-4 w-4 text-[#FF6A13]" />
            Conferência e Deduplicação de Extrato Bancário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Informações do arquivo e conta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-neutral-50 rounded-lg border">
            <div>
              <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                Arquivo
              </span>
              <span
                className="font-semibold text-neutral-800 truncate block"
                title={analise.arquivoNome}
              >
                {analise.arquivoNome}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                Formato
              </span>
              <span className="font-bold text-[#FF6A13] uppercase">{formato}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                Conta Bancária PJ
              </span>
              <span className="font-semibold text-neutral-800 truncate block">
                {contaBancaria?.apelido || 'Conta Operacional'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                Total de Linhas
              </span>
              <span className="font-mono text-neutral-800">
                {analise.totalCandidatas} transação(ões)
              </span>
            </div>
          </div>

          {/* Banner de status da deduplicação */}
          {isTotalmenteDuplicado ? (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                <CopyX className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Arquivo já importado anteriormente — nenhum lançamento novo</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Todos os <strong>{analise.totalCandidatas} lançamentos</strong> deste arquivo já
                estão cadastrados no banco de dados para a conta selecionada. Nenhuma transação será
                duplicada no fluxo de caixa nem na conciliação.
                {analise.extratoExistenteCorrespondente && (
                  <span className="block mt-1 text-amber-900 font-medium">
                    Importação anterior registrada em:{' '}
                    {formatDate(analise.extratoExistenteCorrespondente.created)} (Extrato ref:{' '}
                    {analise.extratoExistenteCorrespondente.nome_arquivo})
                  </span>
                )}
              </p>
            </div>
          ) : temDuplicadasParciais ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Sobreposição Detectada: Filtro de Deduplicação Ativo</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Foram identificados <strong>{analise.totalNovas} lançamentos novos</strong> que
                serão gravados no CRM, e <strong>{analise.totalDuplicadas} já existentes</strong> no
                banco que serão ignorados para evitar duplicidade.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-[11px]">
                Todos os <strong>{analise.totalNovas} lançamentos</strong> são inéditos para esta
                conta e serão integrados à conciliação.
              </p>
            </div>
          )}

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                Lançamentos Novos
              </span>
              <p className="text-lg font-bold text-emerald-700 mt-1">{analise.totalNovas}</p>
              <span className="text-[10px] text-emerald-600">
                +{formatCurrency(analise.totalEntradasNovas)} / -
                {formatCurrency(analise.totalSaidasNovas)}
              </span>
            </div>

            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
              <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                Duplicados Ignorados
              </span>
              <p className="text-lg font-bold text-amber-700 mt-1">{analise.totalDuplicadas}</p>
              <span className="text-[10px] text-amber-600">
                Preservando apenas o registro original
              </span>
            </div>

            <div className="p-3 bg-neutral-50 border rounded-lg">
              <span className="text-[10px] font-semibold text-neutral-600 uppercase block">
                Total no Arquivo
              </span>
              <p className="text-lg font-bold text-neutral-800 mt-1">{analise.totalCandidatas}</p>
              <span className="text-[10px] text-neutral-500">Lançamentos processados</span>
            </div>
          </div>

          {/* Abas para alternar entre lista de novos e lista de duplicados */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b pb-2">
              <button
                type="button"
                onClick={() => setAbaExibicao('novas')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${
                  abaExibicao === 'novas'
                    ? 'bg-[#FF6A13] text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Novos a Gravar ({analise.totalNovas})
              </button>
              {analise.totalDuplicadas > 0 && (
                <button
                  type="button"
                  onClick={() => setAbaExibicao('duplicadas')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition ${
                    abaExibicao === 'duplicadas'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  Duplicados / Ignorados ({analise.totalDuplicadas})
                </button>
              )}
            </div>

            {/* Lista selecionada */}
            <div className="border rounded-lg overflow-hidden divide-y bg-white text-[11px] max-h-56 overflow-y-auto">
              {abaExibicao === 'novas' ? (
                analise.itensNovos.length === 0 ? (
                  <div className="p-4 text-center text-neutral-400">
                    Nenhum lançamento novo a ser gravado.
                  </div>
                ) : (
                  analise.itensNovos.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 flex items-center justify-between hover:bg-neutral-50 transition"
                    >
                      <div className="space-y-0.5 max-w-[420px]">
                        <p className="font-semibold text-neutral-900 truncate">
                          {item.item.descricao}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          Data: {formatDate(item.item.data)}
                          {item.item.documentoRef ? ` · Ref: ${item.item.documentoRef}` : ''}
                        </p>
                      </div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          item.item.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {item.item.tipo === 'entrada' ? '+' : '-'} {formatCurrency(item.item.valor)}
                      </span>
                    </div>
                  ))
                )
              ) : analise.itensDuplicados.length === 0 ? (
                <div className="p-4 text-center text-neutral-400">
                  Nenhuma duplicidade detectada.
                </div>
              ) : (
                analise.itensDuplicados.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between bg-amber-50/20 hover:bg-amber-50/50 transition"
                  >
                    <div className="space-y-0.5 max-w-[400px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-neutral-800 truncate">
                          {item.item.descricao}
                        </span>
                        <CrmBadge tone="amber">Já existe</CrmBadge>
                      </div>
                      <p className="text-[10px] text-amber-700 italic">
                        {item.motivoDuplicidade || 'Lançamento coincidente no banco.'}
                      </p>
                    </div>
                    <span className="font-mono font-medium text-xs text-neutral-500 line-through">
                      {formatCurrency(item.item.valor)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" disabled={isGravando} onClick={() => onOpenChange(false)}>
            {isTotalmenteDuplicado ? 'Fechar' : 'Cancelar'}
          </Button>

          {!isTotalmenteDuplicado && (
            <Button
              onClick={onConfirmarGravacao}
              disabled={isGravando || analise.totalNovas === 0}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold"
            >
              {isGravando
                ? 'Gravando Lançamentos...'
                : `Confirmar Gravação (${analise.totalNovas} novos)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
