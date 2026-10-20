import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReorderableColumns, type ColumnDefinition } from './use-reorderable-columns'

describe('useReorderableColumns', () => {
  const mockColumns: ColumnDefinition[] = [
    { id: 'col1', label: 'Coluna 1' },
    { id: 'col2', label: 'Coluna 2' },
    { id: 'col3', label: 'Coluna 3' },
    { id: 'acoes', label: 'Ações', draggable: false },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('inicia com a ordem padrão das colunas', () => {
    const { result } = renderHook(() =>
      useReorderableColumns({
        tableKey: 'test_table',
        columns: mockColumns,
      }),
    )

    expect(result.current.columnOrder).toEqual(['col1', 'col2', 'col3', 'acoes'])
    expect(result.current.isCustomOrder).toBe(false)
  })

  it('permite reordenar colunas livremente e persiste no localStorage', () => {
    const { result } = renderHook(() =>
      useReorderableColumns({
        tableKey: 'test_table',
        columns: mockColumns,
        userId: 'user123',
      }),
    )

    act(() => {
      // Mover col3 para antes de col1
      result.current.moveColumn('col3', 'col1', 'before')
    })

    expect(result.current.columnOrder).toEqual(['col3', 'col1', 'col2', 'acoes'])
    expect(result.current.isCustomOrder).toBe(true)

    // Verifica persistência no localStorage com userId
    const saved = localStorage.getItem('aerocad_table_columns_order_test_table_user123')
    expect(saved).toBeTruthy()
    expect(JSON.parse(saved!)).toEqual(['col3', 'col1', 'col2', 'acoes'])
  })

  it('mantém a coluna de ações pinada ao final se pinLastActionColumn for true', () => {
    const { result } = renderHook(() =>
      useReorderableColumns({
        tableKey: 'test_table',
        columns: mockColumns,
        pinLastActionColumn: true,
      }),
    )

    act(() => {
      // Tentar mover col1 para depois de acoes
      result.current.moveColumn('col1', 'acoes', 'after')
    })

    // Coluna acoes não pode ser ultrapassada (permanece ao final)
    expect(result.current.columnOrder[result.current.columnOrder.length - 1]).toBe('acoes')
  })

  it('restaura a ordem padrão através de resetOrder()', () => {
    const { result } = renderHook(() =>
      useReorderableColumns({
        tableKey: 'test_table',
        columns: mockColumns,
        userId: 'user123',
      }),
    )

    act(() => {
      result.current.moveColumn('col2', 'col1', 'before')
    })
    expect(result.current.isCustomOrder).toBe(true)

    act(() => {
      result.current.resetOrder()
    })

    expect(result.current.columnOrder).toEqual(['col1', 'col2', 'col3', 'acoes'])
    expect(result.current.isCustomOrder).toBe(false)
    expect(localStorage.getItem('aerocad_table_columns_order_test_table_user123')).toBeNull()
  })

  it('sanitiza colunas removidas ou novas adicionadas', () => {
    // Salva uma ordem com coluna antiga obsoleta 'col_antiga' e sem 'col3'
    localStorage.setItem(
      'aerocad_table_columns_order_test_table',
      JSON.stringify(['col2', 'col_antiga', 'col1', 'acoes']),
    )

    const { result } = renderHook(() =>
      useReorderableColumns({
        tableKey: 'test_table',
        columns: mockColumns,
      }),
    )

    // 'col_antiga' deve ser descartada e 'col3' incluída antes de 'acoes'
    expect(result.current.columnOrder).toContain('col3')
    expect(result.current.columnOrder).not.toContain('col_antiga')
    expect(result.current.columnOrder[result.current.columnOrder.length - 1]).toBe('acoes')
  })
})
