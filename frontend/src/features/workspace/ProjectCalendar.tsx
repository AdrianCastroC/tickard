import { cachedProjectRequest, invalidateProjectRequestCache } from '../../shared/projectRequestCache'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { api, canProject, ApiError, type BacklogResolution, type BoardPayload, type CalendarEvent, type Card, type Profile, type Project, type WorkflowState } from '../../api'
import { BacklogResolutionModal } from '../board/BacklogResolutionModal'
import { CardDrawer } from '../cards/CardDetail'
import { Avatar } from '../../shared/ui'
import { FilterFunnelIcon, CloseIcon, FloppyIcon } from '../../shared/icons'
import { ProjectCalendarAssigneeFilter, type CalendarAssigneeOption } from './ProjectCalendarAssigneeFilter'
import { ProjectCalendarMultiFilter } from './ProjectCalendarMultiFilter'
import { ProjectLoadingIndicator } from './ProjectLoadingIndicator'
import { ProjectContentLoading } from './ProjectContentLoading'
import styles from './ProjectCalendar.module.css'

type State = Exclude<WorkflowState, 'backlog'>
type EventKind = Exclude<CalendarEvent['kind'], 'birthday'>
type Item = {
  key: string; kind: 'card' | 'event'; card?: Card; event?: CalendarEvent
  boardId?: number; boardName: string; state?: State; color: string
  start: string; end: string; title: string; badge: string
}
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
function cardsFromBoards(boards: BoardPayload[], today: string): Item[] {
  const result: Item[] = []
  for (const board of boards) {
    for (const column of board.columns) {
      if (column.workflow_state === 'backlog') continue
      const state = column.workflow_state
      const fallback = STATES.find((entry) => entry.value === state)?.fallback ?? '#147a5f'
      for (const card of column.cards) {
        if (!validDate(card.start_date) || !validDate(card.due_date) || card.start_date > card.due_date) continue
        const baseColor = card.color || column.color || fallback
        const add = (day: string, badge: string, color = baseColor) => {
          result.push({
            key: 'card:' + card.id + ':' + badge, kind: 'card', card,
            boardId: board.board.id, boardName: board.board.name,
            state, color, start: day, end: day, title: card.title, badge,
          })
        }
        const finished = state === 'done'
        const completedDay = card.completed_at ? localDateTimeDay(card.completed_at) : null
        add(card.start_date, 'Inicio')
        if (card.due_date !== card.start_date) {
          add(card.due_date, 'Vencimiento')
        }
        if (finished) {
          if (completedDay && validDate(completedDay)) {
            // A finished Card no longer follows today's date.
            // The completion marker reflects the real completion timestamp.
            add(completedDay, 'Completada', '#38A37A')
          }
        } else if (today >= card.start_date) {
          const overdue = today > card.due_date
          if (today !== card.start_date && today !== card.due_date) {
            add(today, overdue ? 'Atrasada' : 'En curso', overdue ? '#c4513b' : baseColor)
          }
          if (today === card.due_date) {
            const last = result[result.length - 1]
            if (last?.card?.id === card.id && last.badge === 'Vencimiento') last.badge = 'Vence hoy'
          }
          if (today === card.start_date && today === card.due_date) {
            const last = result[result.length - 1]
            if (last?.card?.id === card.id) last.badge = 'Inicio y vencimiento'
          }
        }
      }
    }
  }
  // A Card has at most one occurrence on each day, with the most useful signal.
  const unique = new Map<string, Item>()
  for (const item of result) {
    const id = item.card!.id + ':' + item.start
    const existing = unique.get(id)
    const order = (entry: Item) => ({
      'Atrasada': 6, 'Completada': 5, 'Vence hoy': 4,
      'Inicio y vencimiento': 4, 'Inicio': 3, 'Vencimiento': 2, 'En curso': 1,
    }[entry.badge] ?? 0)
    if (!existing || order(item) > order(existing)) unique.set(id, item)
  }
  return [...unique.values()].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}

