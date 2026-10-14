import {
  FileText,
  Barcode,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Paperclip,
  ExternalLink,
  ChevronDown,
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
      case 'nota_fiscal':
        return <FileText className={className} />
      case 'comprovante_pix':
        return <CheckCircle2 className={className} />
      case 'recibo':
        return <Receipt className={className} />
      case 'contrato':
        return <FileSpreadsheet className={className} />
      default:
        return <Paperclip className={className} />
    }
  }

  // Se tem apenas 1 documento
  if (docs.length === 1) {
    const doc = docs[0]
    const cfg = TIPO_DOCUMENTO_SEGREGADO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro

    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold transition hover:opacity-85 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
        title={`${cfg.label}: ${doc.nomeOriginal} (Clique para abrir)`}
      >
        {renderIcone(doc.tipo, 'h-3 w-3 shrink-0')}
        <span className="truncate max-w-[110px]">{cfg.shortLabel}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-60 ml-0.5" />
      </a>
    )
  }

  // Se tem múltiplos documentos (ex.: Boleto + NF + Comprovante PIX)
  if (compacto) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px] font-semibold border-orange-200 bg-orange-50/70 text-[#D65100] hover:bg-orange-100 flex items-center gap-1"
          >
            <Paperclip className="h-3 w-3" />
            <span>{docs.length} docs</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 text-xs">
          <DropdownMenuLabel className="text-[11px] font-semibold text-neutral-500">
            Documentos Segregados ({docs.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {docs.map((doc, i) => {
            const cfg =
              TIPO_DOCUMENTO_SEGREGADO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_SEGREGADO_CONFIG.outro
            return (
              <DropdownMenuItem key={i} asChild>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 cursor-pointer py-1.5"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {renderIcone(doc.tipo, 'h-3.5 w-3.5 text-[#FF6A13] shrink-0')}
                    <span className="font-medium truncate">{doc.nomeOriginal}</span>
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold shrink-0 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                  >
                    {cfg.shortLabel}
                  </span>
                </a>
              </DropdownMenuItem>
            )
          })}
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
        return (
          <a
            key={idx}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition hover:opacity-80 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
            title={`${cfg.label}: ${doc.nomeOriginal}`}
          >
            {renderIcone(doc.tipo, 'h-2.5 w-2.5 shrink-0')}
            <span className="truncate max-w-[80px]">{cfg.shortLabel}</span>
          </a>
        )
      })}
    </div>
  )
}
