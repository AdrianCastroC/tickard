import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { BoardPayload, Card, Column } from '../../api'
import styles from './GanttView.module.css'

const ZOOM_WIDTHS = { day: 32, week: 84, month: 108, quarter: 140 } as const
type Zoom = keyof typeof ZOOM_WIDTHS
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
function naturalWeeks(days: Day[]) {
  const first = parseDay(monday(days[0].key)); const last = parseDay(monday(days.at(-1)!.key)); const weeks: { start: string; owner: string; key: string }[] = []
  for (let cursor = first; cursor <= last; cursor = parseDay(shift(dateKey(cursor), 7))) {
    const start = dateKey(cursor); const dayOne = Array.from({ length: 7 }, (_, index) => parseDay(shift(start, index))).find((date) => date.getUTCDate() === 1); const ownerDate = dayOne || cursor; const owner = `${ownerDate.getUTCFullYear()}-${ownerDate.getUTCMonth()}`; weeks.push({ start, owner, key: `week-${start}` })
  }
  return weeks
}
function weekMonthBlocks(days: Day[]) {
  const blocks: { label: string; count: number }[] = []
  naturalWeeks(days).forEach((week) => {
    for (let index = 0; index < 7; index += 1) {
      const date = parseDay(shift(week.start, index)); const label = formatMonth(date); const last = blocks.at(-1)
      if (last?.label === label) last.count += 1 / 7
      else blocks.push({ label, count: 1 / 7 })
    }
  })
  return blocks
}
function monthSegments(days: Day[], weekWidth: number) {
  const timelineStart = monday(days[0].key); const timelineEnd = shift(monday(days.at(-1)!.key), 7); const segments: { label: string; left: number; width: number }[] = []; let cursor = parseDay(`${days[0].date.getUTCFullYear()}-${String(days[0].date.getUTCMonth() + 1).padStart(2, '0')}-01`)
  while (cursor < parseDay(timelineEnd)) { const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)); const start = Math.max(0, daysBetween(timelineStart, dateKey(cursor))); const end = Math.min(daysBetween(timelineStart, dateKey(next)), daysBetween(timelineStart, timelineEnd)); if (end > 0 && start < end) segments.push({ label: formatMonth(cursor), left: start / 7 * weekWidth, width: (end - start) / 7 * weekWidth }); cursor = next }
  return segments
}
function lowerTimelineBlocks(days: Day[], zoom: Zoom) {
  if (zoom === 'day') return days.map(({ date, key }) => ({ label: formatDay(date), count: 1, key }))
  const blocks: { label: string; count: number; key: string }[] = []
  if (zoom === 'week') { const counters = new Map<string, number>(); naturalWeeks(days).forEach((week) => { const number = (counters.get(week.owner) || 0) + 1; counters.set(week.owner, number); blocks.push({ label: `S${number}`, count: 1, key: week.key }) }); return blocks }
  if (zoom === 'month') return monthBlocks(days).map((block, index) => ({ label: block.label.split(' ')[0], count: block.count, key: `month-${index}` }))
  for (let index = 0; index < days.length; index += 90) blocks.push({ label: `T${Math.floor(days[index].date.getUTCMonth() / 3) + 1}`, count: Math.min(90, days.length - index), key: `quarter-${index}` })
  return blocks
}
function monday(value: string) { const date = parseDay(value); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1); return dateKey(date) }
function weekPosition(value: string, start: string, edge: 'start' | 'end') { const weekStart = monday(start); const weekday = parseDay(value).getUTCDay() || 7; const week = Math.floor(daysBetween(weekStart, monday(value)) / 7); return week + (edge === 'end' ? weekday / 7 : (weekday - 1) / 7) }
function upperTimelineBlocks(days: Day[], zoom: Zoom) {
  const lower = lowerTimelineBlocks(days, zoom); if (zoom === 'day') return monthBlocks(days)
  if (zoom === 'week') return weekMonthBlocks(days)
  if (zoom === 'month') { const blocks: { label: string; count: number }[] = []; lower.forEach((block, index) => { const date = days.slice(0, index + 1).find((day) => day.key) ? days[Math.min(days.length - 1, index * 30)].date : days[0].date; const label = `T${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`; const last = blocks.at(-1); if (last?.label === label) last.count += block.count; else blocks.push({ label, count: block.count }) }); return blocks }
  const blocks: { label: string; count: number }[] = []; lower.forEach((block, index) => { const date = days[Math.min(days.length - 1, index * 90)].date; const label = String(date.getUTCFullYear()); const last = blocks.at(-1); if (last?.label === label) last.count += block.count; else blocks.push({ label, count: block.count }) }); return blocks
}
function categoryGroups(board: BoardPayload, cards: BoardPayload['columns']): CategoryGroup[] {
  const items = cards.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = board.categories.map((category) => ({ id: String(category.id), name: category.name, cards: items.filter(({ card }) => card.category_id === category.id) }))
  const uncategorized = items.filter(({ card }) => card.category_id == null)
  if (uncategorized.length) groups.push({ id: 'uncategorized', name: 'Sin categoría', cards: uncategorized })
  return groups.filter((group) => group.cards.length > 0)
}

