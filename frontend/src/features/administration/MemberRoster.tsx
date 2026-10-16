import { useEffect, useState } from 'react'
import { Avatar } from '../../shared/ui'
import styles from './DepartmentsDashboard.module.css'

type Person = { id: number; name: string; avatar_url: string | null }

export function MemberRoster({
  entityId, current, available, leadId, canManage, busy, onSave,
}: {
  entityId: number
  current: Person[]; available: Person[]
  leadId: number | null; canManage: boolean; busy: boolean
  onSave: (memberIds: number[], responsibleId: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [toAdd, setToAdd] = useState<number[]>([])
  const [toRemove, setToRemove] = useState<number[]>([])
  const [nextLead, setNextLead] = useState<number | null>(leadId)
  const [error, setError] = useState('')
  const ids = current.map(person => person.id)
  const candidates = available.filter(person => !ids.includes(person.id))
  const removable = current.filter(person => person.id !== nextLead).map(person => person.id)
  const allRemovableSelected = removable.length > 0 && removable.every(id => toRemove.includes(id))
  const allCandidatesSelected = candidates.length > 0 && candidates.every(person => toAdd.includes(person.id))

  useEffect(() => {
    setOpen(false); setToAdd([]); setToRemove([]); setNextLead(leadId); setError('')
  }, [entityId, leadId, current.length])

  async function persist(members: number[], responsible: number | null) {
    if (responsible === null || !members.includes(responsible)) {
      setError('Debe haber un responsable entre los miembros. Cambia el responsable antes de eliminarlo.')
      return
    }
    setError('')
    try {
      await onSave(members, responsible)
      setToAdd([]); setToRemove([]); setOpen(false); setNextLead(responsible)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron modificar los miembros.') }
  }

  return <div className={styles.roster}>
    {canManage && <div className={styles.rosterLead}>
      <label className={styles.field}>Responsable
        <select value={nextLead ?? ''} disabled={busy} onChange={event => {
          setNextLead(event.target.value ? Number(event.target.value) : null)
          setToRemove([])
        }}>
          <option value="">Seleccionar responsable</option>
          {current.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      {nextLead !== leadId && <button type="button" className={styles.editSmall}
        disabled={busy || !nextLead} onClick={() => void persist(ids, nextLead)}>
        Guardar responsable
      </button>}
    </div>}
    <div className={styles.rosterSectionHeader}>
      {canManage ? <label className={styles.rosterSelectAll} title="Seleccionar todos los miembros que se pueden quitar">
        <input type="checkbox" aria-label="Seleccionar todos los miembros que se pueden quitar"
          disabled={busy || !removable.length} checked={allRemovableSelected}
          onChange={event => setToRemove(event.target.checked ? removable : [])}/>
        <strong>Miembros ({current.length})</strong>
      </label> : <strong>Miembros ({current.length})</strong>}
      {canManage && toRemove.length > 0 && <button className={styles.dangerLink}
        type="button" disabled={busy}
        onClick={() => void persist(ids.filter(id => !toRemove.includes(id)), nextLead)}>
        Quitar seleccionados ({toRemove.length})
      </button>}
    </div>
    {current.map(person => <div className={styles.rosterItem} key={person.id}>
      {canManage && <input type="checkbox" aria-label={'Seleccionar '+person.name}
        checked={toRemove.includes(person.id)} disabled={busy || person.id === nextLead}
        onChange={event => setToRemove(existing => event.target.checked
          ? [...existing, person.id] : existing.filter(id => id !== person.id))}/>}
      <Avatar id={person.id} name={person.name} src={person.avatar_url} size={29}/>
      <span>{person.name}</span>
      {person.id === leadId && <small>Responsable</small>}
      {canManage && <button type="button" className={styles.rosterRemove}
        aria-label={'Quitar '+person.name}
        title={person.id === nextLead ? 'Cambia antes el responsable' : 'Quitar del grupo'}
        disabled={busy || person.id === nextLead}
        onClick={() => void persist(ids.filter(id => id !== person.id), nextLead)}>Quitar</button>}
    </div>)}
    {!current.length && <p className={styles.hint}>No hay miembros asignados.</p>}
    {canManage && <div className={styles.rosterAddAnchor}>
      <button type="button" className={`${styles.primary} ${styles.rosterAddButton}`} disabled={busy}
        aria-expanded={open} onClick={() => { setOpen(value => !value); setToAdd([]) }}>
        + Añadir miembros
      </button>
      {open && <div className={styles.rosterDropdown} role="group" aria-label="Añadir personal del Workspace">
        <label className={styles.rosterSelectAll} title="Seleccionar todo el personal disponible">
          <input type="checkbox" aria-label="Seleccionar todo el personal disponible"
            checked={allCandidatesSelected} disabled={busy || !candidates.length}
            onChange={event => setToAdd(event.target.checked ? candidates.map(person => person.id) : [])}/>
          <strong>Personal disponible ({candidates.length})</strong>
        </label>
        <div className={styles.rosterChoices}>
          {candidates.map(person => <label key={person.id}>
            <input type="checkbox" disabled={busy} checked={toAdd.includes(person.id)}
              onChange={event => setToAdd(existing => event.target.checked
                ? [...existing, person.id] : existing.filter(id => id !== person.id))}/>
            <Avatar id={person.id} name={person.name} src={person.avatar_url} size={26}/>
            <span>{person.name}</span>
          </label>)}
          {!candidates.length && <span className={styles.hint}>Todo el personal disponible ya está asignado.</span>}
        </div>
        <button type="button" className={styles.primary} disabled={busy || !toAdd.length}
          onClick={() => void persist([...ids, ...toAdd], nextLead ?? toAdd[0])}>
          {busy ? 'Añadiendo…' : 'Añadir seleccionados (' + toAdd.length + ')'}
        </button>
      </div>}
    </div>}
    {error && <p className={styles.formError} role="alert">{error}</p>}
  </div>
}
