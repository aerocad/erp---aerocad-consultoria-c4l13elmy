import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { Lock, ShieldAlert, KeyRound, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export type SensitiveAreaKey = 'valuation' | 'relatorios_gerenciais' | 'servicos_precos'

const DURATION_MS = 15 * 60 * 1000 // 15 minutos

function getStorageKey(areaKey: SensitiveAreaKey, userId: string): string {
  return `aerocad_auth_gate_${userId}_${areaKey}`
}

export function isSensitiveAreaUnlocked(
  areaKey: SensitiveAreaKey,
  userId?: string | null,
): boolean {
  if (!userId) return false
  try {
    const raw = sessionStorage.getItem(getStorageKey(areaKey, userId))
    if (!raw) return false
    const ts = parseInt(raw, 10)
    if (Number.isNaN(ts)) return false
    const now = Date.now()
    if (now - ts < DURATION_MS) {
      return true
    }
    sessionStorage.removeItem(getStorageKey(areaKey, userId))
    return false
  } catch {
    return false
  }
}

export function markSensitiveAreaUnlocked(areaKey: SensitiveAreaKey, userId: string) {
  try {
    sessionStorage.setItem(getStorageKey(areaKey, userId), Date.now().toString())
  } catch {
    /* ignore */
  }
}

interface SensitiveAreaGateProps {
  areaKey: SensitiveAreaKey
  areaTitle: string
  areaDescription?: string
  children: ReactNode
}

export function SensitiveAreaGate({
  areaKey,
  areaTitle,
  areaDescription,
  children,
}: SensitiveAreaGateProps) {
  const { user, rawUser } = useAuth()
  const currentUserId = rawUser?.id || user?.id || ''
  const currentUserEmail = rawUser?.email || user?.email || ''

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() =>
    isSensitiveAreaUnlocked(areaKey, currentUserId),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Verifica periodicamente ou na troca de usuário se expirou
  useEffect(() => {
    const check = () => {
      const unlocked = isSensitiveAreaUnlocked(areaKey, currentUserId)
      setIsUnlocked(unlocked)
      if (!unlocked) {
        setModalOpen(true)
      }
    }
    check()
    const timer = setInterval(check, 30 * 1000)
    return () => clearInterval(timer)
  }, [areaKey, currentUserId])

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) {
      setErrorMsg('Informe sua senha de acesso.')
      return
    }
    if (!currentUserEmail) {
      setErrorMsg('Usuário não autenticado.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      // Reautentica com PocketBase usando o email do usuário logado e a senha informada
      await pb
        .collection('users')
        .authWithPassword(currentUserEmail, password, { requestKey: null })

      markSensitiveAreaUnlocked(areaKey, currentUserId)
      setIsUnlocked(true)
      setModalOpen(false)
      setPassword('')
      toast.success(`Acesso liberado a "${areaTitle}" por 15 minutos.`)
    } catch {
      setErrorMsg('Senha incorreta. Acesso não autorizado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isUnlocked) {
    return <>{children}</>
  }

  return (
    <div className="relative min-h-[360px] flex flex-col items-center justify-center p-8 bg-neutral-50/50 rounded-xl border border-neutral-200">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-[#FF6A13] shadow-inner">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-neutral-900">
            Área Restrita — Confirmação de Identidade
          </h3>
          <p className="text-xs text-neutral-600">
            {areaDescription ||
              `O acesso à seção "${areaTitle}" requer validação da senha do usuário administrador logado por motivos de conformidade e segurança.`}
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMsg('')
            setPassword('')
            setModalOpen(true)
          }}
          className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <KeyRound className="h-4 w-4" />
          Confirmar senha para desbloquear
        </Button>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o && !isUnlocked) {
            // Não fecha modal se não desbloqueado, apenas permite manter aberto
            setModalOpen(false)
          } else {
            setModalOpen(o)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-[#FF6A13]">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-neutral-900">
                  Área restrita — confirme sua senha
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  {areaTitle} · Confirme as credenciais de {currentUserEmail}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleConfirmPassword} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-800">
                Senha do usuário logado
              </Label>
              <Input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Digite sua senha atual"
                className="h-9 text-xs"
              />
              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <p className="text-[11px] text-neutral-400">
                Após autenticar, a área permanece liberada neste navegador por 15 minutos.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !password}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {isSubmitting ? 'Validando...' : 'Confirmar e acessar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
