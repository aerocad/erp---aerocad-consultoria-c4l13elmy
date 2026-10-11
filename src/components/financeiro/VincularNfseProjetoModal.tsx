import { useState, useMemo, useRef, useEffect, ChangeEvent } from 'react'
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
import { ParcelaRecord, ProjetoRecord, ClienteRecord } from '@/types/crm'
import { formatCurrency, formatDate } from '@/lib/format'
import { pb } from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { vincularNotaOrfaAParcela, processarClientesTomadores } from '@/services/nfseExecutor'
import { NfseDadoExtraido, parseXmlNfse } from '@/services/nfseParser'
import { processarArquivosEmLote, ArquivoNaoReconhecido } from '@/services/nfseBatchParser'
import {
  agruparECorrelacionarTomadores,
  TomadorExtraidoNfse,
} from '@/services/nfseClienteCorrelacionador'
import {
  Search,
  Link as LinkIcon,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileCode,
  FileArchive,
  RefreshCw,
  XCircle,
  Building2,
  UserCheck,
  Info,
} from 'lucide-react'

export interface VincularNfseProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord
  parcelasExistentes: ParcelaRecord[]
  onSuccess: () => void
}

interface NotaCandidata {
  tipo: 'cadastrada' | 'orfa'
  id: string
  numero: string
  valor: number
  dataEmissao?: string
  tomadorRazao?: string
  descricaoServico?: string
  parcelaVinculada?: ParcelaRecord
  notaOrfaOriginal?: NfseDadoExtraido
}

interface PreviaNotaUpload {
  nota: NfseDadoExtraido
  jaExisteNoBanco: boolean
  parcelaExistenteId?: string
  parcelaExistenteDescricao?: string
  parcelaExistenteProjetoNumero?: string
  tomador: TomadorExtraidoNfse
  descricaoMedicao: string
  destinoParcela: 'nova' | 'existente'
  parcelaSelecionadaId?: string
  modoCliente: 'manter_atual' | 'vincular' | 'criar'
  clienteIdExistente?: string
}

