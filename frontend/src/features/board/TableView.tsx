import type { BoardPayload, Card } from '../../api'
import { Avatar, priorityLabel } from '../../shared/ui'
import { formatDateRange } from './DateRangePicker'
import { orderedColumnCards } from './boardUtils'
import styles from './TableView.module.css'

type Props = { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }

export function TableView({ board, cards, onOpen }: Props) {
  return <div className={styles.scroll}><table className={styles.table}><thead><tr>
    <th>Tarea</th><th>Estado</th><th>Categoría</th><th>Responsable</th><th>Prioridad</th><th>Periodo</th><th>Etiquetas</th>
  </tr></thead><tbody>{cards.flatMap((column) => orderedColumnCards(column, board.categories ?? []).map((card) => {
    const category = board.categories?.find((item) => item.id === card.category_id)
    return <tr className={styles.row} key={card.id} onClick={() => onOpen(card)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(card) } }}>
      <td className={styles.task}>{card.title}</td><td>{column.name}</td><td className={styles.muted}>{category?.name ?? '—'}</td>
      <td><span className={styles.people}>{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} size={24} />)}</span></td>
      <td>{card.priority ? priorityLabel[card.priority] : '—'}</td><td>{formatDateRange(card.start_date, card.due_date)}</td>
      <td><span className={styles.labels}>{card.labels?.map((label) => <span className={styles.label} key={label.id}>{label.name}</span>)}</span></td>
    </tr>
  }))}</tbody></table></div>
}
