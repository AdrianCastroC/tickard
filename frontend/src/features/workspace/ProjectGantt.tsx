import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type BoardPayload, type Project, type Profile } from '../../api'
import { CardDrawer } from '../cards/CardDetail'
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
  const [selected, setSelected] = useState<{ cardId: number; boardId: number } | null>(null)
  const [detailBoard, setDetailBoard] = useState<BoardPayload | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const ganttViewportRef = useRef<HTMLDivElement>(null)
  const load = useCallback(async () => {
    // Reuse the existing authenticated board endpoint: role, client visibility
    // and CardPresenter filtering are applied to every board by the backend.
    const ids = boardIds.split(',').filter(Boolean).map(Number)
    return Promise.all(ids.map((id) => api<BoardPayload>(`/boards/${id}?gantt=1`)))
  }, [boardIds])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setSelected(null)
    setDetailBoard(null)
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
  // Only a selected Card needs full comments, activities, modules and
  // checklists. Do not preload them across every board in the project.
  useEffect(() => {
    if (!selected) {
      setDetailBoard(null)
      setDetailLoading(false)
      return
    }
    let alive = true
    setDetailLoading(true)
    setDetailError(null)
    setDetailBoard(null)
    void api<BoardPayload>(`/boards/${selected.boardId}`).then((payload) => {
      if (!alive) return
      setDetailBoard(payload)
      setDetailLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setDetailLoading(false)
      setDetailError(cause instanceof Error ? cause.message : 'No se pudo abrir la Card.')
    })
    return () => { alive = false }
  }, [selected?.boardId, selected?.cardId])

  const cardData = useMemo(() => {
    if (!selected || detailBoard?.board.id !== selected.boardId) return null
    const card = detailBoard.columns.flatMap((column) => column.cards)
      .find((item) => item.id === selected.cardId)
    return card ? { card, board: detailBoard } : null
  }, [detailBoard, selected])

  const refresh = useCallback(async () => {
    const [next, detailed] = await Promise.all([
      load(),
      selected ? api<BoardPayload>(`/boards/${selected.boardId}`) : Promise.resolve(null),
    ])
    setSnapshot({ projectId: project.id, boardIds, boards: next })
    if (detailed) setDetailBoard(detailed)
  }, [load, project.id, boardIds, selected?.boardId])

  useLayoutEffect(() => {
    const viewport = ganttViewportRef.current
    if (!viewport) return

    // Fit the scroll area into the space left below the actual project header
    // and navigation, rather than assuming their height is always the same.
    const resizeViewport = () => {
      const available = window.innerHeight - viewport.getBoundingClientRect().top - 20
      viewport.style.height = `${Math.max(240, Math.floor(available))}px`
    }
    resizeViewport()
    window.addEventListener('resize', resizeViewport)
    return () => window.removeEventListener('resize', resizeViewport)
  }, [boards?.length])

  if (loading && !boards) return <section className="project-gantt-loading" role="status" aria-live="polite" aria-label="Cargando Gantt del proyecto">
    <p>Cargando Gantt del proyecto…</p>
    <div className="project-gantt-skeleton" aria-hidden="true">
      <div className="project-gantt-skeleton-left">
        <span className="project-gantt-skeleton-header" />
        <span className="project-gantt-skeleton-header" />
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className={index % 4 === 0 ? 'project-gantt-skeleton-group' : 'project-gantt-skeleton-row'} />
        ))}
      </div>
      <div className="project-gantt-skeleton-right">
        <span className="project-gantt-skeleton-header" />
        <span className="project-gantt-skeleton-header" />
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className={index % 4 === 0 ? 'project-gantt-skeleton-group' : 'project-gantt-skeleton-row'}>
            {index % 4 !== 0 && <i style={{ width: `${24 + index * 6}%` }} />}
          </span>
        ))}
      </div>
    </div>
  </section>
  if (error) return <section className="project-panel" role="alert">
    <p>No se pudo cargar el Gantt del proyecto: {error}</p>
    <button type="button" className="ghost" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</button>
  </section>
  if (!boards?.length) return <section className="project-panel"><p>Este proyecto todavía no tiene tableros.</p></section>

  return <section className="project-gantt" aria-label={`Gantt del proyecto ${project.name}`}>
    <div ref={ganttViewportRef} className="project-gantt-viewport" tabIndex={0} aria-label="Área desplazable del Gantt del proyecto">
      <GanttView key={`project-${project.id}`}
        board={boards[0]} cards={columns} projectBoards={boards}
        canEdit={false}
        onOpen={(card) => {
          const source = boards.find((payload) => payload.columns.some((column) =>
            column.cards.some((item) => item.id === card.id)))
          if (source) setSelected({ cardId: card.id, boardId: source.board.id })
        }}
        onNavigateExternalCard={onNavigateExternalCard}
        onChange={refresh} />
    </div>
    {selected && (detailLoading || detailError) && createPortal(
      <div className="modal-back" role="status">
        <div className="modal">
          {detailLoading ? 'Cargando detalles de la Card…' : detailError}
          {detailError && <button type="button" className="ghost" onClick={() => setSelected(null)}>Cerrar</button>}
        </div>
      </div>,
      document.body,
    )}
    {cardData && createPortal(
      <CardDrawer key={cardData.card.id} card={cardData.card} mode="view"
        board={cardData.board} currentUser={profile.user}
        canEdit={false}
        onClose={() => setSelected(null)}
        onEdit={() => {}}
        onView={() => {}}
        onChange={refresh}
        onMove={async () => {}}
        onOpenRelatedCard={(cardId, boardId) => setSelected({ cardId, boardId })} />,
      document.body,
    )}
  </section>
}
