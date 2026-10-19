import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, ExternalLink, Layers, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { useCrmData } from '@/hooks/use-crm-data'
import type {
  ClienteRecord,
  ContaPagarRecord,
  ContaReceberRecord,
  ExtratoRecord,
  ExtratoTransacaoRecord,
  ParcelaRecord,
  ProjetoRecord,
  BalanceteMensalRecord,
  CredorRecord,
} from '@/types/crm'
import { ALL_FINANCE_TABS, type TabDefinition } from '@/components/financeiro/FinanceiroAbasConfig'
import type { FinanceTabKey } from '@/components/financeiro/CentralFinanceiraHub'
import { ContasPagarTab } from '@/components/financeiro/ContasPagarTab'
import { CredoresTab } from '@/components/financeiro/CredoresTab'
import { ContasBancariasTab } from '@/components/financeiro/ContasBancariasTab'
import { ContasReceberTab } from '@/components/financeiro/ContasReceberTab'
import { FluxoCaixaTab } from '@/components/financeiro/FluxoCaixaTab'
import { ExtratosComprovantesTab } from '@/components/financeiro/ExtratosComprovantesTab'
import { BalancetesTab } from '@/components/financeiro/BalancetesTab'
import { RelatoriosFinanceirosTab } from '@/components/financeiro/RelatoriosFinanceirosTab'
import { RelatoriosContabeisAvancadosTab } from '@/components/financeiro/RelatoriosContabeisAvancadosTab'
import { SensitiveAreaGate } from '@/components/auth/SensitiveAreaGate'
import { CentralFinanceiraHub } from '@/components/financeiro/CentralFinanceiraHub'
import { PlanoContasTab } from '@/components/financeiro/PlanoContasTab'
import { ValuationTab } from '@/components/financeiro/ValuationTab'import { PageLoading } from '@/components/common/States'
import { toast } from 'sonner'

