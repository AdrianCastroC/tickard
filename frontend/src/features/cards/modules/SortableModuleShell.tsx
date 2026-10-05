import { type CSSProperties, type ReactNode } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function SortableModuleShell({ id, disabled, children }: {
  id: number
  disabled?: boolean
  children: (drag?: Record<string, unknown>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`module-shell${isDragging ? ' dragging' : ''}`}>
      {children(disabled ? undefined : { ...attributes, ...listeners })}
    </div>
  )
}
