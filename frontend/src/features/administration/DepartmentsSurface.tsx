import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar } from '../../shared/ui'
import { FloppyIcon, PlusIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsSurface.module.css'

type Person = { id: number; name: string; avatar_url: string | null }
type Department = { id: number; name: string; lead_user_id: number | null; members: Person[] }
type Data = { can_manage: boolean; departments: Department[]; people: Person[] }
type EditMode = 'create' | 'edit' | null

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const skeleton = Array.from({ length: 7 }, (_, index) => index)

export function DepartmentsSurface({ workspaceId }: { workspaceId: number | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<EditMode>(null)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<number[]>([])
  const [leadId, setLeadId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const path = '/departments?workspace_id=' + workspaceId
  const load = useCallback(async () => {
    if (!workspaceId) return
    const response = await api<Data>(path)
    setData(response)
    setSelectedId(current => current && response.departments.some(dep => dep.id === current) ? current : null)
  }, [workspaceId, path])

  useEffect(() => {
    let active = true
    setLoading(true); setFetchError(''); setSelectedId(null); setMode(null)
    if (!workspaceId) { setLoading(false); return }
    void api<Data>(path).then(response => {
      if (active) setData(response)
    }).catch(cause => {
      if (active) setFetchError(cause instanceof Error ? cause.message : 'No se pudieron cargar los departamentos.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId, path])

  const visible = useMemo(() => (data?.departments ?? [])
    .filter(item => {
      const text = search.trim().toLocaleLowerCase('es')
      return (!text || item.name.toLocaleLowerCase('es').includes(text) ||
        item.members.some(person => person.name.toLocaleLowerCase('es').includes(text)))
        && (!personFilter || item.members.some(person => person.id === Number(personFilter)))
    }).sort((a,b) => collator.compare(a.name,b.name)), [data, search, personFilter])

  const selected = data?.departments.find(dep => dep.id === selectedId) ?? null
  const leader = selected?.members.find(person => person.id === selected.lead_user_id)
  const editing = mode === 'create' || mode === 'edit'
  const canManage = data?.can_manage === true

  function choose(dep: Department) {
    setSelectedId(dep.id); setMode(null); setError(''); setFeedback('')
  }
  function beginCreate() {
    setMode('create'); setSelectedId(null); setName(''); setMembers([]); setLeadId(null)
    setError(''); setFeedback('')
  }
  function beginEdit(dep: Department) {
    setMode('edit'); setSelectedId(dep.id); setName(dep.name)
    setMembers(dep.members.map(person => person.id)); setLeadId(dep.lead_user_id)
    setError(''); setFeedback('')
  }
  function toggleMember(id: number, checked: boolean) {
    setMembers(current => checked ? [...current, id] : current.filter(item => item !== id))
    if (!checked && leadId === id) setLeadId(null)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspaceId || !canManage || busy) return
    if (!name.trim()) { setError('Introduce un nombre.'); return }
    setBusy(true); setError(''); setFeedback('')
    try {
      const payload = { workspace_id: workspaceId, name: name.trim(),
        member_ids: members, lead_user_id: leadId }
      const created = mode === 'create'
        ? await api<{id:number}>('/departments', { method: 'POST', body: JSON.stringify(payload) })
        : null
      if (mode === 'edit' && selectedId) {
        await api('/departments/' + selectedId, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      await load()
      setSelectedId(created?.id ?? selectedId)
      setMode(null)
      setFeedback(created ? 'Departamento creado.' : 'Departamento actualizado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el departamento.')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!workspaceId || !selected || !canManage || busy) return
    setBusy(true); setError(''); setFeedback('')
    try {
      await api('/departments/' + selected.id, {
        method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }),
      })
      setConfirmDelete(false); setSelectedId(null); setMode(null)
      await load()
      setFeedback('Departamento eliminado. Sus miembros y proyectos no se han eliminado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el departamento.')
      setConfirmDelete(false)
    } finally { setBusy(false) }
  }

  if (!workspaceId) return <section className={styles.root}><p>No hay un Workspace seleccionado.</p></section>

  return <section className={styles.root} aria-label="Departamentos del workspace">
    <header className={styles.heading}>
      <div>
        <h1>Departamentos</h1>
        <p>Organiza los miembros del Workspace sin modificar sus permisos de proyecto.</p>
      </div>
      {canManage && <button type="button" className={styles.primary} onClick={beginCreate}>
        <PlusIcon/> Nuevo departamento
      </button>}
    </header>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {fetchError && <div className={styles.errorBlock} role="alert">
      {fetchError} <button type="button" onClick={() => {
        setLoading(true); setFetchError('')
        void load().catch(cause => setFetchError(cause instanceof Error ? cause.message : 'Error de carga.'))
          .finally(() => setLoading(false))
      }}>Reintentar</button>
    </div>}
    {loading ? <div className={styles.skeleton} role="status" aria-label="Cargando departamentos">
      <div className={styles.skeletonToolbar}><span/><span/></div>
      <div className={styles.skeletonBody}>
        <div>{skeleton.map(i => <i key={i}/>)}</div>
        <div>{skeleton.slice(0,4).map(i => <i key={i}/>)}</div>
      </div>
    </div> : data && <div className={styles.workspace}>
      <div className={styles.listSide}>
        <div className={styles.filters}>
          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Buscar departamento o persona"
              value={search} onChange={event => setSearch(event.target.value)}/>
          </label>
          <select aria-label="Filtrar por miembro" value={personFilter}
            onChange={event => setPersonFilter(event.target.value)}>
            <option value="">Todos los miembros</option>
            {data.people.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}
          </select>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Departamento</th><th>Responsable</th><th>Miembros</th></tr></thead>
            <tbody>{visible.map(dep => {
              const lead = dep.members.find(person => person.id === dep.lead_user_id)
              return <tr key={dep.id} className={selectedId === dep.id && mode !== 'create' ? styles.selectedRow : undefined}>
                <td><button type="button" className={styles.departmentButton}
                  aria-pressed={selectedId === dep.id && mode !== 'create'} onClick={() => choose(dep)}
                  title={dep.name}>{dep.name}</button></td>
                <td>{lead ? <div className={styles.person}>
                  <Avatar id={lead.id} name={lead.name} src={lead.avatar_url} size={25}/>
                  <span>{lead.name}</span>
                </div> : <span className={styles.muted}>Sin asignar</span>}</td>
                <td><span className={styles.count}>{dep.members.length}</span></td>
              </tr>
            })}</tbody>
          </table>
          {visible.length === 0 && <div className={styles.empty}>
            {data.departments.length === 0 ? 'Todavía no hay departamentos en este Workspace.' : 'No hay departamentos con estos filtros.'}
          </div>}
        </div>
        <small className={styles.listFooter}>{visible.length} de {data.departments.length} departamentos</small>
      </div>
      <aside className={styles.details}>
        {editing ? <form className={styles.form} onSubmit={save}>
          <div className={styles.detailsHead}>
            <h2>{mode === 'create' ? 'Nuevo departamento' : 'Editar departamento'}</h2>
            <button type="button" className={styles.close} onClick={() => setMode(null)} aria-label="Cancelar edición">×</button>
          </div>
          <div className={styles.detailsScroll}>
            <label className={styles.field}>Nombre
              <input required autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)}/>
            </label>
            <div className={styles.labelRow}><strong>Integrantes</strong><span>{members.length} seleccionados</span></div>
            <div className={styles.membersScroll}>
              {data.people.map(person => <label className={styles.memberChoice} key={person.id}>
                <input type="checkbox" checked={members.includes(person.id)}
                  onChange={event => toggleMember(person.id, event.target.checked)}/>
                <Avatar id={person.id} name={person.name} src={person.avatar_url} size={28}/>
                <span>{person.name}</span>
              </label>)}
              {data.people.length === 0 && <p className={styles.muted}>No hay personas disponibles.</p>}
            </div>
            <label className={styles.field}>Responsable del departamento
              <select value={leadId ?? ''} onChange={event => setLeadId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Sin asignar</option>
                {data.people.filter(person => members.includes(person.id)).map(person =>
                  <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <small className={styles.hint}>El responsable es informativo; no recibe permisos adicionales.</small>
          </div>
          {error && <p role="alert" className={styles.formError}>{error}</p>}
          <footer className={styles.formFooter}>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
            <button type="submit" className={styles.primary} disabled={busy || !name.trim()}>
              <FloppyIcon/>{busy ? 'Guardando…' : 'Guardar'}
            </button>
          </footer>
        </form> : selected ? <>
          <div className={styles.detailsHead}><h2>{selected.name}</h2></div>
          <div className={styles.detailsScroll}>
            <div className={styles.detailBlock}>
              <strong>Responsable</strong>
              {leader ? <div className={styles.person}><Avatar id={leader.id} name={leader.name} src={leader.avatar_url} size={30}/>{leader.name}</div>
                : <span className={styles.muted}>Sin responsable</span>}
            </div>
            <div className={styles.detailBlock}>
              <strong>Miembros ({selected.members.length})</strong>
              {selected.members.length === 0 && <p className={styles.muted}>No hay miembros asignados.</p>}
              {selected.members.map(person => <div className={styles.memberRead} key={person.id}>
                <Avatar id={person.id} name={person.name} src={person.avatar_url} size={28}/>
                <span>{person.name}</span>
              </div>)}
            </div>
          </div>
          {error && <p role="alert" className={styles.formError}>{error}</p>}
          {canManage && <footer className={styles.formFooter}>
            <button type="button" className={styles.delete} onClick={() => setConfirmDelete(true)}>
              <TrashIcon/> Eliminar
            </button>
            <button type="button" className={styles.primary} onClick={() => beginEdit(selected)}>Editar</button>
          </footer>}
        </> : <div className={styles.placeholder}>
          <strong>{data.departments.length === 0 ? 'Empieza creando un departamento' : 'Selecciona un departamento'}</strong>
          <p>Consulta su responsable y los miembros que lo componen.</p>
          {canManage && data.departments.length === 0 && <button type="button" className={styles.primary} onClick={beginCreate}>
            <PlusIcon/> Nuevo departamento
          </button>}
        </div>}
      </aside>
    </div>}
    {confirmDelete && selected && createPortal(
      <div className={styles.backdrop}>
        <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-department-title">
          <h2 id="delete-department-title">Eliminar departamento</h2>
          <p>¿Eliminar «{selected.name}»? Sus integrantes seguirán en el Workspace y sus tareas no se modificarán.</p>
          <div><button type="button" className={styles.ghost} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button type="button" className={styles.danger} disabled={busy} onClick={() => void remove()}>
              {busy ? 'Eliminando…' : 'Eliminar departamento'}
            </button>
          </div>
        </div>
      </div>, document.body)}
  </section>
}
