import { useState } from 'react'
import { SlidersHorizontal, RotateCcw, Eye, EyeOff, Check, Shield, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { FinanceTabKey } from './CentralFinanceiraHub'
import type { TabDefinition } from './FinanceiroAbasConfig'

interface PersonalizarAbasFinanceiroModalProps {
  allowedTabs: readonly TabDefinition[]
  visibleTabs: readonly TabDefinition[]
  visibilityMap: Record<FinanceTabKey, boolean>
  onToggleTab: (tabId: FinanceTabKey) => boolean | void
  onRestoreAll: () => void
  activeTab: FinanceTabKey
}

export function PersonalizarAbasFinanceiroModal({
  allowedTabs,
  visibleTabs,
  visibilityMap,
  onToggleTab,
  onRestoreAll,
  activeTab,
}: PersonalizarAbasFinanceiroModalProps) {
  const [open, setOpen] = useState(false)

  const ocultasCount = allowedTabs.length - visibleTabs.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold text-neutral-700 hover:text-[#D65100] hover:border-[#FF6A13] border-neutral-300 bg-white shadow-2xs"
          title="Personalizar quais abas são exibidas no menu financeiro"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#FF6A13]" />
          <span>Personalizar abas</span>
          {ocultasCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 text-[10px] bg-amber-100 text-amber-900 font-bold border border-amber-200"
            >
              {ocultasCount} oculta{ocultasCount > 1 ? 's' : ''}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0E6] text-[#FF6A13]">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Personalizar Abas Financeiras
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500">
                Escolha quais abas ficam visíveis no menu interno do Financeiro para o seu usuário.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-2 rounded-lg bg-neutral-50 p-3 border border-neutral-200/80 text-xs text-neutral-600 flex items-start gap-2">
          <Shield className="h-4 w-4 text-[#FF6A13] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-neutral-800">Preferência persistida no seu perfil</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Se ocultar a aba ativa no momento, você será automaticamente direcionado a outra aba
              visível. Sua escolha é salva e lembrada neste navegador.
            </p>
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-100">
          {allowedTabs.map((tab) => {
            const isVisible = visibilityMap[tab.id] !== false
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <div
                key={tab.id}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-orange-50/50 border border-orange-200/50' : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                      isVisible
                        ? 'bg-white border-neutral-200 text-[#FF6A13]'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-semibold ${isVisible ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}
                      >
                        {tab.label}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-[#D65100] bg-orange-100 px-1.5 py-0.2 rounded-full">
                          Ativa agora
                        </span>
                      )}
                      {tab.requiresWrite && (
                        <span className="text-[9px] text-neutral-500 bg-neutral-100 px-1.5 py-0.2 rounded">
                          Gestão
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {tab.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => onToggleTab(tab.id)}
                    aria-label={`Exibir aba ${tab.label}`}
                  />
                  {isVisible ? (
                    <Eye className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-neutral-400" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between border-t border-neutral-100 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestoreAll}
            className="text-xs text-neutral-600 hover:text-neutral-900 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5 text-neutral-500" />
            Restaurar todas
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="bg-[#FF6A13] hover:bg-[#E85B06] text-white text-xs font-bold gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
