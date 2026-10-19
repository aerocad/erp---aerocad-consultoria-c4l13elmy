import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AreaGuard, ProtectedRoute } from '@/components/auth/RouteGuards'
import { PrimeiroAcessoModal } from '@/components/auth/PrimeiroAcessoModal'
import AppLayout from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AlertasProvider } from '@/contexts/AlertasContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { FinanceiroVisibilidadeProvider } from '@/contexts/FinanceiroVisibilidadeContext'
import { MensagensProvider } from '@/contexts/MensagensContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { lazy, Suspense } from 'react'

import { PageLoading } from '@/components/common/States'

import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/auth/LoginPage'

const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage'))
const ClientsPage = lazy(() => import('@/pages/ClientsPage'))
const DocumentGeneratorPage = lazy(() => import('@/pages/DocumentGeneratorPage'))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const FinancePage = lazy(() => import('@/pages/FinancePage'))
const FinanceiroModuloFocoPage = lazy(() => import('@/pages/FinanceiroModuloFocoPage'))
const FornecedoresPage = lazy(() => import('@/pages/FornecedoresPage'))
const FunnelPage = lazy(() => import('@/pages/FunnelPage'))
const PessoalPage = lazy(() => import('@/pages/PessoalPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const ProcessDetailPage = lazy(() => import('@/pages/ProcessDetailPage'))
const ProcessesPage = lazy(() => import('@/pages/ProcessesPage'))
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'))
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const ImportacaoPage = lazy(() => import('@/pages/ImportacaoPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const MensagensPage = lazy(() => import('@/pages/MensagensPage'))
const TerceiroPortalPage = lazy(() => import('@/pages/TerceiroPortalPage'))
const ConfirmEmailChangePage = lazy(() => import('@/pages/auth/ConfirmEmailChangePage'))
const RecoverPasswordPage = lazy(() => import('@/pages/auth/RecoverPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'))

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors position="top-right" />
      <ThemeProvider>
        <AuthProvider>
          <MensagensProvider>
            <FinanceiroVisibilidadeProvider>
              <AlertasProvider>
                <PrimeiroAcessoModal />
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/verificar-email" element={<VerifyEmailPage />} />
                    <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
                    <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                    <Route path="/confirmar-troca-email" element={<ConfirmEmailChangePage />} />

                    <Route element={<ProtectedRoute />}>
                      {/* Rota do Portal exclusivo do terceiro */}
                      <Route path="/prestador" element={<TerceiroPortalPage />} />

                      {/* Rotas de Módulos Isolados em Modo Foco (2º Monitor) - SEM layout, protegidas */}
                      <Route element={<AreaGuard area="financeiro" />}>
                        <Route
                          path="/financeiro/modulo/:modulo"
                          element={<FinanceiroModuloFocoPage />}
                        />
                      </Route>

                      <Route element={<AppLayout />}>
                        <Route path="/" element={<Navigate to="/painel" replace />} />
                        <Route path="/mensagens" element={<MensagensPage />} />
                        <Route element={<AreaGuard area="painel" />}>
                          <Route path="/painel" element={<DashboardPage />} />
                        </Route>
                        <Route element={<AreaGuard area="funil" />}>
                          <Route path="/funil" element={<FunnelPage />} />
                        </Route>
                        <Route element={<AreaGuard area="clientes" />}>
                          <Route path="/clientes" element={<ClientsPage />} />
                          <Route path="/clientes/:id" element={<ClientDetailPage />} />
                        </Route>
                        <Route element={<AreaGuard area="projetos" />}>
                          <Route path="/projetos" element={<ProjectsPage />} />
                          <Route path="/projetos/:id" element={<ProjectDetailPage />} />
                        </Route>
                        <Route element={<AreaGuard area="processos" />}>
                          <Route path="/processos" element={<ProcessesPage />} />
                          <Route path="/processos/:id" element={<ProcessDetailPage />} />
                        </Route>
                        <Route element={<AreaGuard area="financeiro" />}>
                          <Route path="/financeiro" element={<FinancePage />} />
                        </Route>
                        <Route element={<AreaGuard area="pessoal" />}>
                          <Route path="/pessoal" element={<PessoalPage />} />
                        </Route>
                        <Route element={<AreaGuard area="fornecedores" />}>
                          <Route path="/fornecedores" element={<FornecedoresPage />} />
                        </Route>
                        <Route element={<AreaGuard area="relatorios" />}>
                          <Route path="/relatorios" element={<ReportsPage />} />
                        </Route>
                        <Route element={<AreaGuard area="documentos" />}>
                          <Route path="/documentos" element={<DocumentsPage />} />
                          <Route path="/documentos/novo" element={<DocumentGeneratorPage />} />
                        </Route>
                        <Route element={<AreaGuard area="configuracoes" />}>
                          <Route path="/configuracoes" element={<SettingsPage />} />
                          <Route path="/configuracoes/importacao" element={<ImportacaoPage />} />
                        </Route>
                      </Route>
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AlertasProvider>
            </FinanceiroVisibilidadeProvider>
          </MensagensProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
