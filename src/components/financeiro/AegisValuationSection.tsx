import { useState } from 'react'
import {
  type AegisConfiguracaoCompleta,
  type AegisValuationResultado,
  type ComposicaoServicosAegis,
  type AegisDriverValor,
  type AegisRisco,
  AEGIS_CONFIG_PADRAO,
} from '@/services/aegisValuationModel'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Rocket,
  Shield,
  Layers,
  Sparkles,
  TrendingUp,
  Cpu,
  Target,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Sliders,
  DollarSign,
  Info,
  Maximize2,
  ExternalLink,
} from 'lucide-react'

interface AegisValuationSectionProps {
  aegisConfig: AegisConfiguracaoCompleta
  onChangeConfig: (newConfig: AegisConfiguracaoCompleta) => void
  resultado: AegisValuationResultado
  composicaoEmpresa: ComposicaoServicosAegis
  canWrite?: boolean
  anoExercicio: number
}

export function AegisValuationSection({
  aegisConfig,
  onChangeConfig,
  resultado,
  composicaoEmpresa,
  canWrite = true,
  anoExercicio,
}: AegisValuationSectionProps) {
  const [subAbaInterna, setSubAbaInterna] = useState<
    'visao_estrategica' | 'premissas_sam' | 'cenarios_arr' | 'drivers_riscos' | 'composicao_empresa'
  >('visao_estrategica')

  // Helpers para edição imutável de premissas
  const handleAtualizarPrecoSegmento = (
    segmentoKey: 'consultores' | 'prefeituras' | 'construtoras' | 'operadores',
    campo: 'quantidadeTotal' | 'precoAssentoAno',
    valor: number,
  ) => {
    onChangeConfig({
      ...aegisConfig,
      premissasMercado: {
        ...aegisConfig.premissasMercado,
        [segmentoKey]: {
          ...aegisConfig.premissasMercado[segmentoKey],
          [campo]: Math.max(0, valor),
        },
      },
    })
  }

  const handleAtualizarCenario = (
    cenarioKey: 'cenarioConservador' | 'cenarioBase' | 'cenarioOtimista',
    campo: 'percentualCapturaSam' | 'multiploArr' | 'fatorDescontoRiscoEstagio',
    valor: number,
  ) => {
    onChangeConfig({
      ...aegisConfig,
      [cenarioKey]: {
        ...aegisConfig[cenarioKey],
        [campo]: valor,
      },
    })
  }

  const handleAtualizarDriver = (id: string, impacto: 'baixo' | 'medio' | 'alto') => {
    onChangeConfig({
      ...aegisConfig,
      drivers: aegisConfig.drivers.map((d) => (d.id === id ? { ...d, impacto } : d)),
    })
  }

  const handleAtualizarRisco = (id: string, severidade: 'baixo' | 'medio' | 'alto') => {
    onChangeConfig({
      ...aegisConfig,
      riscos: aegisConfig.riscos.map((r) => (r.id === id ? { ...r, severidade } : r)),
    })
  }

  const handleRestaurarPadroes = () => {
    onChangeConfig(AEGIS_CONFIG_PADRAO)
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER DO AEGIS */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#FF6A13]/40 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-6 text-white shadow-md">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#FF6A13_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A13] px-3 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow-xs">
                <Rocket className="h-3.5 w-3.5" />
                Ativo Estratégico Proprietário
              </span>
              <Badge
                variant="outline"
                className="border-neutral-600 bg-neutral-800/80 text-neutral-300 text-[11px]"
              >
                Versão do Produto: v1.9.384
              </Badge>
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-amber-300 text-[11px]"
              >
                Plugin QGIS · ICA 11-408 DECEA
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-[11px]"
              >
                Motor Desacoplado (Python)
              </Badge>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              AEGIS — Plataforma de Planejamento de Proteção de Aeródromos
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Software proprietário desenvolvido internamente pela Aerocad. Automatiza a geração de
              superfícies aeronáuticas (PBZPA, PZPANA), plantas DXF oficiais, modelos 3D KMZ,
              memoriais e o módulo de viabilidade construtiva <strong>OPEA</strong> (limite de
              altura por lote). Atua como um <strong>ativo multiplicador exponencial</strong> sobre
              o valuation da companhia.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestaurarPadroes}
                className="bg-neutral-800/90 border-neutral-700 text-neutral-200 hover:bg-neutral-700 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                Restaurar Premissas Iniciais
              </Button>
            )}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 text-right">
              <span className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Índice de Confiança do Ativo
              </span>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <span className="text-2xl font-black text-[#FF6A13] mono-value">
                  {resultado.indiceConfianca.score}%
                </span>
                <Badge
                  className={`text-[10px] font-bold uppercase ${
                    resultado.indiceConfianca.nivel === 'alto'
                      ? 'bg-emerald-600 text-white'
                      : resultado.indiceConfianca.nivel === 'moderado'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                  }`}
                >
                  {resultado.indiceConfianca.nivel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* 4 CARDS RÁPIDOS NO CABEÇALHO */}
        <div className="mt-6 pt-5 border-t border-neutral-800/80 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-800">
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">
              SAM Brasil / Ano
            </span>
            <strong className="text-base sm:text-lg font-black text-white mono-value">
              {formatCurrency(resultado.samBrasilTotal)}
            </strong>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Mercado Endereçável Atendível
            </span>
          </div>

          <div className="bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-800">
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">
              TAM LATAM / Ano
            </span>
            <strong className="text-base sm:text-lg font-black text-amber-400 mono-value">
              {formatCurrency(resultado.tamLatamTotal)}
            </strong>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              América Latina (ICAO 193 Países)
            </span>
          </div>

          <div className="bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-800">
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">
              Valuation AEGIS Hoje
            </span>
            <strong className="text-base sm:text-lg font-black text-orange-400 mono-value">
              {resultado.valuationHoje.faixaFormatada}
            </strong>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Estágio Inicial / MVP Validado
            </span>
          </div>

          <div className="bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-800">
            <span className="text-neutral-400 text-[10px] uppercase font-bold block">
              Valuation em Escala (3-5a)
            </span>
            <strong className="text-base sm:text-lg font-black text-emerald-400 mono-value">
              {resultado.cenariosEscala.faixaFormatada}
            </strong>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Múltiplo de ARR (5x–8x SaaS)
            </span>
          </div>
        </div>
      </div>

      {/* 2. SUB-ABAS DE NAVEGAÇÃO DA SEÇÃO AEGIS */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
        <button
          type="button"
          onClick={() => setSubAbaInterna('visao_estrategica')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaInterna === 'visao_estrategica'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Visão Estratégica & Tese
        </button>

        <button
          type="button"
          onClick={() => setSubAbaInterna('premissas_sam')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaInterna === 'premissas_sam'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Target className="h-3.5 w-3.5" />
          Dimensionamento SAM Brasil & LATAM
        </button>

        <button
          type="button"
          onClick={() => setSubAbaInterna('cenarios_arr')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaInterna === 'cenarios_arr'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Modelagem de ARR & Múltiplos SaaS
        </button>

        <button
          type="button"
          onClick={() => setSubAbaInterna('composicao_empresa')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaInterna === 'composicao_empresa'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Composição com Serviços Aerocad
        </button>

        <button
          type="button"
          onClick={() => setSubAbaInterna('drivers_riscos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            subAbaInterna === 'drivers_riscos'
              ? 'bg-white text-[#FF6A13] shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          Drivers de Valor & Riscos
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISÃO ESTRATÉGICA & TESE DO ATIVO */}
      {/* ========================================================================= */}
      {subAbaInterna === 'visao_estrategica' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border-neutral-200">
              <CardHeader className="pb-3 border-b border-neutral-100 bg-[#FFFBF8]">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-100 text-[#FF6A13]">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">
                      Valuation Hoje (Estágio Inicial)
                    </CardTitle>
                    <p className="text-[11px] text-neutral-500">Potencial com produto validado</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="text-2xl font-black text-neutral-900 mono-value">
                  {resultado.valuationHoje.faixaFormatada}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Reflete o software com ~44 mil linhas de código, homologações de processos reais,
                  motor de cálculo independente e fosso regulatório intransponível para concorrentes
                  internacionais.
                </p>
                <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Piso Mínimo Conservador:</span>
                    <strong className="mono-value">
                      {formatCurrency(resultado.valuationHoje.minimo)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor de Referência (Base):</span>
                    <strong className="mono-value text-[#FF6A13] font-black">
                      {formatCurrency(resultado.valuationHoje.referencia)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Teto Pré-Escala:</span>
                    <strong className="mono-value">
                      {formatCurrency(resultado.valuationHoje.maximo)}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200">
              <CardHeader className="pb-3 border-b border-neutral-100 bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">
                      Caminho de Escala (3 a 5 Anos)
                    </CardTitle>
                    <p className="text-[11px] text-neutral-500">Múltiplo de ARR (SaaS Vertical)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="text-2xl font-black text-emerald-800 mono-value">
                  {resultado.cenariosEscala.faixaFormatada}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Negociação privada de SaaS vertical regulado a 5x–8x ARR com penetração de 15% a
                  45% do SAM Brasil e primeiras licenças no mercado imobiliário e órgãos públicos.
                </p>
                <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Conservador (10% SAM, 5x ARR):</span>
                    <strong className="mono-value text-neutral-700">
                      {formatCurrency(
                        resultado.cenariosEscala.conservador.valuationComDescontoEstagio,
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cenário Base (25% SAM, 6.5x ARR):</span>
                    <strong className="mono-value text-emerald-700 font-black">
                      {formatCurrency(resultado.cenariosEscala.base.valuationBrutoMultiplo)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Otimista / Acelerado (45% SAM, 8x ARR):</span>
                    <strong className="mono-value text-emerald-800 font-bold">
                      {formatCurrency(resultado.cenariosEscala.otimista.valuationBrutoMultiplo)}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200">
              <CardHeader className="pb-3 border-b border-neutral-100 bg-blue-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">
                      Efeito Multiplicador Aerocad
                    </CardTitle>
                    <p className="text-[11px] text-neutral-500">
                      Impacto sobre o valor total da empresa
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="text-2xl font-black text-blue-900 mono-value">
                  {composicaoEmpresa.visaoCenarioEscala.multiplicadorTotalSobreServicos.toFixed(2)}x
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  A incorporação do AEGIS eleva o valor base da Aerocad de{' '}
                  <strong>{formatCurrency(composicaoEmpresa.valorServicosBase)}</strong> para{' '}
                  <strong className="text-blue-700">
                    {formatCurrency(composicaoEmpresa.visaoServicosMaisAegisBase.base)}
                  </strong>{' '}
                  hoje, com potencial de atingir{' '}
                  <strong className="text-emerald-700">
                    {formatCurrency(composicaoEmpresa.visaoCenarioEscala.base)}
                  </strong>{' '}
                  em escala.
                </p>
                <div className="pt-2 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Ganho Imediato (Hoje):</span>
                    <strong className="mono-value text-[#FF6A13] font-bold">
                      +
                      {composicaoEmpresa.visaoServicosMaisAegisBase.ganhoPercentualSobreServicos.toFixed(
                        1,
                      )}
                      %
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ganho em Escala:</span>
                    <strong className="mono-value text-emerald-700 font-bold">
                      +
                      {composicaoEmpresa.visaoCenarioEscala.ganhoPercentualSobreServicos.toFixed(1)}
                      %
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4 MODELOS DE RECEITA COEXISTENTES */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#FF6A13]" />
                Os 4 Modelos de Receita Coexistentes do AEGIS
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                A arquitetura desacoplada permite que o software monetize simultaneamente em quatro
                frentes sem canibalização:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50 space-y-1">
                <Badge variant="outline" className="text-[10px] bg-white border-neutral-300">
                  Modelo 1
                </Badge>
                <h4 className="font-bold text-neutral-900">Licença por Assento / Ano</h4>
                <p className="text-neutral-600 text-[11px]">
                  Para consultorias especializadas e prefeituras com uso recorrente de processos
                  PBZPA/PZPANA.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50 space-y-1">
                <Badge variant="outline" className="text-[10px] bg-white border-neutral-300">
                  Modelo 2
                </Badge>
                <h4 className="font-bold text-neutral-900">Cobrança por Projeto / Entregável</h4>
                <p className="text-neutral-600 text-[11px]">
                  Para clientes que necessitam de um plano específico, planta oficial DXF ou laudo
                  OPEA avulso.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50 space-y-1">
                <Badge variant="outline" className="text-[10px] bg-white border-neutral-300">
                  Modelo 3
                </Badge>
                <h4 className="font-bold text-neutral-900">SaaS por Assinatura (Nuvem)</h4>
                <p className="text-neutral-600 text-[11px]">
                  Evolução natural do motor para a nuvem com consultas rápidas de viabilidade
                  construtiva por lote.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50 space-y-1">
                <Badge variant="outline" className="text-[10px] bg-white border-neutral-300">
                  Modelo 4
                </Badge>
                <h4 className="font-bold text-neutral-900">Serviço Produtizado (Aerocad)</h4>
                <p className="text-neutral-600 text-[11px]">
                  A própria Aerocad entrega laudos e planos usando o software, com margem
                  operacional muito superior.
                </p>
              </div>
            </div>
          </div>

          {/* BENCHMARK COMPETITIVO RESUMIDO */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-neutral-900">
                  Benchmark Competitivo & Fosso Estrutural
                </h3>
                <p className="text-xs text-neutral-500">
                  Comparação técnica com concorrentes multinacionais (SkySAFE/Transoft, Esri ArcGIS
                  Aviation, PDToolkit)
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                Fosso Único no Brasil
              </Badge>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold">
                    <th className="p-2.5">Critério Normativo & Operacional</th>
                    <th className="p-2.5 text-center">SkySAFE (Transoft)</th>
                    <th className="p-2.5 text-center">Esri Aviation</th>
                    <th className="p-2.5 text-center">PDToolkit</th>
                    <th className="p-2.5 text-center font-bold text-[#FF6A13] bg-orange-50/50">
                      AEGIS (Aerocad)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="p-2.5 font-medium text-neutral-900">
                      Conformidade DECEA / ICA 11-408
                    </td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-emerald-700 font-black bg-orange-50/50">
                      Sim (Nativo)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-neutral-900">
                      Integração AISWEB / Base ANAC
                    </td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-emerald-700 font-black bg-orange-50/50">
                      Sim (4.283 sítios)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-neutral-900">
                      Processo OPEA / Dossiê Protocolável BR
                    </td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-emerald-700 font-black bg-orange-50/50">
                      Sim
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-neutral-900">
                      Altura Construível no Lote Inteiro
                    </td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">
                      Não (apenas ponto)
                    </td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-rose-600 font-bold">Não</td>
                    <td className="p-2.5 text-center text-emerald-700 font-black bg-orange-50/50">
                      Sim (Mapa de calor)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-neutral-900">Custo de Plataforma Base</td>
                    <td className="p-2.5 text-center text-neutral-600">AutoCAD pago</td>
                    <td className="p-2.5 text-center text-neutral-600">ArcGIS Pro pago</td>
                    <td className="p-2.5 text-center text-neutral-600">MicroStation pago</td>
                    <td className="p-2.5 text-center text-emerald-700 font-black bg-orange-50/50">
                      QGIS (Gratuito)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DIMENSIONAMENTO SAM BRASIL & TAM LATAM (PREMISSAS EDITÁVEIS) */}
      {/* ========================================================================= */}
      {subAbaInterna === 'premissas_sam' && (
        <div className="space-y-6">
          <Card className="border-neutral-200 shadow-2xs">
            <CardHeader className="border-b border-neutral-100 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-neutral-900">
                    Premissas Editáveis do Mercado Endereçável (SAM Brasil)
                  </CardTitle>
                  <p className="text-xs text-neutral-500">
                    Altere os números de participantes e os preços anuais de assinatura por assento
                    para recalcular instantaneamente o SAM.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                    SAM Calculado
                  </span>
                  <span className="text-lg font-black text-[#FF6A13] mono-value">
                    {formatCurrency(resultado.samBrasilTotal)} / ano
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Segmento 1: Consultores */}
                <div className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      1. Consultores Aeroportuários
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {resultado.segmentosDetalhados[0].participacaoSam.toFixed(0)}% do SAM
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Qtd. de Consultores:
                      </label>
                      <Input
                        type="number"
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.consultores.quantidadeTotal}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'consultores',
                            'quantidadeTotal',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Preço Assento / Ano (R$):
                      </label>
                      <Input
                        type="number"
                        step={500}
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.consultores.precoAssentoAno}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'consultores',
                            'precoAssentoAno',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-neutral-800">
                      <span>Potencial:</span>
                      <span className="mono-value text-[#FF6A13]">
                        {formatCurrency(resultado.segmentosDetalhados[0].potencialAnual)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Segmento 2: Prefeituras */}
                <div className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      2. Prefeituras Prioritárias
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {resultado.segmentosDetalhados[1].participacaoSam.toFixed(0)}% do SAM
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Qtd. de Prefeituras:
                      </label>
                      <Input
                        type="number"
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.prefeituras.quantidadeTotal}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'prefeituras',
                            'quantidadeTotal',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Preço Assento / Ano (R$):
                      </label>
                      <Input
                        type="number"
                        step={500}
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.prefeituras.precoAssentoAno}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'prefeituras',
                            'precoAssentoAno',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-neutral-800">
                      <span>Potencial:</span>
                      <span className="mono-value text-[#FF6A13]">
                        {formatCurrency(resultado.segmentosDetalhados[1].potencialAnual)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Segmento 3: Construtoras */}
                <div className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      3. Construtoras (OPEA)
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {resultado.segmentosDetalhados[2].participacaoSam.toFixed(0)}% do SAM
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Qtd. Construtoras:
                      </label>
                      <Input
                        type="number"
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.construtoras.quantidadeTotal}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'construtoras',
                            'quantidadeTotal',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Preço Assento / Ano (R$):
                      </label>
                      <Input
                        type="number"
                        step={500}
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.construtoras.precoAssentoAno}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'construtoras',
                            'precoAssentoAno',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-neutral-800">
                      <span>Potencial:</span>
                      <span className="mono-value text-[#FF6A13]">
                        {formatCurrency(resultado.segmentosDetalhados[2].potencialAnual)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Segmento 4: Operadores */}
                <div className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      4. Operadores de Aeródromos
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {resultado.segmentosDetalhados[3].participacaoSam.toFixed(0)}% do SAM
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Qtd. Operadores:
                      </label>
                      <Input
                        type="number"
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.operadores.quantidadeTotal}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'operadores',
                            'quantidadeTotal',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Preço Assento / Ano (R$):
                      </label>
                      <Input
                        type="number"
                        step={500}
                        disabled={!canWrite}
                        value={aegisConfig.premissasMercado.operadores.precoAssentoAno}
                        onChange={(e) =>
                          handleAtualizarPrecoSegmento(
                            'operadores',
                            'precoAssentoAno',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-neutral-800">
                      <span>Potencial:</span>
                      <span className="mono-value text-[#FF6A13]">
                        {formatCurrency(resultado.segmentosDetalhados[3].potencialAnual)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DADOS FÍSICOS DO SETOR (ANAC & ICAO) */}
              <div className="rounded-xl border border-neutral-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-neutral-500 text-[11px] block">
                    Sítios Endereçáveis Brasil (ANAC out/2025):
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      disabled={!canWrite}
                      value={aegisConfig.premissasMercado.totalSitiosBrasil}
                      onChange={(e) =>
                        onChangeConfig({
                          ...aegisConfig,
                          premissasMercado: {
                            ...aegisConfig.premissasMercado,
                            totalSitiosBrasil: Number(e.target.value),
                          },
                        })
                      }
                      className="h-8 text-xs font-bold mono-value w-32"
                    />
                    <span className="text-[11px] text-neutral-500">
                      (4.186 aeródromos + 1.725 helipontos)
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500 text-[11px] block">
                    Múltiplo TAM LATAM (vs. SAM Brasil):
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step={0.5}
                      disabled={!canWrite}
                      value={aegisConfig.premissasMercado.fatorMultiplicadorLatam}
                      onChange={(e) =>
                        onChangeConfig({
                          ...aegisConfig,
                          premissasMercado: {
                            ...aegisConfig.premissasMercado,
                            fatorMultiplicadorLatam: Number(e.target.value),
                          },
                        })
                      }
                      className="h-8 text-xs font-bold mono-value w-24"
                    />
                    <span className="text-[11px] text-neutral-500">
                      = {formatCurrency(resultado.tamLatamTotal)}/ano
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500 text-[11px] block">
                    Estados Signatários ICAO:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      disabled={!canWrite}
                      value={aegisConfig.premissasMercado.totalEstadosIcao}
                      onChange={(e) =>
                        onChangeConfig({
                          ...aegisConfig,
                          premissasMercado: {
                            ...aegisConfig.premissasMercado,
                            totalEstadosIcao: Number(e.target.value),
                          },
                        })
                      }
                      className="h-8 text-xs font-bold mono-value w-24"
                    />
                    <span className="text-[11px] text-neutral-500">
                      Países aderentes ao Anexo 14
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODELAGEM DE ARR POR CENÁRIO & MÚLTIPLOS SAAS */}
      {/* ========================================================================= */}
      {subAbaInterna === 'cenarios_arr' && (
        <div className="space-y-6">
          <Card className="border-neutral-200">
            <CardHeader className="border-b border-neutral-100 pb-3">
              <CardTitle className="text-base font-bold text-neutral-900">
                Projeção de ARR em Escala (3 a 5 Anos) & Múltiplos de SaaS Vertical
              </CardTitle>
              <p className="text-xs text-neutral-500">
                SaaS vertical regulado é avaliado em transações privadas entre{' '}
                <strong>5x e 8x ARR</strong>, com churn próximo de zero em virtude da
                obrigatoriedade legal das normas ICAO/DECEA.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cenário Conservador */}
                <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-neutral-800">Cenário Conservador</h4>
                    <Badge variant="outline" className="text-[10px]">
                      Piso de Escala
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Captura do SAM Brasil (%):
                      </label>
                      <Input
                        type="number"
                        step={1}
                        disabled={!canWrite}
                        value={(aegisConfig.cenarioConservador.percentualCapturaSam * 100).toFixed(
                          0,
                        )}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioConservador',
                            'percentualCapturaSam',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Múltiplo de ARR (x):
                      </label>
                      <Input
                        type="number"
                        step={0.5}
                        disabled={!canWrite}
                        value={aegisConfig.cenarioConservador.multiploArr}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioConservador',
                            'multiploArr',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Desconto de Risco / Estágio (%):
                      </label>
                      <Input
                        type="number"
                        step={5}
                        disabled={!canWrite}
                        value={(
                          aegisConfig.cenarioConservador.fatorDescontoRiscoEstagio * 100
                        ).toFixed(0)}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioConservador',
                            'fatorDescontoRiscoEstagio',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-100 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>ARR Projetado:</span>
                        <strong className="mono-value">
                          {formatCurrency(resultado.cenariosEscala.conservador.arrProjetado)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Valuation Bruto:</span>
                        <strong className="mono-value">
                          {formatCurrency(
                            resultado.cenariosEscala.conservador.valuationBrutoMultiplo,
                          )}
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-neutral-900">
                        <span>Valuation Ajustado:</span>
                        <span className="mono-value text-[#FF6A13]">
                          {formatCurrency(
                            resultado.cenariosEscala.conservador.valuationComDescontoEstagio,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cenário Base */}
                <div className="rounded-xl border-2 border-[#FF6A13] bg-[#FFFBF8] p-4 space-y-3 relative ring-2 ring-[#FF6A13]/10">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#FF6A13]">Cenário Base (Referência)</h4>
                    <Badge className="bg-[#FF6A13] text-white text-[10px]">Equilibrado</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-600 block mb-1">
                        Captura do SAM Brasil (%):
                      </label>
                      <Input
                        type="number"
                        step={1}
                        disabled={!canWrite}
                        value={(aegisConfig.cenarioBase.percentualCapturaSam * 100).toFixed(0)}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioBase',
                            'percentualCapturaSam',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-600 block mb-1">
                        Múltiplo de ARR (x):
                      </label>
                      <Input
                        type="number"
                        step={0.5}
                        disabled={!canWrite}
                        value={aegisConfig.cenarioBase.multiploArr}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioBase',
                            'multiploArr',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-600 block mb-1">
                        Desconto de Risco / Estágio (%):
                      </label>
                      <Input
                        type="number"
                        step={5}
                        disabled={!canWrite}
                        value={(aegisConfig.cenarioBase.fatorDescontoRiscoEstagio * 100).toFixed(0)}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioBase',
                            'fatorDescontoRiscoEstagio',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value bg-white"
                      />
                    </div>
                    <div className="pt-2 border-t border-orange-200 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>ARR Projetado:</span>
                        <strong className="mono-value">
                          {formatCurrency(resultado.cenariosEscala.base.arrProjetado)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Valuation Bruto:</span>
                        <strong className="mono-value text-emerald-700">
                          {formatCurrency(resultado.cenariosEscala.base.valuationBrutoMultiplo)}
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-neutral-900">
                        <span>Valuation Ajustado:</span>
                        <span className="mono-value text-[#FF6A13] text-sm">
                          {formatCurrency(
                            resultado.cenariosEscala.base.valuationComDescontoEstagio,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cenário Otimista */}
                <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-emerald-800">
                      Cenário Otimista / Acelerado
                    </h4>
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-emerald-800 text-[10px]"
                    >
                      Expansão Acelerada
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Captura do SAM Brasil (%):
                      </label>
                      <Input
                        type="number"
                        step={1}
                        disabled={!canWrite}
                        value={(aegisConfig.cenarioOtimista.percentualCapturaSam * 100).toFixed(0)}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioOtimista',
                            'percentualCapturaSam',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Múltiplo de ARR (x):
                      </label>
                      <Input
                        type="number"
                        step={0.5}
                        disabled={!canWrite}
                        value={aegisConfig.cenarioOtimista.multiploArr}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioOtimista',
                            'multiploArr',
                            Number(e.target.value),
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-500 block mb-1">
                        Desconto de Risco / Estágio (%):
                      </label>
                      <Input
                        type="number"
                        step={5}
                        disabled={!canWrite}
                        value={(
                          aegisConfig.cenarioOtimista.fatorDescontoRiscoEstagio * 100
                        ).toFixed(0)}
                        onChange={(e) =>
                          handleAtualizarCenario(
                            'cenarioOtimista',
                            'fatorDescontoRiscoEstagio',
                            Number(e.target.value) / 100,
                          )
                        }
                        className="h-8 text-xs font-bold mono-value"
                      />
                    </div>
                    <div className="pt-2 border-t border-neutral-100 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>ARR Projetado:</span>
                        <strong className="mono-value">
                          {formatCurrency(resultado.cenariosEscala.otimista.arrProjetado)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Valuation Bruto:</span>
                        <strong className="mono-value text-emerald-800">
                          {formatCurrency(resultado.cenariosEscala.otimista.valuationBrutoMultiplo)}
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-neutral-900">
                        <span>Valuation Ajustado:</span>
                        <span className="mono-value text-emerald-800">
                          {formatCurrency(
                            resultado.cenariosEscala.otimista.valuationComDescontoEstagio,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. COMPOSIÇÃO CONSOLIDADA AEROCAD (SERVIÇOS + AEGIS) */}
      {/* ========================================================================= */}
      {subAbaInterna === 'composicao_empresa' && (
        <div className="space-y-6">
          <Card className="border-neutral-200">
            <CardHeader className="border-b border-neutral-100 pb-3">
              <CardTitle className="text-base font-bold text-neutral-900">
                Consolidação Estratégica: Operação de Serviços + Ativo AEGIS
              </CardTitle>
              <p className="text-xs text-neutral-500">
                Demonstrativo comparativo com as três visões de negociação: somente serviços,
                situação atual combinada e cenário de escala.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Visão 1 */}
                <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-neutral-500">Visão 1</span>
                    <Badge variant="outline" className="text-[10px]">
                      Situação Atual
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-800">Somente Serviços Aerocad</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Consultoria técnica pura (FCD, múltiplos e ativo contábil).
                    </p>
                  </div>
                  <div className="text-2xl font-black text-neutral-900 mono-value">
                    {formatCurrency(composicaoEmpresa.visaoSomenteServicos.base)}
                  </div>
                  <div className="pt-2 border-t border-neutral-200 text-xs space-y-1 text-neutral-600">
                    <div className="flex justify-between">
                      <span>Piso Conservador:</span>
                      <strong className="mono-value">
                        {formatCurrency(composicaoEmpresa.visaoSomenteServicos.conservador)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Teto Otimista:</span>
                      <strong className="mono-value">
                        {formatCurrency(composicaoEmpresa.visaoSomenteServicos.otimista)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Visão 2 */}
                <div className="rounded-xl border-2 border-[#FF6A13] p-4 bg-[#FFFBF8] space-y-3 ring-2 ring-[#FF6A13]/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-[#FF6A13]">Visão 2</span>
                    <Badge className="bg-[#FF6A13] text-white text-[10px]">
                      Base Recomendada Hoje
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">
                      Serviços + Ativo AEGIS (Hoje)
                    </h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Serviços de consultoria somados ao software no estágio inicial.
                    </p>
                  </div>
                  <div className="text-3xl font-black text-[#FF6A13] mono-value">
                    {formatCurrency(composicaoEmpresa.visaoServicosMaisAegisBase.base)}
                  </div>
                  <div className="pt-2 border-t border-orange-200 text-xs space-y-1 text-neutral-700">
                    <div className="flex justify-between">
                      <span>Piso Conservador:</span>
                      <strong className="mono-value">
                        {formatCurrency(composicaoEmpresa.visaoServicosMaisAegisBase.conservador)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Teto Otimista:</span>
                      <strong className="mono-value">
                        {formatCurrency(composicaoEmpresa.visaoServicosMaisAegisBase.otimista)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 font-bold text-[#FF6A13]">
                      <span>Ganho s/ Serviços:</span>
                      <span className="mono-value">
                        +
                        {composicaoEmpresa.visaoServicosMaisAegisBase.ganhoPercentualSobreServicos.toFixed(
                          1,
                        )}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visão 3 */}
                <div className="rounded-xl border border-emerald-300 p-4 bg-emerald-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-emerald-800">Visão 3</span>
                    <Badge
                      variant="outline"
                      className="border-emerald-400 text-emerald-800 text-[10px]"
                    >
                      Rodada / Saída 3-5a
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950">
                      Cenário de Escala Consolidado
                    </h4>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Consultoria consolidada + AEGIS tracionado como SaaS vertical.
                    </p>
                  </div>
                  <div className="text-3xl font-black text-emerald-800 mono-value">
                    {formatCurrency(composicaoEmpresa.visaoCenarioEscala.base)}
                  </div>
                  <div className="pt-2 border-t border-emerald-200 text-xs space-y-1 text-neutral-700">
                    <div className="flex justify-between">
                      <span>Piso Conservador:</span>
                      <strong className="mono-value text-emerald-900">
                        {formatCurrency(composicaoEmpresa.visaoCenarioEscala.conservador)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Teto Otimista:</span>
                      <strong className="mono-value text-emerald-900">
                        {formatCurrency(composicaoEmpresa.visaoCenarioEscala.otimista)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 font-bold text-emerald-800">
                      <span>Poder Multiplicador:</span>
                      <span className="mono-value">
                        {composicaoEmpresa.visaoCenarioEscala.multiplicadorTotalSobreServicos.toFixed(
                          2,
                        )}
                        x (+
                        {composicaoEmpresa.visaoCenarioEscala.ganhoPercentualSobreServicos.toFixed(
                          0,
                        )}
                        %)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TABELA DE DESDOBRAMENTO */}
              <div className="rounded-xl border border-neutral-200 p-4 bg-white space-y-2">
                <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
                  Desdobramento Patrimonial e Estratégico da Aerocad
                </h4>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                        <th className="py-2">Componente de Valor</th>
                        <th className="py-2 text-right">Valor Inicial (Hoje)</th>
                        <th className="py-2 text-right">Valor em Escala (3-5 Anos)</th>
                        <th className="py-2 text-right">Participação Hoje %</th>
                        <th className="py-2 text-right">Participação Escala %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      <tr>
                        <td className="py-2 font-medium text-neutral-800">
                          1. Operação de Serviços Aerocad (4 Métodos Ponderados)
                        </td>
                        <td className="py-2 text-right mono-value">
                          {formatCurrency(composicaoEmpresa.valorServicosBase)}
                        </td>
                        <td className="py-2 text-right mono-value">
                          {formatCurrency(composicaoEmpresa.valorServicosBase)}
                        </td>
                        <td className="py-2 text-right font-bold text-neutral-600">
                          {(
                            (composicaoEmpresa.valorServicosBase /
                              (composicaoEmpresa.visaoServicosMaisAegisBase.base || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                        <td className="py-2 text-right font-bold text-neutral-600">
                          {(
                            (composicaoEmpresa.valorServicosBase /
                              (composicaoEmpresa.visaoCenarioEscala.base || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium text-neutral-800">
                          2. Ativo de Software Proprietário AEGIS
                        </td>
                        <td className="py-2 text-right mono-value text-[#FF6A13] font-bold">
                          {formatCurrency(composicaoEmpresa.valorAegisHoje)}
                        </td>
                        <td className="py-2 text-right mono-value text-emerald-700 font-bold">
                          {formatCurrency(composicaoEmpresa.valorAegisEscala)}
                        </td>
                        <td className="py-2 text-right font-bold text-[#FF6A13]">
                          {(
                            (composicaoEmpresa.valorAegisHoje /
                              (composicaoEmpresa.visaoServicosMaisAegisBase.base || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                        <td className="py-2 text-right font-bold text-emerald-700">
                          {(
                            (composicaoEmpresa.valorAegisEscala /
                              (composicaoEmpresa.visaoCenarioEscala.base || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                      </tr>
                      <tr className="border-t-2 border-neutral-300 font-black">
                        <td className="py-2.5 text-neutral-900">
                          VALUATION CONSOLIDADO TOTAL DA AEROCAD
                        </td>
                        <td className="py-2.5 text-right mono-value text-[#FF6A13] text-sm">
                          {formatCurrency(composicaoEmpresa.visaoServicosMaisAegisBase.base)}
                        </td>
                        <td className="py-2.5 text-right mono-value text-emerald-800 text-sm">
                          {formatCurrency(composicaoEmpresa.visaoCenarioEscala.base)}
                        </td>
                        <td className="py-2.5 text-right text-neutral-900">100.0%</td>
                        <td className="py-2.5 text-right text-neutral-900">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PAINEL DE DRIVERS & RISCOS QUALITATIVOS COM IMPACTO NO SCORE */}
      {/* ========================================================================= */}
      {subAbaInterna === 'drivers_riscos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DRIVERS DE VALOR */}
            <Card className="border-neutral-200">
              <CardHeader className="pb-3 border-b border-neutral-100 bg-emerald-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold text-neutral-900">
                      Drivers de Valor (7 Pilares Estratégicos)
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-emerald-800 text-[10px]"
                  >
                    Impacto Positivo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {aegisConfig.drivers.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-neutral-900 block font-bold">{d.titulo}</strong>
                        <span className="text-[10px] uppercase font-bold text-neutral-400">
                          Categoria: {d.categoria}
                        </span>
                      </div>
                      {canWrite ? (
                        <select
                          aria-label={`Impacto do driver ${d.titulo}`}
                          value={d.impacto}
                          onChange={(e) =>
                            handleAtualizarDriver(
                              d.id,
                              e.target.value as 'baixo' | 'medio' | 'alto',
                            )
                          }
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-bold text-neutral-700 cursor-pointer"
                        >
                          <option value="baixo">Impacto Baixo</option>
                          <option value="medio">Impacto Médio</option>
                          <option value="alto">Impacto Alto</option>
                        </select>
                      ) : (
                        <Badge
                          className={`text-[10px] font-bold uppercase ${
                            d.impacto === 'alto'
                              ? 'bg-emerald-600 text-white'
                              : d.impacto === 'medio'
                                ? 'bg-blue-600 text-white'
                                : 'bg-neutral-600 text-white'
                          }`}
                        >
                          {d.impacto}
                        </Badge>
                      )}
                    </div>
                    <p className="text-neutral-600 text-[11px] leading-relaxed">{d.descricao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* MATRIZ DE RISCOS & MITIGAÇÕES */}
            <Card className="border-neutral-200">
              <CardHeader className="pb-3 border-b border-neutral-100 bg-rose-50/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <CardTitle className="text-sm font-bold text-neutral-900">
                      Matriz de Riscos & Mitigações Técnicas
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="border-rose-300 text-rose-800 text-[10px]">
                    Sensibilidade
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {aegisConfig.riscos.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-neutral-900 font-bold block">{r.titulo}</strong>
                      {canWrite ? (
                        <select
                          aria-label={`Severidade do risco ${r.titulo}`}
                          value={r.severidade}
                          onChange={(e) =>
                            handleAtualizarRisco(r.id, e.target.value as 'baixo' | 'medio' | 'alto')
                          }
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] font-bold text-neutral-700 cursor-pointer"
                        >
                          <option value="baixo">Severidade Baixa</option>
                          <option value="medio">Severidade Média</option>
                          <option value="alto">Severidade Alta</option>
                        </select>
                      ) : (
                        <Badge
                          className={`text-[10px] font-bold uppercase ${
                            r.severidade === 'alto'
                              ? 'bg-rose-600 text-white'
                              : r.severidade === 'medio'
                                ? 'bg-amber-600 text-white'
                                : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {r.severidade}
                        </Badge>
                      )}
                    </div>
                    <p className="text-neutral-600 text-[11px]">{r.descricao}</p>
                    <div className="pt-1.5 border-t border-neutral-200 text-[11px] text-neutral-700 bg-white/70 p-2 rounded">
                      <span className="font-bold text-neutral-900 block">Mitigação Adotada:</span>
                      {r.mitigacao}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* RESSALVA OBRIGATÓRIA INSTITUCIONAL DO AEGIS */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-950 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
            Ressalva Institucional & Uso Responsável das Premissas
          </h4>
          <p className="text-[11px] leading-relaxed">
            Os produtos gerados pelo AEGIS constituem <strong>apoio técnico à decisão</strong> e{' '}
            <strong>não substituem</strong> a análise, tramitação e pareceres das autoridades
            competentes (DECEA/COMAER, ANAC e órgãos municipais). A responsabilidade técnica formal
            de cada estudo permanece com o Responsável Técnico mediante ART/RRT. As estimativas
            comerciais e de valuation marcadas com premissas de mercado dependem de validação formal
            pela administração da AEROCAD Consultoria & Aeroportos.
          </p>
        </div>
      </div>
    </div>
  )
}
