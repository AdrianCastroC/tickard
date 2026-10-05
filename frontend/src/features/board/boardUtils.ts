import { type BoardCategory, type Card, type Column } from '../../api'

function assignedTo(card: Card, userId: string) {
  if (card.assignees?.some((person) => String(person.id) === userId)) return true
  return card.teams?.some((team) => team.member_ids?.some((id) => String(id) === userId)) ?? false
}

export function matchesBoardFilters(card: Card, query: string, assignee: string, teamId: string, label: string, priority: string) {
  if (query && !card.title.toLowerCase().includes(query.toLowerCase())) return false
  if (assignee && !assignedTo(card, assignee)) return false
  if (teamId && !card.teams?.some((team) => String(team.id) === teamId)) return false
  if (label && !card.labels?.some((item) => String(item.id) === label)) return false
  if (priority && card.priority !== priority) return false
  return true
}

export function filteredBoardColumns(board: { columns: Column[] }, query: string, assignee: string, teamId: string, label: string, priority: string) {
  return board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => matchesBoardFilters(card, query, assignee, teamId, label, priority)),
  }))
}

export function orderedColumnCards(column: { cards: Card[] }, categories: BoardCategory[]) {
  const uncategorized = column.cards.filter((card) => !card.category_id)
  const grouped = categories
    .filter((category) => column.cards.some((card) => card.category_id === category.id))
    .flatMap((category) => column.cards.filter((card) => card.category_id === category.id))
  return [...uncategorized, ...grouped]
}
