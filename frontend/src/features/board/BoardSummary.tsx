import { useEffect, useState } from 'react'
import { api, type BoardPayload, type WorkflowState } from '../../api'
import { NavIcon } from '../../shared/icons'
import { Avatar, formatRelative } from '../../shared/ui'
import { ProjectContentLoading } from '../workspace/ProjectContentLoading'
import styles from './BoardSummary.module.css'

type BoardStats = {
  total: number; completed: number; pending: number; in_progress: number
  review: number; backlog: number; overdue: number; with_date: number; without_date: number; blocked: number
  start_date: string | null; end_date: string | null; member_count: number
}
type BoardTask = { id: number; title: string; due_date: string; state: WorkflowState; priority: string | null }
type BoardActivity = {
  id: number; type: string; card_id: number; card_title: string
  user_id: number | null; user_name: string; avatar_url: string | null; created_at: string
}
type Dashboard = {
  summary: BoardStats
  columns: { id: number; name: string; workflow_state: WorkflowState; color: string | null; total: number }[]
  deadlines: BoardTask[]
  milestones: BoardTask[]
  priorities: { priority: string; total: number }[]
  labels: { id: number; name: string; tone: string; total: number }[]
  files: { id: number; name: string; mime_type: string | null; created_at: string | null; card_id: number; card_title: string }[]
  members: { id: number; name: string; avatar_url: string | null; total: number }[]
  activity: BoardActivity[]
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
  const priorities = [
    { key: 'urgente', label: 'Urgente', color: '#ed5967' },
    { key: 'alta', label: 'Alta', color: '#f1744c' },
    { key: 'media', label: 'Media', color: '#f5b847' },
    { key: 'baja', label: 'Baja', color: '#41be89' },
    { key: 'sin_prioridad', label: 'Sin prioridad', color: '#9cabbc' },
  ].map(item => ({ ...item, total: data.priorities.find(row => row.priority === item.key)?.total ?? 0 }))
  const workflow = [
    { key: 'backlog', label: 'Backlog', color: STATE_COLORS.backlog, total: stats.backlog },
    { key: 'pending', label: 'Por hacer', color: STATE_COLORS.pending, total: stats.pending },
    { key: 'in_progress', label: 'En progreso', color: STATE_COLORS.in_progress, total: stats.in_progress },
    { key: 'review', label: 'En revisión', color: STATE_COLORS.review, total: stats.review },
    { key: 'done', label: 'Completadas', color: STATE_COLORS.done, total: stats.completed },
  ]
  const metricCards = [
    { key: 'total', label: 'Total de tareas', value: stats.total, detail: 'Tareas activas', icon: 'tasks' },
    { key: 'pending', label: 'Por hacer', value: stats.pending, detail: 'Pendientes', icon: 'pending' },
    { key: 'progress', label: 'En progreso', value: stats.in_progress, detail: 'En ejecución', icon: 'progress' },
    { key: 'review', label: 'En revisión', value: stats.review, detail: 'Por validar', icon: 'review' },
    { key: 'done', label: 'Completadas', value: stats.completed, detail: `${completion}% del tablero`, icon: 'done' },
    { key: 'overdue', label: 'Retrasadas', value: stats.overdue, detail: 'Sin completar', icon: 'overdue' },
  ] as const

  function donut(values: { total: number; color: string }[]) {
    if (stats.total === 0) return 'conic-gradient(var(--line) 0% 100%)'
    let offset = 0
    const slices = values.filter(item => item.total > 0).map(item => {
      const start = offset
      offset += 100 * item.total / stats.total
      return `${item.color} ${start}% ${offset}%`
    })
    return `conic-gradient(${slices.join(', ')})`
  }

  const priorityLabel = (value: string | null) =>
    priorities.find(priority => priority.key === value)?.label ?? 'Sin prioridad'

  return <section className={styles.root} aria-label={`Resumen de ${board.board.name}`}>
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>TABLERO · {board.board.project_name}</p>
        <h2>Visión general</h2>
        <p className={styles.explainer}>Progreso, responsables y próximos pasos de {board.board.name}.</p>
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
    </div>

    <div className={styles.metrics}>
      {metricCards.map(metric => <div key={metric.key} className={styles.metric}>
        <div className={styles.metricTitle}>
          <span className={styles.metricIcon} data-kind={metric.icon}>
            {metric.key === 'total' ? <NavIcon><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h6"/></NavIcon>
              : metric.key === 'pending' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></NavIcon>
              : metric.key === 'progress' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></NavIcon>
              : metric.key === 'review' ? <NavIcon><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6Z"/><circle cx="12" cy="12" r="3"/></NavIcon>
              : metric.key === 'done' ? <NavIcon><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></NavIcon>
              : <NavIcon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m-9 4v4m0 2h.01"/></NavIcon>}
          </span>
          {metric.label}
        </div>
        <strong>{metric.value}</strong><small>{metric.detail}</small>
      </div>)}
    </div>

    <div className={styles.topPanels}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Progreso del tablero</h3>
          <strong>{completion}% <small>{stats.completed} / {stats.total} tareas</small></strong>
        </div>
        <div className={styles.stackedTrack} role="progressbar"
          aria-label="Porcentaje de tareas completadas" aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={completion}>
          {workflow.map(item => item.total > 0 &&
            <span key={item.key} style={{ width: (item.total / stats.total * 100) + '%',
              backgroundColor: item.color }} title={`${item.label}: ${item.total}`}/>)}
        </div>
        <div className={styles.progressMeta}>
          <span><small>Inicio previsto</small><strong>{dateText(stats.start_date)}</strong></span>
          <span><small>Último vencimiento</small><strong>{dateText(stats.end_date)}</strong></span>
        </div>
        <div className={styles.health}>
          {[
            { key: 'without', label: 'Sin fecha', count: stats.without_date },
            { key: 'with', label: 'Con fecha', count: stats.with_date },
            { key: 'late', label: 'Retrasadas', count: stats.overdue },
            { key: 'blocked', label: 'Bloqueadas', count: stats.blocked },
          ].map(item => <div key={item.key} className={styles.healthItem}>
            <span className={styles.healthGlyph} data-kind={item.key}>
              {item.key === 'blocked' ? <NavIcon><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></NavIcon>
                : <NavIcon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></NavIcon>}
            </span><strong>{item.count}</strong><small>{item.label}</small>
          </div>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Distribución por estado</h3></div>
        <div className={styles.chartPanel}>
          <div className={styles.donut} style={{ background: donut(workflow) }}
            role="img" aria-label={`Distribución de ${stats.total} tareas por estado`}>
            <span className={styles.donutCenter}><strong>{stats.total}</strong><small>tareas</small></span>
          </div>
          <div className={styles.legend}>
            {workflow.map(item => <div key={item.key} className={styles.legendRow}>
              <i style={{ backgroundColor: item.color }}/>
              <span>{item.label}</span>
              <strong>{item.total}</strong>
              <small>{stats.total ? Math.round(100 * item.total / stats.total) : 0}%</small>
            </div>)}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Prioridades</h3></div>
        <div className={styles.chartPanel}>
          <div className={styles.donut} style={{ background: donut(priorities) }}
            role="img" aria-label={`Distribución de ${stats.total} tareas por prioridad`}>
            <span className={styles.donutCenter}><strong>{stats.total}</strong><small>tareas</small></span>
          </div>
          <div className={styles.legend}>
            {priorities.filter(item => item.total > 0 || stats.total === 0).map(item =>
              <div key={item.key} className={styles.legendRow}>
                <i style={{ backgroundColor: item.color }}/>
                <span>{item.label}</span>
                <strong>{item.total}</strong>
                <small>{stats.total ? Math.round(100 * item.total / stats.total) : 0}%</small>
              </div>)}
          </div>
        </div>
      </section>
    </div>

    <div className={styles.middlePanels}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Tareas próximas</h3>
          <button type="button" onClick={() => onOpenView('board')}>Ver tablero →</button>
        </div>
        <div className={styles.taskList}>
          {data.deadlines.map(task => <button className={styles.task} key={task.id}
            type="button" onClick={() => onOpenCard(task.id)} title={task.title}>
            <span className={styles.taskTitle}><span className={styles.dot}
              style={{ backgroundColor: STATE_COLORS[task.state] }}/>{task.title}</span>
            <span className={styles.dateText}>{dateText(task.due_date)}</span>
            <span className={styles.priority} data-priority={task.priority || 'sin_prioridad'}>
              {priorityLabel(task.priority)}
            </span>
          </button>)}
          {data.deadlines.length === 0 && <p className={styles.empty}>No hay tareas pendientes con una fecha límite.</p>}
        </div>
      </section>
      <section className={styles.panel}>
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

    <div className={styles.bottomPanels}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Miembros del tablero</h3>
          <span className={styles.secondaryMeta}>{stats.member_count} asignados</span>
        </div>
        <div className={styles.memberAvatars}>
          {data.members.map(person =>
            <span key={person.id} title={`${person.name} · ${person.total} tareas`}>
              <Avatar id={person.id} name={person.name} src={person.avatar_url} size={38}/>
            </span>)}
          {stats.member_count > data.members.length &&
            <span className={styles.more}>+{stats.member_count - data.members.length}</span>}
          {data.members.length === 0 && <p className={styles.empty}>Todavía no hay personas asignadas.</p>}
        </div>
        <small className={styles.panelNote}>Personas asignadas a las tareas del tablero</small>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Etiquetas más usadas</h3></div>
        <div className={styles.tagList}>
          {data.labels.map(label => <span key={label.id} className={styles.tag}
            data-tone={label.tone} title={label.name}>
            <span>{label.name}</span><strong>{label.total}</strong>
          </span>)}
          {data.labels.length === 0 && <p className={styles.empty}>No hay etiquetas asignadas.</p>}
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h3>Archivos recientes</h3></div>
        <div className={styles.files}>
          {data.files.map(file => <button type="button" key={file.id}
            className={styles.file} onClick={() => onOpenCard(file.card_id)}
            title={`Abrir tarea: ${file.card_title}`}>
            <span className={styles.fileIcon}>
              <NavIcon><path d="M6 3h9l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 14h7M9 18h6"/></NavIcon>
            </span>
            <span><strong>{file.name}</strong><small>{file.card_title}</small></span>
            <span className={styles.fileDate}>{file.created_at ? formatRelative(file.created_at) : ''}</span>
          </button>)}
          {data.files.length === 0 && <p className={styles.empty}>No hay adjuntos en este tablero.</p>}
        </div>
      </section>
    </div>
  </section>
}