function isNonWorkingDay(date: Date) { return date.getUTCDay() === 0 || date.getUTCDay() === 6 }
function weekendDays(days: Day[]) { return days.map(({ key, date }, index) => isNonWorkingDay(date) ? { key, index } : null).filter((item): item is { key: string; index: number } => item !== null) }

function TimelineBackground({ days, todayOffset, dayWidth, showWeekends = dayWidth === 32 }: { days: Day[]; todayOffset: number | null; dayWidth: number; showWeekends?: boolean }) {
  return <>{todayOffset !== null && <span className={styles.todayLine} style={{ left: todayOffset * dayWidth }} aria-hidden="true" />}{showWeekends && weekendDays(days).map(({ key, index }) => <span key={key} className={styles.weekendShade} style={{ left: index * dayWidth, width: dayWidth }} aria-hidden="true" />)}</>
}

function TaskRow({ item, days, visibility, todayOffset, dayWidth, zoom, timelineWidth, rowStyle, onOpen }: { item: GanttCard; days: Day[]; visibility: ColumnVisibility; todayOffset: number | null; dayWidth: number; zoom: Zoom; timelineWidth: number; rowStyle: CSSProperties; onOpen: (card: Card) => void }) {
  const { card, column } = item
  const barStart = card.start_date ? (zoom === 'week' ? weekPosition(card.start_date, days[0].key, 'start') : daysBetween(days[0].key, card.start_date)) : 0
  const barEnd = planned(card) ? (zoom === 'week' ? weekPosition(card.due_date!, days[0].key, 'end') : daysBetween(days[0].key, card.due_date!) + 1) : 0
  const width = planned(card) ? (barEnd - barStart) * dayWidth : 0
  const color = card.color || column.color || 'var(--accent)'
  const tableColumns = 'var(--panel-columns)'
  return <div className={styles.row} style={rowStyle}>
    <button className={styles.task} style={{ gridTemplateColumns: tableColumns }} type="button" onClick={() => onOpen(card)}><strong>{card.title}</strong>{visibility.start && <span>{compactDate(card.start_date)}</span>}{visibility.end && <span>{compactDate(card.due_date)}</span>}{visibility.progress && <span>{card.progress ? `${card.progress.percent}%` : '—'}</span>}</button>
    <div className={styles.timelineRow} style={{ width: timelineWidth, backgroundSize: `${zoom === 'week' ? dayWidth / 7 : dayWidth}px 100%` }}><TimelineBackground days={days} todayOffset={todayOffset} dayWidth={dayWidth} showWeekends={false} />{planned(card) && <button className={styles.bar} type="button" onClick={() => onOpen(card)} style={{ left: barStart * dayWidth, width, background: color }} title={card.title}><span className={styles.barProgress} style={{ width: `${Math.max(0, Math.min(100, card.progress?.percent ?? 0))}%` }} />{width >= 150 ? card.title : null}</button>}</div>
  </div>
}

function SummaryRow({ group, days, todayOffset, dayWidth }: { group: CategoryGroup; days: Day[]; todayOffset: number | null; dayWidth: number }) {
  const plannedCards = group.cards.filter(({ card }) => planned(card)).map(({ card }) => card)
  if (!plannedCards.length) return <div className={styles.summaryTimeline} />
  const start = plannedCards.reduce((min, card) => card.start_date! < min ? card.start_date! : min, plannedCards[0].start_date!)
  const end = plannedCards.reduce((max, card) => card.due_date! > max ? card.due_date! : max, plannedCards[0].due_date!)
  return <div className={styles.summaryTimeline} style={{ width: days.length * dayWidth, backgroundSize: `${dayWidth}px 100%` }}><TimelineBackground days={days} todayOffset={todayOffset} dayWidth={dayWidth} showWeekends={dayWidth === 32} /><span className={styles.summaryBar} style={{ left: daysBetween(days[0].key, start) * dayWidth, width: (daysBetween(start, end) + 1) * dayWidth }} /></div>
}

