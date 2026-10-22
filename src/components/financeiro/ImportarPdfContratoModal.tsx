import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  extrairPdfEmprestimoBackend,
  contratarOperacao,
  sobreporContratoComPdf,
  type DadosExtracaoPdfEmprestimo,
  type MetodoAmortizacao,
} from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoFinanciamentoRecord, ContaBancariaRecord, CredorRecord } from '@/types/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Upload,
  FileText,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Landmark,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'
import { isUserAdmin } from '@/lib/crm'
import { useAuth } from '@/contexts/AuthContext'

interface ImportarPdfContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratosExistentes: EmprestimoFinanciamentoRecord[]
  contasBancarias: ContaBancariaRecord[]
  credores: CredorRecord[]
  onSuccess: () => void
}

export function ImportarPdfContratoModal({
  open,
  onOpenChange,
  contratosExistentes,
  contasBancarias,
  credores,
  onSuccess,
}: ImportarPdfContratoModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const ehAdmin = isUserAdmin(user)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Etapa: 'upload' ou 'revisao'
  const [etapa, setEtapa] = useState<'upload' | 'revisao'>('upload')

  // Ação de gravação: 'criar_novo' ou 'sobrepor_existente'
  const [modoGravacao, setModoGravacao] = useState<'criar_novo' | 'sobrepor_existente'>(
    'criar_novo',
  )
  const [contratoParaSobreporId, setContratoParaSobreporId] = useState<string>('')

  // Dados extraídos e editáveis na revisão
  const [bancoNome, setBancoNome] = useState('')
  const [numeroContrato, setNumeroContrato] = useState('')
  const [tipo, setTipo] = useState<
    'emprestimo_bancario' | 'financiamento_veiculo' | 'outras_modalidades'
  >('emprestimo_bancario')
  const [metodoAmortizacao, setMetodoAmortizacao] = useState<MetodoAmortizacao>('PRICE')
  const [valorTotalDivida, setValorTotalDivida] = useState('')
  const [valorLiquidoLiberado, setValorLiquidoLiberado] = useState('')
  const [totalJurosPrefixados, setTotalJurosPrefixados] = useState('')
  const [taxaJurosMensal, setTaxaJurosMensal] = useState('')
  const [taxaJurosAnual, setTaxaJurosAnual] = useState('')
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [valorEntrada, setValorEntrada] = useState('')
  const [bemAdquiridoDescricao, setBemAdquiridoDescricao] = useState('')
  const [dataContratacao, setDataContratacao] = useState('')
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState('')
  const [contaBancariaId, setContaBancariaId] = useState<string>('nenhuma')
  const [credorId, setCredorId] = useState<string>('nenhum')
  const [parcelasExtraidas, setParcelasExtraidas] = useState<
    DadosExtracaoPdfEmprestimo['parcelas']
  >([])

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setErro('O arquivo deve ser um documento em formato PDF.')
        return
      }
      setArquivo(file)
      setErro(null)
    }
  }

  const handleProcessarPdf = async () => {
    if (!arquivo) {
      setErro('Selecione um arquivo PDF de contrato ou carnê para continuar.')
      return
    }

    if (!ehAdmin) {
      setErro('Ação restrita: apenas administradores podem importar contratos ou carnês.')
      return
    }

    try {
      setAnalisando(true)
      setErro(null)
      setAviso(null)

      const res = await extrairPdfEmprestimoBackend(arquivo)
      const d = res.dados

      setBancoNome(d.banco_nome || '')
      setNumeroContrato(d.numero_contrato || '')
      setTipo(d.tipo || 'emprestimo_bancario')
      setMetodoAmortizacao(d.metodo_amortizacao || 'PRICE')
      setValorTotalDivida(d.valor_total_divida ? String(d.valor_total_divida) : '')
      setValorLiquidoLiberado(d.valor_liquido_liberado ? String(d.valor_liquido_liberado) : '')
      setTotalJurosPrefixados(d.total_juros_prefixados ? String(d.total_juros_prefixados) : '')
      setTaxaJurosMensal(d.taxa_juros_mensal ? String(d.taxa_juros_mensal) : '')
      setTaxaJurosAnual(d.taxa_juros_anual ? String(d.taxa_juros_anual) : '')
      setQuantidadeParcelas(d.quantidade_parcelas ? String(d.quantidade_parcelas) : '12')
      setValorParcela(d.valor_parcela ? String(d.valor_parcela) : '')
      setValorEntrada(d.valor_entrada ? String(d.valor_entrada) : '')
      setBemAdquiridoDescricao(d.bem_adquirido_descricao || '')
      setDataContratacao(d.data_contratacao || new Date().toISOString().slice(0, 10))
      setDataPrimeiraParcela(d.data_primeira_parcela || new Date().toISOString().slice(0, 10))
      setParcelasExtraidas(d.parcelas || [])

      if (d.aviso || res.aviso) {
        setAviso(d.aviso || res.aviso || null)
      }

      // Se existir contrato com número semelhante, pré-seleciona para sobreposição sugerida
      const encontrado = contratosExistentes.find(
        (c) =>
          d.numero_contrato &&
          (c.numero_contrato.toLowerCase() === d.numero_contrato.toLowerCase() ||
            c.numero_contrato.includes(d.numero_contrato)),
      )
      if (encontrado) {
        setModoGravacao('sobrepor_existente')
        setContratoParaSobreporId(encontrado.id)
      } else {
        setModoGravacao('criar_novo')
      }

      setEtapa('revisao')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na leitura do PDF pela IA.'
      setErro(msg)
    } finally {
      setAnalisando(false)
    }
  }

  const handleSalvar = async () => {
    setErro(null)

    if (!ehAdmin) {
      setErro('Ação restrita: apenas administradores podem gravar ou sobrepor contratos.')
      return
    }

    if (!bancoNome.trim()) {
      setErro('O campo "Instituição / Banco" é obrigatório.')
      return
    }

    if (!numeroContrato.trim()) {
      setErro('O campo "Número do Contrato" é obrigatório.')
      return
    }

    const vTot = parseFloat(valorTotalDivida.replace(',', '.')) || 0
    const vLiq = parseFloat(valorLiquidoLiberado.replace(',', '.')) || 0
    const qtd = parseInt(quantidadeParcelas, 10) || 1
    const tx = parseFloat(taxaJurosMensal.replace(',', '.')) || 0
    const vParc = parseFloat(valorParcela.replace(',', '.')) || (qtd > 0 ? vTot / qtd : 0)
    const jurosTot = parseFloat(totalJurosPrefixados.replace(',', '.')) || Math.max(0, vTot - vLiq)

    if (vTot <= 0) {
      setErro('O valor total da dívida deve ser maior que zero.')
      return
    }

    try {
      setSalvando(true)

      const dadosCompilados: DadosExtracaoPdfEmprestimo = {
        banco_nome: bancoNome.trim(),
        numero_contrato: numeroContrato.trim(),
        tipo,
        metodo_amortizacao: metodoAmortizacao,
        valor_total_divida: vTot,
        valor_liquido_liberado: vLiq > 0 ? vLiq : vTot,
        total_juros_prefixados: jurosTot,
        taxa_juros_mensal: tx,
        taxa_juros_anual: tx * 12,
        quantidade_parcelas: qtd,
        valor_parcela: Math.round(vParc * 100) / 100,
        valor_entrada: parseFloat(valorEntrada.replace(',', '.')) || 0,
        bem_adquirido_descricao: bemAdquiridoDescricao.trim() || undefined,
        data_contratacao: dataContratacao || new Date().toISOString().slice(0, 10),
        data_primeira_parcela: dataPrimeiraParcela || new Date().toISOString().slice(0, 10),
        parcelas: parcelasExtraidas,
      }

      if (modoGravacao === 'sobrepor_existente') {
        if (!contratoParaSobreporId) {
          setErro('Selecione qual contrato existente você deseja sobrepor.')
          setSalvando(false)
          return
        }

        const res = await sobreporContratoComPdf({
          contratoId: contratoParaSobreporId,
          dadosExtraidos: dadosCompilados,
          usuarioId: user?.id,
        })

        toast({
          title: 'Contrato sobreposto com sucesso',
          description: res.mensagem,
        })
      } else {
        // Criar contrato novo via contratarOperacao
        const res = await contratarOperacao({
          numero_contrato: dadosCompilados.numero_contrato,
          descricao:
            dadosCompilados.tipo === 'financiamento_veiculo'
              ? `Financiamento ${dadosCompilados.bem_adquirido_descricao || 'Veículo'} (${dadosCompilados.banco_nome})`
              : `Empréstimo Bancário ${dadosCompilados.banco_nome}`,
          tipo: dadosCompilados.tipo,
          metodo_amortizacao: dadosCompilados.metodo_amortizacao,
          credor_id: credorId === 'nenhum' ? undefined : credorId,
          banco_nome: dadosCompilados.banco_nome,
          data_contratacao: dadosCompilados.data_contratacao,
          valor_total_divida: dadosCompilados.valor_total_divida,
          valor_liquido_liberado: dadosCompilados.valor_liquido_liberado,
          total_juros_prefixados: dadosCompilados.total_juros_prefixados,
          taxa_juros_mensal: dadosCompilados.taxa_juros_mensal,
          taxa_juros_anual: dadosCompilados.taxa_juros_anual,
          quantidade_parcelas: dadosCompilados.quantidade_parcelas,
          valor_parcela: dadosCompilados.valor_parcela,
          data_primeira_parcela: dadosCompilados.data_primeira_parcela,
          conta_bancaria_debito: contaBancariaId === 'nenhuma' ? undefined : contaBancariaId,
          bem_adquirido_descricao: dadosCompilados.bem_adquirido_descricao,
          valor_entrada: dadosCompilados.valor_entrada,
          observacoes: `[IMPORTADO VIA PDF INTELIGENTE] Arquivo: ${arquivo?.name || 'contrato.pdf'}.`,
        })

        toast({
          title: 'Novo contrato criado via PDF',
          description: `Contrato nº ${res.contrato.numero_contrato} cadastrado com ${res.parcelas.length} parcelas geradas.`,
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gravar contrato a partir do PDF.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleReset = () => {
    setEtapa('upload')
    setArquivo(null)
    setErro(null)
    setAviso(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-neutral-900">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A13]/10 text-[#FF6A13] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#FF6A13]" />
            </div>
            <span>Importar Carnê ou Contrato em PDF (IA)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            Extraia automaticamente banco, parcelas, juros e prazos de contratos bancários ou carnês
            em PDF. Revise antes de gravar ou sobrepor um contrato existente.
          </DialogDescription>
        </DialogHeader>

        {!ehAdmin && (
          <Alert variant="destructive" className="py-2.5">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Apenas administradores possuem autorização para importar carnês e contratos de
              empréstimo.
            </AlertDescription>
          </Alert>
        )}

        {erro && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        {aviso && (
          <Alert className="py-2.5 bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">{aviso}</AlertDescription>
          </Alert>
        )}

        {etapa === 'upload' ? (
          <div className="space-y-4 py-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 hover:border-[#FF6A13] rounded-xl p-8 text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-orange-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleArquivoChange}
              />
              <div className="w-12 h-12 rounded-full bg-orange-100 text-[#FF6A13] flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-800">
                {arquivo ? arquivo.name : 'Clique para selecionar o contrato ou carnê em PDF'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Suporta CCB bancária, contratos de leasing/CDC, carnês de parcelas com tabela
                PRICE/SAC.
              </p>
              {arquivo && (
                <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{(arquivo.size / 1024).toFixed(1)} KB pronto para processamento</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleProcessarPdf}
                disabled={!arquivo || analisando || !ehAdmin}
                className="text-xs h-8 bg-[#FF6A13] hover:bg-[#E55A0A] text-white font-medium"
              >
                {analisando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Lendo e interpretando documento com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Extrair Dados do PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Destino da Gravação */}
            <div className="p-3 bg-neutral-100/70 rounded-lg border border-neutral-200 space-y-2">
              <Label className="text-xs font-bold text-neutral-800">
                Destino da Gravação dos Dados Extraídos:
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded bg-white border border-neutral-200 cursor-pointer">
                  <input
                    type="radio"
                    name="modoGravacao"
                    checked={modoGravacao === 'criar_novo'}
                    onChange={() => setModoGravacao('criar_novo')}
                    className="text-[#FF6A13] focus:ring-[#FF6A13]"
                  />
                  <div>
                    <span className="font-semibold block text-neutral-900">
                      Cadastrar Novo Contrato
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Cria registro e partidas iniciais
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-white border border-neutral-200 cursor-pointer">
                  <input
                    type="radio"
                    name="modoGravacao"
                    checked={modoGravacao === 'sobrepor_existente'}
                    onChange={() => setModoGravacao('sobrepor_existente')}
                    className="text-[#FF6A13] focus:ring-[#FF6A13]"
                  />
                  <div>
                    <span className="font-semibold block text-neutral-900">
                      Sobrepor Contrato Existente
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Atualiza e regenera cronograma futuro
                    </span>
                  </div>
                </label>
              </div>

              {modoGravacao === 'sobrepor_existente' && (
                <div className="pt-1.5">
                  <Label className="text-[11px] font-semibold text-neutral-700">
                    Selecione o contrato existente a ser sobreposto:
                  </Label>
                  <Select value={contratoParaSobreporId} onValueChange={setContratoParaSobreporId}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Escolha o contrato para sobrepor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contratosExistentes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero_contrato} - {c.banco_nome} (Dívida:{' '}
                          {formatCurrency(c.valor_total_divida)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Tela de Revisão Editável */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  Conferência e Ajuste dos Dados Extraídos
                </span>
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pronto para revisão
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">
                    Instituição / Banco <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={bancoNome}
                    onChange={(e) => setBancoNome(e.target.value)}
                    className="h-8 text-xs"
                    disabled={salvando}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">
                    Número do Contrato <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={numeroContrato}
                    onChange={(e) => setNumeroContrato(e.target.value)}
                    className="h-8 text-xs font-mono"
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Tipo de Operação
                  </Label>
                  <Select
                    value={tipo}
                    onValueChange={(val: any) => setTipo(val)}
                    disabled={salvando}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emprestimo_bancario">Empréstimo Bancário</SelectItem>
                      <SelectItem value="financiamento_veiculo">Financiamento Veículo</SelectItem>
                      <SelectItem value="outras_modalidades">Outras Modalidades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Regime de Amortização
                  </Label>
                  <Select
                    value={metodoAmortizacao}
                    onValueChange={(val: MetodoAmortizacao) => setMetodoAmortizacao(val)}
                    disabled={salvando}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICE">PRICE (Fixas)</SelectItem>
                      <SelectItem value="SAC">SAC (Decrescentes)</SelectItem>
                      <SelectItem value="PREFIXADO_MANUAL">Prefixado Uniforme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Qtd. de Parcelas
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantidadeParcelas}
                    onChange={(e) => setQuantidadeParcelas(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Valor Líquido / Principal (R$)
                  </Label>
                  <Input
                    value={valorLiquidoLiberado}
                    onChange={(e) => setValorLiquidoLiberado(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    disabled={salvando}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Total da Dívida (R$)
                  </Label>
                  <Input
                    value={valorTotalDivida}
                    onChange={(e) => setValorTotalDivida(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums font-semibold"
                    disabled={salvando}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Valor Prestação (R$)
                  </Label>
                  <Input
                    value={valorParcela}
                    onChange={(e) => setValorParcela(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Taxa Mensal (% a.m.)
                  </Label>
                  <Input
                    value={taxaJurosMensal}
                    onChange={(e) => setTaxaJurosMensal(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    disabled={salvando}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Data Contratação
                  </Label>
                  <Input
                    type="date"
                    value={dataContratacao}
                    onChange={(e) => setDataContratacao(e.target.value)}
                    className="h-8 text-xs font-mono"
                    disabled={salvando}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-neutral-600">
                    Data 1ª Parcela
                  </Label>
                  <Input
                    type="date"
                    value={dataPrimeiraParcela}
                    onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                    className="h-8 text-xs font-mono"
                    disabled={salvando}
                  />
                </div>
              </div>

              {/* Se for veículo */}
              {tipo === 'financiamento_veiculo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Descrição do Veículo / Bem
                    </Label>
                    <Input
                      value={bemAdquiridoDescricao}
                      onChange={(e) => setBemAdquiridoDescricao(e.target.value)}
                      placeholder="Ex: Fiat Toro Freedom 2024"
                      className="h-8 text-xs"
                      disabled={salvando}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Valor Entrada (R$)
                    </Label>
                    <Input
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(e.target.value)}
                      placeholder="0,00"
                      className="h-8 text-xs font-mono tabular-nums"
                      disabled={salvando}
                    />
                  </div>
                </div>
              )}

              {/* Vínculo Bancário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5 text-neutral-500" />
                    Conta Bancária de Débito
                  </Label>
                  <Select
                    value={contaBancariaId}
                    onValueChange={setContaBancariaId}
                    disabled={salvando}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione a conta..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma conta vinculada</SelectItem>
                      {contasBancarias.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id}>
                          {cb.banco_nome} (Ag: {cb.agencia} / CC: {cb.conta_numero})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-neutral-700">
                    Credor no CRM (Opcional)
                  </Label>
                  <Select value={credorId} onValueChange={setCredorId} disabled={salvando}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Vincular credor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum credor vinculado</SelectItem>
                      {credores.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.razao_social || cr.nome_fantasia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabela de parcelas lidas do carnê (se houver) */}
              {parcelasExtraidas && parcelasExtraidas.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <span className="font-semibold flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      {parcelasExtraidas.length} parcelas identificadas no carnê/documento
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto border border-neutral-200 rounded p-2 text-[11px] font-mono space-y-1 bg-neutral-50/50">
                    {parcelasExtraidas.slice(0, 20).map((p, idx) => (
                      <div key={idx} className="flex justify-between text-neutral-700">
                        <span>
                          Parc. #{p.numero_parcela} (Venc:{' '}
                          {p.data_vencimento ? formatDate(p.data_vencimento.slice(0, 10)) : '—'})
                        </span>
                        <span className="font-semibold">{formatCurrency(p.valor_parcela)}</span>
                      </div>
                    ))}
                    {parcelasExtraidas.length > 20 && (
                      <div className="text-[10px] text-neutral-400 italic text-center">
                        ... e mais {parcelasExtraidas.length - 20} parcelas adicionais
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={salvando}
                className="text-xs h-8"
              >
                Voltar / Outro Arquivo
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSalvar}
                disabled={salvando || !ehAdmin}
                className="text-xs h-8 bg-[#FF6A13] hover:bg-[#E55A0A] text-white font-medium"
              >
                {salvando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Gravando dados...
                  </>
                ) : modoGravacao === 'sobrepor_existente' ? (
                  'Confirmar e Sobrepor Contrato'
                ) : (
                  'Confirmar e Cadastrar Contrato'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
