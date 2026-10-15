import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api'
import { CloseIcon, FilterFunnelIcon } from '../../shared/icons'
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
export type MyMeeting = {
  id: number
  title: string
  location: string | null
  start_time: string | null
  end_time: string | null
  all_day: boolean
  project_id: number
  project_name: string
  workspace_id: number
  workspace_name: string
}
type TaskResponse = {
  meetings: MyMeeting[]
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
function Icon({ name }: { name: 'search' | 'calendar' | 'arrow' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function MyTasksSurface({ onOpenTask, onOpenMeeting, initialState = 'all' }: {
  onOpenTask: (task: MyTask) => Promise<void>
  onOpenMeeting: (meeting: MyMeeting) => Promise<void>
  initialState?: 'all' | 'overdue'
}) {
  const [workspace, setWorkspace] = useState('all')
  const [project, setProject] = useState('all')
  const [state, setState] = useState(initialState)
  const [priority, setPriority] = useState('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<TaskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterPopoverId = useId()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    const localDate = new Date()
    const today = [
      localDate.getFullYear(),
      String(localDate.getMonth() + 1).padStart(2, '0'),
      String(localDate.getDate()).padStart(2, '0'),
    ].join('-')
    const params = new URLSearchParams({ page: String(page), today })
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

  const filtersActive = workspace !== 'all' || project !== 'all' || state !== 'all' || priority !== 'all'

  function clearFilters() {
    setWorkspace('all')
    setProject('all')
    setState('all')
    setPriority('all')
    setPage(1)
  }

  useLayoutEffect(() => {
    if (!filtersOpen) return
    const updatePosition = () => {
      const anchor = filterButtonRef.current
      const panel = filterPanelRef.current
      if (!anchor || !panel) return
      const rect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const margin = 12
      const gap = 8
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin))
      const below = rect.bottom + gap
      const top = below + height <= window.innerHeight - margin
        ? below : Math.max(margin, rect.top - height - gap)
      setFilterPosition(current => current?.top === top && current?.left === left ? current : { top, left })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const observer = new ResizeObserver(updatePosition)
    if (filterPanelRef.current) observer.observe(filterPanelRef.current)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      observer.disconnect()
    }
  }, [filtersOpen])

  useEffect(() => {
    if (!filtersOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (filterButtonRef.current?.contains(event.target) || filterPanelRef.current?.contains(event.target)) return
      setFiltersOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setFiltersOpen(false)
      filterButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  async function openMeeting(meeting: MyMeeting) {
    setError('')
    try { await onOpenMeeting(meeting) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir el calendario.') }
  }

  async function open(task: MyTask) {
    setOpeningId(task.id)
    setError('')
    try { await onOpenTask(task) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir la tarea.') }
    finally { setOpeningId(null) }
  }

  return <section className={`${styles.root} my-tasks-view`} aria-label="Mis tareas">
    <header className={styles.heading}>
      <div className={styles.headingTitle}>
        <h1>Mis tareas</h1>
        <p>Las Cards que tienes asignadas en todos tus Workspaces.</p>
      </div>
      <div className={styles.headingActions}>
        <label className={styles.headerSearch}>
          <Icon name="search"/>
          <input type="search" value={query} onChange={event => {
            setQuery(event.target.value)
            setPage(1)
          }} aria-label="Buscar tareas" placeholder="Buscar tarea, tablero…" />
        </label>
        <button ref={filterButtonRef} type="button"
          className={`icon-button board-filter-trigger${filtersOpen || filtersActive ? ' on' : ''}`}
          title="Filtros" aria-label={filtersActive ? 'Filtros activos' : 'Filtros'}
          aria-haspopup="dialog" aria-controls={filtersOpen ? filterPopoverId : undefined}
          aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>
          <FilterFunnelIcon/>
          {filtersActive && <span className="board-filter-active-dot" aria-hidden="true"/>}
        </button>
      </div>
    </header>
    <div className={styles.summary} aria-label="Resumen de mis tareas">
      <div><span>Total asignadas</span><strong>{summary?.total ?? '—'}</strong></div>
      <div><span>Vencidas</span><strong className={styles.overdueNumber}>{summary?.overdue ?? '—'}</strong></div>
      <div><span>En progreso</span><strong>{summary?.in_progress ?? '—'}</strong></div>
      <div><span>Completadas</span><strong>{summary?.done ?? '—'}</strong></div>
    </div>
    {filtersOpen && createPortal(
      <div ref={filterPanelRef} id={filterPopoverId} className={styles.filterPopover}
        role="dialog" aria-label="Filtros de mis tareas"
        style={filterPosition ? { top: filterPosition.top, left: filterPosition.left } : { top: 0, left: 0, visibility: 'hidden' }}>
        <div className={styles.filterPopoverHeader}>
          <strong>Filtros</strong>
          <button type="button" className="icon-close" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)}>
            <CloseIcon/>
          </button>
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
        </div>
        <div className={styles.filterPopoverFooter}>
          <button type="button" className="ghost" disabled={!filtersActive} onClick={clearFilters}>Limpiar filtros</button>
        </div>
      </div>, document.body
    )}
    {!!result?.meetings.length && <section className={styles.meetings} aria-label="Reuniones de hoy">
      <div className={styles.meetingHeading}>
        <h2>Reuniones de hoy</h2>
        <span>{result.meetings.length}</span>
      </div>
      <div className={styles.meetingList}>
        {result.meetings.map(meeting => <button key={meeting.id} type="button"
          className={styles.meeting} onClick={() => void openMeeting(meeting)}
          title="Ver calendario del proyecto">
          <span className={styles.meetingTime}>{meeting.all_day
            ? 'Todo el día'
            : `${meeting.start_time ?? '—'} – ${meeting.end_time ?? '—'}`}</span>
          <span className={styles.meetingInfo}>
            <strong>{meeting.title}</strong>
            <small>{meeting.workspace_name} › {meeting.project_name}{meeting.location ? ` · ${meeting.location}` : ''}</small>
          </span>
          <span className={styles.meetingOpen}><Icon name="arrow"/></span>
        </button>)}
      </div>
    </section>}
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
