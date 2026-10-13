import React, { createContext, useContext, useEffect } from 'react'

export type ThemeId = 'padrao'

export interface ThemeDefinition {
  id: ThemeId
  nome: string
  subtitulo: string
  descricao: string
  destaqueBadge: string
  paleta: {
    primaria: string
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

export const TEMA_PADRAO: ThemeDefinition = {
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
}

// Mantido apenas para compatibilidade de tipos se necessário
export const TEMAS_DISPONIVEIS: ThemeDefinition[] = [TEMA_PADRAO]

interface ThemeContextValue {
  theme: ThemeId
  themeConfig: ThemeDefinition
  isDefaultTheme: boolean
}

const STORAGE_KEY = 'aerocad_crm_design_theme'

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'padrao',
  themeConfig: TEMA_PADRAO,
  isDefaultTheme: true,
})

/**
 * Provider simplificado e estático: garante que o design oficial AEROCAD seja o único
 * aplicado, limpando qualquer preferência prévia residual do localStorage e forçando
 * as classes oficiais no documento.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Limpa qualquer preferência residual de tema salva durante testes anteriores
    try {
      localStorage.removeItem(STORAGE_KEY)
      // Limpa qualquer outra chave relacionada caso tenha sido usada
      localStorage.removeItem('aerocad_theme')
      localStorage.removeItem('theme')
    } catch {
      // Ignora erro se localStorage indisponível
    }

    // 2. Remove classes residuais dos temas alternativos e 'dark' do elemento <html> e <body>
    const root = document.documentElement
    const body = document.body

    const themeClasses = [
      'theme-padrao',
      'theme-minimalista',
      'theme-escuro',
      'theme-aeroportuario',
      'dark',
    ]
    root.classList.remove(...themeClasses)
    body.classList.remove(...themeClasses)

    // 3. Aplica estritamente a identidade oficial AEROCAD
    root.classList.add('theme-padrao')
    body.classList.add('theme-padrao')
    root.setAttribute('data-theme', 'padrao')
  }, [])

  const value: ThemeContextValue = {
    theme: 'padrao',
    themeConfig: TEMA_PADRAO,
    isDefaultTheme: true,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
