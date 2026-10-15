import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { api, type Project, type WorkflowState } from '../../api'
import { Avatar } from '../../shared/ui'
import { NavIcon } from '../../shared/icons'
import { cachedProjectRequest } from '../../shared/projectRequestCache'
import { ProjectContentLoading } from './ProjectContentLoading'
import styles from './ProjectDashboard.module.css'

type Summary = {
  total: number; completed: number; in_progress: number; review: number
  pending: number; backlog: number; overdue: number
  start_date: string | null; end_date: string | null; member_count: number
}
type ColumnDistribution = { name: string; color: string | null; workflow_state: WorkflowState; total: number }
type BoardSummary = { id: number; name: string; position: number; total: number; completed: number; start_date: string | null; end_date: string | null }
type DashboardTask = { id: number; title: string; board_id: number; board_name: string; due_date: string }
type Milestone = DashboardTask & { state: WorkflowState }
type Activity = {
  id: number; type: string; card_title: string; card_id: number
  board_id: number; board_name: string; user_name: string; user_id: number | null
  avatar_url: string | null; created_at: string
}
type Dashboard = {
  summary: Summary
  members: { id: number; name: string; avatar_url: string | null }[]
  columns: ColumnDistribution[]
  boards: BoardSummary[]
  milestones: Milestone[]
  upcoming: DashboardTask[]
  overdue_tasks: DashboardTask[]
  activity: Activity[]
}
type Props = { project: Project; onOpenGantt: () => void; onOpenBoards: () => void; onBoardSelect: (id: number) => void }

