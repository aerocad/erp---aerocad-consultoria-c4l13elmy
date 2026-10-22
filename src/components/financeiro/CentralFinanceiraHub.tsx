import type { ReactNode } from 'react'
import {
  CreditCard,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  Scale,
  BarChart3,
  Layers,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Building2,
  BookOpen,
  Calculator,
  ExternalLink,
  Landmark,
  CopySlash,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'

export type FinanceTabKey =
  | 'contas_pagar'
  | 'contas_receber'
  | 'emprestimos_financiamentos'
  | 'credores'
  | 'contas_bancarias'
  | 'fluxo_caixa'
  | 'extratos'
  | 'balancetes'
  | 'ativos_patrimonio'
  | 'relatorios'
  | 'relatorios_avancados'
  | 'valuation'
  | 'plano_contas'
  | 'parcelas'
  | 'orfas'
  | 'localizador'

export interface CentralFinanceiraHubProps {
  activeTab: FinanceTabKey
  onSelectTab: (tab: FinanceTabKey) => void
  canWrite: boolean
  podeVerValores: boolean
  // Dados resumidos de Contas a Pagar
  totalPagarAberto: number
  qtdPagarAtrasadas: number
  // Dados resumidos de Contas a Receber
  totalReceberAberto: number
  qtdReceberAtrasadas: number
  // Dados de Credores
  totalCredoresAtivos?: number
  // Dados de Contas Bancárias PJ
  totalContasBancariasAtivas?: number
  // Dados de Empréstimos e Financiamentos
  totalContratosEmprestimos?: number
  saldoDevedorEmprestimos?: number
  qtdLancamentosEmprestimosSemContrato?: number
  somaLancamentosEmprestimosSemContrato?: number
  // Dados de Fluxo de Caixa
  saldoMesCorrente: number
  mesCorrenteNome: string
  // Dados de Extratos & Comprovantes
  qtdExtratosPendentes: number
  // Dados de Balancetes
  ultimoBalanceteRef?: string | null
  totalBalancetesEmitidos: number
  // Dados adicionais
  totalParcelasProjetos: number
  totalNotasOrfas: number
  podeAcessarValuation?: boolean
  totalDuplicadas?: number
  onAbrirModalDuplicadas?: () => void
}

interface HubCardConfig {
  id: FinanceTabKey
  title: string
  subtitle: string
  icon: typeof CreditCard
  accentColor: string
  iconBg: string
  iconColor: string
  badge?: ReactNode
  statLabel: string
  statValue: ReactNode
  statSubtext?: string
  visible: boolean
}

export function CentralFinanceiraHub(
  props: CentralFinanceiraHubProps & {
    onAbrirEmNovaJanela?: (tab: FinanceTabKey) => void
  },
) {
  const {
    activeTab,
    onSelectTab,
    canWrite,
    podeVerValores,
    totalPagarAberto,
    qtdPagarAtrasadas,
    totalReceberAberto,
    qtdReceberAtrasadas,
    totalCredoresAtivos = 0,
    totalContasBancariasAtivas = 0,
    totalContratosEmprestimos = 0,
    saldoDevedorEmprestimos = 0,
    qtdLancamentosEmprestimosSemContrato = 0,
    somaLancamentosEmprestimosSemContrato = 0,
    saldoMesCorrente,
    mesCorrenteNome,
    qtdExtratosPendentes,
    ultimoBalanceteRef,
    totalBalancetesEmitidos,
    totalParcelasProjetos,
    totalNotasOrfas,
    podeAcessarValuation = true,
    totalDuplicadas = 0,
    onAbrirModalDuplicadas,
    onAbrirEmNovaJanela,
  } = props
  const cards: HubCardConfig[] = [
    {
      id: 'localizador',
      title: 'Localizador de Documentos',
      subtitle: 'Busca unificada de notas fiscais, boletos e comprovantes',
      icon: Search,
      accentColor: '#FF6A13',
      iconBg: 'bg-orange-50 border-orange-200 text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
          Global · Rollback
        </span>
      ),
      statLabel: 'Pesquisa & Exclusão',
      statValue: (
        <span className="font-bold text-neutral-900 text-xs sm:text-sm">
          NFS-e · Boletos · Comprovantes
        </span>
      ),
      statSubtext: 'Com exclusão admin e desfazer imediato',
      visible: true,
    },
    {
      id: 'credores',
      title: 'Credores',
      subtitle: 'Cadastro e dados bancários para quitação',
      icon: Building2,
      accentColor: '#FF6A13',
      iconBg: 'bg-orange-50 border-orange-200 text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
          Financeiro
        </span>
      ),
      statLabel: 'Credores ativos',
      statValue: (
        <span className="mono-value font-bold text-neutral-900">
          {totalCredoresAtivos}{' '}
          <span className="text-xs font-normal text-neutral-500">cadastrados</span>
        </span>
      ),
      statSubtext: 'Integração direta com Contas a Pagar',
      visible: true,
    },
    {
      id: 'emprestimos_financiamentos',
      title: 'Empréstimos & Financiamentos',
      subtitle:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0
          ? `${qtdLancamentosEmprestimosSemContrato} lançamento(s) classificado(s) sem contrato cadastrado`
          : 'Contratos, amortização, apropriação de juros e reclassificação',
      icon: Landmark,
      accentColor: '#FF6A13',
      iconBg:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0
          ? 'bg-amber-50 border-amber-300 text-amber-700'
          : 'bg-orange-50 border-orange-200 text-[#FF6A13]',
      iconColor:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0
          ? 'text-amber-700'
          : 'text-[#FF6A13]',
      badge:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 animate-pulse">
            <AlertTriangle className="h-3 w-3 text-amber-700" />
            {qtdLancamentosEmprestimosSemContrato} sem contrato
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
            Contábil
          </span>
        ),
      statLabel:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0
          ? 'Lançamentos classificados'
          : 'Saldo devedor total',
      statValue: podeVerValores ? (
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0 ? (
          <span className="mono-value font-bold text-amber-900">
            {formatCurrency(somaLancamentosEmprestimosSemContrato)}{' '}
            <span className="text-[11px] font-normal text-neutral-600">
              ({qtdLancamentosEmprestimosSemContrato} lanc.)
            </span>
          </span>
        ) : (
          <span className="mono-value font-bold text-neutral-900">
            {formatCurrency(saldoDevedorEmprestimos)}
          </span>
        )
      ) : (
        <span className="text-neutral-400">•••••</span>
      ),
      statSubtext:
        totalContratosEmprestimos === 0 && qtdLancamentosEmprestimosSemContrato > 0
          ? 'Clique para abrir e cadastrar o contrato'
          : `${totalContratosEmprestimos} contrato(s) ativo(s) / amortização`,
      visible: canWrite,
    },
    {
      id: 'contas_bancarias',
      title: 'Contas Bancárias',
      subtitle: 'Contas correntes PJ, poupanças e saldos iniciais',
      icon: Building2,
      accentColor: '#FF6A13',
      iconBg: 'bg-amber-50 border-amber-200 text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
          PJ Aerocad
        </span>
      ),
      statLabel: 'Contas ativas',
      statValue: (
        <span className="mono-value font-bold text-neutral-900">
          {totalContasBancariasAtivas}{' '}
          <span className="text-xs font-normal text-neutral-500">contas PJ</span>
        </span>
      ),
      statSubtext: 'Alimentam lançamentos e extratos',
      visible: true,
    },
    {
      id: 'contas_pagar',
      title: 'Contas a Pagar',
      subtitle: 'Fornecedores, impostos e despesas operacionais',
      icon: CreditCard,
      accentColor: '#E11D48',
      iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
      iconColor: 'text-rose-600',
      badge:
        qtdPagarAtrasadas > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {qtdPagarAtrasadas} {qtdPagarAtrasadas === 1 ? 'em atraso' : 'em atraso'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Em dia
          </span>
        ),
      statLabel: 'Em aberto',
      statValue: podeVerValores ? (
        formatCurrency(totalPagarAberto)
      ) : (
        <span className="text-neutral-400">•••••</span>
      ),
      statSubtext:
        qtdPagarAtrasadas > 0
          ? `${qtdPagarAtrasadas} despesa(s) vencida(s)`
          : 'Nenhuma pendência vencida',
      visible: true,
    },
    {
      id: 'contas_receber',
      title: 'Contas a Receber',
      subtitle: 'Parcelas contratuais e receitas avulsas',
      icon: Receipt,
      accentColor: '#0284C7',
      iconBg: 'bg-sky-50 border-sky-200 text-sky-600',
      iconColor: 'text-sky-600',
      badge:
        qtdReceberAtrasadas > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
            <Clock className="h-3 w-3" />
            {qtdReceberAtrasadas} vencida(s)
          </span>
        ) : undefined,
      statLabel: 'Total a receber',
      statValue: podeVerValores ? (
        formatCurrency(totalReceberAberto)
      ) : (
        <span className="text-neutral-400">•••••</span>
      ),
      statSubtext:
        qtdReceberAtrasadas > 0
          ? `${qtdReceberAtrasadas} parcela(s) em atraso`
          : 'Fluxo de recebimentos regular',
      visible: true,
    },
    {
      id: 'fluxo_caixa',
      title: 'Fluxo de Caixa',
      subtitle: 'Entradas × saídas, previsto vs realizado',
      icon: TrendingUp,
      accentColor: '#16A34A',
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      iconColor: 'text-emerald-600',
      badge: (
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 capitalize">
          {mesCorrenteNome}
        </span>
      ),
      statLabel: 'Saldo mês atual',
      statValue: podeVerValores ? (
        <span
          className={cn(
            'mono-value font-bold',
            saldoMesCorrente >= 0 ? 'text-emerald-700' : 'text-rose-700',
          )}
        >
          {formatCurrency(saldoMesCorrente)}
        </span>
      ) : (
        <span className="text-neutral-400">•••••</span>
      ),
      statSubtext: 'Resultado líquido realizado do mês',
      visible: true,
    },
    {
      id: 'extratos',
      title: 'Extratos & Comprovantes',
      subtitle: 'Conciliação bancária (OFX), fotos e I.A.',
      icon: FileSpreadsheet,
      accentColor: '#FF6A13',
      iconBg: 'bg-orange-50 border-orange-200 text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge:
        qtdExtratosPendentes > 0 ? (
          <span className="inline-flex items-center rounded-full bg-[#FFF6EC] px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
            {qtdExtratosPendentes} a conciliar
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            Conciliado
          </span>
        ),
      statLabel: 'Lançamentos pendentes',
      statValue: (
        <span className="mono-value font-bold text-neutral-900">
          {qtdExtratosPendentes}{' '}
          <span className="text-xs font-normal text-neutral-500">transações</span>
        </span>
      ),
      statSubtext: 'Conciliação OFX e comprovantes',
      visible: true,
    },
    {
      id: 'balancetes',
      title: 'Balancetes Mensais',
      subtitle: 'Consolidação mensal e histórico arquivado',
      icon: Scale,
      accentColor: '#9333EA',
      iconBg: 'bg-purple-50 border-purple-200 text-purple-600',
      iconColor: 'text-purple-600',
      badge: ultimoBalanceteRef ? (
        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200">
          Ref. {ultimoBalanceteRef}
        </span>
      ) : undefined,
      statLabel: 'Último consolidado',
      statValue: (
        <span className="font-bold text-neutral-900 text-sm sm:text-base">
          {ultimoBalanceteRef ? `Mês ${ultimoBalanceteRef}` : 'Nenhum emitido'}
        </span>
      ),
      statSubtext:
        totalBalancetesEmitidos > 0
          ? `${totalBalancetesEmitidos} balancete(s) gerado(s)`
          : 'Gerar balancete oficial',
      visible: true,
    },
    {
      id: 'relatorios_avancados',
      title: 'Relatórios & Balancete',
      subtitle: 'Balancete de Verificação, Balanço, DRE & Contas PJ',
      icon: BarChart3,
      accentColor: '#2563EB',
      iconBg: 'bg-blue-50 border-blue-200 text-blue-600',
      iconColor: 'text-blue-600',
      badge: (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
          Balancete & DRE
        </span>
      ),
      statLabel: 'Balancete, Balanço & DRE',
      statValue: (
        <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
          Testagem A4 & XLSX
        </span>
      ),
      statSubtext: 'Débitos, créditos, saldos e contas PJ',
      visible: true,
    },
    {
      id: 'valuation',
      title: 'Valuation da AEROCAD',
      subtitle: 'Avaliação econômica por Patrimônio Líquido, EBITDA & Múltiplos',
      icon: Calculator,
      accentColor: '#FF6A13',
      iconBg: 'bg-[#FFF0E6] border-[#FFD2B3] text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0E6] px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
          Diretoria
        </span>
      ),
      statLabel: 'Avaliação Econômica',
      statValue: (
        <span className="font-bold text-[#D65100] text-xs sm:text-sm">Cenários & Múltiplos</span>
      ),
      statSubtext: 'Patrimonial + EBITDA + Intangíveis',
      visible: podeAcessarValuation,
    },
    {
      id: 'plano_contas',
      title: 'Plano de Contas',
      subtitle: 'Estrutura analítica de categorias, contas e lançamentos',
      icon: BookOpen,
      accentColor: '#FF6A13',
      iconBg: 'bg-orange-50 border-orange-200 text-[#FF6A13]',
      iconColor: 'text-[#FF6A13]',
      badge: (
        <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#D65100] border border-[#FFD2B3]">
          Contábil
        </span>
      ),
      statLabel: 'Árvore Contábil',
      statValue: (
        <span className="font-semibold text-neutral-900 text-xs sm:text-sm">4 Macro-Grupos</span>
      ),
      statSubtext: 'Ativo, Passivo, Despesas e Receitas',
      visible: canWrite,
    },
    {
      id: 'relatorios',
      title: 'Relatórios Gerenciais',
      subtitle: 'Faturamento, aging, clientes, projetos e impostos',
      icon: FileSpreadsheet,
      accentColor: '#0284C7',
      iconBg: 'bg-sky-50 border-sky-200 text-sky-600',
      iconColor: 'text-sky-600',
      badge: (
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
          Operacional
        </span>
      ),
      statLabel: 'Visão executiva',
      statValue: (
        <span className="font-semibold text-neutral-900 text-xs sm:text-sm">
          Exportação A4 & XLSX
        </span>
      ),
      statSubtext: 'Projetos, Clientes, Aging, Impostos',
      visible: true,
    },
    {
      id: 'parcelas',
      title: 'Parcelas de Projetos',
      subtitle: 'Visão granular por projeto e medições',
      icon: Layers,
      accentColor: '#0D9488',
      iconBg: 'bg-teal-50 border-teal-200 text-teal-600',
      iconColor: 'text-teal-600',
      badge: (
        <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200">
          Operação
        </span>
      ),
      statLabel: 'Parcelas cadastradas',
      statValue: (
        <span className="mono-value font-bold text-neutral-900">
          {totalParcelasProjetos}{' '}
          <span className="text-xs font-normal text-neutral-500">registros</span>
        </span>
      ),
      statSubtext: 'Vinculadas a projetos e contratos',
      visible: true,
    },
    {
      id: 'orfas',
      title: 'Notas Órfãs & NFS-e',
      subtitle: 'Notas importadas sem correlação automática',
      icon: Sparkles,
      accentColor: '#EA580C',
      iconBg: 'bg-amber-50 border-amber-200 text-amber-700',
      iconColor: 'text-amber-700',
      badge:
        totalNotasOrfas > 0 ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 animate-pulse">
            {totalNotasOrfas} pendentes
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            0 pendentes
          </span>
        ),
      statLabel: 'Aguardando vínculo',
      statValue: (
        <span className="mono-value font-bold text-neutral-900">
          {totalNotasOrfas} <span className="text-xs font-normal text-neutral-500">NFS-e</span>
        </span>
      ),
      statSubtext: 'Extrair projetos ou vincular manual',
      visible: canWrite,
    },
  ]

  const visibleCards = cards.filter((c) => c.visible)

  return (
    <section
      aria-label="Central Financeira AEROCAD"
      className="relative mb-6 overflow-hidden rounded-2xl border-2 border-[#FFD2B3] bg-gradient-to-b from-[#FFFBF8] via-white to-[#FFF9F5] p-4 sm:p-5 shadow-sm"
    >
      {/* Detalhe estético de prancheta técnica AEROCAD */}
      <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-30" />

      {/* Cabeçalho da Central */}
      <div className="relative mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FFE2CC] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6A13] text-white shadow-xs">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-neutral-900">
                Central Financeira
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#FFF6EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D65100] border border-[#FFD2B3]">
                AEROCAD HUB
              </span>
            </div>
            <p className="text-xs text-neutral-600">
              Acesso rápido e integrado aos módulos operacionais, contábeis e de conciliação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center text-[11px] font-semibold text-neutral-500">
          <span className="hidden sm:inline">Clique em um cartão para abrir a aba:</span>
          <span className="inline-flex items-center gap-1 text-[#FF6A13] font-bold">
            <span className="h-2 w-2 rounded-full bg-[#FF6A13] animate-pulse" />
            Módulo ativo: {cards.find((c) => c.id === activeTab)?.title || activeTab}
          </span>
        </div>
      </div>

      {/* Card/Banner de Ação Rápida de Duplicadas Detectadas */}
      {totalDuplicadas > 0 && onAbrirModalDuplicadas && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <CopySlash className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-950">
                  Notas Fiscais Duplicadas Detectadas
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-black rounded-full bg-amber-600 text-white animate-pulse">
                  {totalDuplicadas} {totalDuplicadas === 1 ? 'duplicada' : 'duplicadas'}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Existem emissões com o mesmo número de NF/cliente duplicadas no sistema. Faça a
                triagem e desduplicação com segurança.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAbrirModalDuplicadas}
            className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-[#FF6A13] hover:bg-[#E05A0B] rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <CopySlash className="h-4 w-4" />
            Abrir Triagem de Duplicatas
            <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
          </button>
        </div>
      )}

      {/* Grid de Cartões Principais (2 colunas mobile, 3 tablet, 4 desktop) */}
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {visibleCards.map((card) => {
          const isActive = activeTab === card.id
          const IconComponent = card.icon

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectTab(card.id)}
              className={cn(
                'group relative flex flex-col justify-between rounded-xl p-3 sm:p-4 text-left transition-all duration-200 outline-none',
                'border bg-white shadow-2xs hover:shadow-md hover:-translate-y-0.5',
                isActive
                  ? 'border-2 border-[#FF6A13] bg-gradient-to-br from-[#FFF9F5] via-white to-[#FFF3E8] ring-3 ring-[#FF6A13]/15 shadow-sm'
                  : 'border-neutral-200/90 hover:border-[#FFB787] hover:bg-[#FFFDFB]',
              )}
            >
              {/* Indicador visual de ativo no topo do cartão */}
              {isActive && (
                <div className="absolute -top-0.5 left-4 right-4 h-1 rounded-full bg-[#FF6A13]" />
              )}

              {/* Topo do cartão: Ícone + Badge */}
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2.5">
                  <div
                    className={cn(
                      'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border transition-colors',
                      isActive
                        ? 'bg-[#FF6A13] text-white border-[#FF6A13] shadow-xs'
                        : cn(card.iconBg, 'group-hover:border-[#FF6A13]/40'),
                    )}
                  >
                    <IconComponent
                      className={cn(
                        'h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:scale-110',
                        isActive ? 'text-white' : card.iconColor,
                      )}
                    />
                  </div>

                  <div className="shrink-0">{card.badge}</div>
                </div>

                {/* Título e Descrição */}
                <h3
                  className={cn(
                    'text-xs sm:text-sm font-bold tracking-tight line-clamp-1 transition-colors',
                    isActive ? 'text-[#D65100]' : 'text-neutral-900 group-hover:text-[#D65100]',
                  )}
                >
                  {card.title}
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 line-clamp-2">
                  {card.subtitle}
                </p>
              </div>

              {/* Rodapé do cartão: Estatística Viva */}
              <div className="mt-3 sm:mt-4 pt-2.5 border-t border-neutral-100 flex items-end justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <span className="block technical-label truncate">{card.statLabel}</span>
                  <div className="mt-0.5 text-xs sm:text-sm truncate">{card.statValue}</div>
                  {card.statSubtext && (
                    <span className="block text-[10px] text-neutral-500 truncate mt-0.5">
                      {card.statSubtext}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onAbrirEmNovaJanela && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrirEmNovaJanela(card.id)
                      }}
                      title={`Abrir ${card.title} em nova janela (ideal para 2º monitor)`}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:bg-[#FFF0E6] hover:text-[#D65100] transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-lg transition-all',
                      isActive
                        ? 'bg-[#FF6A13] text-white'
                        : 'text-neutral-400 group-hover:bg-[#FFF6EC] group-hover:text-[#FF6A13]',
                    )}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
