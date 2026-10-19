import { useEffect, useState } from 'react'
import { api, type BoardPayload, type WorkflowState } from '../../api'
import { NavIcon } from '../../shared/icons'
import { Avatar, formatRelative } from '../../shared/ui'
import { ProjectContentLoading } from '../workspace/ProjectContentLoading'
import styles from './BoardSummary.module.css'

type BoardStats = {
  total: number; completed: number; pending: number; in_progress: number
  review: number; backlog: number; overdue: number
  start_date: string | null; end_date: string | null; member_count: number
}
type BoardTask = { id: number; title: string; due_date: string; state: WorkflowState }
type BoardActivity = {
  id: number; type: string; card_id: number; card_title: string
  user_id: number | null; user_name: string; avatar_url: string | null; created_at: string
}
type Dashboard = {
  summary: BoardStats
  columns: { id: number; name: string; workflow_state: WorkflowState; color: string | null; total: number }[]
  deadlines: BoardTask[]
  milestones: BoardTask[]
  members: { id: number; name: string; avatar_url: string | null; total: number }[]
  activity: BoardActivity[]
}

const STATE_LABELS: Record<WorkflowState, string> = {
  backlog: 'Backlog', pending: 'Por hacer', in_progress: 'En progreso',
  review: 'En revisión', done: 'Completado',
}
const STATE_COLORS: Record<WorkflowState, string> = {
  backlog: '#94a3b8', pending: '#4b90e6', in_progress: '#efa34b',
  review: '#9867d9', done: '#22a783',
}
const ACTIVITY_VERBS: Record<string, string> = {
  created: 'creó', moved: 'movió', updated: 'actualizó',
  assigned: 'asignó', completed: 'completó', commented: 'comentó en',
}

