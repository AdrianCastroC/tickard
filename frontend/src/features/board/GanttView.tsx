import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { BoardPayload, Card, Column } from '../../api'
import styles from './GanttView.module.css'

const DAY_WIDTH = 36
const DAY_MS = 86400000
const DEFAULT_COLUMNS = { start: true, end: true, progress: true }
type Day = { key: string; date: Date }
type ColumnVisibility = typeof DEFAULT_COLUMNS
type GanttCard = { card: Card; column: Column }
type CategoryGroup = { id: string; name: string; cards: GanttCard[] }

function dateKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}` }
function parseDay(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)) }
function shift(value: string, amount: number) { const date = parseDay(value); date.setUTCDate(date.getUTCDate() + amount); return dateKey(date) }
function daysBetween(start: string, end: string) { return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / DAY_MS) }
function todayKey() { return dateKey(new Date()) }
function formatMonth(date: Date) { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) }
function formatDay(date: Date) { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'UTC' }).format(date) }
function compactDate(value?: string | null) { return value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseDay(value)).replace('.', '') : '—' }
function planned(card: Card) { return Boolean(card.start_date && card.due_date) }

function timelineRange(cards: Card[]) {
  const plannedCards = cards.filter(planned)
  if (!plannedCards.length) return { start: shift(dateKey(new Date()), -7), end: shift(dateKey(new Date()), 14) }
  const start = plannedCards.reduce((min, card) => card.start_date! < min ? card.start_date! : min, plannedCards[0].start_date!)
  const end = plannedCards.reduce((max, card) => card.due_date! > max ? card.due_date! : max, plannedCards[0].due_date!)
  const visibleStart = shift(start, -5); const visibleEnd = shift(end, 5); const minimumDays = 60; const currentDays = daysBetween(visibleStart, visibleEnd) + 1
  return { start: visibleStart, end: currentDays < minimumDays ? shift(visibleEnd, minimumDays - currentDays) : visibleEnd }
}
function buildDays(start: string, end: string): Day[] { return Array.from({ length: daysBetween(start, end) + 1 }, (_, index) => { const key = shift(start, index); return { key, date: parseDay(key) } }) }
function monthBlocks(days: Day[]) { const blocks: { label: string; count: number }[] = []; days.forEach(({ date }) => { const label = formatMonth(date); const last = blocks.at(-1); if (last?.label === label) last.count += 1; else blocks.push({ label, count: 1 }) }); return blocks }
function categoryGroups(board: BoardPayload, cards: BoardPayload['columns']): CategoryGroup[] {
  const items = cards.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = board.categories.map((category) => ({ id: String(category.id), name: category.name, cards: items.filter(({ card }) => card.category_id === category.id) }))
  const uncategorized = items.filter(({ card }) => card.category_id == null)
  if (uncategorized.length) groups.push({ id: 'uncategorized', name: 'Sin categoría', cards: uncategorized })
  return groups.filter((group) => group.cards.length > 0)
}

function weekendDays(days: Day[]) { return days.map(({ key, date }, index) => (date.getUTCDay() === 0 || date.getUTCDay() === 6) ? { key, index } : null).filter((item): item is { key: string; index: number } => item !== null) }

function TimelineBackground({ days, todayOffset }: { days: Day[]; todayOffset: number | null }) {
  return <>{todayOffset !== null && <span className={styles.todayLine} style={{ left: todayOffset * DAY_WIDTH }} aria-hidden="true" />}{weekendDays(days).map(({ key, index }) => <span key={key} className={styles.weekendShade} style={{ left: index * DAY_WIDTH }} aria-hidden="true" />)}</>
}

function TaskRow({ item, days, visibility, todayOffset, onOpen }: { item: GanttCard; days: Day[]; visibility: ColumnVisibility; todayOffset: number | null; onOpen: (card: Card) => void }) {
  const { card, column } = item
  const barStart = card.start_date ? daysBetween(days[0].key, card.start_date) : 0
  const width = planned(card) ? (daysBetween(card.start_date!, card.due_date!) + 1) * DAY_WIDTH : 0
  const color = card.color || column.color || 'var(--accent)'
  const tableColumns = `minmax(0, 1fr) ${visibility.start ? '78px' : ''} ${visibility.end ? '78px' : ''} ${visibility.progress ? '68px' : ''}`
  return <div className={styles.row}>
    <button className={styles.task} style={{ gridTemplateColumns: tableColumns }} type="button" onClick={() => onOpen(card)}><strong>{card.title}</strong>{visibility.start && <span>{compactDate(card.start_date)}</span>}{visibility.end && <span>{compactDate(card.due_date)}</span>}{visibility.progress && <span>{card.progress ? `${card.progress.percent}%` : '—'}</span>}</button>
    <div className={styles.timelineRow} style={{ width: days.length * DAY_WIDTH }}><TimelineBackground days={days} todayOffset={todayOffset} />{planned(card) && <button className={styles.bar} type="button" onClick={() => onOpen(card)} style={{ left: barStart * DAY_WIDTH, width, background: color }} title={card.title}>{width >= 150 ? card.title : null}</button>}</div>
  </div>
}

function SummaryRow({ group, days, todayOffset }: { group: CategoryGroup; days: Day[]; todayOffset: number | null }) {
  const plannedCards = group.cards.filter(({ card }) => planned(card)).map(({ card }) => card)
  if (!plannedCards.length) return <div className={styles.summaryTimeline} />
  const start = plannedCards.reduce((min, card) => card.start_date! < min ? card.start_date! : min, plannedCards[0].start_date!)
  const end = plannedCards.reduce((max, card) => card.due_date! > max ? card.due_date! : max, plannedCards[0].due_date!)
  return <div className={styles.summaryTimeline} style={{ width: days.length * DAY_WIDTH }}><TimelineBackground days={days} todayOffset={todayOffset} /><span className={styles.summaryBar} style={{ left: daysBetween(days[0].key, start) * DAY_WIDTH, width: (daysBetween(start, end) + 1) * DAY_WIDTH }} /></div>
}

export function GanttView({ board, cards, onOpen }: { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }) {
  const allItems = cards.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = useMemo(() => categoryGroups(board, cards), [board, cards])
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => { try { const raw = localStorage.getItem(`tickard:gantt-columns:${board.board.id}`); return raw ? { ...DEFAULT_COLUMNS, ...JSON.parse(raw) } : DEFAULT_COLUMNS } catch { return DEFAULT_COLUMNS } })
  const [columnsOpen, setColumnsOpen] = useState(false)
  useEffect(() => { localStorage.setItem(`tickard:gantt-columns:${board.board.id}`, JSON.stringify(visibility)) }, [board.board.id, visibility])
  const range = timelineRange(allItems.map(({ card }) => card)); const days = buildDays(range.start, range.end); const months = monthBlocks(days); const today = todayKey(); const todayOffset = today >= range.start && today <= range.end ? daysBetween(range.start, today) : null
  const leftWidth = 150 + (visibility.start ? 78 : 0) + (visibility.end ? 78 : 0) + (visibility.progress ? 68 : 0)
  const gridStyle = { '--left-width': `${leftWidth}px` } as CSSProperties
  return <div className={styles.gantt}>
    <div className={styles.toolbar}><span>Columnas</span><button type="button" className={styles.columnsButton} onClick={() => setColumnsOpen(!columnsOpen)} aria-expanded={columnsOpen}>Columnas</button>{columnsOpen && <div className={styles.columnsMenu}>{(['start', 'end', 'progress'] as const).map((key) => <label key={key}><input type="checkbox" checked={visibility[key]} onChange={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))} />{key === 'start' ? 'Inicio' : key === 'end' ? 'Fin' : 'Progreso'}</label>)}</div>}</div>
    <div className={styles.scroll}>
      <div className={styles.header} style={gridStyle}><div className={styles.tableHeader} style={{ gridTemplateColumns: `minmax(0, 1fr) ${visibility.start ? '78px' : ''} ${visibility.end ? '78px' : ''} ${visibility.progress ? '68px' : ''}` }}><strong>Tarea</strong>{visibility.start && <strong>Inicio</strong>}{visibility.end && <strong>Fin</strong>}{visibility.progress && <strong>Progreso</strong>}</div><div className={styles.timelineHeader} style={{ width: days.length * DAY_WIDTH }}><TimelineBackground days={days} todayOffset={todayOffset} /><div className={styles.months}>{months.map((month) => <span key={month.label} style={{ width: month.count * DAY_WIDTH }}>{month.label}</span>)}</div><div className={styles.days}>{days.map(({ key, date }) => <span className={`${key === today ? styles.today : ''}`} key={key}>{formatDay(date)}</span>)}</div></div></div>
      {groups.map((group) => <section key={group.id} className={styles.group}><div className={styles.categoryRow} style={gridStyle}><div className={styles.categoryLabel}>● {group.name} <small>{group.cards.length}</small></div><SummaryRow group={group} days={days} todayOffset={todayOffset} /></div>{group.cards.map((item) => <TaskRow key={item.card.id} item={item} days={days} visibility={visibility} todayOffset={todayOffset} onOpen={onOpen} />)}</section>)}
    </div>
  </div>
}
