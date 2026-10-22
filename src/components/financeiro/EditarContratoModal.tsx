import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
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
  editarContratoOperacao,
  type MetodoAmortizacao,
} from '@/services/emprestimosFinanciamentosService'
import type { EmprestimoFinanciamentoRecord, ContaBancariaRecord, CredorRecord } from '@/types/crm'
import { Pencil, AlertTriangle, RefreshCw, Landmark, Calculator, ShieldAlert } from 'lucide-react'
import { isUserAdmin } from '@/lib/crm'
import { useAuth } from '@/contexts/AuthContext'

interface EditarContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: EmprestimoFinanciamentoRecord | null
  contasBancarias: ContaBancariaRecord[]
  credores: CredorRecord[]
  onSuccess: () => void
}

export function EditarContratoModal({
  open,
  onOpenChange,
  contrato,
  contasBancarias,
  credores,
  onSuccess,
}: EditarContratoModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const ehAdmin = isUserAdmin(user)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Campos do formulário
  const [numeroContrato, setNumeroContrato] = useState('')
  const [descricao, setDescricao] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [credorId, setCredorId] = useState<string>('nenhum')
  const [metodoAmortizacao, setMetodoAmortizacao] = useState<MetodoAmortizacao>('PRICE')
  const [valorTotalDivida, setValorTotalDivida] = useState('')
  const [valorLiquidoLiberado, setValorLiquidoLiberado] = useState('')
  const [totalJurosPrefixados, setTotalJurosPrefixados] = useState('')
  const [taxaJurosMensal, setTaxaJurosMensal] = useState('')
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [dataContratacao, setDataContratacao] = useState('')
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState('')
  const [contaBancariaId, setContaBancariaId] = useState<string>('nenhuma')
  const [bemAdquiridoDescricao, setBemAdquiridoDescricao] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (contrato && open) {
      setNumeroContrato(contrato.numero_contrato || '')
      setDescricao(contrato.descricao || '')
      setBancoNome(contrato.banco_nome || '')
      setCredorId(contrato.credor || 'nenhum')
      setMetodoAmortizacao((contrato.metodo_amortizacao as MetodoAmortizacao) || 'PRICE')
      setValorTotalDivida(String(contrato.valor_total_divida ?? ''))
      setValorLiquidoLiberado(String(contrato.valor_liquido_liberado ?? ''))
      setTotalJurosPrefixados(String(contrato.total_juros_prefixados ?? ''))
      setTaxaJurosMensal(String(contrato.taxa_juros_mensal ?? ''))
      setQuantidadeParcelas(String(contrato.quantidade_parcelas ?? ''))
      setValorParcela(String(contrato.valor_parcela ?? ''))
      setDataContratacao(contrato.data_contratacao ? contrato.data_contratacao.slice(0, 10) : '')
      setDataPrimeiraParcela(
        contrato.data_primeira_parcela ? contrato.data_primeira_parcela.slice(0, 10) : '',
      )
      setContaBancariaId(contrato.conta_bancaria_debito || 'nenhuma')
      setBemAdquiridoDescricao(contrato.bem_adquirido_descricao || '')
      setObservacoes(contrato.observacoes || '')
      setErro(null)
    }
  }, [contrato, open])

  // Recalculo automático de juros ao alterar total da dívida ou líquido liberado
  const handleRecalcularJuros = () => {
    const tot = parseFloat(valorTotalDivida.replace(',', '.')) || 0
    const liq = parseFloat(valorLiquidoLiberado.replace(',', '.')) || 0
    if (tot > 0 && liq > 0 && tot >= liq) {
      setTotalJurosPrefixados((tot - liq).toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!ehAdmin) {
      setErro('Ação restrita: apenas administradores podem atualizar dados de contratos.')
      return
    }

    if (!contrato) return

    if (!numeroContrato.trim()) {
      setErro('O campo "Número do Contrato" é obrigatório.')
      return
    }

    if (!bancoNome.trim()) {
      setErro('O campo "Instituição / Banco" é obrigatório.')
      return
    }

    const valorLiq = parseFloat(valorLiquidoLiberado.replace(',', '.'))
    if (isNaN(valorLiq) || valorLiq <= 0) {
      setErro('O campo "Valor Líquido Liberado / Principal" deve ser um número maior que zero.')
      return
    }

    const valorTot = parseFloat(valorTotalDivida.replace(',', '.'))
    if (isNaN(valorTot) || valorTot < valorLiq) {
      setErro('O campo "Valor Total da Dívida" deve ser maior ou igual ao valor liberado.')
      return
    }

    const qtdParc = parseInt(quantidadeParcelas, 10)
    if (isNaN(qtdParc) || qtdParc < 1) {
      setErro('O campo "Quantidade de Parcelas" deve ser de no mínimo 1.')
      return
    }

    const txJuros = parseFloat(taxaJurosMensal.replace(',', '.')) || 0
    const vParc = parseFloat(valorParcela.replace(',', '.')) || 0
    const totalJuros =
      parseFloat(totalJurosPrefixados.replace(',', '.')) || Math.max(0, valorTot - valorLiq)

    try {
      setSalvando(true)
      const res = await editarContratoOperacao({
        dados: {
          contratoId: contrato.id,
          numero_contrato: numeroContrato.trim(),
          descricao: descricao.trim() || `Contrato ${numeroContrato.trim()}`,
          banco_nome: bancoNome.trim(),
          credor_id: credorId === 'nenhum' ? undefined : credorId,
          metodo_amortizacao: metodoAmortizacao,
          valor_total_divida: valorTot,
          valor_liquido_liberado: valorLiq,
          total_juros_prefixados: totalJuros,
          taxa_juros_mensal: txJuros,
          taxa_juros_anual: txJuros * 12,
          quantidade_parcelas: qtdParc,
          valor_parcela: vParc > 0 ? vParc : Math.round((valorTot / qtdParc) * 100) / 100,
          data_contratacao: dataContratacao || undefined,
          data_primeira_parcela: dataPrimeiraParcela || undefined,
          conta_bancaria_debito: contaBancariaId === 'nenhuma' ? undefined : contaBancariaId,
          bem_adquirido_descricao: bemAdquiridoDescricao.trim() || undefined,
          observacoes: observacoes.trim(),
        },
        usuarioId: user?.id,
      })

      toast({
        title: 'Contrato atualizado com sucesso',
        description: res.mensagem,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar alterações no contrato.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-neutral-900">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A13]/10 text-[#FF6A13] flex items-center justify-center">
              <Pencil className="w-4 h-4 text-[#FF6A13]" />
            </div>
            <span>Editar Contrato de Empréstimo / Financiamento</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            Atualize dados do contrato. Alterações que afetam valor, juros ou prazo regeneram as
            parcelas futuras mantendo integralmente o histórico das já pagas.
          </DialogDescription>
        </DialogHeader>

        {!ehAdmin && (
          <Alert variant="destructive" className="py-2.5">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Apenas administradores possuem permissão para alterar contratos financeiros e
              recalcular cronogramas.
            </AlertDescription>
          </Alert>
        )}

        {erro && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* Linha 1: Número do Contrato e Instituição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">
                Número do Contrato / CCB <span className="text-red-500">*</span>
              </Label>
              <Input
                value={numeroContrato}
                onChange={(e) => setNumeroContrato(e.target.value)}
                placeholder="Ex: 0033-8947291"
                className="h-8 text-xs font-mono"
                disabled={salvando || !ehAdmin}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">
                Instituição / Banco Credor <span className="text-red-500">*</span>
              </Label>
              <Input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Banco Santander, Banco do Brasil..."
                className="h-8 text-xs"
                disabled={salvando || !ehAdmin}
                required
              />
            </div>
          </div>

          {/* Linha 2: Descrição e Credor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">
                Descrição da Operação
              </Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Financiamento de Veículo Operacional Hilux"
                className="h-8 text-xs"
                disabled={salvando || !ehAdmin}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700">
                Credor Cadastrado (Opcional)
              </Label>
              <Select value={credorId} onValueChange={setCredorId} disabled={salvando || !ehAdmin}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione um credor..." />
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

          {/* Linha 3: Valores Financeiros */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-[#FF6A13]" />
                Condições Financeiras e Taxas
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRecalcularJuros}
                className="h-6 text-[11px] text-[#FF6A13] hover:text-[#E55A0A] p-1"
                title="Recalcular juros = Total da Dívida - Valor Líquido"
              >
                Recalcular juros
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Valor Líquido Liberado (Principal R$)
                </Label>
                <Input
                  value={valorLiquidoLiberado}
                  onChange={(e) => setValorLiquidoLiberado(e.target.value)}
                  placeholder="0,00"
                  className="h-8 text-xs font-mono tabular-nums"
                  disabled={salvando || !ehAdmin}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Total da Dívida (R$)
                </Label>
                <Input
                  value={valorTotalDivida}
                  onChange={(e) => setValorTotalDivida(e.target.value)}
                  placeholder="0,00"
                  className="h-8 text-xs font-mono tabular-nums"
                  disabled={salvando || !ehAdmin}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Total Juros Prefixados (R$)
                </Label>
                <Input
                  value={totalJurosPrefixados}
                  onChange={(e) => setTotalJurosPrefixados(e.target.value)}
                  placeholder="0,00"
                  className="h-8 text-xs font-mono tabular-nums text-amber-700 font-semibold"
                  disabled={salvando || !ehAdmin}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Taxa de Juros Mensal (% a.m.)
                </Label>
                <Input
                  value={taxaJurosMensal}
                  onChange={(e) => setTaxaJurosMensal(e.target.value)}
                  placeholder="Ex: 1.85"
                  className="h-8 text-xs font-mono tabular-nums"
                  disabled={salvando || !ehAdmin}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Qtd. de Parcelas Total
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={quantidadeParcelas}
                  onChange={(e) => setQuantidadeParcelas(e.target.value)}
                  placeholder="Ex: 36"
                  className="h-8 text-xs font-mono tabular-nums"
                  disabled={salvando || !ehAdmin}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Valor da Parcela / Prestação (R$)
                </Label>
                <Input
                  value={valorParcela}
                  onChange={(e) => setValorParcela(e.target.value)}
                  placeholder="0,00"
                  className="h-8 text-xs font-mono tabular-nums font-semibold"
                  disabled={salvando || !ehAdmin}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">
                  Regime de Amortização
                </Label>
                <Select
                  value={metodoAmortizacao}
                  onValueChange={(val: MetodoAmortizacao) => setMetodoAmortizacao(val)}
                  disabled={salvando || !ehAdmin}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRICE">PRICE (Prestações Fixas)</SelectItem>
                    <SelectItem value="SAC">SAC (Amortização Constante)</SelectItem>
                    <SelectItem value="PREFIXADO_MANUAL">Prefixado Uniforme</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">Data Contratação</Label>
                <Input
                  type="date"
                  value={dataContratacao}
                  onChange={(e) => setDataContratacao(e.target.value)}
                  className="h-8 text-xs font-mono"
                  disabled={salvando || !ehAdmin}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-neutral-600">Data 1ª Parcela</Label>
                <Input
                  type="date"
                  value={dataPrimeiraParcela}
                  onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                  className="h-8 text-xs font-mono"
                  disabled={salvando || !ehAdmin}
                />
              </div>
            </div>
          </div>

          {/* Linha 4: Conta Bancária e Bem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-neutral-700 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-neutral-500" />
                Conta Bancária Débito
              </Label>
              <Select
                value={contaBancariaId}
                onValueChange={setContaBancariaId}
                disabled={salvando || !ehAdmin}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione a conta de débito..." />
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
                Bem Financiado / Descrição do Ativo
              </Label>
              <Input
                value={bemAdquiridoDescricao}
                onChange={(e) => setBemAdquiridoDescricao(e.target.value)}
                placeholder="Ex: Veículo Fiat Strada Volcano 2024"
                className="h-8 text-xs"
                disabled={salvando || !ehAdmin}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-neutral-700">
              Observações / Justificativa da Alteração
            </Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva o motivo da atualização ou aditivo contratual..."
              rows={2}
              className="text-xs resize-none"
              disabled={salvando || !ehAdmin}
            />
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando || !ehAdmin}
              className="text-xs h-8 bg-[#FF6A13] hover:bg-[#E55A0A] text-white font-medium"
            >
              {salvando ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando e Recalculando...
                </>
              ) : (
                'Salvar e Atualizar Cronograma'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
