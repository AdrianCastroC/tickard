import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Avatar } from '../../shared/ui'
import styles from './ProjectCalendarAssigneeFilter.module.css'

export type CalendarAssigneeOption = {
  id: number
  name: string
  avatar_url?: string | null
}

type Props = {
  people: CalendarAssigneeOption[]
  selectedIds: number[]
  includeUnassigned: boolean
  onSelectedIdsChange: (ids: number[]) => void
  onIncludeUnassignedChange: (value: boolean) => void
  currentUserId: number
}

export function ProjectCalendarAssigneeFilter({
  people, selectedIds, includeUnassigned, onSelectedIdsChange,
  onIncludeUnassignedChange, currentUserId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filterId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const hasSelection = selectedIds.length > 0 || includeUnassigned
  const selectedPeople = useMemo(() => {
    const index = new Map<number, CalendarAssigneeOption>(people.map((person) => [person.id, person]))
    return selectedIds.map((id) => index.get(id)).filter((person): person is CalendarAssigneeOption => !!person)
  }, [people, selectedIds])
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return people.filter((person) => person.name.toLocaleLowerCase('es').includes(term))
  }, [people, search])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setSearch('')
  }, [open])

  function toggleUser(id: number) {
    onSelectedIdsChange(selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id])
  }

  function clearSelection() {
    onSelectedIdsChange([])
    onIncludeUnassignedChange(false)
  }

  function selectMe() {
    onSelectedIdsChange([currentUserId])
    onIncludeUnassignedChange(false)
  }

  return <div className={styles.root} ref={rootRef}>
    <button type="button" className={[styles.trigger, hasSelection ? styles.triggerActive : ''].filter(Boolean).join(' ')}
      aria-expanded={open} aria-controls={filterId} aria-haspopup="true"
      onClick={() => setOpen((previous) => !previous)}>
      <span className={styles.triggerTitle}>Usuarios</span>
      {hasSelection ? <span className={styles.selectedPreview}>
        {selectedPeople.slice(0, 3).map((person) =>
          <Avatar key={person.id} id={person.id} name={person.name} src={person.avatar_url}
            size={20} className={styles.previewAvatar} />)}
        <span>{selectedIds.length + Number(includeUnassigned)} seleccionado{selectedIds.length + Number(includeUnassigned) === 1 ? '' : 's'}</span>
      </span> : <span className={styles.allLabel}>Todos</span>}
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </button>
    {open && <div className={styles.popup} id={filterId}>
      <div className={styles.popupHeader}>
        <strong>Filtrar por asignados</strong>
        <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Cerrar filtro">×</button>
      </div>
      <input ref={searchRef} type="search" className={styles.search} value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar usuarios…" aria-label="Buscar usuarios" />
      <div className={styles.quickActions}>
        <button type="button" onClick={clearSelection}>Todos</button>
        <button type="button" onClick={selectMe}>Solo yo</button>
      </div>
      <div className={styles.results} role="group" aria-label="Usuarios asignados">
        {results.map((person) => <label className={styles.option} key={person.id}>
          <Avatar id={person.id} name={person.name} size={28} src={person.avatar_url}
            className={styles.avatar} />
          <span className={styles.personName}>{person.name}</span>
          <input type="checkbox" checked={selectedIds.includes(person.id)}
            onChange={() => toggleUser(person.id)} aria-label={'Filtrar por ' + person.name} />
        </label>)}
        {!results.length && <p className={styles.empty}>No se encontraron usuarios.</p>}
      </div>
      <label className={styles.unassigned}>
        <span>Sin asignar</span>
        <input type="checkbox" checked={includeUnassigned}
          onChange={(event) => onIncludeUnassignedChange(event.target.checked)} />
      </label>
      <div className={styles.footer}>
        <span>{!hasSelection ? 'Mostrando todas las tareas' : 'Filtro aplicado'}</span>
        <button type="button" onClick={() => setOpen(false)}>Aplicar</button>
      </div>
    </div>}
  </div>
}
