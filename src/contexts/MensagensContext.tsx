import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { MensagemRecord, UserRecord } from '@/types/crm'

interface MensagensContextType {
  mensagens: MensagemRecord[]
  usuarios: UserRecord[]
  naoLidasCount: number
  loading: boolean
  recarregar: () => Promise<void>
  enviarMensagem: (destinatarioId: string, texto: string) => Promise<boolean>
  marcarComoLidas: (outroUsuarioId: string) => Promise<void>
}

const MensagensContext = createContext<MensagensContextType | null>(null)

export function MensagensProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [mensagens, setMensagens] = useState<MensagemRecord[]>([])
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(false)

  const recarregar = useCallback(async () => {
    if (!user?.id) {
      setMensagens([])
      setUsuarios([])
      return
    }

    try {
      // 1. Carregar lista de usuários (para listar colegas no chat)
      const usersRes = await pb.collection('users').getFullList<UserRecord>({
        sort: 'name',
      })
      setUsuarios(usersRes)

      // 2. Carregar mensagens do usuário atual (enviadas ou recebidas)
      // Ordenadas cronologicamente
      const msgsRes = await pb.collection('mensagens').getFullList<MensagemRecord>({
        filter: `remetente = "${user.id}" || destinatario = "${user.id}"`,
        sort: '+created',
        expand: 'remetente,destinatario',
      })
      setMensagens(msgsRes)
    } catch {
      /* ignore em caso de desconexão momentânea */
    }
  }, [user?.id])

  // Carga inicial
  useEffect(() => {
    if (user?.id) {
      setLoading(true)
      recarregar().finally(() => setLoading(false))
    }
  }, [user?.id, recarregar])

  // Polling a cada ~12s para manter dados atualizados com o backend de forma simples e ultra-confiável
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      void recarregar()
    }, 12000)

    return () => clearInterval(interval)
  }, [user?.id, recarregar])

  // Escutar realtime do PocketBase caso disponível
  useEffect(() => {
    if (!user?.id) return

    let unsub: (() => void) | undefined

    void pb
      .collection('mensagens')
      .subscribe('*', (e) => {
        const record = e.record as MensagemRecord
        if (record.remetente === user.id || record.destinatario === user.id) {
          void recarregar()
        }
      })
      .then((u) => {
        unsub = u
      })
      .catch(() => {
        /* se realtime websocket falhar, o polling de 12s garante a atualização */
      })

    return () => {
      if (unsub) unsub()
      else
        pb.collection('mensagens')
          .unsubscribe('*')
          .catch(() => {})
    }
  }, [user?.id, recarregar])

  // Contagem de mensagens não lidas onde o usuário atual é o destinatário
  const naoLidasCount = mensagens.filter((m) => m.destinatario === user?.id && !m.lido).length

  // Enviar nova mensagem
  const enviarMensagem = useCallback(
    async (destinatarioId: string, texto: string) => {
      if (!user?.id || !destinatarioId || !texto.trim()) return false

      try {
        await pb.collection('mensagens').create({
          remetente: user.id,
          destinatario: destinatarioId,
          texto: texto.trim(),
          lido: false,
        })
        await recarregar()
        return true
      } catch {
        return false
      }
    },
    [user?.id, recarregar],
  )

  // Marcar mensagens recebidas do usuário selecionado como lidas
  const marcarComoLidas = useCallback(
    async (outroUsuarioId: string) => {
      if (!user?.id || !outroUsuarioId) return

      const pendentes = mensagens.filter(
        (m) => m.remetente === outroUsuarioId && m.destinatario === user.id && !m.lido,
      )

      if (pendentes.length === 0) return

      try {
        await Promise.all(
          pendentes.map((m) => pb.collection('mensagens').update(m.id, { lido: true })),
        )
        // Atualiza estado local imediatamente
        setMensagens((prev) =>
          prev.map((m) =>
            m.remetente === outroUsuarioId && m.destinatario === user.id ? { ...m, lido: true } : m,
          ),
        )
      } catch {
        /* ignore */
      }
    },
    [user?.id, mensagens],
  )

  return (
    <MensagensContext.Provider
      value={{
        mensagens,
        usuarios,
        naoLidasCount,
        loading,
        recarregar,
        enviarMensagem,
        marcarComoLidas,
      }}
    >
      {children}
    </MensagensContext.Provider>
  )
}

export function useMensagens() {
  const ctx = useContext(MensagensContext)
  if (!ctx) {
    throw new Error('useMensagens must be used within a MensagensProvider')
  }
  return ctx
}
