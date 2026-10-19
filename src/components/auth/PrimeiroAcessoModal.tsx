import { useState, type FormEvent } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Check,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export function PrimeiroAcessoModal() {
  const { user, refreshUser } = useAuth()
  const [modo, setModo] = useState<'escolha' | 'criar_senha' | 'manter_senha'>('escolha')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('')
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const [loading, setLoading] = useState(false)

  // Deve ser exibido somente se houver usuário autenticado e primeiro_acesso === true
  const isPrimeiroAcesso = Boolean(user && user.primeiro_acesso === true)

  if (!isPrimeiroAcesso) {
    return null
  }

  // Validação de força de senha
  const temOitoDigitos = novaSenha.length >= 8
  const temLetra = /[a-zA-Z]/.test(novaSenha)
  const temNumero = /[0-9]/.test(novaSenha)
  const senhasCoincidem = novaSenha.length > 0 && novaSenha === confirmacaoSenha
  const senhaValida = temOitoDigitos && temLetra && temNumero && senhasCoincidem

  const handleConcluirManterSenha = async () => {
    if (!user) return
    setLoading(true)
    try {
      await pb.collection('users').update(user.id, {
        primeiro_acesso: false,
      })
      await refreshUser()
      toast.success('Bem-vindo(a) ao CRM AEROCAD! Senha mantida com sucesso.')
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao atualizar dados de acesso.'
      toast.error(`Erro: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleConcluirCriarSenha = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!temOitoDigitos) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (!temLetra || !temNumero) {
      toast.error('A nova senha deve conter letras e números.')
      return
    }
    if (!senhasCoincidem) {
      toast.error('A confirmação não coincide com a nova senha.')
      return
    }

    setLoading(true)
    try {
      await pb.collection('users').update(user.id, {
        password: novaSenha,
        passwordConfirm: confirmacaoSenha,
        primeiro_acesso: false,
      })
      await refreshUser()
      toast.success('Sua nova senha foi cadastrada com sucesso! Bem-vindo(a) à AEROCAD.')
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao definir nova senha.'
      toast.error(`Erro: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isPrimeiroAcesso} onOpenChange={() => {}}>
      <DialogContent
        // Bloqueante estrito: sem botão de fechar no canto, sem fechar no clique fora ou ESC
        className="sm:max-w-md [&>button]:hidden shadow-2xl border-2 border-[#FF6A13]/30"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#FF6A13] shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6A13] bg-[#FFF0E6] px-2 py-0.5 rounded border border-[#FF6A13]/20">
                Primeiro Acesso · AEROCAD
              </span>
              <DialogTitle className="text-lg font-bold text-neutral-900 mt-0.5">
                Olá, {user?.name || 'Colaborador(a)'}!
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-neutral-600 leading-relaxed pt-1">
            Esta é a sua primeira inicialização no CRM da AEROCAD Consultoria. Para sua segurança e
            conformidade de acesso, escolha como deseja prosseguir com sua senha:
          </DialogDescription>
        </DialogHeader>

        {modo === 'escolha' && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setModo('criar_senha')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-neutral-200 hover:border-[#FF6A13] hover:bg-[#FFF9F5] transition-all group flex items-start gap-3 bg-white shadow-2xs"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13] group-hover:bg-[#FF6A13] group-hover:text-white transition-colors">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900 group-hover:text-[#D65100]">
                    Criar minha própria senha
                  </span>
                  <span className="text-[10px] font-bold text-[#FF6A13] bg-orange-50 px-2 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5 leading-snug">
                  Defina uma senha pessoal, exclusiva e segura para os seus próximos acessos.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModo('manter_senha')}
              className="w-full text-left p-3.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all group flex items-start gap-3 bg-white"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 group-hover:text-neutral-900 transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-neutral-800">Manter a senha inicial</span>
                <p className="text-xs text-neutral-500 mt-0.5 leading-snug">
                  Continuar usando a senha fornecida pelo administrador do sistema.
                </p>
              </div>
            </button>
          </div>
        )}

        {modo === 'criar_senha' && (
          <form onSubmit={handleConcluirCriarSenha} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-800">Nova Senha</Label>
              <div className="relative">
                <Input
                  required
                  type={showNovaSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres (letras e números)"
                  className="h-9 pr-9 text-xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha(!showNovaSenha)}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700"
                  tabIndex={-1}
                >
                  {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-800">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  required
                  type={showConfirmacao ? 'text' : 'password'}
                  value={confirmacaoSenha}
                  onChange={(e) => setConfirmacaoSenha(e.target.value)}
                  placeholder="Digite a mesma senha novamente"
                  className="h-9 pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmacao(!showConfirmacao)}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700"
                  tabIndex={-1}
                >
                  {showConfirmacao ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Checklist de requisitos de segurança */}
            <div className="rounded-lg bg-neutral-50 p-2.5 space-y-1 border border-neutral-200 text-[11px]">
              <div
                className={`flex items-center gap-1.5 ${temOitoDigitos ? 'text-emerald-700 font-semibold' : 'text-neutral-500'}`}
              >
                <Check className={`h-3.5 w-3.5 ${temOitoDigitos ? 'opacity-100' : 'opacity-30'}`} />
                <span>Pelo menos 8 caracteres</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${temLetra && temNumero ? 'text-emerald-700 font-semibold' : 'text-neutral-500'}`}
              >
                <Check
                  className={`h-3.5 w-3.5 ${temLetra && temNumero ? 'opacity-100' : 'opacity-30'}`}
                />
                <span>Contém letras e números</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${senhasCoincidem ? 'text-emerald-700 font-semibold' : 'text-neutral-500'}`}
              >
                <Check
                  className={`h-3.5 w-3.5 ${senhasCoincidem ? 'opacity-100' : 'opacity-30'}`}
                />
                <span>Confirmação idêntica</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModo('escolha')}
                disabled={loading}
                className="text-xs text-neutral-600"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !senhaValida}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs gap-1.5"
              >
                {loading ? 'Salvando...' : 'Salvar e Acessar CRM'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        )}

        {modo === 'manter_senha' && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Confirmação de Senha Inicial</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Você optou por continuar utilizando a senha inicial criada pelo administrador.
                  Caso deseje alterá-la futuramente, poderá solicitar ao administrador do sistema.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModo('escolha')}
                disabled={loading}
                className="text-xs text-neutral-600"
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConcluirManterSenha}
                disabled={loading}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs gap-1.5"
              >
                {loading ? 'Confirmando...' : 'Confirmar e Acessar'}
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