export function VincularNfseProjetoModal({
  open,
  onOpenChange,
  projeto,
  parcelasExistentes,
  onSuccess,
}: VincularNfseProjetoModalProps) {
  // Aba ativa: 'upload' (anexar novo XML/ZIP) ou 'existente' (escolher nota do sistema)
  const [activeTab, setActiveTab] = useState<'upload' | 'existente'>('upload')

  // --- ABA: ESCOLHER EXISTENTE ---
  const [busca, setBusca] = useState('')
  const [loadingExistentes, setLoadingExistentes] = useState(false)
  const [todasNotas, setTodasNotas] = useState<NotaCandidata[]>([])
  const [carregouNotas, setCarregouNotas] = useState(false)
  const [notaSelecionada, setNotaSelecionada] = useState<NotaCandidata | null>(null)
  const [destinoParcelaExistente, setDestinoParcelaExistente] = useState<'existente' | 'nova'>(
    'nova',
  )
  const [parcelaSelecionadaExistenteId, setParcelaSelecionadaExistenteId] = useState<string>('')
  const [descricaoVinculoExistente, setDescricaoVinculoExistente] = useState<string>('')

  // --- ABA: ENVIAR XML/ZIP NOVO ---
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [arquivosNaoReconhecidos, setArquivosNaoReconhecidos] = useState<ArquivoNaoReconhecido[]>(
    [],
  )
  const [previasUpload, setPreviasUpload] = useState<PreviaNotaUpload[]>([])
  const [uploadIndexAtivo, setUploadIndexAtivo] = useState<number>(0)
  const [salvando, setSalvando] = useState(false)

  // Parcelas do projeto que não possuem NFS-e (livres para vincular)
  const parcelasLivresDoProjeto = useMemo(() => {
    return parcelasExistentes.filter((p) => !p.nf_numero || p.nf_numero.trim() === '')
  }, [parcelasExistentes])

  // Carrega notas já cadastradas e órfãs para a aba "Escolher existente"
  const carregarNotasExistentes = async () => {
    setLoadingExistentes(true)
    try {
      const lista: NotaCandidata[] = []

      // 1. Parcelas que possuem NFS-e
      const parcelasComNf = await pb
        .collection('parcelas')
        .getFullList<ParcelaRecord>({
          filter: "nf_numero != '' && nf_numero != null",
          sort: '-data_faturamento,-created',
          expand: 'projeto,cliente',
        })
        .catch(() => [])

      for (const p of parcelasComNf) {
        if (!p.nf_numero) continue
        lista.push({
          tipo: 'cadastrada',
          id: p.id,
          numero: p.nf_numero,
          valor: p.valor_recebido || p.valor,
          dataEmissao: p.data_faturamento || p.vencimento,
          tomadorRazao: p.expand?.cliente?.razao_social || 'Tomador cadastrado',
          descricaoServico: p.descricao,
          parcelaVinculada: p,
        })
      }

      // 2. Notas órfãs da sessão
      try {
        const stored = sessionStorage.getItem('aerocad_nfse_orfas')
        if (stored) {
          const orfas: NfseDadoExtraido[] = JSON.parse(stored)
          for (const o of orfas) {
            lista.push({
              tipo: 'orfa',
              id: o.idTemp,
              numero: o.numero,
              valor: o.valorLiquido || o.valorBruto,
              dataEmissao: o.dataEmissao,
              tomadorRazao: o.tomadorRazao,
              descricaoServico: o.descricaoServico,
              notaOrfaOriginal: o,
            })
          }
        }
      } catch {
        // silencioso
      }

      setTodasNotas(lista)
      setCarregouNotas(true)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao listar notas fiscais do sistema.')
    } finally {
      setLoadingExistentes(false)
    }
  }

  // Prepara quando o modal abre ou troca de aba
  useEffect(() => {
    if (open && activeTab === 'existente' && !carregouNotas) {
      void carregarNotasExistentes()
    }
  }, [open, activeTab, carregouNotas])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNotaSelecionada(null)
      setDescricaoVinculoExistente('')
      setParcelaSelecionadaExistenteId('')
      setDestinoParcelaExistente('nova')
      setBusca('')
      setPreviasUpload([])
      setArquivosNaoReconhecidos([])
      setUploadIndexAtivo(0)
    }
    onOpenChange(isOpen)
  }

  // Filtro de notas cadastradas
  const notasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return todasNotas.slice(0, 30)
    return todasNotas
      .filter(
        (n) =>
          n.numero.toLowerCase().includes(termo) ||
          (n.tomadorRazao && n.tomadorRazao.toLowerCase().includes(termo)) ||
          (n.descricaoServico && n.descricaoServico.toLowerCase().includes(termo)),
      )
      .slice(0, 30)
  }, [todasNotas, busca])

  const handleSelecionarNotaExistente = (nota: NotaCandidata) => {
    setNotaSelecionada(nota)
    if (nota.descricaoServico) {
      setDescricaoVinculoExistente(nota.descricaoServico.slice(0, 60))
    } else {
      setDescricaoVinculoExistente(`NFS-e nº ${nota.numero}`)
    }
    if (parcelasLivresDoProjeto.length > 0) {
      setParcelaSelecionadaExistenteId(parcelasLivresDoProjeto[0].id)
    } else {
      setDestinoParcelaExistente('nova')
    }
  }

  // --- PARSE E PROCESSAMENTO DE UPLOAD (XML / ZIP) ---
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsProcessingFiles(true)
    setArquivosNaoReconhecidos([])
    try {
      const fileList = Array.from(files)
      const loteResultado = await processarArquivosEmLote(fileList)

      if (loteResultado.arquivosNaoReconhecidos.length > 0) {
        setArquivosNaoReconhecidos(loteResultado.arquivosNaoReconhecidos)
      }

      if (loteResultado.notas.length === 0) {
        if (loteResultado.arquivosNaoReconhecidos.length > 0) {
          toast.error(
            `Nenhum XML de NFS-e válido reconhecido. ${loteResultado.arquivosNaoReconhecidos[0].motivo}`,
          )
        } else {
          toast.error('Nenhuma nota fiscal encontrada nos arquivos enviados.')
        }
        return
      }

      // Buscar parcelas já existentes no banco para detectar duplicatas (por nf_numero ou nfse_chave)
      const [todasParcelasDb, todosClientesDb] = await Promise.all([
        pb.collection('parcelas').getFullList<ParcelaRecord>({
          fields: 'id,nf_numero,nfse_chave,projeto,descricao,valor',
          expand: 'projeto',
        }),
        pb.collection('clientes').getFullList<ClienteRecord>({
          fields: 'id,razao_social,cnpj_cpf',
        }),
      ])

      const mapParcelasPorNf = new Map<string, ParcelaRecord>()
      for (const p of todasParcelasDb) {
        if (p.nf_numero) mapParcelasPorNf.set(p.nf_numero.trim().toLowerCase(), p)
        if (p.nfse_chave) mapParcelasPorNf.set(p.nfse_chave.trim().toLowerCase(), p)
      }

      // Correlacionar tomadores com clientes do CRM
      const tomadoresCorrelacionados = agruparECorrelacionarTomadores(
        loteResultado.notas,
        todosClientesDb,
      )
      const mapTomadorPorNota = new Map<string, TomadorExtraidoNfse>()
      for (const tom of tomadoresCorrelacionados) {
        for (const num of tom.numerosNotas) {
          mapTomadorPorNota.set(num, tom)
        }
      }

      // Montar a prévia de cada nota extraída
      const previas: PreviaNotaUpload[] = loteResultado.notas.map((nota) => {
        const prestador = nota.prestadorCnpjCpf || 'aerocad'
        const chaveNota = `${nota.numero}_${prestador}`
        const parcelaExistente =
          mapParcelasPorNf.get(nota.numero.trim().toLowerCase()) ||
          mapParcelasPorNf.get(chaveNota.trim().toLowerCase())

        const tomadorInfo = mapTomadorPorNota.get(nota.numero) || {
          chaveGrupo: nota.numero,
          cnpjCpf: nota.tomadorCnpjCpf || '',
          cnpjCpfFormatado: nota.tomadorCnpjCpf || '',
          razaoSocial: nota.tomadorRazao || 'Tomador não informado',
          tipo: 'pj' as const,
          endereco: nota.tomadorEndereco || '',
          municipio: nota.tomadorMunicipio || '',
          uf: nota.tomadorUf || '',
          email: nota.tomadorEmail || '',
          telefone: nota.tomadorTelefone || '',
          qtdNotas: 1,
          valorTotal: nota.valorBruto,
          numerosNotas: [nota.numero],
          status: 'novo' as const,
          motivoStatus: 'Novo cliente',
          acao: 'criar' as const,
          atualizarDadosFaltantes: true,
        }

        const descSugerida =
          nota.descricaoServico?.slice(0, 70) || `NFS-e nº ${nota.numero} (${projeto.numero})`

        const temParcelaLivre = parcelasLivresDoProjeto.length > 0
        const idPrimeiraLivre = temParcelaLivre ? parcelasLivresDoProjeto[0].id : undefined

        return {
          nota,
          jaExisteNoBanco: Boolean(parcelaExistente),
          parcelaExistenteId: parcelaExistente?.id,
          parcelaExistenteDescricao: parcelaExistente?.descricao,
          parcelaExistenteProjetoNumero: parcelaExistente?.expand?.projeto?.numero,
          tomador: tomadorInfo,
          descricaoMedicao: descSugerida,
          destinoParcela: temParcelaLivre ? 'existente' : 'nova',
          parcelaSelecionadaId: idPrimeiraLivre,
          modoCliente:
            tomadorInfo.status === 'existente' && tomadorInfo.clienteExistente
              ? 'vincular'
              : projeto.cliente
                ? 'vincular'
                : 'criar',
          clienteIdExistente: tomadorInfo.clienteExistente?.id || projeto.cliente,
        }
      })

      setPreviasUpload(previas)
      setUploadIndexAtivo(0)
      toast.success(
        `${previas.length} ${
          previas.length === 1 ? 'nota fiscal extraída' : 'notas fiscais extraídas'
        } com sucesso para conferência!`,
      )
    } catch (err: unknown) {
      console.error(err)
      toast.error(`Falha ao ler arquivos: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsProcessingFiles(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Atualização em campo da prévia ativa
  const updatePreviaAtiva = (patch: Partial<PreviaNotaUpload>) => {
    setPreviasUpload((prev) =>
      prev.map((item, idx) => (idx === uploadIndexAtivo ? { ...item, ...patch } : item)),
    )
  }

  // --- CONFIRMAÇÃO DO UPLOAD E VÍNCULO AO PROJETO ---
  const handleConfirmarUploadLote = async () => {
    if (previasUpload.length === 0) return
    setSalvando(true)

    const currentUserId = pb.authStore.record?.id || ''
    const currentUserName = pb.authStore.record?.name || 'Equipe Técnica'
    let vinculadasSucesso = 0
    const errosExecucao: string[] = []

    try {
      for (const item of previasUpload) {
        const {
          nota,
          tomador,
          descricaoMedicao,
          destinoParcela,
          parcelaSelecionadaId,
          modoCliente,
        } = item
        const valorNota = nota.valorLiquido || nota.valorBruto
        const descFinal = descricaoMedicao.trim() || `NFS-e nº ${nota.numero}`

        try {
          // 1. Processar ou vincular Tomador / Cliente se configurado
          let clienteFinalId = projeto.cliente || null
          if (modoCliente === 'criar') {
            try {
              const res = await processarClientesTomadores([
                {
                  ...tomador,
                  acao: 'criar',
                },
              ])
              const novoId = res.mapaTomadorParaClienteId.get(tomador.chaveGrupo)
              if (novoId) {
                clienteFinalId = novoId
                // Se o projeto não tinha cliente, vincula este cliente ao projeto também
                if (!projeto.cliente) {
                  await pb.collection('projetos').update(projeto.id, { cliente: novoId })
                }
              }
            } catch (errCli) {
              console.warn('Erro ao criar tomador como cliente:', errCli)
            }
          } else if (modoCliente === 'vincular' && item.clienteIdExistente) {
            clienteFinalId = item.clienteIdExistente
          }

          // 2. Criar ou vincular parcela no projeto
          let targetParcelaId = parcelaSelecionadaId
          const dataEmissaoNota = nota.dataEmissao || new Date().toISOString().slice(0, 10)
          const dataRecebimentoNota = nota.dataRecebimento || dataEmissaoNota
          const estaPaga = nota.situacao === 'paga' || Boolean(nota.dataRecebimento)

          if (destinoParcela === 'nova' || !targetParcelaId) {
            // Cria parcela nova já com os dados fiscais da nota
            const novaParcela = await pb.collection('parcelas').create<ParcelaRecord>({
              projeto: projeto.id,
              cliente: clienteFinalId || projeto.cliente,
              descricao: descFinal,
              valor: valorNota,
              vencimento: dataEmissaoNota,
              gatilho: 'medicao',
              origem: 'manual',
              status: estaPaga ? 'paga' : 'pendente',
              status_pagamento: estaPaga ? 'Recebido (NFS-e)' : 'Faturado com NFS-e',
              data_faturamento: dataEmissaoNota,
              data_pagamento: estaPaga ? dataRecebimentoNota : null,
              valor_recebido: estaPaga ? valorNota : 0,
              nf_numero: nota.numero,
              nfse_chave: `${nota.numero}_${nota.prestadorCnpjCpf || 'aerocad'}`,
              retencoes: nota.retencoesTexto || '',
              observacoes: `<p>NFS-e anexada diretamente na ficha do projeto ${projeto.numero} por ${currentUserName}.</p>`,
              nfse_dados: {
                ...nota,
                descricaoMedicao: descFinal,
                anexadaDiretamenteNoProjeto: true,
                projetoNumero: projeto.numero,
                anexadoPorNome: currentUserName,
                anexadoEm: new Date().toISOString(),
              },
            })
            targetParcelaId = novaParcela.id
          } else {
            // Vincula à parcela existente do projeto
            await pb.collection('parcelas').update(targetParcelaId, {
              descricao: descFinal,
              nf_numero: nota.numero,
              nfse_chave: `${nota.numero}_${nota.prestadorCnpjCpf || 'aerocad'}`,
              data_faturamento: dataEmissaoNota,
              retencoes: nota.retencoesTexto || '',
              status: estaPaga ? 'paga' : undefined,
              status_pagamento: estaPaga ? 'Recebido (NFS-e)' : 'Faturado com NFS-e',
              data_pagamento: estaPaga ? dataRecebimentoNota : undefined,
              valor_recebido: estaPaga ? valorNota : undefined,
              cliente: clienteFinalId || projeto.cliente,
              nfse_dados: {
                ...nota,
                descricaoMedicao: descFinal,
                anexadaDiretamenteNoProjeto: true,
                projetoNumero: projeto.numero,
                anexadoPorNome: currentUserName,
                anexadoEm: new Date().toISOString(),
              },
            })
          }

          // 3. Registrar atividade na timeline do projeto
          try {
            const valorFormatado = formatCurrency(valorNota)
            await pb.collection('atividades').create({
              usuario: currentUserId || null,
              projeto: projeto.id,
              cliente: clienteFinalId || projeto.cliente || null,
              texto: `NFS-e nº ${nota.numero} (${valorFormatado}) anexada ao projeto por ${currentUserName}. Medição: "${descFinal}". Tomador: ${nota.tomadorRazao}.`,
              tipo: 'financeiro',
              data_hora: new Date().toISOString(),
            })
          } catch (errAtiv) {
            console.warn('Erro ao registrar atividade:', errAtiv)
          }

          vinculadasSucesso++
        } catch (errSingle: unknown) {
          const msg = errSingle instanceof Error ? errSingle.message : String(errSingle)
          errosExecucao.push(`NFS-e nº ${item.nota.numero}: ${msg}`)
        }
      }

      if (vinculadasSucesso > 0) {
        toast.success(
          `${vinculadasSucesso} ${
            vinculadasSucesso === 1 ? 'NFS-e anexada' : 'notas fiscais anexadas'
          } ao projeto com sucesso!`,
        )
        handleOpenChange(false)
        onSuccess()
      }

      if (errosExecucao.length > 0) {
        toast.warning(`Houve avisos em algumas notas: ${errosExecucao.slice(0, 2).join('; ')}`)
      }
    } catch (errTotal: unknown) {
      const msg = errTotal instanceof Error ? errTotal.message : String(errTotal)
      toast.error('Erro no processamento das notas: ' + msg)
    } finally {
      setSalvando(false)
    }
  }

  // --- CONFIRMAÇÃO DA ABA EXISTENTE (REAPROVEITADA) ---
  const handleConfirmarExistente = async () => {
    if (!notaSelecionada) return
    setSalvando(true)
    try {
      const descFinal = descricaoVinculoExistente.trim() || `NFS-e nº ${notaSelecionada.numero}`
      const currentUserId = pb.authStore.record?.id || ''
      const currentUserName = pb.authStore.record?.name || 'Equipe Técnica'

      if (notaSelecionada.tipo === 'orfa' && notaSelecionada.notaOrfaOriginal) {
        let targetParcelaId = parcelaSelecionadaExistenteId
        if (destinoParcelaExistente === 'nova' || !targetParcelaId) {
          const nova = await pb.collection('parcelas').create({
            projeto: projeto.id,
            cliente: projeto.cliente,
            descricao: descFinal,
            valor: notaSelecionada.valor,
            vencimento: notaSelecionada.dataEmissao || new Date().toISOString().slice(0, 10),
            status: 'paga',
            status_pagamento: 'Recebido (NFS-e)',
            data_pagamento: notaSelecionada.dataEmissao || new Date().toISOString().slice(0, 10),
            valor_recebido: notaSelecionada.valor,
            origem: 'manual',
          })
          targetParcelaId = nova.id
        }

        await vincularNotaOrfaAParcela(
          notaSelecionada.notaOrfaOriginal,
          targetParcelaId,
          { modo: 'manter_atual' },
          descFinal,
        )

        try {
          const stored = sessionStorage.getItem('aerocad_nfse_orfas')
          if (stored) {
            const orfas: NfseDadoExtraido[] = JSON.parse(stored)
            const filtradas = orfas.filter((o) => o.idTemp !== notaSelecionada.id)
            sessionStorage.setItem('aerocad_nfse_orfas', JSON.stringify(filtradas))
          }
        } catch {
          // ignore
        }
      } else if (notaSelecionada.parcelaVinculada) {
        const targetParcela = notaSelecionada.parcelaVinculada
        await pb.collection('parcelas').update(targetParcela.id, {
          projeto: projeto.id,
          cliente: projeto.cliente || targetParcela.cliente,
          descricao: descFinal,
          observacoes: targetParcela.observacoes
            ? `${targetParcela.observacoes}\nVinculada ao projeto ${projeto.numero}: ${descFinal} (por ${currentUserName})`
            : `Vinculada ao projeto ${projeto.numero}: ${descFinal} (por ${currentUserName})`,
        })

        try {
          await pb.collection('atividades').create({
            usuario: currentUserId || null,
            projeto: projeto.id,
            cliente: projeto.cliente || null,
            texto: `NFS-e nº ${notaSelecionada.numero} (${formatCurrency(notaSelecionada.valor)}) vinculada por ${currentUserName} com descrição "${descFinal}".`,
            tipo: 'financeiro',
            data_hora: new Date().toISOString(),
          })
        } catch {
          // ignore
        }
      }

      toast.success(`NFS-e nº ${notaSelecionada.numero} vinculada ao projeto com sucesso!`)
      handleOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Erro ao vincular nota: ' + msg)
    } finally {
      setSalvando(false)
    }
  }

  const previaAtiva = previasUpload[uploadIndexAtivo]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-800">
            <FileSpreadsheet className="h-5 w-5 text-[#FF6A13]" />
            Anexar / Vincular NFS-e ao Projeto {projeto.numero}
          </DialogTitle>
        </DialogHeader>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 border-b mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'upload'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Enviar XML / ZIP novo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('existente')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'existente'
                ? 'border-[#FF6A13] text-[#FF6A13]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Search className="h-4 w-4" />
            Escolher existente no sistema
          </button>
        </div>

        {/* ========================================================= */}
        {/* ABA 1: ENVIAR XML / ZIP NOVO DIRETO NO PROJETO           */}
        {/* ========================================================= */}
        {activeTab === 'upload' && (
          <div className="space-y-4 py-2">
            {previasUpload.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-orange-50/70 border border-[#FFD2B3] p-3 text-xs text-neutral-700 leading-relaxed">
                  Faça o upload do <strong>arquivo XML</strong> da nota fiscal NFS-e (ou arquivo{' '}
                  <strong>.ZIP</strong> contendo vários XMLs). O sistema extrai automaticamente o
                  número, valores, impostos, data de emissão e tomador, permitindo conferência e
                  vinculação direta ao projeto {projeto.numero}.
                </div>

                {/* Dropzone / Seletor de Arquivos */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    isProcessingFiles
                      ? 'border-orange-300 bg-orange-50/30'
                      : 'border-neutral-300 hover:border-[#FF6A13] hover:bg-orange-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".xml,.zip"
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-[#FF6A13]">
                      {isProcessingFiles ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      ) : (
                        <UploadCloud className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-800">
                        {isProcessingFiles
                          ? 'Processando e validando XML(s)...'
                          : 'Clique para selecionar arquivos XML ou .ZIP'}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Padrão ABRASF, GDF, SisGoV e prefeituras em XML ou lote compactado .ZIP
                      </p>
                    </div>
                  </div>
                </div>

                {/* Avisos de arquivos não reconhecidos (se houver) */}
                {arquivosNaoReconhecidos.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      Arquivos não reconhecidos ({arquivosNaoReconhecidos.length}):
                    </div>
                    <ul className="list-disc pl-5 text-neutral-700 space-y-0.5">
                      {arquivosNaoReconhecidos.map((arq, idx) => (
                        <li key={idx}>
                          <span className="font-semibold">{arq.nome}</span>: {arq.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cabeçalho do lote extraído com paginação/abas de notas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      Conferência das Notas Extraídas ({previasUpload.length})
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Confira os dados extraídos antes de confirmar a gravação no projeto{' '}
                      {projeto.numero}.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviasUpload([])
                      setArquivosNaoReconhecidos([])
                    }}
                    className="h-7 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    Enviar outros arquivos
                  </Button>
                </div>

                {/* Seleção da nota ativa se houver múltiplas */}
                {previasUpload.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {previasUpload.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setUploadIndexAtivo(idx)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition shrink-0 flex items-center gap-1.5 ${
                          idx === uploadIndexAtivo
                            ? 'bg-[#FF6A13] text-white font-bold'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        NFS-e {item.nota.numero}
                        {item.jaExisteNoBanco && (
                          <span
                            className={`rounded-full px-1 text-[9px] ${
                              idx === uploadIndexAtivo
                                ? 'bg-amber-300 text-neutral-900'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                            title="Já existe no banco"
                          >
                            Existente
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {previaAtiva && (
                  <div className="space-y-4">
                    {/* Alerta de Nota já existente no banco de dados */}
                    {previaAtiva.jaExisteNoBanco && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1 text-amber-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                          NFS-e nº {previaAtiva.nota.numero} já cadastrada no sistema!
                        </div>
                        <p className="text-[11px] text-neutral-700 pl-5">
                          Esta nota já existe vinculada no CRM
                          {previaAtiva.parcelaExistenteProjetoNumero
                            ? ` ao projeto ${previaAtiva.parcelaExistenteProjetoNumero}`
                            : ''}
                          {previaAtiva.parcelaExistenteDescricao
                            ? ` ("${previaAtiva.parcelaExistenteDescricao}")`
                            : ''}
                          . Ao confirmar, o vínculo e dados serão atualizados e associados a este
                          projeto ({projeto.numero}), evitando duplicidade fiscal.
                        </p>
                      </div>
                    )}

                    {/* Cartão de Resumo da Nota Extraída */}
                    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3.5 text-xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-orange-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-[#D65100]">
                            NFS-e nº {previaAtiva.nota.numero}
                          </span>
                          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                            {previaAtiva.nota.situacao}
                          </span>
                          {previaAtiva.nota.dataEmissao && (
                            <span className="text-neutral-500 text-[11px]">
                              Emissão: {formatDate(previaAtiva.nota.dataEmissao)}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="mono-value font-bold text-base text-neutral-900">
                            {formatCurrency(
                              previaAtiva.nota.valorLiquido || previaAtiva.nota.valorBruto,
                            )}
                          </span>
                          {previaAtiva.nota.retencoesTexto && (
                            <p className="text-[10px] text-amber-800">
                              {previaAtiva.nota.retencoesTexto}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-700 pt-1">
                        <div>
                          <p className="font-semibold text-neutral-900">Tomador do Serviço:</p>
                          <p>{previaAtiva.nota.tomadorRazao}</p>
                          {previaAtiva.nota.tomadorCnpjCpf && (
                            <p className="text-neutral-500 font-mono text-[11px]">
                              Doc: {previaAtiva.nota.tomadorCnpjCpf}
                            </p>
                          )}
                          {(previaAtiva.nota.tomadorMunicipio || previaAtiva.nota.tomadorUf) && (
                            <p className="text-neutral-500 text-[11px]">
                              {previaAtiva.nota.tomadorMunicipio}
                              {previaAtiva.nota.tomadorUf ? `/${previaAtiva.nota.tomadorUf}` : ''}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">Prestador / Emissor:</p>
                          <p>
                            {previaAtiva.nota.prestadorRazao ||
                              'AEROCAD ENGENHARIA E CONSULTORIA LTDA'}
                          </p>
                          {previaAtiva.nota.codigoVerificacao && (
                            <p className="text-neutral-500 font-mono text-[11px]">
                              Cód. Verificação: {previaAtiva.nota.codigoVerificacao}
                            </p>
                          )}
                        </div>
                      </div>

                      {previaAtiva.nota.descricaoServico && (
                        <div className="pt-2 border-t border-orange-200">
                          <p className="font-semibold text-neutral-900 mb-0.5">
                            Discriminação dos Serviços no XML:
                          </p>
                          <p className="text-neutral-600 text-[11px] italic bg-white/70 p-2 rounded border border-orange-100 max-h-24 overflow-y-auto">
                            {previaAtiva.nota.descricaoServico}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Campo de Descrição da Medição / Vínculo */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-neutral-800">
                        Descrição da Medição / Vínculo *
                      </Label>
                      <Input
                        value={previaAtiva.descricaoMedicao}
                        onChange={(e) => updatePreviaAtiva({ descricaoMedicao: e.target.value })}
                        placeholder="Ex: 1ª medição, Medição final, Entrada 50%, Protocolo DECEA"
                        className="h-9 text-xs"
                      />
                      <p className="text-[11px] text-neutral-500">
                        Esta descrição identificará a parcela correspondente na ficha do projeto{' '}
                        {projeto.numero} e nos relatórios.
                      </p>
                    </div>

                    {/* Vínculo de Parcela: Nova ou Existente */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-bold text-neutral-800">
                        Destino da Parcela no Projeto
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => updatePreviaAtiva({ destinoParcela: 'nova' })}
                          className={`p-2.5 rounded-lg border text-left transition ${
                            previaAtiva.destinoParcela === 'nova'
                              ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                              : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 font-bold">
                            <Plus className="h-3.5 w-3.5 text-[#FF6A13]" />
                            Criar nova parcela no projeto
                          </div>
                          <span className="text-[11px] text-neutral-500 font-normal">
                            Gera um novo faturamento quitado no valor da nota.
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={parcelasLivresDoProjeto.length === 0}
                          onClick={() => updatePreviaAtiva({ destinoParcela: 'existente' })}
                          className={`p-2.5 rounded-lg border text-left transition ${
                            parcelasLivresDoProjeto.length === 0
                              ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-neutral-200'
                              : previaAtiva.destinoParcela === 'existente'
                                ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                                : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 font-bold">
                            <LinkIcon className="h-3.5 w-3.5 text-[#FF6A13]" />
                            Vincular a parcela existente
                          </div>
                          <span className="text-[11px] text-neutral-500 font-normal">
                            {parcelasLivresDoProjeto.length > 0
                              ? `${parcelasLivresDoProjeto.length} parcela(s) sem nota disponíveis.`
                              : 'Não há parcelas pendentes de nota no projeto.'}
                          </span>
                        </button>
                      </div>

                      {previaAtiva.destinoParcela === 'existente' &&
                        parcelasLivresDoProjeto.length > 0 && (
                          <div className="pt-2 space-y-1">
                            <Label className="text-[11px] text-neutral-600">
                              Selecione a parcela a ser quitada/vinculada:
                            </Label>
                            <select
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm"
                              value={previaAtiva.parcelaSelecionadaId}
                              onChange={(e) =>
                                updatePreviaAtiva({ parcelaSelecionadaId: e.target.value })
                              }
                            >
                              {parcelasLivresDoProjeto.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.descricao} — {formatCurrency(p.valor)} ({p.status})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                    </div>

                    {/* Vínculo de Cliente Tomador */}
                    <div className="space-y-1.5 pt-2 border-t">
                      <Label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-neutral-500" />
                        Cliente / Tomador do Serviço
                      </Label>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border bg-neutral-50 text-xs">
                        <div>
                          <p className="font-semibold text-neutral-800">
                            {previaAtiva.nota.tomadorRazao}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {previaAtiva.tomador.status === 'existente' &&
                            previaAtiva.tomador.clienteExistente
                              ? `Cliente existente no CRM: "${previaAtiva.tomador.clienteExistente.razao_social}"`
                              : 'Tomador ainda não possui cadastro próprio no CRM.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {previaAtiva.tomador.status !== 'existente' && (
                            <button
                              type="button"
                              onClick={() =>
                                updatePreviaAtiva({
                                  modoCliente:
                                    previaAtiva.modoCliente === 'criar' ? 'vincular' : 'criar',
                                })
                              }
                              className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition ${
                                previaAtiva.modoCliente === 'criar'
                                  ? 'bg-orange-100 border-[#FF6A13] text-[#D65100]'
                                  : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'
                              }`}
                            >
                              {previaAtiva.modoCliente === 'criar'
                                ? '✓ Criar novo cliente tomador'
                                : '+ Criar cliente tomador'}
                            </button>
                          )}
                          <span className="text-[11px] text-neutral-500">
                            (vinculado ao projeto)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 2: ESCOLHER EXISTENTE NO SISTEMA (Legado Refinado)     */}
        {/* ========================================================= */}
        {activeTab === 'existente' && (
          <div className="space-y-4 py-2">
            {!notaSelecionada ? (
              <>
                <div className="rounded-lg bg-orange-50/70 border border-[#FFD2B3] p-3 text-xs text-neutral-700">
                  Selecione uma nota fiscal NFS-e já cadastrada no sistema ou das Notas Órfãs para
                  vincular a este projeto ({projeto.nome}).
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Buscar por número da NFS-e, tomador ou descrição..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                {loadingExistentes ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    Carregando notas fiscais disponíveis...
                  </div>
                ) : notasFiltradas.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500 space-y-1">
                    <p className="font-semibold">
                      Nenhuma nota fiscal encontrada com o termo pesquisado.
                    </p>
                    <p>
                      Você pode fazer upload direto de um XML novo na aba "Enviar XML/ZIP novo".
                    </p>
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border max-h-72 overflow-y-auto bg-white">
                    {notasFiltradas.map((item) => (
                      <div
                        key={`${item.tipo}-${item.id}`}
                        onClick={() => handleSelecionarNotaExistente(item)}
                        className="p-3 text-xs flex items-center justify-between hover:bg-orange-50/60 cursor-pointer transition"
                      >
                        <div className="space-y-0.5 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#D65100]">
                              NFS-e nº {item.numero}
                            </span>
                            {item.tipo === 'orfa' ? (
                              <span className="rounded bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.2 font-semibold">
                                Nota Órfã
                              </span>
                            ) : (
                              <span className="rounded bg-neutral-100 text-neutral-700 text-[10px] px-1.5 py-0.2">
                                {item.parcelaVinculada?.expand?.projeto
                                  ? `Proj: ${item.parcelaVinculada.expand.projeto.numero}`
                                  : 'Sem projeto'}
                              </span>
                            )}
                            {item.dataEmissao && (
                              <span className="text-[10px] text-neutral-400">
                                {formatDate(item.dataEmissao)}
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-700 font-medium truncate">
                            {item.tomadorRazao || 'Tomador não identificado'}
                          </p>
                          {item.descricaoServico && (
                            <p className="text-neutral-500 text-[11px] truncate italic">
                              {item.descricaoServico}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="mono-value font-bold text-[#1F1F1F]">
                            {formatCurrency(item.valor)}
                          </span>
                          <div className="text-[10px] text-[#FF6A13] font-semibold flex items-center justify-end gap-1 mt-0.5">
                            <LinkIcon className="h-3 w-3" />
                            Selecionar
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-[#D65100]">
                      NFS-e nº {notaSelecionada.numero}
                    </span>
                    <span className="mono-value font-bold text-sm text-neutral-800">
                      {formatCurrency(notaSelecionada.valor)}
                    </span>
                  </div>
                  <p className="text-neutral-700">
                    <strong>Tomador:</strong> {notaSelecionada.tomadorRazao}
                  </p>
                  {notaSelecionada.dataEmissao && (
                    <p className="text-neutral-500">
                      <strong>Emissão:</strong> {formatDate(notaSelecionada.dataEmissao)}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotaSelecionada(null)}
                    className="h-6 text-[11px] text-[#D65100] hover:text-[#B23B00] px-1 hover:bg-transparent"
                  >
                    ← Trocar nota selecionada
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-800">
                    Descrição / Medição da Nota *
                  </Label>
                  <Input
                    value={descricaoVinculoExistente}
                    onChange={(e) => setDescricaoVinculoExistente(e.target.value)}
                    placeholder="Ex: 1ª medição, Medição final, Entrada 50%, Protocolo no DECEA"
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Esta descrição será exibida na lista de faturamentos/parcelas do projeto.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-bold text-neutral-800">
                    Como deseja vincular ao projeto?
                  </Label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setDestinoParcelaExistente('nova')}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        destinoParcelaExistente === 'nova'
                          ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                          : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-bold">
                        <Plus className="h-3.5 w-3.5 text-[#FF6A13]" />
                        Criar nova parcela/faturamento
                      </div>
                      <span className="text-[11px] text-neutral-500 font-normal">
                        Registra um novo faturamento quitado no projeto no valor da nota.
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={parcelasLivresDoProjeto.length === 0}
                      onClick={() => setDestinoParcelaExistente('existente')}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        parcelasLivresDoProjeto.length === 0
                          ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-neutral-200'
                          : destinoParcelaExistente === 'existente'
                            ? 'border-[#FF6A13] bg-orange-50 text-[#D65100] font-semibold'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-bold">
                        <LinkIcon className="h-3.5 w-3.5 text-[#FF6A13]" />
                        Vincular a parcela existente
                      </div>
                      <span className="text-[11px] text-neutral-500 font-normal">
                        {parcelasLivresDoProjeto.length > 0
                          ? `${parcelasLivresDoProjeto.length} parcela(s) sem nota disponíveis.`
                          : 'Não há parcelas pendentes de nota neste projeto.'}
                      </span>
                    </button>
                  </div>

                  {destinoParcelaExistente === 'existente' &&
                    parcelasLivresDoProjeto.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <Label className="text-[11px] text-neutral-600">
                          Selecione a parcela do projeto {projeto.numero}:
                        </Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm"
                          value={parcelaSelecionadaExistenteId}
                          onChange={(e) => setParcelaSelecionadaExistenteId(e.target.value)}
                        >
                          {parcelasLivresDoProjeto.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.descricao} — {formatCurrency(p.valor)} ({p.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>

          {activeTab === 'upload' && previasUpload.length > 0 && (
            <Button
              onClick={handleConfirmarUploadLote}
              disabled={salvando || !previaAtiva?.descricaoMedicao.trim()}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {salvando
                ? 'Gravando NFS-e no projeto...'
                : `Confirmar e Anexar ${previasUpload.length} ${
                    previasUpload.length === 1 ? 'Nota' : 'Notas'
                  }`}
            </Button>
          )}

          {activeTab === 'existente' && notaSelecionada && (
            <Button
              onClick={handleConfirmarExistente}
              disabled={salvando || !descricaoVinculoExistente.trim()}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {salvando ? 'Vinculando NFS-e...' : 'Confirmar Vínculo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
