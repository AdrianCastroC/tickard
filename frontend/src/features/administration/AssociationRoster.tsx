import { useEffect, useState, type ReactNode } from 'react'
import styles from './DepartmentsDashboard.module.css'

export type Association = { id: number; name: string }

export function AssociationRoster({
  entityId, label, current, available, busy, canManage, renderIcon, onSave,
}: {
  entityId: number
  label: string
  current: Association[]
  available: Association[]
  busy: boolean
  canManage: boolean
  renderIcon: () => ReactNode
  onSave: (ids: number[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [toAdd, setToAdd] = useState<number[]>([])
  const [toRemove, setToRemove] = useState<number[]>([])
  const [error, setError] = useState('')
  const currentIds = current.map(item => item.id)
  const choices = available.filter(item => !currentIds.includes(item.id))
  const allCurrentSelected = currentIds.length > 0 && currentIds.every(id => toRemove.includes(id))
  const allChoicesSelected = choices.length > 0 && choices.every(item => toAdd.includes(item.id))

  useEffect(() => {
    setOpen(false); setToAdd([]); setToRemove([]); setError('')
  }, [entityId, current.map(item => item.id).join(',')])

  async function persist(ids: number[]) {
    setError('')
    try {
      await onSave(ids)
      setOpen(false); setToAdd([]); setToRemove([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la vinculación.') }
  }

  return <div className={styles.roster}>
    <div className={styles.rosterSectionHeader}>
      {canManage ? <label className={styles.rosterSelectAll} title={'Seleccionar todos los '+label.toLowerCase()}>
        <input type="checkbox" aria-label={'Seleccionar todos los '+label.toLowerCase()}
          disabled={busy || !currentIds.length} checked={allCurrentSelected}
          onChange={event => setToRemove(event.target.checked ? [...currentIds] : [])}/>
        <strong>{label} ({current.length})</strong>
      </label> : <strong>{label} ({current.length})</strong>}
      {canManage && toRemove.length > 0 && <button type="button" className={styles.dangerLink}
        disabled={busy} onClick={() => void persist(currentIds.filter(id => !toRemove.includes(id)))}>
        Quitar seleccionados ({toRemove.length})
      </button>}
    </div>
    {current.map(item => <div className={styles.rosterItem} key={item.id}>
      {canManage && <input type="checkbox" aria-label={'Seleccionar '+item.name} disabled={busy}
        checked={toRemove.includes(item.id)}
        onChange={event => setToRemove(existing => event.target.checked
          ? [...existing,item.id] : existing.filter(id=>id!==item.id))}/>}
      {renderIcon()}<span>{item.name}</span>
      {canManage && <button type="button" className={styles.rosterRemove} disabled={busy}
        aria-label={'Quitar '+item.name} onClick={() => void persist(currentIds.filter(id => id!==item.id))}>
        Quitar
      </button>}
    </div>)}
    {current.length === 0 && <p className={styles.hint}>No hay {label.toLowerCase()} vinculados.</p>}
    {canManage && <div className={styles.rosterAddAnchor}>
      <button type="button" className={`${styles.primary} ${styles.rosterAddButton}`} disabled={busy}
        aria-expanded={open} onClick={() => { setOpen(value => !value); setToAdd([]) }}>
        + Añadir {label.toLowerCase()}
      </button>
      {open && <div className={styles.rosterDropdown} role="group"
        aria-label={'Añadir '+label.toLowerCase()}>
        <label className={styles.rosterSelectAll} title={'Seleccionar todos los '+label.toLowerCase()+' disponibles'}>
          <input type="checkbox" aria-label={'Seleccionar todos los '+label.toLowerCase()+' disponibles'}
            checked={allChoicesSelected} disabled={busy || !choices.length}
            onChange={event => setToAdd(event.target.checked ? choices.map(item => item.id) : [])}/>
          <strong>{label} disponibles ({choices.length})</strong>
        </label>
        <div className={styles.rosterChoices}>
          {choices.map(item => <label key={item.id}>
            <input type="checkbox" checked={toAdd.includes(item.id)} disabled={busy}
              onChange={event => setToAdd(existing => event.target.checked
                ? [...existing, item.id] : existing.filter(id => id !== item.id))}/>
            {renderIcon()}<span>{item.name}</span>
          </label>)}
          {choices.length === 0 && <small className={styles.hint}>No hay más {label.toLowerCase()} disponibles.</small>}
        </div>
        <button type="button" className={styles.primary} disabled={busy || !toAdd.length}
          onClick={() => void persist([...currentIds, ...toAdd])}>
          {busy ? 'Guardando…' : 'Añadir seleccionados ('+toAdd.length+')'}
        </button>
      </div>}
    </div>}
    {error && <p role="alert" className={styles.formError}>{error}</p>}
  </div>
}
