import {
  FileText,
  Barcode,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  Paperclip,
  ExternalLink,
  ChevronDown,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  obterDocumentosSegregados,
  TIPO_DOCUMENTO_SEGREGADO_CONFIG,
} from '@/services/documentosContasPagar'
import type { ContaPagarRecord, TipoDocumentoSegregado } from '@/types/crm'

export interface DocumentosContaPagarBadgesProps {
  conta: ContaPagarRecord
  compacto?: boolean
}

export function DocumentosContaPagarBadges({
  conta,
  compacto = false,
}: DocumentosContaPagarBadgesProps) {
  const docs = obterDocumentosSegregados(conta)

  if (docs.length === 0) {
    return <span className="text-neutral-300 text-xs">—</span>
  }

  function renderIcone(tipo: TipoDocumentoSegregado, className = 'h-3.5 w-3.5') {
    switch (tipo) {
      case 'boleto':
        return <Barcode className={className} />
      case 'comprovante_pix':
        return <ArrowLeftRight className={className} />
      case 'recibo':
        return <Receipt className={className} />
      case 'nota_fiscal':
        return <FileText className={className} />
      case 'contrato':
        return <FileSpreadsheet className={className} />
      case 'outro':
        return <HelpCircle className={className} />
      default:
        return <Paperclip className={className} />
    }
  }

  // Distinção rápida se a conta contém Boleto e/ou Comprovante
  const temBoleto = docs.some((d) => d.tipo === 'boleto')
  const temComprovante = docs.some((d) => d.tipo === 'comprovante_pix' || d.tipo === 'recibo')
  const temNaoClassificado = docs.some((d) => d.tipo === 'outro')

  // Se tem apenas 1 documento
  if (docs.length === 1) {
    const doc = docs[0]
    const cfg = TIPO_DOCUMENTO_SEGREGADO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro

    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] transition hover:scale-102 hover:shadow-xs ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
        title={`${cfg.label} (${cfg.naturezaLabel}): ${doc.nomeOriginal} — ${cfg.descricaoPapel} (Clique para abrir)`}
      >
        <span
          className={`p-0.5 rounded ${
            doc.tipo === 'boleto'
              ? 'bg-amber-200 text-amber-900'
              : doc.tipo === 'comprovante_pix'
                ? 'bg-emerald-200 text-emerald-900'
                : 'bg-black/5 text-current'
          }`}
        >
          {renderIcone(doc.tipo, 'h-3.5 w-3.5 shrink-0')}
        </span>
        <span className="truncate max-w-[120px]">{cfg.shortLabel}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-60 ml-0.5 shrink-0" />
      </a>
    )
  }

  // Se tem múltiplos documentos (ex.: Boleto + Comprovante PIX + NF)
  if (compacto) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-6 px-2 text-[11px] font-bold border transition flex items-center gap-1 ${
              temBoleto && temComprovante
                ? 'border-emerald-300 bg-linear-to-r from-amber-50 to-emerald-50 text-neutral-800 hover:from-amber-100 hover:to-emerald-100'
                : temBoleto
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : temComprovante
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    : 'border-orange-200 bg-orange-50/70 text-[#D65100] hover:bg-orange-100'
            }`}
            title={`Documentos anexados: ${docs.length} arquivo(s) segregado(s)`}
          >
            {/* Ícones compactos resumindo os tipos principais presentes */}
            <div className="flex items-center -space-x-1">
              {temBoleto && (
                <span
                  className="p-0.5 rounded-full bg-amber-200 text-amber-900 z-10"
                  title="Possui Boleto de cobrança"
                >
                  <Barcode className="h-2.5 w-2.5" />
                </span>
              )}
              {temComprovante && (
                <span
                  className="p-0.5 rounded-full bg-emerald-200 text-emerald-900 z-20"
                  title="Possui Comprovante de liquidação"
                >
                  <ArrowLeftRight className="h-2.5 w-2.5" />
                </span>
              )}
              {!temBoleto && !temComprovante && <Paperclip className="h-3 w-3 text-neutral-500" />}
            </div>

            <span className="font-semibold">{docs.length} docs</span>
            {temNaoClassificado && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                title="Contém arquivo não classificado"
              />
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 text-xs p-1.5">
          <DropdownMenuLabel className="text-[11px] font-bold text-neutral-700 flex items-center justify-between pb-1">
            <span>Documentos da Conta ({docs.length})</span>
            <span className="text-[9px] font-normal text-neutral-400">Segregação por Tipo</span>
          </DropdownMenuLabel>

          {/* Dica visual rápida no topo do menu se houver mistura de cobrança e liquidação */}
          {temBoleto && temComprovante && (
            <div className="mx-1 mb-1.5 p-1.5 rounded bg-neutral-50 border border-neutral-200 text-[10px] text-neutral-600 flex items-center gap-1.5">
              <span className="font-semibold text-amber-800 flex items-center gap-0.5">
                <Barcode className="h-2.5 w-2.5" /> Cobrança
              </span>
              <span className="text-neutral-300">|</span>
              <span className="font-semibold text-emerald-800 flex items-center gap-0.5">
                <ArrowLeftRight className="h-2.5 w-2.5" /> Quitado
              </span>
            </div>
          )}

          <DropdownMenuSeparator />

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {docs.map((doc, i) => {
              const cfg =
                TIPO_DOCUMENTO_SEGREGADO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro
              const isBoleto = doc.tipo === 'boleto'
              const isComprovante = doc.tipo === 'comprovante_pix' || doc.tipo === 'recibo'

              return (
                <DropdownMenuItem key={i} asChild>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 cursor-pointer p-1.5 rounded-md hover:bg-neutral-100 transition"
                  >
                    <span className="flex items-center gap-1.5 truncate flex-1">
                      <span
                        className={`p-1 rounded shrink-0 ${
                          isBoleto
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isComprovante
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        }`}
                      >
                        {renderIcone(doc.tipo, 'h-3.5 w-3.5')}
                      </span>
                      <span className="truncate flex flex-col">
                        <span className="font-medium text-neutral-900 truncate max-w-[150px]">
                          {doc.nomeOriginal}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-normal">
                          {cfg.naturezaLabel}
                        </span>
                      </span>
                    </span>

                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                    >
                      {cfg.shortLabel}
                    </span>
                  </a>
                </DropdownMenuItem>
              )
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Exibição expandida com badges segregados clicáveis individualmente
  return (
    <div className="flex flex-wrap items-center gap-1 justify-center">
      {docs.map((doc, idx) => {
        const cfg =
          TIPO_DOCUMENTO_SEGREGADO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro
        const isBoleto = doc.tipo === 'boleto'
        const isComprovante = doc.tipo === 'comprovante_pix' || doc.tipo === 'recibo'

        return (
          <a
            key={idx}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition hover:scale-102 hover:shadow-xs ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
            title={`${cfg.label} (${cfg.naturezaLabel}): ${doc.nomeOriginal} — ${cfg.descricaoPapel}`}
          >
            <span
              className={`p-0.5 rounded ${
                isBoleto
                  ? 'bg-amber-200 text-amber-900'
                  : isComprovante
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-black/5 text-current'
              }`}
            >
              {renderIcone(doc.tipo, 'h-3 w-3 shrink-0')}
            </span>
            <span className="truncate max-w-[90px]">{cfg.shortLabel}</span>
          </a>
        )
      })}
    </div>
  )
}
