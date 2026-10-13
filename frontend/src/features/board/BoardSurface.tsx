import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Profile, Project } from '../../api'
import { CategoriesDrawer } from '../administration'
import { CardDrawer } from '../cards/CardDetail'
import { BoardHeader } from '../workspace/BoardHeader'
import type { BoardViewMode } from '../workspace/BoardViews'
import { FiltersBar } from '../workspace/FiltersBar'
import { BoardPulse } from './BoardPulse'
import { CreateCardModal } from './CreateCardModal'
import { Kanban } from './Kanban'
import { filteredBoardColumns } from './boardUtils'
import type { useBoard } from './useBoard'
import type { useBoardFilters } from './useBoardFilters'
import { ListView } from './ListView'
import { TableView } from './TableView'
import { GanttView, type GanttCardFocus, type GanttDependencyNavigation } from './GanttView'
import { BoardSummary } from './BoardSummary'
import { BoardConfigPanel } from './BoardConfigPanel'
import { BacklogResolutionModal } from './BacklogResolutionModal'

type Props = {
  state: ReturnType<typeof useBoard>
  filters: ReturnType<typeof useBoardFilters>
  activeBoardId: number | null
  project?: Project
  profile: Profile
  query: string
  onBoardDeleted?: (boardId: number) => Promise<void>
  onNavigateExternalCard: (target: GanttDependencyNavigation) => void
  ganttFocus?: GanttCardFocus | null
  embedded?: boolean
}

