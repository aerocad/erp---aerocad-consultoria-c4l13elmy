import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  Receipt,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  buildMailtoUrl,
  gerarMinutaEmail,
  type MinutaEmailContexto,
  type ModeloMinutaTipo,
} from '@/lib/minutasEmail'

export interface GeradorMinutaEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialContexto: MinutaEmailContexto
  // Permite travar a seleção caso o botão seja específico (ex: "Cobrar Medição")
  lockModel?: boolean
  // Lista de modelos disponíveis nesta chamada (se não fornecida, usa todos)
  modelosPermitidos?: ModeloMinutaTipo[]
}

const MODELO_OPCOES: Array<{
  id: ModeloMinutaTipo
  titulo: string
  subtitulo: string
  icone: typeof FileText
}> = [
  {
    id: 'proposta',
    titulo: '1. Proposta Enviada',
    subtitulo: 'Apresentação comercial de PC/PT com valores e prazos',
    icone: FileText,
  },
  {
    id: 'cobranca_medicao',
    titulo: '2. Cobrança de Medição',
    subtitulo: 'Aprovação de medição técnica com PIX/conta AEROCAD',
    icone: Receipt,
  },
  {
    id: 'cobranca_nfse',
    titulo: '3. Cobrança de NFS-e',
    subtitulo: 'Solicitação de emissão de NFS-e com tomador e PIX',
    icone: FileCheck2,
  },
  {
    id: 'followup_processo',
    titulo: '4. Follow-up de Processo',
    subtitulo: 'Cobrança de andamento a DECEA/ANAC com protocolo e exigências',
    icone: ShieldAlert,
  },
]

