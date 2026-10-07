import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { BoardPayload, Card, Column } from '../../api'
import styles from './GanttView.module.css'

const DAY_MS = 86_400_000
const DEFAULT_COLUMNS = { start: true, end: true, progress: true }
const ZOOMS = ['day', 'week', 'month', 'quarter'] as const
type Zoom = (typeof ZOOMS)[number]
type Visibility = typeof DEFAULT_COLUMNS
type Day = { key: string; date: Date }
type GanttCard = { card: Card; column: Column }
type CategoryGroup = { id: string; name: string; cards: GanttCard[] }
type TimelineEntry = { group: CategoryGroup; row: number; collapsed: boolean }

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
  return { start: shift(start, -4), end: shift(end, 4) }
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
  const firstOfMonth = dateKey(new Date(Date.UTC(parseDay(weekStart).getUTCFullYear(), parseDay(weekStart).getUTCMonth(), 1)))
  return Math.floor(daysBetween(monday(firstOfMonth), weekStart) / 7) + 1
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

function categoryRange(group: CategoryGroup, timelineStart: string) {
  const cards = group.cards.filter(({ card }) => planned(card)).map(({ card }) => card)
  if (cards.length === 0) return null
  const start = cards.reduce((value, card) => card.start_date! < value ? card.start_date! : value, cards[0].start_date!)
  const end = cards.reduce((value, card) => card.due_date! > value ? card.due_date! : value, cards[0].due_date!)
  return `${gridColumn(timelineStart, start)} / ${dateEndColumn(timelineStart, end)}`
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
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_COLUMNS)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
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
  const gridStyle = { '--total-days': totalDays, '--data-rows': row - 3 } as CSSProperties

  useEffect(() => {
    localStorage.setItem(`tickard:gantt-zoom:${board.board.id}`, zoom)
  }, [board.board.id, zoom])

  const monthRows = monthSpans(days)
  const weekRows = weekSpans(days)
  const showWeeks = zoom === 'week'

  return (
    <div className={styles.gantt} data-zoom={zoom}>
      <div className={styles.ganttLeft} style={gridStyle}>
        <div className={styles.leftToolbar}>
          {ZOOMS.map((value) => <button key={value} type="button" className={zoom === value ? styles.selected : ''} onClick={() => setZoom(value)}>{value === 'day' ? 'Día' : value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Trimestre'}</button>)}
        </div>
        <div className={styles.leftHeader}><span>Tarea</span>{visibility.start && <span>Inicio</span>}{visibility.end && <span>Fin</span>}{visibility.progress && <span>Progreso</span>}</div>
        {entries.map(({ group, row: groupRow, collapsed: isCollapsed }) => <div key={group.id} className={styles.leftCategory} style={{ gridRow: groupRow }}><button type="button" onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))}>{isCollapsed ? '▸' : '▾'} {group.name}</button><small>{group.cards.length}</small></div>)}
        {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <button key={item.card.id} className={styles.leftCard} style={{ gridRow: groupRow + index + 1 }} type="button" onClick={() => onOpen(item.card)}><strong>{item.card.title}</strong>{visibility.start && <span>{compactDate(item.card.start_date)}</span>}{visibility.end && <span>{compactDate(item.card.due_date)}</span>}{visibility.progress && <span>{item.card.progress ? `${item.card.progress.percent}%` : '—'}</span>}</button>))}
      </div>
      <div className={styles.timelineViewport}>
        <div className={styles.timelineGrid} style={gridStyle}>
          {monthRows.map((month) => <span key={month.label} className={styles.month} style={{ gridRow: 1, gridColumn: `${month.start} / ${month.end}` }}>{month.label}</span>)}
          {(showWeeks ? weekRows : days.map((day, index) => ({ label: formatDay(day.date), start: index + 1, end: index + 2 }))).map((item) => <span key={`${item.label}-${item.start}`} className={styles.day} style={{ gridRow: 2, gridColumn: `${item.start} / ${item.end}` }}>{item.label}</span>)}
          {days.map((day, index) => isWeekend(day) && <span key={`weekend-${day.key}`} className={styles.weekend} style={{ gridRow: '1 / -1', gridColumn: index + 1 }} aria-hidden="true" />)}
          {entries.map(({ group, row: groupRow }) => { const rangeValue = categoryRange(group, range.start); return <span key={`summary-${group.id}`} className={styles.categorySummary} style={{ gridRow: groupRow, gridColumn: rangeValue ?? '1 / 2' }} aria-hidden="true" /> })}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => planned(item.card) && <button key={item.card.id} className={styles.cardBar} data-card-id={item.card.id} type="button" onClick={() => onOpen(item.card)} style={{ gridRow: groupRow + index + 1, gridColumn: `${gridColumn(range.start, item.card.start_date!)} / ${dateEndColumn(range.start, item.card.due_date!)}`, background: item.card.color || item.column.color || 'var(--accent)' }} title={item.card.title}><span>{item.card.title}</span></button>))}
          {dateKey(new Date()) >= range.start && dateKey(new Date()) <= range.end && <span className={styles.todayLine} style={{ gridRow: '1 / -1', gridColumn: `${gridColumn(range.start, dateKey(new Date()))} / span 1` }} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}