export function BoardSurface({ state, filters, activeBoardId, project, profile, query, onBoardDeleted, onNavigateExternalCard, ganttFocus, embedded = false }: Props) {
  const { board: view, selected, setSelected, openCard, refresh, move, moveColumn, pendingMove, setPendingMove, confirmPendingMove } = state
  const [createColumn, setCreateColumn] = useState<{ id: number; name: string } | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [viewModes, setViewModes] = useState<Record<number, BoardViewMode>>({})
  const canEdit = view?.role === 'responsable' || view?.role === 'editor'
  const canManage = view?.role === 'responsable'
  const clientView = view?.role === 'cliente'
  const backlog = view?.columns.find((column) => column.workflow_state === 'backlog') ?? view?.columns[0]
  const filteredColumns = useMemo(() => view ? filteredBoardColumns(view, query, filters.assignee, filters.teamId, filters.label, filters.priority) : [], [view, query, filters.assignee, filters.teamId, filters.label, filters.priority])
  const storedView = activeBoardId ? localStorage.getItem(`tickard:board-view:${activeBoardId}`) : null
  const viewMode = activeBoardId ? viewModes[activeBoardId] ?? (storedView === 'summary' || storedView === 'list' || storedView === 'table' || storedView === 'gantt' ? storedView : 'summary') : 'summary'

  useEffect(() => {
    if (pendingMove && activeBoardId !== null && !pendingMove.resolution.boards.some((board) => board.id === activeBoardId)) {
      setPendingMove(null)
    }
  }, [activeBoardId, pendingMove, setPendingMove])

  useEffect(() => {
    // Cross-board navigation should land in the Gantt even if this board was
    // previously displayed as Kanban, a table or a summary.
    if (!ganttFocus || ganttFocus.boardId !== activeBoardId || view?.board.id !== activeBoardId) return
    if (viewMode !== 'gantt') {
      setViewModes((current) => ({ ...current, [activeBoardId]: 'gantt' }))
      localStorage.setItem(`tickard:board-view:${activeBoardId}`, 'gantt')
    }
  }, [activeBoardId, ganttFocus, view?.board.id, viewMode])

  function changeViewMode(value: BoardViewMode) {
    if (!activeBoardId) return
    setViewModes((current) => ({ ...current, [activeBoardId]: value }))
    localStorage.setItem(`tickard:board-view:${activeBoardId}`, value)
  }

  return <>
    <BoardHeader show={Boolean(view || activeBoardId)}
      title={view?.board.name || project?.boards.find((item) => item.id === activeBoardId)?.name}
      subtitle={view?.board.project_name || project?.name}
      canEdit={canEdit} backlog={backlog} filtersActive={filters.active} filtersOpen={filters.open}
      viewMode={viewMode} onViewModeChange={changeViewMode}
      onToggleFilters={() => filters.setOpen((current) => !current)} onAdd={setCreateColumn} />
    <FiltersBar open={Boolean(view && filters.open)} clientView={clientView}
      visibility={view?.visibility ?? {}} members={view?.members ?? []} labels={view?.labels ?? []}
      assignee={filters.assignee} teamId={filters.teamId} teams={view?.teams ?? []}
      label={filters.label} priority={filters.priority}
      onAssignee={filters.setAssignee} onTeam={filters.setTeamId}
      onLabel={filters.setLabel} onPriority={filters.setPriority} />
    {!view && !activeBoardId && <div className="empty-board"><div><h2>{profile.user.is_admin ? 'Inicia un proyecto' : 'Espera a que te asignen un proyecto'}</h2><p className="muted">{profile.user.is_admin ? 'Crea el primer proyecto desde el lateral y abre su tablero.' : 'Cuando un responsable te añada, el proyecto saldrá en el lateral.'}</p></div></div>}
    {activeBoardId && !view && <div className="empty-board"><p className="muted">Cargando el tablero…</p></div>}
    {view && <div className={`workspace${embedded ? ' board-embedded' : ''}`}>
      {viewMode === 'summary' && <BoardSummary board={view} projectName={project?.name} onConfigure={() => setShowConfig(true)} />}
      {viewMode === 'list' && <ListView board={view} cards={filteredColumns} onOpen={(card) => setSelected({ card, mode: 'view' })} />}
      {viewMode === 'table' && <TableView board={view} cards={filteredColumns} onOpen={(card) => setSelected({ card, mode: 'view' })} />}
      {viewMode === 'gantt' && <GanttView key={view.board.id} board={view}
        cards={ganttFocus?.boardId === view.board.id ? view.columns : filteredColumns}
        canEdit={canEdit} onOpen={(card) => setSelected({ card, mode: 'view' })}
        onNavigateExternalCard={onNavigateExternalCard}
        focus={ganttFocus?.boardId === view.board.id ? ganttFocus : null}
        onChange={refresh} />}
      {viewMode === 'board' && <Kanban board={view} canEdit={canEdit} canManage={canManage} query={query}
        assignee={filters.assignee} teamId={filters.teamId} label={filters.label} priority={filters.priority}
        onOpen={(card) => setSelected({ card, mode: 'view' })}
        onEdit={(card) => setSelected({ card, mode: 'edit' })}
        onMove={move} onMoveColumn={moveColumn}
        onAdd={(id, name) => setCreateColumn({ id, name })}
        onCreatedColumn={refresh} onRefresh={refresh}
        onManageCategories={() => setShowCategories(true)} />}
      {viewMode === 'board' && <BoardPulse columns={view.columns} />}
    </div>}
    {createPortal(<>
      {selected && view && openCard && <CardDrawer card={openCard} mode={selected.mode}
        board={view} currentUser={profile.user} canEdit={canEdit}
        onClose={() => setSelected(null)}
        onEdit={() => setSelected({ card: openCard, mode: 'edit' })}
        onView={() => setSelected({ card: openCard, mode: 'view' })}
        onMove={move}
        onChange={refresh} />}
      {pendingMove && <BacklogResolutionModal resolution={pendingMove.resolution}
        onCancel={() => setPendingMove(null)}
        onConfirm={confirmPendingMove} />}
      {showCategories && view && <CategoriesDrawer board={view}
        onClose={() => setShowCategories(false)} onChange={refresh} />}
      {showConfig && view && <BoardConfigPanel board={view} onClose={() => setShowConfig(false)} onChange={refresh} onDeleted={async () => { setShowConfig(false); if (onBoardDeleted) await onBoardDeleted(view.board.id); else await refresh() }} />}
      {createColumn && view && <CreateCardModal board={view} column={createColumn}
        onClose={() => setCreateColumn(null)}
        onCreated={async () => { setCreateColumn(null); await refresh() }} />}
    </>, document.body)}
  </>
}
