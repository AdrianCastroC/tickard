import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type BacklogResolution, type BoardPayload, type Card } from '../../api'
import { orderedColumnCards } from './boardUtils'

export function useBoard(activeId: number | null, selection: number) {
  const [data, setData] = useState<BoardPayload | null>(null)
  const [selected, setSelected] = useState<{ card: Card; mode: 'view' | 'edit' } | null>(null)
  const [pendingMove, setPendingMove] = useState<{ cardId: number; columnId: number; position: number; resolution: BacklogResolution } | null>(null)
  const scope = useRef<{ id: number; selection: number; disposed: boolean } | null>(null)

  const refresh = useCallback(async () => {
    const request = scope.current
    if (!activeId || !request || request.disposed || request.id !== activeId || request.selection !== selection) return
    const next = await api<BoardPayload>(`/boards/${activeId}`)
    if (request.disposed || scope.current !== request || next.board.id !== activeId) return
    setData(next)
    setSelected((current) => {
      if (!current) return null
      const card = next.columns.flatMap((column) => column.cards).find((card) => card.id === current.card.id)
      return card ? { card, mode: current.mode } : null
    })
  }, [activeId, selection])

  useEffect(() => {
    if (!activeId) return
    const request = { id: activeId, selection, disposed: false }
    scope.current = request
    void refresh().catch(() => undefined)
    const timer = window.setInterval(() => {
      api<BoardPayload>(`/boards/${activeId}`).then((next) => {
        if (request.disposed || scope.current !== request || next.board.id !== activeId) return
        setData((current) => current?.board.id === activeId && next.revision <= current.revision ? current : next)
      }).catch(() => undefined)
    }, 4000)
    return () => { request.disposed = true; window.clearInterval(timer) }
  }, [activeId, selection, refresh])

  const board = data?.board.id === activeId ? data : null
  const openCard = selected && board
    ? board.columns.flatMap((column) => column.cards).find((card) => card.id === selected.card.id) ?? selected.card
    : null

  async function move(cardId: number, columnId: number, position: number) {
    const targetColumn = data?.columns.find((column) => column.id === columnId)
    const isBacklog = targetColumn?.workflow_state === 'backlog'
    if (!isBacklog) {
    setData((current) => {
      if (!current || current.board.id !== activeId) return current
      const card = current.columns.flatMap((column) => column.cards).find((item) => item.id === cardId)
      if (!card) return current
      const categories = current.categories ?? []
      const columns = current.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((item) => item.id !== cardId),
      }))
      const target = columns.find((column) => column.id === columnId)
      if (!target) return current
      const visual = orderedColumnCards(target, categories)
      const next = [...visual]
      next.splice(Math.min(position, next.length), 0, { ...card, column_id: columnId })
      return {
        ...current,
        columns: columns.map((column) => column.id === columnId
          ? { ...column, cards: next.map((item, index) => ({ ...item, position: index })) }
          : column),
      }
    })
    }
    try {
      await api(`/cards/${cardId}/move`, { method: 'POST', body: JSON.stringify({ column_id: columnId, position }) })
      await refresh()
    } catch (error) {
      await refresh()
      if (error instanceof ApiError && error.status === 409 && error.code === 'backlog_dependencies') {
        const data = error.data as { resolution?: BacklogResolution }
        if (data.resolution) setPendingMove({ cardId, columnId, position, resolution: data.resolution })
      }
    }
  }

  async function confirmPendingMove(selectedCardIds: number[], destinations: { board_id: number; column_id: number }[]) {
    if (!pendingMove) return
    await api(`/cards/${pendingMove.cardId}/move`, {
      method: 'POST',
      body: JSON.stringify({ column_id: pendingMove.columnId, position: pendingMove.position, backlog_resolution: { selected_card_ids: selectedCardIds, destinations } }),
    })
    setPendingMove(null)
    await refresh()
  }

  async function moveColumn(columnId: number, position: number) {
    setData((current) => {
      if (!current || current.board.id !== activeId) return current
      const ordered = [...current.columns].sort((a, b) => a.position - b.position)
      const moving = ordered.find((column) => column.id === columnId)
      if (!moving) return current
      const rest = ordered.filter((column) => column.id !== columnId)
      rest.splice(Math.min(position, rest.length), 0, moving)
      return {
        ...current,
        columns: rest.map((column, index) => ({ ...column, position: index })),
      }
    })
    try {
      await api(`/columns/${columnId}/move`, { method: 'POST', body: JSON.stringify({ position }) })
      await refresh()
    } catch {
      await refresh()
    }
  }

  return { board, selected, setSelected, openCard, refresh, move, moveColumn, pendingMove, setPendingMove, confirmPendingMove }
}
