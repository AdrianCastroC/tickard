import { type BoardPayload } from '../../api'

function columnShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return counts.map(() => 0)
  const exact = counts.map((count) => (count / total) * 100)
  const shares = exact.map((value) => Math.floor(value))
  let leftover = 100 - shares.reduce((sum, value) => sum + value, 0)
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((item) => {
      if (leftover <= 0) return
      shares[item.index] += 1
      leftover -= 1
    })
  return shares
}

export function BoardPulse({ columns }: { columns: BoardPayload['columns'] }) {
  const shares = columnShares(columns.map((column) => column.cards.length))
  return (
    <div className="pulse">
      {columns.map((column, index) => (
        <article key={column.id}>
          <p className="muted">{column.name}</p>
          <strong>{column.cards.length}</strong>
          <span>{shares[index]}% del tablero</span>
        </article>
      ))}
    </div>
  )
}



