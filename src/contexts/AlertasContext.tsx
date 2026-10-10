import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useCrmData } from '@/hooks/use-crm-data'
import { derivarAlertas } from '@/services/alertas'
import type {
  AlertaDispensadoRecord,
  AlertaItem,
  AtividadeRecord,
  ExigenciaRecord,
  OrdemServicoRecord,
  ParcelaRecord,
  ProcessoRecord,
  ProjetoRecord,
  PropostaRecord,
} from '@/types/crm'

interface AlertasContextType {
  alertas: AlertaItem[]
  dispensados: AlertaDispensadoRecord[]
  criticosCount: number
  atencaoCount: number
  urgentesCount: number // critico + atencao
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  reload: () => void
  loading: boolean
}

const AlertasContext = createContext<AlertasContextType | null>(null)

export function AlertasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isTerceiro = user?.role === 'terceiro'

  // Carrega coleções para o motor de alertas apenas se não for terceiro
  const propostas = useCrmData<PropostaRecord>('propostas', {
    realtime: !isTerceiro,
  })
  const exigencias = useCrmData<ExigenciaRecord>('exigencias', {
    expand: 'processo',
    realtime: !isTerceiro,
  })
  const parcelas = useCrmData<ParcelaRecord>('parcelas', {
    expand: 'projeto,cliente',
    realtime: !isTerceiro,
  })
  const ordensServico = useCrmData<OrdemServicoRecord>('ordens_servico', {
    expand: 'projeto,prestador_usuario',
    realtime: !isTerceiro,
  })
  const processos = useCrmData<ProcessoRecord>('processos', {
    expand: 'projeto',
    realtime: !isTerceiro,
  })
  const projetos = useCrmData<ProjetoRecord>('projetos', {
    realtime: !isTerceiro,
  })
  const atividades = useCrmData<AtividadeRecord>('atividades', {
    realtime: !isTerceiro,
  })
  const dispensados = useCrmData<AlertaDispensadoRecord>('alertas_dispensados', {
    filter: user?.id ? `usuario = '${user.id}'` : undefined,
    realtime: !isTerceiro,
  })

  const alertas = useMemo(() => {
    if (isTerceiro || !user) return []
    return derivarAlertas({
      role: user.role,
      userId: user.id,
      propostas: propostas.data,
      exigencias: exigencias.data,
      parcelas: parcelas.data,
      ordensServico: ordensServico.data,
      processos: processos.data,
      projetos: projetos.data,
      atividades: atividades.data,
      dispensados: dispensados.data,
      diasOrgaoSemParecer: 30,
    })
  }, [
    isTerceiro,
    user,
    propostas.data,
    exigencias.data,
    parcelas.data,
    ordensServico.data,
    processos.data,
    projetos.data,
    atividades.data,
    dispensados.data,
  ])

  const criticosCount = useMemo(
    () => alertas.filter((a) => a.severidade === 'critico').length,
    [alertas],
  )
  const atencaoCount = useMemo(
    () => alertas.filter((a) => a.severidade === 'atencao').length,
    [alertas],
  )
  const urgentesCount = criticosCount + atencaoCount

  const reload = () => {
    void propostas.reload()
    void exigencias.reload()
    void parcelas.reload()
    void ordensServico.reload()
    void processos.reload()
    void projetos.reload()
    void atividades.reload()
    void dispensados.reload()
  }

  const loading =
    propostas.loading ||
    exigencias.loading ||
    parcelas.loading ||
    ordensServico.loading ||
    processos.loading ||
    projetos.loading ||
    dispensados.loading

  return (
    <AlertasContext.Provider
      value={{
        alertas,
        dispensados: dispensados.data,
        criticosCount,
        atencaoCount,
        urgentesCount,
        drawerOpen,
        setDrawerOpen,
        reload,
        loading,
      }}
    >
      {children}
    </AlertasContext.Provider>
  )
}

export function useAlertas() {
  const context = useContext(AlertasContext)
  if (!context) {
    throw new Error('useAlertas must be used within an AlertasProvider')
  }
  return context
}
