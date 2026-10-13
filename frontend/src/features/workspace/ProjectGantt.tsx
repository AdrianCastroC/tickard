import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiError, type BacklogResolution, type BoardPayload, type Project, type Profile } from '../../api'
import { CardDrawer } from '../cards/CardDetail'
import { BacklogResolutionModal } from '../board/BacklogResolutionModal'
import { GanttView, type GanttDependencyNavigation } from '../board/GanttView'

type ProjectSnapshot = { projectId: number; boardIds: string; boards: BoardPayload[] }
type Props = {
  project: Project
  profile: Profile
  onNavigateExternalCard: (target: GanttDependencyNavigation) => void
}

export function ProjectGantt({ project, profile, onNavigateExternalCard }: Props) {
  const boardIds = project.boards.map((board) => board.id).join(',')
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ cardId: number; mode: 'view' | 'edit' } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingMove, setPendingMove] = useState<{
    cardId: number; columnId: number; position: number; resolution: BacklogResolution
  } | null>(null)
  const load = useCallback(async () => {
    // Reuse the existing authenticated board endpoint: role, client visibility
    // and CardPresenter filtering are applied to every board by the backend.
    const ids = boardIds.split(',').filter(Boolean).map(Number)
    return Promise.all(ids.map((id) => api<BoardPayload>(`/boards/${id}`)))
  }, [boardIds])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setSelected(null)
    void load().then((boards) => {
      if (!alive) return
      setSnapshot({ projectId: project.id, boardIds, boards })
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setLoading(false)
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los tableros.')
    })
    return () => { alive = false }
  }, [load, project.id, boardIds, refreshKey])

  const boards = snapshot?.projectId === project.id && snapshot.boardIds === boardIds
    ? snapshot.boards : null
  const columns = useMemo(() => boards?.flatMap((board) => board.columns) ?? [], [boards])
  const cardData = useMemo(() => {
    if (!selected || !boards) return null
    for (const board of boards) {
      const card = board.columns.flatMap((column) => column.cards).find((item) => item.id === selected.cardId)
      if (card) return { card, board }
    }
    return null
  }, [boards, selected])

  const refresh = useCallback(async () => {
    const next = await load()
    setSnapshot({ projectId: project.id, boardIds, boards: next })
  }, [load, project.id, boardIds])

  const canEdit = boards?.every((board) => board.role === 'responsable' || board.role === 'editor') ?? false
  const totalCards = columns.reduce((total, column) => total + column.cards.length, 0)
  const plannedCards = columns.reduce((total, column) =>
    total + (column.workflow_state === 'backlog' ? 0 : column.cards.filter((card) => card.start_date && card.due_date).length), 0)

  if (loading && !boards) return <section className="project-panel" role="status">Cargando Gantt de todos los tableros…</section>
  if (error) return <section className="project-panel" role="alert">
    <p>No se pudo cargar el Gantt del proyecto: {error}</p>
    <button type="button" className="ghost" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</button>
  </section>
  if (!boards?.length) return <section className="project-panel"><p>Este proyecto todavía no tiene tableros.</p></section>

  return <section aria-label={`Gantt del proyecto ${project.name}`} style={{ display: 'grid', gap: 12, minWidth: 0, minHeight: 500 }}>
    <div className="project-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '12px 16px' }}>
      <div>
        <strong>Gantt del proyecto · {project.name}</strong>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {boards.length} tableros · {totalCards} Cards · {plannedCards} planificadas
        </p>
      </div>
      <button type="button" className="ghost" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
        {loading ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
    <div style={{ minWidth: 0, minHeight: 440 }}>
      <GanttView key={`project-${project.id}`}
        board={boards[0]} cards={columns} projectBoards={boards}
        canEdit={canEdit}
        onOpen={(card) => setSelected({ cardId: card.id, mode: 'view' })}
        onNavigateExternalCard={onNavigateExternalCard}
        onChange={refresh} />
    </div>
    {cardData && createPortal(
      <CardDrawer key={cardData.card.id} card={cardData.card} mode={selected!.mode}
        board={cardData.board} currentUser={profile.user}
        canEdit={cardData.board.role === 'responsable' || cardData.board.role === 'editor'}
        onClose={() => setSelected(null)}
        onEdit={() => setSelected({ cardId: cardData.card.id, mode: 'edit' })}
        onView={() => setSelected({ cardId: cardData.card.id, mode: 'view' })}
        onChange={refresh}
        onMove={async (cardId, columnId, position) => {
          try {
            await api(`/cards/${cardId}/move`, { method: 'POST', body: JSON.stringify({ column_id: columnId, position }) })
            await refresh()
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 409 && cause.code === 'backlog_dependencies') {
              const resolution = (cause.data as { resolution?: BacklogResolution }).resolution
              if (resolution) {
                setPendingMove({ cardId, columnId, position, resolution })
                return
              }
            }
            throw cause
          }
        }} />,
      document.body,
    )}
    {pendingMove && createPortal(
      <BacklogResolutionModal resolution={pendingMove.resolution}
        onCancel={() => setPendingMove(null)}
        onConfirm={async (selectedCardIds, destinations) => {
          await api(`/cards/${pendingMove.cardId}/move`, {
            method: 'POST',
            body: JSON.stringify({
              column_id: pendingMove.columnId,
              position: pendingMove.position,
              backlog_resolution: { selected_card_ids: selectedCardIds, destinations },
            }),
          })
          setPendingMove(null)
          await refresh()
        }} />,
      document.body,
    )}
  </section>
}
