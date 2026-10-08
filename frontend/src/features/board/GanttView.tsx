import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { api, type BoardPayload, type Card, type CardDependency, type Column } from '../../api'
import { CollapseColumnIcon, DependencyConnectorIcon, DoneIcon, ExpandColumnIcon, EyeIcon, EyeLowVisionIcon } from '../../shared/icons'
import { KanbanMiniCard } from './KanbanMiniCard'
import styles from './GanttView.module.css'

const DAY_MS = 86_400_000
const TASK_WIDTH = 200
const DEFAULT_COLUMNS = { start: true, end: true, progress: true }
const ZOOMS = ['day', 'week', 'month', 'quarter'] as const
type Zoom = (typeof ZOOMS)[number]
type Visibility = typeof DEFAULT_COLUMNS
type Day = { key: string; date: Date }
type GanttCard = { card: Card; column: Column }
type CategoryGroup = { id: string; name: string; cards: GanttCard[] }
type TimelineEntry = { group: CategoryGroup; row: number; collapsed: boolean }
type CategoryStats = { start: string | null; end: string | null; progress: number | null }
type CardBarStyle = CSSProperties & {
  '--card-color': string
  '--card-progress': string
}
type DragMode = 'move' | 'resize-start' | 'resize-end'
type DragState = {
  card: Card
  mode: DragMode
  pointerStartX: number
  dayWidth: number
}
type DragPreview = { cardId: number; start: string; due: string }
type GanttDependency = CardDependency & { predecessorId: number; successorId: number }
type DependencyPopover = { dependency: GanttDependency; x: number; y: number }
type DependencyCreation = { cardId: number; endpoint: 'start' | 'finish'; cursorX: number; cursorY: number; targetId: number | null; targetEndpoint: 'start' | 'finish' | null }
type HoveredCard = { item: GanttCard; left: number; top: number }

type GanttGridStyle = CSSProperties & {
  '--left-columns': string
  '--left-width': string
}

function cardVisualProgress(item: GanttCard) {
  const checklistPercent = Math.min(100, Math.max(0, item.card.progress?.percent ?? 0))

  if (item.column.workflow_state === 'in_progress') {
    return Math.max(10, checklistPercent)
  }

  if (item.column.workflow_state === 'review' || item.column.workflow_state === 'done') {
    return 100
  }

  return 0
}

function parseDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function shift(value: string, amount: number) {
  const date = parseDay(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return dateKey(date)
}

function daysBetween(start: string, end: string) {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / DAY_MS)
}

function planned(card: Card) {
  return Boolean(card.start_date && card.due_date)
}

function hasTemporalPlanning(item: GanttCard) {
  return item.column.workflow_state !== 'backlog' && planned(item.card)
}

function timelineRange(cards: Card[]) {
  const plannedCards = cards.filter(planned)
  if (plannedCards.length === 0) {
    const today = dateKey(new Date())
    return { start: shift(today, -7), end: shift(today, 14) }
  }

  const start = plannedCards.reduce((value, card) => card.start_date! < value ? card.start_date! : value, plannedCards[0].start_date!)
  const end = plannedCards.reduce((value, card) => card.due_date! > value ? card.due_date! : value, plannedCards[0].due_date!)
  return { start: shift(start, -2), end: shift(end, 2) }
}

function buildDays(start: string, endInclusive: string): Day[] {
  return Array.from({ length: daysBetween(start, endInclusive) + 1 }, (_, index) => {
    const key = shift(start, index)
    return { key, date: parseDay(key) }
  })
}

function monday(value: string) {
  const date = parseDay(value)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return dateKey(date)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'UTC' }).format(date)
}

function compactDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseDay(value)).replace('.', '') : '—'
}

function compareGanttCards(first: GanttCard, second: GanttCard) {
  const startComparison = compareOptionalDates(first.card.start_date, second.card.start_date)
  if (startComparison !== 0) {
    return startComparison
  }

  const dueComparison = compareOptionalDates(first.card.due_date, second.card.due_date)
  if (dueComparison !== 0) {
    return dueComparison
  }

  return first.card.position - second.card.position
}

function compareOptionalDates(first?: string | null, second?: string | null) {
  if (first === null || first === undefined) {
    return second === null || second === undefined ? 0 : 1
  }

  if (second === null || second === undefined) {
    return -1
  }

  return first.localeCompare(second)
}

