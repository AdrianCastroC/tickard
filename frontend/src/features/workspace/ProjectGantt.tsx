import { cachedProjectRequest, invalidateProjectRequestCache } from '../../shared/projectRequestCache'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type BoardPayload, type Project, type Profile } from '../../api'
import { CardDrawer } from '../cards/CardDetail'
import { GanttView, type GanttDependencyNavigation } from '../board/GanttView'
import { ProjectLoadingIndicator } from './ProjectLoadingIndicator'
import { ProjectContentLoading } from './ProjectContentLoading'

type ProjectSnapshot = { projectId: number; boardIds: string; boards: BoardPayload[] }

// The skeleton depicts only the static Gantt structure, never fake Cards.
// It is reused before data arrives and while the browser lays out the grid.
function ProjectGanttSkeleton({ measuring = false }: { measuring?: boolean }) {
  return <ProjectContentLoading
    title={measuring ? 'Preparando Diagrama de Gantt' : 'Cargando Diagrama de Gantt'}
    description={measuring
      ? 'Ajustando el calendario y trazando las dependencias…'
      : 'Preparando tareas, dependencias y fechas del proyecto…'}>
    <div className="project-gantt-skeleton">
      <div className="project-gantt-skeleton-left">
        <span className="project-gantt-skeleton-header" />
        <span className="project-gantt-skeleton-header" />
        {Array.from({ length: 16 }, (_, index) =>
          <span key={index}
            className={index % 4 === 0 ? 'project-gantt-skeleton-group' : 'project-gantt-skeleton-row'} />)}
      </div>
      <div className="project-gantt-skeleton-right">
        <span className="project-gantt-skeleton-header" />
        <span className="project-gantt-skeleton-header" />
        {Array.from({ length: 16 }, (_, index) =>
          <span key={index}
            className={index % 4 === 0 ? 'project-gantt-skeleton-group' : 'project-gantt-skeleton-row'} />)}
      </div>
    </div>
  </ProjectContentLoading>
}
type Props = {
  project: Project
  profile: Profile
  onNavigateExternalCard: (target: GanttDependencyNavigation) => void
}

