import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiError, type BacklogResolution, type BoardPayload, type Card, type Profile, type Project, type WorkflowState } from '../../api'
import { BacklogResolutionModal } from '../board/BacklogResolutionModal'
import { CardDrawer } from '../cards/CardDetail'
import styles from './ProjectCalendar.module.css'

type State = Exclude<WorkflowState, 'backlog'>
type Item = { card: Card; boardId: number; boardName: string; state: State; color: string; start: string; end: string }
type Segment = { item: Item; first: number; width: number; lane: number; before: boolean; after: boolean }
type Week = { days: string[]; segments: Segment[]; hidden: number[] }
type Snapshot = { projectId: number; boardIds: string; boards: BoardPayload[] }
type Selection = { cardId: number; boardId: number }
type PendingMove = { cardId: number; columnId: number; position: number; resolution: BacklogResolution }

const STATES: { value: State; label: string; fallback: string }[] = [
  { value: 'pending', label: 'Por hacer', fallback: '#4C8BF5' },
  { value: 'in_progress', label: 'En progreso', fallback: '#F39C4A' },
  { value: 'review', label: 'En revisión', fallback: '#9B6BE8' },
  { value: 'done', label: 'Completado', fallback: '#38A37A' },
]
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_MS = 86400000
const MAX_LANES = 3

function dateKey(date: Date): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-')
}
function localToday(): string {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function parseDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}
function validDate(day: string | null | undefined): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(parseDate(day)) === day
}
function plusDays(day: string, days: number): string {
  return dateKey(new Date(parseDate(day).getTime() + days * DAY_MS))
}
function monthStart(day: string): string { return day.slice(0, 7) + '-01' }
function moveMonth(day: string, delta: number): string {
  const date = parseDate(monthStart(day))
  return dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)))
}
function monthDays(month: string): { weeks: string[][]; first: string; last: string } {
  const first = parseDate(monthStart(month))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  const leading = (first.getUTCDay() + 6) % 7
  const trailing = 6 - ((last.getUTCDay() + 6) % 7)
  const count = leading + last.getUTCDate() + trailing
  const start = dateKey(new Date(first.getTime() - leading * DAY_MS))
  const weeks = Array.from({ length: count / 7 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => plusDays(start, week * 7 + day)))
  return { weeks, first: monthStart(month), last: dateKey(last) }
}
function prettyMonth(day: string): string {
  const title = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDate(day))
  return title[0].toUpperCase() + title.slice(1)
}
function prettyDay(day: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseDate(day))
}
function colorStyle(color: string): CSSProperties {
  return { '--calendar-color': color } as CSSProperties
}
function cardsFromBoards(boards: BoardPayload[]): Item[] {
  return boards.flatMap((board) => board.columns.flatMap((column) => {
    if (column.workflow_state === 'backlog') return []
    const state = column.workflow_state
    const fallback = STATES.find((entry) => entry.value === state)?.fallback ?? '#147a5f'
    return column.cards.flatMap((card) => {
      if (!validDate(card.start_date) || !validDate(card.due_date) || card.start_date > card.due_date) return []
      return [{
        card, boardId: board.board.id, boardName: board.board.name,
        state, color: card.color || column.color || fallback,
        start: card.start_date, end: card.due_date,
      }]
    })
  })).sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end)
    || a.boardName.localeCompare(b.boardName) || a.card.title.localeCompare(b.card.title) || a.card.id - b.card.id)
}
function makeWeek(days: string[], items: Item[]): Week {
  const lanes: { start: string; end: string }[][] = []
  const segments: Segment[] = []
  const hidden = [0, 0, 0, 0, 0, 0, 0]
  const [first, last] = [days[0], days[6]]
  for (const item of items) {
    if (item.start > last || item.end < first) continue
    const start = item.start > first ? item.start : first
    const end = item.end < last ? item.end : last
    let lane = lanes.findIndex((used) => used.every((taken) => end < taken.start || start > taken.end))
    if (lane < 0) lane = lanes.length
    if (lane >= MAX_LANES) {
      days.forEach((day, index) => { if (item.start <= day && item.end >= day) hidden[index]++ })
      continue
    }
    if (!lanes[lane]) lanes[lane] = []
    lanes[lane].push({ start, end })
    const firstColumn = Math.round((parseDate(start).getTime() - parseDate(first).getTime()) / DAY_MS)
    const width = Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_MS) + 1
    segments.push({ item, first: firstColumn, width, lane, before: item.start < first, after: item.end > last })
  }
  return { days, segments, hidden }
}