export function GanttView({ board, cards, onOpen }: { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }) {
  const allItems = cards.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = useMemo(() => categoryGroups(board, cards), [board, cards])
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => { try { const raw = localStorage.getItem(`tickard:gantt-columns:${board.board.id}`); return raw ? { ...DEFAULT_COLUMNS, ...JSON.parse(raw) } : DEFAULT_COLUMNS } catch { return DEFAULT_COLUMNS } })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(`tickard:gantt-collapsed:${board.board.id}`) || '{}') } catch { return {} } })
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [zoom, setZoom] = useState<Zoom>(() => { const saved = localStorage.getItem(`tickard:gantt-zoom:${board.board.id}`); return saved === 'day' || saved === 'week' || saved === 'month' || saved === 'quarter' ? saved : 'week' })
  useEffect(() => { localStorage.setItem(`tickard:gantt-columns:${board.board.id}`, JSON.stringify(visibility)) }, [board.board.id, visibility])
  useEffect(() => { localStorage.setItem(`tickard:gantt-collapsed:${board.board.id}`, JSON.stringify(collapsed)) }, [board.board.id, collapsed])
  useEffect(() => { localStorage.setItem(`tickard:gantt-zoom:${board.board.id}`, zoom) }, [board.board.id, zoom])
  const dayWidth = ZOOM_WIDTHS[zoom]; const range = timelineRange(allItems.map(({ card }) => card)); const days = buildDays(range.start, range.end); const months = upperTimelineBlocks(days, zoom); const lowerTimeline = lowerTimelineBlocks(days, zoom); const timelineWidth = (zoom === 'week' ? lowerTimeline.length : days.length) * dayWidth; const today = todayKey(); const todayOffset = today >= range.start && today <= range.end ? (zoom === 'week' ? weekPosition(today, days[0].key, 'start') : daysBetween(range.start, today)) : null
  const leftWidth = 205 + (visibility.start ? 40 + 12 : 0) + (visibility.end ? 40 + 12 : 0) + (visibility.progress ? 64.67 + 12 : 0)
  const gridStyle = { '--left-width': `${leftWidth}px`, '--panel-columns': `minmax(0, 1fr) ${visibility.start ? '40px' : ''} ${visibility.end ? '40px' : ''} ${visibility.progress ? '64.67px' : ''}` } as CSSProperties
  return <div className={styles.gantt}>
    <div className={styles.toolbar}><div className={styles.zoom}><span>Zoom</span>{(['day', 'week', 'month', 'quarter'] as Zoom[]).map((value) => <button key={value} type="button" className={zoom === value ? styles.selected : ''} onClick={() => setZoom(value)}>{value === 'day' ? 'D�a' : value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Trimestre'}</button>)}</div><button type="button" className={styles.columnsButton} onClick={() => setColumnsOpen(!columnsOpen)} aria-expanded={columnsOpen}>Columnas</button>{columnsOpen && <div className={styles.columnsMenu}>{(['start', 'end', 'progress'] as const).map((key) => <label key={key}><input type="checkbox" checked={visibility[key]} onChange={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))} />{key === 'start' ? 'Inicio' : key === 'end' ? 'Fin' : 'Progreso'}</label>)}</div>}</div>
    <div className={styles.scroll}><div className={styles.periodBand} style={gridStyle}><div className={styles.periodBandSpacer}><div className={styles.zoom}>{(['day', 'week', 'month', 'quarter'] as Zoom[]).map((value) => <button key={value} type="button" className={zoom === value ? styles.selected : ''} onClick={() => setZoom(value)}>{value === 'day' ? 'Día' : value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Trimestre'}</button>)}</div></div><div className={styles.periodBandTimeline} style={{ width: timelineWidth }}>{zoom === 'week' ? <div className={styles.monthTrack}>{monthSegments(days, dayWidth).map((segment) => <span key={segment.label} className={styles.monthSegment} data-month={segment.label} style={{ left: segment.left, width: segment.width }}>{segment.label}</span>)}</div> : months.map((month) => <span key={month.label} style={{ width: month.count * dayWidth }}>{month.label}</span>)}</div></div>
      <div className={styles.header} style={gridStyle}><div className={styles.tableHeader} style={{ gridTemplateColumns: 'var(--panel-columns)' }}><strong>Tarea</strong>{visibility.start && <strong>Inicio</strong>}{visibility.end && <strong>Fin</strong>}{visibility.progress && <strong>Progreso</strong>}</div><div className={styles.timelineHeader} style={{ width: timelineWidth, backgroundSize: `${zoom === 'week' ? dayWidth / 7 : dayWidth}px 100%` }}><TimelineBackground days={days} todayOffset={todayOffset} dayWidth={dayWidth} />{zoom !== 'week' && <div className={styles.months}>{months.map((month) => <span key={month.label} style={{ width: month.count * dayWidth }}>{month.label}</span>)}</div>}<div className={styles.days}>{lowerTimeline.map((block) => <span style={{ width: block.count * dayWidth }} key={block.key}>{block.label}</span>)}</div></div></div>
      {groups.map((group) => <section key={group.id} className={styles.group}><div className={styles.categoryRow} style={gridStyle}><button className={styles.categoryLabel} type="button" onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))} aria-expanded={!collapsed[group.id]}><span>{collapsed[group.id] ? '▸' : '▾'} {group.name}</span><small>{group.cards.length}</small></button><SummaryRow group={group} days={days} todayOffset={todayOffset} dayWidth={dayWidth} /></div>{!collapsed[group.id] && group.cards.map((item) => <TaskRow key={item.card.id} item={item} days={days} visibility={visibility} todayOffset={todayOffset} dayWidth={dayWidth} zoom={zoom} timelineWidth={timelineWidth} rowStyle={gridStyle} onOpen={onOpen} />)}</section>)}
    </div>
  </div>
}
