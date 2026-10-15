import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { api, type Project, type WorkflowState } from '../../api'
import { Avatar } from '../../shared/ui'
import { NavIcon, PlusIcon } from '../../shared/icons'
import { cachedProjectRequest } from '../../shared/projectRequestCache'
import styles from './ProjectBoards.module.css'

type BoardColumnSummary = {
  id: number; name: string; color: string | null; workflow_state: WorkflowState
  position: number; count: number
}
type BoardMember = { id: number; name: string; avatar_url: string | null }
type BoardSummary = {
  id: number; name: string; position: number; total: number; completed: number; overdue: number
  start_date: string | null; end_date: string | null; updated_at: string | null
  member_count: number; members: BoardMember[]; columns: BoardColumnSummary[]
}
type BoardOverview = { can_manage: boolean; boards: BoardSummary[] }
type SortBy = 'position' | 'name' | 'tasks' | 'completion' | 'updated'

const fallbackColors: Record<WorkflowState, string> = {
  backlog: '#8d9da3', pending: '#72a5f6', in_progress: '#f3a65c',
  review: '#ac8ae8', done: '#48b58d',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso.slice(0, 10) + 'T12:00:00')
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function completion(board: BoardSummary) {
  return board.total ? Math.round((board.completed / board.total) * 100) : 0
}

function columnPercent(count: number, total: number) {
  return total > 0 ? Math.round(count / total * 100) : 0
}

function distributionDescription(board: BoardSummary) {
  if (!board.total) return 'Sin tareas'
  return board.columns.map((column) =>
    `${column.name}: ${column.count} tareas (${columnPercent(column.count, board.total)}%)`
  ).join(' · ')
}

function dateRange(board: BoardSummary) {
  const start = formatDate(board.start_date)
  const end = formatDate(board.end_date)
  if (start && end) return start === end ? start : `${start} → ${end}`
  if (start) return `Desde ${start}`
  if (end) return `Hasta ${end}`
  return 'Sin fechas planificadas'
}


type DiagramEntry = {
  column: BoardColumnSummary
  percent: number
  color: string
  anchorAngle: number
  side: 'left' | 'right'
}

function diagramEntries(board: BoardSummary): DiagramEntry[] {
  let current = -90
  const angleWhenEmpty: Record<WorkflowState, number> = {
    backlog: -140, pending: -45, in_progress: 0, review: 45, done: 150,
  }
  return board.columns.map((column) => {
    const percent = board.total ? column.count / board.total * 100 : 0
    const angle = percent
      ? current + (percent / 100 * 360 / 2)
      : angleWhenEmpty[column.workflow_state]
    current += percent / 100 * 360
    return {
      column, percent,
      color: column.color ?? fallbackColors[column.workflow_state],
      anchorAngle: angle,
      side: column.workflow_state === 'backlog' || column.workflow_state === 'done' ? 'left' : 'right',
    }
  })
}

function readableColor(color: string) {
  const hex = color.startsWith('#') ? color.slice(1) : ''
  const expanded = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return '#ffffff'
  const values = [0, 2, 4].map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255)
  const linear = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 > 0.44 ? '#1d3432' : '#ffffff'
}