function categoryGroups(board: BoardPayload, columns: BoardPayload['columns']): CategoryGroup[] {
  const items = columns.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = board.categories.map((category) => ({
    id: String(category.id),
    name: category.name,
    cards: items
      .filter(({ card }) => card.category_id === category.id)
      .sort(compareGanttCards),
  }))
  const uncategorized = items.filter(({ card }) => card.category_id == null).sort(compareGanttCards)
  if (uncategorized.length > 0) groups.push({ id: 'uncategorized', name: 'Sin categoría', cards: uncategorized })
  return groups.filter((group) => group.cards.length > 0)
}

function weekNumber(days: Day[], index: number) {
  const weekStart = monday(days[index].key)
  const weekEnd = shift(weekStart, 6)
  const weekStartDate = parseDay(weekStart)
  const monthStart = dateKey(new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth(), 1)))
  const nextMonthStart = dateKey(new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth() + 1, 1)))
  const labelMonthStart = monthStart >= weekStart && monthStart <= weekEnd ? monthStart : nextMonthStart > weekStart && nextMonthStart <= weekEnd ? nextMonthStart : monthStart

  if (labelMonthStart === nextMonthStart) {
    return 1
  }

  return Math.floor(daysBetween(monday(labelMonthStart), weekStart) / 7) + 1
}

function gridColumn(start: string, value: string) {
  return daysBetween(start, value) + 1
}

function dateEndColumn(start: string, value: string) {
  return gridColumn(start, shift(value, 1))
}

function datesForDrag(card: Card, mode: DragMode, dayDelta: number) {
  const start = card.start_date!
  const due = card.due_date!

  if (mode === 'move') {
    return {
      start: shift(start, dayDelta),
      due: shift(due, dayDelta),
    }
  }

  if (mode === 'resize-start') {
    return {
      start: dateKey(new Date(Math.min(parseDay(shift(start, dayDelta)).getTime(), parseDay(due).getTime()))),
      due,
    }
  }

  return {
    start,
    due: dateKey(new Date(Math.max(parseDay(shift(due, dayDelta)).getTime(), parseDay(start).getTime()))),
  }
}

function isWeekend(day: Day) {
  return day.date.getUTCDay() === 0 || day.date.getUTCDay() === 6
}

function readVisibility(storageKey: string): Visibility {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<Visibility> | null

    if (
      value
      && typeof value.start === 'boolean'
      && typeof value.end === 'boolean'
      && typeof value.progress === 'boolean'
    ) {
      return value as Visibility
    }
  } catch {
    return DEFAULT_COLUMNS
  }

  return DEFAULT_COLUMNS
}

function readCollapsed(storageKey: string) {
  return localStorage.getItem(storageKey) === 'true'
}

function visibleColumnTemplate(visibility: Visibility) {
  return [
    'minmax(200px, 1fr)',
    visibility.start ? '55px' : null,
    visibility.end ? '55px' : null,
    visibility.progress ? '70px' : null,
  ].filter(Boolean).join(' ')
}

function leftWidth(visibility: Visibility) {
  return TASK_WIDTH
    + (visibility.start ? 55 : 0)
    + (visibility.end ? 55 : 0)
    + (visibility.progress ? 70 : 0)
}

function monthSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []
  days.forEach((day, index) => {
    const label = formatMonth(day.date)
    const last = spans.at(-1)
    if (last?.label === label) last.end = index + 2
    else spans.push({ label, start: index + 1, end: index + 2 })
  })
  return spans
}

function yearSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []

  days.forEach((day, index) => {
    const label = String(day.date.getUTCFullYear())
    const last = spans.at(-1)

    if (last?.label === label) {
      last.end = index + 2
    } else {
      spans.push({ label, start: index + 1, end: index + 2 })
    }
  })

  return spans
}

function quarterSpans(days: Day[], includeYear: boolean) {
  const spans: { label: string; start: number; end: number }[] = []

  days.forEach((day, index) => {
    const quarter = Math.floor(day.date.getUTCMonth() / 3) + 1
    const label = includeYear
      ? `T${quarter} ${day.date.getUTCFullYear()}`
      : `T${quarter}`
    const last = spans.at(-1)

    if (last?.label === label) {
      last.end = index + 2
    } else {
      spans.push({ label, start: index + 1, end: index + 2 })
    }
  })

  return spans
}

function categoryRange(group: CategoryGroup, timelineStart: string) {
  const stats = categoryStats(group)
  if (!stats.start || !stats.end) return null
  return `${gridColumn(timelineStart, stats.start)} / ${dateEndColumn(timelineStart, stats.end)}`
}

