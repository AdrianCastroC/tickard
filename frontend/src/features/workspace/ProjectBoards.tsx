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


// Match each segment to its real column, ordered as on the board (Backlog
// always first). The legend is adjacent to the chart, never connected by lines.
function orderedColumns(board: BoardSummary) {
  return [...board.columns].sort((a, b) => {
    if ((a.workflow_state === 'backlog') !== (b.workflow_state === 'backlog')) {
      return a.workflow_state === 'backlog' ? -1 : 1
    }
    return a.position - b.position || a.id - b.id
  })
}

function distributionGradient(board: BoardSummary) {
  if (!board.total) return 'var(--line)'
  let end = 0
  const stops = orderedColumns(board)
    .filter((column) => column.count > 0)
    .map((column) => {
      const start = end
      end = Math.min(100, end + column.count / board.total * 100)
      return `${column.color ?? fallbackColors[column.workflow_state]} ${start.toFixed(4)}% ${end.toFixed(4)}%`
    })
  return stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--line)'
}

// Ensure custom column backgrounds always have legible text.
function readableColor(color: string) {
  const hex = color.trim().replace(/^#/, '')
  const normalized = /^[0-9a-f]{3}$/i.test(hex)
    ? hex.split('').map((digit) => digit + digit).join('')
    : hex
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#ffffff'
  const rgb = [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255)
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  return luminance > 0.42 ? '#1b3430' : '#ffffff'
}

function DonutDistribution({ board }: { board: BoardSummary }) {
  return <div className={styles.diagram}>
    <div className={styles.donut} role="img" aria-label={distributionDescription(board)}
      title={distributionDescription(board)} style={{ background: distributionGradient(board) }}>
      <span className={styles.donutCenter}>
        <strong>{board.total}</strong>
        <small>tareas</small>
      </span>
    </div>
    <div className={styles.diagramLegend} aria-label="Distribución por columnas">
      {orderedColumns(board).map((column) => {
        const background = column.color ?? fallbackColors[column.workflow_state]
        return <div key={column.id} className={styles.legendPill}
          style={{ backgroundColor: background, color: readableColor(background) }}
          title={`${column.name}: ${column.count} tareas (${columnPercent(column.count, board.total)}% del total)`}>
          <span className={styles.legendPillName}>{column.name}</span>
          <strong className={styles.legendPillPercent}>{columnPercent(column.count, board.total)}%</strong>
        </div>
      })}
    </div>
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
        {board.member_count > board.members.length && <span className={styles.moreMembers}>+{board.member_count - board.members.length}</span>}
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