function DonutDistribution({ board }: { board: BoardSummary }) {
  const entries = diagramEntries(board)
  const left = entries.filter((entry) => entry.side === 'left')
  const right = entries.filter((entry) => entry.side === 'right')
  // Draw inside a fixed, compact viewBox. The entire diagram scales as a
  // single element so labels and connectors cannot outgrow the card.
  const height = Math.max(224, Math.max(left.length, right.length) * 36 + 40)
  const cx = 320
  const cy = height / 2
  const r = 72
  const ringWidth = 28
  const circumference = 2 * Math.PI * r
  const labelHeight = 24
  const yFor = (index: number, count: number) => (
    cy + (index - (count - 1) / 2) * Math.min(49, (height - 42) / Math.max(count, 1))
  )
  let offset = 0
  const segmentCircles = entries.filter(({ column }) => column.count > 0).map((entry) => {
    const arc = entry.percent / 100 * circumference
    const result = <circle key={entry.column.id} cx={cx} cy={cy} r={r} fill="none" stroke={entry.color}
      strokeWidth={ringWidth} strokeDasharray={`${arc} ${circumference - arc}`}
      strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`}>
      <title>{`${entry.column.name}: ${columnPercent(entry.column.count, board.total)} % (${entry.column.count} tareas)`}</title>
    </circle>
    offset += arc
    return result
  })
  const connectors = (side: 'left' | 'right', list: DiagramEntry[]) => list.map((entry, i) => {
    const rad = entry.anchorAngle * Math.PI / 180
    const x = cx + (r + ringWidth / 2) * Math.cos(rad)
    const y = cy + (r + ringWidth / 2) * Math.sin(rad)
    const targetY = yFor(i, list.length)
    const xEdge = side === 'left' ? 201 : 439
    const elbow = side === 'left' ? 215 : 425
    const pillX = side === 'left' ? 10 : 453
    return <g key={entry.column.id}>
      <path d={`M ${x} ${y} L ${elbow} ${targetY} L ${xEdge} ${targetY}`}
        fill="none" stroke={entry.color} strokeWidth="1.3" strokeLinejoin="round" opacity=".8"/>
      <circle cx={x} cy={y} r="3.5" fill={entry.color} stroke="var(--surface)" strokeWidth="1.7"/>
      <circle cx={xEdge} cy={targetY} r="3.2" fill={entry.color}/>
      <foreignObject x={pillX} y={targetY - labelHeight / 2} width="174" height={labelHeight}>
        <div className={styles.diagramLabel} title={`${entry.column.name}: ${entry.column.count} tareas (${columnPercent(entry.column.count, board.total)} %)`}
          style={{ backgroundColor: entry.color, color: readableColor(entry.color) }}>
          <span>{entry.column.name}</span>
          <strong>{columnPercent(entry.column.count, board.total)} %</strong>
        </div>
      </foreignObject>
    </g>
  })
  return <div className={styles.diagram} aria-label={distributionDescription(board)}>
    <svg viewBox={`0 0 640 ${height}`} role="img" aria-label={distributionDescription(board)}
      preserveAspectRatio="xMidYMid meet">
      <circle cx={cx} cy={cy} r={r} stroke="var(--line)" strokeWidth={ringWidth} fill="none"/>
      {segmentCircles}
      <circle cx={cx} cy={cy} r="59" fill="var(--surface)"/>
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" className={styles.diagramTotal}>{board.total}</text>
      <text x={cx} y={cy + 25} textAnchor="middle" className={styles.diagramCaption}>tareas</text>
      {connectors('left', left)}
      {connectors('right', right)}
    </svg>
  </div>
}

function Card({ board, index, layout, onOpen }: {
  board: BoardSummary; index: number; layout: 'grid' | 'list'; onOpen: () => void
}) {
  const accent = ['#5ebd96', '#73a2ed', '#e6a05e', '#a787da', '#58b5a8'][index % 5]
  const cardStyle = { '--board-accent': accent } as CSSProperties

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return <article
    className={`${styles.card} ${layout === 'list' ? styles.cardList : ''}`}
    style={cardStyle} role="button" tabIndex={0} onClick={onOpen}
    onKeyDown={handleKeyDown} aria-label={`Abrir tablero ${board.name}`}>
    <div className={styles.cardMain}>
      <div className={styles.cardInfo}>
        <div className={styles.cardHeading}>
          <span className={styles.boardNumber}>{String(board.position + 1).padStart(2, '0')}</span>
          <div className={styles.boardName}>
            <h3 title={board.name}>{board.name}</h3>
            <span>{board.overdue > 0
              ? `${board.overdue} tarea${board.overdue === 1 ? '' : 's'} retrasada${board.overdue === 1 ? '' : 's'}`
              : board.total ? `${board.total - board.completed} tareas sin completar` : 'Tablero sin tareas'}</span>
          </div>
        </div>
        <div className={styles.dates} title="Primera fecha planificada y última fecha límite de las Cards, excluido Backlog">
          <NavIcon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></NavIcon>
          {dateRange(board)}
        </div>
      </div>
      <div className={styles.chartArea}>
        <DonutDistribution board={board}/>
      </div>
    </div>
    <div className={styles.footer}>
      <div className={styles.members} aria-label={`${board.member_count} personas asignadas`}>
        {board.members.map((member) => <span key={member.id} title={member.name} className={styles.avatar}>
          <Avatar id={member.id} name={member.name} src={member.avatar_url} size={27}/>
        </span>)}
        {board.member_count > board.members.length && <span className={styles.moreMembers}>+${board.member_count - board.members.length}</span>}
        {board.member_count === 0 && <span className={styles.noMembers}>Sin asignaciones</span>}
      </div>
      <span className={styles.lastUpdate}>{board.updated_at ? `Actualizado: ${formatDate(board.updated_at) ?? '—'}` : 'Sin actividad registrada'}</span>
    </div>
  </article>
}

export function ProjectBoards({ project, onBoardSelect, onRefresh }: {
  project: Project; onBoardSelect: (id: number) => void; onRefresh: () => Promise<unknown>
}) {
  const [data, setData] = useState<BoardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortBy>('position')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [creating, setCreating] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback((signal: AbortSignal) => {
    const path = `/projects/${project.id}/boards/overview`
    return cachedProjectRequest(path, (requestSignal) => api<BoardOverview>(path, { signal: requestSignal }), signal)
  }, [project.id])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setData(null)
    setError('')
    void load(controller.signal).then((response) => {
      if (!controller.signal.aborted) setData(response)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los tableros.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [load, reload])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    const result = (data?.boards ?? []).filter((board) => board.name.toLocaleLowerCase('es').includes(needle))
    const compare = (a: BoardSummary, b: BoardSummary) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true })
        case 'tasks': return b.total - a.total || a.position - b.position
        case 'completion': return completion(b) - completion(a) || a.position - b.position
        case 'updated': return (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || a.position - b.position
        default: return a.position - b.position
      }
    }
    return result.sort(compare)
  }, [data, query, sort])

  async function createBoard(event: FormEvent) {
    event.preventDefault()
    if (!boardName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await api<{ id: number }>(`/projects/${project.id}/boards`, {
        method: 'POST', body: JSON.stringify({ name: boardName.trim() }),
      })
      await onRefresh()
      setCreating(false)
      setBoardName('')
      onBoardSelect(created.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el tablero.')
    } finally { setBusy(false) }
  }


  return <section className={styles.root} aria-label="Tableros del proyecto">
    <div className={styles.toolbar}>
      <div className={styles.title}><h2>Tableros</h2><small>Gestiona y visualiza el progreso de los tableros · {data?.boards.length ?? project.boards.length} en el proyecto</small></div>
      <div className={styles.toolbarActions}>
        <label className={styles.search}>
          <NavIcon><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></NavIcon>
          <input type="search" placeholder="Buscar tableros…" value={query}
            onChange={(event) => setQuery(event.target.value)} aria-label="Buscar tableros"/>
        </label>
        <label className={styles.sortSelect}>
          <NavIcon><path d="m8 4-3 3-3-3M5 7v13M16 20l3-3 3 3M19 17V4"/></NavIcon>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortBy)} aria-label="Ordenar tableros">
            <option value="position">Orden del proyecto</option>
            <option value="name">Nombre (A → Z)</option>
            <option value="tasks">Más tareas primero</option>
            <option value="completion">Mayor avance primero</option>
            <option value="updated">Actualizados recientemente</option>
          </select>
        </label>
        <div className={styles.viewToggle} role="group" aria-label="Presentación de tableros">
          <button type="button" className={layout === 'grid' ? styles.active : ''} aria-label="Vista cuadrícula"
            aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>
            <NavIcon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></NavIcon>
          </button>
          <button type="button" className={layout === 'list' ? styles.active : ''} aria-label="Vista lista"
            aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>
            <NavIcon><path d="M8 5h13M8 12h13M8 19h13"/><circle cx="4" cy="5" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="19" r=".8"/></NavIcon>
          </button>
        </div>
        {data?.can_manage && <button className={styles.addButton} type="button" onClick={() => setCreating(true)}>
          <PlusIcon/> Nuevo tablero
        </button>}
      </div>
    </div>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" onClick={() => setReload((n) => n + 1)}>Reintentar</button></div>}
    {loading && <div className={styles.grid} aria-label="Cargando tableros">
      {Array.from({ length: Math.min(project.boards.length || 3, 6) }, (_, i) =>
        <div key={i} className={styles.skeleton} aria-hidden="true"/>)}
    </div>}
    {!loading && data && <div className={layout === 'grid' ? styles.grid : styles.list}>
      {filtered.map((board, index) => <Card key={board.id} board={board} index={index}
        layout={layout} onOpen={() => onBoardSelect(board.id)} />)}
      {filtered.length === 0 && <p className={styles.empty}>{query ? 'No hay tableros que coincidan con la búsqueda.' : 'Todavía no hay tableros en este proyecto.'}</p>}
    </div>}
    {creating && <div className={styles.modalBackdrop} role="presentation" onClick={() => { if (!busy) setCreating(false) }}>
      <form className={styles.modal} role="dialog" aria-modal="true" aria-label="Crear tablero"
        onClick={(event) => event.stopPropagation()} onSubmit={(event) => void createBoard(event)}>
        <h3>Nuevo tablero</h3>
        <label>Nombre del tablero<input autoFocus required maxLength={120} value={boardName}
          onChange={(event) => setBoardName(event.target.value)} placeholder="Ej. Desarrollo y pruebas" /></label>
        <div className={styles.modalActions}>
          <button type="button" disabled={busy} onClick={() => setCreating(false)}>Cancelar</button>
          <button className={styles.addButton} type="submit" disabled={busy || !boardName.trim()}>{busy ? 'Creando…' : 'Crear tablero'}</button>
        </div>
      </form>
    </div>}
  </section>
}
