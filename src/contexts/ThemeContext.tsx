import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'padrao' | 'minimalista' | 'escuro' | 'aeroportuario'

export interface ThemeDefinition {
  id: ThemeId
  nome: string
  subtitulo: string
  descricao: string
  destaqueBadge: string
  paleta: {
    primaria: string // Cor hex representativa
    primariaTexto: string
    sidebar: string
    fundo: string
    card: string
    acento: string
    borda: string
  }
  tags: string[]
  isDefault?: boolean
}

export const TEMAS_DISPONIVEIS: ThemeDefinition[] = [
  {
    id: 'padrao',
    nome: 'Atual (Padrão)',
    subtitulo: 'Prancheta Técnica AEROCAD',
    descricao:
      'Identidade oficial de engenharia aeronáutica: Safety Orange #FF6A13, cinza técnico #4B4B4B, fundo com grid de prancheta milimetrada e fontes Arial.',
    destaqueBadge: 'Oficial',
    isDefault: true,
    paleta: {
      primaria: '#FF6A13',
      primariaTexto: '#FFFFFF',
      sidebar: '#4B4B4B',
      fundo: '#F2F2F2',
      card: '#FFFFFF',
      acento: '#FFF6EC',
      borda: '#DEDEDE',
    },
    tags: ['Oficial', 'Prancheta Técnica', 'Safety Orange', 'Grid Milimetrado'],
  },
  {
    id: 'minimalista',
    nome: 'Minimalista Claro',
    subtitulo: 'Claro Neutro & Corporativo',
    descricao:
      'Visual sóbrio, clean e moderno, com base off-white neutra, cinza grafite balanceado, acentos em laranja suave e ausência de ruído visual.',
    destaqueBadge: 'Clean',
    paleta: {
      primaria: '#EA580C',
      primariaTexto: '#FFFFFF',
      sidebar: '#1E293B',
      fundo: '#F8FAFC',
      card: '#FFFFFF',
      acento: '#FFF7ED',
      borda: '#E2E8F0',
    },
    tags: ['Clean', 'Corporativo', 'Neutro', 'Sombras Suaves'],
  },
  {
    id: 'escuro',
    nome: 'Escuro Profissional',
    subtitulo: 'Dark Mode Executivo & Técnico',
    descricao:
      'Modo escuro de alto contraste para operações noturnas e conforto visual prolongado, com superfícies slate/carvão e acentos em laranja brilhante.',
    destaqueBadge: 'Dark Mode',
    paleta: {
      primaria: '#FB923C',
      primariaTexto: '#18181B',
      sidebar: '#0F172A',
      fundo: '#090D16',
      card: '#131B2E',
      acento: '#1E293B',
      borda: '#243048',
    },
    tags: ['Dark Mode', 'Alto Contraste', 'Alta Fidelidade', 'Noturno'],
  },
  {
    id: 'aeroportuario',
    nome: 'Aeroportuário',
    subtitulo: 'Navegação & Sinalização Aeronáutica',
    descricao:
      'Inspirado na sinalização de pistas e aerovias: azul marinho profundo de aviação civil (Runway Navy), verde esmeralda de balizamento e laranja de advertência.',
    destaqueBadge: 'Aviation',
    paleta: {
      primaria: '#0284C7',
      primariaTexto: '#FFFFFF',
      sidebar: '#0B2545',
      fundo: '#EEF4F8',
      card: '#FFFFFF',
      acento: '#E0F2FE',
      borda: '#CBD5E1',
    },
    tags: ['Aeronáutico', 'Runway Navy', 'Radar & Pista', 'Aviação Civil'],
  },
]

interface ThemeContextValue {
  theme: ThemeId
  themeConfig: ThemeDefinition
  setTheme: (id: ThemeId) => void
  resetToDefault: () => void
  isDefaultTheme: boolean
  simulatorOpen: boolean
  setSimulatorOpen: (open: boolean) => void
}

const STORAGE_KEY = 'aerocad_crm_design_theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (
        stored === 'padrao' ||
        stored === 'minimalista' ||
        stored === 'escuro' ||
        stored === 'aeroportuario'
      ) {
        return stored
      }
    } catch {
      // localStorage bloqueado ou indisponível
    }
    return 'padrao'
  })

  const [simulatorOpen, setSimulatorOpen] = useState(false)

  // Aplica a classe do tema no elemento <html> e no <body> para que qualquer seletor funcione
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    // Limpa todas as classes de temas anteriores
    const themeClasses = [
      'theme-padrao',
      'theme-minimalista',
      'theme-escuro',
      'theme-aeroportuario',
    ]
    root.classList.remove(...themeClasses)
    body.classList.remove(...themeClasses)

    // Aplica o tema atual
    const newClass = `theme-${theme}`
    root.classList.add(newClass)
    body.classList.add(newClass)

    // Se o tema for escuro, adiciona também a classe padrão 'dark' do Tailwind
    if (theme === 'escuro') {
      root.classList.add('dark')
      body.classList.add('dark')
    } else {
      root.classList.remove('dark')
      body.classList.remove('dark')
    }

    root.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // ignore
    }
  }

  const resetToDefault = () => {
    setTheme('padrao')
  }

  const themeConfig = useMemo(() => {
    return TEMAS_DISPONIVEIS.find((t) => t.id === theme) || TEMAS_DISPONIVEIS[0]
  }, [theme])

  const isDefaultTheme = theme === 'padrao'

  const value = useMemo(
    () => ({
      theme,
      themeConfig,
      setTheme,
      resetToDefault,
      isDefaultTheme,
      simulatorOpen,
      setSimulatorOpen,
    }),
    [theme, themeConfig, isDefaultTheme, simulatorOpen],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider')
  }
  return context
}