const COLORS: Record<WorkflowState, string> = {
  backlog: '#94a3b0', pending: '#478bf7', in_progress: '#f49b44', review: '#a26ae9', done: '#26ad7c',
}
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function day(iso: string | null) {
  if (!iso) return null
  const ms = Date.parse(iso.slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(ms) ? null : ms
}
function formatDate(iso: string | null) {
  if (!iso) return 'Sin definir'
  const ms = day(iso)
  return ms === null ? 'Sin definir' : new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function percent(value: number, total: number) { return total ? Math.round(100 * value / total) : 0 }
function monthStart(ms: number) { const date = new Date(ms); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) }
function addMonths(ms: number, amount: number) { const date = new Date(ms); return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1) }
function panelIcon(name: 'progress'|'tasks'|'dates'|'team') {
  if (name === 'progress') return <NavIcon><path d="M5 20v-5M10 20V7M15 20v-9M20 20V4"/></NavIcon>
  if (name === 'tasks') return <NavIcon><path d="M9 5h12M9 12h12M9 19h12"/><path d="m3 5 1 1 2-2M3 12h3M3 19h3"/></NavIcon>
  if (name === 'dates') return <NavIcon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></NavIcon>
  return <NavIcon><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M19 21v-3a6 6 0 0 0-2-4.5"/></NavIcon>
}
function Kpi({ kind, title, children }: { kind: 'progress'|'tasks'|'dates'|'team'; title: string; children: ReactNode }) {
  return <article className={styles.kpi}><div className={styles.kpiHead}>
    <span className={styles.kpiIcon}>{panelIcon(kind)}</span><span className={styles.kpiTitle}>{title}</span>
  </div><div className={styles.kpiBody}>{children}</div></article>
}
function Track({ width, color }: { width: number; color?: string }) {
  return <div className={styles.track}><div className={styles.trackFill}
    style={{ width: `${Math.max(0, Math.min(100, width))}%`, backgroundColor: color ?? 'var(--accent)' }} /></div>
}
function Distribution({ rows, total }: { rows: ColumnDistribution[]; total: number }) {
  const gradient = useMemo(() => {
    if (!total) return 'var(--line)'
    let at = 0
    const stops = rows.filter((row) => row.total > 0).map((row) => {
      const start = at
      at += row.total / total * 100
      const color = row.color ?? COLORS[row.workflow_state]
      return `${color} ${start.toFixed(3)}% ${Math.min(100, at).toFixed(3)}%`
    })
    return stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--line)'
  }, [rows, total])
  return <div className={styles.distBody}>
    <div className={styles.donut} role="img" aria-label={rows.map((row) => `${row.name}: ${row.total}`).join(', ')}
      style={{ background: gradient }}>
      <div className={styles.donutInner}><strong>{total}</strong><span>tareas</span></div>
    </div>
    <div className={styles.distLegend}>
      {rows.map((row, index) => <div key={`${row.workflow_state}:${row.name}:${row.color}:${index}`} className={styles.distRow}
        title={`${row.name}: ${row.total} tareas`}>
        <i className={styles.dot} style={{ backgroundColor: row.color ?? COLORS[row.workflow_state] }}/>
        <span className={styles.distName}>{row.name}</span>
        <strong>{row.total}</strong><small>{percent(row.total, total)}%</small>
      </div>)}
      {!rows.length && <p className={styles.empty}>No hay tareas todavía.</p>}
    </div>
  </div>
}
function stateName(state: WorkflowState) {
  return state === 'done' ? 'Completado' : state === 'review' ? 'En revisión' : state === 'in_progress' ? 'En progreso' : state === 'backlog' ? 'Backlog' : 'Pendiente'
}
function timeSince(iso: string) {
  const elapsed = Date.now() - Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(elapsed) || elapsed < 0) return formatDate(iso)
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`
  if (minutes < 10080) return `hace ${Math.floor(minutes / 1440)} d`
  return formatDate(iso)
}
function activityVerb(type: string) {
  const verbs: Record<string,string> = {
    created: 'creó', moved: 'movió', updated: 'actualizó', commented: 'comentó en',
    completed: 'completó', assigned: 'asignó', unassigned: 'desasignó',
  }
  return verbs[type] ?? 'actualizó'
}

function Timeline({ boards, anchor, onOpenGantt, onBoardSelect }: {
  boards: BoardSummary[]; anchor: number; onOpenGantt: () => void; onBoardSelect: (id: number) => void
}) {
  const [shift, setShift] = useState(0)
  const start = addMonths(anchor, shift)
  const end = addMonths(start, 4)
  const now = Date.now()
  const allPlanned = boards.filter((board) => board.start_date && board.end_date)
  const visible = allPlanned.filter((board) => {
    const from = day(board.start_date), to = day(board.end_date)
    return from !== null && to !== null && from < end && to >= start
  }).slice(0, 7)
  const months = Array.from({ length: 4 }, (_, i) => addMonths(start, i))
  const rowOffset = (ms: number) => (ms - start) / (end - start) * 100
  return <section className={`${styles.panel} ${styles.timelinePanel}`} aria-label="Cronograma resumido">
    <div className={styles.panelHead}><h2>Cronograma del proyecto</h2><div className={styles.timelineTools}>
      <button type="button" onClick={() => setShift(0)}>Hoy</button>
      <button type="button" aria-label="Cuatro meses anteriores" onClick={() => setShift((value) => value - 4)}><NavIcon><path d="m15 18-6-6 6-6"/></NavIcon></button>
      <button type="button" aria-label="Cuatro meses siguientes" onClick={() => setShift((value) => value + 4)}><NavIcon><path d="m9 18 6-6-6-6"/></NavIcon></button>
      <button type="button" className={styles.ganttLink} onClick={onOpenGantt}>Gantt completo <NavIcon><path d="m9 18 6-6-6-6"/></NavIcon></button>
    </div></div>
    <div className={styles.timelineHeader}><span>Tablero</span><div className={styles.monthHeader}>
      {months.map((month) => <span key={month}>{MONTHS[new Date(month).getUTCMonth()]} {new Date(month).getUTCFullYear()}</span>)}
    </div></div>
    <div className={styles.timelineRows}>
      {visible.map((board) => {
        const a = day(board.start_date) ?? start, b = day(board.end_date) ?? end
        const from = Math.max(start, a), to = Math.min(end, b + 86400000)
        const left = Math.max(0, rowOffset(from)), width = Math.max(1, rowOffset(to) - left)
        return <div key={board.id} className={styles.timelineRow}>
          <button type="button" title={board.name} className={styles.timelineLabel}
            onClick={() => onBoardSelect(board.id)}>{board.name}</button>
          <div className={styles.timelineLanes}>
            {months.map((month) => <i key={month}/>)}
            {now >= start && now < end && <span className={styles.todayMarker} style={{ left: `${rowOffset(now)}%` }}/>}
            <button type="button" className={styles.timelineBar} onClick={() => onBoardSelect(board.id)}
              title={`${board.name}: ${formatDate(board.start_date)} — ${formatDate(board.end_date)}`}
              style={{ left: `${left}%`, width: `${width}%` }}><span style={{ width: `${percent(board.completed, board.total)}%` }}/></button>
          </div>
        </div>
      })}
      {visible.length === 0 && <p className={styles.timelineEmpty}>
        {allPlanned.length ? 'Sin tableros planificados en estos meses. Utiliza las flechas para navegar.' : 'Los tableros aún no tienen fechas de planificación.'}
      </p>}
    </div>
    <div className={styles.timelineFoot}>Vista resumida por tableros · <button type="button" onClick={onOpenGantt}>Consultar tareas y dependencias en el Gantt</button></div>
  </section>
}
function LoadingPreview() {
  return <div className={styles.preview}><div className={styles.kpis}>{Array.from({ length:4 },(_,i)=><div key={i} className={styles.placeholder}/>)}</div>
    <div className={styles.middle}>{Array.from({ length:3 },(_,i)=><div key={i} className={styles.placeholder}/>)}</div>
    <div className={styles.bottom}><div className={styles.placeholder}/><div className={styles.placeholder}/></div></div>
}
export function ProjectSurface({ project, onOpenGantt, onOpenBoards, onBoardSelect }: Props) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const path = `/projects/${project.id}/dashboard`
    setLoading(true)
    setError('')
    setData(null)
    void cachedProjectRequest(path, (signal) => api<Dashboard>(path, { signal }), controller.signal)
      .then((response) => { if (!controller.signal.aborted) setData(response) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen del proyecto.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [project.id, retry])
  if (loading && !data) return <ProjectContentLoading title="Cargando vista general"
    description="Preparando indicadores, hitos y cronograma del proyecto…"><LoadingPreview/></ProjectContentLoading>
  if (!data) return <section className={styles.panel} role="alert">{error || 'No hay datos disponibles.'}
    <button type="button" className={styles.retry} onClick={() => setRetry((value) => value + 1)}>Reintentar</button></section>
  const { summary, boards, milestones, members } = data
  const done = percent(summary.completed, summary.total)
  const anchorDate = (() => {
    const first = day(summary.start_date), last = day(summary.end_date), now = Date.now()
    return monthStart(first !== null && (now < first || (last !== null && now > last)) ? first : now)
  })()
  return <div className={styles.dashboard}>
    <div className={styles.kpis}>
      <Kpi kind="progress" title="Progreso general"><strong className={styles.kpiValue}>{done}%</strong><Track width={done}/></Kpi>
      <Kpi kind="tasks" title="Tareas"><strong className={styles.kpiValue}>{summary.completed} / {summary.total}</strong>
        <Track width={done}/><span className={styles.kpiSub}>{summary.in_progress} en progreso · {summary.pending} pendientes · {summary.review} en revisión</span></Kpi>
      <Kpi kind="dates" title="Fechas"><strong className={styles.kpiDate}>{formatDate(summary.start_date)} — {formatDate(summary.end_date)}</strong>
        <span className={styles.kpiSub}>{summary.overdue ? `${summary.overdue} tareas retrasadas` : 'Sin tareas retrasadas'}</span></Kpi>
      <Kpi kind="team" title="Equipo"><strong className={styles.kpiValue}>{summary.member_count} {summary.member_count === 1 ? 'miembro' : 'miembros'}</strong>
        <div className={styles.avatars}>{members.map((member) => <span key={member.id} title={member.name}>
          <Avatar id={member.id} name={member.name} src={member.avatar_url} size={28}/>
        </span>)}{summary.member_count > members.length && <b>+{summary.member_count - members.length}</b>}</div></Kpi>
    </div>
    <div className={styles.middle}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>Tareas por tablero</h2><button type="button" onClick={onOpenBoards}>Ver tableros</button></div>
        <div className={styles.boardBars}>{[...boards].sort((a,b)=>b.total-a.total).slice(0,6).map((board) =>
          <button type="button" className={styles.boardRow} key={board.id} onClick={() => onBoardSelect(board.id)} title={board.name}>
            <span>{board.name}</span><Track width={percent(board.total, Math.max(...boards.map(x=>x.total),1))}
              color="var(--accent)"/><strong>{board.total}</strong>
          </button>)}</div>
        {!boards.length && <p className={styles.empty}>Todavía no existen tableros.</p>}
      </section>
      <section className={styles.panel}><div className={styles.panelHead}><h2>Estado de tareas</h2></div>
        <Distribution rows={data.columns} total={summary.total}/></section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>Hitos próximos</h2><button type="button" onClick={onOpenGantt}>Ver Gantt</button></div>
        <div className={styles.milestoneList}>{milestones.map((item) => <button type="button" key={item.id}
          className={styles.milestone} onClick={() => onBoardSelect(item.board_id)} title={item.board_name}>
          <span className={styles.milestoneGlyph} style={{ '--milestone-color': COLORS[item.state] } as CSSProperties}>◆</span>
          <span className={styles.milestoneName}>{item.title}</span>
          <time>{formatDate(item.due_date)}</time><span className={styles.milestoneState}>{stateName(item.state)}</span>
        </button>)}</div>
        {!milestones.length && <p className={styles.empty}>Sin hitos planificados.</p>}
      </section>
    </div>
    <div className={styles.bottom}>
      <Timeline key={project.id} boards={boards} anchor={anchorDate} onOpenGantt={onOpenGantt} onBoardSelect={onBoardSelect}/>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>Actividad reciente</h2></div>
        <div className={styles.activityList}>{data.activity.map((entry) => <button type="button" className={styles.activity}
          key={entry.id} onClick={() => onBoardSelect(entry.board_id)} title={entry.board_name}>
          <span className={styles.activityAvatar}><Avatar id={entry.user_id ?? 0} name={entry.user_name} src={entry.avatar_url} size={30}/></span>
          <span className={styles.activityText}><strong>{entry.user_name}</strong> {activityVerb(entry.type)} una tarea
            <small>{entry.card_title} · {entry.board_name}</small></span>
          <time>{timeSince(entry.created_at)}</time>
        </button>)}</div>
        {!data.activity.length && <p className={styles.empty}>Todavía no hay actividad registrada.</p>}
      </section>
    </div>
    <div className={styles.tasksFoot}>
      <section><strong>Próximas tareas</strong>{data.upcoming.length ? data.upcoming.map((item) =>
        <button key={item.id} type="button" onClick={() => onBoardSelect(item.board_id)}>
          <span>{item.title}</span><time>{formatDate(item.due_date)}</time>
        </button>) : <p>Sin vencimientos próximos.</p>}</section>
      <section><strong>Tareas retrasadas · {summary.overdue}</strong>{data.overdue_tasks.length ? data.overdue_tasks.map((item) =>
        <button key={item.id} type="button" onClick={() => onBoardSelect(item.board_id)}>
          <span>{item.title}</span><time>{formatDate(item.due_date)}</time>
        </button>) : <p>Sin retrasos pendientes.</p>}</section>
    </div>
  </div>
}
