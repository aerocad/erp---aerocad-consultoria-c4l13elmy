import React from 'react'
import { FileSpreadsheet, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '@/components/common/SectionHeader'
import { ImportacaoWizard } from '@/components/importacao/ImportacaoWizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export default function ImportacaoPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="ADMINISTRAÇÃO"
          title="Importação de Base Histórica"
          description="Acesso restrito ao perfil de Administrador."
        />
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-red-500 mb-3" />
            <h3 className="text-base font-bold text-red-800">Acesso Não Autorizado</h3>
            <p className="mt-1 max-w-md text-xs text-red-600">
              Apenas usuários com perfil de <strong>Administrador</strong> têm permissão para
              importar planilhas e atualizar coleções em lote no CRM AEROCAD.
            </p>
            <Button asChild variant="outline" className="mt-4 bg-white" size="sm">
              <Link to="/painel">Voltar ao Painel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Importação de Base Histórica"
        description="Carregamento em lote de planilhas XLSX/CSV com auto-mapeamento, detecção de pendências e prevenção de duplicidades."
      />
      <ImportacaoWizard />
    </div>
  )
}
