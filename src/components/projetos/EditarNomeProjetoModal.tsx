import { useEffect, useState, type FormEvent } from 'react'
import { Check, Edit3, Loader2 } from 'lucide-react'
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
import { useAuth } from '@/contexts/AuthContext'
import { updateOne } from '@/services/api'
import type { ProjetoRecord } from '@/types/crm'

interface EditarNomeProjetoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: Pick<ProjetoRecord, 'id' | 'numero' | 'nome' | 'cliente'> | null
  onSuccess?: (projetoAtualizado: ProjetoRecord) => void
}

const MAX_NOME_CHARS = 220

export function EditarNomeProjetoModal({
  open,
  onOpenChange,
  projeto,
  onSuccess,
}: EditarNomeProjetoModalProps) {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Permissões: apenas perfis admin e tecnico podem editar o nome
  const canEdit = user?.role === 'admin' || user?.role === 'tecnico'

  useEffect(() => {
    if (open && projeto) {
      setNome(projeto.nome || '')
      setErro(null)
    }
  }, [open, projeto])

  const charsCount = nome.length
  const isOverLimit = charsCount > MAX_NOME_CHARS
  const isVazio = !nome.trim()
  const isModificado = projeto && nome.trim() !== projeto.nome?.trim()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!canEdit) {
      setErro('Você não tem permissão para editar o nome do projeto (restrito a Admin e Técnico).')
      return
    }

    if (!projeto) return

    const nomeFormatado = nome.trim()
    if (!nomeFormatado) {
      setErro('O nome do projeto é obrigatório e não pode ser vazio.')
      return
    }

    if (nomeFormatado.length > MAX_NOME_CHARS) {
      setErro(`O nome do projeto excede o limite máximo de ${MAX_NOME_CHARS} caracteres.`)
      return
    }

    if (nomeFormatado === projeto.nome?.trim()) {
      onOpenChange(false)
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const atualizado = await updateOne<ProjetoRecord>('projetos', projeto.id, {
        nome: nomeFormatado,
      })

      toast.success('Nome do projeto atualizado com sucesso!')
      onSuccess?.(atualizado)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao atualizar nome do projeto:', err)
      const msg =
        err instanceof Error ? err.message : 'Não foi possível salvar o novo nome do projeto.'
      setErro(msg)
      toast.error('Erro ao atualizar nome do projeto.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-[#FF6A13]">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Editar Nome do Projeto</DialogTitle>
              <DialogDescription className="text-xs text-[#737373]">
                Projeto{' '}
                <strong className="font-mono text-[#D65100]">
                  {projeto?.numero || 'Sem número'}
                </strong>{' '}
                (numeração fixa)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="nome-projeto" className="text-xs font-semibold text-[#424242]">
                Nome do Projeto *
              </Label>
              <span
                className={`text-[11px] font-mono ${
                  isOverLimit
                    ? 'font-bold text-red-600'
                    : charsCount >= 200
                      ? 'font-semibold text-amber-600'
                      : 'text-[#8A8A8A]'
                }`}
              >
                {charsCount}/{MAX_NOME_CHARS} caracteres
              </span>
            </div>
            <Input
              id="nome-projeto"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (erro) setErro(null)
              }}
              placeholder="Ex.: PBZPA — Aeródromo Fazenda Modelo"
              className={`text-sm ${isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              maxLength={MAX_NOME_CHARS + 50}
              autoFocus
              disabled={salvando || !canEdit}
            />
            <p className="text-[11px] text-[#8A8A8A]">
              Ideal para desobstruir nomes truncados na importação histórica de planilhas.
            </p>
          </div>

          {erro && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {erro}
            </div>
          )}

          {!canEdit && (
            <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              Apenas os perfis <strong>Administrador</strong> e <strong>Técnico</strong> possuem
              permissão para renomear projetos.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || isVazio || isOverLimit || !isModificado || !canEdit}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Alteração
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
