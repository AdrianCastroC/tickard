import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { Avatar } from '../../shared/ui'
import { EditIcon, FloppyIcon, PlusIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsSurface.module.css'

type Person = { id: number; name: string; avatar_url: string | null }
type Team = { id: number; name: string; members: Person[]; projects_count: number; cards_count: number }
type Data = { can_manage: boolean; teams: Team[]; people: Person[] }
type EditMode = 'create' | 'edit' | null

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const skeleton = Array.from({ length: 7 }, (_, index) => index)

export function TeamsSurface({ workspaceId }: { workspaceId: number | null }) {
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
  const [confirmDelete, setConfirmDelete] = useState(false)

  const path = '/teams?workspace_id=' + workspaceId
  const load = useCallback(async () => {
    if (!workspaceId) return
    const response = await api<Data>(path)
    setData(response)
    setSelectedId(current => current && response.teams.some(dep => dep.id === current) ? current : null)
  }, [workspaceId, path])

  useEffect(() => {
    let active = true
    setLoading(true); setFetchError(''); setSelectedId(null); setMode(null)
    if (!workspaceId) { setLoading(false); return }
    void api<Data>(path).then(response => {
      if (active) setData(response)
    }).catch(cause => {
      if (active) setFetchError(cause instanceof Error ? cause.message : 'No se pudieron cargar los equipos.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId, path])

  const visible = useMemo(() => (data?.teams ?? [])
    .filter(item => {
      const text = search.trim().toLocaleLowerCase('es')
      return (!text || item.name.toLocaleLowerCase('es').includes(text) ||
        item.members.some(person => person.name.toLocaleLowerCase('es').includes(text)))
        && (!personFilter || item.members.some(person => person.id === Number(personFilter)))
    }).sort((a,b) => collator.compare(a.name,b.name)), [data, search, personFilter])

  const selected = data?.teams.find(dep => dep.id === selectedId) ?? null
  const editing = mode === 'create' || mode === 'edit'
  const canManage = data?.can_manage === true

  function choose(dep: Team) {
    setSelectedId(dep.id); setMode(null); setError(''); setFeedback('')
  }
  function beginCreate() {
    setMode('create'); setSelectedId(null); setName(''); setMembers([])
    setError(''); setFeedback('')
  }
  function beginEdit(dep: Team) {
    setMode('edit'); setSelectedId(dep.id); setName(dep.name)
    setMembers(dep.members.map(person => person.id))
    setError(''); setFeedback('')
  }
  function toggleMember(id: number, checked: boolean) {
    setMembers(current => checked ? [...current, id] : current.filter(item => item !== id))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspaceId || !canManage || busy) return
    if (!name.trim()) { setError('Introduce un nombre.'); return }
    setBusy(true); setError(''); setFeedback('')
    try {
      const payload = { workspace_id: workspaceId, name: name.trim(),
        member_ids: members }
      const created = mode === 'create'
        ? await api<{id:number}>('/teams', { method: 'POST', body: JSON.stringify(payload) })
        : null
      if (mode === 'edit' && selectedId) {
        await api('/teams/' + selectedId, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      await load()
      setSelectedId(created?.id ?? selectedId)
      setMode(null)
      setFeedback(created ? 'Equipo creado.' : 'Equipo actualizado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el equipo.')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!workspaceId || !selected || !canManage || busy) return
    setBusy(true); setError(''); setFeedback('')
    try {
      await api('/teams/' + selected.id, {
        method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }),
      })
      setConfirmDelete(false); setSelectedId(null); setMode(null)
      await load()
      setFeedback('Equipo eliminado. Se han desvinculado sus proyectos y tareas sin eliminarlos.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el equipo.')
      setConfirmDelete(false)
    } finally { setBusy(false) }
  }

  if (!workspaceId) return <section className={styles.root}><p>No hay un Workspace seleccionado.</p></section>

  return <section className={styles.root} aria-label="Equipos del workspace">
    <header className={styles.heading}>
      <div>
        <h1>Equipos</h1>
        <p>Gestiona grupos de trabajo para asignaciones a proyectos y tareas, sin conceder acceso automático.</p>
      </div>
      {canManage && <button type="button" className={styles.primary} onClick={beginCreate}>
        <PlusIcon/> Nuevo equipo
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
    {loading ? <div className={styles.skeleton} role="status" aria-label="Cargando equipos">
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
            <input type="search" placeholder="Buscar equipo o persona"
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
            <thead><tr><th>Equipo</th><th>Proyectos</th><th>Tareas</th><th>Miembros</th></tr></thead>
            <tbody>{visible.map(dep =>
              <tr key={dep.id} className={selectedId === dep.id && mode !== 'create' ? styles.selectedRow : undefined}>
                <td><button type="button" className={styles.departmentButton}
                  aria-pressed={selectedId === dep.id && mode !== 'create'} onClick={() => choose(dep)}
                  title={dep.name}>{dep.name}</button></td>
                <td><span className={styles.count}>{dep.projects_count}</span></td>
                <td><span className={styles.count}>{dep.cards_count}</span></td>
                <td><span className={styles.count}>{dep.members.length}</span></td>
              </tr>
            )}</tbody>
          </table>
          {visible.length === 0 && <div className={styles.empty}>
            {data.teams.length === 0 ? 'Todavía no hay equipos en este Workspace.' : 'No hay equipos con estos filtros.'}
          </div>}
        </div>
        <small className={styles.listFooter}>{visible.length} de {data.teams.length} equipos</small>
      </div>
      <aside className={styles.details}>
        {editing ? <form className={styles.form} onSubmit={save}>
          <div className={styles.detailsHead}>
            <h2>{mode === 'create' ? 'Nuevo equipo' : 'Editar equipo'}</h2>
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
            <small className={styles.hint}>Los equipos no otorgan permisos por sí mismos; cada proyecto controla el acceso de sus miembros.</small>
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
              <strong>Vinculaciones</strong>
              <div className={styles.person}>Proyectos: <span className={styles.count}>{selected.projects_count}</span></div>
              <div className={styles.person}>Tareas: <span className={styles.count}>{selected.cards_count}</span></div>
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
            <button type="button" className={styles.primary} onClick={() => beginEdit(selected)}><EditIcon /> Editar</button>
          </footer>}
        </> : <div className={styles.placeholder}>
          <strong>{data.teams.length === 0 ? 'Empieza creando un equipo' : 'Selecciona un equipo'}</strong>
          <p>Consulta los miembros y las vinculaciones de este equipo.</p>
          {canManage && data.teams.length === 0 && <button type="button" className={styles.primary} onClick={beginCreate}>
            <PlusIcon/> Nuevo equipo
          </button>}
        </div>}
      </aside>
    </div>}
    {confirmDelete && selected && createPortal(
      <div className={styles.backdrop}>
        <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-team-title">
          <h2 id="delete-team-title">Eliminar equipo</h2>
          <p>¿Eliminar «{selected.name}»? Los integrantes conservarán su cuenta, pero se eliminarán las vinculaciones del equipo con proyectos y tareas.</p>
          <div><button type="button" className={styles.ghost} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button type="button" className={styles.danger} disabled={busy} onClick={() => void remove()}>
              {busy ? 'Eliminando…' : 'Eliminar equipo'}
            </button>
          </div>
        </div>
      </div>, document.body)}
  </section>
}
