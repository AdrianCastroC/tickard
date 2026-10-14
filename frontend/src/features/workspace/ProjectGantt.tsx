import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const ganttViewportRef = useRef<HTMLDivElement>(null)
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

  useLayoutEffect(() => {
    const viewport = ganttViewportRef.current
    if (!viewport) return

    // Fit the scroll area into the space left below the actual project header
    // and navigation, rather than assuming their height is always the same.
    const resizeViewport = () => {
      const available = window.innerHeight - viewport.getBoundingClientRect().top - 20
      viewport.style.maxHeight = `${Math.max(240, Math.floor(available))}px`
    }
    resizeViewport()
    window.addEventListener('resize', resizeViewport)
    return () => window.removeEventListener('resize', resizeViewport)
  }, [boards?.length])

  if (loading && !boards) return <section className="project-panel" role="status">Cargando Gantt de todos los tableros…</section>
  if (error) return <section className="project-panel" role="alert">
    <p>No se pudo cargar el Gantt del proyecto: {error}</p>
    <button type="button" className="ghost" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</button>
  </section>
  if (!boards?.length) return <section className="project-panel"><p>Este proyecto todavía no tiene tableros.</p></section>

  return <section className="project-gantt" aria-label={`Gantt del proyecto ${project.name}`}>
    <div ref={ganttViewportRef} className="project-gantt-viewport" tabIndex={0} aria-label="Área desplazable del Gantt del proyecto">
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
