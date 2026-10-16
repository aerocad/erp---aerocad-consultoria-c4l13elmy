import { useState } from 'react'
import {
  Building2,
  Plus,
  Pencil,
  Power,
  Trash2,
  CheckCircle2,
  XCircle,
  Landmark,
  Wallet,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { CrmBadge } from '@/components/common/CrmBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import {
  salvarContaBancaria,
  alternarStatusContaBancaria,
  excluirContaBancaria,
  type ContaBancariaFormData,
} from '@/services/contasBancarias'
import type { ContaBancariaRecord } from '@/types/crm'

export interface ContasBancariasTabProps {
  contas: ContaBancariaRecord[]
  canWrite: boolean
  canDelete: boolean
  onReload: () => Promise<void> | void
}

const TIPO_CONTA_LABELS: Record<string, string> = {
  corrente_pj: 'Conta Corrente PJ',
  poupanca_pj: 'Poupança PJ',
  investimento_pj: 'Investimento / Aplicação PJ',
  outro: 'Outro Tipo PJ',
}

const BANCOS_SUGERIDOS = [
  { codigo: '001', nome: 'Banco do Brasil S.A.' },
  { codigo: '341', nome: 'Itaú Unibanco S.A.' },
  { codigo: '237', nome: 'Banco Bradesco S.A.' },
  { codigo: '033', nome: 'Banco Santander (Brasil) S.A.' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '077', nome: 'Banco Inter S.A.' },
  { codigo: '260', nome: 'Nubank (Nu Pagamentos S.A.)' },
  { codigo: '422', nome: 'Banco Safra S.A.' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '336', nome: 'Banco C6 S.A.' },
  { codigo: '212', nome: 'Banco Original S.A.' },
]

const FORM_DEFAULT: ContaBancariaFormData = {
  apelido: '',
  banco_nome: 'Banco do Brasil S.A.',
  banco_codigo: '001',
  agencia: '',
  numero_conta: '',
  tipo_conta: 'corrente_pj',
  chave_pix: '',
  saldo_inicial: 0,
  ativo: true,
  cor_identificacao: '#FF6A13',
  observacoes: '',
}

