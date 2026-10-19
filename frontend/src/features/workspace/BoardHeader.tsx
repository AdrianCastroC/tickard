import type { RefObject } from 'react'
import { FilterFunnelIcon, PlusIcon } from '../../shared/icons'
import { BoardViews, type BoardViewMode } from './BoardViews'

type Props = {
  title?: string
  subtitle?: string
  show: boolean
  canEdit: boolean
  backlog?: { id: number; name: string }
  filtersActive: boolean
  filtersOpen: boolean
  filterButtonRef: RefObject<HTMLButtonElement | null>
  viewMode: BoardViewMode
  onViewModeChange: (value: BoardViewMode) => void
  onToggleFilters: () => void
  onAdd: (column: { id: number; name: string }) => void
}

export function BoardHeader({
  title, subtitle, show, canEdit, backlog, filtersActive, filtersOpen,
  filterButtonRef, viewMode, onViewModeChange, onToggleFilters, onAdd,
}: Props) {
  if (!show) return null

  return (
    <div className="board-head">
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      <div className="views">
        <BoardViews value={viewMode} onChange={onViewModeChange} />
        <div className="task-actions">
          {viewMode !== 'summary' && <button
            ref={filterButtonRef}
            className={`icon-button board-filter-trigger${filtersOpen || filtersActive ? ' on' : ''}`}
            type="button"
            aria-label={filtersActive ? 'Filtros activos' : 'Filtros'}
            aria-haspopup="dialog"
            aria-controls={filtersOpen ? 'board-filters-popover' : undefined}
            aria-expanded={filtersOpen}
            title="Filtros"
            onClick={onToggleFilters}
          >
            <FilterFunnelIcon />
            {filtersActive && <span className="board-filter-active-dot" aria-hidden="true" />}
          </button>}
          {canEdit && backlog && (
            <button className="primary" type="button" onClick={() => onAdd(backlog)}>
              <PlusIcon /> Nueva tarea
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