export function ProjectGantt({ project, profile, onNavigateExternalCard }: Props) {
  const boardIds = project.boards.map((board) => board.id).join(',')
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ cardId: number; boardId: number } | null>(null)
  const [detailBoard, setDetailBoard] = useState<BoardPayload | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [mountedKey, setMountedKey] = useState<string | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [renderAttempt, setRenderAttempt] = useState(0)
  const [preparationStalled, setPreparationStalled] = useState(false)
  const ganttViewportRef = useRef<HTMLDivElement>(null)
  const load = useCallback(async (signal?: AbortSignal, fresh = false) => {
    // Keep the existing server permission checks for every board.
    const ids = boardIds.split(',').filter(Boolean).map(Number)
    return Promise.all(ids.map((id) => {
      const path = `/boards/${id}?gantt=1`
      if (fresh) {
        invalidateProjectRequestCache(path)
        return api<BoardPayload>(path, { signal })
      }
      return cachedProjectRequest(path, (requestSignal) => api<BoardPayload>(path, { signal: requestSignal }), signal)
    }))
  }, [boardIds])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSelected(null)
    setDetailBoard(null)
    void load(controller.signal).then((boards) => {
      if (!alive) return
      setSnapshot({ projectId: project.id, boardIds, boards })
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setLoading(false)
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los tableros.')
    })
    return () => { alive = false; controller.abort() }
  }, [load, project.id, boardIds, refreshKey])

  const boards = snapshot?.projectId === project.id && snapshot.boardIds === boardIds
    ? snapshot.boards : null
  const columns = useMemo(() => boards?.flatMap((board) => board.columns) ?? [], [boards])
  const renderKey = boards ? `${project.id}:${boardIds}:${renderAttempt}` : null
  // The data-fetching render must have a chance to paint the skeleton
  // before a potentially expensive multi-year grid mounts.
  useEffect(() => {
    if (!renderKey) return
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setMountedKey(renderKey))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [renderKey])
  const chartMounted = renderKey !== null && mountedKey === renderKey
  const chartReady = renderKey !== null && readyKey === renderKey
  // A permanently unmeasurable grid must never strand a user behind a
  // spinner. Offer a render-only retry without refetching all boards.
  useEffect(() => {
    if (!chartMounted || chartReady) return
    const timer = window.setTimeout(() => setPreparationStalled(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [chartMounted, chartReady, renderKey])
  // Only a selected Card needs full comments, activities, modules and
  // checklists. Do not preload them across every board in the project.
  useEffect(() => {
    if (!selected) {
      setDetailBoard(null)
      setDetailLoading(false)
      return
    }
    let alive = true
    const controller = new AbortController()
    setDetailLoading(true)
    setDetailError(null)
    setDetailBoard(null)
    void api<BoardPayload>(`/boards/${selected.boardId}`, { signal: controller.signal }).then((payload) => {
      if (!alive) return
      setDetailBoard(payload)
      setDetailLoading(false)
    }).catch((cause: unknown) => {
      if (!alive) return
      setDetailLoading(false)
      setDetailError(cause instanceof Error ? cause.message : 'No se pudo abrir la Card.')
    })
    return () => { alive = false; controller.abort() }
  }, [selected?.boardId, selected?.cardId])

  const cardData = useMemo(() => {
    if (!selected || detailBoard?.board.id !== selected.boardId) return null
    const card = detailBoard.columns.flatMap((column) => column.cards)
      .find((item) => item.id === selected.cardId)
    return card ? { card, board: detailBoard } : null
  }, [detailBoard, selected])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [next, detailed] = await Promise.all([
        load(undefined, true),
        selected ? api<BoardPayload>(`/boards/${selected.boardId}`) : Promise.resolve(null),
      ])
      setSnapshot({ projectId: project.id, boardIds, boards: next })
      if (detailed) setDetailBoard(detailed)
    } finally {
      setRefreshing(false)
    }
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

  if (loading && !boards) return <ProjectGanttSkeleton />
  if (error) return <section className="project-panel" role="alert">
    <p>No se pudo cargar el Gantt del proyecto: {error}</p>
    <button type="button" className="ghost" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</button>
  </section>
  if (!boards?.length) return <section className="project-panel"><p>Este proyecto todavía no tiene tableros.</p></section>

  return <section className="project-gantt" aria-label={`Gantt del proyecto ${project.name}`}>
    {((loading && boards) || refreshing) && (
      <ProjectLoadingIndicator label="Actualizando Gantt…" floating />
    )}
    <div ref={ganttViewportRef} className="project-gantt-viewport" tabIndex={chartReady ? 0 : -1}
      aria-busy={!chartReady} aria-label="Área desplazable del Gantt del proyecto">
      {chartMounted && <div className={`project-gantt-render${chartReady ? '' : ' project-gantt-render-pending'}`}
        aria-hidden={!chartReady}>
        <GanttView key={`project-${project.id}-${renderAttempt}`}
          board={boards[0]} cards={columns} projectBoards={boards}
          canEdit={false}
          onOpen={(card) => {
            const source = boards.find((payload) => payload.columns.some((column) =>
              column.cards.some((item) => item.id === card.id)))
            if (source) setSelected({ cardId: card.id, boardId: source.board.id })
          }}
          onNavigateExternalCard={onNavigateExternalCard}
          onReady={() => setReadyKey(renderKey)}
          onChange={refresh} />
      </div>}
      {!chartReady && <div className="project-gantt-preparation">
        <ProjectGanttSkeleton measuring />
        {preparationStalled && <div className="project-gantt-preparation-retry" role="status">
          <p>El calendario está tardando más de lo esperado en prepararse.</p>
          <button type="button" className="ghost" onClick={() => {
            setPreparationStalled(false)
            setRenderAttempt(value => value + 1)
          }}>Reintentar preparación</button>
        </div>}
      </div>}
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