function categoryStats(group: CategoryGroup): CategoryStats {
  const plannedCards = group.cards.filter(hasTemporalPlanning)
  const startDates = plannedCards.map(({ card }) => card.start_date).filter((value): value is string => Boolean(value))
  const endDates = plannedCards.map(({ card }) => card.due_date).filter((value): value is string => Boolean(value))
  const progressTotal = group.cards.reduce((total, item) => total + cardVisualProgress(item), 0)

  return {
    start: startDates.length > 0 ? startDates.reduce((value, date) => date < value ? date : value, startDates[0]) : null,
    end: endDates.length > 0 ? endDates.reduce((value, date) => date > value ? date : value, endDates[0]) : null,
    progress: group.cards.length > 0 ? Math.round(progressTotal / group.cards.length) : null,
  }
}

function weekSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []
  let lastWeek = ''
  days.forEach((day, index) => {
    const startOfWeek = monday(day.key)
    const last = spans.at(-1)
    if (last && lastWeek === startOfWeek) {
      last.end = index + 2
      return
    }

    lastWeek = startOfWeek
    spans.push({ label: `S${weekNumber(days, index)}`, start: index + 1, end: index + 2 })
  })
  return spans
}

type GanttProps = {
  board: BoardPayload
  cards: BoardPayload['columns']
  canEdit: boolean
  onOpen: (card: Card) => void
  onChange: () => Promise<void>
}

