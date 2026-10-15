import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import styles from './MyTasksSurface.module.css'

export type MyTask = {
  id: number
  title: string
  workspace_id: number
  workspace_name: string
  project_id: number
  project_name: string
  board_id: number
  board_name: string
  workflow_state: string
  column_name: string
  priority: string
  due_date: string | null
  start_date: string | null
  is_milestone: boolean
  overdue: boolean
}
type Scope = { workspace_id: number; workspace_name: string; project_id: number; project_name: string }
type TaskResponse = {
  tasks: MyTask[]
  summary: { total: number; overdue: number; backlog: number; pending: number; in_progress: number; review: number; done: number }
  scopes: Scope[]
  pagination: { page: number; last_page: number; total: number; per_page: number }
}
const stateLabels: Record<string, string> = {
  backlog: 'Backlog', pending: 'Por hacer', in_progress: 'En progreso',
  review: 'En revisión', done: 'Completada',
}
const priorityLabels: Record<string, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente',
}
function dateLabel(day: string | null) {
  if (!day) return 'Sin fecha'
  return new Date(day.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function Icon({ name }: { name: 'search' | 'calendar' | 'arrow' | 'refresh' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18.5 7M18.4 15A7 7 0 0 1 5.5 17"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function MyTasksSurface({ onOpenTask }: { onOpenTask: (task: MyTask) => Promise<void> }) {
  const [workspace, setWorkspace] = useState('all')
  const [project, setProject] = useState('all')
  const [state, setState] = useState('all')
  const [priority, setPriority] = useState('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<TaskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page) })
    if (workspace !== 'all') params.set('workspace_id', workspace)
    if (project !== 'all') params.set('project_id', project)
    if (state !== 'all') params.set('state', state)
    if (priority !== 'all') params.set('priority', priority)
    if (debouncedQuery) params.set('q', debouncedQuery)

    setLoading(true)
    setError('')
    void api<TaskResponse>(`/my/tasks?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error
          ? cause.message : 'No se pudieron cargar tus tareas.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [workspace, project, state, priority, debouncedQuery, page, reload])

  const scopes = result?.scopes ?? []
  const workspaces = useMemo(() => {
    const unique = new Map<number, string>()
    for (const item of scopes) unique.set(item.workspace_id, item.workspace_name)
    return Array.from(unique, ([id, name]) => ({ id, name }))
  }, [scopes])
  const projects = scopes.filter(item => workspace === 'all' || String(item.workspace_id) === workspace)
  const summary = result?.summary

  async function open(task: MyTask) {
    setOpeningId(task.id)
    setError('')
    try { await onOpenTask(task) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir la tarea.') }
    finally { setOpeningId(null) }
  }

  return <section className={`${styles.root} my-tasks-view`} aria-label="Mis tareas">
    <header className={styles.heading}>
      <div><h1>Mis tareas</h1><p>Las Cards que tienes asignadas en todos tus Workspaces.</p></div>
      <button className={styles.refresh} type="button" title="Actualizar tareas"
        aria-label="Actualizar tareas" onClick={() => setReload(value => value + 1)} disabled={loading}>
        <Icon name="refresh"/>
      </button>
    </header>
    <div className={styles.summary} aria-label="Resumen de mis tareas">
      <div><span>Total asignadas</span><strong>{summary?.total ?? '—'}</strong></div>
      <div><span>Vencidas</span><strong className={styles.overdueNumber}>{summary?.overdue ?? '—'}</strong></div>
      <div><span>En progreso</span><strong>{summary?.in_progress ?? '—'}</strong></div>
      <div><span>Completadas</span><strong>{summary?.done ?? '—'}</strong></div>
    </div>
    <div className={styles.filters}>
      <label>Workspace
        <select value={workspace} onChange={event => {
          setWorkspace(event.target.value); setProject('all'); setPage(1)
        }}>
          <option value="all">Todos</option>
          {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Proyecto
        <select value={project} onChange={event => { setProject(event.target.value); setPage(1) }}>
          <option value="all">Todos</option>
          {projects.map(item => <option key={item.project_id} value={item.project_id}>
            {workspace === 'all' ? `${item.workspace_name} · ${item.project_name}` : item.project_name}
          </option>)}
        </select>
      </label>
      <label>Estado
        <select value={state} onChange={event => { setState(event.target.value); setPage(1) }}>
          <option value="all">Todos</option>
          <option value="overdue">Vencidas</option>
          {Object.entries(stateLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Prioridad
        <select value={priority} onChange={event => { setPriority(event.target.value); setPage(1) }}>
          <option value="all">Todas</option>
          {Object.entries(priorityLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={styles.search}>Buscar
        <span><Icon name="search"/><input type="search" value={query} onChange={event => {
          setQuery(event.target.value); setPage(1)
        }} placeholder="Buscar tarea, tablero…" /></span>
      </label>
    </div>
    <div className={styles.listPanel}>
      <div className={styles.listHeading}>
        <strong>Tareas asignadas</strong>
        <span>{result ? `${result.pagination.total} resultados` : 'Cargando…'}</span>
      </div>
      <div className={styles.listScroll} aria-busy={loading}>
        {loading && !result && <div className={styles.skeleton} aria-label="Cargando tareas">
          {Array.from({ length: 8 }, (_, index) => <div key={index}/>)}
        </div>}
        {error && <div className={styles.error} role="alert">{error}
          <button type="button" onClick={() => setReload(value => value + 1)}>Reintentar</button>
        </div>}
        {!loading && result && result.tasks.length === 0 && <div className={styles.empty}>
          <strong>{result.summary.total === 0 ? 'No tienes Cards asignadas todavía' : 'No hay tareas con estos filtros'}</strong>
          <span>{result.summary.total === 0
            ? 'Cuando te asignen una Card en un proyecto, aparecerá aquí.'
            : 'Prueba con otro Workspace, proyecto o estado.'}</span>
        </div>}
        {result?.tasks.map(task => <button key={task.id} type="button" className={styles.task}
          onClick={() => void open(task)} disabled={openingId !== null} title="Abrir Card en su tablero">
          <span className={`${styles.statusStripe} ${styles[task.workflow_state] ?? ''}`}/>
          <span className={styles.taskBody}>
            <strong>{task.is_milestone && <span className={styles.milestone}>Hito · </span>}{task.title}</strong>
            <small>{task.workspace_name} <span>›</span> {task.project_name} <span>›</span> {task.board_name}</small>
          </span>
          <span className={`${styles.state} ${styles[task.workflow_state] ?? ''}`}>{stateLabels[task.workflow_state] ?? task.column_name}</span>
          <span className={`${styles.priority} ${styles[task.priority] ?? ''}`}>{priorityLabels[task.priority] ?? task.priority}</span>
          <span className={`${styles.date} ${task.overdue ? styles.late : ''}`}><Icon name="calendar"/>{dateLabel(task.due_date)}</span>
          <span className={styles.openIcon}><Icon name="arrow"/></span>
        </button>)}
      </div>
      {result && result.pagination.last_page > 1 && <footer className={styles.pagination}>
        <span>Página {result.pagination.page} de {result.pagination.last_page}</span>
        <div>
          <button type="button" disabled={loading || result.pagination.page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
          <button type="button" disabled={loading || result.pagination.page >= result.pagination.last_page}
            onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </div>
      </footer>}
    </div>
  </section>
}
