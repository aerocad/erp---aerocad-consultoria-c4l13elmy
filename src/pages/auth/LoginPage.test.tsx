import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

const mockLogin = vi.fn()
const mockUser = null

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    login: mockLogin,
  }),
}))

describe('LoginPage - persistência do último e-mail de acesso', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('inicia com o campo de e-mail vazio quando não há nada no localStorage nem no location.state', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail profissional/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^Senha$/i) as HTMLInputElement

    expect(emailInput.value).toBe('')
    expect(passwordInput.value).toBe('')
  })

  it('preenche automaticamente o e-mail quando salvo no localStorage, mantendo a senha vazia', () => {
    localStorage.setItem('aerocad_last_login_email', 'eng.silva@aerocad.com.br')

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail profissional/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/^Senha$/i) as HTMLInputElement

    expect(emailInput.value).toBe('eng.silva@aerocad.com.br')
    expect(passwordInput.value).toBe('')
  })

  it('prioriza email passado via location.state sobre o localStorage se houver', () => {
    localStorage.setItem('aerocad_last_login_email', 'antigo@aerocad.com.br')

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { email: 'novo@aerocad.com.br' } }]}
      >
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail profissional/i) as HTMLInputElement
    expect(emailInput.value).toBe('novo@aerocad.com.br')
  })

  it('salva o novo e-mail no localStorage após login com sucesso', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'usr123',
      email: 'novo.usuario@aerocad.com.br',
      role: 'engenheiro',
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    const emailInput = screen.getByLabelText(/E-mail profissional/i)
    const passwordInput = screen.getByLabelText(/^Senha$/i)
    const submitBtn = screen.getByRole('button', { name: /Entrar no CRM/i })

    fireEvent.change(emailInput, { target: { value: '  novo.usuario@aerocad.com.br  ' } })
    fireEvent.change(passwordInput, { target: { value: 'senha123' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('novo.usuario@aerocad.com.br', 'senha123')
      expect(localStorage.getItem('aerocad_last_login_email')).toBe('novo.usuario@aerocad.com.br')
    })
  })
})
