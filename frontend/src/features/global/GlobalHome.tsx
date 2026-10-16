import { useEffect, useMemo, useState } from 'react'
import { api, type Profile } from '../../api'
import type { MyMeeting, MyTask } from './MyTasksSurface'
import { GlobalViewLoading } from './GlobalViewLoading'
import styles from './GlobalHome.module.css'

export type HomeProject = {
  id: number
  name: string
  workspace_id: number
  workspace_name: string
  role: string
  board_count: number
  card_count: number
  completed_count: number
}
type HomeProjects = { projects: HomeProject[]; has_more: boolean }
type HomeTasks = {
  tasks: MyTask[]
  meetings: MyMeeting[]
  summary: { total: number; overdue: number; in_progress: number; done: number }
}
type HomeNotice = {
  id: number
  body: string
  kind: string
  read_at: string | null
  created_at: string | null
  card: Pick<MyTask, 'id' | 'board_id' | 'project_id' | 'workspace_id'> | null
}
type HomeInvitation = {
  id: number
  status: 'pending' | 'accepted' | 'rejected'
  workspace_name: string
  project_name: string | null
}
type HomeData = {
  tasks: HomeTasks
  projects: HomeProjects
  notifications: HomeNotice[]
  invitations: HomeInvitation[]
}
type Props = {
  profile: Profile
  onShowTasks: (state?: 'all' | 'overdue') => void
  onShowInbox: () => void
  onOpenTask: (task: Pick<MyTask, 'id' | 'board_id' | 'project_id' | 'workspace_id'>) => Promise<void>
  onOpenMeeting: (meeting: MyMeeting) => Promise<void>
  onOpenProject: (project: HomeProject) => Promise<void>
}

function Icon({ name }: { name: 'check' | 'alert' | 'calendar' | 'bell' | 'arrow' | 'message' | 'users' }) {
  const paths = {
    check: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></>,
    alert: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    message: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m6 8 6 5 6-5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m2 9v-3a6 6 0 0 0-2-4"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65">{paths[name]}</svg>
}

function localToday() {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-')
}

function meetingTime(meeting: MyMeeting) {
  if (meeting.all_day) return 'Todo el día'
  return meeting.start_time && meeting.end_time
    ? `${meeting.start_time}–${meeting.end_time}`
    : meeting.start_time ?? 'Sin hora'
}

function dueLabel(task: MyTask) {
  if (!task.due_date) return 'Sin vencimiento'
  const date = new Date(task.due_date.slice(0, 10) + 'T12:00:00')
  return (task.overdue ? 'Venció el ' : 'Vence el ') + date.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long',
  })
}

function noticeTime(date: string | null) {
  return date ? new Date(date).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : ''
}

