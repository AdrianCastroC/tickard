import { useMemo, useState } from 'react'
import type { BoardPayload, Card, WorkflowState } from '../../api'
import { SortIcon } from '../../shared/icons'
import { Avatar, priorityLabel } from '../../shared/ui'
import { formatDateRange } from './DateRangePicker'
import { orderedColumnCards } from './boardUtils'
import styles from './TableView.module.css'

type Props = { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }
type SortKey = 'title' | 'state' | 'category' | 'assignee' | 'priority' | 'period' | 'labels'
type SortDirection = 'asc' | 'desc'
type TableRow = { card: Card; column: BoardPayload['columns'][number]; categoryName: string }
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })
const priorityRanks: Record<string, number> = { baja: 0, media: 1, alta: 2, urgente: 3 }
const stateRanks: Record<WorkflowState, number> = {
  backlog: 0, pending: 1, in_progress: 2, review: 3, done: 4,
}
const headings: { key: SortKey; label: string }[] = [
  { key: 'title', label: 'Tarea' }, { key: 'state', label: 'Estado' },
  { key: 'category', label: 'Categoría' }, { key: 'assignee', label: 'Responsable' },
  { key: 'priority', label: 'Prioridad' }, { key: 'period', label: 'Periodo' },
  { key: 'labels', label: 'Etiquetas' },
]

function compareNullable(a: string, b: string, direction: SortDirection) {
  // Unknown names, priorities and dates always come last, even descending.
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return collator.compare(a, b) * (direction === 'asc' ? 1 : -1)
}

function compareRows(a: TableRow, b: TableRow, key: SortKey, direction: SortDirection) {
  const scalar = (x: TableRow) => {
    switch (key) {
      case 'title': return x.card.title
      case 'category': return x.categoryName
      case 'assignee': return x.card.assignees?.map(person => person.name)
        .sort((left, right) => collator.compare(left, right)).join(', ') ?? ''
      case 'period': return x.card.start_date?.slice(0, 10) || x.card.due_date?.slice(0, 10) || ''
      case 'labels': return x.card.labels?.map(label => label.name)
        .sort((left, right) => collator.compare(left, right)).join(', ') ?? ''
      default: return ''
    }
  }
  let result = 0
  if (key === 'state') {
    result = (stateRanks[a.column.workflow_state] - stateRanks[b.column.workflow_state])
      * (direction === 'asc' ? 1 : -1)
    if (!result) result = collator.compare(a.column.name, b.column.name) * (direction === 'asc' ? 1 : -1)
  } else if (key === 'priority') {
    const aPriority = a.card.priority
    const bPriority = b.card.priority
    if (!aPriority || !bPriority) result = aPriority ? -1 : bPriority ? 1 : 0
    else result = (priorityRanks[aPriority] - priorityRanks[bPriority]) * (direction === 'asc' ? 1 : -1)
  } else result = compareNullable(scalar(a), scalar(b), direction)
  return result || collator.compare(a.card.title, b.card.title) || a.card.id - b.card.id
}

export function TableView({ board, cards, onOpen }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null)
  const rows = useMemo(() => {
    const categories = new Map((board.categories ?? []).map(category => [category.id, category.name]))
    const result: TableRow[] = cards.flatMap(column =>
      orderedColumnCards(column, board.categories ?? []).map(card => ({
        column, card, categoryName: categories.get(card.category_id ?? -1) ?? '',
      })))
    return sort ? result.sort((a, b) => compareRows(a, b, sort.key, sort.direction)) : result
  }, [board.categories, cards, sort])

  function changeSort(key: SortKey) {
    setSort(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return <div className={`${styles.scroll} board-table-scroll`} role="region"
    aria-label="Tabla de tareas" tabIndex={0}>
    <table className={styles.table}>
      <thead><tr>{headings.map(({ key, label }) => {
        const active = sort?.key === key
        const direction = active ? sort.direction : null
        return <th key={key} aria-sort={active ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
          <button className={`${styles.sortButton}${active ? ' ' + styles.sortButtonActive : ''}`}
            type="button" onClick={() => changeSort(key)}
            title={`Ordenar por ${label.toLowerCase()}`}
            aria-label={`Ordenar por ${label.toLowerCase()}, ${active && direction === 'asc' ? 'descendente' : 'ascendente'}`}>
            {label}<SortIcon direction={direction} className={styles.sortIcon}/>
          </button>
        </th>
      })}</tr></thead>
      <tbody>{rows.map(({ card, column, categoryName }) =>
        <tr className={styles.row} key={card.id}
          onClick={() => onOpen(card)} tabIndex={0}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen(card)
            }
          }}>
          <td className={styles.task}>{card.title}</td>
          <td>{column.name}</td>
          <td className={styles.muted}>{categoryName || '—'}</td>
          <td><span className={styles.people}>{card.assignees?.map(person =>
            <Avatar key={person.id} id={person.id} name={person.name}
              src={person.avatar_url} size={24}/>)}</span></td>
          <td>{card.priority ? priorityLabel[card.priority] : '—'}</td>
          <td>{formatDateRange(card.start_date, card.due_date)}</td>
          <td><span className={styles.labels}>{card.labels?.map(label =>
            <span className={styles.label} key={label.id}>{label.name}</span>)}</span></td>
        </tr>)}</tbody>
    </table>
  </div>
}
