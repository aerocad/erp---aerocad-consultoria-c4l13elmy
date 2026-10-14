import { useState, useRef, useId } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileText,
  Upload,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Paperclip,
  ExternalLink,
} from 'lucide-react'
import { extrairDadosContrato, type ContratoExtraido } from '@/services/comprovantesVision'
import { createOne, updateOne } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type { ClienteRecord, ProjetoRecord, FornecedorRecord, ContratoRecord } from '@/types/crm'

export interface UploadContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientes: ClienteRecord[]
  projetos: ProjetoRecord[]
  fornecedores: FornecedorRecord[]
  onSalvo: (contrato: ContratoRecord) => void
  contratoParaEditar?: ContratoRecord | null
}

export function UploadContratoModal({
  open,
  onOpenChange,
  clientes,
  projetos,
  fornecedores,
  onSalvo,
  contratoParaEditar,
}: UploadContratoModalProps) {
  const [etapa, setEtapa] = useState<'upload' | 'analisando' | 'ficha'>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Campos da Ficha do Contrato
  const [numero, setNumero] = useState(contratoParaEditar?.numero || '')
  const [titulo, setTitulo] = useState(contratoParaEditar?.titulo || '')
  const [tipoContrato, setTipoContrato] = useState<
    'cliente' | 'prestador_fornecedor' | 'parceria_tecnica' | 'outro'
  >(contratoParaEditar?.tipo_contrato || 'cliente')
  const [clienteId, setClienteId] = useState<string>(contratoParaEditar?.cliente || '')
  const [fornecedorId, setFornecedorId] = useState<string>(contratoParaEditar?.fornecedor || '')
  const [projetoId, setProjetoId] = useState<string>(contratoParaEditar?.projeto || '')
  const [partesEnvolvidas, setPartesEnvolvidas] = useState(
    contratoParaEditar?.partes_envolvidas || '',
  )
  const [objeto, setObjeto] = useState(contratoParaEditar?.objeto || '')
  const [valorGlobal, setValorGlobal] = useState<string>(
    contratoParaEditar?.valor_global ? String(contratoParaEditar.valor_global) : '',
  )
  const [formaPagamentoTexto, setFormaPagamentoTexto] = useState(
    contratoParaEditar?.forma_pagamento_texto || '',
  )
  const [dataAssinatura, setDataAssinatura] = useState(
    contratoParaEditar?.data_assinatura
      ? contratoParaEditar.data_assinatura.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  )
  const [dataInicioVigencia, setDataInicioVigencia] = useState(
    contratoParaEditar?.data_inicio_vigencia
      ? contratoParaEditar.data_inicio_vigencia.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  )
  const [dataTerminoVigencia, setDataTerminoVigencia] = useState(
    contratoParaEditar?.data_termino_vigencia
      ? contratoParaEditar.data_termino_vigencia.slice(0, 10)
      : '',
  )
  const [indiceReajuste, setIndiceReajuste] = useState(
    contratoParaEditar?.indice_reajuste || 'IPCA / IBGE Anual',
  )
  const [garanteFiador, setGaranteFiador] = useState(contratoParaEditar?.garante_fiador || '')
  const [observacoes, setObservacoes] = useState(contratoParaEditar?.observacoes || '')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInputId = useId()

  function resetar() {
    setEtapa('upload')
    setArquivo(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setAviso(null)
    setIsSubmitting(false)
  }

  async function handleFileSelected(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('O contrato deve ser um arquivo em formato PDF.')
      return
    }

    setArquivo(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    setEtapa('analisando')
    setAviso(null)

    try {
      const extraido: ContratoExtraido = await extrairDadosContrato(file)
      if (extraido) {
        if (extraido.numero) setNumero(extraido.numero)
        if (extraido.titulo) setTitulo(extraido.titulo)
        if (extraido.tipo_contrato) setTipoContrato(extraido.tipo_contrato)
        if (extraido.partes_envolvidas) setPartesEnvolvidas(extraido.partes_envolvidas)
        if (extraido.objeto) setObjeto(extraido.objeto)
        if (extraido.valor_global) setValorGlobal(String(extraido.valor_global))
        if (extraido.forma_pagamento_texto) setFormaPagamentoTexto(extraido.forma_pagamento_texto)
        if (extraido.data_assinatura) setDataAssinatura(extraido.data_assinatura.slice(0, 10))
        if (extraido.data_inicio_vigencia)
          setDataInicioVigencia(extraido.data_inicio_vigencia.slice(0, 10))
        if (extraido.data_termino_vigencia)
          setDataTerminoVigencia(extraido.data_termino_vigencia.slice(0, 10))
        if (extraido.indice_reajuste) setIndiceReajuste(extraido.indice_reajuste)
        if (extraido.garante_fiador) setGaranteFiador(extraido.garante_fiador)

        // Tentar correlacionar cliente por similaridade
        if (extraido.partes_envolvidas) {
          const lowerPartes = extraido.partes_envolvidas.toLowerCase()
          const matchedCliente = clientes.find(
            (c) =>
              lowerPartes.includes(c.razao_social.toLowerCase()) ||
              (c.nome_fantasia && lowerPartes.includes(c.nome_fantasia.toLowerCase())),
          )
          if (matchedCliente) setClienteId(matchedCliente.id)

          const matchedFornec = fornecedores.find((f) =>
            lowerPartes.includes(f.razao_social.toLowerCase()),
          )
          if (matchedFornec) setFornecedorId(matchedFornec.id)
        }
      }

      setEtapa('ficha')
      toast.success('Cláusulas e dados do contrato extraídos pela IA do CRM!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setAviso(`Não foi possível extrair automaticamente o texto integral do PDF (${msg}).`)
      setEtapa('ficha')
      if (!numero) setNumero(`CT-${new Date().getFullYear()}/001`)
      if (!titulo) setTitulo(file.name.replace(/\.pdf$/i, ''))
    }
  }

  async function handleSalvar() {
    if (!numero.trim()) {
      toast.error('Informe o número ou identificador do contrato.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        numero: numero.trim(),
        titulo: titulo.trim() || `Contrato nº ${numero}`,
        tipo_contrato: tipoContrato,
        partes_envolvidas: partesEnvolvidas.trim(),
        objeto: objeto.trim(),
        valor_global: parseFloat(valorGlobal) || 0,
        forma_pagamento_texto: formaPagamentoTexto.trim(),
        data_assinatura: dataAssinatura ? `${dataAssinatura} 12:00:00.000Z` : null,
        data_inicio_vigencia: dataInicioVigencia ? `${dataInicioVigencia} 12:00:00.000Z` : null,
        data_termino_vigencia: dataTerminoVigencia ? `${dataTerminoVigencia} 12:00:00.000Z` : null,
        indice_reajuste: indiceReajuste.trim(),
        garante_fiador: garanteFiador.trim(),
        observacoes: observacoes.trim(),
      }

      if (clienteId && clienteId !== 'nenhum') payload.cliente = clienteId
      else payload.cliente = null

      if (fornecedorId && fornecedorId !== 'nenhum') payload.fornecedor = fornecedorId
      else payload.fornecedor = null

      if (projetoId && projetoId !== 'nenhum') payload.projeto = projetoId
      else payload.projeto = null

      let salvo: ContratoRecord

      if (contratoParaEditar?.id) {
        salvo = await updateOne<ContratoRecord>('contratos', contratoParaEditar.id, payload)
      } else {
        salvo = await createOne<ContratoRecord>('contratos', payload)
      }

      // Anexa o PDF como evidência se enviado
      if (arquivo && salvo.id) {
        const formData = new FormData()
        formData.append('arquivo_pdf', arquivo)
        await pb.collection('contratos').update(salvo.id, formData)
      }

      toast.success('Ficha do contrato salva com evidência anexada!')
      onSalvo(salvo)
      onOpenChange(false)
      resetar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar contrato: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetar()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded bg-orange-50 text-[#FF6A13]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                {contratoParaEditar
                  ? 'Editar Ficha do Contrato'
                  : 'Upload & Extração de Contrato (PDF)'}
              </DialogTitle>
              <p className="text-xs text-neutral-500">
                Extração de partes, objeto, valor global, cronograma e indexadores de reajuste com
                IA Skip Cloud
              </p>
            </div>
          </div>
        </DialogHeader>

        {etapa === 'upload' && !contratoParaEditar && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-dashed border-neutral-300 hover:border-[#FF6A13] transition p-8 text-center bg-neutral-50/50">
              <input
                id={uploadInputId}
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelected(f)
                }}
              />

              <div className="flex justify-center mb-3">
                <span className="p-3 rounded-full bg-orange-100 text-[#FF6A13]">
                  <Upload className="h-8 w-8" />
                </span>
              </div>

              <h4 className="font-semibold text-neutral-800 text-sm mb-1">
                Selecione o Contrato em PDF
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">
                O agente nativo faz a leitura integral das cláusulas, extrai as partes envolvidas,
                objeto, forma de parcelamento, índice de reajuste e anexa o PDF como evidência
                auditável.
              </p>

              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Carregar Contrato (PDF)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEtapa('ficha')}
                  className="text-xs border-neutral-300"
                >
                  Preencher Manualmente
                </Button>
              </div>
            </div>
          </div>
        )}

        {etapa === 'analisando' && (
          <div className="py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-orange-50 text-[#FF6A13] animate-pulse">
              <Sparkles className="h-10 w-10 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-800">
                Agente Contábil & Jurídico analisando PDF do Contrato...
              </h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Lendo cláusulas, partes contratantes, prazos de vigência e indexadores econômicos.
              </p>
            </div>
          </div>
        )}

        {(etapa === 'ficha' || contratoParaEditar) && (
          <div className="space-y-4 py-2">
            {aviso && (
              <Alert className="py-2 text-xs border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs font-semibold text-amber-900">Aviso</AlertTitle>
                <AlertDescription className="text-xs text-amber-800">{aviso}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Se houver arquivo selecionado, mostra prévia */}
              {previewUrl && (
                <div className="lg:col-span-5 flex flex-col rounded-lg border border-neutral-200 bg-neutral-900 overflow-hidden min-h-[380px] max-h-[580px]">
                  <div className="p-2 bg-neutral-800 text-neutral-300 text-xs flex items-center justify-between border-b border-neutral-700">
                    <span className="flex items-center gap-1.5 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{arquivo?.name}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-neutral-300 hover:text-white"
                      onClick={() => {
                        setEtapa('upload')
                        setArquivo(null)
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Trocar
                    </Button>
                  </div>
                  <iframe
                    src={previewUrl}
                    title="Prévia do Contrato PDF"
                    className="w-full h-full min-h-[480px] border-0 rounded bg-white"
                  />
                </div>
              )}

              {/* Ficha dos dados contratuais */}
              <div className={previewUrl ? 'lg:col-span-7 space-y-3' : 'lg:col-span-12 space-y-3'}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs font-semibold">Nº do Contrato *</Label>
                    <Input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="CT-2026/012"
                      className="h-8 text-xs font-mono font-semibold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">Título do Contrato / Escopo</Label>
                    <Input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Consultoria em Plano Básico de Zona Heliponto..."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tipo de Contrato</Label>
                    <Select value={tipoContrato} onValueChange={(val: any) => setTipoContrato(val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente (Receita AEROCAD)</SelectItem>
                        <SelectItem value="prestador_fornecedor">
                          Prestador / Subcontratado
                        </SelectItem>
                        <SelectItem value="parceria_tecnica">Parceria Técnica</SelectItem>
                        <SelectItem value="outro">Outro Instrumento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Cliente Vinculado</Label>
                    <Select
                      value={clienteId || 'nenhum'}
                      onValueChange={(val) => setClienteId(val === 'nenhum' ? '' : val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum / Não aplicável</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Projeto Vinculado</Label>
                    <Select
                      value={projetoId || 'nenhum'}
                      onValueChange={(val) => setProjetoId(val === 'nenhum' ? '' : val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o projeto..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem projeto específico</SelectItem>
                        {projetos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.numero} · {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Partes Envolvidas (Contratante & Contratada)
                  </Label>
                  <Input
                    value={partesEnvolvidas}
                    onChange={(e) => setPartesEnvolvidas(e.target.value)}
                    placeholder="Ex: AEROCAD Consultoria Aeroportuária Ltda (CNPJ...) e Concessionária X"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Objeto do Contrato</Label>
                  <Textarea
                    rows={2}
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    placeholder="Descrição detalhada do escopo dos serviços contratados..."
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Valor Global (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorGlobal}
                      onChange={(e) => setValorGlobal(e.target.value)}
                      placeholder="0,00"
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold">
                      Forma de Pagamento / Parcelamento
                    </Label>
                    <Input
                      value={formaPagamentoTexto}
                      onChange={(e) => setFormaPagamentoTexto(e.target.value)}
                      placeholder="Ex: 30% na assinatura + 70% na homologação do DECEA"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Data da Assinatura</Label>
                    <Input
                      type="date"
                      value={dataAssinatura}
                      onChange={(e) => setDataAssinatura(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Início da Vigência</Label>
                    <Input
                      type="date"
                      value={dataInicioVigencia}
                      onChange={(e) => setDataInicioVigencia(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Término da Vigência</Label>
                    <Input
                      type="date"
                      value={dataTerminoVigencia}
                      onChange={(e) => setDataTerminoVigencia(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Índice de Reajuste Anual</Label>
                    <Input
                      value={indiceReajuste}
                      onChange={(e) => setIndiceReajuste(e.target.value)}
                      placeholder="Ex: IPCA / IBGE ou IGPM a cada 12 meses"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Garante / Fiador / Seguro-Garantia</Label>
                    <Input
                      value={garanteFiador}
                      onChange={(e) => setGaranteFiador(e.target.value)}
                      placeholder="Fiador, seguro ou vazio se não houver"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {contratoParaEditar?.arquivo_pdf && !arquivo && (
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                    <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      PDF original do contrato arquivado como evidência.
                    </span>
                    <a
                      href={pb.files.getURL(contratoParaEditar, contratoParaEditar.arquivo_pdf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF6A13] font-semibold hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir PDF
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          {(etapa === 'ficha' || contratoParaEditar) && (
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleSalvar}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {isSubmitting ? 'Gravando...' : 'Salvar Ficha do Contrato'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