export function GlobalHome({ profile, onShowTasks, onShowInbox, onOpenTask, onOpenMeeting, onOpenProject }: Props) {
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [navigationError, setNavigationError] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const options = { signal: controller.signal }
    void Promise.all([
      api<HomeTasks>(`/my/tasks?today=${localToday()}&page=1`, options),
      api<HomeProjects>('/my/home/projects', options),
      api<HomeNotice[]>('/notifications', options),
      api<HomeInvitation[]>('/my/invitations', options),
    ]).then(([tasks, projects, notifications, invitations]) => {
      if (!controller.signal.aborted) setData({ tasks, projects, notifications, invitations })
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error
        ? cause.message : 'No se pudo cargar el resumen.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [profile.user.id, reload])

  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const dateLabel = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const pendingInvites = data?.invitations.filter(invite => invite.status === 'pending') ?? []
  const unread = data?.notifications.filter(note => !note.read_at).length ?? profile.unread
  const meetings = data?.tasks.meetings ?? []
  const projects = data?.projects.projects ?? []
  const allTasks = data?.tasks.tasks ?? []
  const attentionTasks = useMemo(() => allTasks.filter(task =>
    task.workflow_state !== 'done' && task.workflow_state !== 'backlog'
  ).sort((a, b) => Number(b.overdue) - Number(a.overdue)
    || (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')
    || a.id - b.id).slice(0, 6), [allTasks])
  const recent = data?.notifications.slice(0, 5) ?? []
  const shownProjects = expandedProjects ? projects : projects.slice(0, 3)

  async function navigate(task: () => Promise<void>) {
    if (busy) return
    setNavigationError('')
    setBusy(true)
    try { await task() }
    catch (cause) { setNavigationError(cause instanceof Error ? cause.message : 'No se pudo abrir el destino.') }
    finally { setBusy(false) }
  }

  if (loading && !data) return <section className={`${styles.root} global-home-view`} aria-label="Cargando Inicio">
    <GlobalViewLoading variant="home" title="Cargando Inicio" description="Preparando tus tareas, proyectos y actividad." />
  </section>

  return <section className={`${styles.root} global-home-view`} aria-label="Inicio global">
    <header className={styles.heading}>
      <div>
        <h1>{greeting}, {profile.user.first_name || profile.user.name} <span aria-hidden="true">👋</span></h1>
        <p>Esto es lo importante de tus Workspaces hoy.</p>
      </div>
      <span className={styles.today}><Icon name="calendar"/>{dateLabel}</span>
    </header>
    {(error || navigationError) && <p className={styles.error} role="alert">
      {error || navigationError}
      {error && <button type="button" onClick={() => setReload(value => value + 1)}>Reintentar</button>}
    </p>}
    <div className={styles.kpis}>
      <button type="button" onClick={() => onShowTasks('all')} className={styles.kpi}>
        <span>Mis tareas</span><strong>{data?.tasks.summary.total ?? '—'}</strong>
        <small>Ver mis tareas <Icon name="arrow"/></small><i className={styles.kpiIcon}><Icon name="check"/></i>
      </button>
      <button type="button" onClick={() => onShowTasks('overdue')} className={styles.kpi}>
        <span>Vencidas</span><strong className={styles.danger}>{data?.tasks.summary.overdue ?? '—'}</strong>
        <small>Revisar pendientes <Icon name="arrow"/></small><i className={`${styles.kpiIcon} ${styles.alertIcon}`}><Icon name="alert"/></i>
      </button>
      <button type="button" onClick={() => onShowTasks('all')} className={styles.kpi}>
        <span>Reuniones de hoy</span><strong>{data?.tasks.meetings.length ?? '—'}</strong>
        <small>Ver reuniones <Icon name="arrow"/></small><i className={`${styles.kpiIcon} ${styles.calendarIcon}`}><Icon name="calendar"/></i>
      </button>
      <button type="button" onClick={onShowInbox} className={styles.kpi}>
        <span>Avisos sin leer</span><strong>{data ? unread : '—'}</strong>
        <small>Ir a la bandeja <Icon name="arrow"/></small><i className={`${styles.kpiIcon} ${styles.bellIcon}`}><Icon name="bell"/></i>
      </button>
    </div>
    <div className={styles.dashboard}>
      <div className={styles.topPanels}>
        {meetings.length > 0 && <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>Reuniones de hoy <span className={styles.pill}>{meetings.length}</span></h2>
            <button type="button" className={styles.textButton} onClick={() => onShowTasks('all')}>Ver todas <Icon name="arrow"/></button>
          </div>
          <div className={styles.panelScroll}>
            {meetings.map(meeting => <button type="button" key={meeting.id}
              className={styles.meeting} disabled={busy} title="Abrir calendario del proyecto"
              onClick={() => void navigate(() => onOpenMeeting(meeting))}>
              <span className={styles.meetingTime}>{meetingTime(meeting)}</span>
              <span className={styles.rowInfo}><strong>{meeting.title}</strong>
                <small>{meeting.workspace_name} · {meeting.project_name}{meeting.location ? ` · ${meeting.location}` : ''}</small>
              </span>
              <Icon name="arrow"/>
            </button>)}
          </div>
        </section>}
        <section className={`${styles.panel} ${meetings.length === 0 ? styles.fullWidth : ''}`}>
          <div className={styles.panelHeading}>
            <h2>Tareas que requieren atención</h2>
            <button type="button" className={styles.textButton} onClick={() => onShowTasks('all')}>Ver mis tareas <Icon name="arrow"/></button>
          </div>
          <div className={styles.panelScroll}>
            {attentionTasks.length === 0 && <p className={styles.empty}>No tienes tareas pendientes que mostrar.</p>}
            {attentionTasks.map(task => <button type="button" key={task.id} className={styles.attention}
              disabled={busy} title="Abrir Card" onClick={() => void navigate(() => onOpenTask(task))}>
              <i className={task.overdue ? styles.redDot : styles.goldDot} aria-hidden="true"/>
              <span className={styles.rowInfo}><strong>{task.title}</strong>
                <small>{task.project_name} · {dueLabel(task)}</small>
              </span>
              <span className={task.overdue ? styles.overdueTag : styles.pendingTag}>
                {task.overdue ? 'Vencida' : task.due_date ? 'Próxima' : 'Pendiente'}
              </span>
            </button>)}
          </div>
        </section>
      </div>
      <div className={styles.bottomPanels}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>Mis proyectos <span className={styles.pill}>{projects.length}{data?.projects.has_more ? '+' : ''}</span></h2>
            {projects.length > 3 && <button type="button" className={styles.textButton}
              onClick={() => setExpandedProjects(value => !value)}>
              {expandedProjects ? 'Ver menos' : 'Ver proyectos'} <Icon name="arrow"/>
            </button>}
          </div>
          <div className={styles.projectScroll}>
            {projects.length === 0 && <p className={styles.empty}>Todavía no tienes proyectos accesibles.</p>}
            <div className={styles.projectGrid}>
              {shownProjects.map(project => {
                const percent = project.card_count > 0
                  ? Math.round(project.completed_count * 100 / project.card_count) : 0
                return <button className={styles.projectCard} type="button" key={project.id}
                  disabled={busy} onClick={() => void navigate(() => onOpenProject(project))}>
                  <span className={styles.workspaceName}>{project.workspace_name}</span>
                  <strong>{project.name}</strong>
                  <small>{project.role === 'responsable' ? 'Responsable' : project.role === 'editor' ? 'Editor'
                    : project.role === 'lector' ? 'Lector' : 'Cliente'}</small>
                  <span className={styles.projectSpacer}/>
                  <span className={styles.progress} aria-label={`${project.completed_count} de ${project.card_count} Cards completadas`}>
                    <span style={{ width: `${percent}%` }}/>
                  </span>
                  <span className={styles.projectMeta}>{project.board_count} {project.board_count === 1 ? 'tablero' : 'tableros'} · {project.completed_count}/{project.card_count} Cards</span>
                </button>
              })}
            </div>
            {data?.projects.has_more && <p className={styles.truncation}>Se muestran los primeros 100 proyectos.</p>}
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2>Actividad reciente</h2>
            <button type="button" className={styles.textButton} onClick={onShowInbox}>Abrir bandeja <Icon name="arrow"/></button>
          </div>
          <div className={styles.panelScroll}>
            {pendingInvites.length > 0 && <button type="button" className={styles.activity} onClick={onShowInbox}>
              <span className={`${styles.activityIcon} ${styles.inviteIcon}`}><Icon name="users"/></span>
              <span className={styles.rowInfo}><strong>{pendingInvites.length === 1 ? 'Tienes una invitación pendiente' : `Tienes ${pendingInvites.length} invitaciones pendientes`}</strong>
                <small>Responder desde Bandeja de entrada</small></span><i className={styles.unreadDot}/>
            </button>}
            {recent.length === 0 && pendingInvites.length === 0 && <p className={styles.empty}>No hay actividad reciente.</p>}
            {recent.map(note => <button type="button" key={note.id}
              className={styles.activity} disabled={busy}
              onClick={() => note.card ? void navigate(() => onOpenTask(note.card!)) : onShowInbox()}
              title={note.card ? 'Abrir Card relacionada' : 'Abrir Bandeja de entrada'}>
              <span className={`${styles.activityIcon} ${note.kind === 'comment' ? styles.commentIcon : styles.assignIcon}`}>
                <Icon name={note.kind === 'comment' ? 'message' : 'check'}/>
              </span>
              <span className={styles.rowInfo}><strong>{note.body}</strong>
                <small>{noticeTime(note.created_at)}</small></span>
              {!note.read_at && <i className={styles.unreadDot} aria-label="Sin leer"/>}
            </button>)}
          </div>
        </section>
      </div>
    </div>
  </section>
}
