import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UsersRound,
  Workflow,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import logo from '@/assets/aerocad-logo.svg'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertasDrawer } from '@/components/common/AlertasDrawer'
import { useAlertas } from '@/contexts/AlertasContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFinanceiroVisibilidade } from '@/contexts/FinanceiroVisibilidadeContext'
import { canAccess, roleLabels } from '@/lib/crm'
import { escapeFilter, initials } from '@/lib/format'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'
import type { ClienteRecord, ProcessoRecord, ProjetoRecord } from '@/types/crm'

const navItems = [
  { key: 'painel', label: 'Painel', path: '/painel', icon: CircleGauge },
  { key: 'funil', label: 'Funil', path: '/funil', icon: FolderKanban },
  { key: 'clientes', label: 'Clientes', path: '/clientes', icon: UsersRound },
  { key: 'projetos', label: 'Projetos', path: '/projetos', icon: BriefcaseBusiness },
  { key: 'processos', label: 'Processos', path: '/processos', icon: Workflow },
  { key: 'financeiro', label: 'Financeiro', path: '/financeiro', icon: Banknote },
  { key: 'pessoal', label: 'Pessoal', path: '/pessoal', icon: UsersRound },
  { key: 'fornecedores', label: 'Fornecedores', path: '/fornecedores', icon: BriefcaseBusiness },
  { key: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
  { key: 'documentos', label: 'Documentos', path: '/documentos', icon: FileText },
  { key: 'configuracoes', label: 'Configurações', path: '/configuracoes', icon: Settings },
]

const titleMap: Record<string, string> = {
  painel: 'Painel executivo',
  funil: 'Funil comercial',
  clientes: 'Clientes',
  projetos: 'Projetos',
  processos: 'Processos regulatórios',
  financeiro: 'Financeiro',
  pessoal: 'Pessoal & Colaboradores',
  fornecedores: 'Fornecedores & Terceiros',
  relatorios: 'Relatórios & Indicadores',
  documentos: 'Documentos',
  configuracoes: 'Configurações',
  importacao: 'Importação de Base Histórica',
}

type SearchResult = { id: string; label: string; meta: string; path: string; type: string }

export default function AppLayout() {
  const { user, rawUser, isSimulating, simulatedRole, stopSimulation, logout } = useAuth()
  const { ocultarValores, toggleOcultarValores } = useFinanceiroVisibilidade()
  const {
    alertas,
    dispensados,
    criticosCount,
    atencaoCount,
    urgentesCount,
    drawerOpen,
    setDrawerOpen,
    reload: reloadAlertas,
  } = useAlertas()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const role = user?.role || 'comercial'

  useEffect(() => {
    if (role === 'terceiro' && !location.pathname.startsWith('/prestador')) {
      navigate('/prestador', { replace: true })
    }
  }, [role, location.pathname, navigate])

  const items = useMemo(() => navItems.filter((item) => canAccess(role, item.key)), [role])
  const currentKey = location.pathname.split('/')[1] || 'painel'
  const title = titleMap[currentKey] || 'CRM AEROCAD'

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      setSearching(true)
      const q = escapeFilter(query.trim())
      try {
        const [clients, projects, processes] = await Promise.all([
          pb.collection<ClienteRecord>('clientes').getList(1, 5, {
            filter: `razao_social ~ '${q}' || cnpj_cpf ~ '${q}'`,
            requestKey: null,
          }),
          pb
            .collection<ProjetoRecord>('projetos')
            .getList(1, 5, { filter: `nome ~ '${q}' || numero ~ '${q}'`, requestKey: null }),
          pb
            .collection<ProcessoRecord>('processos')
            .getList(1, 5, { filter: `numero_protocolo ~ '${q}'`, requestKey: null }),
        ])
        setResults([
          ...clients.items.map((record) => ({
            id: record.id,
            label: record.razao_social,
            meta: record.cnpj_cpf,
            path: `/clientes/${record.id}`,
            type: 'Cliente',
          })),
          ...projects.items.map((record) => ({
            id: record.id,
            label: record.nome,
            meta: record.numero,
            path: `/projetos/${record.id}`,
            type: 'Projeto',
          })),
          ...processes.items.map((record) => ({
            id: record.id,
            label: record.numero_protocolo || 'Processo sem protocolo',
            meta: record.orgao,
            path: `/processos/${record.id}`,
            type: 'Processo',
          })),
        ])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  function openResult(result: SearchResult) {
    navigate(result.path)
    setSearchOpen(false)
    setQuery('')
  }

  const avatarUrl = user?.avatar
    ? pb.files.getURL(user, user.avatar, { thumb: '100x100' })
    : undefined

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-[#4B4B4B] text-white">
      <div
        className={cn(
          'flex h-[76px] items-center border-b border-white/10 px-5',
          collapsed && !mobile ? 'justify-center px-2' : 'justify-between',
        )}
      >
        <Link to="/painel" className="flex items-center overflow-hidden">
          {collapsed && !mobile ? (
            <span className="flex h-10 w-10 items-center justify-center border-2 border-[#FF6A13] font-mono text-xl font-black text-[#FF6A13]">
              A
            </span>
          ) : (
            <img src={logo} alt="AEROCAD" className="w-[170px]" />
          )}
        </Link>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {!collapsed || mobile ? (
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Navegação
          </p>
        ) : null}
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/8 hover:text-white',
                  isActive && 'bg-white/10 text-white',
                  collapsed && !mobile && 'justify-center px-2',
                )
              }
              title={collapsed && !mobile ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#FF6A13] transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="relative flex items-center justify-center">
                    <Icon
                      className={cn('h-[19px] w-[19px] shrink-0', isActive && 'text-[#FF6A13]')}
                    />
                    {item.key === 'painel' && urgentesCount > 0 && collapsed && !mobile && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${criticosCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}
                        />
                      </span>
                    )}
                  </div>
                  {(!collapsed || mobile) && <span className="flex-1 truncate">{item.label}</span>}
                  {item.key === 'painel' && urgentesCount > 0 && (!collapsed || mobile) && (
                    <span
                      className={cn(
                        'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight',
                        criticosCount > 0
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-amber-500 text-white',
                      )}
                      title={`${criticosCount} crítico(s), ${atencaoCount} atenção`}
                    >
                      {urgentesCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            'rounded-xl bg-black/15 p-3',
            collapsed && !mobile && 'flex justify-center p-2',
          )}
        >
          <div className={cn('flex items-center gap-3', collapsed && !mobile && 'justify-center')}>
            <Avatar className="h-9 w-9 border border-white/15">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-[#FF6A13] text-xs font-bold text-white">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            {(!collapsed || mobile) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-[11px] text-white/50">{roleLabels[role]}</p>
              </div>
            )}
          </div>
          {(!collapsed || mobile) && (
            <Button
              onClick={logout}
              variant="ghost"
              className="mt-3 h-9 w-full justify-start px-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
      >
        <SidebarContent />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu principal</SheetTitle>
          </SheetHeader>
          <SidebarContent mobile />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-[260px]',
        )}
      >
        {/* Banner de Simulação Ativa de Perfil */}
        {isSimulating && simulatedRole && (
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-amber-300 bg-amber-500/15 px-4 py-2 text-xs backdrop-blur sm:px-6">
            <div className="flex items-center gap-2 text-amber-950 font-medium">
              <span className="flex h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
              <span>
                Visualizando como:{' '}
                <strong className="font-bold text-[#D65100]">{roleLabels[simulatedRole]}</strong>
                <span className="hidden md:inline text-amber-800/80">
                  {' '}
                  — permissão real no banco: Administrador ({rawUser?.name})
                </span>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={stopSimulation}
              className="h-7 border-amber-400 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100 hover:text-black shadow-2xs"
            >
              Sair da simulação
            </Button>
          </div>
        )}

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#DEDEDE] bg-white/95 px-4 backdrop-blur lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div className="min-w-0">
            <p className="technical-label hidden sm:block">CRM · AEROCAD</p>
            <h2 className="truncate text-base font-bold text-[#4B4B4B]">{title}</h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden h-10 w-[260px] justify-start text-[#8A8A8A] md:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Buscar cliente, projeto, processo...
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Toggle de Privacidade / Ocultar Valores Financeiros */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleOcultarValores}
                  className={cn(
                    'relative border-[#DEDEDE] transition-colors',
                    ocultarValores
                      ? 'bg-amber-50/80 text-amber-700 border-amber-300 hover:bg-amber-100 hover:text-amber-800'
                      : 'text-[#555] hover:border-[#FF6A13] hover:text-[#FF6A13]',
                  )}
                  aria-label={ocultarValores ? 'Exibir valores' : 'Ocultar valores'}
                >
                  {ocultarValores ? (
                    <EyeOff className="h-4 w-4 text-amber-700" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{ocultarValores ? 'Exibir valores' : 'Ocultar valores'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Sininho de Notificações / Alertas por Prazo */}
            {role !== 'terceiro' && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDrawerOpen(true)}
                className="relative border-[#DEDEDE] text-[#555] hover:border-[#FF6A13] hover:text-[#FF6A13]"
                title={`Alertas por Prazo (${urgentesCount} urgentes)`}
              >
                <Bell className="h-4 w-4" />
                {urgentesCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-xs',
                      criticosCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500',
                    )}
                  >
                    {urgentesCount > 9 ? '9+' : urgentesCount}
                  </span>
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 bg-[#FF6A13] font-bold text-white hover:bg-[#E85B06]">
                  <Plus className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canAccess(role, 'funil') && (
                  <DropdownMenuItem onSelect={() => navigate('/funil?novo=1')}>
                    Nova oportunidade
                  </DropdownMenuItem>
                )}
                {canAccess(role, 'clientes') && (
                  <DropdownMenuItem onSelect={() => navigate('/clientes?novo=1')}>
                    Novo cliente
                  </DropdownMenuItem>
                )}
                {canAccess(role, 'projetos') && (
                  <DropdownMenuItem onSelect={() => navigate('/projetos?novo=1')}>
                    Novo projeto
                  </DropdownMenuItem>
                )}
                {canAccess(role, 'processos') && (
                  <DropdownMenuItem onSelect={() => navigate('/processos?novo=1')}>
                    Novo processo
                  </DropdownMenuItem>
                )}
                {canAccess(role, 'documentos') && (
                  <DropdownMenuItem onSelect={() => navigate('/documentos/novo')}>
                    Gerar documento
                  </DropdownMenuItem>
                )}
                {role === 'admin' && (
                  <DropdownMenuItem onSelect={() => navigate('/configuracoes/importacao')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-[#FF6A13]" />
                    Importar planilha
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main key={ocultarValores ? 'oculto' : 'visivel'} className="flex-1">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-[#DEDEDE] px-5 py-4 text-center text-xs text-[#8A8A8A]">
          CRM AEROCAD · v1 <span className="mx-2">•</span> Perfil: {roleLabels[role]}
          {isSimulating && (
            <span className="ml-1 text-amber-600 font-semibold">(Modo de Simulação Ativo)</span>
          )}
        </footer>
      </div>

      {/* Drawer Global de Alertas */}
      <AlertasDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        alertas={alertas}
        dispensados={dispensados}
        onReload={reloadAlertas}
      />

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[12%] translate-y-0 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Busca global</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8A8A8A]" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, CNPJ/CPF, número do projeto ou protocolo"
              className="h-11 pl-10"
            />
          </div>
          <div className="max-h-[360px] space-y-1 overflow-y-auto">
            {searching && <p className="py-8 text-center text-sm text-[#737373]">Buscando...</p>}
            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="py-8 text-center text-sm text-[#737373]">Nenhum registro encontrado.</p>
            )}
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => openResult(result)}
                className="flex min-h-14 w-full items-center justify-between rounded-lg border border-transparent px-3 text-left hover:border-[#FFD2B3] hover:bg-[#FFF6EC]"
              >
                <div>
                  <p className="text-sm font-semibold text-[#4B4B4B]">{result.label}</p>
                  <p className="font-mono text-xs text-[#737373]">
                    {result.meta || 'Sem identificação'}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF6A13]">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
