import { useEffect, useId, useRef, useState } from 'react'
import styles from './ProjectCalendar.module.css'

type Choice<T extends string | number> = { value: T; label: string; color?: string }

export function ProjectCalendarMultiFilter<T extends string | number>({
  label, options, hidden, onHiddenChange,
}: {
  label: string
  options: Choice<T>[]
  hidden: T[]
  onHiddenChange: (values: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const visibleCount = options.filter((option) => !hidden.includes(option.value)).length
  const summary = hidden.length === 0 ? 'Todos' : visibleCount === 0 ? 'Ninguno' : `${visibleCount} de ${options.length}`

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function toggle(value: T) {
    onHiddenChange(hidden.includes(value) ? hidden.filter((item) => item !== value) : [...hidden, value])
  }

  return (
    <div className={styles.multiFilter} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.multiFilterTrigger}${hidden.length > 0 ? ' ' + styles.multiFilterActive : ''}`}
        aria-label={`Filtrar por ${label.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={selectId}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{summary}</span>
        <span className={styles.multiFilterChevron} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={selectId} className={styles.multiFilterMenu} role="group" aria-label={label}>
          <div className={styles.multiFilterMenuHeader}>
            <strong>{label}</strong>
            <button type="button" disabled={hidden.length === 0} onClick={() => onHiddenChange([])}>Todos</button>
          </div>
          <div className={styles.multiFilterOptions}>
            {options.map((option) => (
              <label key={option.value} className={styles.multiFilterOption}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                {option.color && <i className={styles.statusDot} style={{ background: option.color }} aria-hidden="true" />}
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
