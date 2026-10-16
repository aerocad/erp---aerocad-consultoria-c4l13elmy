import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Import target component
import { CapturaRapidaMobileModal } from '@/components/financeiro/CapturaRapidaMobileModal'
import * as comprovantesVision from '@/services/comprovantesVision'
import * as credoresService from '@/services/credores'
import type { CredorRecord } from '@/types/crm'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-test-123', email: 'teste@aerocad.com.br', role: 'financeiro' },
  }),
}))

vi.mock('@/contexts/FinanceiroVisibilidadeContext', () => ({
  useFinanceiroVisibilidade: () => ({
    podeVerValores: true,
    ocultarValores: false,
    alternarVisibilidade: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe('CapturaRapidaMobileModal', () => {
  const mockCredores: CredorRecord[] = [
    {
      id: 'cred-1',
      nome_razao_social: 'Auto Posto Aeroporto Ltda',
      nome: 'Auto Posto Aeroporto',
      cnpj_cpf: '12.345.678/0001-90',
      status: 'ativo',
      tipo_pessoa: 'pj',
      categoria: 'combustivel',
      created: '2026-01-01',
      updated: '2026-01-01',
    } as unknown as CredorRecord,
  ]

  it('permite que o usuário digite o valor manualmente, selecione a data e salve criando conta a pagar', async () => {
    const salvarSpy = vi
      .spyOn(comprovantesVision, 'salvarContaPagarComComprovante')
      .mockResolvedValue({
        id: 'cp-nova-1',
        descricao: 'Despesa rápida - Auto Posto Aeroporto Ltda',
        valor: 154.5,
      } as any)

    const onSuccessMock = vi.fn().mockResolvedValue(undefined)
    const onOpenChangeMock = vi.fn()

    const { container } = render(
      <CapturaRapidaMobileModal
        open={true}
        onOpenChange={onOpenChangeMock}
        credores={mockCredores}
        onSuccess={onSuccessMock}
      />,
    )

    // Simula a captura de uma foto através do input file de câmera
    const file = new File(['mock image content'], 'recibo_posto.jpg', {
      type: 'image/jpeg',
      lastModified: new Date('2026-03-20T12:00:00Z').getTime(),
    })

    const fileInputs = container.querySelectorAll('input[type="file"]')
    expect(fileInputs.length).toBeGreaterThan(0)
    const cameraInput = fileInputs[0]

    fireEvent.change(cameraInput, {
      target: { files: [file] },
    })

    // Campo de valor digitado manualmente
    const inputValor = screen.getByPlaceholderText('0,00')
    fireEvent.change(inputValor, { target: { value: '154.50' } })

    // Data pode ser editada para outra escolhida
    const inputData = container.querySelector('input[type="date"]') as HTMLInputElement
    expect(inputData).not.toBeNull()
    fireEvent.change(inputData, { target: { value: '2026-03-25' } })

    // Botão Salvar
    const btnSalvar = screen.getByRole('button', {
      name: /Salvar Conta a Pagar/i,
    }) as HTMLButtonElement
    expect(btnSalvar.disabled).toBe(false)

    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(salvarSpy).toHaveBeenCalledTimes(1)
    })

    expect(salvarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: 154.5,
        data_vencimento: '2026-03-25',
        arquivoComprovante: file,
      }),
    )

    expect(onSuccessMock).toHaveBeenCalledTimes(1)
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
  })

  it('permite transitar para a Conferência Completa passando o arquivo capturado', async () => {
    const onAbrirConferenciaMock = vi.fn()
    const onOpenChangeMock = vi.fn()

    const { container } = render(
      <CapturaRapidaMobileModal
        open={true}
        onOpenChange={onOpenChangeMock}
        credores={mockCredores}
        onSuccess={vi.fn()}
        onAbrirConferenciaCompleta={onAbrirConferenciaMock}
      />,
    )

    const file = new File(['mock content'], 'cupom.jpg', { type: 'image/jpeg' })
    const fileInputs = container.querySelectorAll('input[type="file"]')
    fireEvent.change(fileInputs[0], { target: { files: [file] } })

    const btnConferencia = screen.getByRole('button', { name: /Conferência completa/i })
    fireEvent.click(btnConferencia)

    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
    expect(onAbrirConferenciaMock).toHaveBeenCalledWith(file)
  })
})
