/**
 * Componente da seção "Exportar Dados" das Configurações do CRM AEROCAD.
 *
 * Funcionalidades:
 * - Apenas perfil 'admin' tem acesso.
 * - Exportação completa de todas as coleções de negócio em um único arquivo JSON (.json).
 * - Exportação por coleção individual em planilha Excel formatada (.xlsx) com estilo AEROCAD.
 * - Leitura inicial das contagens de registros de cada coleção com indicador de progresso.
 * - Exibição de progresso em tempo real durante exportações volumosas.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileJson,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderSync,
  Layers,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrmBadge } from '@/components/common/CrmBadge'
import { useAuth } from '@/contexts/AuthContext'
import {
  COLECOES_NEGOCIO_AEROCAD,
  type ColecaoExportConfig,
  type ExportProgressEvent,
  obterContagensTodasColecoes,
  exportarBackupCompletoJson,
  exportarColecaoXlsx,
} from '@/services/exportacaoDadosService'
import packageInfo from '../../../package.json'

// Lista adicional para exibição de NFS-e como coleção exportável específica
const COLECAO_NFSE_VIRTUAL: ColecaoExportConfig = {
  id: 'nfse',
  label: 'Notas Fiscais (NFS-e)',
  categoria: 'financeiro',
  permiteXlsx: true,
  descricao: 'Notas fiscais de serviço vinculadas a parcelas e faturamentos',
}

export function ExportarDadosSection() {
  const { user } = useAuth()
  const [contagens, setContagens] = useState<Record<string, number | null>>({})
  const [carregandoContagens, setCarregandoContagens] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todas')

  // Estados de exportação
  const [exportandoJson, setExportandoJson] = useState(false)
  const [progressoJson, setProgressoJson] = useState<ExportProgressEvent | null>(null)
  const [colecaoExportandoXlsx, setColecaoExportandoXlsx] = useState<string | null>(null)
  const [progressoXlsx, setProgressoXlsx] = useState<{ lidos: number; total: number } | null>(null)

  const carregarContagens = useCallback(async () => {
    setCarregandoContagens(true)
    try {
      const mapa = await obterContagensTodasColecoes()
      setContagens(mapa)
    } catch (err) {
      console.warn('Erro ao carregar contagens:', err)
      toast.error('Não foi possível atualizar a contagem de registros.')
    } finally {
      setCarregandoContagens(false)
    }
  }, [])

  useEffect(() => {
    void carregarContagens()
  }, [carregarContagens])

  // Totalizador geral de registros
  const totalRegistrosEstimados = useMemo(() => {
    return Object.values(contagens).reduce<number>(
      (acc, v) => acc + (typeof v === 'number' ? v : 0),
      0,
    )
  }, [contagens])

  // Todas as coleções exibidas na tabela (incluindo NFS-e virtual)
  const colecoesCompletas = useMemo(() => {
    const lista = [...COLECOES_NEGOCIO_AEROCAD]
    // Insere NFS-e logo após parcelas
    const idxParcelas = lista.findIndex((c) => c.id === 'parcelas')
    if (idxParcelas >= 0) {
      lista.splice(idxParcelas + 1, 0, COLECAO_NFSE_VIRTUAL)
    } else {
      lista.push(COLECAO_NFSE_VIRTUAL)
    }
    return lista
  }, [])

  // Coleções filtradas pela busca e categoria
  const colecoesFiltradas = useMemo(() => {
    return colecoesCompletas.filter((col) => {
      const matchBusca =
        col.label.toLowerCase().includes(termoBusca.toLowerCase()) ||
        col.id.toLowerCase().includes(termoBusca.toLowerCase()) ||
        (col.descricao && col.descricao.toLowerCase().includes(termoBusca.toLowerCase()))

      const matchCat = categoriaAtiva === 'todas' || col.categoria === categoriaAtiva
      return matchBusca && matchCat
    })
  }, [colecoesCompletas, termoBusca, categoriaAtiva])

  // Handler de exportação do JSON completo
  async function handleExportarJsonCompleto() {
    setExportandoJson(true)
    setProgressoJson(null)
    const toastId = toast.loading('Iniciando exportação completa do banco...')

    try {
      const res = await exportarBackupCompletoJson(
        packageInfo.version || '0.0.71',
        user?.name,
        (evento) => {
          setProgressoJson(evento)
          toast.loading(evento.mensagem, { id: toastId })
        },
      )

      toast.success(
        `Backup concluído com sucesso! ${res.totalRegistros.toLocaleString('pt-BR')} registros exportados em ${res.nomeArquivo}.`,
        { id: toastId },
      )

      if (res.avisos.length > 0) {
        toast.warning(
          `${res.avisos.length} aviso(s) durante o backup. Consulte o campo "_metadados.avisos" no JSON.`,
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Falha ao exportar backup JSON: ${msg}`, { id: toastId })
    } finally {
      setExportandoJson(false)
      setProgressoJson(null)
    }
  }

  // Handler de exportação de uma coleção em XLSX
  async function handleExportarColecaoXlsx(col: ColecaoExportConfig) {
    setColecaoExportandoXlsx(col.id)
    setProgressoXlsx(null)
    const toastId = toast.loading(`Exportando ${col.label} para Excel...`)

    try {
      const res = await exportarColecaoXlsx(col.id, user?.name, (lidos, total) => {
        setProgressoXlsx({ lidos, total })
        toast.loading(`Lendo ${col.label}: ${lidos}/${total} registros...`, { id: toastId })
      })

      toast.success(
        `Planilha ${res.nomeArquivo} gerada com sucesso (${res.totalRegistros} registros)!`,
        { id: toastId },
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao exportar planilha de ${col.label}: ${msg}`, { id: toastId })
    } finally {
      setColecaoExportandoXlsx(null)
      setProgressoXlsx(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Principal de Ação e Metadados */}
      <div className="crm-card border-l-4 border-l-[#FF6A13] p-5 sm:p-6 bg-gradient-to-r from-[#FFFBF8] to-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FF6A13]/10 text-[#FF6A13]">
                <Database className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#D65100]">
                BACKUP E EXPORTAÇÃO DE DADOS
              </span>
              <CrmBadge tone="orange" className="text-[10px]">
                v{packageInfo.version}
              </CrmBadge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">
              Exportar Banco de Dados PocketBase
            </h2>
            <p className="text-sm text-neutral-600 max-w-2xl leading-relaxed">
              Exporte todos os dados de negócio do CRM em formato aberto JSON para backup seguro e
              preservação histórica, ou baixe planilhas Excel formatadas no padrão AEROCAD para cada
              coleção individual.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 pt-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#FF6A13]" />
                {COLECOES_NEGOCIO_AEROCAD.length} coleções de negócio
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {carregandoContagens ? (
                  <span className="animate-pulse">calculando total...</span>
                ) : (
                  <span>
                    {totalRegistrosEstimados.toLocaleString('pt-BR')} registros cadastrados
                  </span>
                )}
              </span>
              <span>·</span>
              <span className="text-neutral-400">Fuso: America/Sao_Paulo (Brasília)</span>
            </div>
          </div>

          {/* Botão de Destaque: Download JSON Completo */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={carregarContagens}
              disabled={carregandoContagens || exportandoJson}
              className="text-xs h-10 border-neutral-300"
              title="Recarregar contagem de registros"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 text-neutral-500 ${carregandoContagens ? 'animate-spin' : ''}`}
              />
              Atualizar
            </Button>

            <Button
              onClick={handleExportarJsonCompleto}
              disabled={exportandoJson || Boolean(colecaoExportandoXlsx)}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold h-10 px-5 shadow-sm text-xs"
            >
              {exportandoJson ? (
                <>
                  <FolderSync className="mr-2 h-4 w-4 animate-spin" />
                  <span>
                    {progressoJson
                      ? `Exportando (${progressoJson.colecaoIndex}/${progressoJson.totalColecoes})...`
                      : 'Preparando backup...'}
                  </span>
                </>
              ) : (
                <>
                  <FileJson className="mr-2 h-4 w-4" />
                  <span>Baixar JSON Completo</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Barra de Progresso durante Exportação do JSON */}
        {exportandoJson && progressoJson && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <div className="flex items-center justify-between text-xs text-neutral-700 mb-1.5">
              <span className="font-semibold text-[#D65100] flex items-center gap-1.5">
                <FolderSync className="h-3.5 w-3.5 animate-spin" />
                {progressoJson.mensagem}
              </span>
              <span className="font-mono text-neutral-500">
                Coleção {progressoJson.colecaoIndex} de {progressoJson.totalColecoes}
              </span>
            </div>
            <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#FF6A13] h-2 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round((progressoJson.colecaoIndex / progressoJson.totalColecoes) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Coleções com Exportação Individual */}
      <div className="crm-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-neutral-900">Coleções do Banco de Dados</h3>
              <p className="text-xs text-neutral-500">
                Baixe planilhas Excel (.xlsx) das coleções individuais ou consulte o volume de
                registros.
              </p>
            </div>

            {/* Abas Rápidas de Filtro de Categoria */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'todas', label: 'Todas' },
                { id: 'comercial', label: 'Comercial' },
                { id: 'tecnico', label: 'Técnico' },
                { id: 'financeiro', label: 'Financeiro' },
                { id: 'pessoas', label: 'Pessoas' },
                { id: 'sistema', label: 'Sistema' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                    categoriaAtiva === cat.id
                      ? 'bg-[#FF6A13] text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar coleção por nome, identificador no PocketBase ou descrição..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        {/* Linha de Status de Progresso de XLSX */}
        {colecaoExportandoXlsx && progressoXlsx && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
            <span className="flex items-center gap-1.5 font-medium">
              <FolderSync className="h-3.5 w-3.5 animate-spin text-[#FF6A13]" />
              Gerando planilha de {colecaoExportandoXlsx}... Lidos {progressoXlsx.lidos} de{' '}
              {progressoXlsx.total} registros
            </span>
            <span className="font-mono text-[11px]">
              {Math.round((progressoXlsx.lidos / Math.max(progressoXlsx.total, 1)) * 100)}%
            </span>
          </div>
        )}

        {/* Lista de Coleções */}
        <div className="divide-y divide-neutral-200">
          {colecoesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              Nenhuma coleção encontrada para "{termoBusca}".
            </div>
          ) : (
            colecoesFiltradas.map((col) => {
              const count =
                col.id === 'nfse'
                  ? contagens['parcelas'] !== null && contagens['parcelas'] !== undefined
                    ? `~${contagens['parcelas']}`
                    : null
                  : contagens[col.id]

              const isExportingThis = colecaoExportandoXlsx === col.id

              return (
                <div
                  key={col.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 sm:p-4 gap-3 hover:bg-neutral-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 mt-0.5">
                      {col.permiteXlsx ? (
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Database className="h-4 w-4 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-neutral-900">
                          {col.label}
                        </span>
                        <code className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                          {col.id}
                        </code>
                        <span className="text-[10px] uppercase font-semibold text-neutral-400">
                          {col.categoria}
                        </span>
                      </div>
                      {col.descricao && (
                        <p className="text-xs text-neutral-500 truncate mt-0.5">{col.descricao}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                    {/* Contador de registros */}
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-800">
                        {carregandoContagens ? (
                          <span className="text-neutral-400 animate-pulse text-[11px]">
                            contando...
                          </span>
                        ) : count !== null && count !== undefined ? (
                          <span>{count.toLocaleString('pt-BR')} registros</span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="h-3 w-3" />
                            indisponível
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botão de Exportação Excel */}
                    {col.permiteXlsx ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportarColecaoXlsx(col)}
                        disabled={exportandoJson || Boolean(colecaoExportandoXlsx)}
                        className="h-8 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
                        title={`Exportar ${col.label} em planilha Excel formatada`}
                      >
                        {isExportingThis ? (
                          <>
                            <FolderSync className="mr-1.5 h-3.5 w-3.5 animate-spin text-emerald-600" />
                            <span>Exportando...</span>
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                            <span>Excel</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportarColecaoXlsx(col)}
                        disabled={exportandoJson || Boolean(colecaoExportandoXlsx)}
                        className="h-8 text-[11px] text-neutral-500 hover:bg-neutral-100"
                        title="Exportar dados brutos em planilha básica"
                      >
                        {isExportingThis ? (
                          <FolderSync className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                        ) : (
                          <>
                            <Download className="mr-1 h-3 w-3" />
                            <span>XLSX</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>
            * Apenas leitura dos registros existentes. Nenhuma alteração é gravada no banco de
            dados.
          </span>
          <span className="font-mono text-[11px] text-neutral-400">
            Formato: DD/MM/AAAA · Moeda: R$ · Padrão AEROCAD
          </span>
        </div>
      </div>
    </div>
  )
}
