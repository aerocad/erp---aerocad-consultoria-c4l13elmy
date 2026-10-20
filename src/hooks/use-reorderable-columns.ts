import { useState, useEffect, useCallback, useMemo } from 'react'

export interface ColumnDefinition<T = unknown> {
  id: string
  label: string
  /** Se false, a coluna não pode ser movida (ex: coluna fixa de ações) */
  draggable?: boolean
  /** Se a coluna pode ser ocultada/visível (default: true) */
  hideable?: boolean
  /** Alinhamento do conteúdo: left | center | right */
  align?: 'left' | 'center' | 'right'
  /** Classes CSS padrão para o cabeçalho <th> */
  thClassName?: string
  /** Classes CSS padrão para a célula <td> */
  tdClassName?: string
  /** Tooltip ou dica opcional para o usuário */
  description?: string
  /** Metadado customizado */
  meta?: T
}

export interface UseReorderableColumnsOptions<T = unknown> {
  /** Identificador único da tabela (ex: 'contas_pagar') para persistência */
  tableKey: string
  /** Lista ordenada padrão de definições das colunas */
  columns: ColumnDefinition<T>[]
  /** ID do usuário atual para isolar o localStorage (opcional) */
  userId?: string | null
  /** Se a última coluna (ex: 'acoes') deve ser sempre fixada ao final (default: true) */
  pinLastActionColumn?: boolean
  /** Callback opcional quando a ordem mudar */
  onOrderChange?: (newOrder: string[]) => void
}

export interface DragDropColumnState {
  draggedColumnId: string | null
  dragOverColumnId: string | null
  dropPosition: 'before' | 'after' | null
}

const STORAGE_PREFIX = 'aerocad_table_columns_order_'

