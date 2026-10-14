import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../shared/icons'
import { Filters } from '../board'

type Position = { top: number; left: number }
type Props = React.ComponentProps<typeof Filters> & {
  open: boolean
  active: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onClear: () => void
}

export function FiltersBar({ open, active, anchorRef, onClose, onClear, ...props }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const reposition = () => {
      const anchor = anchorRef.current
      const popover = popoverRef.current
      if (!anchor || !popover) return

      const rect = anchor.getBoundingClientRect()
      const width = popover.offsetWidth
      const height = popover.offsetHeight
      const gap = 8
      const margin = 12
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin))
      const below = rect.bottom + gap
      const above = rect.top - height - gap
      const top = below + height > window.innerHeight - margin && above >= margin
        ? above
        : Math.max(margin, Math.min(below, window.innerHeight - height - margin))

      setPosition((current) => current?.top === top && current?.left === left ? current : { top, left })
    }

    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    const observer = new ResizeObserver(reposition)
    if (popoverRef.current) observer.observe(popoverRef.current)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      observer.disconnect()
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return

    const handleOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (anchorRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return
      onClose()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      anchorRef.current?.focus()
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, anchorRef, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      id="board-filters-popover"
      className="board-filters-popover"
      role="dialog"
      aria-labelledby="board-filters-title"
      style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      <div className="board-filters-popover-head">
        <strong id="board-filters-title">Filtros</strong>
        <button type="button" className="icon-close" aria-label="Cerrar filtros" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <Filters {...props} />
      <div className="board-filters-popover-foot">
        <button type="button" className="ghost" disabled={!active} onClick={onClear}>
          Limpiar filtros
        </button>
      </div>
    </div>,
    document.body,
  )
}
