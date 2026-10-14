import { useState } from 'react'
import { type CardDependency, type WorkflowState } from '../../api'
import { LinkIcon } from '../../shared/icons'
import { SectionToggle } from './cardSectionUi'

const STATUS_LABELS: Record<WorkflowState, string> = {
  backlog: 'Backlog',
  pending: 'Pendiente',
  in_progress: 'En progreso',
  review: 'En revisión',
  done: 'Completada',
}

// Iconos de estado suministrados para los hitos: no son controles editables.
const COMPLETED_PATH = 'M320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576zM438 209.7C427.3 201.9 412.3 204.3 404.5 215L285.1 379.2L233 327.1C223.6 317.7 208.4 317.7 199.1 327.1C189.8 336.5 189.7 351.7 199.1 361L271.1 433C276.1 438 282.9 440.5 289.9 440C296.9 439.5 303.3 435.9 307.4 430.2L443.3 243.2C451.1 232.5 448.7 217.5 438 209.7z'
const PENDING_PATH = 'M528 320C528 205.1 434.9 112 320 112C205.1 112 112 205.1 112 320C112 434.9 205.1 528 320 528C434.9 528 528 434.9 528 320zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z'

function DependencyStatusIcon({ complete }: { complete: boolean }) {
  return (
    <svg
      className={`milestone-dependency-icon${complete ? ' is-complete' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      aria-hidden="true"
    >
      <path fill="currentColor" d={complete ? COMPLETED_PATH : PENDING_PATH} />
    </svg>
  )
}

/** Lista informativa, generada desde las Cards predecesoras. No crea ni edita checklists. */
export function MilestoneDependencyList({ predecessors }: { predecessors: CardDependency[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const total = predecessors.length
  const done = predecessors.filter((dependency) => dependency.is_done === true).length

  return (
    <section className={`card-modal-section milestone-dependencies${collapsed ? ' is-collapsed' : ''}`}>
      <div className="section-head milestone-dependency-header">
        <h3>
          <SectionToggle
            icon={<LinkIcon />}
            label="Cards necesarias para el hito"
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          Cards necesarias para el hito
          <span className="milestone-dependency-auto">Automático · solo lectura</span>
        </h3>
        {total > 0 && (
          <div className="milestone-dependency-progress">
            <span className="milestone-dependency-count">{done}/{total} · faltan {total - done}</span>
            <div
              className="milestone-dependency-track"
              role="progressbar"
              aria-label="Cards necesarias completadas"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <span style={{ width: `${Math.round(done / total * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      {!collapsed && (
        total === 0
          ? <p className="milestone-dependency-empty">Este hito todavía no tiene Cards predecesoras.</p>
          : <ul className="milestone-dependency-list">
            {predecessors.map((dependency) => {
              const complete = dependency.is_done === true
              return (
                <li key={dependency.id} className="milestone-dependency-item">
                  <DependencyStatusIcon complete={complete} />
                  <div className="milestone-dependency-info">
                    <span className="milestone-dependency-title">{dependency.title}</span>
                    {dependency.board_name && (
                      <span className="milestone-dependency-board" title={dependency.board_name}>
                        {dependency.board_name}
                      </span>
                    )}
                  </div>
                  <span className={`milestone-dependency-state${complete ? ' is-complete' : ''}`}>
                    {STATUS_LABELS[dependency.workflow_state ?? 'pending']}
                  </span>
                </li>
              )
            })}
          </ul>
      )}
    </section>
  )
}
