import type { CSSProperties } from 'react'
import type { BoardPayload, Card } from '../../api'
import { Avatar, priorityLabel } from '../../shared/ui'
import { formatDateRange } from './DateRangePicker'
import { orderedColumnCards } from './boardUtils'
import styles from './ListView.module.css'

type Props = { board: BoardPayload; cards: BoardPayload['columns']; onOpen: (card: Card) => void }

export function ListView({ board, cards, onOpen }: Props) {
  return <div className={styles.list}>
    {cards.map((column) => {
      const ordered = orderedColumnCards(column, board.categories ?? [])
      return <section className={styles.group} key={column.id}>
        <div
          className={`${styles.groupHeader}${column.color ? ` ${styles.hasColor}` : ''}`}
          style={column.color ? { '--column-stripe': column.color } as CSSProperties : undefined}
        >
          <span>{column.name}</span><span className="muted">{ordered.length}</span>
        </div>
        {ordered.map((card) => <button className={styles.card} key={card.id} type="button" onClick={() => onOpen(card)}>
          <span className={styles.title}>{card.title}</span>
          <span className={styles.meta}>{card.priority && priorityLabel[card.priority]} {formatDateRange(card.start_date, card.due_date)}</span>
          <span className={styles.people}>{card.assignees?.map((person) => <Avatar key={person.id} id={person.id} name={person.name} size={24} />)}</span>
          <span className={styles.labels}>{card.labels?.map((label) => <span className={styles.label} key={label.id}>{label.name}</span>)}</span>
        </button>)}
      </section>
    })}
  </div>
}
