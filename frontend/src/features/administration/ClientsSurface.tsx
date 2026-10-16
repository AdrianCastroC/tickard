import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { EditIcon, FloppyIcon, PlusIcon, TrashIcon } from '../../shared/icons'
import styles from './DepartmentsSurface.module.css'

type Company = { id: number; name: string; projects_count: number; people_count: number }
type Data = { can_manage: boolean; clients: Company[] }
type Mode = 'create' | 'edit' | null

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })
const skeletonRows = Array.from({ length: 7 }, (_, index) => index)

export function ClientsSurface({ workspaceId }: { workspaceId: number | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const path = '/clients?workspace_id=' + workspaceId
  const load = useCallback(async () => {
    if (!workspaceId) return
    const response = await api<Data>(path)
    setData(response)
    setSelectedId(current => response.clients.some(client => client.id === current) ? current : null)
  }, [workspaceId, path])

  useEffect(() => {
    let active = true
    setData(null); setLoading(true); setLoadError(''); setSelectedId(null); setMode(null)
    if (!workspaceId) { setLoading(false); return }
    void api<Data>(path).then(response => {
      if (active) setData(response)
    }).catch(cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId, path])

  const shown = useMemo(() => (data?.clients ?? [])
    .filter(client => client.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
    .sort((a,b) => collator.compare(a.name,b.name)), [data,search])
  const selected = data?.clients.find(client => client.id === selectedId) ?? null
  const canManage = data?.can_manage ?? false
  const editing = mode !== null

  function beginCreate() {
    setMode('create'); setSelectedId(null); setName(''); setFeedback(''); setError('')
  }
  function beginEdit(client: Company) {
    setMode('edit'); setSelectedId(client.id); setName(client.name); setFeedback(''); setError('')
  }
  function choose(client: Company) {
    setMode(null); setSelectedId(client.id); setFeedback(''); setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspaceId || !canManage || busy || !name.trim()) return
    setBusy(true); setError(''); setFeedback('')
    try {
      const created = mode === 'create'
        ? await api<{ id: number }>('/clients', {
            method: 'POST', body: JSON.stringify({ workspace_id: workspaceId, name: name.trim() }),
          })
        : null
      if (mode === 'edit' && selectedId) {
        await api('/clients/' + selectedId, {
          method: 'PATCH', body: JSON.stringify({ workspace_id: workspaceId, name: name.trim() }),
        })
      }
      await load()
      setSelectedId(created?.id ?? selectedId)
      setMode(null)
      setFeedback(created ? 'Cliente creado.' : 'Cliente actualizado.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cliente.')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!workspaceId || !selected || !canManage || busy) return
    setBusy(true); setError(''); setFeedback('')
    try {
      await api('/clients/' + selected.id, {
        method: 'DELETE', body: JSON.stringify({ workspace_id: workspaceId }),
      })
      setConfirmDelete(false); setSelectedId(null); setMode(null)
      await load()
      setFeedback('Cliente eliminado.')
    } catch (cause) {
      setConfirmDelete(false)
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el cliente.')
    } finally { setBusy(false) }
  }

  if (!workspaceId) return <section className={styles.root}><p>No hay un Workspace seleccionado.</p></section>

  return <section className={styles.root} aria-label="Clientes del Workspace">
    <header className={styles.heading}>
      <div><h1>Clientes</h1><p>Empresas cliente del Workspace y sus proyectos asociados.</p></div>
      {canManage && <button type="button" className={styles.primary} onClick={beginCreate}><PlusIcon/> Nuevo cliente</button>}
    </header>
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {loadError && <div className={styles.errorBlock} role="alert">
      {loadError}
      <button type="button" onClick={() => {
        setLoading(true); setLoadError('')
        void load().catch(cause => setLoadError(cause instanceof Error ? cause.message : 'Error de carga.'))
          .finally(() => setLoading(false))
      }}>Reintentar</button>
    </div>}
    {loading ? <div className={styles.skeleton} role="status" aria-label="Cargando clientes">
      <div className={styles.skeletonToolbar}><span/><span/></div>
      <div className={styles.skeletonBody}>
        <div>{skeletonRows.map(i => <i key={i}/>)}</div>
        <div>{skeletonRows.slice(0,4).map(i => <i key={i}/>)}</div>
      </div>
    </div> : data && <div className={styles.workspace}>
      <div className={styles.listSide}>
        <div className={styles.filters}>
          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Buscar empresa cliente" value={search}
              onChange={event => setSearch(event.target.value)}/>
          </label>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Empresa</th><th>Proyectos</th><th>Personas</th></tr></thead>
            <tbody>{shown.map(client => <tr key={client.id}
                className={selectedId === client.id && mode !== 'create' ? styles.selectedRow : undefined}>
              <td><button type="button" className={styles.departmentButton}
                title={client.name} aria-pressed={selectedId === client.id && mode !== 'create'}
                onClick={() => choose(client)}>{client.name}</button></td>
              <td><span className={styles.count}>{client.projects_count}</span></td>
              <td><span className={styles.count}>{client.people_count}</span></td>
            </tr>)}</tbody>
          </table>
          {!shown.length && <p className={styles.empty}>
            {data.clients.length === 0 ? 'Todavía no hay empresas cliente.' : 'No hay coincidencias.'}
          </p>}
        </div>
        <small className={styles.listFooter}>{shown.length} de {data.clients.length} clientes</small>
      </div>
      <aside className={styles.details}>
        {editing ? <form className={styles.form} onSubmit={save}>
          <div className={styles.detailsHead}>
            <h2>{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h2>
            <button type="button" className={styles.close} onClick={() => setMode(null)} aria-label="Cancelar edición">×</button>
          </div>
          <div className={styles.detailsScroll}>
            <label className={styles.field}>Nombre de la empresa
              <input required autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)}/>
            </label>
            <small className={styles.hint}>Los proyectos se vinculan a una empresa desde su propia configuración.</small>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <footer className={styles.formFooter}>
            <button className={styles.ghost} type="button" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
            <button className={styles.primary} type="submit" disabled={busy || !name.trim()}>
              <FloppyIcon/>{busy ? 'Guardando…' : 'Guardar'}
            </button>
          </footer>
        </form> : selected ? <>
          <div className={styles.detailsHead}><h2>{selected.name}</h2></div>
          <div className={styles.detailsScroll}>
            <div className={styles.detailBlock}>
              <strong>Vinculaciones</strong>
              <div className={styles.person}>Proyectos <span className={styles.count}>{selected.projects_count}</span></div>
              <div className={styles.person}>Personas <span className={styles.count}>{selected.people_count}</span></div>
              <small className={styles.hint}>
                Una empresa con proyectos o usuarios vinculados no puede eliminarse.
              </small>
            </div>
          </div>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          {canManage && <footer className={styles.formFooter}>
            <button type="button" className={styles.delete} disabled={selected.projects_count > 0 || selected.people_count > 0}
              title={selected.projects_count > 0 || selected.people_count > 0 ? 'No se puede eliminar una empresa con proyectos o personas asociadas' : 'Eliminar cliente'}
              onClick={() => setConfirmDelete(true)}>
              <TrashIcon/> Eliminar
            </button>
            <button type="button" className={styles.primary} onClick={() => beginEdit(selected)}>
              <EditIcon/> Editar
            </button>
          </footer>}
        </> : <div className={styles.placeholder}>
          <strong>{data.clients.length === 0 ? 'Añade la primera empresa cliente' : 'Selecciona una empresa'}</strong>
          <p>Consulta sus proyectos y personas asociadas.</p>
          {canManage && data.clients.length === 0 && <button type="button" className={styles.primary} onClick={beginCreate}>
            <PlusIcon/> Nuevo cliente
          </button>}
        </div>}
      </aside>
    </div>}
    {confirmDelete && selected && createPortal(
      <div className={styles.backdrop} onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setConfirmDelete(false)
      }}>
        <div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-client-title">
          <h2 id="delete-client-title">Eliminar empresa cliente</h2>
          <p>¿Eliminar «{selected.name}»? La acción no puede deshacerse.</p>
          <div>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button type="button" className={styles.danger} disabled={busy} onClick={() => void remove()}>
              {busy ? 'Eliminando…' : 'Eliminar cliente'}
            </button>
          </div>
        </div>
      </div>, document.body)}
  </section>
}
