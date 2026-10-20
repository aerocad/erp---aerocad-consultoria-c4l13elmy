import React from 'react'
import { GripVertical } from 'lucide-react'
import type { ColumnDefinition, DragDropColumnState } from '@/hooks/use-reorderable-columns'

export interface ReorderableTableHeadProps<T = unknown> extends Omit<
  React.ThHTMLAttributes<HTMLTableCellElement>,
  'onDragStart' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd'
> {
  column: ColumnDefinition<T>
  dragState: DragDropColumnState
  onDragStart: (e: React.DragEvent<HTMLElement>, columnId: string) => void
  onDragOver: (e: React.DragEvent<HTMLElement>, columnId: string) => void
  onDragLeave: (e: React.DragEvent<HTMLElement>, columnId: string) => void
  onDrop: (e: React.DragEvent<HTMLElement>, columnId: string) => void
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void
  children?: React.ReactNode
  showGrip?: boolean
  disabled?: boolean
}

/**
 * Componente cabeçalho <th> reordenável com suporte a drag-and-drop HTML5,
 * feedback visual de destaque (#FF6A13), sombra ao arrastar e indicadores de inserção.
 */
export function ReorderableTableHead<T = unknown>({
  column,
  dragState,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  children,
  showGrip = true,
  disabled = false,
  className = '',
  ...thProps
}: ReorderableTableHeadProps<T>) {
  const isDraggable = !disabled && column.draggable !== false
  const isBeingDragged = dragState.draggedColumnId === column.id
  const isDropTarget = dragState.dragOverColumnId === column.id
  const dropPosition = isDropTarget ? dragState.dropPosition : null

  return (
    <th
      {...thProps}
      draggable={isDraggable}
      onDragStart={(e) => isDraggable && onDragStart(e, column.id)}
      onDragOver={(e) => isDraggable && onDragOver(e, column.id)}
      onDragLeave={(e) => isDraggable && onDragLeave(e, column.id)}
      onDrop={(e) => isDraggable && onDrop(e, column.id)}
      onDragEnd={onDragEnd}
      aria-grabbed={isBeingDragged}
      title={isDraggable ? `Arraste para reposicionar a coluna "${column.label}"` : undefined}
      className={`
        relative select-none transition-all duration-150
        ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:bg-orange-50/60' : ''}
        ${
          isBeingDragged
            ? 'opacity-40 bg-orange-100/70 border-dashed border-2 border-[#FF6A13] shadow-inner scale-[0.98]'
            : ''
        }
        ${column.thClassName || ''}
        ${className}
      `}
      style={{
        ...thProps.style,
        ...(isBeingDragged
          ? {
              outline: '2px dashed #FF6A13',
              outlineOffset: '-2px',
            }
          : {}),
      }}
    >
      {/* Indicador visual vertical de inserção (antes ou depois) */}
      {isDropTarget && dropPosition === 'before' && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF6A13] z-20 shadow-[0_0_8px_#FF6A13] animate-pulse pointer-events-none"
          aria-hidden="true"
        >
          <span className="absolute -top-1 -left-[3px] w-2.5 h-2.5 rounded-full bg-[#FF6A13]" />
          <span className="absolute -bottom-1 -left-[3px] w-2.5 h-2.5 rounded-full bg-[#FF6A13]" />
        </span>
      )}

      {isDropTarget && dropPosition === 'after' && (
        <span
          className="absolute right-0 top-0 bottom-0 w-1 bg-[#FF6A13] z-20 shadow-[0_0_8px_#FF6A13] animate-pulse pointer-events-none"
          aria-hidden="true"
        >
          <span className="absolute -top-1 -right-[3px] w-2.5 h-2.5 rounded-full bg-[#FF6A13]" />
          <span className="absolute -bottom-1 -right-[3px] w-2.5 h-2.5 rounded-full bg-[#FF6A13]" />
        </span>
      )}

      <div
        className={`flex items-center gap-1.5 w-full ${
          column.align === 'right'
            ? 'justify-end'
            : column.align === 'center'
              ? 'justify-center'
              : 'justify-start'
        }`}
      >
        {isDraggable && showGrip && (
          <span
            className="text-neutral-400 group-hover:text-[#FF6A13] hover:text-[#FF6A13] p-0.5 -ml-1 rounded transition-colors shrink-0"
            aria-hidden="true"
          >
            <GripVertical className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
          </span>
        )}
        <div className="flex-1 min-w-0">{children ?? column.label}</div>
      </div>
    </th>
  )
}