export function ProjectCalendar({ project, profile }: { project: Project; profile: Profile }) {
  const boardIds = project.boards.map((board) => board.id).join(',')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [month, setMonth] = useState(() => monthStart(localToday()))
  const [mode, setMode] = useState<'month' | 'agenda'>('month')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hiddenBoards, setHiddenBoards] = useState<number[]>([])
  const [hiddenStates, setHiddenStates] = useState<State[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [detailBoard, setDetailBoard] = useState<BoardPayload | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRetry, setDetailRetry] = useState(0)
  const [editMode, setEditMode] = useState<'view' | 'edit'>('view')
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  const load = useCallback(async () => {
    const ids = boardIds.split(',').filter(Boolean).map(Number)
    return Promise.all(ids.map((id) => api<BoardPayload>('/boards/' + id + '?gantt=1')))
  }, [boardIds])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setSelected(null)
    setDetailBoard(null)
    void load().then((boards) => {
      if (!alive) return
      setSnapshot({ projectId: project.id, boardIds, boards })
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setLoading(false)
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el calendario.')
    })
    return () => { alive = false }
  }, [load, project.id, boardIds, reloadKey])

  const boards = snapshot?.projectId === project.id && snapshot.boardIds === boardIds ? snapshot.boards : null
  const allCards = useMemo(() => cardsFromBoards(boards ?? []), [boards])
  const items = useMemo(() => allCards.filter((item) =>
    !hiddenBoards.includes(item.boardId) && !hiddenStates.includes(item.state)), [allCards, hiddenBoards, hiddenStates])
  const range = useMemo(() => monthDays(month), [month])
  const weeks = useMemo(() => range.weeks.map((days) => makeWeek(days, items)), [range, items])
  const monthItems = useMemo(() => items.filter((item) => item.start <= range.last && item.end >= range.first), [items, range])
  const dayItems = useMemo(() => selectedDay ? items.filter((item) => item.start <= selectedDay && item.end >= selectedDay) : [], [items, selectedDay])

  useEffect(() => {
    if (!selected) { setDetailBoard(null); setDetailLoading(false); return }
    let alive = true
    setDetailLoading(true)
    setDetailError(null)
    setDetailBoard(null)
    void api<BoardPayload>('/boards/' + selected.boardId).then((board) => {
      if (!alive) return
      setDetailBoard(board)
      setDetailLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setDetailLoading(false)
      setDetailError(cause instanceof Error ? cause.message : 'No se pudo abrir la Card.')
    })
    return () => { alive = false }
  }, [selected?.cardId, selected?.boardId, detailRetry])

  const cardData = useMemo(() => {
    if (!selected || detailBoard?.board.id !== selected.boardId) return null
    const card = detailBoard.columns.flatMap((column) => column.cards).find((entry) => entry.id === selected.cardId)
    return card ? { card, board: detailBoard } : null
  }, [selected, detailBoard])

  const refresh = useCallback(async () => {
    const next = await load()
    setSnapshot({ projectId: project.id, boardIds, boards: next })
    if (selected) setDetailBoard(await api<BoardPayload>('/boards/' + selected.boardId))
  }, [load, project.id, boardIds, selected])

  function openCard(item: Item) {
    setEditMode('view')
    setSelected({ cardId: item.card.id, boardId: item.boardId })
  }

  async function moveCard(cardId: number, columnId: number, position: number) {
    try {
      await api('/cards/' + cardId + '/move', { method: 'POST', body: JSON.stringify({ column_id: columnId, position }) })
      await refresh()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.code === 'backlog_dependencies') {
        const resolution = (cause.data as { resolution?: BacklogResolution }).resolution
        if (resolution) { setPendingMove({ cardId, columnId, position, resolution }); return }
      }
      throw cause
    }
  }

  const today = localToday()
  if (loading && !boards) return <section className="project-panel" role="status">Cargando calendario del proyecto…</section>
  if (error && !boards) return <section className="project-panel" role="alert"><p>No se pudo cargar el calendario: {error}</p><button className="ghost" type="button" onClick={() => setReloadKey((n) => n + 1)}>Reintentar</button></section>
  if (!boards?.length) return <section className="project-panel">Este proyecto todavía no tiene tableros.</section>

  return <section className={styles.root} aria-label={'Calendario del proyecto ' + project.name}>
    <div className={styles.toolbar}>
      <div className={styles.dateControls}>
        <button className="ghost" type="button" onClick={() => { setMonth(monthStart(today)); setSelectedDay(null) }}>Hoy</button>
        <button className={styles.squareButton} type="button" aria-label="Mes anterior" onClick={() => { setMonth((value) => moveMonth(value, -1)); setSelectedDay(null) }}>‹</button>
        <button className={styles.squareButton} type="button" aria-label="Mes siguiente" onClick={() => { setMonth((value) => moveMonth(value, 1)); setSelectedDay(null) }}>›</button>
        <h2>{prettyMonth(month)}</h2>
      </div>
      <div className={styles.toolbarRight}>
        <div className={styles.modeSwitch} aria-label="Vistas de calendario">
          <button type="button" className={mode === 'month' ? styles.active : undefined} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Mes</button>
          <button type="button" className={mode === 'agenda' ? styles.active : undefined} aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>Agenda</button>
        </div>
        <button className={styles.filterButton} type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>Filtros{hiddenBoards.length + hiddenStates.length ? ' (' + (hiddenBoards.length + hiddenStates.length) + ')' : ''}</button>
      </div>
    </div>

    {error && <div className={styles.inlineError} role="alert">No se pudieron actualizar las Cards: {error}. <button type="button" onClick={() => setReloadKey((n) => n + 1)}>Reintentar</button></div>}
    {filtersOpen && <div className={styles.filters}>
      <div className={styles.filterGroup}><strong>Tableros</strong><div className={styles.filterOptions}>
        {boards.map((board) => <label key={board.board.id}><input type="checkbox" checked={!hiddenBoards.includes(board.board.id)} onChange={() => setHiddenBoards((current) => current.includes(board.board.id) ? current.filter((id) => id !== board.board.id) : [...current, board.board.id])} />{board.board.name}</label>)}
      </div></div>
      <div className={styles.filterGroup}><strong>Estados</strong><div className={styles.filterOptions}>
        {STATES.map((state) => <label key={state.value}><input type="checkbox" checked={!hiddenStates.includes(state.value)} onChange={() => setHiddenStates((current) => current.includes(state.value) ? current.filter((value) => value !== state.value) : [...current, state.value])} /><i className={styles.statusDot} style={{ background: state.fallback }} />{state.label}</label>)}
      </div></div>
      <button className="ghost" type="button" onClick={() => { setHiddenBoards([]); setHiddenStates([]) }}>Mostrar todos</button>
    </div>}

    {mode === 'month' ? <div className={styles.calendar}>
      <div className={styles.weekdayRow}>{WEEKDAYS.map((name) => <div key={name}>{name}</div>)}</div>
      {weeks.map((week) => <div className={styles.week} key={week.days[0]}>
        <div className={styles.daysGrid}>{week.days.map((day, index) => <div key={day} className={[styles.dayCell, day.slice(0, 7) !== month.slice(0, 7) ? styles.outside : '', day === today ? styles.today : ''].filter(Boolean).join(' ')}>
          <button type="button" className={styles.dayNumber} aria-label={'Ver Cards del ' + prettyDay(day)} onClick={() => setSelectedDay((value) => value === day ? null : day)}>{Number(day.slice(-2))}</button>
          {week.hidden[index] > 0 && <button type="button" className={styles.moreButton} onClick={() => setSelectedDay(day)}>+{week.hidden[index]} más</button>}
        </div>)}</div>
        <div className={styles.segments}>{week.segments.map((part) => <button
          key={part.item.card.id + '-' + week.days[0]}
          type="button"
          className={[styles.segment, part.before ? styles.continuesBefore : '', part.after ? styles.continuesAfter : ''].filter(Boolean).join(' ')}
          style={Object.assign(colorStyle(part.item.color), {
            left: String(part.first / 7 * 100) + '%',
            width: String(part.width / 7 * 100) + '%',
            top: String(34 + part.lane * 29) + 'px',
          })}
          title={part.item.card.title + ' · ' + part.item.boardName + ' · ' + part.item.start + ' — ' + part.item.end}
          onClick={() => openCard(part.item)}>
          <span className={styles.segmentTitle}>{part.item.card.title}</span>
          {part.width >= 2 && <span className={styles.segmentBoard}>{part.item.boardName}</span>}
        </button>)}</div>
      </div>)}
    </div> : <div className={styles.agenda}>
      {monthItems.length === 0 ? <p className={styles.empty}>No hay Cards programadas en este mes con los filtros actuales.</p> :
        monthItems.map((item) => <button key={item.card.id} type="button" className={styles.agendaItem} style={colorStyle(item.color)} onClick={() => openCard(item)}>
          <span className={styles.agendaDate}>{item.start === item.end ? item.start : item.start + ' — ' + item.end}</span>
          <span className={styles.agendaTitle}>{item.card.title}</span>
          <span className={styles.agendaBoard}>{item.boardName}</span>
          <span className={styles.agendaStatus}>{STATES.find((state) => state.value === item.state)?.label}</span>
        </button>)}
    </div>}

    {mode === 'month' && monthItems.length === 0 && <p className={styles.empty}>No hay Cards programadas en este mes con los filtros actuales.</p>}
    {mode === 'month' && selectedDay && <div className={styles.dayDetails}>
      <div className={styles.dayDetailsHeader}><strong>{prettyDay(selectedDay)}</strong><button type="button" aria-label="Cerrar tareas del día" onClick={() => setSelectedDay(null)}>×</button></div>
      {dayItems.length ? dayItems.map((item) => <button className={styles.dayDetailItem} key={item.card.id} type="button" style={colorStyle(item.color)} onClick={() => openCard(item)}><span>{item.card.title}</span><small>{item.boardName}</small></button>) : <p className="muted">Sin Cards programadas.</p>}
    </div>}

    {loading && boards && <p className={styles.refreshing} role="status">Actualizando calendario…</p>}
    {selected && (detailLoading || detailError || (detailBoard && !cardData)) && createPortal(
      <div className="modal-back" role="status"><div className="modal">
        <p>{detailLoading ? 'Cargando detalles de la Card…' : detailError || 'Esta Card ya no está disponible.'}</p>
        {detailError && <button className="ghost" type="button" onClick={() => setDetailRetry((n) => n + 1)}>Reintentar</button>}
        <button className="ghost" type="button" onClick={() => setSelected(null)}>Cerrar</button>
      </div></div>, document.body)}
    {cardData && createPortal(<CardDrawer key={cardData.card.id} card={cardData.card} mode={editMode}
      board={cardData.board} currentUser={profile.user} canEdit={cardData.board.role === 'responsable' || cardData.board.role === 'editor'}
      onClose={() => setSelected(null)} onEdit={() => setEditMode('edit')} onView={() => setEditMode('view')}
      onChange={refresh} onMove={moveCard} />, document.body)}
    {pendingMove && createPortal(<BacklogResolutionModal resolution={pendingMove.resolution}
      onCancel={() => setPendingMove(null)} onConfirm={async (selectedCardIds, destinations) => {
        await api('/cards/' + pendingMove.cardId + '/move', {
          method: 'POST', body: JSON.stringify({
            column_id: pendingMove.columnId, position: pendingMove.position,
            backlog_resolution: { selected_card_ids: selectedCardIds, destinations },
          }),
        })
        setPendingMove(null)
        await refresh()
      }} />, document.body)}
  </section>
}
