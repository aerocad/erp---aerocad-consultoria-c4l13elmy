import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { Lock, ShieldAlert, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react'
import PocketBase from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { isUserAdmin } from '@/lib/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { UserRecord } from '@/types/crm'

export type SensitiveAreaKey =
  | 'valuation'
  | 'relatorios_gerenciais'
  | 'servicos_precos'
  | 'balancetes'
  | 'relatorios_avancados'

const DURATION_MS = 15 * 60 * 1000 // 15 minutos

export interface UnlockedGateMetadata {
  timestamp: number
  userId: string
  userEmail: string
  adminId: string
  adminEmail: string
  adminName: string
  areaKey: SensitiveAreaKey
}

function getStorageKey(areaKey: SensitiveAreaKey, userId: string): string {
  return `aerocad_auth_gate_${userId}_${areaKey}`
}

export function isSensitiveAreaUnlocked(
  areaKey: SensitiveAreaKey,
  userId?: string | null,
): boolean {
  if (!userId) return false
  try {
    const key = getStorageKey(areaKey, userId)
    const raw = sessionStorage.getItem(key)
    if (!raw) return false

    // Suporta tanto o formato novo serializado (JSON com metadata e vínculo de usuário)
    // quanto legado com timestamp numérico puro
    let timestamp = 0
    let storedUserId = userId

    if (raw.startsWith('{')) {
      const parsed: UnlockedGateMetadata = JSON.parse(raw)
      timestamp = parsed.timestamp
      storedUserId = parsed.userId
    } else {
      timestamp = parseInt(raw, 10)
    }

    if (Number.isNaN(timestamp) || !timestamp || storedUserId !== userId) {
      sessionStorage.removeItem(key)
      return false
    }

    const now = Date.now()
    if (now - timestamp < DURATION_MS) {
      return true
    }
    sessionStorage.removeItem(key)
    return false
  } catch {
    return false
  }
}

export function markSensitiveAreaUnlocked(
  areaKey: SensitiveAreaKey,
  userId: string,
  meta?: {
    userEmail: string
    adminId: string
    adminEmail: string
    adminName: string
  },
) {
  try {
    const payload: UnlockedGateMetadata = {
      timestamp: Date.now(),
      userId,
      userEmail: meta?.userEmail || '',
      adminId: meta?.adminId || '',
      adminEmail: meta?.adminEmail || '',
      adminName: meta?.adminName || '',
      areaKey,
    }
    sessionStorage.setItem(getStorageKey(areaKey, userId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function clearSensitiveAreaGates(userId?: string | null) {
  try {
    const prefix = userId ? `aerocad_auth_gate_${userId}_` : 'aerocad_auth_gate_'
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) {
      sessionStorage.removeItem(k)
    }
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

interface AdminOption {
  id: string
  name: string
  email: string
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
  const currentUserIsAdmin = isUserAdmin(rawUser)

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() =>
    isSensitiveAreaUnlocked(areaKey, currentUserId),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [adminsList, setAdminsList] = useState<AdminOption[]>([])
  const [selectedAdminEmail, setSelectedAdminEmail] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingAdmins, setLoadingAdmins] = useState(false)

  // Verifica periodicamente se expirou
  useEffect(() => {
    const check = () => {
      const unlocked = isSensitiveAreaUnlocked(areaKey, currentUserId)
      setIsUnlocked(unlocked)
    }
    check()
    const timer = setInterval(check, 30 * 1000)
    return () => clearInterval(timer)
  }, [areaKey, currentUserId])

  // Se o usuário não for admin, carregar a lista de administradores para que ele possa escolher qual autorizará
  useEffect(() => {
    if (!currentUserIsAdmin && modalOpen) {
      setLoadingAdmins(true)
      pb.collection<UserRecord>('users')
        .getFullList({
          filter: "(role = 'admin' || roles ~ 'admin') && ativo = true",
          fields: 'id,name,email,role,roles',
          sort: 'name',
          requestKey: null,
        })
        .then((records) => {
          // Garante estritamente apenas quem tem role de administrador
          // e que NÃO seja o usuário logado não-admin
          const list = records
            .filter((r) => r.email && isUserAdmin(r))
            .filter(
              (r) =>
                r.id !== currentUserId && r.email.toLowerCase() !== currentUserEmail.toLowerCase(),
            )
            .map((r) => ({
              id: r.id,
              name: r.name || r.email,
              email: r.email,
            }))
          setAdminsList(list)
          if (list.length > 0) {
            setSelectedAdminEmail((prev) =>
              list.some((a) => a.email === prev) ? prev : list[0].email,
            )
          }
        })
        .catch((err) => {
          console.warn('Erro ao carregar administradores para validação de porta:', err)
        })
        .finally(() => setLoadingAdmins(false))
    }
  }, [currentUserIsAdmin, modalOpen, currentUserId, currentUserEmail])

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!adminPassword) {
      setErrorMsg('Informe a senha do administrador.')
      return
    }

    // Regra 1 e 2:
    // Se o usuário logado É admin: valida a própria senha dele
    // Se o usuário logado NÃO é admin: a validação OBRIGATORIAMENTE deve ser contra a conta do administrador selecionado
    const emailToAuth = currentUserIsAdmin
      ? currentUserEmail.trim().toLowerCase()
      : selectedAdminEmail.trim().toLowerCase()

    if (!emailToAuth) {
      setErrorMsg('Selecione um administrador para validar.')
      return
    }

    // Regra estrita de segurança:
    // Se o logado não é admin, NUNCA permitir autenticar com o email do próprio logado!
    if (!currentUserIsAdmin && emailToAuth === currentUserEmail.trim().toLowerCase()) {
      setErrorMsg(
        'Acesso negado: a senha do próprio usuário não-administrador é recusada. É necessária a autenticação de um administrador.',
      )
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      // Instância isolada do PocketBase para validar a credencial do administrador
      // SEM sobrescrever ou deslogar o authStore atual da sessão do usuário logado!
      const tempPb = new PocketBase(pb.baseURL)
      const authResult = await tempPb
        .collection('users')
        .authWithPassword(emailToAuth, adminPassword, {
          requestKey: null,
        })

      const adminRecord = authResult.record as unknown as UserRecord
      // Dupla checagem: o usuário autenticado na instância temporária tem credencial real de admin?
      if (!isUserAdmin(adminRecord)) {
        setErrorMsg('A conta informada não possui privilégios de administrador.')
        return
      }

      // Validação concluída com sucesso!
      const adminName = adminRecord.name || adminRecord.email
      const adminId = adminRecord.id

      // 1. Gravar log de auditoria oficial (coleção auditoria_operacoes_bloco)
      try {
        const descAuditoria = currentUserIsAdmin
          ? `Acesso à área sensível "${areaTitle}" liberado por auto-confirmação do próprio Administrador ${adminName} (${adminRecord.email}) por 15 minutos.`
          : `Acesso à área sensível "${areaTitle}" LIBERADO para o usuário ${rawUser?.name || currentUserEmail} (${currentUserEmail}) mediante autorização expressa e senha do Administrador ${adminName} (${adminRecord.email}) por 15 minutos.`

        await pb.collection('auditoria_operacoes_bloco').create({
          usuario: currentUserId || null,
          tipo_operacao: 'liberacao_area_sensivel',
          colecao_alvo: `area_sensivel:${areaKey}`,
          descricao: descAuditoria,
          criterio_filtro: {
            areaKey,
            areaTitle,
            usuario_solicitante_id: currentUserId,
            usuario_solicitante_email: currentUserEmail,
            usuario_solicitante_nome: rawUser?.name || currentUserEmail,
            admin_autorizador_id: adminId,
            admin_autorizador_email: adminRecord.email,
            admin_autorizador_nome: adminName,
            auto_aprovacao: currentUserIsAdmin,
            duracao_minutos: 15,
          },
          alteracoes_solicitadas: {
            status: 'liberado',
            areaKey,
            expira_em_ms: DURATION_MS,
          },
          total_registros_afetados: 1,
          total_falhas: 0,
          desfeito: false,
        })
      } catch (auditErr) {
        console.warn('Aviso: Falha ao registrar auditoria de liberação de área sensível:', auditErr)
      }

      // 2. Registrar desbloqueio na sessão vinculando ao usuário logado
      markSensitiveAreaUnlocked(areaKey, currentUserId, {
        userEmail: currentUserEmail,
        adminId,
        adminEmail: adminRecord.email,
        adminName,
      })

      setIsUnlocked(true)
      setModalOpen(false)
      setAdminPassword('')
      toast.success(
        currentUserIsAdmin
          ? `Acesso a "${areaTitle}" liberado com sucesso por 15 minutos.`
          : `Acesso a "${areaTitle}" liberado pelo administrador ${adminName} por 15 minutos.`,
      )
    } catch {
      setErrorMsg('Senha do administrador incorreta. Acesso não autorizado.')
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
            Área Estratégica & Sensível — Senha do Administrador Exigida
          </h3>
          <p className="text-xs text-neutral-600">
            {areaDescription ||
              `O acesso à seção "${areaTitle}" é restrito e exige a confirmação da senha do administrador do sistema por motivos de conformidade e governança.`}
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMsg('')
            setAdminPassword('')
            setModalOpen(true)
          }}
          className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold text-xs gap-1.5 shadow-sm"
        >
          <KeyRound className="h-4 w-4" />
          {currentUserIsAdmin ? 'Confirmar minha senha de Admin' : 'Digitar senha de Administrador'}
        </Button>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o && !isUnlocked) {
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
                  Validação de Administrador
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  {areaTitle} · Autorização com credencial de administrador
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleConfirmPassword} className="space-y-4 py-1">
            {currentUserIsAdmin ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 text-xs text-neutral-700 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#FF6A13] shrink-0 mt-0.5" />
                <div>
                  Você está logado como{' '}
                  <strong className="text-neutral-900">{currentUserEmail}</strong> (Administrador).
                  Digite sua senha pessoal para liberar o acesso.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                  Esta área estratégica exige autorização expressa de um administrador. Peça ao
                  administrador para digitar a senha.
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-800">
                    Administrador responsável
                  </Label>
                  {loadingAdmins ? (
                    <div className="text-xs text-neutral-400 py-1">
                      Carregando administradores...
                    </div>
                  ) : adminsList.length > 0 ? (
                    <Select
                      value={selectedAdminEmail}
                      onValueChange={(val) => {
                        setSelectedAdminEmail(val)
                        if (errorMsg) setErrorMsg('')
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione o administrador" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminsList.map((admin) => (
                          <SelectItem key={admin.id} value={admin.email}>
                            {admin.name} ({admin.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="email"
                      value={selectedAdminEmail}
                      onChange={(e) => {
                        setSelectedAdminEmail(e.target.value)
                        if (errorMsg) setErrorMsg('')
                      }}
                      placeholder="admin@aerocad.com.br"
                      className="h-9 text-xs"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-800">
                {currentUserIsAdmin ? 'Sua senha de administrador' : 'Senha do administrador'}
              </Label>
              <Input
                autoFocus
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="••••••••"
                className="h-9 text-xs"
              />
              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <p className="text-[11px] text-neutral-400">
                Após autorizar, o acesso permanece liberado nesta sessão por 15 minutos.
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
                disabled={isSubmitting || !adminPassword}
                className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold"
              >
                {isSubmitting ? 'Validando...' : 'Liberar acesso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
