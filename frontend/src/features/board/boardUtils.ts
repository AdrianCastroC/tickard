import { type BoardCategory, type Card } from '../../api'

export function orderedColumnCards(column: { cards: Card[] }, categories: BoardCategory[]) {
  const uncategorized = column.cards.filter((card) => !card.category_id)
  const grouped = categories
    .filter((category) => column.cards.some((card) => card.category_id === category.id))
    .flatMap((category) => column.cards.filter((card) => card.category_id === category.id))
  return [...uncategorized, ...grouped]
}