export function ContasBancariasTab({
  contas,
  canWrite,
  canDelete,
  onReload,
}: ContasBancariasTabProps) {
  const [modalFormAberto, setModalFormAberto] = useState(false)
  const [contaEmEdicao, setContaEmEdicao] = useState<ContaBancariaRecord | null>(null)
  const [formData, setFormData] = useState<ContaBancariaFormData>(FORM_DEFAULT)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [contaParaExcluir, setContaParaExcluir] = useState<ContaBancariaRecord | null>(null)
  const [isExcluindo, setIsExcluindo] = useState(false)

  // Estatísticas rápidas
  const totalContas = contas.length
  const totalAtivas = contas.filter((c) => c.ativo !== false).length
  const saldoInicialConsolidado = contas.reduce((acc, c) => acc + (c.saldo_inicial || 0), 0)

  function abrirModalCriacao() {
    setContaEmEdicao(null)
    setFormData(FORM_DEFAULT)
    setModalFormAberto(true)
  }

  function abrirModalEdicao(conta: ContaBancariaRecord) {
    setContaEmEdicao(conta)
    setFormData({
      apelido: conta.apelido,
      banco_nome: conta.banco_nome,
      banco_codigo: conta.banco_codigo || '',
      agencia: conta.agencia || '',
      numero_conta: conta.numero_conta,
      tipo_conta: conta.tipo_conta || 'corrente_pj',
      chave_pix: conta.chave_pix || '',
      saldo_inicial: conta.saldo_inicial || 0,
      ativo: conta.ativo !== false,
      cor_identificacao: conta.cor_identificacao || '#FF6A13',
      observacoes: conta.observacoes || '',
    })
    setModalFormAberto(true)
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.apelido.trim()) {
      toast.error('Informe o apelido da conta bancária (ex: Banco do Brasil PJ - Principal).')
      return
    }
    if (!formData.banco_nome.trim()) {
      toast.error('Informe a instituição bancária.')
      return
    }
    if (!formData.numero_conta.trim()) {
      toast.error('Informe o número da conta.')
      return
    }

    setIsSubmitting(true)
    try {
      await salvarContaBancaria(formData, contaEmEdicao?.id)
      toast.success(
        contaEmEdicao
          ? `Conta bancária "${formData.apelido}" atualizada com sucesso!`
          : `Conta bancária "${formData.apelido}" cadastrada com sucesso!`,
      )
      setModalFormAberto(false)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar conta: ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAlternarStatus(conta: ContaBancariaRecord) {
    const novoStatus = !(conta.ativo !== false)
    try {
      await alternarStatusContaBancaria(conta.id, novoStatus)
      toast.success(
        `Conta "${conta.apelido}" foi ${novoStatus ? 'ativada' : 'desativada'} com sucesso!`,
      )
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao alterar status da conta: ${msg}`)
    }
  }

  async function handleConfirmarExclusao() {
    if (!contaParaExcluir) return
    setIsExcluindo(true)
    try {
      await excluirContaBancaria(contaParaExcluir.id)
      toast.success(`Conta bancária "${contaParaExcluir.apelido}" excluída com sucesso!`)
      setContaParaExcluir(null)
      await onReload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setIsExcluindo(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Topo / Banner de Identidade Técnica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 crm-card p-4 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/30 border-orange-200">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FF6A13] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-neutral-900 text-base">Contas Bancárias da AEROCAD</h3>
              <span className="inline-flex items-center rounded-full bg-orange-100 text-[#D65100] px-2 py-0.5 text-[10px] font-bold">
                Pessoa Jurídica
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5">
              Gestão das contas correntes, poupanças e aplicações PJ utilizadas em lançamentos,
              pagamento de fornecedores e conciliação de extratos.
            </p>
          </div>
        </div>

        {canWrite && (
          <Button
            size="sm"
            onClick={abrirModalCriacao}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold shadow-xs shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova Conta Bancária
          </Button>
        )}
      </div>

      {/* Cartões de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="crm-card p-3.5 border-orange-200 bg-orange-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-[#D65100] uppercase tracking-wider">
            <span>Total de Contas</span>
            <Wallet className="h-4 w-4 text-[#FF6A13]" />
          </div>
          <p className="mono-value mt-1.5 text-2xl font-bold text-neutral-900">{totalContas}</p>
          <span className="text-[11px] text-neutral-500">{totalAtivas} ativa(s) no sistema</span>
        </div>

        <div className="crm-card p-3.5 border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Contas Ativas</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mono-value mt-1.5 text-2xl font-bold text-emerald-700">{totalAtivas}</p>
          <span className="text-[11px] text-neutral-500">
            Disponíveis para lançamentos e extratos
          </span>
        </div>

        <div className="crm-card p-3.5 border-neutral-200 bg-white">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            <span>Saldos Iniciais Registrados</span>
            <Building2 className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mono-value mt-1.5 text-2xl font-bold text-neutral-900">
            {formatCurrency(saldoInicialConsolidado)}
          </p>
          <span className="text-[11px] text-neutral-500">Soma dos saldos iniciais de abertura</span>
        </div>
      </div>

      {/* Lista / Grid de Contas Bancárias */}
      {contas.length === 0 ? (
        <div className="crm-card p-12 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-orange-100 text-[#FF6A13] flex items-center justify-center">
            <Landmark className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-neutral-900 text-sm">Nenhuma conta bancária cadastrada</h4>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Cadastre as contas bancárias da AEROCAD para alimentar seletores de pagamento,
            relatórios contábeis e conciliação de extratos OFX/CSV.
          </p>
          {canWrite && (
            <Button
              size="sm"
              onClick={abrirModalCriacao}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold text-xs mt-2"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Cadastrar Primeira Conta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((conta) => {
            const isAtiva = conta.ativo !== false
            return (
              <div
                key={conta.id}
                className={`crm-card p-4 transition flex flex-col justify-between border-2 ${
                  isAtiva
                    ? 'border-neutral-200 hover:border-orange-300'
                    : 'border-neutral-200/60 bg-neutral-50/60 opacity-80'
                }`}
                style={{
                  borderTopColor: conta.cor_identificacao || '#FF6A13',
                  borderTopWidth: 4,
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: conta.cor_identificacao || '#FF6A13' }}
                        />
                        <h4 className="font-bold text-neutral-900 text-sm line-clamp-1">
                          {conta.apelido}
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-600 font-medium">
                        {conta.banco_nome}
                        {conta.banco_codigo ? ` (${conta.banco_codigo})` : ''}
                      </p>
                    </div>

                    <CrmBadge tone={isAtiva ? 'green' : 'gray'}>
                      {isAtiva ? 'Ativa' : 'Inativa'}
                    </CrmBadge>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-neutral-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Tipo:</span>
                      <span className="font-medium text-neutral-800">
                        {TIPO_CONTA_LABELS[conta.tipo_conta] || conta.tipo_conta}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Agência / Conta:</span>
                      <span className="font-mono font-semibold text-neutral-900">
                        {conta.agencia ? `${conta.agencia} / ` : ''}
                        {conta.numero_conta}
                      </span>
                    </div>

                    {conta.chave_pix && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Chave PIX:</span>
                        <span
                          className="font-mono text-neutral-700 truncate max-w-[170px]"
                          title={conta.chave_pix}
                        >
                          {conta.chave_pix}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-neutral-500">Saldo Inicial:</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {formatCurrency(conta.saldo_inicial || 0)}
                      </span>
                    </div>

                    {conta.observacoes && (
                      <p className="text-[11px] text-neutral-500 pt-1 line-clamp-2 italic">
                        {conta.observacoes.replace(/<[^>]*>/g, '')}
                      </p>
                    )}
                  </div>
                </div>

                {canWrite && (
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAlternarStatus(conta)}
                      title={isAtiva ? 'Desativar conta' : 'Ativar conta'}
                      className={`h-7 px-2 text-xs ${
                        isAtiva
                          ? 'text-neutral-600 hover:text-amber-700 hover:bg-amber-50'
                          : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5 mr-1" />
                      {isAtiva ? 'Desativar' : 'Ativar'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalEdicao(conta)}
                      className="h-7 px-2 text-xs border-neutral-300 hover:border-orange-300"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>

                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setContaParaExcluir(conta)}
                        className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Excluir conta bancária"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Conta Bancária */}
      <Dialog open={modalFormAberto} onOpenChange={setModalFormAberto}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[#FF6A13]" />
              {contaEmEdicao ? 'Editar Conta Bancária' : 'Nova Conta Bancária AEROCAD'}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Cadastre os dados cadastrais da conta bancária PJ para uso contábil, pagamentos e
              extratos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3.5 text-xs pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Apelido de Identificação *</Label>
              <Input
                required
                value={formData.apelido}
                onChange={(e) => setFormData((prev) => ({ ...prev, apelido: e.target.value }))}
                placeholder="Ex: Banco do Brasil PJ (Principal), Itaú Operacional, Inter PJ"
                className="text-xs h-9"
              />
              <p className="text-[10px] text-neutral-500">
                Nome amigável exibido nos seletores de lançamentos e filtros de relatórios.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Instituição Bancária *</Label>
                <Select
                  value={formData.banco_nome}
                  onValueChange={(val) => {
                    const bancoObj = BANCOS_SUGERIDOS.find((b) => b.nome === val)
                    setFormData((prev) => ({
                      ...prev,
                      banco_nome: val,
                      banco_codigo: bancoObj?.codigo || prev.banco_codigo,
                    }))
                  }}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecione o banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS_SUGERIDOS.map((b) => (
                      <SelectItem key={b.nome} value={b.nome}>
                        {b.codigo} · {b.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="Outro Banco">Outra Instituição</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Código Compe / Banco</Label>
                <Input
                  value={formData.banco_codigo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, banco_codigo: e.target.value }))
                  }
                  placeholder="Ex: 001, 341, 077"
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {formData.banco_nome === 'Outro Banco' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome da Instituição *</Label>
                <Input
                  required
                  placeholder="Nome do banco ou cooperativa de crédito..."
                  value={formData.banco_nome === 'Outro Banco' ? '' : formData.banco_nome}
                  onChange={(e) => setFormData((prev) => ({ ...prev, banco_nome: e.target.value }))}
                  className="text-xs h-9"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Agência</Label>
                <Input
                  value={formData.agencia}
                  onChange={(e) => setFormData((prev) => ({ ...prev, agencia: e.target.value }))}
                  placeholder="Ex: 1607-1"
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Número da Conta *</Label>
                <Input
                  required
                  value={formData.numero_conta}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, numero_conta: e.target.value }))
                  }
                  placeholder="Ex: 34567-8"
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Conta *</Label>
                <Select
                  value={formData.tipo_conta}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, tipo_conta: val }))
                  }
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente_pj">Conta Corrente PJ</SelectItem>
                    <SelectItem value="poupanca_pj">Poupança PJ</SelectItem>
                    <SelectItem value="investimento_pj">Investimento / Aplicação PJ</SelectItem>
                    <SelectItem value="outro">Outro Tipo PJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chave PIX Principal</Label>
                <Input
                  value={formData.chave_pix}
                  onChange={(e) => setFormData((prev) => ({ ...prev, chave_pix: e.target.value }))}
                  placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Saldo Inicial de Abertura (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.saldo_inicial || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      saldo_inicial: e.target.value ? parseFloat(e.target.value) : 0,
                    }))
                  }
                  placeholder="0,00"
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-neutral-500">
                  Saldo de partida do extrato/contabilidade.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cor de Identificação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.cor_identificacao || '#FF6A13'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, cor_identificacao: e.target.value }))
                    }
                    className="h-9 w-14 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.cor_identificacao}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, cor_identificacao: e.target.value }))
                    }
                    placeholder="#FF6A13"
                    className="text-xs h-9 font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações / Finalidade</Label>
              <Textarea
                rows={2}
                value={formData.observacoes}
                onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Finalidade operacional, limites, gerentes de conta, etc."
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="ativo-chk"
                checked={formData.ativo}
                onChange={(e) => setFormData((prev) => ({ ...prev, ativo: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-[#FF6A13] focus:ring-[#FF6A13]"
              />
              <Label htmlFor="ativo-chk" className="text-xs font-medium cursor-pointer">
                Conta ativa (disponível para novos lançamentos e conciliações)
              </Label>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalFormAberto(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Conta Bancária'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={!!contaParaExcluir}
        onOpenChange={(aberto) => !aberto && setContaParaExcluir(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Excluir Conta Bancária
            </DialogTitle>
          </DialogHeader>

          {contaParaExcluir && (
            <div className="space-y-3 text-xs text-neutral-600">
              <p>
                Deseja realmente excluir a conta bancária{' '}
                <strong className="text-neutral-900">{contaParaExcluir.apelido}</strong> (
                {contaParaExcluir.banco_nome})?
              </p>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold">Aviso de Integridade:</p>
                <p>
                  A exclusão só é permitida se não houver contas a pagar, contas a receber ou
                  extratos vinculados. Se houver histórico, desative a conta em vez de excluí-la.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setContaParaExcluir(null)}
              disabled={isExcluindo}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarExclusao}
              disabled={isExcluindo}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              {isExcluindo ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
