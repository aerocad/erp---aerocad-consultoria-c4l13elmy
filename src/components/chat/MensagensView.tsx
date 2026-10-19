import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MessageSquare,
  Send,
  Search,
  UserCheck,
  CheckCheck,
  Check,
  Circle,
  ArrowLeft,
  Users,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useMensagens } from '@/contexts/MensagensContext'
import { roleLabels } from '@/lib/crm'
import { initials } from '@/lib/format'
import type { UserRecord, MensagemRecord } from '@/types/crm'

function formatarDataHora(dataIso: string): string {
  try {
    const d = new Date(dataIso)
    if (isNaN(d.getTime())) return ''
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const ano = d.getFullYear()
    const horas = String(d.getHours()).padStart(2, '0')
    const minutos = String(d.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`
  } catch {
    return ''
  }
}

function formatarHoraCurta(dataIso: string): string {
  try {
    const d = new Date(dataIso)
    if (isNaN(d.getTime())) return ''
    const horas = String(d.getHours()).padStart(2, '0')
    const minutos = String(d.getMinutes()).padStart(2, '0')
    return `${horas}:${minutos}`
  } catch {
    return ''
  }
}

export function MensagensView() {
  const { user } = useAuth()
  const { mensagens, usuarios, enviarMensagem, marcarComoLidas } = useMensagens()

  // Colegas disponíveis (todos os usuários exceto o próprio usuário)
  const colegas = useMemo(() => {
    return usuarios.filter((u) => u.id !== user?.id)
  }, [usuarios, user?.id])

  const [busca, setBusca] = useState('')
  const [destinatarioSelecionadoId, setDestinatarioSelecionadoId] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Colega selecionado
  const colegaSelecionado = useMemo(() => {
    return colegas.find((c) => c.id === destinatarioSelecionadoId) || null
  }, [colegas, destinatarioSelecionadoId])

  // Se nenhum estiver selecionado e houver colegas, seleciona o primeiro no desktop
  useEffect(() => {
    if (!destinatarioSelecionadoId && colegas.length > 0) {
      // No desktop padrão, pode selecionar o primeiro
      if (window.innerWidth >= 768) {
        setDestinatarioSelecionadoId(colegas[0].id)
      }
    }
  }, [colegas, destinatarioSelecionadoId])

  // Filtrar colegas pela busca
  const colegasFiltrados = useMemo(() => {
    if (!busca.trim()) return colegas
    const q = busca.toLowerCase()
    return colegas.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (roleLabels[c.role] || '').toLowerCase().includes(q),
    )
  }, [colegas, busca])

  // Mapa de mensagens não lidas por colega
  const naoLidasPorColega = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of mensagens) {
      if (m.destinatario === user?.id && !m.lido) {
        map[m.remetente] = (map[m.remetente] || 0) + 1
      }
    }
    return map
  }, [mensagens, user?.id])

  // Última mensagem com cada colega para ordenar a lista
  const ultimasMensagens = useMemo(() => {
    const map: Record<string, MensagemRecord> = {}
    for (const m of mensagens) {
      const outroId = m.remetente === user?.id ? m.destinatario : m.remetente
      map[outroId] = m
    }
    return map
  }, [mensagens, user?.id])

  // Ordenar lista de colegas: com mensagens recentes primeiro
  const colegasOrdenados = useMemo(() => {
    return [...colegasFiltrados].sort((a, b) => {
      const msgA = ultimasMensagens[a.id]
      const msgB = ultimasMensagens[b.id]
      const timeA = msgA ? new Date(msgA.created).getTime() : 0
      const timeB = msgB ? new Date(msgB.created).getTime() : 0
      return timeB - timeA
    })
  }, [colegasFiltrados, ultimasMensagens])

  // Mensagens do chat atual (1:1 entre user e colegaSelecionado)
  const conversaAtual = useMemo(() => {
    if (!colegaSelecionado || !user?.id) return []
    return mensagens.filter(
      (m) =>
        (m.remetente === user.id && m.destinatario === colegaSelecionado.id) ||
        (m.remetente === colegaSelecionado.id && m.destinatario === user.id),
    )
  }, [mensagens, user?.id, colegaSelecionado])

  // Marcar como lidas ao abrir a conversa
  useEffect(() => {
    if (colegaSelecionado?.id) {
      void marcarComoLidas(colegaSelecionado.id)
    }
  }, [colegaSelecionado?.id, mensagens.length, marcarComoLidas])

  // Auto scroll para o final das mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversaAtual.length, destinatarioSelecionadoId])

  const handleEnviar = async () => {
    if (!destinatarioSelecionadoId || !texto.trim() || enviando) return

    setEnviando(true)
    const enviado = await enviarMensagem(destinatarioSelecionadoId, texto)
    if (enviado) {
      setTexto('')
    }
    setEnviando(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleEnviar()
    }
  }

  return (
    <div className="crm-card overflow-hidden flex flex-col md:flex-row h-[calc(100vh-12rem)] min-h-[520px] max-h-[780px] border border-neutral-200">
      {/* Coluna Esquerda: Colegas / Contatos (escondida no mobile se um chat estiver ativo) */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-neutral-200 flex flex-col bg-white shrink-0 ${
          destinatarioSelecionadoId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Cabeçalho da coluna */}
        <div className="p-3.5 border-b border-neutral-200 bg-neutral-50/70">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#FF6A13]" />
              <h2 className="text-sm font-bold text-neutral-900">Mensagens Internas</h2>
            </div>
            <span className="text-[11px] text-neutral-500 font-semibold">
              {colegas.length} colega{colegas.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <Input
              type="text"
              placeholder="Buscar colega por nome, cargo ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 text-xs bg-white"
            />
          </div>
        </div>

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {colegasOrdenados.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              Nenhum colega encontrado com esse filtro.
            </div>
          ) : (
            colegasOrdenados.map((colega) => {
              const isSelected = destinatarioSelecionadoId === colega.id
              const naoLidas = naoLidasPorColega[colega.id] || 0
              const ultimaMsg = ultimasMensagens[colega.id]
              const isAtivo = colega.ativo !== false

              return (
                <button
                  key={colega.id}
                  type="button"
                  onClick={() => setDestinatarioSelecionadoId(colega.id)}
                  className={`w-full p-3 text-left flex items-start gap-3 transition-colors ${
                    isSelected
                      ? 'bg-orange-50/70 border-l-4 border-l-[#FF6A13]'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 border border-neutral-200">
                      <AvatarFallback
                        className={
                          isAtivo
                            ? 'bg-[#FFF0E5] text-[#D65100] text-xs font-bold'
                            : 'bg-neutral-200 text-neutral-500 text-xs font-bold'
                        }
                      >
                        {initials(colega.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                        isAtivo ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                      title={isAtivo ? 'Usuário ativo' : 'Usuário inativo'}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-[#D65100]' : 'text-neutral-900'
                        }`}
                      >
                        {colega.name}
                      </p>
                      {ultimaMsg && (
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {formatarHoraCurta(ultimaMsg.created)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-medium">
                        {roleLabels[colega.role] || colega.role}
                      </span>
                      {!isAtivo && <span className="text-[9px] text-neutral-400">(inativo)</span>}
                    </div>

                    {ultimaMsg && (
                      <p className="text-[11px] text-neutral-500 truncate mt-1">
                        {ultimaMsg.remetente === user?.id ? 'Você: ' : ''}
                        {ultimaMsg.texto}
                      </p>
                    )}
                  </div>

                  {naoLidas > 0 && (
                    <Badge className="bg-[#FF6A13] hover:bg-[#FF6A13] text-white text-[10px] font-bold px-1.5 py-0 h-5 min-w-5 shrink-0 flex items-center justify-center">
                      {naoLidas}
                    </Badge>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Conversa 1:1 */}
      <div
        className={`w-full flex-1 flex flex-col bg-[#F9F9F9] ${
          !destinatarioSelecionadoId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {colegaSelecionado ? (
          <>
            {/* Topo do Chat com Colega */}
            <div className="p-3 sm:px-4 border-b border-neutral-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Botão voltar no mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDestinatarioSelecionadoId(null)}
                  className="h-8 w-8 p-0 md:hidden text-neutral-600 hover:text-neutral-900"
                  title="Voltar à lista de colegas"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <Avatar className="h-8 w-8 border border-neutral-200 shrink-0">
                  <AvatarFallback className="bg-[#FFF0E5] text-[#D65100] text-xs font-bold">
                    {initials(colegaSelecionado.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                      {colegaSelecionado.name}
                    </h3>
                    <span className="text-[10px] font-semibold text-[#D65100] bg-orange-100 px-1.5 py-0.2 rounded">
                      {roleLabels[colegaSelecionado.role] || colegaSelecionado.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 truncate">{colegaSelecionado.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500 hidden sm:flex">
                <Shield className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span className="text-[11px]">Canal Interno AEROCAD</span>
              </div>
            </div>

            {/* Mensagens Histórico (DD/MM/AAAA HH:mm) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {conversaAtual.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                  <MessageSquare className="h-10 w-10 text-neutral-300 mb-2 stroke-1" />
                  <p className="text-xs font-semibold text-neutral-600">
                    Nenhuma mensagem nesta conversa ainda.
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
                    Inicie a conversa enviando uma mensagem no campo abaixo.
                  </p>
                </div>
              ) : (
                conversaAtual.map((msg) => {
                  const souEu = msg.remetente === user?.id

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${souEu ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs break-words ${
                          souEu
                            ? 'bg-[#FF6A13] text-white rounded-br-xs'
                            : 'bg-white text-neutral-800 border border-neutral-200/80 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.texto}</p>

                        <div
                          className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                            souEu ? 'text-white/80' : 'text-neutral-400'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatarDataHora(msg.created)}</span>
                          {souEu && (
                            <span title={msg.lido ? 'Lida' : 'Entregue'}>
                              {msg.lido ? (
                                <CheckCheck className="h-3 w-3 text-white inline ml-0.5" />
                              ) : (
                                <Check className="h-3 w-3 text-white/70 inline ml-0.5" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Envio de Mensagem (Enter para enviar) */}
            <div className="p-3 bg-white border-t border-neutral-200 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={`Mensagem para ${colegaSelecionado.name}... (Pressione Enter)`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={enviando}
                  className="text-xs h-9 bg-neutral-50/60 focus-visible:bg-white"
                />
                <Button
                  size="sm"
                  onClick={handleEnviar}
                  disabled={!texto.trim() || enviando}
                  className="h-9 px-3.5 bg-[#FF6A13] hover:bg-[#E85B06] text-white font-bold gap-1 shadow-2xs shrink-0"
                  title="Enviar mensagem (Enter)"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 pl-1">
                Pressione{' '}
                <kbd className="font-mono bg-neutral-100 px-1 py-0.2 rounded border">Enter</kbd>{' '}
                para enviar rapidamente.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-700">Selecione um colega</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              Escolha qualquer usuário ativo da equipe para iniciar uma conversa direta de texto.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