export function GanttView({ board, cards, canEdit, onOpen, onChange }: GanttProps) {
  const allCards = cards.flatMap((column) => column.workflow_state === 'backlog' ? [] : column.cards)
  const groups = useMemo(() => categoryGroups(board, cards), [board, cards])
  const [zoom, setZoom] = useState<Zoom>(() => (localStorage.getItem(`tickard:gantt-zoom:${board.board.id}`) as Zoom) || 'week')
  const visibilityStorageKey = `tickard:gantt-columns:${board.board.id}`
  const [visibility, setVisibility] = useState<Visibility>(() => readVisibility(visibilityStorageKey))
  const leftCollapsedStorageKey = `tickard:gantt-left-collapsed:${board.board.id}`
  const [leftCollapsed, setLeftCollapsed] = useState(() => readCollapsed(leftCollapsedStorageKey))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)
  const [dependencyPopover, setDependencyPopover] = useState<DependencyPopover | null>(null)
  const [dependencyCreation, setDependencyCreation] = useState<DependencyCreation | null>(null)
  const [hoveredCard, setHoveredCard] = useState<HoveredCard | null>(null)
  const suppressClickRef = useRef<number | null>(null)
  const timelineGridRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const leftToolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarMinWidth, setToolbarMinWidth] = useState(0)
  const collapsedStorageKey = `tickard:gantt-collapsed:${board.board.id}`
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(collapsedStorageKey) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const ganttDependencies = useMemo(() => {
    const cardsById = new Map(groups.flatMap((group) => group.cards).map((item) => [item.card.id, item.card]))
    const dependencies = new Map<number, GanttDependency>()

    groups.flatMap((group) => group.cards).forEach(({ card }) => {
      card.dependencies?.predecessors.forEach((dependency) => {
        if (cardsById.has(dependency.card_id) && cardsById.has(card.id)) {
          dependencies.set(dependency.id, { ...dependency, predecessorId: dependency.card_id, successorId: card.id })
        }
      })
      card.dependencies?.successors.forEach((dependency) => {
        if (cardsById.has(dependency.card_id) && cardsById.has(card.id)) {
          dependencies.set(dependency.id, { ...dependency, predecessorId: card.id, successorId: dependency.card_id })
        }
      })
    })

    return [...dependencies.values()]
  }, [groups])
  const range = timelineRange(allCards)
  const days = buildDays(range.start, range.end)
  const entries: TimelineEntry[] = []
  let row = 3
  groups.forEach((group) => {
    const isCollapsed = Boolean(collapsed[group.id])
    entries.push({ group, row, collapsed: isCollapsed })
    row += 1 + (isCollapsed ? 0 : group.cards.length)
  })

  const totalDays = days.length
  const totalLeftWidth = leftWidth(visibility)
  const gridStyle = {
    '--total-days': totalDays,
    '--data-rows': row - 3,
    '--left-columns': visibleColumnTemplate(visibility),
    '--left-width': `${totalLeftWidth}px`,
  } as GanttGridStyle

  useEffect(() => {
    localStorage.setItem(`tickard:gantt-zoom:${board.board.id}`, zoom)
  }, [board.board.id, zoom])

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey, JSON.stringify(collapsed))
  }, [collapsedStorageKey, collapsed])

  useEffect(() => {
    localStorage.setItem(visibilityStorageKey, JSON.stringify(visibility))
  }, [visibility, visibilityStorageKey])

  useEffect(() => {
    localStorage.setItem(leftCollapsedStorageKey, String(leftCollapsed))
  }, [leftCollapsedStorageKey, leftCollapsed])

  useEffect(() => {
    if (!columnsOpen) {
      return
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)

    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [columnsOpen])

  useLayoutEffect(() => {
    if (leftCollapsed || !leftToolbarRef.current) {
      return
    }

    const toolbar = leftToolbarRef.current
    const updateToolbarWidth = () => {
      const controls = Array.from(toolbar.children).filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
      const toolbarStyles = getComputedStyle(toolbar)
      const horizontalPadding = parseFloat(toolbarStyles.paddingLeft) + parseFloat(toolbarStyles.paddingRight)
      const gap = parseFloat(toolbarStyles.columnGap || toolbarStyles.gap) || 0
      const controlsWidth = controls.reduce((total, control) => total + control.getBoundingClientRect().width, 0)
      const measuredWidth = Math.ceil(horizontalPadding + controlsWidth + gap * Math.max(0, controls.length - 1))

      setToolbarMinWidth((currentWidth) => currentWidth === measuredWidth ? currentWidth : measuredWidth)
    }
    const observer = new ResizeObserver(updateToolbarWidth)

    updateToolbarWidth()
    Array.from(toolbar.children)
      .filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
      .forEach((control) => observer.observe(control))

    return () => observer.disconnect()
  }, [leftCollapsed])

  function beginDrag(event: ReactPointerEvent, item: GanttCard, mode: DragMode) {
    if (!canEdit || !item.card.start_date || !item.card.due_date || !timelineGridRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setHoveredCard(null)
    setDragError(null)

    const timelineWidth = timelineGridRef.current.getBoundingClientRect().width
    const dayWidth = timelineWidth / days.length
    setDragState({
      card: item.card,
      mode,
      pointerStartX: event.clientX,
      dayWidth,
    })
    setDragPreview({ cardId: item.card.id, start: item.card.start_date, due: item.card.due_date })
  }

  function updateHoveredCard(event: ReactPointerEvent, item: GanttCard) {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 230
    const height = 220
    const gap = 8
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    const top = rect.bottom + gap + height <= window.innerHeight
      ? rect.bottom + gap
      : Math.max(8, rect.top - height - gap)

    setHoveredCard({ item, left, top })
  }

  function clearHoveredCard() {
    setHoveredCard(null)
  }

  const monthRows = monthSpans(days)
  const yearRows = yearSpans(days)
  const quarterRows = quarterSpans(days, false)
  const monthQuarterRows = quarterSpans(days, true)
  const weekRows = weekSpans(days)
  const showWeeks = zoom === 'week'
  const showMonths = zoom === 'month'
  const showQuarters = zoom === 'quarter'
  const today = dateKey(new Date())
  const todayColumn = gridColumn(range.start, today)
  const todayVisible = today >= range.start && today <= range.end
  const effectiveLeftWidth = Math.max(totalLeftWidth, toolbarMinWidth)
  const cardRows = new Map<number, { item: GanttCard; row: number }>()
  entries.forEach(({ group, row: groupRow, collapsed: isCollapsed }) => {
    if (!isCollapsed) {
      group.cards.forEach((item, index) => cardRows.set(item.card.id, { item, row: groupRow + index + 1 }))
    }
  })

  async function changeDependency(dependency: GanttDependency, type: GanttDependency['type']) {
    await api(`/card-dependencies/${dependency.id}`, { method: 'PATCH', body: JSON.stringify({ type }) })
    setDependencyPopover(null)
    await onChange()
  }

  async function deleteDependency(dependency: GanttDependency) {
    await api(`/card-dependencies/${dependency.id}`, { method: 'DELETE' })
    setDependencyPopover(null)
    await onChange()
  }

  function beginDependencyCreation(event: ReactPointerEvent, cardId: number, endpoint: 'start' | 'finish') {
    if (!canEdit) return
    event.preventDefault()
    event.stopPropagation()
    setHoveredCard(null)
    setDependencyPopover(null)
    setDragError(null)
    setDependencyCreation({ cardId, endpoint, cursorX: event.clientX, cursorY: event.clientY, targetId: null, targetEndpoint: null })
  }

  useEffect(() => {
    if (!dependencyCreation) return

    function handlePointerMove(event: PointerEvent) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-dependency-connector]')
      const targetId = target ? Number(target.dataset.cardId) : null
      const targetEndpoint = target?.dataset.endpoint as 'start' | 'finish' | undefined
      setDependencyCreation((current) => current ? {
        ...current,
        cursorX: event.clientX,
        cursorY: event.clientY,
        targetId: targetId && targetId !== current.cardId ? targetId : null,
        targetEndpoint: targetId && targetId !== current.cardId ? targetEndpoint ?? null : null,
      } : null)
    }

    function handlePointerUp() {
      const creation = dependencyCreation
      setDependencyCreation(null)
      if (!creation?.targetId || !creation.targetEndpoint) return
      const type = creation.endpoint === 'start' && creation.targetEndpoint === 'start'
        ? 'ss'
        : creation.endpoint === 'finish' && creation.targetEndpoint === 'start'
          ? 'fs'
          : creation.endpoint === 'finish' && creation.targetEndpoint === 'finish'
            ? 'ff'
            : 'sf'
      void api(`/cards/${creation.cardId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ successor_card_id: creation.targetId, type }),
      }).then(onChange).catch((error: unknown) => {
        setDragError(error instanceof Error ? error.message : 'No se pudo crear la dependencia.')
      })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDependencyCreation(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dependencyCreation, onChange])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const activeDrag = dragState

    function handlePointerMove(event: PointerEvent) {
      const dayDelta = Math.round((event.clientX - activeDrag.pointerStartX) / activeDrag.dayWidth)
      const dates = datesForDrag(activeDrag.card, activeDrag.mode, dayDelta)

      setDragPreview({ cardId: activeDrag.card.id, ...dates })
    }

    function handlePointerUp() {
      const preview = dragPreview
      setDragState(null)

      if (!preview || preview.cardId !== activeDrag.card.id) {
        return
      }

      const changed = preview.start !== activeDrag.card.start_date || preview.due !== activeDrag.card.due_date
      if (!changed) {
        setDragPreview(null)
        return
      }

      suppressClickRef.current = preview.cardId
      void api(`/cards/${preview.cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ start_date: preview.start, due_date: preview.due }),
      }).then(onChange).catch((error: unknown) => {
        setDragError(error instanceof Error ? error.message : 'No se pudieron guardar las fechas.')
      }).finally(() => {
        setDragPreview(null)
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragPreview, dragState, onChange])

  return (
    <div className={styles.gantt} data-zoom={zoom} data-left-collapsed={leftCollapsed} style={{ '--left-width': `${effectiveLeftWidth}px` } as CSSProperties}>
      {dragError && <p className={styles.dragError} role="alert">{dragError}</p>}
      {leftCollapsed ? (
        <button
          className={`${styles.ganttLeft} ${styles.collapsedRail}`}
          type="button"
          title="Expandir panel"
          aria-label="Expandir panel"
          onClick={() => setLeftCollapsed(false)}
        >
          <ExpandColumnIcon />
        </button>
      ) : (
        <div className={styles.ganttLeft} style={gridStyle}>
          <>
            <div ref={(element) => {
              toolbarRef.current = element
              leftToolbarRef.current = element
            }} className={styles.leftToolbar}>
              <button type="button" title="Colapsar panel" aria-label="Colapsar panel" onClick={() => setLeftCollapsed(true)}>
                <CollapseColumnIcon />
              </button>
              {ZOOMS.map((value) => <button key={value} type="button" className={zoom === value ? styles.selected : ''} onClick={() => setZoom(value)}>{value === 'day' ? 'Día' : value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Trimestre'}</button>)}
              <button className={styles.visibilityButton} type="button" title="Columnas" aria-label="Configurar columnas" onClick={() => setColumnsOpen((open) => !open)}>
                <EyeLowVisionIcon />
              </button>
              {columnsOpen && (
                <div className={styles.columnsPopover} role="dialog" aria-label="Columnas">
                  <strong>Columnas</strong>
                  {(['start', 'end', 'progress'] as const).map((column) => (
                    <label key={column} className={styles.columnOption}>
                      <input
                        type="checkbox"
                        checked={visibility[column]}
                        onChange={() => setVisibility((current) => ({ ...current, [column]: !current[column] }))}
                      />
                      {column === 'start' ? 'Inicio' : column === 'end' ? 'Fin' : 'Progreso'}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.leftHeader}><span>Tarea</span>{visibility.start && <span>Inicio</span>}{visibility.end && <span>Fin</span>}{visibility.progress && <span>Progreso</span>}</div>
            {entries.map(({ group, row: groupRow, collapsed: isCollapsed }) => {
          const stats = categoryStats(group)

          return (
            <div key={group.id} className={styles.leftCategory} style={{ gridRow: groupRow }}>
              <div className={styles.categoryInfo}>
                <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))}>{isCollapsed ? '▸' : '▾'} {group.name}</button>
                <small>{group.cards.length}</small>
              </div>
              {visibility.start && <span>{compactDate(stats.start)}</span>}
              {visibility.end && <span>{compactDate(stats.end)}</span>}
              {visibility.progress && <span>{stats.progress === null ? '—' : `${stats.progress}%`}</span>}
            </div>
          )
            })}
            {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <button key={item.card.id} className={`${styles.leftCard} ${index % 2 === 1 ? styles.leftCardAlternate : ''}`} style={{ gridRow: groupRow + index + 1 }} type="button" onClick={() => onOpen(item.card)}><strong>{item.card.title}</strong>{visibility.start && <span>{compactDate(item.card.start_date)}</span>}{visibility.end && <span>{compactDate(item.card.due_date)}</span>}{visibility.progress && <span>{`${cardVisualProgress(item)}%`}</span>}</button>))}
          </>
        </div>
      )}
        <div className={styles.timelineViewport}>
        <div ref={timelineGridRef} className={styles.timelineGrid} style={gridStyle}>
          {(showMonths ? monthQuarterRows : showQuarters ? yearRows : monthRows).map((item) => <span key={item.label} className={showMonths || showQuarters ? styles.quarter : styles.month} style={{ gridRow: 1, gridColumn: `${item.start} / ${item.end}` }}>{item.label}</span>)}
          {showMonths && monthRows.map((month) => <span key={`month-${month.label}`} className={styles.month} style={{ gridRow: 2, gridColumn: `${month.start} / ${month.end}` }}>{month.label}</span>)}
          {showQuarters && quarterRows.map((quarter) => <span key={`quarter-${quarter.start}`} className={styles.quarter} style={{ gridRow: 2, gridColumn: `${quarter.start} / ${quarter.end}` }}>{quarter.label}</span>)}
          {!showMonths && !showQuarters && (showWeeks ? weekRows : days.map((day, index) => ({ label: formatDay(day.date), start: index + 1, end: index + 2 }))).map((item) => <span key={`${item.label}-${item.start}`} className={styles.day} style={{ gridRow: 2, gridColumn: `${item.start} / ${item.end}` }}>{item.label}</span>)}
          {entries.map(({ group, row: groupRow }) => <span key={`category-background-${group.id}`} className={styles.categoryRowBackground} style={{ gridRow: groupRow, gridColumn: '1 / -1' }} aria-hidden="true" />)}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <span key={`task-background-${item.card.id}`} className={`${styles.taskRowBackground} ${index % 2 === 1 ? styles.taskRowAlternate : ''}`} style={{ gridRow: groupRow + index + 1, gridColumn: '1 / -1' }} aria-hidden="true" />))}
          {zoom === 'day' && days.map((day, index) => isWeekend(day) && <span key={`weekend-${day.key}`} className={styles.weekend} style={{ gridRow: '2 / -1', gridColumn: index + 1 }} aria-hidden="true" />)}
          {zoom === 'day' && days.slice(0, -1).map((day, index) => <span key={`day-line-${day.key}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${index + 1} / span 1` }} aria-hidden="true" />)}
          {zoom === 'week' && weekRows.slice(0, -1).map((week) => <span key={`week-line-${week.start}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${week.end - 1} / span 1` }} aria-hidden="true" />)}
          {showMonths && monthRows.slice(0, -1).map((month) => <span key={`month-line-${month.end}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${month.end - 1} / span 1` }} aria-hidden="true" />)}
          {showQuarters && quarterRows.slice(0, -1).map((quarter) => <span key={`quarter-line-${quarter.end}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${quarter.end - 1} / span 1` }} aria-hidden="true" />)}
          {entries.map(({ group, row: groupRow }) => {
            const rangeValue = categoryRange(group, range.start)

            if (!rangeValue) {
              return null
            }

            const stats = categoryStats(group)
            const progress = stats.progress ?? 0
            const summaryStyle = {
              gridRow: groupRow,
              gridColumn: rangeValue,
              '--category-progress': `${progress}%`,
            } as CSSProperties

            return <span key={`summary-${group.id}`} className={styles.categorySummary} style={summaryStyle} aria-hidden="true" />
          })}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => {
            if (!hasTemporalPlanning(item)) {
              return false
            }

            const cardColor = item.card.color || item.column.color || 'var(--accent)'
            const progress = cardVisualProgress(item)
            const preview = dragPreview?.cardId === item.card.id ? dragPreview : null
            const startDate = preview?.start ?? item.card.start_date!
            const dueDate = preview?.due ?? item.card.due_date!
            const cardStyle = {
              gridRow: groupRow + index + 1,
              gridColumn: `${gridColumn(range.start, startDate)} / ${dateEndColumn(range.start, dueDate)}`,
              '--card-color': cardColor,
              '--card-progress': `${progress}%`,
            } as CardBarStyle

            const cardClassName = [
              styles.cardBar,
              item.column.workflow_state === 'pending' ? styles.pendingBar : '',
              preview ? styles.dragging : '',
              dependencyCreation ? styles.dependencyCreating : '',
            ].filter(Boolean).join(' ')

            const inReview = item.column.workflow_state === 'review'
            const isDone = item.column.workflow_state === 'done'
            const cardLabel = inReview
              ? `${item.card.title}, En revisión`
              : isDone
                ? `${item.card.title}, Completado`
                : item.card.title

            const dateLabel = `${compactDate(startDate)} — ${compactDate(dueDate)}`
            const workflowLabel = item.column.workflow_state === 'in_progress'
              ? 'En progreso'
              : item.column.workflow_state === 'review'
                ? 'En revisión'
                : item.column.workflow_state === 'done'
                  ? 'Completado'
                  : item.column.workflow_state === 'pending'
                    ? 'Pendiente'
                    : 'Backlog'

            void workflowLabel

            return (
              <button
                key={item.card.id}
                className={cardClassName}
                data-card-id={item.card.id}
                type="button"
                onClick={() => {
                  if (suppressClickRef.current === item.card.id) {
                    suppressClickRef.current = null
                    return
                  }

                  onOpen(item.card)
                }}
                onPointerDown={(event) => beginDrag(event, item, 'move')}
                onPointerEnter={(event) => updateHoveredCard(event, item)}
                onPointerMove={(event) => updateHoveredCard(event, item)}
                onPointerLeave={clearHoveredCard}
                style={cardStyle}
                title={cardLabel}
                aria-label={cardLabel}
              >
                {canEdit && <span className={`${styles.dependencyConnector} ${styles.dependencyConnectorStart}`} data-dependency-connector="true" data-card-id={item.card.id} data-endpoint="start" data-target={dependencyCreation?.targetId === item.card.id && dependencyCreation.targetEndpoint === 'start' ? 'true' : undefined} onPointerDown={(event) => beginDependencyCreation(event, item.card.id, 'start')} role="button" aria-label={`Crear dependencia desde inicio de ${item.card.title}`} tabIndex={0}><DependencyConnectorIcon /></span>}
                {canEdit && <span className={`${styles.resizeHandle} ${styles.resizeHandleStart}`} onPointerDown={(event) => beginDrag(event, item, 'resize-start')} aria-hidden="true" />}
                {preview && <span className={styles.dragDates} aria-hidden="true">{dateLabel}</span>}
                {inReview && <EyeIcon />}
                {isDone && <DoneIcon />}
                {canEdit && <span className={`${styles.resizeHandle} ${styles.resizeHandleEnd}`} onPointerDown={(event) => beginDrag(event, item, 'resize-end')} aria-hidden="true" />}
                {canEdit && <span className={`${styles.dependencyConnector} ${styles.dependencyConnectorEnd}`} data-dependency-connector="true" data-card-id={item.card.id} data-endpoint="finish" data-target={dependencyCreation?.targetId === item.card.id && dependencyCreation.targetEndpoint === 'finish' ? 'true' : undefined} onPointerDown={(event) => beginDependencyCreation(event, item.card.id, 'finish')} role="button" aria-label={`Crear dependencia desde fin de ${item.card.title}`} tabIndex={0}><DependencyConnectorIcon /></span>}
              </button>
            )
          }))}
          <svg className={styles.dependencyLayer} viewBox={`0 0 1000 ${row * 30 + 56}`} preserveAspectRatio="none" aria-label="Dependencias de tareas">
            <defs>
              <marker id="gantt-dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0 0L7 3.5L0 7Z" />
              </marker>
            </defs>
            {dependencyCreation && (() => {
              const source = cardRows.get(dependencyCreation.cardId)
              const grid = timelineGridRef.current?.getBoundingClientRect()
              if (!source || !grid) return null
              const date = dependencyCreation.endpoint === 'start' ? source.item.card.start_date! : source.item.card.due_date!
              const sourceColumn = dependencyCreation.endpoint === 'start' ? gridColumn(range.start, date) : dateEndColumn(range.start, date)
              const x1 = ((sourceColumn - 1) / days.length) * 1000
              const y1 = 56 + (source.row - 3) * 30 + 15
              const x2 = ((dependencyCreation.cursorX - grid.left) / grid.width) * 1000
              const y2 = dependencyCreation.cursorY - grid.top
              return <path className={styles.dependencyPreview} d={`M ${x1} ${y1} L ${x2} ${y2}`} />
            })()}
            {ganttDependencies.map((dependency) => {
              const predecessor = cardRows.get(dependency.predecessorId)
              const successor = cardRows.get(dependency.successorId)
              if (!predecessor || !successor || !hasTemporalPlanning(predecessor.item) || !hasTemporalPlanning(successor.item)) return null
              const predecessorStart = gridColumn(range.start, predecessor.item.card.start_date!)
              const predecessorEnd = dateEndColumn(range.start, predecessor.item.card.due_date!)
              const successorStart = gridColumn(range.start, successor.item.card.start_date!)
              const successorEnd = dateEndColumn(range.start, successor.item.card.due_date!)
              const from = dependency.type === 'ss' || dependency.type === 'sf' ? predecessorStart : predecessorEnd
              const to = dependency.type === 'ff' || dependency.type === 'sf' ? successorEnd : successorStart
              const x1 = ((from - 1) / days.length) * 1000
              const x2 = ((to - 1) / days.length) * 1000
              const y1 = 56 + (predecessor.row - 3) * 30 + 15
              const y2 = 56 + (successor.row - 3) * 30 + 15
              const midX = (x1 + x2) / 2
              const path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
              return (
                <g key={dependency.id} className={dependencyPopover?.dependency.id === dependency.id ? styles.dependencySelected : ''}>
                  <path className={styles.dependencyHitArea} d={path} onClick={(event) => setDependencyPopover({ dependency, x: event.clientX, y: event.clientY })} aria-label={`Dependencia ${dependency.type.toUpperCase()}: ${predecessor.item.card.title} → ${successor.item.card.title}`} />
                  <path className={styles.dependencyLine} d={path} markerEnd="url(#gantt-dependency-arrow)" aria-hidden="true" />
                </g>
              )
            })}
          </svg>
          {todayVisible && <>
            <span className={styles.todayLabel} style={{ gridRow: 2, gridColumn: `${todayColumn} / span 1` }}>Hoy</span>
            <span className={styles.todayLine} style={{ gridRow: '3 / -1', gridColumn: `${todayColumn} / span 1` }} aria-hidden="true" />
          </>}
        </div>
      </div>
      {dependencyPopover && (
        <div className={styles.dependencyPopover} role="dialog" aria-label="Tipo de dependencia" style={{ left: dependencyPopover.x, top: dependencyPopover.y }}>
          <strong>Tipo de dependencia</strong>
          {(['fs', 'ss', 'ff', 'sf'] as const).map((type) => (
            <label key={type}>
              <input type="radio" checked={dependencyPopover.dependency.type === type} disabled={!canEdit} onChange={() => void changeDependency(dependencyPopover.dependency, type)} />
              {type === 'fs' ? 'Fin → Inicio (FS)' : type === 'ss' ? 'Inicio → Inicio (SS)' : type === 'ff' ? 'Fin → Fin (FF)' : 'Inicio → Fin (SF)'}
            </label>
          ))}
          {canEdit && <button type="button" className="ghost" onClick={() => void deleteDependency(dependencyPopover.dependency)}>Eliminar dependencia</button>}
        </div>
      )}
      {hoveredCard && !dragState && !dragPreview && !dependencyCreation
        ? createPortal(
            <div className={styles.kanbanMiniCardPortal} style={{ left: hoveredCard.left, top: hoveredCard.top }}>
              <KanbanMiniCard card={hoveredCard.item.card} />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