export function useReorderableColumns<T = unknown>({
  tableKey,
  columns,
  userId,
  pinLastActionColumn = true,
  onOrderChange,
}: UseReorderableColumnsOptions<T>) {
  // Lista dos IDs originais
  const defaultOrder = useMemo(() => columns.map((col) => col.id), [columns])

  const storageKey = useMemo(() => {
    const userSuffix = userId ? `_${userId}` : ''
    return `${STORAGE_PREFIX}${tableKey}${userSuffix}`
  }, [tableKey, userId])

  // Função para higienizar e validar uma ordem carregada contra as colunas existentes
  const sanitizeOrder = useCallback(
    (savedIds: unknown): string[] => {
      if (!Array.isArray(savedIds)) return defaultOrder

      // Mantém apenas os IDs que realmente existem hoje na definição
      const validSaved = savedIds.filter(
        (id): id is string => typeof id === 'string' && defaultOrder.includes(id),
      )

      // Adiciona quaisquer novas colunas que não estavam salvas
      const missing = defaultOrder.filter((id) => !validSaved.includes(id))
      let combined = [...validSaved, ...missing]

      // Se pinLastActionColumn estiver ativo e 'acoes' existir na tabela, garante que fica na última posição
      if (pinLastActionColumn && combined.includes('acoes')) {
        combined = combined.filter((id) => id !== 'acoes')
        combined.push('acoes')
      }

      return combined
    },
    [defaultOrder, pinLastActionColumn],
  )

  // Estado da ordem atual dos IDs de coluna
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return sanitizeOrder(parsed)
      }
    } catch (err) {
      console.warn(`[useReorderableColumns] Falha ao carregar ordem de ${storageKey}:`, err)
    }
    return defaultOrder
  })

  // Sincroniza se novas colunas forem adicionadas/removidas das definições
  useEffect(() => {
    setColumnOrder((prev) => sanitizeOrder(prev))
  }, [sanitizeOrder])

  // Estado do drag-and-drop
  const [dragState, setDragState] = useState<DragDropColumnState>({
    draggedColumnId: null,
    dragOverColumnId: null,
    dropPosition: null,
  })

  // Salvar no localStorage sempre que mudar
  const persistOrder = useCallback(
    (newOrder: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder))
      } catch (err) {
        console.warn(`[useReorderableColumns] Erro ao salvar ordem de ${storageKey}:`, err)
      }
      onOrderChange?.(newOrder)
    },
    [storageKey, onOrderChange],
  )

  // Move coluna de uma posição para outra
  const moveColumn = useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after' = 'before') => {
      if (!sourceId || !targetId || sourceId === targetId) return

      // Não permitir mover se a coluna for não-arrastável
      const sourceDef = columns.find((c) => c.id === sourceId)
      const targetDef = columns.find((c) => c.id === targetId)
      if (sourceDef?.draggable === false || targetDef?.draggable === false) return

      setColumnOrder((prev) => {
        const list = [...prev]
        const sourceIndex = list.indexOf(sourceId)
        if (sourceIndex === -1) return prev

        // Remove source
        list.splice(sourceIndex, 1)

        let targetIndex = list.indexOf(targetId)
        if (targetIndex === -1) return prev

        if (position === 'after') {
          targetIndex += 1
        }

        list.splice(targetIndex, 0, sourceId)

        // Se pinLastActionColumn, garante 'acoes' no fim
        let finalList = list
        if (pinLastActionColumn && finalList.includes('acoes')) {
          finalList = finalList.filter((id) => id !== 'acoes')
          finalList.push('acoes')
        }

        persistOrder(finalList)
        return finalList
      })
    },
    [columns, pinLastActionColumn, persistOrder],
  )

  // Restaurar ordem padrão
  const resetOrder = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch (err) {
      console.warn(`[useReorderableColumns] Erro ao resetar ordem:`, err)
    }
    setColumnOrder(defaultOrder)
    onOrderChange?.(defaultOrder)
  }, [storageKey, defaultOrder, onOrderChange])

  // Verifica se a ordem atual é diferente da padrão
  const isCustomOrder = useMemo(() => {
    if (columnOrder.length !== defaultOrder.length) return true
    return columnOrder.some((id, idx) => id !== defaultOrder[idx])
  }, [columnOrder, defaultOrder])

  // Colunas ordenadas completas com suas definições
  const orderedColumns = useMemo(() => {
    const map = new Map(columns.map((c) => [c.id, c]))
    const result: ColumnDefinition<T>[] = []

    for (const id of columnOrder) {
      const def = map.get(id)
      if (def) {
        result.push(def)
      }
    }

    // Colunas restantes não listadas no columnOrder
    for (const c of columns) {
      if (!columnOrder.includes(c.id)) {
        result.push(c)
      }
    }

    return result
  }, [columns, columnOrder])

  // Handlers para o HTML5 Drag and Drop nos cabeçalhos
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, columnId: string) => {
      const colDef = columns.find((c) => c.id === columnId)
      if (colDef?.draggable === false) {
        e.preventDefault()
        return
      }

      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', columnId)
      e.dataTransfer.setData('application/x-crm-column-id', columnId)

      setDragState({
        draggedColumnId: columnId,
        dragOverColumnId: null,
        dropPosition: null,
      })
    },
    [columns],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>, targetColumnId: string) => {
      if (!dragState.draggedColumnId) return
      if (dragState.draggedColumnId === targetColumnId) {
        e.preventDefault()
        return
      }

      const targetDef = columns.find((c) => c.id === targetColumnId)
      if (targetDef?.draggable === false) return

      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      // Determina se solta antes ou depois dependendo da posição do mouse no cabeçalho
      const rect = e.currentTarget.getBoundingClientRect()
      const midpoint = rect.left + rect.width / 2
      const pos: 'before' | 'after' = e.clientX < midpoint ? 'before' : 'after'

      if (dragState.dragOverColumnId !== targetColumnId || dragState.dropPosition !== pos) {
        setDragState((prev) => ({
          ...prev,
          dragOverColumnId: targetColumnId,
          dropPosition: pos,
        }))
      }
    },
    [dragState.draggedColumnId, dragState.dragOverColumnId, dragState.dropPosition, columns],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>, targetColumnId: string) => {
      // Ignora se estiver saindo para um filho do elemento
      const related = e.relatedTarget as Node | null
      if (related && e.currentTarget.contains(related)) {
        return
      }
      if (dragState.dragOverColumnId === targetColumnId) {
        setDragState((prev) => ({
          ...prev,
          dragOverColumnId: null,
          dropPosition: null,
        }))
      }
    },
    [dragState.dragOverColumnId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, targetColumnId: string) => {
      e.preventDefault()
      const sourceId =
        e.dataTransfer.getData('application/x-crm-column-id') ||
        e.dataTransfer.getData('text/plain') ||
        dragState.draggedColumnId

      const position = dragState.dropPosition || 'before'

      setDragState({
        draggedColumnId: null,
        dragOverColumnId: null,
        dropPosition: null,
      })

      if (sourceId && targetColumnId && sourceId !== targetColumnId) {
        moveColumn(sourceId, targetColumnId, position)
      }
    },
    [dragState.draggedColumnId, dragState.dropPosition, moveColumn],
  )

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggedColumnId: null,
      dragOverColumnId: null,
      dropPosition: null,
    })
  }, [])

  return {
    columnOrder,
    orderedColumns,
    dragState,
    isCustomOrder,
    moveColumn,
    resetOrder,
    dragHandlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
    },
  }
}
