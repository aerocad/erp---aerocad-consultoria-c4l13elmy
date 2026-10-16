import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CrmBadge } from '@/components/common/CrmBadge'
import {
  Building2,
  Sparkles,
  FileText,
  Users,
  Plus,
  Trash2,
  Save,
  Download,
  ExternalLink,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  HelpCircle,
  Briefcase,
  MapPin,
  Landmark,
  FileCheck,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  obterDadosEmpresa,
  salvarDadosEmpresa,
  removerArquivoContratoSocialEmpresa,
} from '@/services/empresaService'
import { ExtracaoContratoSocialModal } from '@/components/financeiro/ExtracaoContratoSocialModal'
import type { EmpresaRecord, SocioContratoSocial, ColaboradorRecord } from '@/types/crm'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export function DadosEmpresaSection() {
  const [empresa, setEmpresa] = useState<EmpresaRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalExtracaoOpen, setModalExtracaoOpen] = useState(false)

  // Sócios da equipe técnica cadastrados com regime "Sócio(a)" em /pessoal
  const [sociosEquipe, setSociosEquipe] = useState<ColaboradorRecord[]>([])

  // Formulário editável
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('')
  const [dataConstituicao, setDataConstituicao] = useState('')
  const [capitalSocial, setCapitalSocial] = useState<string>('')
  const [cnaePrincipal, setCnaePrincipal] = useState('')
  const [objetoSocial, setObjetoSocial] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [cep, setCep] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [bancoAgencia, setBancoAgencia] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [socios, setSocios] = useState<SocioContratoSocial[]>([])

  const fileManualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const [emp, colabs] = await Promise.all([
        obterDadosEmpresa(),
        pb
          .collection('colaboradores')
          .getFullList<ColaboradorRecord>({
            filter: `regime_contratacao = 'socio' && situacao = 'ativo'`,
            requestKey: null,
          })
          .catch(() => []),
      ])

      setEmpresa(emp)
      setSociosEquipe(colabs)
      preencherFormulario(emp)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao carregar dados da empresa: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function preencherFormulario(emp: EmpresaRecord) {
    setRazaoSocial(emp.razao_social || '')
    setNomeFantasia(emp.nome_fantasia || '')
    setCnpj(emp.cnpj || '')
    setInscricaoEstadual(emp.inscricao_estadual || '')
    setInscricaoMunicipal(emp.inscricao_municipal || '')
    setDataConstituicao(emp.data_constituicao || '')
    setCapitalSocial(emp.capital_social ? String(emp.capital_social) : '')
    setCnaePrincipal(emp.cnae_principal || '')
    setObjetoSocial(emp.objeto_social || '')
    setEndereco(emp.endereco || '')
    setCidadeUf(emp.cidade_uf || '')
    setCep(emp.cep || '')
    setTelefone(emp.telefone || '')
    setEmail(emp.email || '')
    setWebsite(emp.website || '')
    setBancoNome(emp.banco_nome || '')
    setBancoAgencia(emp.banco_agencia || '')
    setBancoConta(emp.banco_conta || '')
    setChavePix(emp.chave_pix || '')
    setObservacoes(emp.observacoes || '')
    setSocios(Array.isArray(emp.socios) ? emp.socios : [])
  }

  function handleAdicionarSocio() {
    setSocios([
      ...socios,
      {
        nome: '',
        cpf_cnpj: '',
        qualificacao: 'Sócio-Administrador',
        percentual_participacao: 0,
      },
    ])
  }

  function handleAtualizarSocio(index: number, campo: keyof SocioContratoSocial, valor: any) {
    const novos = [...socios]
    novos[index] = {
      ...novos[index],
      [campo]: valor,
    }
    setSocios(novos)
  }

  function handleRemoverSocio(index: number) {
    setSocios(socios.filter((_, i) => i !== index))
  }

  // Verifica se o sócio coincide com algum membro cadastrado na equipe (/pessoal) com regime "Sócio(a)"
  function encontrarSocioEquipe(socio: SocioContratoSocial) {
    if (!socio) return null
    const limpoCpfSocio = (socio.cpf_cnpj || '').replace(/\D/g, '')
    const limpoNomeSocio = (socio.nome || '').trim().toLowerCase()

    return sociosEquipe.find((c) => {
      const limpoCpfColab = (c.cpf_cnpj || '').replace(/\D/g, '')
      if (limpoCpfSocio && limpoCpfColab && limpoCpfSocio === limpoCpfColab) {
        return true
      }
      if (
        limpoNomeSocio &&
        c.nome_completo &&
        limpoNomeSocio === c.nome_completo.trim().toLowerCase()
      ) {
        return true
      }
      return false
    })
  }

  async function handleSalvarManual() {
    if (!razaoSocial.trim() || !cnpj.trim()) {
      toast.error('Informe ao menos a Razão Social e o CNPJ da AEROCAD.')
      return
    }

    setSaving(true)
    try {
      const capSocNum = parseFloat(capitalSocial.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

      const atualizado = await salvarDadosEmpresa(
        {
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim(),
          cnpj: cnpj.trim(),
          inscricao_estadual: inscricaoEstadual.trim(),
          inscricao_municipal: inscricaoMunicipal.trim(),
          data_constituicao: dataConstituicao.trim(),
          capital_social: capSocNum,
          cnae_principal: cnaePrincipal.trim(),
          objeto_social: objetoSocial.trim(),
          endereco: endereco.trim(),
          cidade_uf: cidadeUf.trim(),
          cep: cep.trim(),
          telefone: telefone.trim(),
          email: email.trim(),
          website: website.trim(),
          banco_nome: bancoNome.trim(),
          banco_agencia: bancoAgencia.trim(),
          banco_conta: bancoConta.trim(),
          chave_pix: chavePix.trim(),
          socios,
          observacoes: observacoes.trim(),
        },
        empresa?.id,
      )

      setEmpresa(atualizado)
      preencherFormulario(atualizado)
      toast.success('Dados cadastrais e societários da AEROCAD salvos com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao salvar dados da empresa: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadManualAnexo(file: File) {
    if (!empresa?.id) return
    try {
      const atualizado = await salvarDadosEmpresa(
        {
          razao_social: razaoSocial,
          cnpj,
          socios,
        },
        empresa.id,
        file,
      )
      setEmpresa(atualizado)
      toast.success(`Arquivo "${file.name}" anexado ao Contrato Social da AEROCAD!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao anexar arquivo: ${msg}`)
    }
  }

  async function handleRemoverAnexo(nomeArquivo: string) {
    if (!empresa?.id) return
    try {
      const atualizado = await removerArquivoContratoSocialEmpresa(empresa.id, nomeArquivo)
      setEmpresa(atualizado)
      toast.success('Arquivo removido com sucesso.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Erro ao remover arquivo: ${msg}`)
    }
  }

  // Lista de arquivos anexados ao contrato social
  const listaContratos: string[] = []
  if (empresa?.contrato_social) {
    if (Array.isArray(empresa.contrato_social)) {
      listaContratos.push(...empresa.contrato_social)
    } else if (typeof empresa.contrato_social === 'string' && empresa.contrato_social.trim()) {
      listaContratos.push(empresa.contrato_social)
    }
  }

  // Soma percentual dos sócios
  const somaParticipacao = socios.reduce(
    (acc, s) => acc + (Number(s.percentual_participacao) || 0),
    0,
  )

  if (loading) {
    return (
      <div className="crm-card p-12 text-center text-neutral-500">
        <Building2 className="h-8 w-8 mx-auto mb-2 animate-pulse text-[#FF6A13]" />
        <p className="text-sm">Carregando dados societários da AEROCAD...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo & Ação de Extração por IA */}
      <div className="crm-card p-5 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50 border-orange-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-lg bg-[#FF6A13] text-white shadow-sm shrink-0">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-neutral-900">
                  Dados da Empresa · AEROCAD Consultoria
                </h2>
                <CrmBadge tone="orange" className="text-[10px]">
                  Cadastro Titular do CRM
                </CrmBadge>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5 max-w-2xl">
                Cadastro societário, contratual e fiscal oficial da AEROCAD. Estes dados alimentam a
                geração de propostas comerciais (PC), propostas técnicas (PT), contratos (CT),
                ordens de serviço e recibos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              onClick={() => setModalExtracaoOpen(true)}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-semibold shadow-sm"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Extrair Contrato Social (IA)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSalvarManual}
              disabled={saving}
              className="text-xs border-neutral-300 font-medium"
            >
              <Save className="h-4 w-4 mr-1.5 text-neutral-600" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      {/* Grid Principal: Dados Cadastrais + Quadro de Sócios */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Dados Oficiais, Fiscais e Bancários (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Identificação Jurídica */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Briefcase className="h-3.5 w-3.5 text-[#FF6A13]" />
                1. Identificação Empresarial & Fiscal
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                {cnpj || 'CNPJ não informado'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Razão Social *</Label>
                <Input
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome empresarial oficial"
                  className="h-8 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome Fantasia</Label>
                <Input
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Nome fantasia comercial"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CNPJ *</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Inscrição Estadual (IE)</Label>
                <Input
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Inscrição Estadual"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Inscrição Municipal (IM)</Label>
                <Input
                  value={inscricaoMunicipal}
                  onChange={(e) => setInscricaoMunicipal(e.target.value)}
                  placeholder="Inscrição Municipal"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Capital Social (R$)</Label>
                <Input
                  value={capitalSocial}
                  onChange={(e) => setCapitalSocial(e.target.value)}
                  placeholder="100000.00"
                  className="h-8 text-xs font-mono"
                />
                {Boolean(capitalSocial) && (
                  <p className="text-[10px] text-neutral-500 font-mono">
                    {formatCurrency(
                      parseFloat(capitalSocial.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Constituição</Label>
                <Input
                  value={dataConstituicao}
                  onChange={(e) => setDataConstituicao(e.target.value)}
                  placeholder="AAAA-MM-DD ou DD/MM/AAAA"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CNAE Principal</Label>
              <Input
                value={cnaePrincipal}
                onChange={(e) => setCnaePrincipal(e.target.value)}
                placeholder="Ex: 71.12-0-00 - Serviços de engenharia aeroportuária"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Objeto Social</Label>
              <Textarea
                rows={3}
                value={objetoSocial}
                onChange={(e) => setObjetoSocial(e.target.value)}
                placeholder="Descrição das atividades do objeto social..."
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* 2. Endereço e Contato Institucional */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5 uppercase tracking-wide">
                <MapPin className="h-3.5 w-3.5 text-[#FF6A13]" />
                2. Endereço & Contatos Institucionais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Endereço Completo</Label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Logradouro, nº, sala, bairro"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="00000-000"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cidade / UF</Label>
                <Input
                  value={cidadeUf}
                  onChange={(e) => setCidadeUf(e.target.value)}
                  placeholder="Brasília / DF"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone Oficial</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="+55 61 9 8462-8800"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail Institucional</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@aerocad.com.br"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="www.aerocad.com.br"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Dados Bancários da Empresa */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Landmark className="h-3.5 w-3.5 text-[#FF6A13]" />
                3. Dados Bancários Oficiais para Recebimento
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input
                  value={bancoNome}
                  onChange={(e) => setBancoNome(e.target.value)}
                  placeholder="Ex: INTER (077)"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Chave PIX</Label>
                <Input
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="28.036.597/0001-43"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Agência</Label>
                <Input
                  value={bancoAgencia}
                  onChange={(e) => setBancoAgencia(e.target.value)}
                  placeholder="0001"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Conta Corrente</Label>
                <Input
                  value={bancoConta}
                  onChange={(e) => setBancoConta(e.target.value)}
                  placeholder="7637194-8"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Quadro de Sócios & Anexos do Contrato Social (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quadro Dinâmico de Sócios */}
          <div className="crm-card p-5 space-y-4 border-orange-200 bg-orange-50/20">
            <div className="flex items-center justify-between border-b border-orange-200 pb-3">
              <div>
                <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Users className="h-4 w-4 text-[#FF6A13]" />
                  Quadro de Sócios ({socios.length})
                </span>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Participação total somada:{' '}
                  <span
                    className={`font-mono font-bold ${
                      Math.abs(somaParticipacao - 100) < 0.01
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {somaParticipacao.toFixed(1)}%
                  </span>
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAdicionarSocio}
                className="h-7 text-xs border-orange-300 text-[#FF6A13] hover:bg-orange-100"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar Sócio
              </Button>
            </div>

            {socios.length === 0 ? (
              <div className="p-4 rounded-lg bg-white border border-neutral-200 text-center text-xs text-neutral-500">
                Nenhum sócio registrado. Clique em "Adicionar Sócio" ou utilize a extração de
                Contrato Social por IA para preencher automaticamente.
              </div>
            ) : (
              <div className="space-y-3">
                {socios.map((socio, idx) => {
                  const matchEquipe = encontrarSocioEquipe(socio)

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-neutral-200 bg-white space-y-2 shadow-xs"
                    >
                      {/* Badge indicando se coincide com colaborador cadastrado no CRM */}
                      <div className="flex items-center justify-between">
                        {matchEquipe ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <UserCheck className="h-3 w-3" />
                            Coincide com {matchEquipe.nome_completo} (Equipe · Sócio)
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">Sócio nº {idx + 1}</span>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverSocio(idx)}
                          className="h-6 w-6 text-neutral-400 hover:text-rose-600"
                          title="Remover este sócio"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-neutral-600">Nome do Sócio *</Label>
                        <Input
                          value={socio.nome}
                          onChange={(e) => handleAtualizarSocio(idx, 'nome', e.target.value)}
                          placeholder="Nome completo"
                          className="h-7 text-xs font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-600">CPF / CNPJ</Label>
                          <Input
                            value={socio.cpf_cnpj || ''}
                            onChange={(e) => handleAtualizarSocio(idx, 'cpf_cnpj', e.target.value)}
                            placeholder="000.000.000-00"
                            className="h-7 text-xs font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-600">Qualificação</Label>
                          <Input
                            value={socio.qualificacao || ''}
                            onChange={(e) =>
                              handleAtualizarSocio(idx, 'qualificacao', e.target.value)
                            }
                            placeholder="Sócio-Administrador"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-600">% Participação</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={socio.percentual_participacao ?? ''}
                              onChange={(e) =>
                                handleAtualizarSocio(
                                  idx,
                                  'percentual_participacao',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="50"
                              className="h-7 text-xs font-mono"
                            />
                            <span className="text-xs text-neutral-500 font-mono">%</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-neutral-600">
                            Qtd Cotas (opcional)
                          </Label>
                          <Input
                            type="number"
                            value={socio.cotas ?? ''}
                            onChange={(e) =>
                              handleAtualizarSocio(idx, 'cotas', parseInt(e.target.value) || null)
                            }
                            placeholder="Cotas"
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Anexos do Contrato Social da AEROCAD */}
          <div className="crm-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <FileText className="h-4 w-4 text-[#FF6A13]" />
                  Anexos do Contrato Social ({listaContratos.length})
                </span>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  PDFs e alterações contratuais arquivados no CRM
                </p>
              </div>

              <input
                ref={fileManualInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUploadManualAnexo(f)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileManualInputRef.current?.click()}
                className="h-7 text-xs border-neutral-300"
              >
                <Plus className="h-3 w-3 mr-1" />
                Anexar Arquivo
              </Button>
            </div>

            {listaContratos.length === 0 ? (
              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                <FileCheck className="h-6 w-6 mx-auto mb-1 opacity-40 text-[#FF6A13]" />
                Nenhum arquivo de contrato social anexado ainda. Você pode enviar via botão "Extrair
                Contrato Social (IA)" acima ou pelo botão "Anexar Arquivo".
              </div>
            ) : (
              <div className="space-y-2">
                {listaContratos.map((nomeArq, idx) => {
                  const urlArquivo = pb.files.getURL(empresa!, nomeArq)
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 text-[#FF6A13] shrink-0" />
                        <span className="truncate font-medium text-neutral-800" title={nomeArq}>
                          {nomeArq}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={urlArquivo}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="p-1 rounded text-neutral-500 hover:text-[#FF6A13] hover:bg-neutral-100"
                          title="Abrir / Baixar arquivo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverAnexo(nomeArq)}
                          className="h-6 w-6 text-neutral-400 hover:text-rose-600"
                          title="Remover arquivo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dica de Integração com Geração de Documentos */}
          <div className="rounded-lg p-4 bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
              <HelpCircle className="h-4 w-4 text-[#FF6A13]" />
              Como estes dados são aproveitados:
            </div>
            <p className="text-[11px] leading-relaxed">
              Os dados de Razão Social, CNPJ, dados bancários e quadro de sócios registrados aqui
              garantem que novos documentos contratuais, propostas técnicas (PT) e comerciais (PC)
              emitam os dados oficiais vigentes da AEROCAD sem digitação manual.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Extração Lado a Lado por IA */}
      <ExtracaoContratoSocialModal
        open={modalExtracaoOpen}
        onOpenChange={setModalExtracaoOpen}
        alvo="empresa"
        empresaExistente={empresa}
        onEmpresaSalva={(empSalva) => {
          setEmpresa(empSalva)
          preencherFormulario(empSalva)
          toast.success(
            'Dados societários da AEROCAD atualizados com sucesso a partir do Contrato Social!',
          )
        }}
      />
    </div>
  )
}
