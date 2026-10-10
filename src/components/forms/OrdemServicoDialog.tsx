import { useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2, Plus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { OrdemServicoRecord, OrdemServicoStatus, UserRecord } from '@/types/crm'

export interface OrdemServicoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetProjetoId: string
  presetProjetoNumero?: string
  presetProjetoNome?: string
  editingOS?: OrdemServicoRecord | null
  onSuccess: () => void
}

export function OrdemServicoDialog({
  open,
  onOpenChange,
  presetProjetoId,
  presetProjetoNumero,
  presetProjetoNome,
  editingOS,
  onSuccess,
}: OrdemServicoDialogProps) {
  const { user } = useAuth()
  const [terceiros, setTerceiros] = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [saving, setSaving] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [prestadorUsuario, setPrestadorUsuario] = useState('')
  const [prestadorNomeManual, setPrestadorNomeManual] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')
  const [valorInterno, setValorInterno] = useState<number | string>('')
  const [status, setStatus] = useState<OrdemServicoStatus>('atribuida')

  const isAdmin = user?.role === 'admin'

  // Carregar usuários que tenham role 'terceiro'
  useEffect(() => {
    if (open) {
      setLoadingUsers(true)
      pb.collection<UserRecord>('users')
        .getFullList({
          filter: "role = 'terceiro'",
          sort: 'name',
          requestKey: null,
        })
        .then((res) => {
          setTerceiros(res)
        })
        .catch(() => {
          setTerceiros([])
        })
        .finally(() => {
          setLoadingUsers(false)
        })

      if (editingOS) {
        setTitulo(editingOS.titulo || '')
        setPrestadorUsuario(editingOS.prestador_usuario || '')
        setPrestadorNomeManual(editingOS.prestador || '')
        setDescricao(editingOS.descricao || '')
        setPrazo(editingOS.prazo ? editingOS.prazo.split('T')[0] : '')
        setValorInterno(editingOS.valor_interno !== undefined ? editingOS.valor_interno : '')
        setStatus(editingOS.status || 'atribuida')
      } else {
        setTitulo('')
        setPrestadorUsuario('')
        setPrestadorNomeManual('')
        setDescricao('')
        setPrazo('')
        setValorInterno('')
        setStatus('atribuida')
      }
    }
  }, [open, editingOS])

  // Se selecionar um usuário terceiro, preencher o nome também
  const handleSelectUser = (userId: string) => {
    setPrestadorUsuario(userId)
    const found = terceiros.find((u) => u.id === userId)
    if (found) {
      setPrestadorNomeManual(found.name)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) {
      toast.error('Informe o escopo/descrição da Ordem de Serviço.')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<OrdemServicoRecord> = {
        projeto: presetProjetoId,
        titulo: titulo.trim() || undefined,
        prestador_usuario: prestadorUsuario || undefined,
        prestador: prestadorNomeManual.trim() || undefined,
        descricao: descricao.trim(),
        prazo: prazo ? `${prazo} 18:00:00.000Z` : undefined,
        status,
      }

      // Somente admin pode alterar valor interno de terceiros
      if (isAdmin && valorInterno !== '') {
        payload.valor_interno = Number(valorInterno)
      }

      if (editingOS) {
        await pb.collection('ordens_servico').update(editingOS.id, payload)
        toast.success('Ordem de Serviço atualizada!')
      } else {
        await pb.collection('ordens_servico').create(payload)
        toast.success('Ordem de Serviço designada com sucesso!')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível salvar a Ordem de Serviço.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#FF6A13]" />
            {editingOS ? 'Editar Ordem de Serviço' : 'Designar Nova OS para Prestador Terceiro'}
          </DialogTitle>
          <DialogDescription>
            {presetProjetoNumero
              ? `Projeto ${presetProjetoNumero} — ${presetProjetoNome || ''}`
              : 'Atribua a execução técnica a um prestador externo credenciado.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Título da OS */}
          <div className="space-y-1.5">
            <Label htmlFor="os-titulo">Título / Objeto da OS</Label>
            <Input
              id="os-titulo"
              placeholder="Ex.: Levantamento Topográfico / Modelagem OLS"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Seleção do Prestador Terceiro */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prestador Credenciado (Usuário)</Label>
              <Select value={prestadorUsuario} onValueChange={handleSelectUser}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingUsers ? 'Carregando...' : 'Selecione um terceiro...'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {terceiros.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum usuário com perfil terceiro
                    </SelectItem>
                  ) : (
                    terceiros.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-nome-manual">Nome do Prestador / Razão</Label>
              <Input
                id="os-nome-manual"
                placeholder="Nome ou empresa do terceiro"
                value={prestadorNomeManual}
                onChange={(e) => setPrestadorNomeManual(e.target.value)}
              />
            </div>
          </div>

          {/* Prazo e Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="os-prazo">Prazo Limite de Entrega</Label>
              <Input
                id="os-prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status da OS</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as OrdemServicoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atribuida">Atribuída</SelectItem>
                  <SelectItem value="em_execucao">Em execução</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="recusada">Recusada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor Interno (Confidencial — apenas admin pode ver e editar) */}
          {isAdmin ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="os-valor" className="font-bold text-amber-900 text-xs">
                  Custo Interno / Honorário do Terceiro (R$) — CONFIDENCIAL
                </Label>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Apenas Diretoria / Admin
                </span>
              </div>
              <Input
                id="os-valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorInterno}
                onChange={(e) => setValorInterno(e.target.value)}
                className="bg-white border-amber-300"
              />
              <p className="text-[11px] text-amber-800">
                O prestador terceiro NÃO tem acesso a este valor. Visível exclusivamente para a
                diretoria.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500 italic">
              Valores internos e custos de terceiros são restritos à diretoria/administrador.
            </div>
          )}

          {/* Descrição / Escopo */}
          <div className="space-y-1.5">
            <Label htmlFor="os-descricao">Escopo e Atividades Requeridas *</Label>
            <Textarea
              id="os-descricao"
              rows={4}
              placeholder="Descreva minuciosamente o escopo técnico a ser executado pelo terceiro, normas aplicáveis e arquivos esperados..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#FF6A13] text-white hover:bg-[#E85B06]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gravando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Ordem de Serviço
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