function dateText(date: string | null) {
  if (!date) return 'Sin definir'
  return new Date(date.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function isOverdue(date: string, state: WorkflowState) {
  if (state === 'done' || state === 'backlog') return false
  const now = new Date()
  const localDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-')
  return date.slice(0, 10) < localDate
}

export function BoardSummary({ board, onConfigure, onOpenView, onOpenCard }: {
  board: BoardPayload
  onConfigure?: () => void
  onOpenView: (view: 'board' | 'gantt') => void
  onOpenCard: (id: number) => void
}) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError('')
    void api<Dashboard>(`/boards/${board.board.id}/dashboard`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.')
        }
      })
    return () => controller.abort()
  }, [board.board.id, board.revision, retry])

  if (!data) return <section className={styles.root}>
    {error
      ? <div className={styles.loadError} role="alert">
          <h2>No se pudo cargar el resumen del tablero</h2>
          <p>{error}</p>
          <button type="button" className="primary" onClick={() => setRetry(value => value + 1)}>Reintentar</button>
        </div>
      : <ProjectContentLoading title="Cargando resumen del tablero"
          description="Preparando el progreso, los plazos y la actividad del tablero…">
          <div className={styles.skeleton} aria-hidden="true"><div/><div/><div/><div/></div>
        </ProjectContentLoading>}
  </section>

  const stats = data.summary
  const completion = stats.total ? Math.round(100 * stats.completed / stats.total) : 0
  const metrics = [
    { label: 'Tareas', value: stats.total, detail: 'Activas en el tablero', icon: 'tasks' },
    { label: 'Completadas', value: stats.completed, detail: `${completion}% del total`, icon: 'done' },
    { label: 'En progreso', value: stats.in_progress, detail: 'En ejecución', icon: 'progress' },
    { label: 'En revisión', value: stats.review, detail: 'Pendientes de validar', icon: 'review' },
    { label: 'Vencidas', value: stats.overdue, detail: 'Sin completar', icon: 'overdue' },
  ] as const

  return <section className={styles.root} aria-label={`Resumen de ${board.board.name}`}>
    <header className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>TABLERO · {board.board.project_name}</p>
        <h2>Visión general</h2>
        <p className={styles.explainer}>Seguimiento de las tareas de {board.board.name}.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => onOpenView('board')}>
          <NavIcon><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16m5-16v16"/></NavIcon>
          Abrir tablero
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => onOpenView('gantt')}>
          <NavIcon><path d="M3 6h10M8 12h13M5 18h11"/></NavIcon>
          Ver Gantt
        </button>
        {onConfigure && <button type="button" className={styles.settingsButton} onClick={onConfigure}>
          <NavIcon><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/></NavIcon>
          Configurar
        </button>}
      </div>
    </header>

    <div className={styles.metrics}>
      {metrics.map(item => <div className={styles.metric} key={item.icon}>
        <div className={styles.metricTitle}>
          <span className={styles.metricIcon} data-kind={item.icon}>
            {item.icon === 'tasks' ? <NavIcon><path d="M6 5h15M6 12h15M6 19h15"/><path d="m2 5 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2"/></NavIcon>
              : item.icon === 'done' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></NavIcon>
              : item.icon === 'progress' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></NavIcon>
              : item.icon === 'review' ? <NavIcon><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></NavIcon>
              : <NavIcon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m-9 4v4m0 2h.01"/></NavIcon>}
          </span>{item.label}
        </div>
        <strong>{item.value}</strong><small>{item.detail}</small>
      </div>)}
    </div>

    <div className={styles.overview}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Progreso del tablero</h3><strong>{completion}%</strong></div>
        <div className={styles.track} role="progressbar" aria-label="Progreso de tareas completadas"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
          <div className={styles.trackFill} style={{ width: completion + '%' }}/>
        </div>
        <div className={styles.period}>
          <span><small>Inicio previsto</small><strong>{dateText(stats.start_date)}</strong></span>
          <span><small>Último vencimiento</small><strong>{dateText(stats.end_date)}</strong></span>
        </div>
        <div className={styles.breakdown}>
          <div className={styles.panelHeading}><h3>Distribución por columnas</h3></div>
          <div className={styles.columnList}>
            {data.columns.map(column =>
              <div className={styles.columnRow} key={column.id}>
                <span className={styles.columnName} title={column.name}>
                  <span className={styles.dot} style={{ backgroundColor: column.color || STATE_COLORS[column.workflow_state] }}/>
                  {column.name}
                </span>
                <div className={styles.columnTrack}>
                  <div style={{ width: (stats.total ? 100 * column.total / stats.total : 0) + '%',
                    backgroundColor: column.color || STATE_COLORS[column.workflow_state] }}/>
                </div>
                <strong>{column.total}</strong>
              </div>)}
            {data.columns.length === 0 && <p className={styles.empty}>Este tablero aún no tiene columnas.</p>}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Próximos vencimientos</h3>
          <button type="button" onClick={() => onOpenView('gantt')}>Ver Gantt →</button>
        </div>
        <div className={styles.taskList}>
          {data.deadlines.map(task => <button className={styles.task} key={task.id}
            type="button" onClick={() => onOpenCard(task.id)} title={task.title}>
            <span className={styles.taskTitle}><span className={styles.dot}
              style={{ backgroundColor: STATE_COLORS[task.state] }}/>{task.title}</span>
            <span className={isOverdue(task.due_date, task.state) ? styles.late : styles.date}>
              {dateText(task.due_date)}
            </span>
          </button>)}
          {data.deadlines.length === 0 && <p className={styles.empty}>No hay tareas pendientes con fecha límite.</p>}
        </div>
        <div className={styles.panelHeading}><h3>Hitos del tablero</h3></div>
        <div className={styles.taskList}>
          {data.milestones.map(task => <button className={styles.task} key={task.id}
            type="button" onClick={() => onOpenCard(task.id)}>
            <span className={styles.taskTitle}>
              <NavIcon><path d="M4 3v18m0-16h15l-4 5 4 5H4"/></NavIcon>{task.title}
            </span>
            <span className={styles.date}>{dateText(task.due_date)}</span>
          </button>)}
          {data.milestones.length === 0 && <p className={styles.empty}>No hay hitos con fecha definida.</p>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Personas asignadas</h3>
          <span className={styles.secondaryMeta}>{stats.member_count} personas</span>
        </div>
        <div className={styles.people}>
          {data.members.map(person => <div className={styles.person} key={person.id}>
            <Avatar id={person.id} name={person.name} src={person.avatar_url} size={32}/>
            <strong title={person.name}>{person.name}</strong>
            <small>{person.total} {person.total === 1 ? 'tarea' : 'tareas'}</small>
          </div>)}
          {stats.member_count > data.members.length &&
            <p className={styles.more}>+{stats.member_count - data.members.length} personas adicionales</p>}
          {data.members.length === 0 && <p className={styles.empty}>No hay personas asignadas a tareas visibles.</p>}
        </div>
        <div className={styles.panelHeading}><h3>Actividad reciente</h3></div>
        <div className={styles.activityList}>
          {data.activity.map(entry => <button type="button" key={entry.id}
            className={styles.activity} onClick={() => onOpenCard(entry.card_id)}>
            <Avatar id={entry.user_id ?? 0} name={entry.user_name} src={entry.avatar_url} size={30}/>
            <span><strong>{entry.user_name}</strong> {ACTIVITY_VERBS[entry.type] || 'actualizó'} una tarea
              <small title={entry.card_title}>{entry.card_title}</small></span>
            <time>{formatRelative(entry.created_at)}</time>
          </button>)}
          {data.activity.length === 0 && <p className={styles.empty}>Todavía no hay actividad registrada.</p>}
        </div>
      </section>
    </div>
    <p className={styles.note}>Solo se cuentan las tareas activas y visibles de este tablero. El backlog no interviene en el cálculo de fechas.</p>
  </section>
}
