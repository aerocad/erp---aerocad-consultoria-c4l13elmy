import React, { useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  SlidersHorizontal,
  TableProperties,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmBadge } from '@/components/common/CrmBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/format'
import { formatBytes } from '@/services/anexos'
import {
  autoMapearColunas,
  processarArquivoPlanilha,
  type AbaDetectada,
  type ValidacaoResultado,
} from '@/services/importacaoParser'
import {
  validarClientes,
  validarComunicacoes,
  validarFinanceiro,
  validarProjetos,
  type ClienteMapeado,
  type ComunicacaoMapeada,
  type FinanceiroMapeado,
  type ProjetoMapeado,
} from '@/services/importacaoValidador'
import {
  executarImportacao,
  type ImportacaoExecucaoResultado,
  type ProgressoImportacao,
} from '@/services/importacaoExecutor'
import type { XLSXWorkbook } from '@/services/sheetjsLoader'
import { loadSheetJS } from '@/services/sheetjsLoader'

type WizardStep = 'upload' | 'mapeamento' | 'validacao' | 'execucao' | 'resultado'

interface MapeamentosEstado {
  clientes: Record<string, string>
  projetos: Record<string, string>
  financeiro: Record<string, string>
  comunicacoes: Record<string, string>
}

export function ImportacaoWizard() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados principais
  const [step, setStep] = useState<WizardStep>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregandoArquivo, setCarregandoArquivo] = useState(false)
  const [workbook, setWorkbook] = useState<XLSXWorkbook | null>(null)
  const [abas, setAbas] = useState<AbaDetectada[]>([])

  // Abas selecionadas para importação
  const [abasSelecionadas, setAbasSelecionadas] = useState<{
    clientes?: string
    projetos?: string
    financeiro?: string
    comunicacoes?: string
  }>({})

  // Mapeamentos de campos
  const [mapeamentos, setMapeamentos] = useState<MapeamentosEstado>({
    clientes: {},
    projetos: {},
    financeiro: {},
    comunicacoes: {},
  })

  // Dados validados
  const [validando, setValidando] = useState(false)
  const [resultadoValidacao, setResultadoValidacao] = useState<{
    clientes?: ValidacaoResultado<ClienteMapeado>
    projetos?: ValidacaoResultado<ProjetoMapeado>
    financeiro?: ValidacaoResultado<FinanceiroMapeado>
    comunicacoes?: ValidacaoResultado<ComunicacaoMapeada>
  }>({})

  // Execução
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoImportacao | null>(null)
  const [resultadoFinal, setResultadoFinal] = useState<ImportacaoExecucaoResultado | null>(null)

  // Drag and drop
  const [dragOver, setDragOver] = useState(false)

  // 1. Processar arquivo selecionado
  async function handleFileSelect(file: File) {
    if (!file) return
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const isCsv = file.name.endsWith('.csv')
    if (!isXlsx && !isCsv) {
      toast.error('Formato não suportado. Por favor, envie uma planilha .xlsx, .xls ou .csv')
      return
    }

    setCarregandoArquivo(true)
    setArquivo(file)
    try {
      const { workbook: wb, abas: abasDetectadas } = await processarArquivoPlanilha(file)
      setWorkbook(wb)
      setAbas(abasDetectadas)

      // Auto-selecionar abas pelo tipo detectado
      const selecionadas: typeof abasSelecionadas = {}
      const mapasIniciais: MapeamentosEstado = {
        clientes: {},
        projetos: {},
        financeiro: {},
        comunicacoes: {},
      }

      for (const aba of abasDetectadas) {
        if (aba.tipoDetectado === 'clientes' && !selecionadas.clientes) {
          selecionadas.clientes = aba.nome
          mapasIniciais.clientes = autoMapearColunas(aba.colunas, 'clientes')
        } else if (aba.tipoDetectado === 'projetos' && !selecionadas.projetos) {
          selecionadas.projetos = aba.nome
          mapasIniciais.projetos = autoMapearColunas(aba.colunas, 'projetos')
        } else if (aba.tipoDetectado === 'financeiro' && !selecionadas.financeiro) {
          selecionadas.financeiro = aba.nome
          mapasIniciais.financeiro = autoMapearColunas(aba.colunas, 'financeiro')
        } else if (aba.tipoDetectado === 'comunicacoes' && !selecionadas.comunicacoes) {
          selecionadas.comunicacoes = aba.nome
          mapasIniciais.comunicacoes = autoMapearColunas(aba.colunas, 'comunicacoes')
        }
      }

      setAbasSelecionadas(selecionadas)
      setMapeamentos(mapasIniciais)
      setStep('mapeamento')
      toast.success(
        `Planilha "${file.name}" carregada com sucesso! ${abasDetectadas.length} abas identificadas.`,
      )
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Falha ao ler o arquivo: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCarregandoArquivo(false)
    }
  }

  // 2. Executar Validação das abas selecionadas
  async function executarValidacaoGeral() {
    if (!workbook) return
    setValidando(true)
    try {
      const XLSX = await loadSheetJS()
      const resultados: {
        clientes?: ValidacaoResultado<ClienteMapeado>
        projetos?: ValidacaoResultado<ProjetoMapeado>
        financeiro?: ValidacaoResultado<FinanceiroMapeado>
        comunicacoes?: ValidacaoResultado<ComunicacaoMapeada>
      } = {}

      // Validar Clientes
      let clientesValidados: ValidacaoResultado<ClienteMapeado> | undefined
      if (abasSelecionadas.clientes && workbook.Sheets[abasSelecionadas.clientes]) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[abasSelecionadas.clientes],
          { defval: '', blankrows: false },
        )
        clientesValidados = await validarClientes(rows, mapeamentos.clientes)
        resultados.clientes = clientesValidados
      }

      // Validar Projetos
      let projetosValidados: ValidacaoResultado<ProjetoMapeado> | undefined
      if (abasSelecionadas.projetos && workbook.Sheets[abasSelecionadas.projetos]) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[abasSelecionadas.projetos],
          { defval: '', blankrows: false },
        )
        projetosValidados = await validarProjetos(
          rows,
          mapeamentos.projetos,
          clientesValidados?.itens,
        )
        resultados.projetos = projetosValidados
      }

      // Validar Financeiro
      if (abasSelecionadas.financeiro && workbook.Sheets[abasSelecionadas.financeiro]) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[abasSelecionadas.financeiro],
          { defval: '', blankrows: false },
        )
        const finVal = await validarFinanceiro(
          rows,
          mapeamentos.financeiro,
          projetosValidados?.itens,
        )
        resultados.financeiro = finVal
      }

      // Validar Comunicações
      if (abasSelecionadas.comunicacoes && workbook.Sheets[abasSelecionadas.comunicacoes]) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[abasSelecionadas.comunicacoes],
          { defval: '', blankrows: false },
        )
        const comVal = await validarComunicacoes(rows, mapeamentos.comunicacoes)
        resultados.comunicacoes = comVal
      }

      setResultadoValidacao(resultados)
      setStep('validacao')
      toast.success('Pré-visualização e validação concluídas!')
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Erro durante validação: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setValidando(false)
    }
  }

  // 3. Efetuar importação no banco
  async function iniciarImportacao() {
    if (!arquivo) return
    setImportando(true)
    setStep('execucao')

    try {
      const res = await executarImportacao(
        {
          arquivoNome: arquivo.name,
          tamanhoBytes: arquivo.size,
          clientes: resultadoValidacao.clientes?.itens,
          projetos: resultadoValidacao.projetos?.itens,
          financeiro: resultadoValidacao.financeiro?.itens,
          comunicacoes: resultadoValidacao.comunicacoes?.itens,
        },
        (p) => setProgresso(p),
      )

      setResultadoFinal(res)
      setStep('resultado')
      toast.success('Base histórica importada com sucesso no CRM AEROCAD!')
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Falha na importação: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImportando(false)
    }
  }

  // Helper para alternar ação individual (criar, atualizar, ignorar)
  function toggleItemAcao(
    tipo: 'clientes' | 'projetos' | 'financeiro' | 'comunicacoes',
    linhaOriginal: number,
    novaAcao: 'criar' | 'atualizar' | 'ignorar',
  ) {
    setResultadoValidacao((prev) => {
      const val = prev[tipo] as ValidacaoResultado<any> | undefined
      if (!val) return prev
      const novosItens = val.itens.map((it: any) => {
        if (it.linhaOriginal === linhaOriginal) {
          return { ...it, acao: novaAcao }
        }
        return it
      })
      return {
        ...prev,
        [tipo]: {
          ...val,
          itens: novosItens,
          totalCriar: novosItens.filter((i: any) => i.acao === 'criar' && i.erros.length === 0)
            .length,
          totalAtualizar: novosItens.filter(
            (i: any) => i.acao === 'atualizar' && i.erros.length === 0,
          ).length,
          totalIgnorar: novosItens.filter((i: any) => i.acao === 'ignorar' || i.erros.length > 0)
            .length,
        },
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Indicador de Passos */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEDEDE] pb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-[#FF6A13]" />
          <div>
            <h2 className="text-lg font-bold text-[#4B4B4B]">Importação de Base Histórica</h2>
            <p className="text-xs text-[#737373]">
              Carregamento de planilha AEROCAD® (.xlsx/.csv) para o banco de dados do CRM
            </p>
          </div>
        </div>

        {/* Trilha do Wizard */}
        <div className="flex items-center gap-1 text-xs">
          {[
            { id: 'upload', label: '1. Arquivo' },
            { id: 'mapeamento', label: '2. Mapeamento' },
            { id: 'validacao', label: '3. Validação' },
            { id: 'execucao', label: '4. Gravação' },
            { id: 'resultado', label: '5. Resultado' },
          ].map((st, i) => {
            const isActive = step === st.id
            const isPassed =
              (st.id === 'upload' && step !== 'upload') ||
              (st.id === 'mapeamento' && !['upload', 'mapeamento'].includes(step)) ||
              (st.id === 'validacao' && ['execucao', 'resultado'].includes(step)) ||
              (st.id === 'execucao' && step === 'resultado')

            return (
              <React.Fragment key={st.id}>
                <span
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    isActive
                      ? 'bg-[#FF6A13] text-white font-bold'
                      : isPassed
                        ? 'bg-[#E5E5E5] text-[#4B4B4B]'
                        : 'text-[#8A8A8A]'
                  }`}
                >
                  {st.label}
                </span>
                {i < 4 && <span className="text-[#8A8A8A]">›</span>}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ETAPA 1: UPLOAD */}
      {step === 'upload' && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleFileSelect(f)
              }}
              className={`flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? 'border-[#FF6A13] bg-[#FFF5EE]'
                  : 'border-[#DEDEDE] bg-white hover:border-[#FF6A13]/50'
              }`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E5] text-[#FF6A13]">
                <FileUp className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-[#4B4B4B]">
                Arraste e solte a planilha aqui
              </h3>
              <p className="mt-1 text-xs text-[#737373]">
                Compatível com template AEROCAD® (.xlsx, .xls ou .csv) contendo abas Clientes,
                Projetos, Financeiro e Comunicações
              </p>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={carregandoArquivo}
                  className="bg-[#FF6A13] font-bold text-white hover:bg-[#E85B06]"
                >
                  {carregandoArquivo ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Lendo planilha...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar arquivo do computador
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-8 max-w-md text-left rounded-lg bg-[#F8F9FA] p-4 text-xs text-[#737373] border">
              <p className="font-bold text-[#4B4B4B] mb-1">
                Detecção inteligente de abas suportadas:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Clientes:</strong> Razão Social, CNPJ/CPF, Tipo, Segmento, Contatos...
                </li>
                <li>
                  <strong>Projetos:</strong> Escopo, Status da legenda, Nº PC/PT, Valor,
                  Município...
                </li>
                <li>
                  <strong>Financeiro:</strong> Parcelas, Marcos, Datas, NFS-e, Valores...
                </li>
                <li>
                  <strong>Comunicações:</strong> Registros cronológicos de e-mail, WhatsApp e
                  reuniões.
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-[#8A8A8A]">
                Células marcadas como <em>"a validar"</em> são tratadas com segurança e sinalizadas
                para revisão.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: MAPEAMENTO DE COLUNAS */}
      {step === 'mapeamento' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFF0E5] text-[#FF6A13]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#4B4B4B]">{arquivo?.name}</p>
                <p className="text-xs text-[#737373]">
                  {formatBytes(arquivo?.size || 0)} · {abas.length} abas identificadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep('upload')
                  setArquivo(null)
                  setWorkbook(null)
                }}
              >
                Trocar arquivo
              </Button>
              <Button
                size="sm"
                onClick={executarValidacaoGeral}
                disabled={validando}
                className="bg-[#FF6A13] font-bold text-white hover:bg-[#E85B06]"
              >
                {validando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    Avançar para Pré-visualização
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Abas e seleção */}
          <div className="grid gap-4 md:grid-cols-4">
            {abas.map((aba) => {
              const isUtil = ['clientes', 'projetos', 'financeiro', 'comunicacoes'].includes(
                aba.tipoDetectado,
              )
              const selecionadaTipo = Object.entries(abasSelecionadas).find(
                ([, v]) => v === aba.nome,
              )?.[0]

              return (
                <Card
                  key={aba.nome}
                  className={`border transition-all ${
                    selecionadaTipo
                      ? 'border-[#FF6A13] bg-[#FFFBF7] shadow-sm'
                      : 'bg-white opacity-85'
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#4B4B4B] truncate">
                        {aba.nome}
                      </span>
                      {isUtil ? (
                        <CrmBadge tone="orange">{aba.tipoDetectado.toUpperCase()}</CrmBadge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {aba.tipoDetectado}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 text-xs text-[#737373]">
                    <p>
                      Linhas válidas: <strong>{aba.totalLinhasValidas}</strong>
                    </p>
                    <p>Colunas: {aba.colunas.length}</p>

                    {isUtil && (
                      <div className="mt-3 pt-3 border-t">
                        <label className="text-[11px] font-bold text-[#4B4B4B]">
                          Importar como:
                        </label>
                        <Select
                          value={selecionadaTipo || 'desativado'}
                          onValueChange={(val) => {
                            setAbasSelecionadas((prev) => {
                              const next = { ...prev }
                              if (val === 'desativado') {
                                if (selecionadaTipo)
                                  delete next[selecionadaTipo as keyof typeof next]
                              } else {
                                next[val as keyof typeof next] = aba.nome
                                // Auto-mapear colunas
                                setMapeamentos((m) => ({
                                  ...m,
                                  [val]: autoMapearColunas(aba.colunas, val as any),
                                }))
                              }
                              return next
                            })
                          }}
                        >
                          <SelectTrigger className="mt-1 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desativado">— Não importar —</SelectItem>
                            <SelectItem value="clientes">Clientes</SelectItem>
                            <SelectItem value="projetos">Projetos</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="comunicacoes">Comunicações</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Configuração de mapeamento por aba selecionada */}
          <Tabs defaultValue="clientes" className="w-full">
            <TabsList className="bg-white border">
              {abasSelecionadas.clientes && (
                <TabsTrigger value="clientes">Clientes ({abasSelecionadas.clientes})</TabsTrigger>
              )}
              {abasSelecionadas.projetos && (
                <TabsTrigger value="projetos">Projetos ({abasSelecionadas.projetos})</TabsTrigger>
              )}
              {abasSelecionadas.financeiro && (
                <TabsTrigger value="financeiro">
                  Financeiro ({abasSelecionadas.financeiro})
                </TabsTrigger>
              )}
              {abasSelecionadas.comunicacoes && (
                <TabsTrigger value="comunicacoes">
                  Comunicações ({abasSelecionadas.comunicacoes})
                </TabsTrigger>
              )}
            </TabsList>

            {/* Configurações Clientes */}
            {abasSelecionadas.clientes && (
              <TabsContent value="clientes" className="mt-4">
                <MapeamentoColunasEditor
                  titulo="Mapeamento de Clientes"
                  descricao="Associe os cabeçalhos da planilha aos campos da coleção Clientes do CRM"
                  colunasPlanilha={
                    abas.find((a) => a.nome === abasSelecionadas.clientes)?.colunas || []
                  }
                  camposDestino={[
                    { chave: 'razao_social', label: 'Razão Social / Nome', obrigatorio: true },
                    { chave: 'cnpj_cpf', label: 'CNPJ / CPF' },
                    { chave: 'tipo', label: 'Tipo (PJ/PF)' },
                    { chave: 'segmento', label: 'Segmento' },
                    { chave: 'municipio_uf', label: 'Município/UF' },
                    { chave: 'contato_principal', label: 'Contato principal' },
                    { chave: 'cargo', label: 'Cargo' },
                    { chave: 'email', label: 'E-mail' },
                    { chave: 'telefone', label: 'Telefone / WhatsApp' },
                    { chave: 'contato_secundario', label: 'Contato secundário' },
                    { chave: 'primeira_contratacao', label: 'Primeira contratação' },
                    { chave: 'id_planilha', label: 'ID Cliente (identificador da linha)' },
                    { chave: 'observacoes', label: 'Observações' },
                  ]}
                  mapeamentoAtual={mapeamentos.clientes}
                  onChange={(campo, col) => {
                    setMapeamentos((prev) => ({
                      ...prev,
                      clientes: { ...prev.clientes, [campo]: col },
                    }))
                  }}
                />
              </TabsContent>
            )}

            {/* Configurações Projetos */}
            {abasSelecionadas.projetos && (
              <TabsContent value="projetos" className="mt-4">
                <MapeamentoColunasEditor
                  titulo="Mapeamento de Projetos"
                  descricao="Associe os cabeçalhos aos campos da coleção Projetos"
                  colunasPlanilha={
                    abas.find((a) => a.nome === abasSelecionadas.projetos)?.colunas || []
                  }
                  camposDestino={[
                    { chave: 'id_planilha', label: 'ID Projeto (P001, etc)', obrigatorio: true },
                    { chave: 'id_cliente', label: 'ID Cliente (vínculo via C001 ou doc)' },
                    { chave: 'cliente_ref', label: 'Cliente (ref. textual)' },
                    { chave: 'numero_pc_pt', label: 'Nº PC/PT' },
                    { chave: 'tipo_servico', label: 'Tipo de serviço' },
                    { chave: 'escopo_resumido', label: 'Escopo resumido / Nome' },
                    { chave: 'municipio_uf', label: 'Município/UF do empreendimento' },
                    { chave: 'aerodromo', label: 'Aeródromo (ICAO/IATA)' },
                    { chave: 'data_proposta', label: 'Data da proposta' },
                    { chave: 'data_aceite', label: 'Data de aceite' },
                    { chave: 'prazo_dias', label: 'Prazo (dias)' },
                    { chave: 'valor_global', label: 'Valor global (R$)' },
                    { chave: 'status', label: 'Status da legenda' },
                    { chave: 'marco_fase_atual', label: 'Marco/fase atual' },
                    { chave: 'proxima_entrega', label: 'Próxima entrega' },
                    { chave: 'pendente_orgao', label: 'Pendente de órgão (DECEA/ANAC)?' },
                    { chave: 'observacoes', label: 'Observações' },
                  ]}
                  mapeamentoAtual={mapeamentos.projetos}
                  onChange={(campo, col) => {
                    setMapeamentos((prev) => ({
                      ...prev,
                      projetos: { ...prev.projetos, [campo]: col },
                    }))
                  }}
                />
              </TabsContent>
            )}

            {/* Configurações Financeiro */}
            {abasSelecionadas.financeiro && (
              <TabsContent value="financeiro" className="mt-4">
                <MapeamentoColunasEditor
                  titulo="Mapeamento Financeiro"
                  descricao="Associe os cabeçalhos aos lançamentos e parcelas financeiras"
                  colunasPlanilha={
                    abas.find((a) => a.nome === abasSelecionadas.financeiro)?.colunas || []
                  }
                  camposDestino={[
                    {
                      chave: 'id_lancamento',
                      label: 'ID Lançamento (F001, etc)',
                      obrigatorio: true,
                    },
                    { chave: 'id_projeto', label: 'ID Projeto (P001, etc)' },
                    { chave: 'projeto_ref', label: 'Projeto (ref. textual)' },
                    { chave: 'numero_parcela_marco', label: 'Nº da parcela / marco' },
                    { chave: 'percentual_contrato', label: '% do contrato' },
                    { chave: 'valor', label: 'Valor (R$)', obrigatorio: true },
                    { chave: 'evento_comprobatorio', label: 'Evento comprobatório' },
                    { chave: 'data_prevista', label: 'Data prevista' },
                    { chave: 'data_faturamento', label: 'Data de faturamento' },
                    { chave: 'nf_numero', label: 'Nº NFS-e' },
                    { chave: 'vencimento', label: 'Data de vencimento' },
                    { chave: 'data_pagamento', label: 'Data de recebimento' },
                    { chave: 'status_pagamento', label: 'Status pagamento' },
                    { chave: 'observacoes', label: 'Observações' },
                  ]}
                  mapeamentoAtual={mapeamentos.financeiro}
                  onChange={(campo, col) => {
                    setMapeamentos((prev) => ({
                      ...prev,
                      financeiro: { ...prev.financeiro, [campo]: col },
                    }))
                  }}
                />
              </TabsContent>
            )}

            {/* Configurações Comunicações */}
            {abasSelecionadas.comunicacoes && (
              <TabsContent value="comunicacoes" className="mt-4">
                <MapeamentoColunasEditor
                  titulo="Mapeamento de Comunicações"
                  descricao="Associe os cabeçalhos ao histórico de atividades e contatos"
                  colunasPlanilha={
                    abas.find((a) => a.nome === abasSelecionadas.comunicacoes)?.colunas || []
                  }
                  camposDestino={[
                    { chave: 'id_planilha', label: 'ID Comunicação' },
                    { chave: 'id_cliente', label: 'ID Cliente' },
                    { chave: 'cliente_ref', label: 'Cliente (ref.)' },
                    { chave: 'data_hora', label: 'Data / Hora' },
                    { chave: 'tipo', label: 'Tipo (e-mail, WhatsApp, reunião)' },
                    { chave: 'texto', label: 'Mensagem / Descrição', obrigatorio: true },
                    { chave: 'usuario', label: 'Responsável' },
                    { chave: 'observacoes', label: 'Observações' },
                  ]}
                  mapeamentoAtual={mapeamentos.comunicacoes}
                  onChange={(campo, col) => {
                    setMapeamentos((prev) => ({
                      ...prev,
                      comunicacoes: { ...prev.comunicacoes, [campo]: col },
                    }))
                  }}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* ETAPA 3: VALIDAÇÃO E PRÉ-VISUALIZAÇÃO */}
      {step === 'validacao' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 border shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-[#4B4B4B]">
                Relatório de Pré-visualização e Análise de Conflitos
              </h3>
              <p className="text-xs text-[#737373]">
                Revise os registros antes da gravação. Conflitos de CNPJ/CPF e projetos existentes
                são detectados automaticamente.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapeamento')}>
                Voltar ao Mapeamento
              </Button>
              <Button
                size="sm"
                onClick={iniciarImportacao}
                className="bg-[#248A57] font-bold text-white hover:bg-[#1E7348]"
              >
                Confirmar e Gravar no Banco
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResumoValidacaoCard titulo="Clientes" validacao={resultadoValidacao.clientes} />
            <ResumoValidacaoCard titulo="Projetos" validacao={resultadoValidacao.projetos} />
            <ResumoValidacaoCard titulo="Financeiro" validacao={resultadoValidacao.financeiro} />
            <ResumoValidacaoCard
              titulo="Comunicações"
              validacao={resultadoValidacao.comunicacoes}
            />
          </div>

          {/* Tabelas de Pré-visualização com Badges */}
          <Tabs defaultValue="clientes" className="w-full">
            <TabsList className="bg-white border">
              {resultadoValidacao.clientes && (
                <TabsTrigger value="clientes">
                  Clientes ({resultadoValidacao.clientes.itens.length})
                </TabsTrigger>
              )}
              {resultadoValidacao.projetos && (
                <TabsTrigger value="projetos">
                  Projetos ({resultadoValidacao.projetos.itens.length})
                </TabsTrigger>
              )}
              {resultadoValidacao.financeiro && (
                <TabsTrigger value="financeiro">
                  Financeiro ({resultadoValidacao.financeiro.itens.length})
                </TabsTrigger>
              )}
              {resultadoValidacao.comunicacoes && (
                <TabsTrigger value="comunicacoes">
                  Comunicações ({resultadoValidacao.comunicacoes.itens.length})
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tabela Clientes */}
            {resultadoValidacao.clientes && (
              <TabsContent value="clientes" className="mt-4">
                <TabelaPrevisualizacaoGenerica
                  itens={resultadoValidacao.clientes.itens}
                  colunasVisiveis={[
                    { key: 'razao_social', label: 'Razão Social' },
                    { key: 'cnpj_cpf', label: 'CNPJ / CPF' },
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'segmento', label: 'Segmento' },
                    { key: 'municipio_uf', label: 'Município/UF' },
                    { key: 'contato_principal', label: 'Contato Principal' },
                  ]}
                  onAcaoChange={(linha, acao) => toggleItemAcao('clientes', linha, acao)}
                />
              </TabsContent>
            )}

            {/* Tabela Projetos */}
            {resultadoValidacao.projetos && (
              <TabsContent value="projetos" className="mt-4">
                <TabelaPrevisualizacaoGenerica
                  itens={resultadoValidacao.projetos.itens}
                  colunasVisiveis={[
                    { key: 'id_planilha', label: 'ID' },
                    { key: 'cliente_ref', label: 'Cliente (ref.)' },
                    { key: 'tipo_servico', label: 'Serviço' },
                    { key: 'numero_pc_pt', label: 'PC/PT' },
                    { key: 'status_planilha', label: 'Status' },
                    {
                      key: 'valor_global',
                      label: 'Valor Global',
                      formatter: (v) => formatCurrency(Number(v) || 0),
                    },
                    { key: 'pendente_orgao', label: 'Órgão pendente' },
                  ]}
                  onAcaoChange={(linha, acao) => toggleItemAcao('projetos', linha, acao)}
                />
              </TabsContent>
            )}

            {/* Tabela Financeiro */}
            {resultadoValidacao.financeiro && (
              <TabsContent value="financeiro" className="mt-4">
                <TabelaPrevisualizacaoGenerica
                  itens={resultadoValidacao.financeiro.itens}
                  colunasVisiveis={[
                    { key: 'id_lancamento', label: 'ID' },
                    { key: 'id_projeto', label: 'ID Projeto' },
                    { key: 'numero_parcela_marco', label: 'Parcela / Marco' },
                    {
                      key: 'percentual_contrato',
                      label: '%',
                      formatter: (v) => (v ? `${v}%` : '—'),
                    },
                    {
                      key: 'valor',
                      label: 'Valor',
                      formatter: (v) => formatCurrency(Number(v) || 0),
                    },
                    { key: 'evento_comprobatorio', label: 'Evento comprobatório' },
                    { key: 'vencimento', label: 'Vencimento' },
                  ]}
                  onAcaoChange={(linha, acao) => toggleItemAcao('financeiro', linha, acao)}
                />
              </TabsContent>
            )}

            {/* Tabela Comunicações */}
            {resultadoValidacao.comunicacoes && (
              <TabsContent value="comunicacoes" className="mt-4">
                <TabelaPrevisualizacaoGenerica
                  itens={resultadoValidacao.comunicacoes.itens}
                  colunasVisiveis={[
                    { key: 'id_planilha', label: 'ID' },
                    { key: 'cliente_ref', label: 'Cliente' },
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'texto', label: 'Descrição' },
                    { key: 'data_hora', label: 'Data' },
                  ]}
                  onAcaoChange={(linha, acao) => toggleItemAcao('comunicacoes', linha, acao)}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* ETAPA 4: EXECUÇÃO EM TEMPO REAL */}
      {step === 'execucao' && (
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E5] text-[#FF6A13] animate-pulse">
              <Database className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#4B4B4B]">Gravando dados no CRM AEROCAD...</h3>
              <p className="text-xs text-[#737373] mt-1">
                {progresso?.etapaAtual || 'Processando lotes de importação...'}
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <Progress value={progresso?.percentual || 0} className="h-3" />
              <div className="flex justify-between text-xs text-[#737373]">
                <span>{progresso?.percentual || 0}%</span>
                <span>
                  {progresso?.processados || 0} de {progresso?.totalGeral || 0} registros
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-6 text-xs border-t pt-4 max-w-lg mx-auto">
              <div>
                <p className="font-bold text-[#248A57] text-base">{progresso?.criados || 0}</p>
                <p className="text-[#737373]">Criados</p>
              </div>
              <div>
                <p className="font-bold text-[#0066CC] text-base">{progresso?.atualizados || 0}</p>
                <p className="text-[#737373]">Atualizados</p>
              </div>
              <div>
                <p className="font-bold text-[#C83E36] text-base">{progresso?.erros || 0}</p>
                <p className="text-[#737373]">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 5: RESULTADO FINAL E REGISTROS A VALIDAR */}
      {step === 'resultado' && resultadoFinal && (
        <div className="space-y-6">
          <Card className="border-[#248A57]/30 bg-[#F4FBF7]">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#248A57]/15 text-[#248A57]">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E7348]">
                      Importação Concluída com Sucesso!
                    </h3>
                    <p className="text-xs text-[#737373]">
                      Arquivo: <strong>{arquivo?.name}</strong> · Log registrado no sistema
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setStep('upload')
                    setArquivo(null)
                    setWorkbook(null)
                    setResultadoFinal(null)
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-white"
                >
                  Importar outra planilha
                </Button>
              </div>

              {/* Métricas por coleção */}
              <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-4">
                <CardResumoFinal
                  titulo="Clientes"
                  criados={resultadoFinal.clientes.criados}
                  atualizados={resultadoFinal.clientes.atualizados}
                  erros={resultadoFinal.clientes.erros}
                />
                <CardResumoFinal
                  titulo="Projetos"
                  criados={resultadoFinal.projetos.criados}
                  atualizados={resultadoFinal.projetos.atualizados}
                  erros={resultadoFinal.projetos.erros}
                />
                <CardResumoFinal
                  titulo="Financeiro"
                  criados={resultadoFinal.financeiro.criados}
                  atualizados={resultadoFinal.financeiro.atualizados}
                  erros={resultadoFinal.financeiro.erros}
                />
                <CardResumoFinal
                  titulo="Comunicações"
                  criados={resultadoFinal.comunicacoes.criados}
                  atualizados={resultadoFinal.comunicacoes.atualizados}
                  erros={resultadoFinal.comunicacoes.erros}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lista de Registros com "Pendente de Validação" */}
          {resultadoFinal.pendenciasValidacao.length > 0 && (
            <Card className="border-[#F59E0B]/40">
              <CardHeader className="bg-[#FFFDF5] border-b p-4">
                <div className="flex items-center gap-2 text-[#D97706]">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle className="text-sm font-bold">
                    Registros Importados com Pendência de Validação (
                    {resultadoFinal.pendenciasValidacao.length})
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Estes registros foram salvos no CRM mas continham campos preenchidos com "a
                  validar" na planilha original. Clique para abrir e validar diretamente na
                  interface.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-80 overflow-y-auto">
                  {resultadoFinal.pendenciasValidacao.map((item) => (
                    <div
                      key={`${item.colecao}-${item.id}`}
                      className="flex items-center justify-between p-3 px-4 hover:bg-[#F9FAFB] text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#4B4B4B]">{item.titulo}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {item.colecao}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.camposPendentes.map((cp) => (
                            <span
                              key={cp}
                              className="inline-flex items-center rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92400E]"
                            >
                              {cp}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button asChild size="sm" variant="ghost" className="h-8 gap-1">
                        <Link to={item.rota}>
                          <span>Abrir no CRM</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erros detalhados se houver */}
          {resultadoFinal.errosDetalhados.length > 0 && (
            <Card className="border-[#C83E36]/30">
              <CardHeader className="p-4 bg-[#FFF5F5] border-b">
                <div className="flex items-center gap-2 text-[#C83E36]">
                  <AlertCircle className="h-5 w-5" />
                  <CardTitle className="text-sm font-bold">
                    Erros de Linhas Individuais ({resultadoFinal.errosDetalhados.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="list-disc pl-5 space-y-1 text-xs text-[#737373]">
                  {resultadoFinal.errosDetalhados.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// Subcomponente de Edição de Mapeamento
function MapeamentoColunasEditor({
  titulo,
  descricao,
  colunasPlanilha,
  camposDestino,
  mapeamentoAtual,
  onChange,
}: {
  titulo: string
  descricao: string
  colunasPlanilha: string[]
  camposDestino: { chave: string; label: string; obrigatorio?: boolean }[]
  mapeamentoAtual: Record<string, string>
  onChange: (campo: string, coluna: string) => void
}) {
  return (
    <Card>
      <CardHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#FF6A13]" />
          <CardTitle className="text-sm font-bold">{titulo}</CardTitle>
        </div>
        <CardDescription className="text-xs">{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {camposDestino.map((campo) => (
            <div key={campo.chave} className="rounded-lg border p-3 bg-[#FAFAFA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#4B4B4B]">
                  {campo.label}
                  {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
                </span>
              </div>
              <Select
                value={mapeamentoAtual[campo.chave] || 'nenhuma'}
                onValueChange={(val) => onChange(campo.chave, val === 'nenhuma' ? '' : val)}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Selecione coluna..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">— Não mapear —</SelectItem>
                  {colunasPlanilha.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Card de Resumo de Validação
function ResumoValidacaoCard({
  titulo,
  validacao,
}: {
  titulo: string
  validacao?: {
    totalLinhas: number
    totalCriar: number
    totalAtualizar: number
    totalIgnorar: number
    totalErros: number
    totalComAvisos: number
  }
}) {
  if (!validacao) {
    return (
      <Card className="border-dashed bg-[#FAFAFA]">
        <CardContent className="p-4 text-xs text-[#8A8A8A]">
          {titulo}: Não selecionado para importação
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border">
      <CardHeader className="p-3 pb-1 border-b">
        <CardTitle className="text-xs font-bold text-[#4B4B4B]">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-[#737373]">A Criar:</span>
          <span className="font-bold text-[#248A57]">{validacao.totalCriar}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#737373]">A Atualizar:</span>
          <span className="font-bold text-[#0066CC]">{validacao.totalAtualizar}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#737373]">Com pendências ("a validar"):</span>
          <span className="font-bold text-[#D97706]">{validacao.totalComAvisos}</span>
        </div>
        {validacao.totalErros > 0 && (
          <div className="flex justify-between border-t pt-1">
            <span className="text-red-600 font-medium">Erros:</span>
            <span className="font-bold text-red-600">{validacao.totalErros}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Tabela Genérica de Pré-visualização
function TabelaPrevisualizacaoGenerica<T extends Record<string, unknown>>({
  itens,
  colunasVisiveis,
  onAcaoChange,
}: {
  itens: Array<{
    linhaOriginal: number
    dadosMapeados: T
    avisos: string[]
    erros: string[]
    camposAValidar: string[]
    acao: 'criar' | 'atualizar' | 'ignorar'
    conflitoDescricao?: string
  }>
  colunasVisiveis: { key: string; label: string; formatter?: (v: unknown) => React.ReactNode }[]
  onAcaoChange: (linha: number, acao: 'criar' | 'atualizar' | 'ignorar') => void
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader className="bg-[#F8F9FA] sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-12 text-center text-xs">Linha</TableHead>
              <TableHead className="w-28 text-xs">Ação</TableHead>
              {colunasVisiveis.map((c) => (
                <TableHead key={c.key} className="text-xs">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="text-xs">Status / Avisos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <TableRow
                key={item.linhaOriginal}
                className={
                  item.erros.length > 0
                    ? 'bg-[#FFF5F5]'
                    : item.acao === 'atualizar'
                      ? 'bg-[#F0F7FF]'
                      : undefined
                }
              >
                <TableCell className="text-center font-mono text-xs text-[#8A8A8A]">
                  {item.linhaOriginal}
                </TableCell>
                <TableCell>
                  <Select
                    value={item.acao}
                    onValueChange={(val: any) => onAcaoChange(item.linhaOriginal, val)}
                  >
                    <SelectTrigger className="h-7 text-[11px] w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="criar">Criar</SelectItem>
                      <SelectItem value="atualizar">Atualizar</SelectItem>
                      <SelectItem value="ignorar">Ignorar</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                {colunasVisiveis.map((c) => {
                  const val = item.dadosMapeados[c.key]
                  const formatted = c.formatter ? c.formatter(val) : String(val || '—')
                  return (
                    <TableCell key={c.key} className="text-xs max-w-[200px] truncate">
                      {formatted}
                    </TableCell>
                  )
                })}

                <TableCell className="text-xs space-y-1">
                  {item.acao === 'atualizar' && (
                    <Badge
                      variant="outline"
                      className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]"
                    >
                      Atualizar existente
                    </Badge>
                  )}
                  {item.camposAValidar.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.camposAValidar.map((cp) => (
                        <span
                          key={cp}
                          className="inline-flex items-center rounded bg-amber-100 px-1 py-0.2 text-[9px] font-semibold text-amber-800"
                        >
                          {cp}: a validar
                        </span>
                      ))}
                    </div>
                  )}
                  {item.avisos.map((av, idx) => (
                    <p key={idx} className="text-[10px] text-amber-700">
                      • {av}
                    </p>
                  ))}
                  {item.erros.map((er, idx) => (
                    <p key={idx} className="text-[10px] text-red-600 font-semibold">
                      • {er}
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CardResumoFinal({
  titulo,
  criados,
  atualizados,
  erros,
}: {
  titulo: string
  criados: number
  atualizados: number
  erros: number
}) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-xs">
      <p className="font-bold text-xs text-[#4B4B4B]">{titulo}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xs text-[#737373]">Criados:</span>
        <span className="font-bold text-sm text-[#248A57]">{criados}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-[#737373]">Atualizados:</span>
        <span className="font-bold text-sm text-[#0066CC]">{atualizados}</span>
      </div>
      {erros > 0 && (
        <div className="flex items-baseline justify-between border-t mt-1 pt-1">
          <span className="text-xs text-red-600">Erros:</span>
          <span className="font-bold text-sm text-red-600">{erros}</span>
        </div>
      )}
    </div>
  )
}
