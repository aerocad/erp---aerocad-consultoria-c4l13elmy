import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AreaGuard, ProtectedRoute } from '@/components/auth/RouteGuards'
import AppLayout from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AlertasProvider } from '@/contexts/AlertasContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { FinanceiroVisibilidadeProvider } from '@/contexts/FinanceiroVisibilidadeContext'
import ClientDetailPage from '@/pages/ClientDetailPage'
import ClientsPage from '@/pages/ClientsPage'
import DashboardPage from '@/pages/DashboardPage'
import DocumentGeneratorPage from '@/pages/DocumentGeneratorPage'
import DocumentsPage from '@/pages/DocumentsPage'
import FinancePage from '@/pages/FinancePage'
import FornecedoresPage from '@/pages/FornecedoresPage'
import FunnelPage from '@/pages/FunnelPage'
import PessoalPage from '@/pages/PessoalPage'
import ReportsPage from '@/pages/ReportsPage'
import NotFound from '@/pages/NotFound'
import ProcessDetailPage from '@/pages/ProcessDetailPage'
import ProcessesPage from '@/pages/ProcessesPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ImportacaoPage from '@/pages/ImportacaoPage'
import SettingsPage from '@/pages/SettingsPage'
import TerceiroPortalPage from '@/pages/TerceiroPortalPage'
import ConfirmEmailChangePage from '@/pages/auth/ConfirmEmailChangePage'
import LoginPage from '@/pages/auth/LoginPage'
import RecoverPasswordPage from '@/pages/auth/RecoverPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors position="top-right" />
      <AuthProvider>
        <FinanceiroVisibilidadeProvider>
          <AlertasProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verificar-email" element={<VerifyEmailPage />} />
              <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
              <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
              <Route path="/confirmar-troca-email" element={<ConfirmEmailChangePage />} />

              <Route element={<ProtectedRoute />}>
                {/* Rota do Portal exclusivo do terceiro */}
                <Route path="/prestador" element={<TerceiroPortalPage />} />

                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/painel" replace />} />
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
          </AlertasProvider>
        </FinanceiroVisibilidadeProvider>
      </AuthProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
