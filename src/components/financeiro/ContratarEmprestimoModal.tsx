import React, { useState, useEffect, useMemo } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  gerarCronogramaParcelas,
  contratarOperacao,
  type DadosContratacaoEmprestimo,
} from '@/services/emprestimosFinanciamentosService'
import type {
  ContaBancariaRecord,
  CredorRecord,
  AtivoPatrimonioRecord,
  TipoEmprestimoFinanciamento,
  MetodoAmortizacao,
} from '@/types/crm'
import { Landmark, Car, Calculator, HelpCircle, CheckCircle2 } from 'lucide-react'

interface ContratarEmprestimoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contasBancarias: ContaBancariaRecord[]
  credores: CredorRecord[]
  ativosPatrimonio: AtivoPatrimonioRecord[]
  onSuccess: () => void
}

export function ContratarEmprestimoModal({
  open,
  onOpenChange,
  contasBancarias,
  credores,
  ativosPatrimonio,
  onSuccess,
}: ContratarEmprestimoModalProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  // Campos do formulário
  const [tipo, setTipo] = useState<TipoEmprestimoFinanciamento>('emprestimo_bancario')
  const [metodo, setMetodo] = useState<MetodoAmortizacao>('PRICE')
  const [numeroContrato, setNumeroContrato] = useState('')
  const [descricao, setDescricao] = useState('')
  const [credorId, setCredorId] = useState<string>('')
  const [bancoNome, setBancoNome] = useState('')
  const [dataContratacao, setDataContratacao] = useState(new Date().toISOString().slice(0, 10))
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [contaBancariaId, setContaBancariaId] = useState<string>('')
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(36)

  // Valores financeiros
  const [valorTotalBem, setValorTotalBem] = useState<number>(100000)
  const [valorEntrada, setValorEntrada] = useState<number>(20000)
  const [valorLiquido, setValorLiquido] = useState<number>(80000)
  const [taxaJurosMensal, setTaxaJurosMensal] = useState<number>(1.49)
  const [totalJurosManual, setTotalJurosManual] = useState<number>(0)
  const [bemDescricao, setBemDescricao] = useState('')
  const [ativoVinculadoId, setAtivoVinculadoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState('')

  // Ajusta automaticamente valor líquido ao mudar bem/entrada em financiamento de veículo
  useEffect(() => {
    if (tipo === 'financiamento_veiculo') {
      const financiado = Math.max(0, valorTotalBem - valorEntrada)
      setValorLiquido(financiado)
    }
  }, [tipo, valorTotalBem, valorEntrada])

  // Cronograma simulado em tempo real
  const cronogramaSimulado = useMemo(() => {
    if (valorLiquido <= 0 || quantidadeParcelas <= 0) return []
    return gerarCronogramaParcelas({
      valorPrincipal: valorLiquido,
      totalJurosPrefixados: totalJurosManual,
      quantidadeParcelas,
      taxaJurosMensal,
      dataPrimeiraParcela,
      metodoAmortizacao: metodo,
      dataBaseContratacao: dataContratacao,
    })
  }, [
    valorLiquido,
    totalJurosManual,
    quantidadeParcelas,
    taxaJurosMensal,
    dataPrimeiraParcela,
    metodo,
    dataContratacao,
  ])

  // Cálculos consolidados da simulação
  const totalPrincipalSimulado = useMemo(
    () => cronogramaSimulado.reduce((acc, p) => acc + p.valor_principal, 0),
    [cronogramaSimulado],
  )
  const totalJurosCalculado = useMemo(
    () => cronogramaSimulado.reduce((acc, p) => acc + p.valor_juros, 0),
    [cronogramaSimulado],
  )
  const totalDividaSimulada = useMemo(
    () => Math.round((totalPrincipalSimulado + totalJurosCalculado) * 100) / 100,
    [totalPrincipalSimulado, totalJurosCalculado],
  )
  const valorPrimeiraParcela = useMemo(
    () => (cronogramaSimulado.length > 0 ? cronogramaSimulado[0].valor_parcela : 0),
    [cronogramaSimulado],
  )

  const saldoCirculanteSimulado = useMemo(
    () =>
      cronogramaSimulado
        .filter((p) => p.classificacao_passivo === 'circulante')
        .reduce((acc, p) => acc + p.valor_principal, 0),
    [cronogramaSimulado],
  )
  const saldoNaoCirculanteSimulado = useMemo(
    () =>
      cronogramaSimulado
        .filter((p) => p.classificacao_passivo === 'nao_circulante')
        .reduce((acc, p) => acc + p.valor_principal, 0),
    [cronogramaSimulado],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!numeroContrato.trim()) {
      toast({
        title: 'Número do Contrato Obrigatório',
        description: 'Informe o número ou código de identificação do contrato bancário.',
        variant: 'destructive',
      })
      return
    }

    if (valorLiquido <= 0) {
      toast({
        title: 'Valor Inválido',
        description: 'O valor principal líquido financiado deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)

      const dados: DadosContratacaoEmprestimo = {
        numero_contrato: numeroContrato.trim(),
        descricao:
          descricao.trim() ||
          (tipo === 'financiamento_veiculo'
            ? `Financiamento ${bemDescricao || 'Veículo Operacional'}`
            : `Empréstimo ${bancoNome || 'Bancário'}`),
        tipo,
        metodo_amortizacao: metodo,
        credor_id: credorId || undefined,
        banco_nome: bancoNome || (tipo === 'financiamento_veiculo' ? 'BV Financeira' : 'Banco PJ'),
        data_contratacao: dataContratacao,
        valor_total_divida: totalDividaSimulada,
        valor_liquido_liberado: valorLiquido,
        total_juros_prefixados: totalJurosCalculado,
        taxa_juros_mensal: taxaJurosMensal,
        taxa_juros_anual: taxaJurosMensal * 12,
        quantidade_parcelas: quantidadeParcelas,
        valor_parcela: valorPrimeiraParcela,
        data_primeira_parcela: dataPrimeiraParcela,
        conta_bancaria_debito: contaBancariaId || undefined,
        bem_adquirido_descricao: tipo === 'financiamento_veiculo' ? bemDescricao : undefined,
        valor_total_bem: tipo === 'financiamento_veiculo' ? valorTotalBem : undefined,
        valor_entrada: tipo === 'financiamento_veiculo' ? valorEntrada : undefined,
        ativo_patrimonio_vinculado:
          tipo === 'financiamento_veiculo' ? ativoVinculadoId || undefined : undefined,
        observacoes,
      }

      const res = await contratarOperacao(dados)

      toast({
        title: 'Operação Contratada com Sucesso!',
        description: `Contrato nº ${res.contrato.numero_contrato} registrado. ${res.parcelas.length} parcelas e lançamentos de reconhecimento inicial gerados.`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao contratar operação:', err)
      toast({
        title: 'Erro ao salvar contrato',
        description: err.message || 'Verifique os dados preenchidos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A13]/10 text-[#FF6A13] flex items-center justify-center">
              {tipo === 'financiamento_veiculo' ? (
                <Car className="w-5 h-5 text-[#FF6A13]" />
              ) : (
                <Landmark className="w-5 h-5 text-[#FF6A13]" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-neutral-900">
                Nova Operação de Empréstimo ou Financiamento
              </DialogTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                Reconhecimento inicial contábil pelo regime de competência (Partidas Dobradas
                AEROCAD)
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* SELEÇÃO DE TIPO E MODALIDADE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Tipo de Operação</Label>
              <Select value={tipo} onValueChange={(v: TipoEmprestimoFinanciamento) => setTipo(v)}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emprestimo_bancario">
                    Empréstimo Bancário (Dinheiro em Conta)
                  </SelectItem>
                  <SelectItem value="financiamento_veiculo">
                    Financiamento de Veículo (Aquisição de Bem)
                  </SelectItem>
                  <SelectItem value="outras_modalidades">Outras Modalidades / Finame</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Método de Amortização
              </Label>
              <Select value={metodo} onValueChange={(v: MetodoAmortizacao) => setMetodo(v)}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRICE">Tabela PRICE (Parcelas Fixas)</SelectItem>
                  <SelectItem value="SAC">Sistema SAC (Amortização Constante)</SelectItem>
                  <SelectItem value="PREFIXADO_MANUAL">Pré-fixado Declarado em Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Nº do Contrato / Cédula
              </Label>
              <Input
                value={numeroContrato}
                onChange={(e) => setNumeroContrato(e.target.value)}
                placeholder="Ex: 2026-FIN-001 ou 045.892"
                className="mt-1 h-8 text-xs bg-white font-medium"
                required
              />
            </div>
          </div>

          {/* DADOS BANCÁRIOS E CREDOR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Instituição Financeira / Banco
              </Label>
              <Input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Santander, BV, Banco do Brasil, Bradesco"
                className="mt-1 h-8 text-xs bg-white"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Credor Cadastrado (Opcional)
              </Label>
              <Select value={credorId} onValueChange={setCredorId}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione credor se cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_credor">Nenhum / Cadastrado direto</SelectItem>
                  {credores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia || c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Conta Bancária de Movimentação PJ
              </Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_conta">Definir posteriormente</SelectItem>
                  {contasBancarias.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.apelido || cb.banco_nome} (Ag: {cb.agencia || '-'} / CC:{' '}
                      {cb.numero_conta || '-'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SE FINANCIAMENTO DE VEÍCULO: DADOS DO BEM E ENTRADA */}
          {tipo === 'financiamento_veiculo' && (
            <div className="p-3 bg-orange-50/60 rounded-lg border border-orange-200/80 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-[#FF6A13] text-xs">
                <Car className="w-4 h-4" />
                <span>Dados da Aquisição do Veículo (Ativo Imobilizado - Conta 1.2.4)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-medium text-neutral-700">
                    Descrição do Bem / Veículo
                  </Label>
                  <Input
                    value={bemDescricao}
                    onChange={(e) => setBemDescricao(e.target.value)}
                    placeholder="Ex: Camionete Hilux 4x4 Placa ABC-1234 (Operações de Campo)"
                    className="mt-1 h-8 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-neutral-700">
                    Valor Total do Bem (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorTotalBem}
                    onChange={(e) => setValorTotalBem(Number(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs bg-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-neutral-700">Entrada Paga (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorEntrada}
                    onChange={(e) => setValorEntrada(Number(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs bg-white font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VALORES DO FINANCIAMENTO / EMPRÉSTIMO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                {tipo === 'financiamento_veiculo'
                  ? 'Valor Financiado Líquido (R$)'
                  : 'Valor Líquido Liberado (R$)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={valorLiquido}
                onChange={(e) => setValorLiquido(Number(e.target.value) || 0)}
                className="mt-1 h-8 text-xs bg-white font-mono tabular-nums font-bold text-neutral-900"
                required
              />
              <span className="text-[10px] text-neutral-500">
                {tipo === 'financiamento_veiculo'
                  ? 'Total do Bem - Entrada'
                  : 'Creditado na conta PJ'}
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">Qtd. de Parcelas</Label>
              <Input
                type="number"
                min="1"
                max="360"
                value={quantidadeParcelas}
                onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value, 10) || 1)}
                className="mt-1 h-8 text-xs bg-white font-mono tabular-nums"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Taxa Juros Mensal (% a.m.)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={taxaJurosMensal}
                onChange={(e) => setTaxaJurosMensal(Number(e.target.value) || 0)}
                className="mt-1 h-8 text-xs bg-white font-mono tabular-nums"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                {metodo === 'PREFIXADO_MANUAL'
                  ? 'Juros Pré-Fixados Totais (R$)'
                  : 'Juros Totais Calculados'}
              </Label>
              {metodo === 'PREFIXADO_MANUAL' ? (
                <Input
                  type="number"
                  step="0.01"
                  value={totalJurosManual}
                  onChange={(e) => setTotalJurosManual(Number(e.target.value) || 0)}
                  className="mt-1 h-8 text-xs bg-white font-mono tabular-nums"
                />
              ) : (
                <div className="mt-1 h-8 px-2 flex items-center bg-neutral-100 rounded border border-neutral-200 text-xs font-mono font-bold text-neutral-800">
                  {formatCurrency(totalJurosCalculado)}
                </div>
              )}
            </div>
          </div>

          {/* DATAS DE CONTRATAÇÃO E PRIMEIRA PARCELA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-neutral-700">Data de Contratação</Label>
              <Input
                type="date"
                value={dataContratacao}
                onChange={(e) => setDataContratacao(e.target.value)}
                className="mt-1 h-8 text-xs bg-white font-mono"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-neutral-700">
                Vencimento da 1ª Parcela
              </Label>
              <Input
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                className="mt-1 h-8 text-xs bg-white font-mono"
                required
              />
            </div>
          </div>

          {/* RESUMO CONTÁBIL DAS PARTIDAS DOBRADAS (ETAPA 1) */}
          <div className="p-3 bg-neutral-900 text-neutral-100 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-bold border-b border-neutral-700 pb-1.5">
              <span className="flex items-center gap-1.5 text-[#FF6A13]">
                <Calculator className="w-4 h-4" />
                Resumo Contábil da Operação (Partidas Dobradas - Etapa 1)
              </span>
              <span className="font-mono text-neutral-300">
                1ª Parcela: {formatCurrency(valorPrimeiraParcela)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div className="bg-neutral-800/80 p-2 rounded border border-neutral-700/60">
                <span className="text-neutral-400 block text-[10px]">Total da Dívida</span>
                <span className="font-mono font-bold text-white text-xs">
                  {formatCurrency(totalDividaSimulada)}
                </span>
              </div>
              <div className="bg-neutral-800/80 p-2 rounded border border-neutral-700/60">
                <span className="text-neutral-400 block text-[10px]">Principal Financiado</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {formatCurrency(valorLiquido)}
                </span>
              </div>
              <div className="bg-neutral-800/80 p-2 rounded border border-neutral-700/60">
                <span className="text-neutral-400 block text-[10px]">Encargos a Apropriar</span>
                <span className="font-mono font-bold text-amber-400 text-xs">
                  {formatCurrency(totalJurosCalculado)}
                </span>
              </div>
              <div className="bg-neutral-800/80 p-2 rounded border border-neutral-700/60">
                <span className="text-neutral-400 block text-[10px]">
                  Circulante / Não Circulante
                </span>
                <span className="font-mono text-[10px] text-neutral-200 block">
                  C: {formatCurrency(saldoCirculanteSimulado)}
                </span>
                <span className="font-mono text-[10px] text-neutral-400 block">
                  NC: {formatCurrency(saldoNaoCirculanteSimulado)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-800 flex items-start gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {tipo === 'financiamento_veiculo'
                  ? 'Lançamento automático: D — Veículos (1.2.4) / D — Encargos Financeiros a Apropriar (2.1.8) / C — Financiamentos a Pagar (2.1.7/2.2.2) e baixa da entrada no banco.'
                  : 'Lançamento automático: D — Bancos PJ (1.1.1) / D — Encargos Financeiros a Apropriar (2.1.8) / C — Empréstimos a Pagar (2.1.6/2.2.1).'}
              </span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-neutral-700">Observações Contratuais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Cláusula de liquidação antecipada, alienação fiduciária do veículo, garantias prestadas."
              className="mt-1 h-16 text-xs bg-white"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="text-xs bg-[#FF6A13] hover:bg-[#E55A0A] text-white font-medium"
            >
              {salvando ? 'Processando Lançamentos...' : 'Confirmar Contratação (Etapa 1)'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
