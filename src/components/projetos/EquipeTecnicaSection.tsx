import React, { useMemo } from 'react'
import {
  Award,
  Check,
  ChevronDown,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ColaboradorRecord } from '@/types/crm'

export interface EquipeTecnicaValue {
  coordenadorId?: string
  analistaId?: string
  rtsIds: string[]
}

interface EquipeTecnicaSelectorProps {
  colaboradores: ColaboradorRecord[]
  value: EquipeTecnicaValue
  onChange: (value: EquipeTecnicaValue) => void
  disabled?: boolean
  layout?: 'compact' | 'full'
  className?: string
}

export function formatRegistroRt(colab?: ColaboradorRecord | null): string {
  if (!colab) return ''
  const partes: string[] = []
  if (colab.registro_profissional_numero) {
    const tipo = colab.registro_profissional_tipo || 'CREA'
    const uf = colab.registro_profissional_uf ? `/${colab.registro_profissional_uf}` : ''
    partes.push(`${tipo} ${colab.registro_profissional_numero}${uf}`)
  }
  return partes.join(' ')
}

export function EquipeTecnicaSelector({
  colaboradores,
  value,
  onChange,
  disabled = false,
  layout = 'full',
  className = '',
}: EquipeTecnicaSelectorProps) {
  // RTs preferenciais são aqueles marcados com eh_rt, mas qualquer colaborador ativo pode ser listado se necessário
  const rtsCandidatos = useMemo(() => {
    return colaboradores
      .filter((c) => c.situacao === 'ativo')
      .sort((a, b) => {
        // Primeiro os que têm flag eh_rt
        if (a.eh_rt && !b.eh_rt) return -1
        if (!a.eh_rt && b.eh_rt) return 1
        return a.nome_completo.localeCompare(b.nome_completo)
      })
  }, [colaboradores])

  const coordenadoresCandidatos = useMemo(() => {
    return colaboradores
      .filter((c) => c.situacao === 'ativo')
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [colaboradores])

  const analistasCandidatos = useMemo(() => {
    return colaboradores
      .filter((c) => c.situacao === 'ativo')
      .sort((a, b) => {
        if (a.eh_tecnico && !b.eh_tecnico) return -1
        if (!a.eh_tecnico && b.eh_tecnico) return 1
        return a.nome_completo.localeCompare(b.nome_completo)
      })
  }, [colaboradores])

  function handleSetCoordenador(id: string) {
    onChange({
      ...value,
      coordenadorId: id === 'none' ? undefined : id,
    })
  }

  function handleSetAnalista(id: string) {
    onChange({
      ...value,
      analistaId: id === 'none' ? undefined : id,
    })
  }

  function handleToggleRt(colabId: string) {
    const current = new Set(value.rtsIds || [])
    if (current.has(colabId)) {
      current.delete(colabId)
    } else {
      current.add(colabId)
    }
    onChange({
      ...value,
      rtsIds: Array.from(current),
    })
  }

  function handleRemoveRt(colabId: string) {
    onChange({
      ...value,
      rtsIds: (value.rtsIds || []).filter((id) => id !== colabId),
    })
  }

  const rtsSelecionados = useMemo(() => {
    const map = new Map(colaboradores.map((c) => [c.id, c]))
    return (value.rtsIds || [])
      .map((id) => map.get(id))
      .filter((c): c is ColaboradorRecord => Boolean(c))
  }, [colaboradores, value.rtsIds])

  return (
    <div
      className={`rounded-lg border border-orange-200 bg-gradient-to-br from-white via-orange-50/20 to-neutral-50 p-4 space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-orange-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FF6A13] text-white">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-900 tracking-wide uppercase">
              Equipe Técnica do Projeto / Processo
            </h4>
            <p className="text-[11px] text-neutral-500">
              Coordenador (1), Analista (1) e Responsáveis Técnicos - RT (1 ou múltiplos)
            </p>
          </div>
        </div>
      </div>

      <div className={layout === 'compact' ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {/* Coordenador */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-[#FF6A13]" />
            Coordenador do Projeto / Processo
          </Label>
          <Select
            disabled={disabled}
            value={value.coordenadorId || 'none'}
            onValueChange={handleSetCoordenador}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Selecione o Coordenador..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum coordenador atribuído</SelectItem>
              {coordenadoresCandidatos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_completo} ({c.cargo || 'Equipe'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-neutral-400">
            Responsável pelo alinhamento, cronograma e interface com o cliente.
          </p>
        </div>

        {/* Analista */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-600" />
            Analista Técnico Responsável
          </Label>
          <Select
            disabled={disabled}
            value={value.analistaId || 'none'}
            onValueChange={handleSetAnalista}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Selecione o Analista Técnico..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum analista atribuído</SelectItem>
              {analistasCandidatos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_completo} ({c.cargo || 'Analista'}
                  {c.formacao_academica ? ` — ${c.formacao_academica}` : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-neutral-400">
            Execução de plantas, memoriais, levantamentos e análises normativas.
          </p>
        </div>
      </div>

      {/* Responsáveis Técnicos (Multi-seleção 1..N) */}
      <div className="space-y-2 pt-2 border-t border-orange-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <Label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#FF6A13]" />
            Responsáveis Técnicos — RT (CREA / CAU / CFT)
            <Badge variant="secondary" className="ml-1 text-[10px] bg-orange-100 text-[#D65100]">
              {rtsSelecionados.length === 0
                ? 'Nenhum RT'
                : `${rtsSelecionados.length} RT${rtsSelecionados.length > 1 ? 's' : ''}`}
            </Badge>
          </Label>
          <span className="text-[10px] text-neutral-500">
            Todo projeto/processo suporta 1 ou múltiplos RTs simultâneos
          </span>
        </div>

        {/* Seletor dropdown com checkbox popover */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-9 text-xs bg-white border-dashed border-orange-300 hover:border-[#FF6A13] text-neutral-800"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-[#FF6A13]" />
                Adicionar / Alterar Responsáveis Técnicos (RTs)
                <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2 max-h-72 overflow-y-auto" align="start">
              <div className="px-2 py-1.5 text-[11px] font-bold text-neutral-700 border-b border-neutral-100 mb-1">
                Selecione os Responsáveis Técnicos (RTs):
              </div>
              <div className="space-y-1">
                {rtsCandidatos.map((c) => {
                  const isChecked = (value.rtsIds || []).includes(c.id)
                  const reg = formatRegistroRt(c)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleRt(c.id)}
                      className={`w-full flex items-start gap-2 px-2.5 py-1.5 text-left text-xs rounded transition-colors ${
                        isChecked
                          ? 'bg-orange-50 text-orange-950 font-medium'
                          : 'hover:bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked
                            ? 'bg-[#FF6A13] border-[#FF6A13] text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{c.nome_completo}</span>
                          {c.eh_rt && (
                            <Badge className="bg-[#FF6A13] text-white text-[8px] px-1 py-0 h-3.5">
                              RT
                            </Badge>
                          )}
                        </div>
                        {reg && <div className="text-[10px] text-neutral-500 font-mono">{reg}</div>}
                        {c.area_atuacao && (
                          <div className="text-[10px] text-neutral-400 truncate">
                            {c.area_atuacao}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Lista visual de RTs atribuídos */}
        {rtsSelecionados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {rtsSelecionados.map((rt) => {
              const reg = formatRegistroRt(rt)
              return (
                <div
                  key={rt.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-md border border-orange-200 bg-white shadow-2xs"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-[#FF6A13] shrink-0 mt-0.5">
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-neutral-900 truncate">
                          {rt.nome_completo}
                        </span>
                        <Badge className="bg-[#FF6A13] text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                          RT
                        </Badge>
                      </div>
                      {reg && (
                        <div className="text-[11px] font-mono text-neutral-700 font-medium">
                          {reg}
                        </div>
                      )}
                      {rt.formacao_academica && (
                        <div className="text-[10px] text-neutral-500 flex items-center gap-1 truncate">
                          <GraduationCap className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span className="truncate">{rt.formacao_academica}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRt(rt.id)}
                      className="h-6 w-6 text-neutral-400 hover:text-rose-600 shrink-0"
                      title="Remover RT deste projeto/processo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-3 rounded-md bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
            Nenhum Responsável Técnico atribuído ainda. Selecione pelo menos um RT credenciado para
            emissão de ART/RRT e assinatura das peças técnicas.
          </div>
        )}
      </div>
    </div>
  )
}

export function EquipeTecnicaBadgeList({
  coordenador,
  analista,
  rts,
  className = '',
}: {
  coordenador?: ColaboradorRecord | null
  analista?: ColaboradorRecord | null
  rts?: ColaboradorRecord[] | null
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {coordenador && (
          <Badge
            variant="outline"
            className="border-neutral-300 bg-neutral-50 text-neutral-800 text-xs px-2.5 py-1 gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#FF6A13]" />
            <span className="text-neutral-500 font-normal">Coord.:</span>
            <span className="font-semibold">{coordenador.nome_completo}</span>
          </Badge>
        )}

        {analista && (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50/70 text-blue-900 text-xs px-2.5 py-1 gap-1.5"
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-blue-600 font-normal">Analista:</span>
            <span className="font-semibold">{analista.nome_completo}</span>
          </Badge>
        )}
      </div>

      {rts && rts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {rts.map((rt) => {
            const reg = formatRegistroRt(rt)
            return (
              <Badge
                key={rt.id}
                className="bg-orange-50 hover:bg-orange-100 text-[#D65100] border border-orange-200 text-xs px-2 py-0.5 gap-1.5 shadow-2xs font-normal"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#FF6A13]" />
                <span className="font-bold text-neutral-900">{rt.nome_completo}</span>
                {reg && (
                  <span className="font-mono text-[10px] text-neutral-600 bg-white/80 px-1 py-0.2 rounded border border-orange-100">
                    {reg}
                  </span>
                )}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