export function GeradorMinutaEmailModal({
  open,
  onOpenChange,
  initialContexto,
  lockModel = false,
  modelosPermitidos,
}: GeradorMinutaEmailModalProps) {
  const [tipoModelo, setTipoModelo] = useState<ModeloMinutaTipo>(initialContexto.tipo)
  const [destinatario, setDestinatario] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [copiadoTudo, setCopiadoTudo] = useState(false)
  const [copiadoCorpo, setCopiadoCorpo] = useState(false)

  // Filtrar modelos permitidos se especificado
  const modelosDisponiveis = useMemo(() => {
    if (!modelosPermitidos || modelosPermitidos.length === 0) {
      return MODELO_OPCOES
    }
    return MODELO_OPCOES.filter((m) => modelosPermitidos.includes(m.id))
  }, [modelosPermitidos])

  // Recalcular minuta quando o modal abre ou o tipo muda
  const regenerar = (tipo: ModeloMinutaTipo) => {
    const gerada = gerarMinutaEmail({
      ...initialContexto,
      tipo,
    })
    setDestinatario(gerada.destinatario)
    setAssunto(gerada.assunto)
    setCorpo(gerada.corpo)
  }

  useEffect(() => {
    if (open) {
      const targetTipo =
        modelosPermitidos && !modelosPermitidos.includes(initialContexto.tipo)
          ? modelosPermitidos[0]
          : initialContexto.tipo
      setTipoModelo(targetTipo)
      regenerar(targetTipo)
      setCopiadoTudo(false)
      setCopiadoCorpo(false)
    }
  }, [open, initialContexto])

  const handleTrocaModelo = (novoTipo: ModeloMinutaTipo) => {
    setTipoModelo(novoTipo)
    regenerar(novoTipo)
  }

  const handleCopiarTudo = async () => {
    try {
      const textoCompleto = `Assunto: ${assunto}\n\n${corpo}`
      await navigator.clipboard.writeText(textoCompleto)
      setCopiadoTudo(true)
      toast.success('Assunto e corpo do e-mail copiados com sucesso!')
      setTimeout(() => setCopiadoTudo(false), 2500)
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente pelo teclado.')
    }
  }

  const handleCopiarCorpo = async () => {
    try {
      await navigator.clipboard.writeText(corpo)
      setCopiadoCorpo(true)
      toast.success('Corpo do e-mail copiado!')
      setTimeout(() => setCopiadoCorpo(false), 2500)
    } catch {
      toast.error('Não foi possível copiar o corpo.')
    }
  }

  const mailtoHref = buildMailtoUrl(destinatario, assunto, corpo)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden font-sans">
        {/* Topo / Cabeçalho Técnico Laranja AEROCAD */}
        <div className="bg-[#1F1F1F] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#FF6A13]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-[#FF6A13]/20 border border-[#FF6A13] flex items-center justify-center text-[#FF6A13]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-[#FF6A13]">
                AEROCAD CONSULTORIA & AEROPORTOS · FLUXO ASSISTIDO
              </p>
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                Gerador de Minutas de E-mail
              </DialogTitle>
            </div>
          </div>
          <span className="hidden sm:inline-block text-xs font-mono bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded border border-neutral-700">
            Copiar & Colar no Gmail/Outlook
          </span>
        </div>

        {/* Subcabeçalho com Contexto & Aviso de Fluxo Externo */}
        <div className="bg-orange-50/70 border-b border-orange-200 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <p className="text-neutral-700">
            <strong className="text-neutral-900">Como funciona:</strong> a minuta é gerada com os
            dados reais do registro e permanece <span className="font-semibold">100% editável</span>
            . Você copia o texto pronto ou clica em abrir no e-mail para enviar do seu cliente de
            correio.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => regenerar(tipoModelo)}
            className="h-7 text-xs text-[#D65100] hover:bg-orange-100 self-start sm:self-auto shrink-0"
            title="Restaurar texto padrão da minuta"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Restaurar Minuta
          </Button>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Seletor de Modelo (se não estiver travado) */}
          {!lockModel && modelosDisponiveis.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Selecione o Modelo de Minuta
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {modelosDisponiveis.map((m) => {
                  const Icone = m.icone
                  const isSelected = tipoModelo === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleTrocaModelo(m.id)}
                      className={`text-left p-2.5 rounded border transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#FF6A13] bg-orange-50/60 ring-1 ring-[#FF6A13]'
                          : 'border-neutral-200 hover:border-orange-300 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icone
                          className={`h-4 w-4 shrink-0 ${
                            isSelected ? 'text-[#FF6A13]' : 'text-neutral-500'
                          }`}
                        />
                        <span
                          className={`font-semibold text-xs leading-snug ${
                            isSelected ? 'text-[#D65100]' : 'text-neutral-800'
                          }`}
                        >
                          {m.titulo}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">{m.subtitulo}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Campo Destinatário (editável) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="minuta-destinatario"
                className="text-xs font-semibold text-neutral-700"
              >
                Destinatário (E-mail do contato/órgão)
              </Label>
              {!destinatario && (
                <span className="text-[11px] text-amber-700 font-mono">
                  [destinatário não cadastrado — preencha se for abrir via mailto]
                </span>
              )}
            </div>
            <Input
              id="minuta-destinatario"
              type="email"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="exemplo@cliente.com.br ou protocolo@orgao.gov.br"
              className="h-9 text-xs"
            />
          </div>

          {/* Campo Assunto (editável) */}
          <div className="space-y-1">
            <Label htmlFor="minuta-assunto" className="text-xs font-semibold text-neutral-700">
              Assunto do E-mail
            </Label>
            <Input
              id="minuta-assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Assunto oficial da comunicação"
              className="h-9 text-xs font-medium"
            />
          </div>

          {/* Campo Corpo do E-mail (editável em textarea com fonte mono/arial e altura generosa) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="minuta-corpo" className="text-xs font-semibold text-neutral-700">
                Corpo da Mensagem (Texto Simples Editável)
              </Label>
              <span className="text-[11px] text-neutral-400">
                {corpo.length} caracteres · quebras de linha preservadas
              </span>
            </div>
            <Textarea
              id="minuta-corpo"
              rows={14}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className="text-xs font-mono leading-relaxed bg-[#FCFCFD] border-neutral-300 focus:border-[#FF6A13] focus:ring-1 focus:ring-[#FF6A13] resize-y min-h-[280px]"
            />
          </div>

          <div className="rounded border border-neutral-200 bg-neutral-50 p-2.5 text-[11px] text-neutral-600 flex items-center justify-between">
            <span>
              🔒 <strong>Identidade visual preservada:</strong> Assinatura e dados institucionais da
              AEROCAD (CNPJ 28.036.597/0001-43, chave PIX e endereço) já inclusos no rodapé da
              minuta.
            </span>
          </div>
        </div>

        {/* Rodapé com Botões de Ação */}
        <DialogFooter className="bg-neutral-50 border-t border-neutral-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-neutral-600"
          >
            Fechar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopiarCorpo}
              className="text-xs border-neutral-300 hover:bg-neutral-100"
            >
              {copiadoCorpo ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Corpo Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-neutral-600" />
                  Copiar apenas o corpo
                </>
              )}
            </Button>

            {/* Botão Principal: Copiar Assunto + Corpo */}
            <Button
              type="button"
              size="sm"
              onClick={handleCopiarTudo}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold text-xs shadow-sm"
            >
              {copiadoTudo ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-white" />
                  E-mail Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-white" />
                  Copiar e-mail completo
                </>
              )}
            </Button>

            {/* Botão Secundário: Abrir no mailto */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="text-xs border-orange-300 text-[#D65100] hover:bg-orange-50 font-medium"
            >
              <a href={mailtoHref}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                Abrir no e-mail (mailto)
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
