import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { BoardPayload, Card, Column } from '../../api'
import { CollapseColumnIcon, ExpandColumnIcon, EyeLowVisionIcon } from '../../shared/icons'
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

type GanttGridStyle = CSSProperties & {
  '--left-columns': string
  '--left-width': string
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

function categoryGroups(board: BoardPayload, columns: BoardPayload['columns']): CategoryGroup[] {
  const items = columns.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = board.categories.map((category) => ({ id: String(category.id), name: category.name, cards: items.filter(({ card }) => card.category_id === category.id) }))
  const uncategorized = items.filter(({ card }) => card.category_id == null)
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
  const startDates = group.cards.map(({ card }) => card.start_date).filter((value): value is string => Boolean(value))
  const endDates = group.cards.map(({ card }) => card.due_date).filter((value): value is string => Boolean(value))
  const progressTotal = group.cards.reduce((total, { card }) => total + Math.min(100, Math.max(0, card.progress?.percent ?? 0)), 0)

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

type GanttProps = { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }

export function GanttView({ board, cards, onOpen }: GanttProps) {
  const allCards = cards.flatMap((column) => column.cards)
  const groups = useMemo(() => categoryGroups(board, cards), [board, cards])
  const [zoom, setZoom] = useState<Zoom>(() => (localStorage.getItem(`tickard:gantt-zoom:${board.board.id}`) as Zoom) || 'week')
  const visibilityStorageKey = `tickard:gantt-columns:${board.board.id}`
  const [visibility, setVisibility] = useState<Visibility>(() => readVisibility(visibilityStorageKey))
  const leftCollapsedStorageKey = `tickard:gantt-left-collapsed:${board.board.id}`
  const [leftCollapsed, setLeftCollapsed] = useState(() => readCollapsed(leftCollapsedStorageKey))
  const [columnsOpen, setColumnsOpen] = useState(false)
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

  return (
    <div className={styles.gantt} data-zoom={zoom} data-left-collapsed={leftCollapsed} style={{ '--left-width': `${effectiveLeftWidth}px` } as CSSProperties}>
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
            {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <button key={item.card.id} className={`${styles.leftCard} ${index % 2 === 1 ? styles.leftCardAlternate : ''}`} style={{ gridRow: groupRow + index + 1 }} type="button" onClick={() => onOpen(item.card)}><strong>{item.card.title}</strong>{visibility.start && <span>{compactDate(item.card.start_date)}</span>}{visibility.end && <span>{compactDate(item.card.due_date)}</span>}{visibility.progress && <span>{item.card.progress ? `${item.card.progress.percent}%` : '—'}</span>}</button>))}
          </>
        </div>
      )}
        <div className={styles.timelineViewport}>
        <div className={styles.timelineGrid} style={gridStyle}>
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
            if (!planned(item.card)) {
              return false
            }

            const cardColor = item.card.color || item.column.color || 'var(--accent)'
            const progress = Math.min(100, Math.max(0, item.card.progress?.percent ?? 0))
            const cardStyle = {
              gridRow: groupRow + index + 1,
              gridColumn: `${gridColumn(range.start, item.card.start_date!)} / ${dateEndColumn(range.start, item.card.due_date!)}`,
              '--card-color': cardColor,
              '--card-progress': `${progress}%`,
            } as CardBarStyle

            return <button key={item.card.id} className={styles.cardBar} data-card-id={item.card.id} type="button" onClick={() => onOpen(item.card)} style={cardStyle} title={item.card.title} aria-label={item.card.title} />
          }))}
          {todayVisible && <>
            <span className={styles.todayLabel} style={{ gridRow: 2, gridColumn: `${todayColumn} / span 1` }}>Hoy</span>
            <span className={styles.todayLine} style={{ gridRow: '3 / -1', gridColumn: `${todayColumn} / span 1` }} aria-hidden="true" />
          </>}
        </div>
      </div>
    </div>
  )
}
