import React from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  Info,
  Maximize2,
  Minimize2,
  Palette,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TEMAS_DISPONIVEIS, ThemeDefinition, ThemeId, useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export function SimuladorDesignModal() {
  const { theme, setTheme, resetToDefault, isDefaultTheme, simulatorOpen, setSimulatorOpen } =
    useTheme()

  const temaAtivo = TEMAS_DISPONIVEIS.find((t) => t.id === theme) || TEMAS_DISPONIVEIS[0]

  return (
    <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-4xl">
        {/* Cabeçalho do Simulador */}
        <div className="border-b bg-gradient-to-r from-neutral-50 via-white to-orange-50/40 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6A13] to-[#D65100] text-white shadow-md ring-4 ring-orange-100">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900">
                    Simulador de Design AEROCAD
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="border-orange-300 bg-orange-50 text-[10px] font-bold uppercase tracking-wider text-[#D65100]"
                  >
                    100% Reversível
                  </Badge>
                </div>
                <DialogDescription className="mt-1 text-xs text-neutral-600 sm:text-sm">
                  Experimente novas propostas visuais para o CRM em tempo real. Nada se perde e você
                  pode retornar ao design oficial a qualquer momento com um clique.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Banner de status / garantia de reversibilidade */}
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-amber-700" />
              <span>
                Tema ativo agora:{' '}
                <strong className="font-bold text-amber-950">{temaAtivo.nome}</strong>
                {isDefaultTheme ? (
                  <span className="text-amber-700"> (Identidade oficial AEROCAD ativa)</span>
                ) : (
                  <span className="text-amber-700"> — Modo de simulação visual em tempo real</span>
                )}
              </span>
            </div>
            {!isDefaultTheme && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetToDefault}
                className="h-7 shrink-0 border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:text-black shadow-2xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-amber-700" />
                Voltar ao design atual
              </Button>
            )}
          </div>
        </div>

        {/* Grade de Seleção de Temas */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            Selecione uma alternativa visual ({TEMAS_DISPONIVEIS.length} opções pré-definidas):
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {TEMAS_DISPONIVEIS.map((item) => {
              const isSelected = item.id === theme
              return (
                <div
                  key={item.id}
                  onClick={() => setTheme(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setTheme(item.id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF6A13] focus:ring-offset-2',
                    isSelected
                      ? 'border-[#FF6A13] bg-orange-50/20 shadow-md ring-1 ring-[#FF6A13]/20'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm hover:bg-neutral-50/40',
                  )}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-neutral-900">{item.nome}</span>
                        {item.isDefault && (
                          <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-700">
                            Padrão
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                          isSelected
                            ? 'border-[#FF6A13] bg-[#FF6A13] text-white shadow-xs'
                            : 'border-neutral-300 bg-white text-transparent group-hover:border-neutral-400',
                        )}
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <p className="mt-0.5 text-xs font-medium text-neutral-500">{item.subtitulo}</p>

                    <p className="mt-2 text-xs leading-relaxed text-neutral-600 line-clamp-3">
                      {item.descricao}
                    </p>
                  </div>

                  {/* Amostra da Paleta Visual em Miniatura */}
                  <div className="mt-4 pt-3 border-t border-neutral-100">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <span>Amostra de paleta</span>
                      <span className="font-mono lowercase text-[10px]">
                        {item.paleta.primaria}
                      </span>
                    </div>

                    {/* Mini mockup ilustrativo do layout */}
                    <div
                      className="flex h-12 w-full overflow-hidden rounded-lg border shadow-2xs"
                      style={{ borderColor: item.paleta.borda }}
                    >
                      {/* Mini sidebar */}
                      <div
                        className="flex w-9 flex-col items-center justify-center gap-1 p-1 shrink-0"
                        style={{ backgroundColor: item.paleta.sidebar }}
                      >
                        <div
                          className="h-2 w-4 rounded-xs"
                          style={{ backgroundColor: item.paleta.primaria }}
                        />
                        <div className="h-1 w-5 rounded-xs bg-white/30" />
                        <div className="h-1 w-5 rounded-xs bg-white/30" />
                      </div>

                      {/* Mini tela principal */}
                      <div
                        className="flex flex-1 flex-col justify-between p-1.5"
                        style={{ backgroundColor: item.paleta.fundo }}
                      >
                        {/* Mini header */}
                        <div className="flex items-center justify-between">
                          <div className="h-1.5 w-10 rounded-xs bg-neutral-400/40" />
                          <div
                            className="h-2 w-6 rounded-xs"
                            style={{ backgroundColor: item.paleta.primaria }}
                          />
                        </div>
                        {/* Mini card */}
                        <div
                          className="flex items-center justify-between rounded-xs p-1"
                          style={{
                            backgroundColor: item.paleta.card,
                            borderColor: item.paleta.borda,
                            borderWidth: 1,
                          }}
                        >
                          <div className="h-1 w-8 rounded-xs bg-neutral-400/50" />
                          <div
                            className="h-1.5 w-3 rounded-full"
                            style={{ backgroundColor: item.paleta.primaria }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Nota técnica de segurança / dados intactos */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-xs text-neutral-600">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A13]" />
            <div className="space-y-1">
              <p className="font-semibold text-neutral-800">Garantia de Integridade AEROCAD:</p>
              <p>
                A simulação altera exclusivamente variáveis visuais (cores, sidebar, topbar e cards)
                no seu navegador. Relatórios impressos A4 e documentos técnicos mantêm sempre a
                identidade oficial da empresa (Safety Orange #FF6A13 e tipografia técnica).
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <DialogFooter className="border-t bg-neutral-50 p-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Alternância instantânea com 1 clique</span>
          </div>
          <div className="flex items-center gap-2">
            {!isDefaultTheme && (
              <Button variant="outline" size="sm" onClick={resetToDefault} className="text-xs">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restaurar Padrão
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setSimulatorOpen(false)}
              className="bg-[#FF6A13] hover:bg-[#E85B06] text-white font-semibold text-xs"
            >
              Concluir e fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Banner discreto exibido no topo do layout quando um tema diferente do padrão está ativo.
 */
export function ThemeActiveBanner() {
  const { themeConfig, isDefaultTheme, resetToDefault, setSimulatorOpen } = useTheme()

  if (isDefaultTheme) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-1.5 text-xs text-white shadow-sm sm:px-6">
      <div className="flex items-center gap-2.5 truncate">
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-ping" />
        <Palette className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span className="truncate">
          Simulador de Design Ativo:{' '}
          <strong className="font-bold text-white">{themeConfig.nome}</strong>
          <span className="hidden md:inline text-slate-300"> — ({themeConfig.subtitulo})</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSimulatorOpen(true)}
          className="h-6 px-2 text-[11px] text-slate-200 hover:bg-white/10 hover:text-white"
        >
          Trocar tema
        </Button>
        <Button
          size="sm"
          onClick={resetToDefault}
          className="h-6 bg-white text-[11px] font-bold text-slate-900 hover:bg-slate-100 shadow-2xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Voltar ao design atual
        </Button>
      </div>
    </div>
  )
}

/**
 * Botão discreto para acionar o Simulador de Design.
 * Pode ser posicionado na Topbar, no Rodapé ou em Configurações.
 */
export function ThemeSimulatorTrigger({
  variant = 'topbar',
  className,
}: {
  variant?: 'topbar' | 'footer' | 'settings' | 'compact'
  className?: string
}) {
  const { setSimulatorOpen, isDefaultTheme, themeConfig } = useTheme()

  if (variant === 'footer') {
    return (
      <button
        type="button"
        onClick={() => setSimulatorOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800 transition-colors',
          !isDefaultTheme && 'font-semibold text-[#FF6A13]',
          className,
        )}
        title="Abrir o Simulador de Design para experimentar alternativas visuais"
      >
        <Palette className="h-3.5 w-3.5" />
        <span>Design: {isDefaultTheme ? 'Padrão' : themeConfig.nome}</span>
        {!isDefaultTheme && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#FF6A13]" />}
      </button>
    )
  }

  if (variant === 'settings') {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setSimulatorOpen(true)}
        className={cn('gap-2 border-neutral-300 hover:border-[#FF6A13]', className)}
      >
        <Palette className="h-4 w-4 text-[#FF6A13]" />
        <span>Simulador de Design ({themeConfig.nome})</span>
      </Button>
    )
  }

  // Padrão: topbar
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setSimulatorOpen(true)}
      className={cn(
        'relative h-9 gap-1.5 border-[#DEDEDE] px-2.5 text-xs text-[#555] hover:border-[#FF6A13] hover:text-[#FF6A13] transition-colors',
        !isDefaultTheme &&
          'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:text-sky-900',
        className,
      )}
      title="Simulador de Design: experimente temas visuais em tempo real"
      aria-label="Simulador de Design"
    >
      <Palette className={cn('h-4 w-4', !isDefaultTheme ? 'text-sky-600' : 'text-[#555]')} />
      <span className="hidden md:inline font-medium">
        {isDefaultTheme ? 'Simulador de Design' : themeConfig.nome}
      </span>
      {!isDefaultTheme && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
        </span>
      )}
    </Button>
  )
}