function localDateTimeDay(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function eventsFromApi(events: CalendarEvent[]): Item[] {
  return events.map((event) => ({
    key: 'event:' + event.id, kind: 'event' as const, event,
    boardName: '', start: event.start_date, end: event.end_date,
    title: event.title,
    badge: event.kind === 'birthday' ? 'Cumpleaños' : event.kind === 'meeting' ? 'Reunión' : event.kind === 'appointment' ? 'Cita' : 'Evento',
    color: event.kind === 'birthday' ? '#c48232' : event.kind === 'meeting' ? '#147a5f' : event.kind === 'appointment' ? '#437f93' : '#7d7292',
  }))
}
function sortEntries(a: Item, b: Item): number {
  return a.start.localeCompare(b.start) || (a.kind === 'event' ? -1 : 1) - (b.kind === 'event' ? -1 : 1)
    || a.title.localeCompare(b.title)
}


function assignmentNames(people: Card['assignees']): string {
  return people?.length ? people.map((person) => person.name).join(', ') : 'Sin asignar'
}

function AssignmentChips({ people, compact = false }: { people: Card['assignees']; compact?: boolean }) {
  if (!people?.length) return <span className={styles.unassigned} title="Sin asignar">Sin asignar</span>
  return <span className={compact ? styles.assigneeAvatars : styles.assignedGroup}
    title={assignmentNames(people)} aria-label={'Asignados: ' + assignmentNames(people)}>
    <span className={styles.assigneeAvatars}>
      {people.slice(0, compact ? 2 : 3).map((person) =>
        <Avatar key={person.id} id={person.id} name={person.name} src={person.avatar_url}
          size={compact ? 20 : 24} className={styles.assigneeAvatar} />)}
      {people.length > (compact ? 2 : 3) && <span className={styles.assigneeExtra}>+{people.length - (compact ? 2 : 3)}</span>}
    </span>
    {!compact && <span className={styles.assignedNames}>{assignmentNames(people)}</span>}
  </span>
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
  useEffect(() => {
    const interval = window.setInterval(() => {
      const actual = localToday()
      setToday((current) => current === actual ? current : actual)
    }, 60000)
    return () => window.clearInterval(interval)
  }, [])


  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [eventLoading, setEventLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [month, setMonth] = useState(() => monthStart(localToday()))
  const [today, setToday] = useState(localToday)
  const [mode, setMode] = useState<'month' | 'agenda'>('month')
  const agendaRef = useRef<HTMLDivElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null)
  const [hiddenBoards, setHiddenBoards] = useState<number[]>([])
  const [hiddenStates, setHiddenStates] = useState<State[]>([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([])
  const [includeUnassigned, setIncludeUnassigned] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [detailBoard, setDetailBoard] = useState<BoardPayload | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRetry, setDetailRetry] = useState(0)
  const [editMode, setEditMode] = useState<'view' | 'edit'>('view')
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventError, setEventError] = useState<string | null>(null)
  const [eventReload, setEventReload] = useState(0)
  const [eventModal, setEventModal] = useState<CalendarEvent | 'new' | null>(null)
  const [showEvents, setShowEvents] = useState(true)

  // Like the project Gantt, only the Agenda list occupies the available
  // viewport space. The project header and calendar toolbar stay outside it.
  useLayoutEffect(() => {
    if (mode !== 'agenda') return
    const agenda = agendaRef.current
    if (!agenda) return

    const resizeAgenda = () => {
      const available = window.innerHeight - agenda.getBoundingClientRect().top - 20
      const height = `${Math.max(100, Math.floor(available))}px`
      if (agenda.style.height !== height) agenda.style.height = height
    }

    resizeAgenda()
    window.addEventListener('resize', resizeAgenda)
    return () => window.removeEventListener('resize', resizeAgenda)
  }, [mode, loading, eventError, error])

  // Match the board filter popover: float left of the trigger, aligned at
  // its top edge, without pushing the calendar or clipping in scroll panes.
  useLayoutEffect(() => {
    if (!filtersOpen) return

    const reposition = () => {
      const anchor = filterButtonRef.current
      const popover = filterPopoverRef.current
      if (!anchor || !popover) return
      const rect = anchor.getBoundingClientRect()
      const width = popover.offsetWidth
      const height = popover.offsetHeight
      const margin = 12
      const gap = 8
      const left = Math.max(margin, Math.min(rect.left - width - gap, window.innerWidth - width - margin))
      const top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin))
      setFilterPosition((current) => current?.left === left && current?.top === top ? current : { left, top })
    }

    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    const observer = new ResizeObserver(reposition)
    if (filterPopoverRef.current) observer.observe(filterPopoverRef.current)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      observer.disconnect()
    }
  }, [filtersOpen])

  useEffect(() => {
    if (!filtersOpen) return
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (filterButtonRef.current?.contains(event.target) || filterPopoverRef.current?.contains(event.target)) return
      setFiltersOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setFiltersOpen(false)
      filterButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [filtersOpen])

  const load = useCallback(async (signal?: AbortSignal, fresh = false) => {
    const ids = boardIds.split(',').filter(Boolean).map(Number)
    return Promise.all(ids.map((id) => {
      const path = '/boards/' + id + '?calendar=1'
      if (fresh) {
        invalidateProjectRequestCache(path)
        return api<BoardPayload>(path, { signal })
      }
      return cachedProjectRequest(path, (requestSignal) => api<BoardPayload>(path, { signal: requestSignal }), signal)
    }))
  }, [boardIds])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSelected(null)
    setDetailBoard(null)
    void load(controller.signal).then((boards) => {
      if (!alive) return
      setSnapshot({ projectId: project.id, boardIds, boards })
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setLoading(false)
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el calendario.')
    })
    return () => { alive = false; controller.abort() }
  }, [load, project.id, boardIds, reloadKey])

  const boards = snapshot?.projectId === project.id && snapshot.boardIds === boardIds ? snapshot.boards : null
  const range = useMemo(() => monthDays(month), [month])
  const calendarFirst = range.weeks[0][0]
  const calendarLast = range.weeks[range.weeks.length - 1][6]

  useEffect(() => {
    if (project.role === 'cliente') { setEvents([]); setEventLoading(false); return }
    let alive = true
    const controller = new AbortController()
    setEventLoading(true)
    setEventError(null)
    const path = '/projects/' + project.id + '/calendar-events?start_date=' + calendarFirst + '&end_date=' + calendarLast
    if (eventReload) invalidateProjectRequestCache(path)
    void cachedProjectRequest(path, (signal) => api<CalendarEvent[]>(path, { signal }), controller.signal)
      .then((loaded) => {
        if (!alive) return
        setEvents(loaded)
        setEventLoading(false)
      })
      .catch((cause: unknown) => {
        if (!alive) return
        setEventError(cause instanceof Error ? cause.message : 'No se pudieron cargar los eventos.')
        setEventLoading(false)
      })
    return () => { alive = false; controller.abort() }
  }, [project.id, project.role, calendarFirst, calendarLast, eventReload])

  const canEditEvents = canProject(project, 'cards.edit')
  const canViewAllTasks = profile.user.is_admin || project.role === 'responsable'
  const allCards = useMemo(() => cardsFromBoards(boards ?? [], today), [boards, today])
  const assigneeOptions = useMemo(() => {
    if (!canViewAllTasks) return []
    const people = new Map<number, CalendarAssigneeOption>()
    for (const board of boards ?? []) {
      for (const member of board.members) people.set(member.id, {
        id: member.id, name: member.name, avatar_url: member.avatar_url,
      })
    }
    for (const item of allCards) {
      for (const person of item.card?.assignees ?? []) {
        const existing = people.get(person.id)
        people.set(person.id, {
          id: person.id, name: person.name,
          avatar_url: person.avatar_url || existing?.avatar_url,
        })
      }
    }
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [allCards, boards, canViewAllTasks])
  const items = useMemo(() => [
    ...allCards.filter((item) => {
      if (hiddenBoards.includes(item.boardId!) || hiddenStates.includes(item.state!)) return false
      // Server-side scoping is authoritative; the client duplicates the check
      // to prevent stale snapshots from displaying another person's Cards.
      if (!canViewAllTasks && !(item.card?.assignees ?? []).some((person) => person.id === profile.user.id)) {
        // Client visibility settings can hide assignee details even for
        // the current user. The backend already restricts these Cards.
        if (project.role !== 'cliente') return false
      }
      if (canViewAllTasks && (selectedAssigneeIds.length > 0 || includeUnassigned)) {
        const assigned = item.card?.assignees ?? []
        return selectedAssigneeIds.some((id) => assigned.some((person) => person.id === id))
          || (includeUnassigned && assigned.length === 0)
      }
      return true
    }),
    ...eventsFromApi(events.filter(event => event.kind === 'birthday' || showEvents)),
  ].sort(sortEntries), [allCards, hiddenBoards, hiddenStates, events, showEvents, canViewAllTasks,
    profile.user.id, selectedAssigneeIds, includeUnassigned, project.role])
  const weeks = useMemo(() => range.weeks.map((days) => makeWeek(days, items)), [range, items])
  const monthItems = useMemo(() => items.filter((item) => item.start <= range.last && item.end >= range.first), [items, range])
  const dayItems = useMemo(() => selectedDay ? items.filter((item) => item.start <= selectedDay && item.end >= selectedDay) : [], [items, selectedDay])

  useEffect(() => {
    if (!selected) { setDetailBoard(null); setDetailLoading(false); return }
    let alive = true
    const controller = new AbortController()
    setDetailLoading(true)
    setDetailError(null)
    setDetailBoard(null)
    void api<BoardPayload>('/boards/' + selected.boardId, { signal: controller.signal }).then((board) => {
      if (!alive) return
      setDetailBoard(board)
      setDetailLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setDetailLoading(false)
      setDetailError(cause instanceof Error ? cause.message : 'No se pudo abrir la Card.')
    })
    return () => { alive = false; controller.abort() }
  }, [selected?.cardId, selected?.boardId, detailRetry])

  const cardData = useMemo(() => {
    if (!selected || detailBoard?.board.id !== selected.boardId) return null
    const card = detailBoard.columns.flatMap((column) => column.cards).find((entry) => entry.id === selected.cardId)
    return card ? { card, board: detailBoard } : null
  }, [selected, detailBoard])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await load(undefined, true)
      setSnapshot({ projectId: project.id, boardIds, boards: next })
      if (selected) setDetailBoard(await api<BoardPayload>('/boards/' + selected.boardId))
    } finally {
      setRefreshing(false)
    }
  }, [load, project.id, boardIds, selected])

  function openCard(item: Item) {
    if (!item.card || item.boardId == null) return
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

  // Show all applied filters even when their controls are collapsed.
  const activeFilterCount = hiddenBoards.length + hiddenStates.length
    + (canViewAllTasks ? selectedAssigneeIds.length + Number(includeUnassigned) : 0)
    + (project.role !== 'cliente' && !showEvents ? 1 : 0)

  if (loading && !boards) return (
    <ProjectContentLoading
      title="Cargando calendario"
      description="Preparando tareas, eventos y planificación del proyecto…"
    >
      <div className={styles.loadingToolbar}>
        <span className={styles.loadingBlock} />
        <span className={styles.loadingBlock} />
        <span className={styles.loadingBlock} />
        <span className={styles.loadingBlock} />
      </div>
      <div className={styles.loadingCalendar}>
        <div className={styles.loadingWeekdays}>
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>
        {Array.from({ length: 5 }, (_, row) => (
          <div className={styles.loadingWeek} key={row}>
            {Array.from({ length: 7 }, (_, col) => (
              <div className={styles.loadingDay} key={col}>
                <span className={styles.loadingBlock} />
                {(row + col) % 4 !== 1 && (
                  <span className={`${styles.loadingTask} ${(row + col) % 3 === 0 ? styles.loadingTaskAlternate : ''}`} />
                )}
                {(row * 2 + col) % 5 === 0 && <span className={styles.loadingTaskShort} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ProjectContentLoading>
  )
  if (error && !boards) return <section className="project-panel" role="alert"><p>No se pudo cargar el calendario: {error}</p><button className="ghost" type="button" onClick={() => setReloadKey((n) => n + 1)}>Reintentar</button></section>


  return <section className={styles.root} aria-label={'Calendario del proyecto ' + project.name}>
    <div className={styles.toolbar}>
      <div className={styles.dateControls}>
        <button className="ghost" type="button" onClick={() => { setMonth(monthStart(today)); setSelectedDay(null) }}>Hoy</button>
        <button className={styles.squareButton} type="button" aria-label="Mes anterior" onClick={() => { setMonth((value) => moveMonth(value, -1)); setSelectedDay(null) }}>‹</button>
        <button className={styles.squareButton} type="button" aria-label="Mes siguiente" onClick={() => { setMonth((value) => moveMonth(value, 1)); setSelectedDay(null) }}>›</button>
        <h2>{prettyMonth(month)}</h2>
      </div>
      <div className={styles.toolbarRight}>
        <button
          ref={filterButtonRef}
          className={`icon-button board-filter-trigger${filtersOpen || activeFilterCount > 0 ? ' on' : ''}`}
          type="button"
          aria-label={activeFilterCount > 0 ? `Filtros del calendario: ${activeFilterCount} activos` : 'Filtros del calendario'}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-controls={filtersOpen ? 'calendar-filters-popover' : undefined}
          title="Filtros"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <FilterFunnelIcon />
          {activeFilterCount > 0 && <span className="board-filter-active-dot" aria-hidden="true" />}
        </button>
        <div className={styles.modeSwitch} aria-label="Vistas de calendario">
          <button type="button" className={mode === 'month' ? styles.active : undefined} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Mes</button>
          <button type="button" className={mode === 'agenda' ? styles.active : undefined} aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>Agenda</button>
        </div>
        {canEditEvents && <button className="primary" type="button" onClick={() => setEventModal('new')}>+ Nuevo evento</button>}
      </div>
    </div>

    {eventError && <div className={styles.inlineError} role="alert">No se pudieron cargar los eventos: {eventError}. <button type="button" onClick={() => setEventReload((n) => n + 1)}>Reintentar</button></div>}
    {error && <div className={styles.inlineError} role="alert">No se pudieron actualizar las Cards: {error}. <button type="button" onClick={() => setReloadKey((n) => n + 1)}>Reintentar</button></div>}
    {filtersOpen && createPortal(
      <div
        ref={filterPopoverRef}
        id="calendar-filters-popover"
        className={`board-filters-popover ${styles.filtersPopover}`}
        role="dialog"
        aria-labelledby="calendar-filters-title"
        style={filterPosition ? { top: filterPosition.top, left: filterPosition.left } : { top: 0, left: 0, visibility: 'hidden' }}
      >
        <div className="board-filters-popover-head">
          <strong id="calendar-filters-title">Filtros</strong>
          <button className="icon-close" type="button" aria-label="Cerrar filtros" onClick={() => setFiltersOpen(false)}><CloseIcon /></button>
        </div>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <strong>Tableros</strong>
            <ProjectCalendarMultiFilter
              label="Tableros"
              options={(boards ?? []).map((board) => ({ value: board.board.id, label: board.board.name }))}
              hidden={hiddenBoards}
              onHiddenChange={setHiddenBoards}
            />
          </div>
          <div className={styles.filterGroup}>
            <strong>Estados</strong>
            <ProjectCalendarMultiFilter
              label="Estados"
              options={STATES.map((state) => ({ value: state.value, label: state.label, color: state.fallback }))}
              hidden={hiddenStates}
              onHiddenChange={setHiddenStates}
            />
          </div>
          {canViewAllTasks && <div className={styles.filterGroup}>
            <strong>Usuarios asignados</strong>
            <ProjectCalendarAssigneeFilter people={assigneeOptions}
              embedded
              selectedIds={selectedAssigneeIds} includeUnassigned={includeUnassigned}
              currentUserId={profile.user.id} onSelectedIdsChange={setSelectedAssigneeIds}
              onIncludeUnassignedChange={setIncludeUnassigned} />
          </div>}
          {project.role !== 'cliente' && <div className={styles.filterGroup}>
            <strong>Eventos</strong>
            <label className={styles.eventFilter}><input type="checkbox" checked={showEvents} onChange={() => setShowEvents((value) => !value)} /> Mostrar reuniones, citas y eventos</label>
          </div>}
        </div>
        <div className="board-filters-popover-foot">
          <button className="ghost" type="button" disabled={activeFilterCount === 0}
            onClick={() => { setHiddenBoards([]); setHiddenStates([]); setSelectedAssigneeIds([]); setIncludeUnassigned(false); setShowEvents(true) }}>
            Limpiar filtros
          </button>
        </div>
      </div>,
      document.body,
    )}

    {mode === 'month' ? <div className={styles.calendar}>
      <div className={styles.weekdayRow}>{WEEKDAYS.map((name) => <div key={name}>{name}</div>)}</div>
      {weeks.map((week) => <div className={styles.week} key={week.days[0]}>
        <div className={styles.daysGrid}>{week.days.map((day, index) => <div key={day} className={[styles.dayCell, day.slice(0, 7) !== month.slice(0, 7) ? styles.outside : '', day === today ? styles.today : ''].filter(Boolean).join(' ')}>
          <button type="button" className={styles.dayNumber} aria-label={'Ver Cards del ' + prettyDay(day)} onClick={() => setSelectedDay((value) => value === day ? null : day)}>{Number(day.slice(-2))}</button>
          {week.hidden[index] > 0 && <button type="button" className={styles.moreButton} onClick={() => setSelectedDay(day)}>+{week.hidden[index]} más</button>}
        </div>)}</div>
        <div className={styles.segments}>{week.segments.map((part) => <button
          key={part.item.key + '-' + week.days[0]}
          type="button"
          className={[styles.segment, part.before ? styles.continuesBefore : '', part.after ? styles.continuesAfter : ''].filter(Boolean).join(' ')}
          style={Object.assign(colorStyle(part.item.color), {
            left: String(part.first / 7 * 100) + '%',
            width: String(part.width / 7 * 100) + '%',
            top: String(34 + part.lane * 29) + 'px',
          })}
          title={part.item.badge + ' · ' + part.item.title + ' · ' + part.item.start + (part.item.start === part.item.end ? '' : ' — ' + part.item.end) + (canViewAllTasks && part.item.kind === 'card' ? ' · ' + assignmentNames(part.item.card?.assignees) : '')}
          onClick={() => part.item.kind === 'event' ? (part.item.event?.kind !== 'birthday' && setEventModal(part.item.event!)) : openCard(part.item)}>
          <span className={styles.segmentTitle}>
            {part.item.event?.birthday_user && <Avatar id={part.item.event.birthday_user.id}
              name={part.item.event.birthday_user.name} src={part.item.event.birthday_user.avatar_url}
              size={18} className={styles.birthdayAvatar} />}
            {part.item.badge} · {part.item.title}
          </span>
          {canViewAllTasks && part.item.kind === 'card' && <AssignmentChips people={part.item.card?.assignees} compact />}
          {part.width >= 2 && part.item.boardName && !canViewAllTasks && <span className={styles.segmentBoard}>{part.item.boardName}</span>}
        </button>)}</div>
      </div>)}
    </div> : <div ref={agendaRef} className={styles.agenda} role="region" aria-label="Agenda de tareas y eventos" tabIndex={0}>
      {monthItems.length === 0 ? <p className={styles.empty}>No hay tareas ni eventos programados en este mes con los filtros actuales.</p> :
        monthItems.map((item) => <button key={item.key + ':' + item.start} type="button" className={styles.agendaItem} style={colorStyle(item.color)} onClick={() => item.kind === 'event' ? (item.event?.kind !== 'birthday' && setEventModal(item.event!)) : openCard(item)}>
          <span className={styles.agendaDate}>{item.start === item.end ? item.start : item.start + ' — ' + item.end}</span>
          <span className={styles.agendaTitle}>
            {item.event?.birthday_user && <Avatar id={item.event.birthday_user.id}
              name={item.event.birthday_user.name} src={item.event.birthday_user.avatar_url}
              size={18} className={styles.birthdayAvatar} />}
            {item.title}
          </span>
          <span className={styles.agendaBoard}>
            <span>{item.boardName || (item.event && !item.event.all_day ? [item.event.start_time, item.event.end_time].filter(Boolean).join('–') : 'Todo el día')}</span>
            {canViewAllTasks && item.kind === 'card' && <AssignmentChips people={item.card?.assignees} />}
          </span>
          <span className={styles.agendaStatus}>{item.badge}</span>
        </button>)}
    </div>}

    {mode === 'month' && monthItems.length === 0 && <p className={styles.empty}>No hay tareas ni eventos programados en este mes con los filtros actuales.</p>}
    {mode === 'month' && selectedDay && <div className={styles.dayDetails}>
      <div className={styles.dayDetailsHeader}><strong>{prettyDay(selectedDay)}</strong><button type="button" aria-label="Cerrar tareas del día" onClick={() => setSelectedDay(null)}>×</button></div>
      {dayItems.length ? dayItems.map((item) => <button className={styles.dayDetailItem} key={item.key + ':' + item.start} type="button" style={colorStyle(item.color)} onClick={() => item.kind === 'event' ? (item.event?.kind !== 'birthday' && setEventModal(item.event!)) : openCard(item)}><span>{item.event?.birthday_user && <Avatar id={item.event.birthday_user.id}
              name={item.event.birthday_user.name} src={item.event.birthday_user.avatar_url}
              size={18} className={styles.birthdayAvatar}/>} {item.badge} · {item.title}</span><small>{item.boardName}{canViewAllTasks && item.kind === 'card' && <AssignmentChips people={item.card?.assignees} />}</small></button>) : <p className="muted">Sin tareas ni eventos programados.</p>}
    </div>}

    {((loading && boards) || refreshing || eventLoading) && (
      <ProjectLoadingIndicator label="Actualizando calendario…" floating />
    )}
    {eventModal && createPortal(<CalendarEventModal key={eventModal === 'new' ? 'new' : eventModal.id}
      projectId={project.id} event={eventModal === 'new' ? null : eventModal} initialDay={selectedDay ?? today}
      canEdit={canEditEvents}
      onClose={() => setEventModal(null)}
      onSaved={() => { setEventModal(null); setEventReload((n) => n + 1) }} />, document.body)}
    {selected && (detailLoading || detailError || (detailBoard && !cardData)) && createPortal(
      <div className="modal-back" role="status"><div className="modal">
        <p>{detailLoading ? 'Cargando detalles de la Card…' : detailError || 'Esta Card ya no está disponible.'}</p>
        {detailError && <button className="ghost" type="button" onClick={() => setDetailRetry((n) => n + 1)}>Reintentar</button>}
        <button className="ghost" type="button" onClick={() => setSelected(null)}>Cerrar</button>
      </div></div>, document.body)}
    {cardData && createPortal(<CardDrawer key={cardData.card.id} card={cardData.card} mode={editMode}
      board={cardData.board} currentUser={profile.user} canEdit={canProject(cardData.board, 'cards.edit')}
      canMove={canProject(cardData.board, 'cards.state')}
      canDates={canProject(cardData.board, 'cards.dates')}
      canAssign={canProject(cardData.board, 'cards.assign')}
      canDelete={canProject(cardData.board, 'cards.delete')}
      canUpload={canProject(cardData.board, 'files.upload')}
      canComment={canProject(cardData.board, 'cards.comment')}
      onClose={() => setSelected(null)} onEdit={() => setEditMode('edit')} onView={() => setEditMode('view')}
      onChange={refresh} onMove={moveCard}
      onOpenRelatedCard={(cardId, boardId) => {
        setEditMode('view')
        setSelected({ cardId, boardId })
      }} />, document.body)}
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


type EventForm = {
  kind: EventKind; title: string; description: string; location: string
  start_date: string; end_date: string; all_day: boolean
  start_time: string; end_time: string
}

function CalendarEventModal({ projectId, event, initialDay, canEdit, onClose, onSaved }: {
  projectId: number; event: CalendarEvent | null; initialDay: string
  canEdit: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<EventForm>(() => ({
    kind: event?.kind === 'birthday' ? 'meeting' : event?.kind ?? 'meeting', title: event?.title ?? '',
    description: event?.description ?? '', location: event?.location ?? '',
    start_date: event?.start_date ?? initialDay, end_date: event?.end_date ?? initialDay,
    all_day: event?.all_day ?? false, start_time: event?.start_time ?? '09:00', end_time: event?.end_time ?? '10:00',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const disabled = saving || !canEdit
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const escape = (keyboard: KeyboardEvent) => { if (keyboard.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose, saving])

  async function save() {
    if (!canEdit || saving) return
    setSaving(true)
    setError('')
    try {
      const url = event ? '/calendar-events/' + event.id : '/projects/' + projectId + '/calendar-events'
      await api(url, {
        method: event ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          title: form.title.trim(), description: form.description.trim() || null,
          location: form.location.trim() || null,
          start_time: form.all_day ? null : form.start_time,
          end_time: form.all_day ? null : form.end_time,
        }),
      })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el evento.')
    } finally { setSaving(false) }
  }
  async function remove() {
    if (!event || !canEdit || saving || !window.confirm('¿Eliminar este evento?')) return
    setSaving(true)
    setError('')
    try {
      await api('/calendar-events/' + event.id, { method: 'DELETE' })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el evento.')
    } finally { setSaving(false) }
  }

  return <div className={styles.eventBackdrop} role="presentation">
    <button className={styles.eventBackdropClose} type="button" aria-label="Cerrar ventana" disabled={saving} onClick={onClose} />
    <div className={styles.eventModal} role="dialog" aria-modal="true" aria-label={event ? 'Detalles del evento' : 'Nuevo evento'}>
      <div className={styles.eventModalHeader}>
        <h2>{event ? (canEdit ? 'Editar evento' : 'Detalles del evento') : 'Nuevo evento'}</h2>
        <button type="button" className={styles.eventClose} aria-label="Cerrar" onClick={onClose} disabled={saving}>×</button>
      </div>
      <form onSubmit={(submitted) => { submitted.preventDefault(); void save() }} className={styles.eventForm}>
        <label>Tipo
          <select value={form.kind} disabled={disabled} onChange={(change) => set('kind', change.target.value as EventKind)}>
            <option value="meeting">Reunión</option><option value="appointment">Cita</option><option value="other">Otro evento</option>
          </select>
        </label>
        <label>Título
          <input value={form.title} disabled={disabled} maxLength={160} required placeholder="Ej. Reunión con el equipo" onChange={(change) => set('title', change.target.value)} />
        </label>
        <div className={styles.eventDates}>
          <label>Desde
            <input type="date" value={form.start_date} disabled={disabled} required onChange={(change) => set('start_date', change.target.value)} />
          </label>
          <label>Hasta
            <input type="date" value={form.end_date} min={form.start_date} disabled={disabled} required onChange={(change) => set('end_date', change.target.value)} />
          </label>
        </div>
        <label className={styles.allDay}><input type="checkbox" checked={form.all_day} disabled={disabled} onChange={(change) => set('all_day', change.target.checked)} /> Todo el día</label>
        {!form.all_day && <div className={styles.eventDates}>
          <label>Hora de inicio <input type="time" required value={form.start_time} disabled={disabled} onChange={(change) => set('start_time', change.target.value)} /></label>
          <label>Hora de fin <input type="time" required value={form.end_time} disabled={disabled} onChange={(change) => set('end_time', change.target.value)} /></label>
        </div>}
        <label>Lugar (opcional)
          <input value={form.location} maxLength={160} disabled={disabled} placeholder="Sala, dirección o enlace" onChange={(change) => set('location', change.target.value)} />
        </label>
        <label>Descripción (opcional)
          <textarea rows={3} maxLength={4000} value={form.description} disabled={disabled} onChange={(change) => set('description', change.target.value)} />
        </label>
        {error && <p className={styles.formError} role="alert">{error}</p>}
        <div className={styles.eventActions}>
          {canEdit && event && <button className={styles.deleteEvent} type="button" disabled={saving} onClick={() => void remove()}>Eliminar</button>}
          <button className="ghost" type="button" onClick={onClose} disabled={saving}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>
          {canEdit && <button className={event ? 'primary save-button' : 'primary'} type="submit" disabled={saving || !form.title.trim() || form.start_date > form.end_date}>{event && <FloppyIcon />}{saving ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear evento'}</button>}
        </div>
      </form>
    </div>
  </div>
}