export function FinanceiroModuloFocoPage() {
  const { modulo } = useParams<{ modulo: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { podeVerValores } = useFinanceiroVisibilidade()

  // Converte slug ou nome da aba (ex.: contas-a-pagar -> contas_pagar)
  const tabKey: FinanceTabKey = (
    modulo ? modulo.replace(/-/g, '_') : 'contas_pagar'
  ) as FinanceTabKey

  const tabConfig: TabDefinition | undefined = ALL_FINANCE_TABS.find(
    (t) => t.id === tabKey || t.id.replace(/_/g, '-') === modulo,
  )

  const canWrite = user?.role === 'admin' || user?.role === 'financeiro'

  // Carrega datasets necessários para renderizar os módulos de forma independente
  const installments = useCrmData<ParcelaRecord>('parcelas', {
    sort: '-vencimento',
    expand: 'projeto,cliente',
  })
  const projects = useCrmData<ProjetoRecord>('projetos', {
    sort: '-created',
  })
  const clients = useCrmData<ClienteRecord>('clientes', {
    sort: 'razao_social',
  })
  const credores = useCrmData<CredorRecord>('credores', {
    sort: 'nome_razao_social',
    expand: 'criado_por',
  })
  const contasPagar = useCrmData<ContaPagarRecord>('contas_pagar', {
    sort: '-data_vencimento',
    expand: 'cliente_fornecedor,credor,projeto,criado_por',
  })
  const contasReceber = useCrmData<ContaReceberRecord>('contas_receber', {
    sort: '-data_vencimento',
    expand: 'cliente,projeto,criado_por',
  })
  const extratos = useCrmData<ExtratoRecord>('extratos', {
    sort: '-created',
    expand: 'usuario',
  })
  const extratosTransacoes = useCrmData<ExtratoTransacaoRecord>('extratos_transacoes', {
    sort: '-data',
    expand: 'extrato',
  })
  const balancetesList = useCrmData<BalanceteMensalRecord>('balancetes_mensais', {
    sort: '-referencia',
  })
  const contasBancarias = useCrmData<any>('contas_bancarias', {
    sort: 'apelido',
  })
  const ativosPatrimonio = useCrmData<any>('ativos_patrimonio', {
    sort: '-data_aquisicao',
  })

  // Validação de acesso ao módulo
  useEffect(() => {
    if (tabConfig?.requiresWrite && !canWrite) {
      toast.error('Seu perfil não tem permissão para acessar este módulo.')
      navigate('/financeiro', { replace: true })
    }
  }, [tabConfig, canWrite, navigate])

  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {})
    } else {
      void document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {})
    }
  }

  const handleClose = () => {
    // Tenta fechar a janela se aberta com window.open; se não puder, navega de volta
    try {
      window.close()
    } catch {
      /* ignore */
    }
    // Caso a janela não feche (por política do navegador quando não aberta por script)
    navigate('/financeiro')
  }

  const TabIcon = tabConfig?.icon || Layers

  return (
    <div className="min-h-screen bg-[var(--app-body-bg,#F2F2F2)] flex flex-col font-sans">
      {/* Cabeçalho Compacto Modo Foco (ideal para 2º monitor) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#FFE2CC] bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 px-4 sm:px-6 text-white shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6A13] text-white shadow-xs">
            <TabIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9E66] border border-[#FF6A13]/40 bg-[#FF6A13]/20 px-1.5 py-0.2 rounded">
                Modo Foco · 2º Monitor
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white truncate">
                {tabConfig?.label || 'Módulo Financeiro'}
              </h1>
            </div>
            <p className="text-[11px] text-neutral-400 truncate hidden sm:block">
              {tabConfig?.description || 'Janela isolada da Central Financeira AEROCAD'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 hidden sm:inline-flex"
            title="Alternar tela cheia"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="ml-1 hidden md:inline">
              {isFullscreen ? 'Janela normal' : 'Tela cheia'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/financeiro')}
            className="h-8 px-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10"
            title="Voltar ao CRM completo"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Voltar ao CRM</span>
          </Button>

          <Button
            size="sm"
            onClick={handleClose}
            className="h-8 bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-bold gap-1 shadow-xs"
            title="Fechar esta janela focada"
          >
            <X className="h-4 w-4" />
            <span>Fechar janela</span>
          </Button>
        </div>
      </header>

      {/* Conteúdo do Módulo em Toda a Largura */}
      <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full">
        <div className="w-full">
          {tabKey === 'contas_pagar' ? (
            <ContasPagarTab
              contas={contasPagar.data}
              projetos={projects.data}
              clientes={clients.data}
              credores={credores.data}
              canWrite={canWrite}
              onReload={async () => {
                void contasPagar.reload()
                void credores.reload()
              }}
            />
          ) : tabKey === 'credores' ? (
            <CredoresTab
              credores={credores.data}
              contasPagar={contasPagar.data}
              canWrite={canWrite}
              canDelete={user?.role === 'admin'}
              onReload={async () => {
                void credores.reload()
                void contasPagar.reload()
              }}
            />
          ) : tabKey === 'contas_bancarias' ? (
            <ContasBancariasTab
              contas={contasBancarias.data}
              canWrite={canWrite}
              canDelete={user?.role === 'admin'}
              onReload={async () => {
                void contasBancarias.reload()
              }}
            />
          ) : tabKey === 'contas_receber' ? (
            <ContasReceberTab
              parcelas={installments.data}
              contasReceber={contasReceber.data}
              projetos={projects.data}
              clientes={clients.data}
              canWrite={canWrite}
              onReloadParcelas={async () => {
                void installments.reload()
              }}
              onReloadContasReceber={async () => {
                void contasReceber.reload()
              }}
            />
          ) : tabKey === 'fluxo_caixa' ? (
            <FluxoCaixaTab
              parcelas={installments.data}
              contasPagar={contasPagar.data}
              contasReceber={contasReceber.data}
              transacoesExtratos={extratosTransacoes.data}
            />
          ) : tabKey === 'extratos' ? (
            <ExtratosComprovantesTab
              extratos={extratos.data || []}
              transacoes={extratosTransacoes.data || []}
              parcelas={installments.data || []}
              contasPagar={contasPagar.data || []}
              contasReceber={contasReceber.data || []}
              contasBancarias={contasBancarias.data || []}
              projetos={projects.data || []}
              credores={credores.data || []}
              canWrite={canWrite}
              onReloadExtratos={async () => {
                void extratos.reload()
              }}
              onReloadTransacoes={async () => {
                void extratosTransacoes.reload()
              }}
              onReloadParcelas={async () => {
                void installments.reload()
              }}
              onReloadContasPagar={async () => {
                void contasPagar.reload()
              }}
              onReloadContasReceber={async () => {
                void contasReceber.reload()
              }}
            />
          ) : tabKey === 'balancetes' ? (
            <BalancetesTab
              parcelas={installments.data}
              contasPagar={contasPagar.data}
              contasReceber={contasReceber.data}
              projetos={projects.data}
              extratosTransacoes={extratosTransacoes.data}
            />
          ) : tabKey === 'ativos_patrimonio' ? (
            <AtivosPatrimonioTab
              ativos={ativosPatrimonio.data}
              canWrite={canWrite}
              onReload={async () => {
                void ativosPatrimonio.reload()
              }}
            />
          ) : tabKey === 'relatorios_avancados' ? (
            <RelatoriosContabeisAvancadosTab
              parcelas={installments.data}
              contasPagar={contasPagar.data}
              contasReceber={contasReceber.data}
              projetos={projects.data}
              clientes={clients.data}
              contasBancarias={contasBancarias.data}
              ativosPatrimonio={ativosPatrimonio.data}
              extratos={extratos.data}
              userRole={user?.role}
              usuarioNome={user?.name || user?.email || 'Usuário AEROCAD'}
              onNavigateTab={(tab) => {
                navigate(`/financeiro/modulo/${tab.replace(/_/g, '-')}`)
              }}
            />
          ) : tabKey === 'valuation' && canWrite ? (
            <SensitiveAreaGate
              areaKey="valuation"
              areaTitle="Valuation da AEROCAD"
              areaDescription="O Valuation contém projeções econômicas, valor patrimonial e múltiplos confidenciais da empresa. Acesso exclusivo mediante senha do administrador."
            >
              <ValuationTab
                parcelas={installments.data}
                contasPagar={contasPagar.data}
                contasReceber={contasReceber.data}
                contasBancarias={contasBancarias.data}
                ativosPatrimonio={ativosPatrimonio.data}
                extratosTransacoes={extratosTransacoes.data}
                balancetes={balancetesList.data}
                canWrite={canWrite}
                canDelete={user?.role === 'admin'}
                userRole={user?.role}
                usuarioNome={user?.name || user?.email || 'Diretoria AEROCAD'}
                usuarioId={user?.id}
                onNavigateTab={(tab) => {
                  navigate(`/financeiro/modulo/${tab.replace(/_/g, '-')}`)
                }}
              />
            </SensitiveAreaGate>
          ) : tabKey === 'plano_contas' && canWrite ? (
            <PlanoContasTab
              contasPagar={contasPagar.data}
              parcelas={installments.data}
              contasReceber={contasReceber.data}
              extratosTransacoes={extratosTransacoes.data}
              contasBancarias={contasBancarias.data}
              ativosPatrimonio={ativosPatrimonio.data}
              canWrite={canWrite}
              onReload={() => {
                void contasPagar.reload()
                void installments.reload()
                void contasReceber.reload()
              }}
            />
          ) : tabKey === 'relatorios' ? (
            <SensitiveAreaGate
              areaKey="relatorios_gerenciais"
              areaTitle="Relatórios Gerenciais Financeiros"
              areaDescription="Os relatórios gerenciais e contábeis consolidam faturamento bruto/líquido, aging de inadimplência e rentabilidade. Confirme a senha do administrador para visualizar."
            >
              <RelatoriosFinanceirosTab
                parcelas={installments.data}
                contasPagar={contasPagar.data}
                contasReceber={contasReceber.data}
                projetos={projects.data}
                clientes={clients.data}
              />
            </SensitiveAreaGate>
          ) : (
            <div className="crm-card p-8 text-center">
              <p className="text-neutral-600 font-semibold">
                Módulo selecionado não encontrado ou acesso restrito.
              </p>
              <Button
                onClick={() => navigate('/financeiro')}
                className="mt-4 bg-[#FF6A13] text-white"
              >
                Voltar à Central Financeira
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default FinanceiroModuloFocoPage
